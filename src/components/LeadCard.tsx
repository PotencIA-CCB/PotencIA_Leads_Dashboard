'use client'

import { Lead, LeadStatus } from '@/types'
import { formatUseCase } from '@/lib/format'

export type LeadCardSesion = {
  fecha_sesion: string
  hora_inicio: string | null
  hora_fin: string | null
  modalidad: string | null
  created_at: string
}

export type LeadWithMeta = Lead & {
  sesion?: LeadCardSesion | null
  consultor_nombre?: string | null
}

interface LeadCardProps {
  lead: LeadWithMeta
  onClick: (lead: LeadWithMeta) => void
}

const statusStyle: Record<LeadStatus, { dot: string; label: string; text: string }> = {
  Pendiente:        { dot: 'bg-amber-500',    label: 'Pendiente',      text: 'text-amber-700' },
  Agendado:         { dot: 'bg-sky-500',      label: 'Agendado',       text: 'text-sky-700' },
  'En seguimiento': { dot: 'bg-indigo-500',   label: 'En seguimiento', text: 'text-indigo-700' },
  Resuelto:         { dot: 'bg-emerald-500',  label: 'Resuelto',       text: 'text-emerald-700' },
  Cancelado:        { dot: 'bg-slate-400',    label: 'Cancelado',      text: 'text-slate-500' },
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

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)
  if (minutes < 60) return `Hace ${Math.max(minutes, 1)}m`
  if (hours < 24) return `Hace ${hours}h`
  if (days === 1) return 'Ayer'
  if (days < 30) return `Hace ${days}d`
  const months = Math.floor(days / 30)
  return months === 1 ? 'Hace 1 mes' : `Hace ${months} meses`
}

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  const status = statusStyle[lead.status]
  const sesion = lead.sesion
  const initials = getInitials(lead.full_name)

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
      aria-label={`Ver detalles de ${lead.full_name}`}
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
            title={lead.full_name}
          >
            {lead.full_name}
          </h3>
          <span className={`inline-flex items-center gap-1.5 mt-1 text-[10px] font-semibold uppercase tracking-wider ${status.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>
      </div>

      {/* Caso de uso — texto plano, jerarquía baja */}
      {lead.use_case && (
        <div className="px-5 pb-4">
          <p
            className="text-[13px] text-slate-600 italic leading-snug line-clamp-2 border-l-2 border-slate-300 pl-3"
            title={formatUseCase(lead.use_case)}
          >
            “{formatUseCase(lead.use_case)}”
          </p>
        </div>
      )}

      {/* Agendamiento callout — only if has session */}
      {sesion ? (
        <div className="mx-5 mb-5 rounded-xl bg-white/70 backdrop-blur-sm border border-slate-200 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="material-symbols-outlined text-[14px] text-slate-500" aria-hidden="true">
              event_available
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Agendamiento
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-base font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              {formatSessionDate(sesion.fecha_sesion)}
            </span>
            {sesion.hora_inicio && (
              <span className="text-sm text-slate-600 font-medium">
                {sesion.hora_inicio}
                {sesion.hora_fin ? ` – ${sesion.hora_fin}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            {sesion.modalidad && (
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">videocam</span>
                {sesion.modalidad}
              </span>
            )}
            {sesion.modalidad && (lead.consultor_nombre || lead.status === 'Agendado') && (
              <span className="text-slate-300" aria-hidden="true">·</span>
            )}
            {lead.consultor_nombre ? (
              <span className="inline-flex items-center gap-1 truncate" title={lead.consultor_nombre}>
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">person</span>
                <span className="truncate">{lead.consultor_nombre}</span>
              </span>
            ) : lead.status === 'Agendado' ? (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">person_off</span>
                Sin consultor
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mx-5 mb-5 px-4 py-3 rounded-xl bg-slate-200/40 border border-dashed border-slate-300 text-center">
          <span className="text-xs text-slate-500 font-medium">Sin agendamiento programado</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-300/60 bg-slate-200/30 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-medium">{timeAgo(lead.created_at)}</span>
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
