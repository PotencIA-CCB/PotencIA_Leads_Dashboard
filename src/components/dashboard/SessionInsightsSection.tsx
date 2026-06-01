import type { RegistroSesion } from '@/types'

interface SessionInsightsSectionProps {
  sessions: RegistroSesion[]
  loading: boolean
}

export default function SessionInsightsSection({ sessions, loading }: SessionInsightsSectionProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4 animate-pulse"
          >
            <div className="flex justify-between mb-3">
              <div className="h-4 w-24 bg-slate-200 rounded-full" />
              <div className="h-4 w-20 bg-slate-200 rounded-full" />
            </div>
            <div className="h-3 bg-slate-200 rounded w-1/3 mb-2" />
            <div className="h-4 bg-slate-200 rounded w-full mb-3" />
            <div className="h-3 bg-slate-200 rounded w-1/4 mb-2" />
            <div className="h-4 bg-slate-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (!sessions.length) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center">
        <span className="material-symbols-outlined text-slate-300 text-3xl" aria-hidden="true">
          history
        </span>
        <p className="text-sm text-slate-400 mt-2">Sin datos de sesiones aún</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <article
          key={s.id}
          className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4"
        >
          {/* Top row: estado_inicial badge + estimacion_impacto badge */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold px-2.5 py-0.5">
              {s.estado_inicial?.trim() || '—'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 text-[#003087] text-[11px] font-semibold px-2.5 py-0.5">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">trending_up</span>
              {s.estimacion_impacto?.trim() || 'Sin estimación'}
            </span>
          </div>

          {/* Acciones realizadas */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
            Acciones realizadas
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {s.acciones_realizadas?.trim() || 'Sin acciones registradas'}
          </p>

          {/* Resultado final */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3 mb-1">
            Resultado
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            {s.resultado_final?.trim() || '—'}
          </p>
        </article>
      ))}
    </div>
  )
}
