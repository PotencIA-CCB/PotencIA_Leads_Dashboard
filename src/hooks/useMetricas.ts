'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { computeMetricasFromLeads, type MetricasGlobales } from '@/lib/metricas'
import type { LeadForMetricas } from '@/lib/metricas'

export function useMetricas() {
  const [metricas, setMetricas] = useState<MetricasGlobales | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMetricas() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setLoading(false)

      const { data: consultor } = await supabase
        .from('consultores').select('id, rol').eq('auth_id', user.id).single()
      if (!consultor) return setLoading(false)

      const query = supabase.from('leads').select('created_at,status,solution,city,company_role_level')
      if (consultor.rol === 'consultor') query.eq('id_consultor_asignado', consultor.id)

      const { data, error } = await query
      if (error || !data) return setLoading(false)

      setMetricas(computeMetricasFromLeads(data as LeadForMetricas[]))
      setLoading(false)
    }

    fetchMetricas()
  }, [])

  return { metricas, loading }
}
