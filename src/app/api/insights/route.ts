// Required env vars:
// OPENCODE_API_KEY      — API key for Opencode Go
// OPENCODE_API_BASE_URL — Base URL for Opencode Go API
// OPENCODE_MODEL        — Model ID to use
// INSIGHTS_MIN_NEW_RECORDS — Min new consultorias before regenerating (default: 20)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildImpactContext } from '@/lib/insights-context'

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
        response_format: { type: 'json_object' },
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

    let aiData: { choices?: { message?: { content?: string; reasoning_content?: string } }[] }
    try {
      aiData = await response.json()
    } catch (err) {
      console.error('insights: upstream JSON parse failed', err)
      return NextResponse.json(
        { error: 'Respuesta del proveedor IA no es JSON válido', reason: 'upstream_json' },
        { status: 502 },
      )
    }

    const choice = aiData?.choices?.[0]?.message
    // DeepSeek R1 variants may put the actual response in reasoning_content instead of content
    let content = choice?.content
    if ((typeof content !== 'string' || content.length === 0) && typeof choice?.reasoning_content === 'string' && choice.reasoning_content.length > 0) {
      content = choice.reasoning_content
    }
    if (typeof content !== 'string' || content.length === 0) {
      const debugShape = JSON.stringify({
        hasChoices: Array.isArray(aiData?.choices),
        choicesLen: aiData?.choices?.length ?? 0,
        hasContent: typeof choice?.content === 'string',
        contentLen: typeof choice?.content === 'string' ? choice.content.length : 0,
        hasReasoning: typeof choice?.reasoning_content === 'string',
        topKeys: aiData ? Object.keys(aiData).slice(0, 10) : [],
      })
      console.error('insights: missing content in AI response', debugShape)
      return NextResponse.json(
        { error: 'Respuesta del proveedor IA con forma inesperada', reason: 'missing_choices', debug: debugShape },
        { status: 422 },
      )
    }

    // Strip markdown fences and reasoning_content prefix
    // DeepSeek models may wrap JSON in ```json fences or prepend reasoning_content.
    // The json_object response_format should prevent this, but keep the parser as safety net.
    const cleaned = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^[^{[]*/, '') // strip reasoning_content or any non-JSON prefix before the first {
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
      console.error('insights: JSON.parse failed', {
        responseType: typeof content,
        responsePreview: content?.slice(0, 200),
        snippet: match[0].slice(0, 500),
        err,
      })
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
