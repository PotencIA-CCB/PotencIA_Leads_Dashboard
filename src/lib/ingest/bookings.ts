import { addMinutes, toDate, toInt, toTime } from './coerce'
import { col, normKey } from './columns'
import type {
  NormalizeResult,
  NormalizedBookingRow,
  RawRow,
  RowIssue,
} from './types'

/**
 * Encabezados mínimos que identifican el export de Microsoft Bookings.
 * Cada entrada es un grupo de variantes: basta con que una esté presente.
 *
 * Bookings localiza los encabezados según el idioma de la cuenta. n8n/WF-2 se
 * escribió contra un export en inglés, pero el que descarga la Cámara viene en
 * español, así que ambos idiomas tienen que resolver.
 */
const GRUPOS_BOOKING: readonly (readonly string[])[] = [
  ['Customer Email', 'Correo electrónico del cliente'],
  ['Date Time', 'Fecha y hora'],
]

export const EXPECTED_BOOKING_HEADERS: readonly string[] = GRUPOS_BOOKING.map((g) => g[0]!)

export function headersLookLikeBookings(headers: string[]): boolean {
  const presentes = new Set(headers.map((h) => normKey(h)))
  return GRUPOS_BOOKING.every((grupo) => grupo.some((v) => presentes.has(normKey(v))))
}

/** Parsea el .tsv crudo: tabs, sin quotes, fila 0 = encabezados. */
export function parseTsv(text: string): RawRow[] {
  const lineas = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lineas.length < 2) return []

  const encabezados = lineas[0]!.split('\t').map((h) => h.trim())

  return lineas.slice(1).map((linea) => {
    const valores = linea.split('\t')
    const fila: RawRow = {}
    encabezados.forEach((h, i) => {
      fila[h] = (valores[i] ?? '').trim()
    })
    return fila
  })
}

/**
 * `Date Time` del export colombiano viene como `DD/MM/YYYY H:MM` — día
 * primero. Delega la validación de rangos a toDate/toTime.
 */
function parseBookingDateTime(s: string): { fecha: string; hora: string } | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/)
  if (!m) return null

  const fecha = toDate(`${m[1]}/${m[2]}/${m[3]}`)
  if (fecha === null) return null

  const hora = toTime(`${m[4]}:${m[5]}`)
  if (hora === null) return null

  return { fecha, hora }
}

/** `Custom Fields` es un JSON con la modalidad elegida en el formulario. */
function extraerModalidad(customFields: string | null): 'Virtual' | 'Presencial' {
  if (customFields === null) return 'Virtual'
  try {
    const obj = JSON.parse(customFields) as Record<string, unknown>
    const valor = obj['Selecciona la Modalidad de tu sesión']
    return typeof valor === 'string' && /presencial/i.test(valor) ? 'Presencial' : 'Virtual'
  } catch {
    return 'Virtual'
  }
}

export function normalizeBookingRow(
  raw: RawRow,
  fila: number,
): NormalizeResult<NormalizedBookingRow> {
  const errores: RowIssue[] = []
  const avisos: RowIssue[] = []

  const emailRaw = col(raw, 'Customer Email', 'Correo electrónico del cliente')
  const email = emailRaw === null ? null : emailRaw.toLowerCase()
  if (email === null || !email.includes('@')) {
    errores.push({ fila, severidad: 'error', motivo: 'Correo del cliente ausente o inválido' })
  }

  const dtRaw = col(raw, 'Date Time', 'Fecha y hora')
  const dt = dtRaw === null ? null : parseBookingDateTime(dtRaw)
  if (dt === null) {
    errores.push({
      fila,
      severidad: 'error',
      motivo: dtRaw === null
        ? 'Falta la fecha y hora de la reserva'
        : 'Fecha y hora de la reserva ilegible',
    })
  }

  if (errores.length > 0 || email === null || dt === null) {
    return { ok: false, fila, errores }
  }

  const duracion = toInt(col(raw, 'Duration (mins.)', 'Duration', 'Duración (min)', 'Duración'))
  if (duracion === null) {
    avisos.push({
      fila,
      severidad: 'aviso',
      motivo: 'Sin duración en el archivo: no se pudo calcular la hora de fin',
    })
  }

  const staffEmailRaw = col(raw, 'Staff Email', 'Correo electrónico de personal')
  const staffEmail = staffEmailRaw === null ? null : staffEmailRaw.toLowerCase()
  const staffName = col(raw, 'Staff Name', 'Staff', 'Nombre de personal', 'Personal')
  if (staffEmail === null && staffName === null) {
    avisos.push({
      fila,
      severidad: 'aviso',
      motivo: 'La reserva no trae staff: la consultoría quedará sin consultor asignado',
    })
  }

  const bookingId = col(raw, 'Booking Id', 'Id. de reserva')
  const servicio = col(raw, 'Service', 'Servicio')

  return {
    ok: true,
    avisos,
    row: {
      fila,
      clave: bookingId ?? `${email}|${dt.fecha}|${dt.hora}`,
      lead: {
        p_email: email,
        p_nombre_completo: col(raw, 'Customer Name', 'Nombre del cliente') ?? 'Sin nombre',
        p_phone: col(raw, 'Customer Phone', 'Teléfono del cliente'),
        p_id_num: null,
        p_nit: null,
        p_city: null,
        p_cargo: null,
        p_company_role_level: null,
        p_company_role_area: null,
        p_sector: null,
        p_empresa: null,
        p_sexo: null,
        p_booking_email: email,
        p_booking_customer_id: bookingId,
        p_origen: 'booking',
      },
      consultoria: {
        booking_id: bookingId,
        fecha: dt.fecha,
        hora_inicio: dt.hora,
        hora_fin: addMinutes(dt.hora, duracion),
        duracion_minutos: duracion,
        modalidad: extraerModalidad(col(raw, 'Custom Fields', 'Campos personalizados')),
        servicio,
        staff_name: staffName,
        staff_email: staffEmail,
        nivel_potencia: null,
        categoria_caso: null,
        categoria_caso_uso: servicio,
        status: 'Agendado',
      },
    },
  }
}
