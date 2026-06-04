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
}

const zeroStats: FunnelStats = {
  totalLandingLeads: 0,
  landingNeverBooked: 0,
  landingBooked: 0,
  noShows: 0,
  cicloCompleto: 0,
  bookedNoLandingDirecto: 0,
  soloBookedNoSession: 0,
}

function render(stats: FunnelStats = defaultStats, totalBookings = 20): string {
  return renderToStaticMarkup(createElement(LeadsFunnel, { stats, totalBookings }))
}

describe('LeadsFunnel component', () => {
  // T-C01: renders landing tree root with value and label
  it('T-C01: renders totalLandingLeads at the tree root', () => {
    const html = render({ ...defaultStats, totalLandingLeads: 325 })
    expect(html).toContain('325')
    expect(html).toContain('se registraron en landing')
  })

  // T-C02: renders landingNeverBooked with its label
  it('T-C02: renders landingNeverBooked with label', () => {
    const html = render({ ...defaultStats, landingNeverBooked: 118 })
    expect(html).toContain('118')
    expect(html).toContain('nunca agendaron')
  })

  // T-C03: renders totalBookings tree root
  it('T-C03: renders totalBookings at the bookings tree root', () => {
    const html = render(defaultStats, 351)
    expect(html).toContain('351')
    expect(html).toContain('bookings totales')
  })

  // T-C04: all funnel stat values appear in the rendered output
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
    expect(html).toContain('>20<') // totalBookings — actually rendered via Tree 2 root
  })

  // T-C05: percentage note appears in the summary table for landingNeverBooked
  it('T-C05: percentage note appears for landingNeverBooked', () => {
    const html = render({ ...defaultStats, landingNeverBooked: 118, totalLandingLeads: 325 })
    expect(html).toMatch(/\d+\.?\d*% de landing/)
  })
})
