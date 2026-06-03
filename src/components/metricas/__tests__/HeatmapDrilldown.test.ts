import { describe, it, expect } from 'vitest'

/**
 * Tests for the lead name display logic extracted from HeatmapDrilldown.
 *
 * Strategy: test the display expression inline (node env, no jsdom).
 * The component renders: c.leads?.nombre_completo || c.leads?.city || '—'
 */
function leadDisplay(leads: { nombre_completo?: string | null; city?: string | null } | null | undefined): string {
  return leads?.nombre_completo || leads?.city || '—'
}

describe('HeatmapDrilldown — lead name display', () => {
  it('shows nombre_completo when set', () => {
    expect(leadDisplay({ nombre_completo: 'Juan Pérez', city: 'Bogotá' })).toBe('Juan Pérez')
  })

  it('falls back to city when nombre_completo is null', () => {
    expect(leadDisplay({ nombre_completo: null, city: 'Bogotá' })).toBe('Bogotá')
  })

  it('shows "—" when both nombre_completo and city are null', () => {
    expect(leadDisplay({ nombre_completo: null, city: null })).toBe('—')
  })

  it('shows "—" when leads is null', () => {
    expect(leadDisplay(null)).toBe('—')
  })
})
