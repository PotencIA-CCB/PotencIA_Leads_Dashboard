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

      {/* 4 — Consultas por caso de uso (vertical bar) */}
      <MetricaChartCard title="Casos de uso más solicitados">
        {metricas.porCasoUso.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={metricas.porCasoUso}
              margin={{ top: 4, right: 8, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="caso"
                tick={{ fontSize: 9 }}
                interval={0}
                angle={-30}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {metricas.porCasoUso.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
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

      {/* 6 — Consultas por franja horaria */}
      <MetricaChartCard title="Consultas por franja horaria">
        {metricas.consultasPorFranja.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={metricas.consultasPorFranja}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="franja" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#003087" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
