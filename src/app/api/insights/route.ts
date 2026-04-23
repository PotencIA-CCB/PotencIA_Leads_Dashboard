import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeMetricasFromLeads, type LeadForMetricas, type MetricasGlobales } from '@/lib/metricas'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return NextResponse.json(null)
  return NextResponse.json(data.contenido)
}

export async function POST(req: NextRequest) {
  try {
    let metricas: MetricasGlobales | null = null
    let force = false
    let minNew = Number(process.env.INSIGHTS_MIN_NEW_RECORDS ?? '20')

    try {
      const body = await req.json()
      if (body?.metricas) metricas = body.metricas
      if (typeof body?.force === 'boolean') force = body.force
      if (typeof body?.minNew === 'number') minNew = body.minNew
    } catch {
      // Sin body o body inválido: generamos métricas desde Supabase
    }

    if (!Number.isFinite(minNew) || minNew < 1) minNew = 20
    if (minNew > 1000) minNew = 1000

    const { data: lastInsight, error: lastInsightError } = await supabase
      .from('insights')
      .select('created_at,contenido')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!force && lastInsight && !lastInsightError) {
      const { count: newSesiones, error: sesionesCountError } = await supabase
        .from('sesiones')
        .select('id_sesion', { count: 'exact', head: true })
        .gt('created_at', lastInsight.created_at)

      if (!sesionesCountError && typeof newSesiones === 'number' && newSesiones < minNew) {
        return NextResponse.json({
          ...(lastInsight.contenido as object),
          _meta: {
            skipped: true,
            reason: 'threshold',
            threshold: minNew,
            new_records: newSesiones,
            since: lastInsight.created_at,
          },
        })
      }

      if (sesionesCountError) {
        const { count: newLeads } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastInsight.created_at)

        if (typeof newLeads === 'number' && newLeads < minNew) {
          return NextResponse.json({
            ...(lastInsight.contenido as object),
            _meta: {
              skipped: true,
              reason: 'threshold',
              threshold: minNew,
              new_records: newLeads,
              since: lastInsight.created_at,
            },
          })
        }
      }
    }

    const { data: leads, error } = await supabase
      .from('leads')
      .select('created_at,status,solution,city,company_role_level')
    if (error || !leads) {
      console.error('Error leyendo leads para insights:', error)
      return NextResponse.json({ error: 'Error leyendo datos' }, { status: 500 })
    }

    // Fuente de verdad: Supabase. (Si llega `metricas` en el body la dejamos como fallback.)
    metricas = metricas ?? computeMetricasFromLeads(leads as LeadForMetricas[])

    // Contexto adicional para que la IA genere recomendaciones más accionables (sin pedir más datos).
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const last7Start = now - 7 * dayMs
    const prev7Start = now - 14 * dayMs
    const leadsLast7 = (leads as LeadForMetricas[]).filter((l) => new Date(l.created_at).getTime() >= last7Start).length
    const leadsPrev7 = (leads as LeadForMetricas[]).filter((l) => {
      const t = new Date(l.created_at).getTime()
      return t >= prev7Start && t < last7Start
    }).length
    const growth7dPct =
      leadsPrev7 > 0 ? Math.round(((leadsLast7 - leadsPrev7) / leadsPrev7) * 100) : null

    const prompt = `Eres un analista de negocios experto de la Cámara de Comercio de Barranquilla.
Analiza los siguientes KPIs del dashboard de consultoría PotencIA y genera insights accionables en español, usando un tono ejecutivo.

REGLAS:
- Cada insight debe citar al menos 1 número o distribución (ej: % conversión, conteos por estado, top solución).
- Cada recomendación debe ser accionable (qué hacer + por qué + en cuánto tiempo) y enfocada en impacto rápido.
- Si faltan datos para una conclusión, dilo como hipótesis y sugiere cómo validarla.

DATOS ACTUALES:
- Total de leads: ${metricas.totalLeads}
- Tasa de conversión: ${metricas.tasaConversion}%
- Leads por estado: ${JSON.stringify(metricas.porEstado)}
- Soluciones más solicitadas: ${JSON.stringify(metricas.porSolucion)}
- Leads por ciudad: ${JSON.stringify(metricas.porCiudad)}
- Leads por cargo: ${JSON.stringify(metricas.porCargo)}
- Captación últimos 7 días: ${leadsLast7} leads${growth7dPct === null ? '' : ` (vs semana anterior: ${growth7dPct >= 0 ? '+' : ''}${growth7dPct}%)`}

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

    const data = await response.json()
    const content = data.choices[0].message.content
    const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean)

    // Guardar en Supabase
    await supabase.from('insights').insert({
      contenido: parsed,
      contexto_kpis: metricas,
      generado_por: 'DeepSeek',
    })

    return NextResponse.json({
      ...parsed,
      _meta: {
        skipped: false,
        threshold: minNew,
      },
    })
  } catch (error) {
    console.error('Error generando insights:', error)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'DeepSeek timeout' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Error generando insights' }, { status: 500 })
  }
}
