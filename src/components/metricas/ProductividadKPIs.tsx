'use client'

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
  Treemap,
} from 'recharts'
import { type MetricasGlobales } from '@/lib/metricas'
import { MetricaChartCard } from './MetricaChartCard'

interface ProductividadKPIsProps {
  metricas: MetricasGlobales
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

interface TreemapContentProps {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  value?: number
  fill?: string
}

function CustomTreemapContent({ x = 0, y = 0, width = 0, height = 0, name, value, fill }: TreemapContentProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill ?? '#003087'} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 50 && height > 25 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            fill="white"
            fontSize={10}
            fontWeight="600"
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 8}
            textAnchor="middle"
            fill="white"
            fontSize={10}
          >
            {value}
          </text>
        </>
      )}
    </g>
  )
}

const HEATMAP_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HEATMAP_FRANJAS = ['8-10am', '10am-12pm', '1-3pm', '3-5pm', 'Fuera de horario']

function HeatmapFranjaDia({ data }: { data: { franja: string; dia: string; count: number }[] }) {
  const maxCount = Math.max(1, ...data.map(d => d.count))

  const getColor = (count: number) => {
    if (count === 0) return `rgba(0, 48, 135, 0.05)`
    return `rgba(0, 48, 135, ${0.15 + (count / maxCount) * 0.8})`
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '90px repeat(7, 1fr)',
          gap: '3px',
          minWidth: '480px',
        }}
      >
        {/* Header row */}
        <div />
        {HEATMAP_DIAS.map(dia => (
          <div key={dia} className="text-[10px] text-slate-500 font-medium text-center py-1">
            {dia}
          </div>
        ))}
        {/* Data rows */}
        {HEATMAP_FRANJAS.map(franja => (
          <>
            <div key={`label-${franja}`} className="text-[10px] text-slate-500 flex items-center pr-2 truncate">
              {franja}
            </div>
            {HEATMAP_DIAS.map(dia => {
              const cell = data.find(d => d.franja === franja && d.dia === dia)
              const count = cell?.count ?? 0
              return (
                <div
                  key={`${franja}-${dia}`}
                  className="h-8 rounded flex items-center justify-center"
                  style={{ backgroundColor: getColor(count) }}
                  title={`${franja} ${dia}: ${count}`}
                >
                  {count > 0 && (
                    <span className="text-[10px] font-medium text-white">{count}</span>
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

export function ProductividadKPIs({ metricas }: ProductividadKPIsProps) {
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

  const treemapData = metricas.porCasoUso.map((d, i) => ({
    name: d.caso,
    size: d.total,
    fill: BAR_COLORS[i % BAR_COLORS.length],
  }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* 1 — Duración promedio por consultor */}
      <MetricaChartCard title="Duración promedio por consultor (min)">
        {metricas.duracionPorConsultor.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={metricas.duracionPorConsultor}
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="consultor"
                tick={{ fontSize: 10 }}
                width={calcLeftWidth(metricas.duracionPorConsultor.map((d) => d.consultor))}
              />
              <Tooltip />
              <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                {metricas.duracionPorConsultor.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </MetricaChartCard>

      {/* 2 — Consultas por área */}
      <MetricaChartCard title="Consultas por área">
        {metricas.consultasPorArea.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={metricas.consultasPorArea}
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="area"
                tick={{ fontSize: 10 }}
                width={calcLeftWidth(metricas.consultasPorArea.map((d) => d.area))}
              />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {metricas.consultasPorArea.map((_, i) => (
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

      {/* 4 — Casos de uso (Treemap) */}
      <MetricaChartCard title="Casos de uso más solicitados">
        {metricas.porCasoUso.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <Treemap
              data={treemapData}
              dataKey="size"
              content={<CustomTreemapContent />}
            >
              <Tooltip formatter={(value, name) => [value, name]} />
            </Treemap>
          </ResponsiveContainer>
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

      {/* 6 — Consultas por franja horaria (Heatmap) */}
      <MetricaChartCard title="Consultas por franja horaria">
        {metricas.heatmapFranjaDia.length === 0 ? (
          <EmptyState />
        ) : (
          <HeatmapFranjaDia data={metricas.heatmapFranjaDia} />
        )}
      </MetricaChartCard>

      {/* 7 — Tiempo por cargo/rol */}
      <MetricaChartCard title="Tiempo por cargo (min)">
        {metricas.tiempoPorRol.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={metricas.tiempoPorRol}
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="rol"
                tick={{ fontSize: 10 }}
                width={calcLeftWidth(metricas.tiempoPorRol.map((d) => d.rol))}
              />
              <Tooltip />
              <Bar dataKey="minutos" radius={[0, 4, 4, 0]}>
                {metricas.tiempoPorRol.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </MetricaChartCard>
    </div>
  )
}
