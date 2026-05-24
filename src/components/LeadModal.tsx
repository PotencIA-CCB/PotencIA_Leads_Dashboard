'use client'

import { useEffect, useState } from 'react'
import { Lead, ConsultoriaStatus, Consultor, leadFullName } from '@/types'
import { effectiveStatus } from '@/components/LeadCard'
import type { LeadWithMeta, LeadCardConsultoria } from '@/components/LeadCard'

const statusOptions: ConsultoriaStatus[] = ['Pendiente', 'Agendado', 'En seguimiento', 'Resuelto', 'Cancelado']

interface LeadModalProps {
  lead: LeadWithMeta
  onClose: () => void
  onStatusChange: (id: string, consultoriaId: string, status: ConsultoriaStatus) => void
  onAsignarConsultor?: (consultoriaId: string, id_consultor: string) => void
  consultores?: Consultor[]
}

const channelMeta = {
  landing: { label: 'Form PotencIA',      pill: 'bg-emerald-50 text-emerald-700', icon: 'language' },
  booking: { label: 'Microsoft Bookings', pill: 'bg-sky-50 text-sky-700',         icon: 'event_available' },
  sesion:  { label: 'Registro Sesión',    pill: 'bg-violet-50 text-violet-700',   icon: 'description' },
  ambos:   { label: 'Multi-canal',        pill: 'bg-gradient-to-r from-emerald-50 to-sky-50 text-slate-700', icon: 'link' },
}

const avatarGradient: Record<string, string> = {
  landing: 'from-emerald-500 to-teal-600',
  booking: 'from-[#00C8FF] to-[#003087]',
  sesion:  'from-violet-500 to-purple-700',
  ambos:   'from-slate-600 to-slate-800',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export default function LeadModal({ lead, onClose, onStatusChange, onAsignarConsultor, consultores = [] }: LeadModalProps) {
  const [saved, setSaved] = useState(false)
  const fullName = leadFullName(lead)
  const con = lead.consultoria as (LeadCardConsultoria & { id_consultor?: string | null }) | undefined | null
  const form = lead.formulario
  const channels = lead.origen
  const gradKey = channels === 'ambos' ? 'ambos' : (channels === 'sesion' ? 'sesion' : channels === 'booking' ? 'booking' : 'landing')

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
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5">
          <div className="flex items-start gap-4">
            <div
              className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${avatarGradient[gradKey] ?? avatarGradient['landing']} text-white flex items-center justify-center font-bold text-base sm:text-lg shadow-md`}
              aria-hidden="true"
            >
              {getInitials(fullName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="modal-title"
                  className="text-lg sm:text-xl font-bold text-slate-900 leading-tight"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {fullName}
                </h2>
              </div>
              <p className="text-sm text-slate-500 mt-0.5 truncate">{lead.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <ChannelPill kind={channels} />
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
        <div className="px-4 sm:px-7 py-5 sm:py-6 space-y-5 sm:space-y-6">
          {/* Acciones: status y asignación */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {con && (
              <Field label="Estado">
                <select
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/30 focus:border-[#00C8FF]/50 transition-colors"
                  value={con.status}
                  onChange={(e) => { onStatusChange(lead.id, con.id, e.target.value as ConsultoriaStatus); showSaved() }}
                >
                  {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}

            {onAsignarConsultor && consultores.length > 0 && con && (
              <Field label="Consultor asignado">
                <select
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/30 focus:border-[#00C8FF]/50 transition-colors"
                  value={con.id_consultor ?? ''}
                  onChange={(e) => { onAsignarConsultor(con.id, e.target.value); showSaved() }}
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
            <Row label="Teléfono" value={lead.phone} />
            <Row label="Ciudad" value={lead.city} />
          </Section>

          {/* Información profesional */}
          {(lead.id_num || lead.nit || lead.cargo || lead.company_role_level || lead.company_role_area || lead.sector || lead.empresa) && (
            <Section title="Información profesional">
              <Row label="Cédula" value={lead.id_num} />
              <Row label="NIT" value={lead.nit} />
              <Row label="Cargo" value={lead.cargo} />
              <Row label="Nivel del cargo" value={lead.company_role_level} />
              <Row label="Área" value={lead.company_role_area} />
              <Row label="Sector" value={lead.sector} />
              <Row label="Empresa" value={lead.empresa} />
              <Row label="Sexo" value={lead.sexo} />
            </Section>
          )}

          {/* Necesidad del cliente — del formulario */}
          {form && (form.tema || form.descripcion || form.fecha_registro) && (
            <Section title="Necesidad del cliente (Form PotencIA)">
              <Row label="Tema elegido" value={form.tema} fullWidth />
              <Row label="Descripción" value={form.descripcion} fullWidth />
              <Row
                label="Fecha de registro"
                value={form.fecha_registro
                  ? new Date(form.fecha_registro).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
                  : null}
              />
            </Section>
          )}

          {/* Agendamiento */}
          {con && (
            <Section title="Agendamiento">
              <Row
                label="Fecha"
                value={new Date(con.fecha + 'T00:00:00').toLocaleDateString('es-CO', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              />
              <Row
                label="Horario"
                value={con.hora_inicio
                  ? `${con.hora_inicio}${con.hora_fin ? ` – ${con.hora_fin}` : ''}`
                  : null}
              />
              <Row label="Modalidad" value={con.modalidad} />
              <Row label="Servicio" value={con.servicio} />
              <Row
                label="Duración"
                value={typeof con.duracion_minutos === 'number' && con.duracion_minutos > 0
                  ? `${con.duracion_minutos} minutos`
                  : null}
              />
              <Row label="Caso de uso" value={con.categoria_caso_uso} />
              <Row label="Consultor Bookings" value={con.staff_name} />
              <Row label="Email staff" value={con.staff_email} />
              <Row label="Consultor asignado" value={lead.consultor_nombre} />
            </Section>
          )}

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

function ChannelPill({ kind }: { kind: string }) {
  const c = channelMeta[kind as keyof typeof channelMeta] ?? channelMeta['landing']
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${c.pill}`}>
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">{c.icon}</span>
      {c.label}
    </span>
  )
}
