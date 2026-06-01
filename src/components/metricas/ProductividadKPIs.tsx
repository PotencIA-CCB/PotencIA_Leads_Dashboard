'use client'

// TASK-08: Replaced Treemap with BarChart layout="vertical" for casos más solicitados.
// bi-section-redesign: Duración → true vertical bars; Casos → inline donut.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import { type MetricasGlobales } from '@/lib/metricas'
import { MetricaChartCard } from './MetricaChartCard'
import { useWindowWidth } from '@/hooks/useWindowWidth'
import EstadoConsultoriasDonut, { DONUT_COLORS } from './EstadoConsultoriasDonut'

interface ProductividadKPIsProps {
  metricas: MetricasGlobales
  /** TASK-16: called when the user clicks a heatmap cell */
  onCellClick?: (cell: { dia: string; franja: string; consultoriaIds: string[] }) => void
}

const BAR_COLORS = ['#003087', '#00C8FF', '#004BB5', '#E8470A', '#5A6475', '#6366F1']
const SIN_MODALIDAD_COLOR = '#9ca3af'

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-[260px]">
      <p className="text-sm text-slate-400">Sin datos disponibles.</p>
    </div>
  )
}

function calcLeftWidth(labels: string[]): number {
  return Math.min(120, Math.max(60, ...labels.map((l) => l.length * 6)))
}


// TASK-15: Sáb and Dom removed — only Mon–Fri produced by compute layer
const HEATMAP_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const HEATMAP_FRANJAS = ['8-10am', '10am-12pm', '1-3pm', '3-5pm', 'Fuera de horario']

function HeatmapFranjaDia({
  data,
  onCellClick,
}: {
  data: { franja: string; dia: string; count: number; consultoriaIds: string[] }[]
  onCellClick?: (cell: { dia: string; franja: string; consultoriaIds: string[] }) => void
}) {
  const w = useWindowWidth()
  const labelCol = w < 640 ? '60px' : '90px'
  const maxCount = Math.max(1, ...data.map(d => d.count))

  const getColor = (count: number) => {
    if (count === 0) return `rgba(0, 48, 135, 0.05)`
    return `rgba(0, 48, 135, ${0.15 + (count / maxCount) * 0.8})`
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `${labelCol} repeat(5, minmax(0, 1fr))` }}
      >
        {/* Header row */}
        <div />
        {HEATMAP_DIAS.map(dia => (
          <div key={dia} className="text-[9px] sm:text-[10px] text-slate-500 font-medium text-center py-1">
            {dia}
          </div>
        ))}
        {/* Data rows */}
        {HEATMAP_FRANJAS.map(franja => (
          <>
            <div key={`label-${franja}`} className="text-[9px] sm:text-[10px] text-slate-500 flex items-center pr-2 truncate">
              {franja}
            </div>
            {HEATMAP_DIAS.map(dia => {
              const cell = data.find(d => d.franja === franja && d.dia === dia)
              const count = cell?.count ?? 0
              const consultoriaIds = cell?.consultoriaIds ?? []
              return (
                <div
                  key={`${franja}-${dia}`}
                  className={`h-7 sm:h-8 rounded flex items-center justify-center${onCellClick ? ' cursor-pointer' : ''}`}
                  style={{ backgroundColor: getColor(count) }}
                  title={`${franja} ${dia}: ${count}`}
                  onClick={onCellClick ? () => onCellClick({ dia, franja, consultoriaIds }) : undefined}
                  role={onCellClick ? 'button' : undefined}
                  tabIndex={onCellClick ? 0 : undefined}
                  onKeyDown={onCellClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onCellClick({ dia, franja, consultoriaIds }) } : undefined}
                >
                  {count > 0 && (
                    <span className="text-[9px] sm:text-[10px] font-medium text-white">{count}</span>
                  )}
                </div>
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}

export function ProductividadKPIs({ metricas, onCellClick }: ProductividadKPIsProps) {
  // Derive modalidad keys (everything except 'consultor')
  const modalidadKeys = Array.from(
    new Set(
      metricas.modalidadPorConsultor.flatMap((row) =>
        Object.keys(row).filter((k) => k !== 'consultor'),
      ),
    ),
  )

  const modalidadColor = (key: string) =>
    key === 'Sin modalidad'
      ? SIN_MODALIDAD_COLOR
      : BAR_COLORS[modalidadKeys.indexOf(key) % BAR_COLORS.length]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
      {/* 1 — Duración promedio por consultor */}
      <MetricaChartCard title="Duración promedio por consultor (min)">
        {metricas.duracionPorConsultor.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={metricas.duracionPorConsultor}
              margin={{ top: 0, right: 16, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="consultor"
                type="category"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fontSize: 10 }}
              />
              <YAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                {metricas.duracionPorConsultor.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </MetricaChartCard>

      {/* 3 — Recuento por consultor */}
      <MetricaChartCard title="Sesiones por consultor">
        {metricas.recuentoPorConsultor.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={metricas.recuentoPorConsultor}
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="consultor"
                tick={{ fontSize: 10 }}
                width={calcLeftWidth(metricas.recuentoPorConsultor.map((d) => d.consultor))}
              />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {metricas.recuentoPorConsultor.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </MetricaChartCard>

      {/* 4 — Casos más solicitados (bi-section-redesign: replaced BarChart with inline donut) */}
      <MetricaChartCard title="Casos más solicitados">
        {metricas.porCasoUso.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex-1 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-[200px] h-[200px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metricas.porCasoUso}
                    dataKey="total"
                    nameKey="caso"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                  >
                    {metricas.porCasoUso.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-3">
              {metricas.porCasoUso.map((e, i) => (
                <div key={e.caso} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                  />
                  <span className="text-xs text-slate-600 font-medium">
                    {e.caso} ({e.total})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </MetricaChartCard>

      {/* 5 — Modalidad por consultor (stacked horizontal bar) */}
      <MetricaChartCard title="Modalidad por consultor">
        {metricas.modalidadPorConsultor.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={metricas.modalidadPorConsultor}
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="consultor"
                tick={{ fontSize: 10 }}
                width={calcLeftWidth(metricas.modalidadPorConsultor.map((d) => d.consultor))}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {modalidadKeys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="modalidad"
                  fill={modalidadColor(key)}
                  radius={
                    idx === modalidadKeys.length - 1 ? [0, 4, 4, 0] : undefined
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </MetricaChartCard>

      {/* 5 — Estado consultorías (Donut) */}
      <EstadoConsultoriasDonut porEstadoAtendidas={metricas.porEstadoAtendidas} />

      {/* 6 — Consultas por franja horaria (Heatmap) — TASK-16: onCellClick wired for drill-down */}
      <MetricaChartCard title="Consultas por franja horaria" className="md:col-span-1">
        <p className="text-xs text-gray-400 -mt-3 mb-3">Solo sesiones atendidas · Clic en celda para ver detalle</p>
        {metricas.heatmapFranjaDia.length === 0 ? (
          <EmptyState />
        ) : (
          <HeatmapFranjaDia data={metricas.heatmapFranjaDia} onCellClick={onCellClick} />
        )}
      </MetricaChartCard>

    </div>
  )
}
