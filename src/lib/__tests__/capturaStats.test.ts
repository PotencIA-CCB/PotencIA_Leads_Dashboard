import { describe, it, expect } from 'vitest'
import { computeCapturaStats } from '../capturaStats'

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
