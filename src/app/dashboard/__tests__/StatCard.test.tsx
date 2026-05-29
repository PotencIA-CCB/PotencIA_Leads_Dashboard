/**
 * Tests for StatCard tooltip behavior.
 *
 * Strategy: Export a pure helper `statCardShowsTooltip(helpText?)` from page.tsx
 * that mirrors the conditional `{helpText && <InfoTooltip ... />}`. Test the
 * predicate in node env (no DOM needed — matches project convention).
 *
 * StatCard is exported from page.tsx so it can be imported here.
 */
import { describe, it, expect } from 'vitest'
import { statCardShowsTooltip } from '../page'

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
