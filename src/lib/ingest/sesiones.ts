import type { ConsultoriaStatus } from '@/types'
import { toBool, toDate, toInt, toTime } from './coerce'
import { col, normKey } from './columns'
import type {
  NormalizeResult,
  NormalizedSesionRow,
  RawRow,
  RowIssue,
} from './types'

/**
 * Encabezados mínimos que identifican el Excel de registro de sesión.
 * Cada entrada es un grupo de variantes: basta con que una esté presente.
 */
const GRUPOS_SESION: readonly (readonly string[])[] = [
  ['Fecha de la Sesión', 'Fecha', 'fecha_sesion'],
  ['Correo del Usuario Atendido', 'Correo electrónico', 'email'],
]

export const EXPECTED_SESION_HEADERS: readonly string[] = GRUPOS_SESION.map((g) => g[0]!)

export function headersLookLikeSesiones(headers: string[]): boolean {
  const presentes = new Set(headers.map((h) => normKey(h)))
  return GRUPOS_SESION.every((grupo) => grupo.some((v) => presentes.has(normKey(v))))
}

/**
 * Mapea el texto libre de `Resultado de la sesión` a uno de los 7 estados.
 *
 * El orden importa: los patrones más específicos van primero, para que
 * "No asistió, queda en seguimiento" resuelva a 'No asistió'.
 *
 * Unifica los dos mapeos incompatibles de n8n/WF-3 (`Normalize Rows` producía
 * 3 estados, `Map Session Status` producía 5 y devolvía null al no coincidir).
 */
const PATRONES_STATUS: readonly (readonly [string, ConsultoriaStatus])[] = [
  ['cancelad', 'Cancelado'],
  ['no asisti', 'No asistió'],
  ['escalar', 'Escalar'],
  ['seguimiento', 'En seguimiento'],
  ['resuelto', 'Resuelto'],
]

export function mapResultadoAStatus(resultado: string | null): ConsultoriaStatus | null {
  const texto = (resultado ?? '').trim().toLowerCase()
  if (texto === '') return null

  for (const [patron, status] of PATRONES_STATUS) {
    if (texto.includes(patron)) return status
  }

  // Hay texto pero no coincide con ningún patrón: la sesión ocurrió.
  return 'Resuelto'
}

function normalizarModalidad(raw: string | null): 'Virtual' | 'Presencial' {
  if (raw === null) return 'Virtual'
  return /presencial/i.test(raw) ? 'Presencial' : 'Virtual'
}

export function normalizeSesionRow(
  raw: RawRow,
  fila: number,
): NormalizeResult<NormalizedSesionRow> {
  const errores: RowIssue[] = []
  const avisos: RowIssue[] = []

  const emailRaw = col(raw, 'Correo del Usuario Atendido', 'Correo electrónico', 'email')
  const email = emailRaw === null ? null : emailRaw.toLowerCase()
  if (email === null || !email.includes('@')) {
    errores.push({ fila, severidad: 'error', motivo: 'Correo del usuario atendido ausente o inválido' })
  }

  const fechaRaw = col(raw, 'Fecha de la Sesión', 'Fecha', 'fecha_sesion')
  const fecha = toDate(fechaRaw)
  if (fecha === null) {
    errores.push({
      fila,
      severidad: 'error',
      motivo: fechaRaw === null
        ? 'Falta la fecha de la sesión'
        : 'Fecha de la sesión ilegible',
    })
  }

  if (errores.length > 0 || email === null || fecha === null) {
    return { ok: false, fila, errores }
  }

  const duracion = toInt(col(raw, 'Duración de la Sesión / Minutos', 'Duración de la sesión', 'duracion'))
  const resultado = col(raw, 'Resultado de la sesión', 'resultado')
  const status = mapResultadoAStatus(resultado)

  if (status === null) {
    avisos.push({
      fila,
      severidad: 'aviso',
      motivo: 'Sin resultado de la sesión: el estado de la consultoría no se modifica',
    })
  }

  const staffEmailRaw = col(raw, 'Correo Institucional / Consultor', 'staff_email')
  const staffEmail = staffEmailRaw === null ? null : staffEmailRaw.toLowerCase()
  const staffName = col(raw, 'Consultor / Coder', 'staff_name')
  if (staffEmail === null && staffName === null) {
    avisos.push({
      fila,
      severidad: 'aviso',
      motivo: 'La sesión no trae consultor: la consultoría quedará sin consultor asignado',
    })
  }

  const idExterno = col(raw, 'Id', 'id')

  return {
    ok: true,
    avisos,
    row: {
      fila,
      clave: idExterno ?? `${email}|${fecha}`,
      lead: {
        p_email: email,
        p_nombre_completo: col(raw, 'Nombre del Usuario Atendido', 'Nombre', 'full_name') ?? 'Sin nombre',
        p_phone: col(raw, 'Celular del usuario atendido', 'Celular', 'phone'),
        p_id_num: col(raw, 'Cedula del Usuario Atendido', 'Documento de identidad'),
        p_nit: col(raw, 'Nit de la Empresa', 'NIT'),
        p_city: col(raw, 'Municipio', 'city'),
        p_cargo: col(raw, 'Cargo del Usuario Atendido', 'cargo'),
        p_company_role_level: col(raw, 'Nivel del Cargo', 'company_role_level'),
        p_company_role_area: col(raw, 'Área del Usuario Atendido', 'company_role_area'),
        p_sector: null,
        p_empresa: col(raw, 'Nombre de la empresa', 'empresa'),
        p_sexo: col(raw, 'Sexo Usuario Atendido', 'Sexo'),
        p_booking_email: null,
        p_booking_customer_id: null,
        p_origen: 'sesion',
      },
      consultoria: {
        booking_id: null,
        fecha,
        hora_inicio: toTime(col(raw, 'Hora de inicio', 'hora_inicio')),
        hora_fin: toTime(col(raw, 'Hora de finalización', 'hora_fin')),
        duracion_minutos: duracion,
        modalidad: normalizarModalidad(col(raw, 'Modalidad de la Sesión', 'modalidad')),
        servicio: null,
        staff_name: staffName,
        staff_email: staffEmail,
        nivel_potencia: col(raw, 'Nivel de potencia', 'Nivel de Potencia'),
        categoria_caso: col(raw, 'Categoría del caso', 'Categoría del Caso (Potencia)'),
        categoria_caso_uso: col(raw, 'Categoria del Caso de Uso', 'categoria_caso_uso'),
        status,
      },
      registro: {
        id_externo: idExterno,
        pregunta: col(raw, 'Pregunta', 'pregunta'),
        motivo_consulta: col(raw, 'Motivo de la Consulta', 'Motivo Consulta', 'motivo_consulta'),
        estado_inicial: col(raw, 'Estado Inicial', 'estado_inicial'),
        acciones_realizadas: col(raw, 'Acciones Realizadas Durante la Sesión', 'acciones_realizadas'),
        resultado_final: col(raw, 'Resultado Final', 'resultado_final'),
        estimacion_impacto: col(raw, 'Estimación del Impacto Generado', 'Estimacion del Impacto Generado', 'estimacion_impacto'),
        entregables: col(raw, 'Entregables Producidos', 'entregables'),
        cantidad_productos: toInt(col(raw, 'Cantidad de nuevos productos creados', 'cantidad_productos')) ?? 0,
        sesion_grabada: toBool(col(raw, '¿La sesión fue grabada?', 'sesion_grabada')),
        enlace_grabacion: col(raw, 'Enlace de Grabación', 'enlace_grabacion'),
        adjuntar_evidencia: col(raw, 'Adjuntar Evidencia', 'adjuntar_evidencia'),
        confirmo_no_automatizacion: toBool(
          col(
            raw,
            'Confirmo que este caso NO corresponde a automatización o integración de sistemas complejos.',
            'Confirmo que este caso NO corresponde a automatización',
            'confirmo_no_automatizacion',
          ),
        ),
        resultado,
        duracion_sesion_minutos: duracion,
      },
    },
  }
}
