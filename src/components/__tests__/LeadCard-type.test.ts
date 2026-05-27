/**
 * Tests for LeadCardConsultoria type extension with registro_sesion fields.
 *
 * These are compile-time type checks. If the type doesn't include registro_sesion,
 * the test file won't compile.
 */
import { describe, it, expect } from 'vitest'
import type { LeadCardConsultoria } from '../LeadCard'

describe('LeadCardConsultoria — registro_sesion type extension', () => {
  it('accepts registro_sesion as null', () => {
    const lead: LeadCardConsultoria = {
      id: 'c-1',
      fecha: '2024-01-15',
      hora_inicio: '10:00',
      hora_fin: '11:00',
      modalidad: 'Virtual',
      duracion_minutos: 60,
      servicio: 'Consultoría',
      staff_name: 'Juan',
      staff_email: 'juan@test.com',
      categoria_caso_uso: 'Agentes',
      id_consultor: 'cons-1',
      status: 'En seguimiento',
      registro_sesion: null,
    }
    expect(lead.registro_sesion).toBeNull()
  })

  it('accepts registro_sesion with populated fields', () => {
    const lead: LeadCardConsultoria = {
      id: 'c-2',
      fecha: '2024-01-16',
      hora_inicio: null,
      hora_fin: null,
      modalidad: null,
      duracion_minutos: null,
      servicio: null,
      staff_name: null,
      staff_email: null,
      categoria_caso_uso: null,
      id_consultor: null,
      status: 'Pendiente',
      registro_sesion: {
        estado_inicial: 'Pendiente',
        acciones_realizadas: 'Revisión de flujo de caja',
        resultado_final: 'Cliente interesado en automatización',
      },
    }
    expect(lead.registro_sesion?.acciones_realizadas).toBe('Revisión de flujo de caja')
    expect(lead.registro_sesion?.estado_inicial).toBe('Pendiente')
    expect(lead.registro_sesion?.resultado_final).toBe('Cliente interesado en automatización')
  })

  it('allows undefined registro_sesion (backward compatible)', () => {
    const lead: LeadCardConsultoria = {
      id: 'c-3',
      fecha: '2024-01-17',
      hora_inicio: null,
      hora_fin: null,
      modalidad: null,
      duracion_minutos: null,
      servicio: null,
      staff_name: null,
      staff_email: null,
      categoria_caso_uso: null,
      id_consultor: null,
      status: 'Pendiente',
    }
    expect(lead.registro_sesion).toBeUndefined()
  })
})
