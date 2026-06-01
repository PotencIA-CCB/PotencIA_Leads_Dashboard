'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import {
  countSesionesTotales,
  countNitsUnicos,
  countNitsValidos,
  countEmpresasRegistradas,
  countEmpresasRenovadas,
} from '@/lib/biStats'
import { computeFunnelStats, type FunnelStats } from '@/lib/capturaStats'
import type { RegistroSesion } from '@/types'

// ---------------------------------------------------------------------------
// Exported types (also used by tests for shape verification)
// ---------------------------------------------------------------------------

export interface BiStats {
  sesionesTotales: number
  nitsUnicos: number
  nitsValidos: number
  empresasRegistradas: number
  empresasRenovadas: number
}

export interface HookState {
  biStats: BiStats | null
  funnelStats: FunnelStats | null
  totalBookings: number
  sessionInsights: RegistroSesion[]
  loading: boolean
}

// ---------------------------------------------------------------------------
// Minimal row shapes for type safety without importing the full Lead type
// ---------------------------------------------------------------------------

interface BiLeadFetchRow {
  id: string
  nit: string | null
  empresa: string | null
  nit_validado_rues: boolean
  renovado_2026: boolean
}

interface BiFormularioRow {
  id_lead: string
}

interface BiConsultoriaRow {
  id: string
  id_lead: string
  status?: string
}

interface BiSesionRow {
  id_consultoria: string
  resultado: string | null
}

// ---------------------------------------------------------------------------
// Pure derivation — exported for unit tests
// ---------------------------------------------------------------------------

/**
 * Compute all 5 BI indicators from raw table rows.
 * Pure function — no side effects, no Supabase calls.
 */
export function computeBiStats(
  leads: Pick<BiLeadFetchRow, 'nit' | 'empresa' | 'nit_validado_rues' | 'renovado_2026'>[],
  sesiones: Pick<BiSesionRow, 'id_consultoria'>[],
): BiStats {
  return {
    sesionesTotales: countSesionesTotales(sesiones),
    nitsUnicos: countNitsUnicos(leads),
    nitsValidos: countNitsValidos(leads),
    empresasRegistradas: countEmpresasRegistradas(leads),
    empresasRenovadas: countEmpresasRenovadas(leads),
  }
}

/**
 * Initial hook state — exported for unit tests.
 */
export function buildInitialState(): HookState {
  return {
    biStats: null,
    funnelStats: null,
    totalBookings: 0,
    sessionInsights: [],
    loading: true,
  }
}

/**
 * Filter registro_sesion rows to those with at least one non-null, non-empty
 * value among the four target insight fields, then slice to the 10 most recent.
 * Pure function — exported for unit tests.
 */
export function deriveSessionInsights(
  rows: Pick<RegistroSesion, 'id' | 'created_at' | 'id_consultoria' | 'estado_inicial' | 'acciones_realizadas' | 'resultado_final' | 'estimacion_impacto'>[],
): RegistroSesion[] {
  const hasContent = (s: typeof rows[number]) =>
    [s.estado_inicial, s.acciones_realizadas, s.resultado_final, s.estimacion_impacto].some(
      (v) => v != null && v.trim().length > 0,
    )
  return rows.filter(hasContent).slice(0, 10) as RegistroSesion[]
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBusinessIntelligence(): HookState {
  const [state, setState] = useState<HookState>(buildInitialState)

  useEffect(() => {
    let ignore = false

    async function fetchData() {
      const supabase = createClient()

      const [
        { data: leadsData },
        { data: formulariosData },
        { data: consultoriasData },
        { data: sesionData },
        { count: bookingsCount },
        { data: sessionInsightsRaw },
      ] = await Promise.all([
        supabase.from('leads').select('id, nit, empresa, nit_validado_rues, renovado_2026'),
        supabase.from('formularios_landing').select('id_lead'),
        supabase.from('consultorias').select('id, id_lead, status'),
        supabase.from('registro_sesion').select('id_consultoria, resultado'),
        supabase.from('consultorias').select('*', { count: 'exact', head: true }),
        supabase
          .from('registro_sesion')
          .select('id, created_at, id_consultoria, estado_inicial, acciones_realizadas, resultado_final, estimacion_impacto')
          .order('created_at', { ascending: false })
          .limit(40),
      ])

      if (ignore) return

      const leads = (leadsData as BiLeadFetchRow[]) ?? []
      const formularios = (formulariosData as BiFormularioRow[]) ?? []
      const consultorias = (consultoriasData as BiConsultoriaRow[]) ?? []
      const sesiones = (sesionData as BiSesionRow[]) ?? []

      const biStats = computeBiStats(leads, sesiones)
      const funnelStats = computeFunnelStats(leads, formularios, consultorias, sesiones)
      const totalBookings = bookingsCount ?? 0
      const sessionInsights = deriveSessionInsights(
        (sessionInsightsRaw as Pick<RegistroSesion, 'id' | 'created_at' | 'id_consultoria' | 'estado_inicial' | 'acciones_realizadas' | 'resultado_final' | 'estimacion_impacto'>[]) ?? [],
      )

      setState({
        biStats,
        funnelStats,
        totalBookings,
        sessionInsights,
        loading: false,
      })
    }

    fetchData()

    return () => {
      ignore = true
    }
  }, [])

  return state
}
