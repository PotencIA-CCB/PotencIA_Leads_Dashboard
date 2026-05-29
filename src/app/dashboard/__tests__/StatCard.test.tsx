/**
 * Tests for StatCard tooltip behavior via the statCardShowsTooltip predicate.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { statCardShowsTooltip } from '@/lib/capturaStats'
import { StatCard } from '@/components/dashboard/StatCard'

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

describe('StatCard — value rendering', () => {
  it('renders a number value as text in the value element', () => {
    const html = renderToStaticMarkup(
      createElement(StatCard, { label: 'Total', value: 42, accent: 'text-blue-600' })
    )
    expect(html).toContain('42')
  })

  it('renders a string value "N/A" in the value element with the same styling', () => {
    const html = renderToStaticMarkup(
      createElement(StatCard, { label: 'Total', value: 'N/A', accent: 'text-blue-600' })
    )
    expect(html).toContain('N/A')
    expect(html).toContain('text-3xl')
    expect(html).toContain('font-extrabold')
  })
})
