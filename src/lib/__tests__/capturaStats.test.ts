import { describe, it, expect } from 'vitest'
import { computeCapturaStats, computeFunnelStats } from '../capturaStats'

// Minimal fixture builders
const lead = (id: string) => ({ id })
const formulario = (id_lead: string) => ({ id_lead })
const consultoria = (id: string, id_lead: string) => ({ id, id_lead })
const sesion = (id_consultoria: string, resultado: string | null) => ({ id_consultoria, resultado })

describe('computeCapturaStats — caso1 (three-way intersection)', () => {
  it('counts a lead present in all 3 tables', () => {
    const leads = [lead('lead-1')]
    const formularios = [formulario('lead-1')]
    const consultorias = [consultoria('con-1', 'lead-1')]
    const sesiones = [sesion('con-1', 'Resuelto')]

    const result = computeCapturaStats(leads, formularios, consultorias, sesiones)

    expect(result.caso1).toBe(1)
  })

  it('does not count a lead missing from registro_sesion', () => {
    const leads = [lead('lead-1')]
    const formularios = [formulario('lead-1')]
    const consultorias = [consultoria('con-1', 'lead-1')]
    const sesiones: ReturnType<typeof sesion>[] = []

    const result = computeCapturaStats(leads, formularios, consultorias, sesiones)

    expect(result.caso1).toBe(0)
  })

  it('does not count a lead with consultorias and sesion but no formulario_landing', () => {
    const leads = [lead('lead-1')]
    const formularios: ReturnType<typeof formulario>[] = []
    const consultorias = [consultoria('con-1', 'lead-1')]
    const sesiones = [sesion('con-1', 'Resuelto')]

    const result = computeCapturaStats(leads, formularios, consultorias, sesiones)

    expect(result.caso1).toBe(0)
  })
})

describe('computeCapturaStats — enSeguimiento', () => {
  it('counts sesion rows with resultado Seguimiento', () => {
    const leads = [lead('lead-1'), lead('lead-2')]
    const formularios = [formulario('lead-1'), formulario('lead-2')]
    const consultorias = [consultoria('con-1', 'lead-1'), consultoria('con-2', 'lead-2')]
    const sesiones = [sesion('con-1', 'Seguimiento'), sesion('con-2', 'Seguimiento')]

    const result = computeCapturaStats(leads, formularios, consultorias, sesiones)

    expect(result.enSeguimiento).toBe(2)
  })

  it('returns 0 when no sesion rows have resultado Seguimiento', () => {
    const leads = [lead('lead-1')]
    const formularios = [formulario('lead-1')]
    const consultorias = [consultoria('con-1', 'lead-1')]
    const sesiones = [sesion('con-1', 'Resuelto')]

    const result = computeCapturaStats(leads, formularios, consultorias, sesiones)

    expect(result.enSeguimiento).toBe(0)
  })
})

describe('computeCapturaStats — resuelto', () => {
  it('counts sesion rows with resultado Resuelto', () => {
    const leads = [lead('lead-1')]
    const formularios = [formulario('lead-1')]
    const consultorias = [consultoria('con-1', 'lead-1')]
    const sesiones = [sesion('con-1', 'Resuelto')]

    const result = computeCapturaStats(leads, formularios, consultorias, sesiones)

    expect(result.resuelto).toBe(1)
  })
})

describe('computeCapturaStats — escalar', () => {
  it('counts sesion rows with resultado Escalar', () => {
    const leads = [lead('lead-1')]
    const formularios = [formulario('lead-1')]
    const consultorias = [consultoria('con-1', 'lead-1')]
    const sesiones = [sesion('con-1', 'Escalar')]

    const result = computeCapturaStats(leads, formularios, consultorias, sesiones)

    expect(result.escalar).toBe(1)
  })

  it('returns 0 when no sesion rows have resultado Escalar', () => {
    const leads = [lead('lead-1')]
    const formularios = [formulario('lead-1')]
    const consultorias = [consultoria('con-1', 'lead-1')]
    const sesiones = [sesion('con-1', 'Resuelto')]

    const result = computeCapturaStats(leads, formularios, consultorias, sesiones)

    expect(result.escalar).toBe(0)
  })
})

describe('computeCapturaStats — empty inputs', () => {
  it('returns all zeros for empty arrays', () => {
    const result = computeCapturaStats([], [], [], [])

    expect(result).toEqual({ caso1: 0, enSeguimiento: 0, resuelto: 0, escalar: 0 })
  })
})

// Fixture builders for computeFunnelStats tests
const fLead = (id: string) => ({ id })
const fFormulario = (id_lead: string) => ({ id_lead })
const fConsultoria = (id: string, id_lead: string, status?: string) =>
  status !== undefined ? { id, id_lead, status } : { id, id_lead }
const fSesion = (id_consultoria: string, resultado: string | null = null) => ({
  id_consultoria,
  resultado,
})

describe('computeFunnelStats', () => {
  // T-F01: totalLandingLeads = unique lead IDs in formularios_landing
  it('T-F01: totalLandingLeads equals unique lead IDs in formularios_landing', () => {
    const leads = [fLead('l1'), fLead('l2'), fLead('l3')]
    const formularios = [fFormulario('l1'), fFormulario('l2'), fFormulario('l1')] // l1 duplicated
    const result = computeFunnelStats(leads, formularios, [], [])
    expect(result.totalLandingLeads).toBe(2)
  })

  // T-F02: landingNeverBooked = landing leads with no consultoria row
  it('T-F02: landingNeverBooked counts landing leads with no matching consultoria', () => {
    const leads = [fLead('l1'), fLead('l2'), fLead('l3')]
    const formularios = [fFormulario('l1'), fFormulario('l2')]
    const consultorias = [fConsultoria('c1', 'l1')]
    const result = computeFunnelStats(leads, formularios, consultorias, [])
    // l1 has consultoria, l2 does not
    expect(result.landingNeverBooked).toBe(1)
  })

  // T-F03: landingBooked = totalLandingLeads - landingNeverBooked
  it('T-F03: landingBooked satisfies arithmetic identity with totalLandingLeads and landingNeverBooked', () => {
    const leads = [fLead('l1'), fLead('l2'), fLead('l3')]
    const formularios = [fFormulario('l1'), fFormulario('l2'), fFormulario('l3')]
    const consultorias = [fConsultoria('c1', 'l1'), fConsultoria('c2', 'l3')]
    const result = computeFunnelStats(leads, formularios, consultorias, [])
    expect(result.landingBooked).toBe(result.totalLandingLeads - result.landingNeverBooked)
  })

  // T-F04: noShows = landing leads with consultoria but NO registro_sesion
  it('T-F04: noShows counts leads with landing+consultoria but no registro_sesion', () => {
    const leads = [fLead('l1'), fLead('l2'), fLead('l3')]
    const formularios = [fFormulario('l1'), fFormulario('l2'), fFormulario('l3')]
    const consultorias = [
      fConsultoria('c1', 'l1'), // has session → ciclo completo
      fConsultoria('c2', 'l2'), // no session → noShow
      // l3: landing only, no consultoria → landingNeverBooked
    ]
    const sesiones = [fSesion('c1')]
    const result = computeFunnelStats(leads, formularios, consultorias, sesiones)
    expect(result.noShows).toBe(1) // l2: landing + consultoria, no sesion
    expect(result.cicloCompleto).toBe(1) // l1
    expect(result.landingBooked).toBe(2) // l1 + l2 = noShows + cicloCompleto
  })

  // T-F05: cicloCompleto = landing ∩ consultorias ∩ sesiones
  it('T-F05: cicloCompleto counts leads present in landing, consultorias, and sesiones', () => {
    const leads = [fLead('l1'), fLead('l2'), fLead('l3')]
    const formularios = [fFormulario('l1'), fFormulario('l2')]
    const consultorias = [fConsultoria('c1', 'l1'), fConsultoria('c2', 'l2'), fConsultoria('c3', 'l3')]
    const sesiones = [fSesion('c1')] // only l1 has session
    const result = computeFunnelStats(leads, formularios, consultorias, sesiones)
    expect(result.cicloCompleto).toBe(1) // only l1: landing ∩ consultoria ∩ sesion
  })

  // T-F06: soloBookedNoSession = consultorias with no landing and no sesion
  it('T-F06: soloBookedNoSession counts consultorias with no landing and no sesion', () => {
    const leads = [fLead('l1'), fLead('l2'), fLead('l3')]
    const formularios = [fFormulario('l1')]           // l1 has landing
    const consultorias = [
      fConsultoria('c1', 'l1'),  // has landing → not solo booked
      fConsultoria('c2', 'l2'),  // no landing, no sesion → solo booked
      fConsultoria('c3', 'l3'),  // no landing, but has sesion → canalDirecto
    ]
    const sesiones = [fSesion('c3')]
    const result = computeFunnelStats(leads, formularios, consultorias, sesiones)
    expect(result.soloBookedNoSession).toBe(1) // only l2
  })

  // T-F07: canalDirecto (bookedNoLandingDirecto) = consultoria + sesion but no landing
  it('T-F07: bookedNoLandingDirecto counts leads with consultoria + sesion but no landing', () => {
    const leads = [fLead('l1'), fLead('l2'), fLead('l3')]
    const formularios = [fFormulario('l1')]            // l1 has landing
    const consultorias = [
      fConsultoria('c1', 'l1'),   // has landing → not canal directo
      fConsultoria('c2', 'l2'),   // no landing, has sesion → canal directo
      fConsultoria('c3', 'l3'),   // no landing, no sesion → solo booked
    ]
    const sesiones = [fSesion('c2')]
    const result = computeFunnelStats(leads, formularios, consultorias, sesiones)
    expect(result.bookedNoLandingDirecto).toBe(1) // only l2
  })

  // T-F09: totalBookings is NOT a field on FunnelStats (it is a separate prop on the component)
  it('T-F09: computeFunnelStats does not include a totalBookings field in its return value', () => {
    const result = computeFunnelStats([], [], [], [])
    expect((result as unknown as Record<string, unknown>).totalBookings).toBeUndefined()
  })

  // T-F empty: returns all zeros for empty inputs
  it('returns all zeros for empty inputs', () => {
    const result = computeFunnelStats([], [], [], [])
    expect(result).toEqual({
      totalLandingLeads: 0,
      landingNeverBooked: 0,
      landingBooked: 0,
      noShows: 0,
      cicloCompleto: 0,
      bookedNoLandingDirecto: 0,
      soloBookedNoSession: 0,
    })
  })
})
