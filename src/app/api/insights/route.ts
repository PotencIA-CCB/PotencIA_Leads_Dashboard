// Required env vars:
// OPENCODE_API_KEY      — API key for Opencode Go
// OPENCODE_API_BASE_URL — Base URL for Opencode Go API
// OPENCODE_MODEL        — Model ID to use
// INSIGHTS_MIN_NEW_RECORDS — Min new consultorias before regenerating (default: 20)

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function buildImpactContext(supabase: SupabaseClient): Promise<string> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    // consulData and picosData are independent — parallelize
    const [consulRes, picosRes] = await Promise.all([
      supabase
        .from('consultorias')
        .select('id, categoria_caso_uso, nivel_potencia')
        .gte('fecha', thirtyDaysAgo),
      supabase
        .from('consultas_por_semana')
        .select('semana_inicio, total, productos_creados, minutos_totales')
        .order('semana_inicio', { ascending: false })
        .limit(4),
    ])
    const consulData = consulRes.data
    const picosData = picosRes.data

    const ids = (consulData ?? []).map((c) => c.id)
    // sesionData depends on consulData ids — must run after, but only this one is sequential
    const { data: sesionData } = ids.length > 0
      ? await supabase.from('registro_sesion').select('id_consultoria, cantidad_productos').in('id_consultoria', ids)
      : { data: [] as Array<{ id_consultoria: string; cantidad_productos: number | null }> }

    const prodByConsultoria: Record<string, number> = {}
    for (const s of sesionData ?? []) {
      prodByConsultoria[s.id_consultoria] = s.cantidad_productos || 0
    }

    const casoMap: Record<string, number> = {}
    const potenciaMap: Record<string, number> = {}
    for (const c of consulData ?? []) {
      const caso = c.categoria_caso_uso ?? 'Sin categorizar'
      const potencia = c.nivel_potencia ?? 'Sin nivel'
      casoMap[caso] = (casoMap[caso] || 0) + (prodByConsultoria[c.id] || 0)
      potenciaMap[potencia] = (potenciaMap[potencia] || 0) + 1
    }

    const top5Casos = Object.entries(casoMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([caso, prod]) => `  - ${caso}: ${prod} productos`)
      .join('\n')

    const potenciaDistrib = Object.entries(potenciaMap)
      .sort(([, a], [, b]) => b - a)
      .map(([nivel, count]) => `  - ${nivel}: ${count}`)
      .join('\n')

    const picosCtx = (picosData ?? [])
      .map((p) => `  - Sem ${p.semana_inicio}: ${p.total} consultas, ${p.productos_creados ?? 0} productos, ${((p.minutos_totales ?? 0) / 60).toFixed(1)}h`)
      .join('\n')

    const parts: string[] = []
    if (top5Casos) parts.push(`Top 5 casos de uso (últ. 30 días, por productos):\n${top5Casos}`)
    if (potenciaDistrib) parts.push(`Distribución nivel PotencIA:\n${potenciaDistrib}`)
    if (picosCtx) parts.push(`Últimas 4 semanas:\n${picosCtx}`)

    return parts.join('\n\n')
  } catch {
    return ''
  }
}

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json(null)
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  try {
    let minNew = Number(process.env.INSIGHTS_MIN_NEW_RECORDS ?? '20')
    let idConsultor: string | null = null
    let periodoInicio: string | null = null
    let periodoFin: string | null = null

    try {
      const body = await req.json()
      if (typeof body?.minNew === 'number') minNew = body.minNew
      if (typeof body?.id_consultor === 'string') idConsultor = body.id_consultor
      if (typeof body?.periodo_inicio === 'string') periodoInicio = body.periodo_inicio
      if (typeof body?.periodo_fin === 'string') periodoFin = body.periodo_fin
    } catch { /* no body */ }

    if (!Number.isFinite(minNew) || minNew < 1) minNew = 20
    if (minNew > 1000) minNew = 1000

    const openAiKey = process.env.OPENCODE_API_KEY
    const openAiBase = process.env.OPENCODE_API_BASE_URL
    const openAiModel = process.env.OPENCODE_MODEL
    if (!openAiKey || !openAiBase || !openAiModel) {
      const missing = ['OPENCODE_API_KEY', 'OPENCODE_API_BASE_URL', 'OPENCODE_MODEL'].filter((k) => !process.env[k])
      return NextResponse.json({ skipped: true, reason: 'config_missing', details: { missing } })
    }

    // Stage A — fire all independent reads concurrently
    const [
      lastInsightRes,
      consultoriasRes,
      novedadesRes,
      impactContext,
    ] = await Promise.all([
      supabase
        .from('insights')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('consultorias')
        .select('fecha, status, servicio, duracion_minutos, categoria_caso, categoria_caso_uso'),
      supabase
        .from('novedades')
        .select('tipo, titulo, contenido')
        .order('created_at', { ascending: false })
        .limit(20),
      buildImpactContext(supabase),
    ])

    const lastInsight = lastInsightRes.data
    const { data: consultorias, error: conError } = consultoriasRes
    const { data: novedades } = novedadesRes

    // Threshold check — only after Stage A resolves, and only if lastInsight exists
    if (lastInsight) {
      const { count: newConsultorias } = await supabase
        .from('consultorias')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', lastInsight.created_at)

      if (typeof newConsultorias === 'number' && newConsultorias < minNew) {
        return NextResponse.json({
          skipped: true,
          reason: 'threshold_not_met',
          details: { newCount: newConsultorias, threshold: minNew },
        })
      }
    }

    if (conError || !consultorias) {
      return NextResponse.json({ error: 'Error leyendo consultorías' }, { status: 500 })
    }

    // Compute stats
    const estadoMap: Record<string, number> = {}
    const servicioMap: Record<string, number> = {}
    for (const c of consultorias) {
      estadoMap[c.status] = (estadoMap[c.status] || 0) + 1
      if (c.servicio) servicioMap[c.servicio] = (servicioMap[c.servicio] || 0) + 1
    }

    const total = consultorias.length
    const resueltos = estadoMap['Resuelto'] || 0
    const tasaConversion = total > 0 ? Math.round((resueltos / total) * 100) : 0

    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const last7Start = now - 7 * dayMs
    const prev7Start = now - 14 * dayMs
    const conLast7 = consultorias.filter((c) => new Date(c.fecha + 'T00:00:00').getTime() >= last7Start).length
    const conPrev7 = consultorias.filter((c) => {
      const t = new Date(c.fecha + 'T00:00:00').getTime()
      return t >= prev7Start && t < last7Start
    }).length
    const growth7dPct = conPrev7 > 0 ? Math.round(((conLast7 - conPrev7) / conPrev7) * 100) : null

    const novedadesCtx = (novedades || []).slice(0, 10).map((n) => `[${n.tipo}] ${n.titulo}: ${n.contenido?.slice(0, 150)}`).join('\n')

    const prompt = `Eres un analista de negocios experto de la Cámara de Comercio de Barranquilla.
Analiza los siguientes datos del dashboard de consultoría PotencIA y genera insights accionables en español, usando un tono ejecutivo.

REGLAS:
- Cada insight debe citar al menos 1 número o distribución.
- Cada recomendación debe ser accionable (qué hacer + por qué + en cuánto tiempo).
- Incluye indicadores cualitativos basados en las novedades de consultores si están disponibles.

DATOS:
- Total de consultorías: ${total}
- Tasa de conversión: ${tasaConversion}%
- Consultorías por estado: ${JSON.stringify(estadoMap)}
- Servicios más solicitados: ${JSON.stringify(servicioMap)}
- Consultorías últimos 7 días: ${conLast7}${growth7dPct === null ? '' : ` (vs semana anterior: ${growth7dPct >= 0 ? '+' : ''}${growth7dPct}%)`}

IMPACTO ENTREGADO:
${impactContext || 'Sin datos de impacto disponibles.'}

NOVEDADES DE CONSULTORES:
${novedadesCtx || 'Sin novedades registradas.'}

Responde ÚNICAMENTE con un JSON con esta estructura exacta, sin texto adicional:
{
  "insights": [
    "insight 1 basado en los datos",
    "insight 2 basado en los datos",
    "insight 3 basado en los datos"
  ],
  "recomendaciones": [
    "recomendación 1 accionable",
    "recomendación 2 accionable",
    "recomendación 3 accionable"
  ],
  "alertas": [
    "alerta 1 sobre riesgo o problema detectado",
    "alerta 2 sobre riesgo o problema detectado",
    "alerta 3 sobre riesgo o problema detectado"
  ]
}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25_000)

    const response = await fetch(`${openAiBase}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: openAiModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 700,
      }),
    }).finally(() => clearTimeout(timeoutId))

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      return NextResponse.json({
        skipped: true,
        reason: 'upstream_error',
        details: { status: response.status, message: `OpenAI API error: ${response.status}`, body: errBody },
      })
    }

    let aiData: { choices?: { message?: { content?: string } }[] }
    try {
      aiData = await response.json()
    } catch (err) {
      console.error('insights: upstream JSON parse failed', err)
      return NextResponse.json(
        { error: 'Respuesta del proveedor IA no es JSON válido', reason: 'upstream_json' },
        { status: 502 },
      )
    }

    const content = aiData?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.length === 0) {
      console.error('insights: missing choices[0].message.content', { aiData })
      return NextResponse.json(
        { error: 'Respuesta del proveedor IA con forma inesperada', reason: 'missing_choices' },
        { status: 422 },
      )
    }

    // Strip markdown fences
    const cleaned = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    // Extract JSON object body (handles prose-wrapped JSON)
    const match = cleaned.match(/{[\s\S]*}/)
    if (!match) {
      console.error('insights: no JSON object found in content', { cleaned: cleaned.slice(0, 500) })
      return NextResponse.json(
        { error: 'No se encontró un objeto JSON en la respuesta', reason: 'no_json_match' },
        { status: 422 },
      )
    }

    let parsed: { insights?: string[]; recomendaciones?: string[]; alertas?: string[] }
    try {
      parsed = JSON.parse(match[0])
    } catch (err) {
      console.error('insights: JSON.parse failed', { snippet: match[0].slice(0, 500), err })
      return NextResponse.json(
        { error: 'JSON inválido en la respuesta del proveedor IA', reason: 'json_parse_failed' },
        { status: 422 },
      )
    }

    // Derive period bounds: use provided values or fall back to current week
    const todayStr = new Date().toISOString().slice(0, 10)
    const weekAgoStr = new Date(Date.now() - 7 * dayMs).toISOString().slice(0, 10)
    const pInicio = periodoInicio ?? weekAgoStr
    const pFin = periodoFin ?? todayStr

    // Persist each generated item as a separate row using the normalized schema
    const rows: Array<{
      tipo: string
      metrica: string
      valor_texto: string
      descripcion: string
      fuente: string
      periodo_inicio: string
      periodo_fin: string
      id_consultor: string | null
    }> = []

    for (const item of parsed.insights ?? []) {
      rows.push({ tipo: 'insight', metrica: 'insight_text', valor_texto: item, descripcion: item, fuente: process.env.OPENCODE_MODEL ?? 'AI', periodo_inicio: pInicio, periodo_fin: pFin, id_consultor: idConsultor })
    }
    for (const item of parsed.recomendaciones ?? []) {
      rows.push({ tipo: 'recomendacion', metrica: 'recomendacion_text', valor_texto: item, descripcion: item, fuente: process.env.OPENCODE_MODEL ?? 'AI', periodo_inicio: pInicio, periodo_fin: pFin, id_consultor: idConsultor })
    }
    for (const item of parsed.alertas ?? []) {
      rows.push({ tipo: 'alerta', metrica: 'alerta_text', valor_texto: item, descripcion: item, fuente: process.env.OPENCODE_MODEL ?? 'AI', periodo_inicio: pInicio, periodo_fin: pFin, id_consultor: idConsultor })
    }

    // Also store aggregate KPI metrics
    rows.push({ tipo: 'kpi', metrica: 'tasa_conversion', valor_texto: `${tasaConversion}%`, descripcion: `Tasa de conversión: ${tasaConversion}%`, fuente: 'computed', periodo_inicio: pInicio, periodo_fin: pFin, id_consultor: idConsultor })
    rows.push({ tipo: 'kpi', metrica: 'consultorias_last7d', valor_texto: String(conLast7), descripcion: `Consultorías últimos 7 días: ${conLast7}`, fuente: 'computed', periodo_inicio: pInicio, periodo_fin: pFin, id_consultor: idConsultor })

    if (rows.length > 0) {
      await supabase.from('insights').insert(rows)
    }

    return NextResponse.json({
      ...parsed,
      _meta: { skipped: false, threshold: minNew },
    })
  } catch (error) {
    console.error('insights: unhandled error', error)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Timeout esperando al proveedor IA', reason: 'abort_timeout' },
        { status: 504 },
      )
    }
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      return NextResponse.json(
        { error: 'Fallo de red al contactar al proveedor IA', reason: 'upstream_fetch_failed', detail: error.message },
        { status: 502 },
      )
    }
    return NextResponse.json(
      {
        error: 'Error generando insights',
        reason: 'unknown',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
