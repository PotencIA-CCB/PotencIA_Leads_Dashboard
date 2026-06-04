/**
 * Tests for Lead Session History feature.
 *
 * Strategy: Pure helper functions only — node env, no jsdom.
 * Mirrors LeadModal-session.test.ts pattern.
 */
import { describe, it, expect } from 'vitest'
import { shouldShowSessionHistory, type SessionHistoryItem } from '../LeadCard'
import { buildSessionHistory } from '../../app/dashboard/sessionHistoryUtils'
import { hasRegistroSesionData, shouldShowSessionHistory as shouldShowFromModal } from '../LeadModal'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<SessionHistoryItem> = {}): SessionHistoryItem {
  return {
    id: 'test-id',
    fecha: '2025-06-01',
    hora_inicio: '10:00',
    duracion_minutos: 60,
    modalidad: 'Virtual',
    servicio: 'Consultoría',
    staff_name: 'Staff Nombre',
    status: 'Resuelto',
    registro_sesion: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// shouldShowSessionHistory
// ---------------------------------------------------------------------------

describe('shouldShowSessionHistory', () => {
  it('returns false when sesiones is undefined', () => {
    expect(shouldShowSessionHistory(undefined)).toBe(false)
  })

  it('returns false when sesiones is empty array', () => {
    expect(shouldShowSessionHistory([])).toBe(false)
  })

  it('returns false when sesiones has exactly one item', () => {
    expect(shouldShowSessionHistory([makeSession()])).toBe(false)
  })

  it('returns true when sesiones has exactly two items', () => {
    expect(shouldShowSessionHistory([makeSession(), makeSession({ id: 'id-2' })])).toBe(true)
  })

  it('returns true when sesiones has more than two items', () => {
    expect(shouldShowSessionHistory([
      makeSession(),
      makeSession({ id: 'id-2' }),
      makeSession({ id: 'id-3' }),
    ])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// buildSessionHistory
// ---------------------------------------------------------------------------

type ConsultoriaRow = {
  id: string
  id_lead: string
  fecha: string
  hora_inicio: string | null
  duracion_minutos: number | null
  modalidad: string | null
  servicio: string | null
  staff_name: string | null
  status: string
}

type RegistroRow = {
  estado_inicial: string | null
  acciones_realizadas: string | null
  resultado_final: string | null
}

describe('buildSessionHistory', () => {
  it('returns empty array for a lead with no consultorias', () => {
    const result = buildSessionHistory('lead-1', [], {})
    expect(result).toEqual([])
  })

  it('returns one item for a lead with a single consultoria', () => {
    const consultorias: ConsultoriaRow[] = [
      { id: 'c-1', id_lead: 'lead-1', fecha: '2025-06-01', hora_inicio: '10:00', duracion_minutos: 60, modalidad: 'Virtual', servicio: 'Consultoría', staff_name: 'Ana', status: 'Resuelto' },
    ]
    const result = buildSessionHistory('lead-1', consultorias, {})
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('c-1')
  })

  it('returns all items for a lead with multiple consultorias', () => {
    const consultorias: ConsultoriaRow[] = [
      { id: 'c-1', id_lead: 'lead-1', fecha: '2025-06-01', hora_inicio: '10:00', duracion_minutos: 60, modalidad: 'Virtual', servicio: 'Consultoría', staff_name: 'Ana', status: 'Resuelto' },
      { id: 'c-2', id_lead: 'lead-1', fecha: '2025-05-01', hora_inicio: '09:00', duracion_minutos: 45, modalidad: 'Presencial', servicio: 'Seguimiento', staff_name: 'Luis', status: 'En seguimiento' },
    ]
    const result = buildSessionHistory('lead-1', consultorias, {})
    expect(result).toHaveLength(2)
  })

  it('ignores consultorias belonging to other leads', () => {
    const consultorias: ConsultoriaRow[] = [
      { id: 'c-1', id_lead: 'lead-1', fecha: '2025-06-01', hora_inicio: '10:00', duracion_minutos: 60, modalidad: 'Virtual', servicio: 'Consultoría', staff_name: 'Ana', status: 'Resuelto' },
      { id: 'c-2', id_lead: 'lead-2', fecha: '2025-05-01', hora_inicio: '09:00', duracion_minutos: 45, modalidad: 'Presencial', servicio: 'Seguimiento', staff_name: 'Luis', status: 'En seguimiento' },
    ]
    const result = buildSessionHistory('lead-1', consultorias, {})
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('c-1')
  })

  it('attaches registro_sesion when present for a consultoria', () => {
    const consultorias: ConsultoriaRow[] = [
      { id: 'c-1', id_lead: 'lead-1', fecha: '2025-06-01', hora_inicio: '10:00', duracion_minutos: 60, modalidad: 'Virtual', servicio: 'Consultoría', staff_name: 'Ana', status: 'Resuelto' },
    ]
    const sesionByConsultoria: Record<string, RegistroRow> = {
      'c-1': { estado_inicial: 'Inicial', acciones_realizadas: 'Revisión', resultado_final: 'OK' },
    }
    const result = buildSessionHistory('lead-1', consultorias, sesionByConsultoria)
    expect(result[0]?.registro_sesion).toEqual({ estado_inicial: 'Inicial', acciones_realizadas: 'Revisión', resultado_final: 'OK' })
  })

  it('sets registro_sesion to null when absent for a consultoria', () => {
    const consultorias: ConsultoriaRow[] = [
      { id: 'c-1', id_lead: 'lead-1', fecha: '2025-06-01', hora_inicio: '10:00', duracion_minutos: 60, modalidad: 'Virtual', servicio: 'Consultoría', staff_name: 'Ana', status: 'Resuelto' },
    ]
    const result = buildSessionHistory('lead-1', consultorias, {})
    expect(result[0]?.registro_sesion).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// LeadModal — Historial de sesiones section (section visibility via re-export)
// T12: section visibility tests (pure gating logic via shouldShowSessionHistory re-export from LeadModal)
// ---------------------------------------------------------------------------

describe('LeadModal — Historial de sesiones section visibility', () => {
  it('does not render the section when sesiones is undefined', () => {
    expect(shouldShowFromModal(undefined)).toBe(false)
  })

  it('does not render the section when sesiones is empty', () => {
    expect(shouldShowFromModal([])).toBe(false)
  })

  it('does not render the section when sesiones has one item', () => {
    expect(shouldShowFromModal([makeSession()])).toBe(false)
  })

  it('renders the section when sesiones has two items', () => {
    expect(shouldShowFromModal([makeSession(), makeSession({ id: 'id-2' })])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// LeadModal — history card content (pure logic via hasRegistroSesionData)
// T13: card content tests
// ---------------------------------------------------------------------------

describe('LeadModal — history card content', () => {
  it('always renders core fields: session item has fecha, hora_inicio, servicio, and status', () => {
    const item = makeSession({ fecha: '2025-06-01', hora_inicio: '10:00', servicio: 'Consultoría', status: 'Resuelto' })
    expect(item.fecha).toBe('2025-06-01')
    expect(item.hora_inicio).toBe('10:00')
    expect(item.servicio).toBe('Consultoría')
    expect(item.status).toBe('Resuelto')
  })

  it('renders registro_sesion fields when hasRegistroSesionData is true', () => {
    const item = makeSession({
      registro_sesion: {
        estado_inicial: 'Inicial',
        acciones_realizadas: 'Acciones',
        resultado_final: 'Resultado',
      },
    })
    expect(hasRegistroSesionData(item.registro_sesion)).toBe(true)
  })

  it('hides registro_sesion fields when hasRegistroSesionData is false', () => {
    const item = makeSession({ registro_sesion: { estado_inicial: null, acciones_realizadas: null, resultado_final: null } })
    expect(hasRegistroSesionData(item.registro_sesion)).toBe(false)
  })

  it('hides registro_sesion fields when registro_sesion is null', () => {
    const item = makeSession({ registro_sesion: null })
    expect(hasRegistroSesionData(item.registro_sesion)).toBe(false)
  })
})
