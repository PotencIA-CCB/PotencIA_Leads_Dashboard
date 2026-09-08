/**
 * Normalizador del .tsv de Microsoft Bookings.
 *
 * Reemplaza los nodos `Parse TSV Direct` y `Transform Bookings Row` de
 * n8n/WF-2. Correcciones deliberadas respecto a WF-2:
 *   - WF-2 solo filtraba por correo presente: una fecha ilegible producía
 *     fecha: null, que viola el NOT NULL de consultorias.fecha sin reporte
 *   - WF-2 aceptaba mes > 12 sin validar
 *   - WF-2 calculaba hora_fin con new Date + getHours (dependiente de TZ)
 */
import { describe, it, expect } from 'vitest'
import {
  parseTsv,
  headersLookLikeBookings,
  normalizeBookingRow,
} from '../bookings'

const HEADERS = [
  'Date Time',
  'Customer Name',
  'Customer Email',
  'Customer Phone',
  'Staff Name',
  'Staff Email',
  'Service',
  'Duration (mins.)',
  'Booking Id',
  'Custom Fields',
].join('\t')

function fila(valores: Partial<Record<string, string>> = {}): Record<string, unknown> {
  return {
    'Date Time': '15/09/2026 14:30',
    'Customer Name': 'Ana Pérez',
    'Customer Email': 'ana@empresa.com',
    'Customer Phone': '+57 300 1234567',
    'Staff Name': 'Carlos Consultor',
    'Staff Email': 'carlos@camarabaq.org.co',
    'Service': 'Consultoría PotencIA',
    'Duration (mins.)': '60',
    'Booking Id': 'BK-001',
    'Custom Fields': '',
    ...valores,
  }
}

describe('parseTsv', () => {
  it('usa la fila 0 como encabezados y devuelve un objeto por fila de datos', () => {
    const texto = `${HEADERS}\n15/09/2026 14:30\tAna Pérez\tana@empresa.com\t3001234567\tCarlos\tcarlos@x.co\tConsultoría\t60\tBK-001\t`
    const filas = parseTsv(texto)
    expect(filas).toHaveLength(1)
    expect(filas[0]!['Customer Email']).toBe('ana@empresa.com')
    expect(filas[0]!['Booking Id']).toBe('BK-001')
  })

  it('descarta líneas vacías', () => {
    const texto = `${HEADERS}\n\n15/09/2026 14:30\tAna\ta@x.com\t\t\t\t\t\t\t\n\n`
    expect(parseTsv(texto)).toHaveLength(1)
  })

  it('tolera líneas con menos columnas que encabezados', () => {
    const texto = `${HEADERS}\n15/09/2026 14:30\tAna\ta@x.com`
    const filas = parseTsv(texto)
    expect(filas[0]!['Customer Email']).toBe('a@x.com')
    expect(filas[0]!['Booking Id']).toBe('')
  })

  it('devuelve vacío si no hay filas de datos', () => {
    expect(parseTsv(HEADERS)).toEqual([])
    expect(parseTsv('')).toEqual([])
  })

  it('acepta terminaciones de línea CRLF', () => {
    const texto = `${HEADERS}\r\n15/09/2026 14:30\tAna\ta@x.com\r\n`
    expect(parseTsv(texto)).toHaveLength(1)
  })
})

describe('headersLookLikeBookings', () => {
  it('reconoce los encabezados del export de Bookings', () => {
    expect(headersLookLikeBookings(HEADERS.split('\t'))).toBe(true)
  })

  it('rechaza los encabezados del Excel de registro de sesión', () => {
    const sesion = ['Id', 'Fecha de la Sesión', 'Correo del Usuario Atendido', 'Pregunta']
    expect(headersLookLikeBookings(sesion)).toBe(false)
  })

  it('rechaza una lista vacía', () => {
    expect(headersLookLikeBookings([])).toBe(false)
  })
})

describe('normalizeBookingRow', () => {
  it('normaliza una fila completa', () => {
    const r = normalizeBookingRow(fila(), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.fila).toBe(2)
    expect(r.row.clave).toBe('BK-001')
    expect(r.row.lead.p_email).toBe('ana@empresa.com')
    expect(r.row.lead.p_booking_email).toBe('ana@empresa.com')
    expect(r.row.lead.p_booking_customer_id).toBe('BK-001')
    expect(r.row.lead.p_nombre_completo).toBe('Ana Pérez')
    expect(r.row.lead.p_origen).toBe('booking')
    expect(r.row.consultoria.fecha).toBe('2026-09-15')
    expect(r.row.consultoria.hora_inicio).toBe('14:30')
    expect(r.row.consultoria.hora_fin).toBe('15:30')
    expect(r.row.consultoria.duracion_minutos).toBe(60)
    expect(r.row.consultoria.booking_id).toBe('BK-001')
    expect(r.row.consultoria.servicio).toBe('Consultoría PotencIA')
    expect(r.row.consultoria.status).toBe('Agendado')
    expect(r.avisos).toEqual([])
  })

  it('baja el correo a minúsculas', () => {
    const r = normalizeBookingRow(fila({ 'Customer Email': 'ANA@Empresa.COM' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.lead.p_email).toBe('ana@empresa.com')
  })

  it('acepta un día mayor a 12 (formato colombiano)', () => {
    const r = normalizeBookingRow(fila({ 'Date Time': '25/09/2026 09:00' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.fecha).toBe('2026-09-25')
  })

  it('rechaza la fila con mes mayor a 12', () => {
    const r = normalizeBookingRow(fila({ 'Date Time': '31/13/2026 10:00' }), 51)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.fila).toBe(51)
    expect(r.errores.some((e) => /ilegible/i.test(e.motivo))).toBe(true)
  })

  it('rechaza la fila sin correo', () => {
    const r = normalizeBookingRow(fila({ 'Customer Email': '' }), 34)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errores.some((e) => /correo/i.test(e.motivo))).toBe(true)
  })

  it('rechaza la fila con correo sin arroba', () => {
    const r = normalizeBookingRow(fila({ 'Customer Email': 'ana.empresa.com' }), 34)
    expect(r.ok).toBe(false)
  })

  it('nunca incluye datos personales en el motivo del error', () => {
    const r = normalizeBookingRow(fila({ 'Customer Email': 'ana.perez@empresa.com' , 'Date Time': 'xx' }), 34)
    expect(r.ok).toBe(false)
    if (r.ok) return
    for (const e of r.errores) {
      expect(e.motivo).not.toContain('ana.perez@empresa.com')
      expect(e.motivo).not.toContain('Ana Pérez')
    }
  })

  it('extrae modalidad Presencial de Custom Fields', () => {
    const cf = JSON.stringify({ 'Selecciona la Modalidad de tu sesión': 'Presencial en sede' })
    const r = normalizeBookingRow(fila({ 'Custom Fields': cf }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Presencial')
  })

  it('extrae modalidad Virtual de Custom Fields', () => {
    const cf = JSON.stringify({ 'Selecciona la Modalidad de tu sesión': 'Virtual por Teams' })
    const r = normalizeBookingRow(fila({ 'Custom Fields': cf }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Virtual')
  })

  it('resuelve a Virtual con Custom Fields ausente', () => {
    const r = normalizeBookingRow(fila({ 'Custom Fields': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Virtual')
  })

  it('resuelve a Virtual con Custom Fields que no es JSON válido', () => {
    const r = normalizeBookingRow(fila({ 'Custom Fields': '{no json' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Virtual')
  })

  it('calcula hora_fin cruzando la medianoche', () => {
    const r = normalizeBookingRow(fila({ 'Date Time': '15/09/2026 23:45', 'Duration (mins.)': '30' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.hora_fin).toBe('00:15')
  })

  it('deja hora_fin en null y avisa cuando falta la duración', () => {
    const r = normalizeBookingRow(fila({ 'Duration (mins.)': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.hora_fin).toBeNull()
    expect(r.row.consultoria.duracion_minutos).toBeNull()
    expect(r.avisos.some((a) => /duraci/i.test(a.motivo))).toBe(true)
  })

  it('avisa cuando la reserva no trae staff, sin bloquear la fila', () => {
    const r = normalizeBookingRow(fila({ 'Staff Name': '', 'Staff Email': '' }), 97)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.staff_email).toBeNull()
    expect(r.row.consultoria.staff_name).toBeNull()
    expect(r.avisos.some((a) => a.severidad === 'aviso' && /staff/i.test(a.motivo))).toBe(true)
  })

  it('usa la clave de fallback cuando falta el Booking Id', () => {
    const r = normalizeBookingRow(fila({ 'Booking Id': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.clave).toBe('ana@empresa.com|2026-09-15|14:30')
    expect(r.row.consultoria.booking_id).toBeNull()
  })

  it('copia Service en servicio y en categoria_caso_uso', () => {
    const r = normalizeBookingRow(fila(), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.servicio).toBe('Consultoría PotencIA')
    expect(r.row.consultoria.categoria_caso_uso).toBe('Consultoría PotencIA')
  })

  it('baja el staff_email a minúsculas', () => {
    const r = normalizeBookingRow(fila({ 'Staff Email': 'Carlos@CamaraBAQ.ORG.CO' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.staff_email).toBe('carlos@camarabaq.org.co')
  })
})
