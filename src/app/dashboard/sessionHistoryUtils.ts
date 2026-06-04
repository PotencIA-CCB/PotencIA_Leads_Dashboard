import type { SessionHistoryItem } from '@/components/LeadCard'
import type { ConsultoriaStatus } from '@/types'

/**
 * Minimal shape expected from each consultoria row for history building.
 * Kept loose so it stays compatible with the Supabase query result type.
 */
export type ConsultoriaRowForHistory = {
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

export type RegistroSesionRow = {
  estado_inicial: string | null
  acciones_realizadas: string | null
  resultado_final: string | null
}

/**
 * Builds the session history list for a single lead from already-fetched data.
 * No Supabase queries. Pure function — exported for testability.
 *
 * @param leadId           The lead's id to filter consultorias by.
 * @param consultorias     All consultoria rows (already ordered newest-first from Supabase).
 * @param sesionByConsId   Map of consultoria id → registro_sesion data.
 */
export function buildSessionHistory(
  leadId: string,
  consultorias: ConsultoriaRowForHistory[],
  sesionByConsId: Record<string, RegistroSesionRow | null | undefined>,
): SessionHistoryItem[] {
  return consultorias
    .filter((c) => c.id_lead === leadId)
    .map((c) => ({
      id: c.id,
      fecha: c.fecha,
      hora_inicio: c.hora_inicio,
      duracion_minutos: c.duracion_minutos,
      modalidad: c.modalidad,
      servicio: c.servicio,
      staff_name: c.staff_name,
      status: c.status as ConsultoriaStatus,
      registro_sesion: sesionByConsId[c.id] ?? null,
    }))
}
