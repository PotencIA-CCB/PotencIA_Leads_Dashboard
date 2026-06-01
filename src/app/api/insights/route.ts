// Required env vars:
// OPENROUTER_API_KEY — OpenRouter API key
// OPENROUTER_API_URL — https://openrouter.ai/api/v1
// OPENROUTER_MODEL   — e.g. moonshotai/kimi-k2.6:free | nvidia/nemotron-3-super-120b-a12b:free | google/gemma-4-31b-it:free
// INSIGHTS_MIN_NEW_RECORDS — Min new consultorias before regenerating (default: 20)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildImpactContext, buildSessionDataset } from '@/lib/insights-context'

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

/**
 * Extract a JSON object with balanced braces from a string that may contain
 * extra text before/after. More robust than a simple greedy regex.
 */
function extractBalancedJSON(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\' && inString) {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Repair common JSON issues from AI output:
 * - Trailing commas before } or ]
 * - Unescaped newlines in string values (replace with space)
 */
function repairJSON(text: string): string {
  return text
    .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
    .replace(/\n/g, ' ')            // collapse newlines
    .replace(/\r/g, '')             // remove carriage returns
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

    if (!Number.isFinite(minNew) || minNew < 0) minNew = 20
    if (minNew > 1000) minNew = 1000

    const openAiKey = process.env.OPENROUTER_API_KEY
    const openAiBase = process.env.OPENROUTER_API_URL
    const openAiModel = process.env.OPENROUTER_MODEL
    if (!openAiKey || !openAiBase || !openAiModel) {
      const missing = ['OPENROUTER_API_KEY', 'OPENROUTER_API_URL', 'OPENROUTER_MODEL'].filter((k) => !process.env[k])
      return NextResponse.json({ skipped: true, reason: 'config_missing', details: { missing } })
    }

    // Stage A — fire all independent reads concurrently
    const [
      lastInsightRes,
      consultoriasRes,
      novedadesRes,
      impactContext,
      sessionDataset,
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
        .select('tipo, titulo, contenido, fecha_inicio, fecha_fin')
        .order('created_at', { ascending: false })
        .limit(20),
      buildImpactContext(supabase),
      buildSessionDataset(supabase),
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

    const novedadesCtx = (novedades || []).slice(0, 10).map((n) => {
      const rango = n.fecha_inicio
        ? ` (${n.fecha_inicio}${n.fecha_fin && n.fecha_fin !== n.fecha_inicio ? ` a ${n.fecha_fin}` : ''})`
        : ''
      return `[${n.tipo}]${rango} ${n.titulo}: ${n.contenido?.slice(0, 150)}`
    }).join('\n')

    const prompt = `Eres un analista de datos especializado en consultoría de IA. Analiza los registros del programa PotencIA y genera dos bloques de análisis en español con tono ejecutivo. Nunca inventes datos; si un campo está vacío márcalo como "sin clasificar".

# FUENTE DE DATOS
${sessionDataset || 'Sin registros disponibles.'}

CONTEXTO OPERACIONAL (últimos 30 días):
${impactContext || 'Sin datos adicionales.'}

NOVEDADES DE CONSULTORES:
${novedadesCtx || 'Sin novedades registradas.'}

# BLOQUE 1 — PATRONES (estado_inicial → resultado_final)
1. Clasifica cada estado_inicial en UNA categoría: Reportería/informes | Análisis y gestión de datos | Atención al cliente/leads | Inventario/operaciones | Propuestas comerciales/ventas | Otro.
2. Clasifica cada resultado_final en: Asistente GPT personalizado | Dashboard | Landing/Web con WhatsApp | Agente/Automatización | Documento/Plantilla | Otro.
3. Identifica los 3 caminos problema→solución más frecuentes con conteo y %.

# BLOQUE 2 — QUÉ FUNCIONA (acciones_realizadas × estimacion_impacto)
1. Extrae herramientas de acciones_realizadas normalizando: chatgpt/gpt→ChatGPT; Claude; Gemini; Copilot; n8n; Make; Power Automate; Zoho; otras.
2. Por herramienta: número de sesiones, suma y promedio de horas/mes (estimacion_impacto, solo casos > 0).
3. Top 3 casos por estimacion_impacto: estado_inicial resumido, herramienta principal, horas/mes.
4. Métricas globales: total horas/mes, anualizado (×12), casos con impacto 0.

# INSTRUCCIÓN DE SALIDA
Responde ÚNICAMENTE con JSON sin texto adicional:
{
  "insights": [
    "Patrón 1: categoría de problema más frecuente con conteo, %, y solución más común asociada",
    "Patrón 2: segundo camino problema→solución más frecuente con cifras",
    "Patrón 3: hallazgo relevante de la matriz (solución inesperada, concentración, etc.)"
  ],
  "recomendaciones": [
    "Qué funciona 1: herramienta con mayor impacto promedio (horas/mes) y en qué tipo de caso",
    "Qué funciona 2: métricas globales — total horas/mes, proyección anual, top caso",
    "Qué funciona 3: comparación entre categorías de solución por horas ahorradas promedio"
  ],
  "alertas": [
    "Hallazgo accionable 1: qué replicar con evidencia numérica",
    "Hallazgo accionable 2: qué corregir o dónde hay oportunidad",
    "Hallazgo accionable 3: riesgo o patrón que requiere atención"
  ]
}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 55_000)

    const response = await fetch(`${openAiBase}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`,
        'HTTP-Referer': 'https://potencia.ccc.org.co',
        'X-Title': 'PotencIA Dashboard',
      },
      body: JSON.stringify({
        model: openAiModel,
        messages: [
          { role: 'system', content: 'You are a data analyst. Always respond with valid JSON only. No markdown, no explanations, no text outside the JSON object.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        ...(openAiModel.startsWith('openai/') || openAiModel.startsWith('anthropic/') || openAiModel.startsWith('google/gemini') || openAiModel.startsWith('moonshotai/')
          ? { response_format: { type: 'json_object' } }
          : {}),
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
    const cleaned = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^[^{[]*/, '')
      .trim()

    let parsed: { insights?: string[]; recomendaciones?: string[]; alertas?: string[] }

    // Strategy 1: try direct parse (best case — json_object mode)
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Strategy 2: extract JSON object with balanced braces
      const extracted = extractBalancedJSON(cleaned)
      if (extracted) {
        try {
          parsed = JSON.parse(extracted)
        } catch {
          // Strategy 3: repair common issues and retry
          const repaired = repairJSON(extracted)
          try {
            parsed = JSON.parse(repaired)
          } catch (err) {
            console.error('insights: JSON.parse failed after repair', {
              responseType: typeof content,
              responsePreview: content?.slice(0, 200),
              snippet: extracted.slice(0, 500),
              repaired: repaired.slice(0, 500),
            })
            return NextResponse.json(
              {
                error: 'JSON inválido en la respuesta del proveedor IA',
                reason: 'json_parse_failed',
                debug: extracted.slice(0, 300),
              },
              { status: 422 },
            )
          }
        }
      } else {
        console.error('insights: no JSON object found in content', { cleaned: cleaned.slice(0, 500) })
        return NextResponse.json(
          { error: 'No se encontró un objeto JSON en la respuesta', reason: 'no_json_match', debug: cleaned.slice(0, 600) },
          { status: 422 },
        )
      }
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
      const { error: insError } = await supabase.from('insights').insert(rows)
      if (insError) {
        return NextResponse.json(
          { error: 'Error guardando insights', reason: 'insert_failed', detail: insError.message },
          { status: 500 },
        )
      }
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
