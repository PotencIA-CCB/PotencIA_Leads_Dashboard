'use client'

import { useState } from 'react'
import { Lead, LeadStatus, Consultor } from '@/types'

const statusOptions: LeadStatus[] = ['Pendiente', 'Agendado', 'En seguimiento', 'Resuelto', 'Cancelado']

interface LeadModalProps {
  lead: Lead
  onClose: () => void
  onStatusChange: (id: string, status: LeadStatus) => void
  onAsignarConsultor?: (id: string, id_consultor: string) => void
  consultores?: Consultor[]
}


function Row({ label, value }: { label: string; value: string | boolean | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800">{typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value}</span>
    </div>
  )
}

export default function LeadModal({ lead, onClose, onStatusChange, onAsignarConsultor, consultores = [] }: LeadModalProps) {
  const [saved, setSaved] = useState(false)

  function showSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{lead.full_name}</h2>
            <p className="text-sm text-gray-500">{lead.company_role_area} · {lead.company_role_level}</p>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-green-500 font-medium">✓ Guardado</span>}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Estado */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Estado</span>
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-fit"
            value={lead.status}
            onChange={(e) => { onStatusChange(lead.id, e.target.value as LeadStatus); showSaved() }}
          >
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Asignar consultor — solo admin */}
        {onAsignarConsultor && consultores.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Consultor asignado</span>
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-fit"
              value={lead.id_consultor_asignado || ''}
              onChange={(e) => { onAsignarConsultor(lead.id, e.target.value); showSaved() }}
            >
              <option value="">Sin asignar</option>
              {consultores.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Datos personales */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <Row label="Email" value={lead.email} />
          <Row label="Teléfono" value={lead.phone} />
          <Row label="Ciudad" value={lead.city} />
          <Row label="ID / Cédula" value={lead.id_num} />
          <Row label="NIT" value={lead.nit} />
        </div>

        {/* Perfil */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <Row label="Perfil personal" value={lead.perfil_personal} />
          <Row label="Perfil empresa" value={lead.perfil_empresa} />
          <Row label="Autorizó datos" value={lead.autorizo_datos} />
        </div>

        {/* Caso de uso */}
        <div className="flex flex-col gap-3 border-t pt-4">
          <Row label="Solución de interés" value={lead.solution} />
          <Row label="Caso de uso" value={lead.use_case} />
          <Row label="Comentarios" value={lead.comments} />
        </div>

        {/* Notas del consultor */}
        <div className="flex flex-col gap-1 border-t pt-4">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Notas del consultor</span>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.notas_consultor || 'Sin notas'}</p>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-400 border-t pt-3">
          Registrado el {new Date(lead.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>
  )
}
