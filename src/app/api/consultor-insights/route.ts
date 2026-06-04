import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractBalancedJSON, repairJSON } from '@/lib/llm-json'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const VALID_TYPES = new Set(['caso_uso', 'sector', 'herramienta', 'efectividad', 'patron'])
const CACHE_MS = 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY
  const apiUrl = process.env.OPENROUTER_API_URL
  const model = process.env.OPENROUTER_MODEL

  if (!apiKey || !apiUrl || !model) {
    return NextResponse.json({ skipped: true, reason: 'config_missing' })
  }

  const body = await req.json().catch(() => ({})) as { consultorId?: string; force?: boolean }
  const { consultorId, force = false } = body
  if (!consultorId) {
    return NextResponse.json({ error: 'consultorId required' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Check cache unless force=true
  if (!force) {
    const since = new Date(Date.now() - CACHE_MS).toISOString()
    const { data: cached } = await supabase
      .from('insights')
      .select('tipo, metrica, descripcion')
      .eq('id_consultor', consultorId)
      .eq('fuente', 'consultor-profile')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(3)

    if (cached && cached.length > 0) {
      return NextResponse.json({
        insights: cached.map(r => ({ titulo: r.metrica, detalle: r.descripcion, tipo: r.tipo })),
        cached: true,
      })
    }
  }

  // Fetch consultor data
  const { data: consultorias } = await supabase
    .from('consultorias')
    .select('id, categoria_caso, categoria_caso_uso, servicio, status')
    .eq('id_consultor', consultorId)

  if (!consultorias || consultorias.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no_data' })
  }

  const consultoriaIds = consultorias.map((c: { id: string }) => c.id)

  const { data: sesiones } = await supabase
    .from('registro_sesion')
    .select('acciones_realizadas, resultado_final')
    .in('id_consultoria', consultoriaIds)
    .not('acciones_realizadas', 'is', null)
    .limit(60)

  if (!sesiones || sesiones.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no_acciones' })
  }

  // Build prompt context
  const casoCounts: Record<string, number> = {}
  for (const c of consultorias) {
    const cat = (c as { categoria_caso?: string; categoria_caso_uso?: string }).categoria_caso
      || (c as { categoria_caso?: string; categoria_caso_uso?: string }).categoria_caso_uso
    if (cat) casoCounts[cat] = (casoCounts[cat] || 0) + 1
  }
  const topCasos = Object.entries(casoCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${k} (${v})`)
    .join(', ')

  const accionesList = (sesiones as { acciones_realizadas: string | null }[])
    .map((s, i) => `[${i + 1}] ${String(s.acciones_realizadas).slice(0, 280)}`)
    .join('\n')

  const prompt = `Eres un analista experto en consultoría de inteligencia artificial. Analiza las acciones realizadas en sesiones de consultoría y genera exactamente 1 a 3 insights concisos sobre el perfil y especialización del consultor.

CONTEXTO:
- Consultorias totales: ${consultorias.length}
- Casos de uso registrados: ${topCasos || 'Sin datos'}
- Sesiones con acciones documentadas: ${sesiones.length}

ACCIONES REALIZADAS EN SESIONES:
${accionesList}

Devuelve ÚNICAMENTE un JSON válido con esta forma exacta, sin texto adicional antes ni después:
{
  "insights": [
    {
      "titulo": "Texto corto del insight (máximo 8 palabras)",
      "detalle": "Una o dos oraciones con evidencia concreta de los datos",
      "tipo": "caso_uso"
    }
  ]
}

REGLAS:
- Genera entre 1 y 3 insights ordenados de mayor a menor relevancia
- Sé específico: menciona herramientas, áreas o patrones concretos visibles en los datos
- No inventes información que no esté en las acciones
- Escribe en español
- El campo tipo debe ser exactamente uno de: caso_uso, sector, herramienta, efectividad, patron`

  // Call LLM
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  let raw: string
  try {
    const res = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 600,
        ...(model.startsWith('openai/') ||
          model.startsWith('anthropic/') ||
          model.startsWith('google/gemini') ||
          model.startsWith('moonshotai/')
          ? { response_format: { type: 'json_object' } }
          : {}),
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      if (res.status === 429) {
        return NextResponse.json({ skipped: true, reason: 'rate_limit' })
      }
      const txt = await res.text()
      return NextResponse.json({ error: `LLM error ${res.status}`, detail: txt }, { status: 502 })
    }
    const data = await res.json()
    raw = data.choices?.[0]?.message?.content ?? ''
  } catch {
    clearTimeout(timeoutId)
    return NextResponse.json({ error: 'LLM timeout or network error' }, { status: 502 })
  }

  // Parse JSON with 3-strategy fallback
  type InsightRaw = { titulo: string; detalle: string; tipo: string }
  let parsed: { insights: InsightRaw[] } | null = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    const extracted = extractBalancedJSON(raw)
    if (extracted) {
      try { parsed = JSON.parse(extracted) } catch { /* continue */ }
    }
    if (!parsed) {
      try { parsed = JSON.parse(repairJSON(raw)) } catch {
        return NextResponse.json({ error: 'JSON parse failed', raw }, { status: 502 })
      }
    }
  }

  const insights = (parsed?.insights ?? [])
    .slice(0, 3)
    .map((ins: InsightRaw) => ({
      titulo: String(ins.titulo ?? '').trim(),
      detalle: String(ins.detalle ?? '').trim(),
      tipo: VALID_TYPES.has(ins.tipo) ? ins.tipo : 'patron',
    }))
    .filter((ins: { titulo: string }) => ins.titulo.length > 0)

  // Persist to cache
  if (insights.length > 0) {
    const now = new Date().toISOString()
    await supabase.from('insights').insert(
      insights.map((ins: { titulo: string; detalle: string; tipo: string }) => ({
        tipo: ins.tipo,
        metrica: ins.titulo,
        valor_texto: ins.titulo,
        descripcion: ins.detalle,
        fuente: 'consultor-profile',
        id_consultor: consultorId,
        periodo_inicio: now,
        periodo_fin: now,
      }))
    )
  }

  return NextResponse.json({ insights, cached: false })
}
