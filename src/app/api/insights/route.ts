import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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

    // Check threshold: skip if not enough new consultorias since last insight
    const { data: lastInsight } = await supabase
      .from('insights')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastInsight) {
      const { count: newConsultorias } = await supabase
        .from('consultorias')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', lastInsight.created_at)

      if (typeof newConsultorias === 'number' && newConsultorias < minNew) {
        return NextResponse.json({
          _meta: {
            skipped: true,
            reason: 'threshold',
            threshold: minNew,
            new_records: newConsultorias,
            since: lastInsight.created_at,
          },
        })
      }
    }

    // Fetch consultorias for context
    const { data: consultorias, error: conError } = await supabase
      .from('consultorias')
      .select('fecha, status, servicio, duracion_minutos, categoria_caso, categoria_caso_uso')

    if (conError || !consultorias) {
      return NextResponse.json({ error: 'Error leyendo consultorías' }, { status: 500 })
    }

    // Fetch novedades for qualitative context
    const { data: novedades } = await supabase
      .from('novedades')
      .select('tipo, titulo, contenido')
      .order('created_at', { ascending: false })
      .limit(20)

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
    const timeoutId = setTimeout(() => controller.abort(), 70_000)

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    }).finally(() => clearTimeout(timeoutId))

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`)

    const aiData = await response.json()
    const content = aiData.choices[0].message.content
    const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed: { insights?: string[]; recomendaciones?: string[]; alertas?: string[] } = JSON.parse(clean)

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
      rows.push({ tipo: 'insight', metrica: 'insight_text', valor_texto: item, descripcion: item, fuente: 'DeepSeek', periodo_inicio: pInicio, periodo_fin: pFin, id_consultor: idConsultor })
    }
    for (const item of parsed.recomendaciones ?? []) {
      rows.push({ tipo: 'recomendacion', metrica: 'recomendacion_text', valor_texto: item, descripcion: item, fuente: 'DeepSeek', periodo_inicio: pInicio, periodo_fin: pFin, id_consultor: idConsultor })
    }
    for (const item of parsed.alertas ?? []) {
      rows.push({ tipo: 'alerta', metrica: 'alerta_text', valor_texto: item, descripcion: item, fuente: 'DeepSeek', periodo_inicio: pInicio, periodo_fin: pFin, id_consultor: idConsultor })
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
    console.error('Error generando insights:', error)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'DeepSeek timeout' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Error generando insights' }, { status: 500 })
  }
}
