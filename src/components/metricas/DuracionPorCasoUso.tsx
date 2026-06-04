'use client'

import { MetricaChartCard } from './MetricaChartCard'

interface Props {
  data: { caso: string; avgMin: number; count: number }[]
}

const COLORS = ['#003087', '#004BB5', '#00C8FF', '#E8470A', '#5A6475', '#6366F1']

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-[200px]">
      <p className="text-sm text-slate-400">Sin datos disponibles.</p>
    </div>
  )
}

export function DuracionPorCasoUso({ data }: Props) {
  if (data.length === 0) {
    return (
      <MetricaChartCard title="Duración por tema">
        <EmptyState />
      </MetricaChartCard>
    )
  }

  const max = Math.max(...data.map(d => d.avgMin))
  const avg = data.reduce((s, d) => s + d.avgMin, 0) / data.length
  const avgPct = (avg / max) * 100

  return (
    <MetricaChartCard title="Duración por tema (min)">
      <div className="space-y-3.5 mt-2">
        {data.map((d, i) => {
          const pct = (d.avgMin / max) * 100
          const color = COLORS[i % COLORS.length]
          return (
            <div key={d.caso} className="grid grid-cols-[1fr_3fr_36px] items-center gap-x-2">
              <span className="text-[10px] sm:text-[11px] text-slate-600 truncate text-right leading-tight">
                {d.caso}
              </span>
              <div className="relative flex items-center h-4">
                {/* Lollipop stem */}
                <div
                  className="h-px rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: color, minWidth: 4 }}
                />
                {/* Lollipop head */}
                <div
                  className="w-3 h-3 rounded-full shrink-0 -ml-1.5 shadow-sm border-2 border-white"
                  style={{ backgroundColor: color }}
                />
                {/* Team average reference line */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-slate-300"
                  style={{ left: `${avgPct}%` }}
                />
              </div>
              <span className="text-[10px] sm:text-[11px] font-mono font-semibold text-slate-700 tabular-nums">
                {Math.round(d.avgMin)}m
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
        <div className="w-px h-3 bg-slate-300 shrink-0" />
        <span className="text-[10px] text-slate-400">
          Promedio general: {Math.round(avg)} min · {data.reduce((s, d) => s + d.count, 0)} sesiones con datos de duración
        </span>
      </div>
    </MetricaChartCard>
  )
}
