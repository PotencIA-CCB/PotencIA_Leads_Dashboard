'use client'
// TASK-06: Replaced RadialBarChart gauges with KPI card grid + horizontal progress bars.
// TASK-07: Scatter chart — added title, axis labels, OLS trend line overlay, empty state.

import {
  ComposedChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
} from 'recharts'
import { type MetricasGlobales } from '@/lib/metricas'
import { MetricaChartCard } from './MetricaChartCard'

interface QualityKPIsProps {
  metricas: MetricasGlobales
}

const BAR_COLORS = ['#003087', '#00C8FF', '#004BB5', '#E8470A', '#5A6475', '#6366F1']

// ── KPI Card with horizontal progress bar ──────────────────────────────────────

interface KpiCardProps {
  value: number | undefined | null
  label: string
  color: string
}

function KpiCard({ value, label, color }: KpiCardProps) {
  const displayValue = value != null ? value : null
  const pct = displayValue != null ? Math.min(100, Math.max(0, displayValue)) : 0

  return (
    <div className="bg-slate-50 rounded-lg p-4 flex flex-col gap-3">
      <p className="text-xs text-slate-500 font-medium leading-tight">{label}</p>
      <p
        className="text-4xl font-bold leading-none"
        style={{ color, fontFamily: 'Space Grotesk, sans-serif' }}
      >
        {displayValue != null ? `${displayValue}%` : '—'}
      </p>
      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ── QualityKPIs component ───────────────────────────────────────────────────────
// Uses ComposedChart to overlay a Line (OLS regression) on Scatter series.

export function QualityKPIs({ metricas }: QualityKPIsProps) {
  const { scatterDuracionProductos, scatterRegression } = metricas

  // Group scatter data by consultor for coloured series
  const consultorNames = Array.from(
    new Set(scatterDuracionProductos.map((d) => d.consultor)),
  )
  const scatterByConsultor = consultorNames.map((nombre, i) => ({
    nombre,
    color: BAR_COLORS[i % BAR_COLORS.length],
    data: scatterDuracionProductos
      .filter((d) => d.consultor === nombre)
      .map((d) => ({ x: d.duracion, y: d.productos })),
  }))

  const hasScatterData = scatterDuracionProductos.length >= 2
  const hasRegression = scatterRegression.line.length === 2

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Calidad de sesiones — KPI cards (TASK-06) */}
      <MetricaChartCard title="Calidad de sesiones">
        <div className="grid grid-cols-1 gap-3 py-2">
          <KpiCard
            value={metricas.tasaSesionesGrabadas}
            label="% sesiones grabadas"
            color="#00C8FF"
          />
          <KpiCard
            value={metricas.tasaDocumentacion}
            label="% sesiones documentadas"
            color="#003087"
          />
          <KpiCard
            value={metricas.tasaRetorno}
            label="% leads recurrentes"
            color="#6366F1"
          />
        </div>
      </MetricaChartCard>

      {/* Duración vs. Productos — Scatter with trend line (TASK-07) */}
      <MetricaChartCard title="¿Las sesiones más largas producen más entregables?">
        {!hasScatterData ? (
          <div className="flex items-center justify-center h-[260px]">
            <p className="text-sm text-slate-400">Sin datos suficientes para mostrar tendencia</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart margin={{ top: 4, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                type="number"
                dataKey="x"
                name="Duración (minutos)"
                tick={{ fontSize: 10 }}
                label={{
                  value: 'Duración (minutos)',
                  position: 'insideBottom',
                  offset: -16,
                  fontSize: 10,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Productos entregados"
                tick={{ fontSize: 10 }}
                label={{
                  value: 'Productos entregados',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  fontSize: 10,
                }}
                allowDecimals={false}
              />
              <ZAxis range={[40, 40]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value, name) => [value, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              {/* Scatter series per consultor */}
              {scatterByConsultor.map(({ nombre, color, data }) => (
                <Scatter key={nombre} name={nombre} data={data} fill={color} />
              ))}

              {/* OLS trend line overlay */}
              {hasRegression && (
                <Line
                  data={scatterRegression.line}
                  dataKey="y"
                  stroke="#E8470A"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                  legendType="none"
                  name="Tendencia"
                  strokeDasharray="4 2"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </MetricaChartCard>
    </div>
  )
}
