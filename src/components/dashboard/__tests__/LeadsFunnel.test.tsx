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
  // T-C01: renders correct number of stage cards (9 stages in the grid)
  it('T-C01: renders the correct number of stage cards', () => {
    const html = render()
    // 9 stage cards — each has bg-cyan-50 for the icon container
    // Count by looking at the card label headings (uppercase tracking-widest)
    // Each StageCard has the text-[10px] font-bold uppercase label
    const labelMatches = html.match(/text-\[10px\] font-bold uppercase tracking-widest text-slate-400(?!.*mb-4)/g) ?? []
    // Simpler: count InfoTooltip trigger icons ("help" material symbol)
    // Each StageCard has exactly one InfoTooltip
    const helpIconMatches = html.match(/>help<\/span>/g) ?? []
    expect(helpIconMatches.length).toBe(9)
  })

  // T-C02: each stage card shows the stage label and value
  it('T-C02: stage card shows totalLandingLeads value with correct label', () => {
    const html = render({ ...defaultStats, totalLandingLeads: 325 })
    expect(html).toContain('325')
    expect(html).toContain('Registrados en Landing')
  })

  // T-C03: InfoTooltip renders with helpText for stage cards
  it('T-C03: InfoTooltip renders with helpText for at least one stage card', () => {
    const html = render()
    // InfoTooltip renders when helpText is non-empty — it renders the "help" icon
    expect(html).toContain('material-symbols-outlined')
    // The tooltip container has aria-label="Información del indicador"
    expect(html).toContain('Información del indicador')
  })

  // T-C04: all 9 stage values are present in the output
  it('T-C04: all funnel stat values appear in the rendered output', () => {
    const html = render(defaultStats, 20)
    expect(html).toContain('10') // totalLandingLeads
    expect(html).toContain('3')  // landingNeverBooked
    expect(html).toContain('7')  // landingBooked
    expect(html).toContain('2')  // noShows
    expect(html).toContain('5')  // cicloCompleto
    expect(html).toContain('20') // totalBookings
    expect(html).toContain('4')  // bookedNoLandingDirecto
    expect(html).toContain('6')  // soloBookedNoSession
    expect(html).toContain('1')  // asistieronSinLandingNiBooking
  })

  // T-C05: percentage note is shown for landingNeverBooked card
  it('T-C05: percentage note appears on the landingNeverBooked card', () => {
    const html = render({ ...defaultStats, landingNeverBooked: 118, totalLandingLeads: 325 })
    expect(html).toMatch(/\d+\.?\d*% de landing/)
  })
})
