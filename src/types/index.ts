export type LeadStatus = 'Pendiente' | 'Agendado' | 'En seguimiento' | 'Resuelto' | 'Cancelado'

export interface Lead {
  id: string
  created_at: string
  full_name: string
  id_num: string | null
  nit: string | null
  email: string
  phone: string | null
  city: string | null
  company_role_level: string | null
  company_role_area: string | null
  solution: string | null
  use_case: string | null
  comments: string | null
  perfil_personal: boolean | null
  perfil_empresa: boolean | null
  autorizo_datos: boolean | null
  id_consultor_asignado: string | null
  status: LeadStatus
  notas_consultor: string | null
}

export interface Consultor {
  id: string
  nombre: string
  email: string
  created_at: string
}

export type SesionStatus = 'Resuelto' | 'En seguimiento' | 'Cancelado'

export interface Sesion {
  id_sesion: string
  id_lead: string
  id_consultor: string
  fecha_sesion: string
  hora_inicio: string | null
  hora_fin: string | null
  caso_de_uso: string | null
  modalidad: string | null
  descripcion_sesion: string | null
  resultados_obtenidos: string | null
  entregable: string | null
  url_video: string | null
  url_evidencias: string | null
  datos_adicionales_cliente: object | null
  status: SesionStatus
  notas_privadas: string | null
  created_at: string
}
