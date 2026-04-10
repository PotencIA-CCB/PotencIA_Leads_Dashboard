import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    const { metricas } = await req.json()

    const prompt = `Eres un analista de negocios experto de la Cámara de Comercio de Barranquilla.
Analiza los siguientes KPIs del dashboard de consultoría PotencIA y genera insights accionables en español.

DATOS ACTUALES:
- Total de leads: ${metricas.totalLeads}
- Tasa de conversión: ${metricas.tasaConversion}%
- Leads por estado: ${JSON.stringify(metricas.porEstado)}
- Soluciones más solicitadas: ${JSON.stringify(metricas.porSolucion)}
- Leads por ciudad: ${JSON.stringify(metricas.porCiudad)}
- Leads por cargo: ${JSON.stringify(metricas.porCargo)}

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

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    })

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

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Error generando insights:', error)
    return NextResponse.json({ error: 'Error generando insights' }, { status: 500 })
  }
}
