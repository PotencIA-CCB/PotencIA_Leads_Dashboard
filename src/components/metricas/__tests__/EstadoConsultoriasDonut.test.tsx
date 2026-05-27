/**
 * Tests for EstadoConsultoriasDonut component.
 *
 * Strategy: Extract pure helper functions for testability (node env, no jsdom).
 * The component itself wraps Recharts PieChart — its data logic is what we test.
 */
import { describe, it, expect } from 'vitest'
import { prepareDonutData, DONUT_COLORS } from '../EstadoConsultoriasDonut'

describe('EstadoConsultoriasDonut — prepareDonutData', () => {
  it('returns empty array when porEstadoAtendidas is empty', () => {
    expect(prepareDonutData([])).toEqual([])
  })

  it('returns all entries when data exists', () => {
    const data = [
      { status: 'En seguimiento', total: 4 },
      { status: 'Resuelto', total: 10 },
    ]
    const result = prepareDonutData(data)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ status: 'En seguimiento', total: 4 })
    expect(result[1]).toEqual({ status: 'Resuelto', total: 10 })
  })

  it('preserves entry order unchanged', () => {
    const data = [
      { status: 'Cancelado', total: 1 },
      { status: 'Resuelto', total: 5 },
      { status: 'En seguimiento', total: 3 },
    ]
    const result = prepareDonutData(data)
    expect(result.map((d) => d.total)).toEqual([1, 5, 3])
  })
})

describe('EstadoConsultoriasDonut — DONUT_COLORS', () => {
  it('exports at least 4 colors for the donut segments', () => {
    expect(DONUT_COLORS).toHaveLength(4)
  })

  it('contains expected brand colors', () => {
    expect(DONUT_COLORS).toContain('#003087')
    expect(DONUT_COLORS).toContain('#00C8FF')
    expect(DONUT_COLORS).toContain('#E8470A')
  })
})
