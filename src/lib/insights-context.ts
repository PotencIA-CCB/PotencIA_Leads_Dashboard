import { SupabaseClient } from '@supabase/supabase-js'

export async function buildImpactContext(supabase: SupabaseClient): Promise<string> {
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
    // Include session free-text fields for insight generation
    type SesionRow = {
      id_consultoria: string
      cantidad_productos: number | null
      acciones_realizadas: string | null
      estado_inicial: string | null
      resultado_final: string | null
    }
    const { data: sesionData } = ids.length > 0
      ? await supabase.from('registro_sesion').select('id_consultoria, cantidad_productos, acciones_realizadas, estado_inicial, resultado_final').in('id_consultoria', ids)
      : { data: [] as SesionRow[] }

    const prodByConsultoria: Record<string, number> = {}
    const sesionSamples: string[] = []
    for (const s of (sesionData ?? []) as SesionRow[]) {
      prodByConsultoria[s.id_consultoria] = s.cantidad_productos || 0
      // Collect non-empty session text for AI prompt
      if (s.acciones_realizadas?.trim()) {
        sesionSamples.push(`  - Acciones: ${s.acciones_realizadas}`)
      }
      if (s.estado_inicial?.trim()) {
        sesionSamples.push(`  - Estado inicial: ${s.estado_inicial}`)
      }
      if (s.resultado_final?.trim()) {
        sesionSamples.push(`  - Resultado: ${s.resultado_final}`)
      }
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

    // Session data for pattern extraction (exploratory — free-text fields)
    if (sesionSamples.length > 0) {
      const sessionSection = [
        'DATOS DE SESIÓN (últ. 30 días):',
        'ACCIONES REALIZADAS (muestra):',
        ...sesionSamples.slice(0, 30), // cap at 30 samples to avoid token bloat
      ].join('\n')
      parts.push(sessionSection)
    }

    return parts.join('\n\n')
  } catch {
    return ''
  }
}
