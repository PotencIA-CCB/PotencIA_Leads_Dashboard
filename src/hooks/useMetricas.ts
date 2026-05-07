'use client'

import { useEffect, useState } from 'react'
import { createClient, getCurrentConsultor } from '@/lib/supabase-browser'
import { computeMetricasFromLeads, type MetricasGlobales } from '@/lib/metricas'
import type { LeadForMetricas } from '@/lib/metricas'

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
      const query = supabase.from('leads').select('created_at,status,solution,use_case,city,company_role_level')
      if (consultor.rol === 'consultor') query.eq('id_consultor_asignado', consultor.id)

      const { data, error } = await query
      if (cancelled) return
      if (error || !data) { setLoading(false); return }

      setMetricas(computeMetricasFromLeads(data as LeadForMetricas[]))
      setLoading(false)
    }
    fetchMetricas()
    return () => { cancelled = true }
  }, [])

  return { metricas, loading }
}
