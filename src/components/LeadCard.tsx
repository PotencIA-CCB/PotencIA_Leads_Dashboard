'use client'

import { Lead, ConsultoriaStatus, leadFullName } from '@/types'

export type LeadCardConsultoria = {
  id: string
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  modalidad: string | null
  duracion_minutos: number | null
  servicio: string | null
  staff_name: string | null
  staff_email: string | null
  categoria_caso_uso: string | null
  id_consultor: string | null
  status: ConsultoriaStatus
  registro_sesion?: {
    estado_inicial: string | null
    acciones_realizadas: string | null
    resultado_final: string | null
  } | null
}

export type LeadCardFormulario = {
  tema: string | null
  descripcion: string | null
  fecha_registro: string | null
}

export interface SessionHistoryItem {
  id: string
  fecha: string
  hora_inicio: string | null
  duracion_minutos: number | null
  modalidad: string | null
  servicio: string | null
  staff_name: string | null
  status: ConsultoriaStatus
  registro_sesion?: {
    estado_inicial: string | null
    acciones_realizadas: string | null
    resultado_final: string | null
  } | null
}

export type LeadWithMeta = Lead & {
  formulario?: LeadCardFormulario | null
  consultoria?: LeadCardConsultoria | null
  consultor_nombre?: string | null
  sesiones?: SessionHistoryItem[]
}

/**
 * Returns true if the lead has more than one session (history is worth showing).
 * Pure function — exported for testability.
 */
export function shouldShowSessionHistory(sesiones?: SessionHistoryItem[]): boolean {
  return Array.isArray(sesiones) && sesiones.length > 1
}

interface LeadCardProps {
  lead: LeadWithMeta
  onClick: (lead: LeadWithMeta) => void
}

/**
 * Etapas del embudo. Reemplazan al status de la consultoría en el chip de la
 * card: el status describe una sesión, no al lead, y un lead con cuatro
 * consultorías tenía tantos estados como sesiones.
 */
export type EtapaLead = 'Sin actividad' | 'Registrado' | 'Agendado' | 'No asistió' | 'Resuelto'

export const ETAPAS: readonly EtapaLead[] = [
  'Sin actividad', 'Registrado', 'Agendado', 'No asistió', 'Resuelto',
]

const etapaStyle: Record<EtapaLead, { dot: string; text: string }> = {
  'Sin actividad': { dot: 'bg-slate-400',   text: 'text-slate-500' },
  Registrado:      { dot: 'bg-amber-500',   text: 'text-amber-700' },
  Agendado:        { dot: 'bg-sky-500',     text: 'text-sky-700' },
  'No asistió':    { dot: 'bg-rose-500',    text: 'text-rose-700' },
  Resuelto:        { dot: 'bg-emerald-500', text: 'text-emerald-700' },
}

/** `YYYY-MM-DD` de hoy en horario local, que es el que ve quien usa el panel. */
export function hoyYmd(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

type ConParaEtapa = { fecha: string; registro_sesion?: LeadCardConsultoria['registro_sesion'] }

/**
 * De todas las consultorías de un lead, la que representa a la card: el
 * agendamiento futuro más próximo, y si no hay ninguno, el pasado más reciente.
 *
 * Las fechas son `YYYY-MM-DD`, así que se comparan como texto: sin `Date`, sin
 * zona horaria de por medio.
 */
export function agendamientoMostrado<T extends { fecha: string }>(
  consultorias: T[],
  hoy: string,
): T | null {
  if (consultorias.length === 0) return null

  const futuras = consultorias
    .filter((c) => c.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (futuras.length > 0) return futuras[0]!

  return [...consultorias].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]!
}

/**
 * Etapa del embudo del lead, derivada de los mismos tres hechos que usa
 * `computeFunnelStats` en capturaStats.ts: si llenó el formulario, si tiene
 * consultoría y si esa consultoría tiene sesión registrada. La fecha solo
 * separa al que todavía no llegó del que no apareció.
 */
export function etapaLead(lead: LeadWithMeta, hoy: string): EtapaLead {
  const consultorias: ConParaEtapa[] =
    lead.sesiones ?? (lead.consultoria ? [lead.consultoria] : [])

  if (consultorias.some((c) => c.registro_sesion != null)) return 'Resuelto'

  const elegida = agendamientoMostrado(consultorias, hoy)
  if (elegida) return elegida.fecha >= hoy ? 'Agendado' : 'No asistió'

  return lead.formulario ? 'Registrado' : 'Sin actividad'
}

/**
 * El consultor que se muestra. Vive acá y no suelto en el render porque la
 * lista y el filtro de la página tienen que preguntar exactamente lo mismo: si
 * difieren, hay consultores visibles en las cards que el filtro no encuentra.
 */
export function consultorMostrado(lead: LeadWithMeta): string | null {
  const asignado = lead.consultor_nombre ?? null
  const staff = lead.consultoria?.staff_name ?? null

  // El origen decide a quien creerle primero: en una reserva manda el staff que
  // trajo Bookings; en el resto, la asignacion de la base. Pero siempre hay
  // respaldo: sin el, un lead con staff_name y sin id_consultor no mostraba
  // consultor y quedaba fuera del filtro aunque supieramos quien lo atendio.
  return lead.origen === 'booking' ? (staff ?? asignado) : (asignado ?? staff)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function formatSessionDate(date: string): string {
  const dt = new Date(`${date}T00:00:00`)
  const formatted = dt.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
  return formatted.replace(/\./g, '').replace(/^\w/, (c) => c.toUpperCase())
}

function daysAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86400000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Hace 1 día'
  if (days < 30) return `Hace ${days} días`
  const months = Math.floor(days / 30)
  return months === 1 ? 'Hace 1 mes' : `Hace ${months} meses`
}

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  const etapa = etapaLead(lead, hoyYmd())
  const status = etapaStyle[etapa]
  const con = lead.consultoria
  const form = lead.formulario
  const fullName = leadFullName(lead)
  const initials = getInitials(fullName)

  const casoDeUso = con?.categoria_caso_uso ?? form?.tema ?? form?.descripcion ?? null
  const displayConsultor = consultorMostrado(lead)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(lead)
    }
  }

  return (
    <article
      onClick={() => onClick(lead)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalles de ${fullName}`}
      className="relative bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 border border-slate-300 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] cursor-pointer overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <div
          className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-slate-400 via-slate-500 to-slate-700 text-white flex items-center justify-center font-bold text-sm shadow-[0_1px_2px_rgba(15,23,42,0.15),inset_0_1px_0_rgba(255,255,255,0.25)]"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="text-[15px] font-semibold text-slate-800 truncate leading-tight"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            title={fullName}
          >
            {fullName}
          </h3>
          <span className={`inline-flex items-center gap-1.5 mt-1 text-[10px] font-semibold uppercase tracking-wider ${status.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {etapa}
          </span>
        </div>

        {(con || form) && (
          <div className="shrink-0 flex items-center gap-1">
            {con && (
              <span
                className="material-symbols-outlined text-[16px] text-sky-600"
                title="Tiene agendamiento de Microsoft Bookings"
                aria-label="Tiene agendamiento"
              >
                event_available
              </span>
            )}
            {form && (
              <span
                className="material-symbols-outlined text-[16px] text-emerald-600"
                title="Completó el formulario de PotencIA"
                aria-label="Completó formulario"
              >
                description
              </span>
            )}
          </div>
        )}
      </div>


      {/* Body — at-a-glance rows */}
      {(casoDeUso || con || lead.phone) && (
        <div className="px-5 pb-4 flex flex-col gap-2">

          {casoDeUso && (
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-500 mt-0.5 shrink-0" aria-hidden="true">category</span>
              <p className="text-[14px] font-medium text-slate-800 leading-snug line-clamp-2" title={casoDeUso}>
                {casoDeUso}
              </p>
            </div>
          )}

          {con && (
            <div className="flex items-center gap-2 text-[12px] text-slate-600 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-slate-500" aria-hidden="true">calendar_month</span>
                <span className="font-medium text-slate-700">{formatSessionDate(con.fecha)}</span>
              </span>
              {con.hora_inicio && (
                <>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span>{con.hora_inicio}</span>
                </>
              )}
              {displayConsultor && (
                <>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 truncate" title={displayConsultor}>
                    <span className="material-symbols-outlined text-[14px] text-slate-500" aria-hidden="true">person</span>
                    <span className="truncate">{displayConsultor}</span>
                  </span>
                </>
              )}
            </div>
          )}

          {lead.phone && (
            <div className="flex items-center gap-2 text-[12px] text-slate-600">
              <span className="material-symbols-outlined text-[14px] text-slate-500 shrink-0" aria-hidden="true">phone</span>
              <span className="truncate" title={lead.phone}>{lead.phone}</span>
            </div>
          )}

        </div>
      )}

      <div className="flex-1" />

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-300/60 bg-slate-200/30 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-medium">{daysAgo(con?.fecha ?? form?.fecha_registro ?? lead.created_at)}</span>
        <span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
          Ver detalle
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            arrow_forward
          </span>
        </span>
      </div>
    </article>
  )
}
