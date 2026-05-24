'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { type MetricasGlobales } from '@/lib/metricas'
import { MetricaChartCard } from './MetricaChartCard'
import { useWindowWidth } from '@/hooks/useWindowWidth'

interface ConsultorRadarProps {
  metricas: MetricasGlobales
}

const BAR_COLORS = ['#003087', '#00C8FF', '#004BB5', '#E8470A', '#5A6475', '#6366F1']

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-[300px]">
      <p className="text-sm text-slate-400">Sin datos disponibles.</p>
    </div>
  )
}

export function ConsultorRadar({ metricas }: ConsultorRadarProps) {
  const w = useWindowWidth()
  const isMobile = w < 640
  const isTablet = w >= 640 && w < 1024

  const margin = isMobile
    ? { top: 8, right: 8, left: 8, bottom: 8 }
    : isTablet
      ? { top: 12, right: 20, left: 20, bottom: 12 }
      : { top: 16, right: 32, left: 32, bottom: 16 }
  const tickFontSize = isMobile ? 9 : isTablet ? 10 : 11
  const legendFontSize = isMobile ? 9 : 11
  const chartHeight = isMobile ? 280 : 320

  const rawData = metricas.consultorMetrics

  if (rawData.length <= 1) {
    return (
      <MetricaChartCard title="Perfil de consultores" className="mb-8">
        <EmptyState />
      </MetricaChartCard>
    )
  }

  // Top 6 by sesiones
  const topConsultores = [...rawData].sort((a, b) => b.sesiones - a.sesiones).slice(0, 6)

  // Compute max per axis for normalization
  const maxSesiones = Math.max(1, ...topConsultores.map(c => c.sesiones))
  const maxDuracion = Math.max(1, ...topConsultores.map(c => c.duracionAvg))
  const maxProductos = Math.max(1, ...topConsultores.map(c => c.productos))
  const maxGrabadas = 100 // already a percentage 0-100

  // Build radar data: one entry per axis
  const radarData = [
    { subject: 'Sesiones' },
    { subject: 'Duración (avg)' },
    { subject: 'Productos' },
    { subject: 'Grabadas %' },
  ].map((axis, axisIdx) => {
    const entry: Record<string, string | number> = { subject: axis.subject }
    topConsultores.forEach(c => {
      let val: number
      if (axisIdx === 0) val = Math.round((c.sesiones / maxSesiones) * 100)
      else if (axisIdx === 1) val = Math.round((c.duracionAvg / maxDuracion) * 100)
      else if (axisIdx === 2) val = Math.round((c.productos / maxProductos) * 100)
      else val = Math.round((c.pctGrabadas / maxGrabadas) * 100)
      entry[c.consultor] = val
    })
    return entry
  })

  return (
    <MetricaChartCard title="Perfil de consultores" className="mb-8">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <RadarChart data={radarData} margin={margin}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: tickFontSize }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} tickCount={5} />
          {topConsultores.map((c, i) => (
            <Radar
              key={c.consultor}
              name={c.consultor}
              dataKey={c.consultor}
              stroke={BAR_COLORS[i % BAR_COLORS.length]}
              fill={BAR_COLORS[i % BAR_COLORS.length]}
              fillOpacity={0.15}
            />
          ))}
          <Legend wrapperStyle={{ fontSize: legendFontSize }} />
          <Tooltip formatter={(value) => [`${value ?? 0}`, 'Score (normalizado)']} />
        </RadarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-slate-400 text-center mt-1">
        Valores normalizados 0–100 relativo al máximo del grupo
      </p>
    </MetricaChartCard>
  )
}
