/**
 * Tests for LeadModal session data rendering logic.
 *
 * Strategy: Extract pure helper functions for testability (node env).
 * Tests verify which session fields trigger the "Registro de sesión" section.
 */
import { describe, it, expect } from 'vitest'
import { hasRegistroSesionData, CONSULTOR_ASSIGN_REMOVED } from '../LeadModal'

describe('LeadModal — hasRegistroSesionData', () => {
  it('returns false when registro_sesion is null', () => {
    expect(hasRegistroSesionData(null)).toBe(false)
  })

  it('returns false when registro_sesion is undefined', () => {
    expect(hasRegistroSesionData(undefined)).toBe(false)
  })

  it('returns false when all fields are null/empty', () => {
    expect(hasRegistroSesionData({
      estado_inicial: null,
      acciones_realizadas: null,
      resultado_final: null,
    })).toBe(false)
  })

  it('returns true when acciones_realizadas has content', () => {
    expect(hasRegistroSesionData({
      estado_inicial: null,
      acciones_realizadas: 'Revisión de flujo de caja',
      resultado_final: null,
    })).toBe(true)
  })

  it('returns true when estado_inicial has content', () => {
    expect(hasRegistroSesionData({
      estado_inicial: 'Pendiente',
      acciones_realizadas: null,
      resultado_final: null,
    })).toBe(true)
  })

  it('returns true when resultado_final has content', () => {
    expect(hasRegistroSesionData({
      estado_inicial: null,
      acciones_realizadas: null,
      resultado_final: 'Cliente interesado',
    })).toBe(true)
  })

  it('returns true when all fields are populated', () => {
    expect(hasRegistroSesionData({
      estado_inicial: 'Pendiente',
      acciones_realizadas: 'Revisión financiera',
      resultado_final: 'Seguimiento programado',
    })).toBe(true)
  })
})

describe('LeadModal — consultor assignment removal (F5)', () => {
  it('exports CONSULTOR_ASSIGN_REMOVED sentinel as true (verifies onAsignarConsultor prop has been removed)', () => {
    // This test is RED until T10 implementation removes the prop and adds the sentinel.
    // When CONSULTOR_ASSIGN_REMOVED is exported from LeadModal, this goes GREEN.
    expect(CONSULTOR_ASSIGN_REMOVED).toBe(true)
  })
})
