import type { ConsultoriaStatus } from '@/types'

/** Una fila cruda parseada del archivo: pares encabezado → valor. */
export type RawRow = Record<string, unknown>

export type TipoCarga = 'bookings' | 'sesiones'

/** Un error bloquea la fila; un aviso la deja pasar y se reporta. */
export type Severidad = 'error' | 'aviso'

export interface RowIssue {
  /** 1-indexado respecto al archivo, contando el encabezado como fila 1. */
  fila: number
  severidad: Severidad
  /** Legible en español. NUNCA incluye datos personales de la fila. */
  motivo: string
}

/** Parámetros del RPC match_or_create_lead. */
export interface LeadInput {
  p_email: string
  p_nombre_completo: string
  p_phone: string | null
  p_id_num: string | null
  p_nit: string | null
  p_city: string | null
  p_cargo: string | null
  p_company_role_level: string | null
  p_company_role_area: string | null
  p_sector: string | null
  p_empresa: string | null
  p_sexo: string | null
  p_booking_email: string | null
  p_booking_customer_id: string | null
  p_origen: 'booking' | 'sesion'
}

export interface ConsultoriaInput {
  booking_id: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  duracion_minutos: number | null
  modalidad: 'Virtual' | 'Presencial'
  servicio: string | null
  staff_name: string | null
  staff_email: string | null
  nivel_potencia: string | null
  categoria_caso: string | null
  categoria_caso_uso: string | null
  /** null = no modificar el status existente (resultado de sesión vacío). */
  status: ConsultoriaStatus | null
}

export interface RegistroInput {
  id_externo: string | null
  pregunta: string | null
  motivo_consulta: string | null
  estado_inicial: string | null
  acciones_realizadas: string | null
  resultado_final: string | null
  estimacion_impacto: string | null
  entregables: string | null
  cantidad_productos: number
  sesion_grabada: boolean
  enlace_grabacion: string | null
  adjuntar_evidencia: string | null
  confirmo_no_automatizacion: boolean | null
  resultado: string | null
  duracion_sesion_minutos: number | null
}

export interface NormalizedBookingRow {
  fila: number
  /** Booking Id, o `email|fecha|hora` como fallback. Solo para trazabilidad. */
  clave: string
  lead: LeadInput
  consultoria: ConsultoriaInput
}

export interface NormalizedSesionRow {
  fila: number
  /** Columna `Id` del Excel, o `email|fecha` como fallback. */
  clave: string
  lead: LeadInput
  consultoria: ConsultoriaInput
  registro: RegistroInput
}

export type NormalizeResult<T> =
  | { ok: true; row: T; avisos: RowIssue[] }
  | { ok: false; fila: number; errores: RowIssue[] }

/** Lo que devuelve el RPC por cada fila del lote. */
export interface FilaResultado {
  fila: number
  accion: 'creada' | 'actualizada' | null
  aviso: string | null
  error: string | null
}

export interface CargaRequest {
  accion: 'preview' | 'commit'
  tipo: TipoCarga
  /** Filas CRUDAS. El servidor las normaliza él mismo: es la autoridad. */
  filas: RawRow[]
}

export interface CargaResponse {
  creadas: number
  actualizadas: number
  fallidas: Array<{ fila: number; motivo: string }>
  avisos: Array<{ fila: number; motivo: string }>
}
