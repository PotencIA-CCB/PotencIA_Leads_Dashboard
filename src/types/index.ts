export type LeadOrigen = 'landing' | 'booking' | 'sesion' | 'ambos'

export interface Lead {
  id: string
  created_at: string
  updated_at: string
  nombre_completo: string | null
  id_num: string | null
  nit: string | null
  email: string
  phone: string | null
  city: string | null
  cargo: string | null
  company_role_level: string | null
  company_role_area: string | null
  sector: string | null
  empresa: string | null
  sexo: string | null
  booking_customer_id: string | null
  phone_normalized: string | null
  origen: LeadOrigen
  nit_validado_rues: boolean
  renovado_2026: boolean
}

export function leadFullName(lead: Pick<Lead, 'nombre_completo'>): string {
  return lead.nombre_completo || 'Sin nombre'
}

export interface FormularioLanding {
  id: string
  created_at: string
  id_lead: string
  tema: string | null
  descripcion: string | null
  perfil: string | null
  tratamiento_datos: boolean | null
  aceptacion: boolean | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  fecha_registro: string | null
}

export interface Consultor {
  id: string
  created_at: string
  nombre: string
  identificacion: string | null
  email: string | null
  email_institucional: string | null
  rol: 'admin' | 'consultor'
  auth_id: string | null
  activo: boolean
}

export type ConsultoriaStatus = 'Pendiente' | 'Agendado' | 'En seguimiento' | 'Resuelto' | 'Cancelado' | 'Escalar' | 'No asistió'

export interface Consultoria {
  id: string
  created_at: string
  updated_at: string
  id_lead: string
  id_consultor: string | null
  booking_id: string | null
  id_externo: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  duracion_minutos: number | null
  modalidad: 'Virtual' | 'Presencial' | null
  servicio: string | null
  ubicacion: string | null
  staff_name: string | null
  staff_email: string | null
  nivel_potencia: string | null
  categoria_caso: string | null
  categoria_caso_uso: string | null
  status: ConsultoriaStatus
}

export interface Insight {
  id: string
  created_at: string
  tipo: string
  periodo_inicio: string | null
  periodo_fin: string | null
  metrica: string | null
  valor_numerico: number | null
  valor_texto: string | null
  descripcion: string | null
  fuente: string | null
  id_consultor: string | null
}

export interface RegistroSesion {
  id: string
  created_at: string
  id_consultoria: string
  pregunta: string | null
  motivo_consulta: string | null
  estado_inicial: string | null
  acciones_realizadas: string | null
  resultado_final: string | null
  estimacion_impacto: string | null
  entregables: string | null
  resultado: string | null
  cantidad_productos: number
  sesion_grabada: boolean
  enlace_grabacion: string | null
  adjuntar_evidencia: string | null
  confirmo_no_automatizacion: boolean | null
}

export type NovedadTipo =
  | 'caso_de_uso'
  | 'mejora'
  | 'incidencia'
  | 'logro'
  | 'sugerencia'
  | 'otro'
  | 'evento'
  | 'ausencia'

export interface Novedad {
  id: string
  created_at: string
  updated_at: string
  id_consultor: string
  id_lead: string | null
  id_consultoria: string | null
  titulo: string
  contenido: string
  tipo: NovedadTipo
  /** Fecha del evento/ausencia (null para publicaciones sin fecha). */
  fecha_inicio: string | null
  /** Fin del rango, para eventos de varios días (null si es un solo día o sin fecha). */
  fecha_fin: string | null
  indicadores: Record<string, unknown>
}

export interface ErrorLog {
  id: string
  created_at: string
  workflow: string
  severity: string
  error_msg: string | null
  raw_row: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}
