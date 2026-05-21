'use client'

import { useEffect, useState } from 'react'
import { createClient, getCurrentConsultor } from '@/lib/supabase-browser'
import { computeMetricasFromConsultorias, type MetricasGlobales, type ConsultoriaForMetricas, type PicoSemanal } from '@/lib/metricas'

export function useMetricas() {
  const [metricas, setMetricas] = useState<MetricasGlobales | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchMetricas() {
      const consultor = await getCurrentConsultor()
      if (cancelled) return
      if (!consultor) { setLoading(false); return }

      const supabase = createClient()

      const consultoriasQuery = supabase
        .from('consultorias')
        .select('fecha, status, servicio, duracion_minutos, id_consultor, id_lead, categoria_caso_uso, nivel_potencia, leads!inner(city, company_role_level, origen, sector)')
      if (consultor.rol === 'consultor') consultoriasQuery.eq('id_consultor', consultor.id)

      const picosQuery = supabase
        .from('consultas_por_semana')
        .select('*')
        .order('semana_inicio', { ascending: true })
        .limit(24)

      const [{ data: consultoriasData, error: consultoriasError }, { data: picosData }] = await Promise.all([
        consultoriasQuery,
        picosQuery,
      ])

      if (cancelled) return
      if (consultoriasError || !consultoriasData) { setLoading(false); return }

      const picos: PicoSemanal[] = (picosData ?? []) as PicoSemanal[]

      setMetricas(computeMetricasFromConsultorias(consultoriasData as unknown as ConsultoriaForMetricas[], picos))
      setLoading(false)
    }
    fetchMetricas()
    return () => { cancelled = true }
  }, [])

  return { metricas, loading }
}
