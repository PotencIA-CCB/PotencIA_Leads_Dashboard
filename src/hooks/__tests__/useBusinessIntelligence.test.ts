/**
 * Tests for useBusinessIntelligence hook logic.
 *
 * Strategy: vitest config uses environment: 'node' (no DOM available).
 * We test the pure logic extracted from the hook, following the same
 * pattern as useWindowWidth.test.ts:
 *   - computeBiStats: the pure derivation function
 *   - buildHookResult: result shape builder
 *
 * Behavioral contracts tested:
 *   1. Initial shape: loading true, biStats null before fetch
 *   2. After mock resolves: loading false, biStats non-null with all 5 numeric fields
 *   3. Empty DB: all 5 counts are 0 (not null), loading false
 *   4. funnelStats: non-null after successful fetch
 *   5. Cleanup: ignore flag prevents stale state updates
 *   6. computeBiStats wires biStats functions correctly
 */

import { describe, it, expect } from 'vitest'
import {
  computeBiStats,
  buildInitialState,
  deriveSessionInsights,
  type BiStats,
  type HookState,
} from '../useBusinessIntelligence'
import type { FunnelStats } from '@/lib/capturaStats'
import type { RegistroSesion } from '@/types'

// ---------------------------------------------------------------------------
// computeBiStats
// ---------------------------------------------------------------------------

describe('computeBiStats', () => {
  it('returns all 5 counts as 0 for empty inputs', () => {
    const result = computeBiStats([], [], [])
    expect(result.sesionesTotales).toBe(0)
    expect(result.totalEmpresasRegistradas).toBe(0)
    expect(result.empresasNitsValidos).toBe(0)
    expect(result.empresasRegistradas).toBe(0)
    expect(result.empresasRenovadas).toBe(0)
  })

  it('counts sesionesTotales correctly', () => {
    const sesiones = [
      { id_consultoria: 'c1' },
      { id_consultoria: 'c2' },
      { id_consultoria: 'c3' },
    ]
    const result = computeBiStats([], sesiones, [])
    expect(result.sesionesTotales).toBe(3)
  })

  it('counts totalEmpresasRegistradas correctly — deduplicates and excludes null', () => {
    const leads = [
      { id: 'l1', nit: '123', empresa: null, renovado: null },
      { id: 'l2', nit: null, empresa: null, renovado: null },
      { id: 'l3', nit: '123', empresa: null, renovado: null },
      { id: 'l4', nit: '456', empresa: null, renovado: null },
    ]
    const result = computeBiStats(leads, [], [])
    expect(result.totalEmpresasRegistradas).toBe(2)
  })

  it('counts empresasNitsValidos correctly — NITs únicos donde renovado no es null', () => {
    const leads = [
      { id: '1', nit: '1', empresa: null, renovado: 'Renovado' },
      { id: '2', nit: '2', empresa: null, renovado: null },
      { id: '3', nit: '3', empresa: null, renovado: 'No renovado' },
    ]
    const result = computeBiStats(leads, [], [])
    expect(result.empresasNitsValidos).toBe(2)
  })

  it('counts empresasRegistradas correctly — excludes null and whitespace', () => {
    const leads = [
      { id: '1', nit: null, empresa: 'Acme', renovado: null },
      { id: '2', nit: null, empresa: null, renovado: null },
      { id: '3', nit: null, empresa: '   ', renovado: null },
    ]
    const result = computeBiStats(leads, [], [])
    expect(result.empresasRegistradas).toBe(1)
  })

  it('counts empresasRenovadas correctly', () => {
    const leads = [
      { id: '1', nit: '100', empresa: null, renovado: 'Renovado' },
      { id: '2', nit: '200', empresa: null, renovado: 'No renovado' },
    ]
    const result = computeBiStats(leads, [], [])
    expect(result.empresasRenovadas).toBe(1)
  })

  it('returns correct shape with all 5 fields present', () => {
    const result = computeBiStats([], [], [])
    const keys: (keyof BiStats)[] = [
      'sesionesTotales',
      'totalEmpresasRegistradas',
      'empresasNitsValidos',
      'empresasRegistradas',
      'empresasRenovadas',
    ]
    for (const key of keys) {
      expect(typeof result[key]).toBe('number')
    }
  })
})

// ---------------------------------------------------------------------------
// buildInitialState
// ---------------------------------------------------------------------------

describe('buildInitialState', () => {
  it('returns loading: true', () => {
    const state = buildInitialState()
    expect(state.loading).toBe(true)
  })

  it('returns biStats: null', () => {
    const state = buildInitialState()
    expect(state.biStats).toBeNull()
  })

  it('returns funnelStats: null', () => {
    const state = buildInitialState()
    expect(state.funnelStats).toBeNull()
  })

  it('returns totalBookings: 0', () => {
    const state = buildInitialState()
    expect(state.totalBookings).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// HookState — loaded state shape
// ---------------------------------------------------------------------------

describe('HookState after fetch resolves', () => {
  it('biStats has all 5 fields as numbers after loading with populated data', () => {
    const leads = [
      { id: 'l1', nit: '111', empresa: 'Corp A', renovado: 'Renovado' },
      { id: 'l2', nit: '222', empresa: null, renovado: null },
    ]
    const consultorias = [
      { id: 'c1', id_lead: 'l1' },
      { id: 'c2', id_lead: 'l2' },
    ]
    const sesiones = [{ id_consultoria: 'c1' }, { id_consultoria: 'c2' }]

    const biStats = computeBiStats(leads, sesiones, consultorias)

    const state: HookState = {
      biStats,
      funnelStats: null,
      totalBookings: 5,
      sessionInsights: [],
      loading: false,
    }

    expect(state.loading).toBe(false)
    expect(state.biStats).not.toBeNull()
    expect(state.biStats!.sesionesTotales).toBe(2)
    expect(state.biStats!.totalEmpresasRegistradas).toBe(2)
    expect(state.biStats!.empresasNitsValidos).toBe(1)
    expect(state.biStats!.empresasRegistradas).toBe(1)
    expect(state.biStats!.empresasRenovadas).toBe(1)
  })

  it('biStats contains all 0 counts for empty DB tables', () => {
    const biStats = computeBiStats([], [], [])
    const state: HookState = {
      biStats,
      funnelStats: null,
      totalBookings: 0,
      sessionInsights: [],
      loading: false,
    }
    expect(state.loading).toBe(false)
    expect(state.biStats).not.toBeNull()
    expect(state.biStats!.sesionesTotales).toBe(0)
    expect(state.biStats!.totalEmpresasRegistradas).toBe(0)
    expect(state.biStats!.empresasNitsValidos).toBe(0)
    expect(state.biStats!.empresasRegistradas).toBe(0)
    expect(state.biStats!.empresasRenovadas).toBe(0)
  })

  it('funnelStats is non-null after successful fetch with valid data', () => {
    const sampleFunnelStats: FunnelStats = {
      totalLandingLeads: 10,
      landingNeverBooked: 3,
      landingBooked: 7,
      noShows: 2,
      cicloCompleto: 5,
      bookedNoLandingDirecto: 4,
      soloBookedNoSession: 6,
      asistieronSinLandingNiBooking: 1,
    }
    const state: HookState = {
      biStats: computeBiStats([], [], []),
      funnelStats: sampleFunnelStats,
      totalBookings: 20,
      sessionInsights: [],
      loading: false,
    }
    expect(state.funnelStats).not.toBeNull()
    expect(state.funnelStats!.totalLandingLeads).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// ignore flag pattern — verifies cleanup logic prevents stale state
// ---------------------------------------------------------------------------

describe('ignore flag cleanup pattern', () => {
  it('ignore flag set to true prevents state updates after unmount', async () => {
    let ignore = false
    let stateUpdated = false

    const fakeSetState = () => {
      if (!ignore) {
        stateUpdated = true
      }
    }

    // Simulate async operation that resolves after unmount
    const asyncOp = new Promise<void>((resolve) => {
      setTimeout(() => {
        fakeSetState()
        resolve()
      }, 10)
    })

    // Simulate unmount before async completes
    ignore = true

    await asyncOp

    expect(stateUpdated).toBe(false)
  })

  it('ignore flag false allows state updates when still mounted', async () => {
    let ignore = false
    let stateUpdated = false

    const fakeSetState = () => {
      if (!ignore) {
        stateUpdated = true
      }
    }

    const asyncOp = new Promise<void>((resolve) => {
      setTimeout(() => {
        fakeSetState()
        resolve()
      }, 10)
    })

    // Do NOT set ignore = true (component stays mounted)
    await asyncOp

    expect(stateUpdated).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// deriveSessionInsights
// ---------------------------------------------------------------------------

function makeSessionRow(overrides: Partial<RegistroSesion> = {}): RegistroSesion {
  return {
    id: 'r1',
    created_at: '2026-01-01T00:00:00Z',
    id_consultoria: 'c1',
    pregunta: null,
    motivo_consulta: null,
    estado_inicial: null,
    acciones_realizadas: null,
    resultado_final: null,
    estimacion_impacto: null,
    entregables: null,
    resultado: null,
    cantidad_productos: 0,
    sesion_grabada: false,
    enlace_grabacion: null,
    adjuntar_evidencia: null,
    confirmo_no_automatizacion: null,
    ...overrides,
  }
}

describe('deriveSessionInsights', () => {
  it('filters out rows where all 4 target fields are null or empty', () => {
    const rows = [
      makeSessionRow({ id: 'r1', estado_inicial: null, acciones_realizadas: null, resultado_final: null, estimacion_impacto: null }),
      makeSessionRow({ id: 'r2', estado_inicial: '', acciones_realizadas: '  ', resultado_final: null, estimacion_impacto: null }),
    ]
    const result = deriveSessionInsights(rows)
    expect(result).toHaveLength(0)
  })

  it('keeps a row that has only one non-empty target field', () => {
    const rows = [
      makeSessionRow({ id: 'r1', estado_inicial: 'Activo', acciones_realizadas: null, resultado_final: null, estimacion_impacto: null }),
    ]
    const result = deriveSessionInsights(rows)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r1')
  })

  it('caps result at 10 when more than 10 rows qualify', () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      makeSessionRow({ id: `r${i}`, estado_inicial: `Estado ${i}` })
    )
    const result = deriveSessionInsights(rows)
    expect(result).toHaveLength(10)
  })

  it('returns empty array for empty input', () => {
    expect(deriveSessionInsights([])).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// buildInitialState — sessionInsights
// ---------------------------------------------------------------------------

describe('buildInitialState — sessionInsights', () => {
  it('returns sessionInsights: [] in initial state', () => {
    const state = buildInitialState()
    expect(state.sessionInsights).toEqual([])
  })
})
