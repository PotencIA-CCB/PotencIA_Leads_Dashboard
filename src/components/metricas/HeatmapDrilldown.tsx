'use client'

import { useEffect } from 'react'
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

// NOTE: Uses `position: fixed inset-0` (no React Portal). Verified no ancestor
// in the dashboard layout chain has `transform`, `filter`, `perspective`, or
// `will-change` set on an ancestor of this component, which would otherwise
// break fixed positioning. The sidebar (aside) has transition-transform but is
// a sibling element, not an ancestor. If a future layout change introduces any
// of those properties on an ancestor, migrate to `createPortal(node, document.body)`.
export function HeatmapDrilldown({ consultorias, cell, onClose }: HeatmapDrilldownProps) {
  // ESC key handler — registered only when modal is open
  useEffect(() => {
    if (cell === null) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [cell, onClose])

  if (cell === null) return null

  const idSet = new Set(cell.consultoriaIds)
  const sessions =
    cell.consultoriaIds.length === 0
      ? []
      : consultorias.filter((c) => c.id != null && idSet.has(c.id))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Sesiones ${cell.dia} ${cell.franja}`}
    >
      <div
        className="bg-white border border-[#E5E7EB] rounded-[10px] shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
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
            className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none cursor-pointer px-2"
          >
            ×
          </button>
        </div>

        {/* Content (scrollable) */}
        <div className="px-5 py-4 overflow-y-auto">
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
                      <td className="py-2 pr-4 text-slate-600">
                        {[c.leads?.nombre, c.leads?.apellidos].filter(Boolean).join(' ') ||
                          c.leads?.city ||
                          '—'}
                      </td>
                      <td className="py-2 text-slate-600">{canonicalStatus(c.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
