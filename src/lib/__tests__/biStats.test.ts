import { describe, it, expect } from 'vitest'
import {
  countSesionesTotales,
  countNitsUnicos,
  countNitsValidos,
  countEmpresasRegistradas,
  countEmpresasRenovadas,
} from '../biStats'

// ---------------------------------------------------------------------------
// countSesionesTotales
// ---------------------------------------------------------------------------

describe('countSesionesTotales', () => {
  it('returns the total number of rows in a populated array', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ id_consultoria: `con-${i}` }))
    expect(countSesionesTotales(rows)).toBe(7)
  })

  it('returns 0 for an empty array', () => {
    expect(countSesionesTotales([])).toBe(0)
  })

  it('returns 1 for a single-row array', () => {
    expect(countSesionesTotales([{ id_consultoria: 'con-1' }])).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// countNitsUnicos
// ---------------------------------------------------------------------------

describe('countNitsUnicos', () => {
  it('returns 2 for [123, null, 123, 456, null] — deduplicates and excludes null', () => {
    const leads = [
      { nit: '123' },
      { nit: null },
      { nit: '123' },
      { nit: '456' },
      { nit: null },
    ]
    expect(countNitsUnicos(leads)).toBe(2)
  })

  it('returns 0 when all nit values are null', () => {
    const leads = [{ nit: null }, { nit: null }, { nit: null }]
    expect(countNitsUnicos(leads)).toBe(0)
  })

  it('returns 0 for an empty array', () => {
    expect(countNitsUnicos([])).toBe(0)
  })

  it('excludes empty-string nit values from the unique count', () => {
    const leads = [
      { nit: '' },
      { nit: '123' },
      { nit: '' },
    ]
    // Only '123' is a valid nit
    expect(countNitsUnicos(leads)).toBe(1)
  })

  it('counts 3 unique nits when there are no duplicates and no nulls', () => {
    const leads = [{ nit: 'A' }, { nit: 'B' }, { nit: 'C' }]
    expect(countNitsUnicos(leads)).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// countNitsValidos
// ---------------------------------------------------------------------------

describe('countNitsValidos', () => {
  it('returns 2 when 2 of 5 leads have nit_validado_rues = true', () => {
    const leads = [
      { nit_validado_rues: true },
      { nit_validado_rues: false },
      { nit_validado_rues: true },
      { nit_validado_rues: false },
      { nit_validado_rues: false },
    ]
    expect(countNitsValidos(leads)).toBe(2)
  })

  it('returns 0 when all leads have nit_validado_rues = false (new DB default)', () => {
    const leads = [
      { nit_validado_rues: false },
      { nit_validado_rues: false },
      { nit_validado_rues: false },
    ]
    expect(countNitsValidos(leads)).toBe(0)
  })

  it('returns 0 for an empty array', () => {
    expect(countNitsValidos([])).toBe(0)
  })

  it('returns the full count when all leads are validated', () => {
    const leads = [
      { nit_validado_rues: true },
      { nit_validado_rues: true },
    ]
    expect(countNitsValidos(leads)).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// countEmpresasRegistradas
// ---------------------------------------------------------------------------

describe('countEmpresasRegistradas', () => {
  it('returns 3 when 3 of 10 leads have a non-null empresa', () => {
    const leads = [
      { empresa: 'Acme Corp' },
      { empresa: null },
      { empresa: 'Beta LLC' },
      { empresa: null },
      { empresa: null },
      { empresa: 'Gamma SA' },
      { empresa: null },
      { empresa: null },
      { empresa: null },
      { empresa: null },
    ]
    expect(countEmpresasRegistradas(leads)).toBe(3)
  })

  it('returns 0 when all leads have null empresa', () => {
    const leads = [{ empresa: null }, { empresa: null }]
    expect(countEmpresasRegistradas(leads)).toBe(0)
  })

  it('excludes whitespace-only empresa values', () => {
    const leads = [
      { empresa: '   ' },
      { empresa: 'Valid Corp' },
      { empresa: '\t' },
    ]
    expect(countEmpresasRegistradas(leads)).toBe(1)
  })

  it('returns 0 for an empty array', () => {
    expect(countEmpresasRegistradas([])).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// countEmpresasRenovadas
// ---------------------------------------------------------------------------

describe('countEmpresasRenovadas', () => {
  it('returns 0 when all leads have renovado_2026 = false (new DB default)', () => {
    const leads = [
      { renovado_2026: false },
      { renovado_2026: false },
      { renovado_2026: false },
    ]
    expect(countEmpresasRenovadas(leads)).toBe(0)
  })

  it('returns 2 when 2 leads have renovado_2026 = true', () => {
    const leads = [
      { renovado_2026: true },
      { renovado_2026: false },
      { renovado_2026: true },
      { renovado_2026: false },
    ]
    expect(countEmpresasRenovadas(leads)).toBe(2)
  })

  it('returns 0 for an empty array', () => {
    expect(countEmpresasRenovadas([])).toBe(0)
  })

  it('returns the full count when all leads are renovated', () => {
    const leads = [{ renovado_2026: true }, { renovado_2026: true }]
    expect(countEmpresasRenovadas(leads)).toBe(2)
  })
})
