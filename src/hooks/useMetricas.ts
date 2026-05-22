'use client'

import { useEffect, useState } from 'react'
import { createClient, getCurrentConsultor } from '@/lib/supabase-browser'
import { computeMetricasFromConsultorias, type MetricasGlobales, type ConsultoriaForMetricas, type RegistroSesionForMetricas } from '@/lib/metricas'

export function useMetricas() {
  const [metricas, setMetricas] = useState<MetricasGlobales | null>(null)
  const [consultorias, setConsultorias] = useState<ConsultoriaForMetricas[]>([])
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
        .select('fecha, status, servicio, duracion_minutos, id_consultor, id_lead, categoria_caso_uso, categoria_caso, nivel_potencia, hora_inicio, modalidad, leads!inner(city, company_role_level, origen, sector, company_role_area, nit), consultores(nombre)')
      if (consultor.rol === 'consultor') consultoriasQuery.eq('id_consultor', consultor.id)

      const registroQuery = supabase
        .from('registro_sesion')
        .select('id_consultoria, cantidad_productos')

      const [
        { data: consultoriasData, error: consultoriasError },
        { data: sesionData, error: sesionError },
      ] = await Promise.all([consultoriasQuery, registroQuery])

      if (cancelled) return
      if (consultoriasError || sesionError || !consultoriasData) { setLoading(false); return }

      const typed = consultoriasData as unknown as ConsultoriaForMetricas[]
      setConsultorias(typed)
      setMetricas(computeMetricasFromConsultorias({
        consultorias: typed,
        registroSesion: (sesionData ?? []) as RegistroSesionForMetricas[],
      }))
      setLoading(false)
    }
    fetchMetricas()
    return () => { cancelled = true }
  }, [])

  return { metricas, consultorias, loading }
}
