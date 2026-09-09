/**
 * Etapa del embudo, agendamiento mostrado y consultor mostrado.
 *
 * La etapa reemplaza al status de la consultoría en el chip de la card: deriva
 * de los mismos tres booleanos que usa `computeFunnelStats` en capturaStats.ts
 * —formulario, consultoría, sesión registrada— para que la card y el embudo del
 * BI no puedan contradecirse.
 */
import { describe, it, expect } from 'vitest'
import { etapaLead, etapaConsultoria, agendamientoMostrado, consultorMostrado } from '../LeadCard'
import type { LeadWithMeta, SessionHistoryItem } from '../LeadCard'

const HOY = '2026-09-09'

function sesion(fecha: string, conRegistro = false): SessionHistoryItem {
  return {
    id: `c-${fecha}`,
    fecha,
    hora_inicio: '14:00',
    duracion_minutos: 60,
    modalidad: 'Virtual',
    servicio: 'Consultoría',
    staff_name: 'Carlos Consultor',
    status: 'Agendado',
    registro_sesion: conRegistro
      ? { estado_inicial: 'Todo en Excel', acciones_realizadas: 'Se armó un flujo', resultado_final: 'Listo' }
      : null,
  }
}

function lead(over: Partial<LeadWithMeta> = {}): LeadWithMeta {
  return {
    id: 'l-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    nombre_completo: 'Ana Pérez',
    id_num: null, nit: null, email: 'ana@empresa.com', phone: null, city: null,
    cargo: null, company_role_level: null, company_role_area: null, sector: null,
    empresa: null, sexo: null, booking_customer_id: null, phone_normalized: null,
    origen: 'landing', nit_validado_rues: false, renovado_2026: false,
    ...over,
  } as LeadWithMeta
}

describe('etapaLead', () => {
  it('sin consultoría es Sin agendar', () => {
    expect(etapaLead(lead(), HOY)).toBe('Sin agendar')
  })

  it('haber llenado el formulario no cambia nada: sin consultoría sigue siendo Sin agendar', () => {
    const l = lead({ formulario: { tema: 'IA', descripcion: null, fecha_registro: '2026-08-01' } })
    expect(etapaLead(l, HOY)).toBe('Sin agendar')
  })

  it('con consultoría futura y sin sesión es Agendado', () => {
    expect(etapaLead(lead({ sesiones: [sesion('2026-09-20')] }), HOY)).toBe('Agendado')
  })

  it('con consultoría hoy y sin sesión todavía es Agendado', () => {
    expect(etapaLead(lead({ sesiones: [sesion(HOY)] }), HOY)).toBe('Agendado')
  })

  it('con consultoría pasada y sin sesión es No asistió', () => {
    expect(etapaLead(lead({ sesiones: [sesion('2026-08-20')] }), HOY)).toBe('No asistió')
  })

  it('con sesión registrada es Resuelto, aunque la consultoría sea pasada', () => {
    expect(etapaLead(lead({ sesiones: [sesion('2026-08-20', true)] }), HOY)).toBe('Resuelto')
  })

  it('basta una sesión registrada entre varias para ser Resuelto', () => {
    const l = lead({ sesiones: [sesion('2026-09-20'), sesion('2026-08-20', true)] })
    expect(etapaLead(l, HOY)).toBe('Resuelto')
  })

  it('la consultoría manda sobre el formulario', () => {
    const l = lead({
      formulario: { tema: 'IA', descripcion: null, fecha_registro: '2026-08-01' },
      sesiones: [sesion('2026-09-20')],
    })
    expect(etapaLead(l, HOY)).toBe('Agendado')
  })
})

describe('etapaConsultoria', () => {
  it('con registro de sesión es Resuelto', () => {
    expect(etapaConsultoria(sesion('2026-08-20', true), HOY)).toBe('Resuelto')
  })

  it('futura y sin registro es Agendado', () => {
    expect(etapaConsultoria(sesion('2026-09-20'), HOY)).toBe('Agendado')
  })

  it('pasada y sin registro es No asistió', () => {
    expect(etapaConsultoria(sesion('2026-08-20'), HOY)).toBe('No asistió')
  })

  it('a diferencia de etapaLead, mira solo su propia sesión', () => {
    const conRegistro = sesion('2026-08-20', true)
    const sinRegistro = sesion('2026-08-21')
    const l = lead({ sesiones: [conRegistro, sinRegistro] })

    expect(etapaLead(l, HOY)).toBe('Resuelto')
    expect(etapaConsultoria(sinRegistro, HOY)).toBe('No asistió')
  })
})

describe('agendamientoMostrado', () => {
  it('devuelve null sin consultorías', () => {
    expect(agendamientoMostrado([], HOY)).toBeNull()
  })

  it('prefiere el futuro más próximo, no el más lejano', () => {
    const r = agendamientoMostrado([sesion('2026-12-01'), sesion('2026-09-20'), sesion('2026-10-15')], HOY)
    expect(r?.fecha).toBe('2026-09-20')
  })

  it('cuenta hoy como futuro', () => {
    expect(agendamientoMostrado([sesion('2026-08-01'), sesion(HOY)], HOY)?.fecha).toBe(HOY)
  })

  it('sin futuros cae al pasado más reciente', () => {
    const r = agendamientoMostrado([sesion('2026-03-01'), sesion('2026-08-20'), sesion('2026-05-10')], HOY)
    expect(r?.fecha).toBe('2026-08-20')
  })

  it('no depende del orden de entrada', () => {
    const desordenado = [sesion('2026-10-15'), sesion('2026-08-20'), sesion('2026-09-20')]
    expect(agendamientoMostrado(desordenado, HOY)?.fecha).toBe('2026-09-20')
    expect(agendamientoMostrado([...desordenado].reverse(), HOY)?.fecha).toBe('2026-09-20')
  })
})

describe('consultorMostrado', () => {
  it('para un lead de booking prefiere el staff de la consultoría', () => {
    const l = lead({
      origen: 'booking',
      consultor_nombre: 'Asignado En Base',
      consultoria: { staff_name: 'Staff Del Archivo' } as LeadWithMeta['consultoria'],
    })
    expect(consultorMostrado(l)).toBe('Staff Del Archivo')
  })

  it('para un lead de booking sin staff cae al consultor asignado', () => {
    const l = lead({
      origen: 'booking',
      consultor_nombre: 'Asignado En Base',
      consultoria: { staff_name: null } as LeadWithMeta['consultoria'],
    })
    expect(consultorMostrado(l)).toBe('Asignado En Base')
  })

  it('para un lead que no es de booking usa el consultor asignado', () => {
    const l = lead({
      origen: 'landing',
      consultor_nombre: 'Asignado En Base',
      consultoria: { staff_name: 'Staff Del Archivo' } as LeadWithMeta['consultoria'],
    })
    expect(consultorMostrado(l)).toBe('Asignado En Base')
  })

  it('para un lead que no es de booking cae al staff cuando no hay asignado', () => {
    const l = lead({
      origen: 'ambos',
      consultoria: { staff_name: 'Staff Del Archivo' } as LeadWithMeta['consultoria'],
    })
    expect(consultorMostrado(l)).toBe('Staff Del Archivo')
  })

  it('devuelve null cuando no hay ninguno', () => {
    expect(consultorMostrado(lead({ origen: 'booking' }))).toBeNull()
    expect(consultorMostrado(lead({ origen: 'landing' }))).toBeNull()
  })
})
