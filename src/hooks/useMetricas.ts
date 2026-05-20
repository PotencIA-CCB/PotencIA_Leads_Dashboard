'use client'

import { useEffect, useState } from 'react'
import { createClient, getCurrentConsultor } from '@/lib/supabase-browser'
import { computeMetricasFromConsultorias, type MetricasGlobales, type ConsultoriaForMetricas } from '@/lib/metricas'

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

      // Fetch consultorias with joined lead info for metrics
      const query = supabase.from('consultorias').select('fecha, status, servicio, duracion_minutos, id_consultor, id_lead, leads!inner(city, company_role_level)')
      if (consultor.rol === 'consultor') query.eq('id_consultor', consultor.id)

      const { data, error } = await query
      if (cancelled) return
      if (error || !data) { setLoading(false); return }

      setMetricas(computeMetricasFromConsultorias(data as unknown as ConsultoriaForMetricas[]))
      setLoading(false)
    }
    fetchMetricas()
    return () => { cancelled = true }
  }, [])

  return { metricas, loading }
}
