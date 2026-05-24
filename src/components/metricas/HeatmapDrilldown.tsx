'use client'

import { type ConsultoriaForMetricas, canonicalStatus } from '@/lib/metricas'

interface HeatmapDrilldownProps {
  consultorias: ConsultoriaForMetricas[]
  cell: { dia: string; franja: string; consultoriaIds: string[] } | null
  onClose: () => void
}

function formatFecha(fecha: string): string {
  // Input: ISO date string YYYY-MM-DD — output: DD/MM/YYYY
  const parts = fecha.split('-')
  if (parts.length !== 3) return fecha
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function HeatmapDrilldown({ consultorias, cell, onClose }: HeatmapDrilldownProps) {
  if (cell === null) return null

  const idSet = new Set(cell.consultoriaIds)
  const sessions = cell.consultoriaIds.length === 0
    ? []
    : consultorias.filter((c) => c.id != null && idSet.has(c.id))

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[10px] shadow-sm mt-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100">
        <h5
          className="text-sm font-bold text-[#003087]"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Sesiones — {cell.dia} · {cell.franja}
        </h5>
        <button
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none cursor-pointer"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Sin sesiones registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-semibold text-slate-500 pb-2 pr-4">Fecha</th>
                  <th className="text-left font-semibold text-slate-500 pb-2 pr-4">Hora inicio</th>
                  <th className="text-left font-semibold text-slate-500 pb-2 pr-4">Consultor</th>
                  <th className="text-left font-semibold text-slate-500 pb-2 pr-4">Lead</th>
                  <th className="text-left font-semibold text-slate-500 pb-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((c, i) => (
                  <tr key={c.id ?? i} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-4 text-slate-600">{formatFecha(c.fecha)}</td>
                    <td className="py-2 pr-4 text-slate-600">{c.hora_inicio ?? '—'}</td>
                    <td className="py-2 pr-4 text-slate-600">
                      {c.consultores?.nombre ?? 'Sin consultor'}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{[c.leads?.nombre, c.leads?.apellidos].filter(Boolean).join(' ') || c.leads?.city || '—'}</td>
                    <td className="py-2 text-slate-600">{canonicalStatus(c.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
