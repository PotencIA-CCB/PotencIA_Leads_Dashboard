'use client'

import { useEffect, useState } from 'react'
import { Lead, LeadStatus, LeadSource, Consultor } from '@/types'
import { formatUseCase } from '@/lib/format'

const statusOptions: LeadStatus[] = ['Pendiente', 'Agendado', 'En seguimiento', 'Resuelto', 'Cancelado']

type LeadModalLead = Lead & {
  sesion?: {
    fecha_sesion: string
    hora_inicio: string | null
    hora_fin: string | null
    modalidad: string | null
  } | null
  consultor_nombre?: string | null
}

interface LeadModalProps {
  lead: LeadModalLead
  onClose: () => void
  onStatusChange: (id: string, status: LeadStatus) => void
  onAsignarConsultor?: (id: string, id_consultor: string) => void
  consultores?: Consultor[]
}

const channelMeta = {
  landing: { label: 'Form PotencIA',      pill: 'bg-emerald-50 text-emerald-700', icon: 'language' },
  booking: { label: 'Microsoft Bookings', pill: 'bg-sky-50 text-sky-700',         icon: 'event_available' },
  manual:  { label: 'Manual',             pill: 'bg-slate-100 text-slate-600',    icon: 'edit_note' },
}

const avatarGradient: Record<LeadSource, string> = {
  landing: 'from-emerald-500 to-teal-600',
  booking: 'from-[#00C8FF] to-[#003087]',
  manual:  'from-slate-500 to-slate-700',
}

function detectChannels(lead: LeadModalLead): { landing: boolean; booking: boolean } {
  const booking = Boolean(lead.booking_email || lead.booking_customer_id || lead.sesion)
  // Solo señales EXCLUSIVAS del Form PotencIA: campos que únicamente se llenan
  // desde el formulario web. Los flags de perfil pueden venir con default
  // false desde la BD, así que no son confiables como discriminador.
  const landing =
    lead.source === 'landing'
    || Boolean(lead.use_case)
    || Boolean(lead.comments)
  return { landing, booking }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export default function LeadModal({ lead, onClose, onStatusChange, onAsignarConsultor, consultores = [] }: LeadModalProps) {
  const [saved, setSaved] = useState(false)
  const channels = detectChannels(lead)
  const sourceKey: LeadSource = lead.source ?? 'manual'
  const dual = channels.landing && channels.booking

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function showSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-7 pt-6 pb-5">
          <div className="flex items-start gap-4">
            <div
              className={`shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarGradient[sourceKey]} text-white flex items-center justify-center font-bold text-lg shadow-md`}
              aria-hidden="true"
            >
              {getInitials(lead.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="modal-title"
                  className="text-xl font-bold text-slate-900 leading-tight"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {lead.full_name}
                </h2>
                {dual && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-50 to-sky-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200/60"
                    title="Información unificada de landing y Microsoft Bookings"
                  >
                    <span className="material-symbols-outlined text-[12px]" aria-hidden="true">link</span>
                    Unificado
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5 truncate">{lead.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {channels.landing && <ChannelPill kind="landing" />}
                {channels.booking && <ChannelPill kind="booking" />}
                {!channels.landing && !channels.booking && <ChannelPill kind="manual" />}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs text-emerald-600 font-medium" aria-live="polite">
                  Guardado
                </span>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg text-slate-400 flex items-center justify-center cursor-pointer"
                aria-label="Cerrar modal"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-6">
          {/* Acciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Estado">
              <select
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/30 focus:border-[#00C8FF]/50 transition-colors"
                value={lead.status}
                onChange={(e) => { onStatusChange(lead.id, e.target.value as LeadStatus); showSaved() }}
              >
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            {onAsignarConsultor && consultores.length > 0 && (
              <Field label="Consultor asignado">
                <select
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/30 focus:border-[#00C8FF]/50 transition-colors"
                  value={lead.id_consultor_asignado || ''}
                  onChange={(e) => { onAsignarConsultor(lead.id, e.target.value); showSaved() }}
                >
                  <option value="">Sin asignar</option>
                  {consultores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </Field>
            )}

            {!onAsignarConsultor && lead.consultor_nombre && (
              <Field label="Consultor asignado">
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-sm text-slate-700">
                  <span className="material-symbols-outlined text-[16px] text-slate-400" aria-hidden="true">person</span>
                  {lead.consultor_nombre}
                </span>
              </Field>
            )}
          </div>

          {/* Información de contacto */}
          <Section title="Información de contacto">
            <Row label="Email" value={lead.email} />
            {lead.booking_email && lead.booking_email.toLowerCase() !== lead.email.toLowerCase() && (
              <Row label="Email de Bookings" value={lead.booking_email} />
            )}
            <Row label="Teléfono" value={lead.phone} />
            <Row label="Ciudad" value={lead.city} />
          </Section>

          {/* Información profesional + identificación */}
          {(lead.id_num || lead.nit || lead.company_role_level || lead.company_role_area) && (
            <Section title="Información profesional">
              <Row label="Cédula" value={lead.id_num} />
              <Row label="NIT" value={lead.nit} />
              <Row label="Cargo" value={lead.company_role_level} />
              <Row label="Área" value={lead.company_role_area} />
            </Section>
          )}

          {/* Necesidad del cliente */}
          {(lead.solution || lead.use_case || lead.comments) && (
            <Section title="Necesidad del cliente">
              <Row label="Solución de interés" value={lead.solution} />
              <Row label="Caso de uso" value={formatUseCase(lead.use_case) || null} fullWidth />
              <Row label="Comentarios" value={lead.comments} fullWidth />
            </Section>
          )}

          {/* Perfil declarado en el formulario */}
          {(lead.perfil_personal !== null || lead.perfil_empresa !== null || lead.autorizo_datos !== null) && (
            <Section title="Perfil declarado">
              <BoolRow label="Perfil personal" value={lead.perfil_personal} />
              <BoolRow label="Perfil empresa" value={lead.perfil_empresa} />
              <BoolRow label="Autorizó datos" value={lead.autorizo_datos} />
            </Section>
          )}

          {/* Agendamiento (Microsoft Bookings) */}
          {lead.sesion && (
            <Section title="Agendamiento">
              <Row
                label="Fecha"
                value={new Date(lead.sesion.fecha_sesion + 'T00:00:00').toLocaleDateString('es-CO', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              />
              <Row
                label="Horario"
                value={lead.sesion.hora_inicio
                  ? `${lead.sesion.hora_inicio}${lead.sesion.hora_fin ? ` – ${lead.sesion.hora_fin}` : ''}`
                  : null}
              />
              <Row label="Modalidad" value={lead.sesion.modalidad} />
              <Row label="Consultor" value={lead.consultor_nombre ?? null} />
            </Section>
          )}

          {/* Notas */}
          <Section title="Notas del consultor">
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {lead.notas_consultor || <span className="text-slate-400 italic">Sin notas</span>}
            </p>
          </Section>

          {/* Footer */}
          <div className="text-xs text-slate-400 border-t border-slate-100 pt-4">
            Registrado el{' '}
            {new Date(lead.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </div>
  )
}

function Row({ label, value, fullWidth }: { label: string; value: string | null | undefined; fullWidth?: boolean }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className={`flex flex-col gap-0.5 ${fullWidth ? 'md:col-span-2' : ''}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm text-slate-800">{value}</span>
    </div>
  )
}

function BoolRow({ label, value, fullWidth }: { label: string; value: boolean | null | undefined; fullWidth?: boolean }) {
  if (value === null || value === undefined) return null
  return (
    <div className={`flex flex-col gap-0.5 ${fullWidth ? 'md:col-span-2' : ''}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      {value ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          <span className="material-symbols-outlined text-[18px] text-emerald-500" aria-hidden="true">check_circle</span>
          Sí
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
          <span className="material-symbols-outlined text-[18px] text-slate-400" aria-hidden="true">cancel</span>
          No
        </span>
      )}
    </div>
  )
}

function ChannelPill({ kind }: { kind: 'landing' | 'booking' | 'manual' }) {
  const c = channelMeta[kind]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${c.pill}`}>
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">{c.icon}</span>
      {c.label}
    </span>
  )
}
