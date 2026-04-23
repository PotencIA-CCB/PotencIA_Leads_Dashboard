'use client'

import { Lead, LeadStatus } from '@/types'

const statusConfig: Record<LeadStatus, { label: string; color: string; dot: string }> = {
  Pendiente:        { label: 'Pendiente',       color: 'text-orange-500', dot: 'bg-orange-500' },
  Agendado:         { label: 'Agendado',         color: 'text-blue-500',   dot: 'bg-blue-500' },
  'En seguimiento': { label: 'En Seguimiento',   color: 'text-blue-500',   dot: 'bg-blue-500' },
  Resuelto:         { label: 'Completada',       color: 'text-emerald-500',dot: 'bg-emerald-500' },
  Cancelado:        { label: 'Cancelada',        color: 'text-slate-400',  dot: 'bg-slate-400' },
}

interface LeadCardProps {
  lead: Lead & {
    sesion?: {
      fecha_sesion: string
      hora_inicio: string | null
      hora_fin: string | null
      modalidad: string | null
      created_at: string
    } | null
  }
  onClick: (lead: Lead) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 1) return 'Hace menos de 1 hora'
  if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

function sessionLabel(sesion: NonNullable<LeadCardProps['lead']['sesion']>) {
  const date = new Date(`${sesion.fecha_sesion}T00:00:00`)
  const fecha = date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  const hora = sesion.hora_inicio ? sesion.hora_inicio : ''
  return hora ? `${fecha} · ${hora}` : fecha
}

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  const status = statusConfig[lead.status]
  const modalidad = lead.sesion?.modalidad || null

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(lead)
    }
  }

  return (
    <article
      className="bg-[#E8EEFB] rounded-[10px] overflow-hidden shadow-md hover:-translate-y-1 transition-all duration-300 border-t-[3px] border-[#00C8FF] border border-[#DADEE7] flex flex-col cursor-pointer"
      onClick={() => onClick(lead)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalles de ${lead.full_name}`}
    >
      <div className="p-6 flex-1">
        {/* Status row */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 text-[#00C8FF] text-[10px] font-bold rounded-full uppercase">
              {lead.solution || 'Sin solución'}
            </span>
            {modalidad && (
              <span className="px-3 py-1 bg-white/70 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-full uppercase">
                {modalidad}
              </span>
            )}
          </div>
          <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${status.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        {/* Name */}
        <h3 className="text-xl font-bold text-[#001d59] mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {lead.full_name}
        </h3>
        <p className="text-xs text-slate-400 mb-6 font-medium">{lead.email}</p>

        {/* Info */}
        <div className="space-y-3 mb-6">
          {lead.city && (
            <div className="flex items-center gap-3 text-slate-600">
              <span className="material-symbols-outlined text-[18px] text-[#00C8FF]">location_on</span>
              <span className="text-sm">{lead.city}</span>
            </div>
          )}
          {lead.company_role_level && (
            <div className="flex items-center gap-3 text-slate-600">
              <span className="material-symbols-outlined text-[18px] text-[#00C8FF]">badge</span>
              <span className="text-sm">{lead.company_role_level}</span>
            </div>
          )}
          {lead.company_role_area && (
            <div className="flex items-center gap-3 text-slate-600">
              <span className="material-symbols-outlined text-[18px] text-[#00C8FF]">factory</span>
              <span className="text-sm">{lead.company_role_area}</span>
            </div>
          )}
        </div>

        {/* Use case */}
        {lead.use_case && (
          <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 italic border-l-2 border-slate-100 pl-4">
            {lead.use_case}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50/50 flex justify-between items-center mt-auto">
        <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          {lead.sesion ? sessionLabel(lead.sesion) : timeAgo(lead.created_at)}
        </span>
        <span className="text-sm font-bold text-[#003087] hover:text-[#00C8FF] transition-colors flex items-center gap-1">
          Ver detalle
          <span className="material-symbols-outlined text-[18px]">arrow_right_alt</span>
        </span>
      </div>
    </article>
  )
}
