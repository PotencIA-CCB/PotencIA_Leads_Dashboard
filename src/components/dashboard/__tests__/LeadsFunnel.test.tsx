import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LeadsFunnel from '../LeadsFunnel'
import type { FunnelStats } from '@/lib/capturaStats'

const defaultStats: FunnelStats = {
  totalLandingLeads: 10,
  landingNeverBooked: 3,
  landingBooked: 7,
  noShows: 2,
  cicloCompleto: 5,
  bookedNoLandingDirecto: 4,
  soloBookedNoSession: 6,
  asistieronSinLandingNiBooking: 1,
}

const zeroStats: FunnelStats = {
  totalLandingLeads: 0,
  landingNeverBooked: 0,
  landingBooked: 0,
  noShows: 0,
  cicloCompleto: 0,
  bookedNoLandingDirecto: 0,
  soloBookedNoSession: 0,
  asistieronSinLandingNiBooking: 0,
}

function render(stats: FunnelStats = defaultStats, totalBookings = 20): string {
  return renderToStaticMarkup(createElement(LeadsFunnel, { stats, totalBookings }))
}

describe('LeadsFunnel component', () => {
  // T-C01: tree root shows totalLandingLeads
  it('T-C01: tree root line shows totalLandingLeads value', () => {
    const html = render({ ...defaultStats, totalLandingLeads: 325 })
    expect(html).toContain('325')
    expect(html).toContain('se registraron en landing')
  })

  // T-C02: landingNeverBooked and landingBooked appear at second indent level
  it('T-C02: landingNeverBooked and landingBooked appear with tree connectors', () => {
    const html = render({ ...defaultStats, landingNeverBooked: 118, landingBooked: 207 })
    expect(html).toContain('118')
    expect(html).toContain('207')
    expect(html).toContain('└─')
  })

  // T-C03: noShows and cicloCompleto appear at deepest indent
  it('T-C03: noShows and cicloCompleto appear in the rendered output', () => {
    const html = render({ ...defaultStats, noShows: 55, cicloCompleto: 108 })
    expect(html).toContain('55')
    expect(html).toContain('108')
  })

  // T-C04: summary table has exactly 5 data rows
  it('T-C04: summary table has exactly 5 data rows', () => {
    const html = render()
    // Count <tr> elements that are data rows (exclude header row)
    // We look for td elements in pairs — each row has at least one td
    const tdMatches = html.match(/<td[^>]*>/g) ?? []
    // 5 rows × 2 columns = 10 td elements
    expect(tdMatches.length).toBe(10)
  })

  // T-C05: row 2 percentage matches pattern "X% de landing"
  it('T-C05: row 2 shows percentage string matching "X% de landing"', () => {
    const html = render({ ...defaultStats, landingNeverBooked: 118, totalLandingLeads: 325 })
    expect(html).toMatch(/\d+\.?\d*% de landing/)
  })
})
