'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Lead } from '@/types'

export interface MetricasGlobales {
  totalLeads: number
  porEstado: { status: string; total: number }[]
  tasaConversion: number
  porSolucion: { solution: string; total: number }[]
  porCiudad: { city: string; total: number }[]
  porCargo: { cargo: string; total: number }[]
  porSemana: { semana: string; total: number }[]
}

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

      const query = supabase.from('leads').select('*')
      if (consultor.rol === 'consultor') query.eq('id_consultor_asignado', consultor.id)

      const { data, error } = await query
      if (error || !data) return setLoading(false)

      const leads = data as Lead[]
      const totalLeads = leads.length

      // Por estado
      const estadoMap: Record<string, number> = {}
      leads.forEach((l) => {
        estadoMap[l.status] = (estadoMap[l.status] || 0) + 1
      })
      const porEstado = Object.entries(estadoMap).map(([status, total]) => ({ status, total }))

      // Tasa de conversión: Resuelto / total
      const resueltos = estadoMap['Resuelto'] || 0
      const tasaConversion = totalLeads > 0 ? Math.round((resueltos / totalLeads) * 100) : 0

      // Por solución
      const solucionMap: Record<string, number> = {}
      leads.forEach((l) => {
        if (l.solution) solucionMap[l.solution] = (solucionMap[l.solution] || 0) + 1
      })
      const porSolucion = Object.entries(solucionMap)
        .map(([solution, total]) => ({ solution, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6)

      // Por ciudad
      const ciudadMap: Record<string, number> = {}
      leads.forEach((l) => {
        if (l.city) ciudadMap[l.city] = (ciudadMap[l.city] || 0) + 1
      })
      const porCiudad = Object.entries(ciudadMap)
        .map(([city, total]) => ({ city, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

      // Por cargo
      const cargoMap: Record<string, number> = {}
      leads.forEach((l) => {
        if (l.company_role_level) cargoMap[l.company_role_level] = (cargoMap[l.company_role_level] || 0) + 1
      })
      const porCargo = Object.entries(cargoMap)
        .map(([cargo, total]) => ({ cargo, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

      // Por semana
      const semanaMap: Record<string, number> = {}
      leads.forEach((l) => {
        const date = new Date(l.created_at)
        const semana = `${date.getFullYear()}-S${Math.ceil((date.getDate()) / 7)}-${date.toLocaleString('es-CO', { month: 'short' })}`
        semanaMap[semana] = (semanaMap[semana] || 0) + 1
      })
      const porSemana = Object.entries(semanaMap).map(([semana, total]) => ({ semana, total }))

      setMetricas({ totalLeads, porEstado, tasaConversion, porSolucion, porCiudad, porCargo, porSemana })
      setLoading(false)
    }

    fetchMetricas()
  }, [])

  return { metricas, loading }
}
