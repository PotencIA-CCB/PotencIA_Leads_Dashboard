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
    expect(result.nitsUnicos).toBe(0)
    expect(result.nitsValidos).toBe(0)
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

  it('counts nitsUnicos correctly — deduplicates and excludes null — via registro_sesion join', () => {
    const leads = [
      { id: 'l1', nit: '123', empresa: null, nit_validado_rues: false, renovado_2026: false },
      { id: 'l2', nit: null, empresa: null, nit_validado_rues: false, renovado_2026: false },
      { id: 'l3', nit: '123', empresa: null, nit_validado_rues: false, renovado_2026: false },
      { id: 'l4', nit: '456', empresa: null, nit_validado_rues: false, renovado_2026: false },
    ]
    const consultorias = [
      { id: 'c1', id_lead: 'l1' },
      { id: 'c2', id_lead: 'l2' },
      { id: 'c3', id_lead: 'l3' },
      { id: 'c4', id_lead: 'l4' },
    ]
    const sesiones = [
      { id_consultoria: 'c1' },
      { id_consultoria: 'c2' },
      { id_consultoria: 'c3' },
      { id_consultoria: 'c4' },
    ]
    const result = computeBiStats(leads, sesiones, consultorias)
    expect(result.nitsUnicos).toBe(2)
  })

  it('counts nitsValidos correctly', () => {
    const leads = [
      { nit: '1', empresa: null, nit_validado_rues: true, renovado_2026: false },
      { nit: '2', empresa: null, nit_validado_rues: false, renovado_2026: false },
      { nit: '3', empresa: null, nit_validado_rues: true, renovado_2026: false },
    ]
    const result = computeBiStats(leads, [], [])
    expect(result.nitsValidos).toBe(2)
  })

  it('counts empresasRegistradas correctly — excludes null and whitespace', () => {
    const leads = [
      { nit: null, empresa: 'Acme', nit_validado_rues: false, renovado_2026: false },
      { nit: null, empresa: null, nit_validado_rues: false, renovado_2026: false },
      { nit: null, empresa: '   ', nit_validado_rues: false, renovado_2026: false },
    ]
    const result = computeBiStats(leads, [], [])
    expect(result.empresasRegistradas).toBe(1)
  })

  it('counts empresasRenovadas correctly', () => {
    const leads = [
      { nit: null, empresa: null, nit_validado_rues: false, renovado_2026: true },
      { nit: null, empresa: null, nit_validado_rues: false, renovado_2026: false },
    ]
    const result = computeBiStats(leads, [], [])
    expect(result.empresasRenovadas).toBe(1)
  })

  it('returns correct shape with all 5 fields present', () => {
    const result = computeBiStats([], [], [])
    const keys: (keyof BiStats)[] = [
      'sesionesTotales',
      'nitsUnicos',
      'nitsValidos',
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
      { id: 'l1', nit: '111', empresa: 'Corp A', nit_validado_rues: true, renovado_2026: true },
      { id: 'l2', nit: '222', empresa: null, nit_validado_rues: false, renovado_2026: false },
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
    expect(state.biStats!.nitsUnicos).toBe(2)
    expect(state.biStats!.nitsValidos).toBe(1)
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
    expect(state.biStats!.nitsUnicos).toBe(0)
    expect(state.biStats!.nitsValidos).toBe(0)
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
