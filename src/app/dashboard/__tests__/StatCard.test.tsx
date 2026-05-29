/**
 * Tests for StatCard tooltip behavior via the statCardShowsTooltip predicate.
 */
import { describe, it, expect } from 'vitest'
import { statCardShowsTooltip } from '@/lib/capturaStats'

describe('StatCard — tooltip visibility predicate', () => {
  it('returns true when helpText is a non-empty string', () => {
    expect(statCardShowsTooltip('Sesiones con resultado Resuelto. Fuente: registro_sesion.resultado')).toBe(true)
  })

  it('returns false when helpText is undefined (no prop passed)', () => {
    expect(statCardShowsTooltip(undefined)).toBe(false)
  })

  it('returns false when helpText is an empty string', () => {
    expect(statCardShowsTooltip('')).toBe(false)
  })
})
