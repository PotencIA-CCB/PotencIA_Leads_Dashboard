/**
 * TDD — RED phase for matchesSearch pure helper.
 * These tests must be RED until T13 implements the helper.
 */
import { describe, it, expect } from 'vitest'
import { matchesSearch } from '../searchHelpers'

const baseLead = {
  nombre_completo: 'Juan Pérez',
  email: 'juan@example.com',
  phone: '3001234567',
  id_num: '12345678',
  empresa: null as string | null,
  nit: null as string | null,
}

describe('matchesSearch — empresa field', () => {
  it('returns true when empresa matches query (case-insensitive)', () => {
    const lead = { ...baseLead, empresa: 'Acme Corp' }
    expect(matchesSearch(lead, 'acme')).toBe(true)
  })

  it('returns true when empresa matches with uppercase query', () => {
    const lead = { ...baseLead, empresa: 'Acme Corp' }
    expect(matchesSearch(lead, 'CORP')).toBe(true)
  })

  it('returns false when empresa does not match query', () => {
    const lead = { ...baseLead, empresa: 'Acme Corp' }
    expect(matchesSearch(lead, 'XYZ')).toBe(false)
  })

  it('does not throw when empresa is null', () => {
    const lead = { ...baseLead, empresa: null }
    expect(() => matchesSearch(lead, 'anything')).not.toThrow()
  })

  it('returns false (not matched) when empresa is null', () => {
    const lead = { ...baseLead, empresa: null }
    expect(matchesSearch(lead, 'anything')).toBe(false)
  })
})

describe('matchesSearch — nit field', () => {
  it('returns true when nit matches query', () => {
    const lead = { ...baseLead, nit: '900123456' }
    expect(matchesSearch(lead, '900123')).toBe(true)
  })

  it('returns true when nit matches with uppercase query', () => {
    const lead = { ...baseLead, nit: '900123456' }
    expect(matchesSearch(lead, '900123456')).toBe(true)
  })

  it('returns false when nit does not match query', () => {
    const lead = { ...baseLead, nit: '900123456' }
    expect(matchesSearch(lead, '111')).toBe(false)
  })

  it('does not throw when nit is null', () => {
    const lead = { ...baseLead, nit: null }
    expect(() => matchesSearch(lead, 'anything')).not.toThrow()
  })

  it('returns false (not matched) when nit is null', () => {
    const lead = { ...baseLead, nit: null }
    expect(matchesSearch(lead, 'anything')).toBe(false)
  })
})

describe('matchesSearch — empty query', () => {
  it('returns true for empty query string (no filter applied)', () => {
    expect(matchesSearch(baseLead, '')).toBe(true)
  })

  it('returns true for whitespace-only query', () => {
    expect(matchesSearch(baseLead, '   ')).toBe(true)
  })
})

describe('matchesSearch — existing fields still work', () => {
  it('returns true when nombre_completo matches', () => {
    expect(matchesSearch(baseLead, 'juan')).toBe(true)
  })

  it('returns true when email matches', () => {
    expect(matchesSearch(baseLead, 'juan@example')).toBe(true)
  })

  it('returns true when phone matches', () => {
    expect(matchesSearch(baseLead, '300123')).toBe(true)
  })

  it('returns true when id_num matches', () => {
    expect(matchesSearch(baseLead, '12345')).toBe(true)
  })
})
