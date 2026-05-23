'use client'

import { useEffect, useState } from 'react'
import { createClient, getCurrentConsultor } from '@/lib/supabase-browser'
import { computeMetricasFromConsultorias, buildAttendedSet, type MetricasGlobales, type ConsultoriaForMetricas, type RegistroSesionForMetricas } from '@/lib/metricas'

export function useMetricas() {
  const [metricas, setMetricas] = useState<MetricasGlobales | null>(null)
  const [consultorias, setConsultorias] = useState<ConsultoriaForMetricas[]>([])
  const [registroSesion, setRegistroSesion] = useState<RegistroSesionForMetricas[]>([])
  const [attendedIds, setAttendedIds] = useState<Set<string>>(new Set())
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
        .select('id, fecha, status, servicio, duracion_minutos, id_consultor, id_lead, categoria_caso_uso, categoria_caso, nivel_potencia, hora_inicio, modalidad, leads!inner(full_name, city, company_role_level, origen, sector, company_role_area, nit), consultores(nombre)')
      if (consultor.rol === 'consultor') consultoriasQuery.eq('id_consultor', consultor.id)

      const registroQuery = supabase
        .from('registro_sesion')
        .select('id_consultoria, cantidad_productos, sesion_grabada, resultado_final')

      const leadsCountQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })

      const [
        { data: consultoriasData, error: consultoriasError },
        { data: sesionData, error: sesionError },
        { count: totalLeadsCount },
      ] = await Promise.all([consultoriasQuery, registroQuery, leadsCountQuery])

      if (cancelled) return
      if (consultoriasError || sesionError || !consultoriasData) { setLoading(false); return }

      // For consultor role, don't pass totalLeadsCount (they only see their own leads)
      const leadsParam = consultor.rol === 'admin' ? (totalLeadsCount ?? undefined) : undefined

      const typed = consultoriasData as unknown as ConsultoriaForMetricas[]
      const typedRegistro = (sesionData ?? []) as RegistroSesionForMetricas[]
      // TASK-11: build attended set once per fetch cycle; expose for drill-down and charts
      const ids = buildAttendedSet(typedRegistro)
      setConsultorias(typed)
      setRegistroSesion(typedRegistro)
      setAttendedIds(ids)
      setMetricas(computeMetricasFromConsultorias({
        consultorias: typed,
        registroSesion: typedRegistro,
        totalLeads: leadsParam,
        attendedIds: ids,
      }))
      setLoading(false)
    }
    fetchMetricas()
    return () => { cancelled = true }
  }, [])

  // TASK-11: expose registroSesion and attendedIds for drill-down and attended-filter consumers
  return { metricas, consultorias, registroSesion, attendedIds, loading }
}
