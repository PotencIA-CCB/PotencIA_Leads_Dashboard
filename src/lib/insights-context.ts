import { SupabaseClient } from '@supabase/supabase-js'

type SessionRecord = {
  estado_inicial: string | null
  acciones_realizadas: string | null
  resultado_final: string | null
  estimacion_impacto: string | null
}

/**
 * Reads all registro_sesion records with the four analytical fields and returns
 * a numbered list string ready to be embedded in an LLM prompt.
 * Capped at 200 records to avoid token overflow.
 */
export async function buildSessionDataset(supabase: SupabaseClient): Promise<string> {
  try {
    const { data } = await supabase
      .from('registro_sesion')
      .select('estado_inicial, acciones_realizadas, resultado_final, estimacion_impacto')
      .not('estado_inicial', 'is', null)
      .order('id', { ascending: false })
      .limit(200)

    if (!data || data.length === 0) return ''

    const rows = (data as SessionRecord[]).map((r, i) => {
      const parts: string[] = [`[${i + 1}]`]
      if (r.estado_inicial) parts.push(`estado_inicial: ${r.estado_inicial.slice(0, 400)}`)
      if (r.acciones_realizadas) parts.push(`acciones: ${r.acciones_realizadas.slice(0, 400)}`)
      if (r.resultado_final) parts.push(`resultado: ${r.resultado_final.slice(0, 400)}`)
      if (r.estimacion_impacto !== null && r.estimacion_impacto !== '') {
        parts.push(`impacto_horas_mes: ${r.estimacion_impacto}`)
      }
      return parts.join(' | ')
    })

    return `REGISTROS DE SESIÓN (${data.length} registros):\n${rows.join('\n')}`
  } catch {
    return ''
  }
}

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
      pregunta: string | null
      motivo_consulta: string | null
      estimacion_impacto: string | null
    }
    const { data: sesionData } = ids.length > 0
      ? await supabase.from('registro_sesion').select('id_consultoria, cantidad_productos, acciones_realizadas, estado_inicial, resultado_final, pregunta, motivo_consulta, estimacion_impacto').in('id_consultoria', ids)
      : { data: [] as SesionRow[] }

    const prodByConsultoria: Record<string, number> = {}
    const sesionSamples: string[] = []
    const preguntaSamples: string[] = []
    const motivoSamples: string[] = []
    const impactoSamples: string[] = []

    /** Truncate free-text to maxLen chars, appending "..." if truncated */
    function truncateText(text: string, maxLen: number): string {
      return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
    }

    for (const s of (sesionData ?? []) as SesionRow[]) {
      prodByConsultoria[s.id_consultoria] = s.cantidad_productos || 0
      // Collect non-empty session text for AI prompt
      if (s.acciones_realizadas?.trim()) {
        sesionSamples.push(`  - Acciones: ${truncateText(s.acciones_realizadas, 200)}`)
      }
      if (s.estado_inicial?.trim()) {
        sesionSamples.push(`  - Estado inicial: ${truncateText(s.estado_inicial, 200)}`)
      }
      if (s.resultado_final?.trim()) {
        sesionSamples.push(`  - Resultado: ${truncateText(s.resultado_final, 200)}`)
      }
      if (s.pregunta?.trim()) {
        preguntaSamples.push(`  - ${truncateText(s.pregunta, 200)}`)
      }
      if (s.motivo_consulta?.trim()) {
        motivoSamples.push(`  - ${truncateText(s.motivo_consulta, 200)}`)
      }
      if (s.estimacion_impacto?.trim()) {
        impactoSamples.push(`  - Impacto: ${truncateText(s.estimacion_impacto, 200)}`)
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
    // Build a combined section capped at 30 total samples to avoid token bloat
    const hasActions = sesionSamples.length > 0
    const hasPreguntas = preguntaSamples.length > 0
    const hasMotivos = motivoSamples.length > 0
    const hasImpacto = impactoSamples.length > 0

    if (hasActions || hasPreguntas || hasMotivos || hasImpacto) {
      const sessionLines: string[] = ['DATOS DE SESIÓN (últ. 30 días):']
      let sampleBudget = 30

      if (hasActions) {
        sessionLines.push('ACCIONES REALIZADAS (muestra):')
        const actionsSlice = sesionSamples.slice(0, sampleBudget)
        sessionLines.push(...actionsSlice)
        sampleBudget -= actionsSlice.length
      }

      if (hasPreguntas && sampleBudget > 0) {
        sessionLines.push('PREGUNTAS DE LEADS (muestra):')
        const preguntaSlice = preguntaSamples.slice(0, sampleBudget)
        sessionLines.push(...preguntaSlice)
        sampleBudget -= preguntaSlice.length
      }

      if (hasMotivos && sampleBudget > 0) {
        sessionLines.push('MOTIVOS DE CONSULTA (muestra):')
        const motivoSlice = motivoSamples.slice(0, sampleBudget)
        sessionLines.push(...motivoSlice)
        sampleBudget -= motivoSlice.length
      }

      if (hasImpacto && sampleBudget > 0) {
        sessionLines.push('IMPACTO ESTIMADO (muestra):')
        const impactoSlice = impactoSamples.slice(0, sampleBudget)
        sessionLines.push(...impactoSlice)
        sampleBudget -= impactoSlice.length
      }

      parts.push(sessionLines.join('\n'))
    }

    return parts.join('\n\n')
  } catch {
    return ''
  }
}
