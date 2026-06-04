'use client'

import React, { useState } from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
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
const TEAM_AVG_KEY = '__teamAvg__'

type RadarEntry = Record<string, string | number>

/** Exported for unit testing — describes each radar axis in plain business language. */
export const RADAR_LEGEND_ITEMS: { axis: string; description: string }[] = [
  { axis: 'Sesiones', description: 'Total de sesiones atendidas por el consultor (cantidad).' },
  { axis: 'Duración (avg)', description: 'Duración promedio por sesión (minutos).' },
  { axis: 'Productos', description: 'Productos creados durante las sesiones del consultor (cantidad).' },
  { axis: 'Grabadas %', description: 'Porcentaje de sesiones grabadas sobre el total del consultor (%).' },
]

/** Exported for unit testing — reading guide text. */
export const RADAR_READING_GUIDE =
  'Forma balanceada = perfil generalista · Pico pronunciado = especialista en esa dimensión.'

/** Exported for unit testing — normalization footnote. */
export const RADAR_FOOTNOTE = 'Valores normalizados 0–100 relativo al máximo del grupo'

const AXIS_HINTS: Record<string, string> = {
  Sesiones: 'Cuántas sesiones tuvo el consultor en total.',
  'Duración (avg)': 'Tiempo promedio de cada sesión, expresado en minutos.',
  Productos: 'Cantidad de productos creados durante las sesiones.',
  'Grabadas %': 'Qué porcentaje de sus sesiones quedaron grabadas.',
}

function CustomAxisTick({
  x,
  y,
  payload,
  textAnchor,
  fontSize,
}: {
  x?: number
  y?: number
  payload?: { value: string }
  textAnchor?: 'start' | 'middle' | 'end' | 'inherit'
  fontSize?: number
}) {
  if (!payload || x === undefined || y === undefined) return null
  const hint = AXIS_HINTS[payload.value] ?? ''
  const fs = fontSize ?? 11
  return (
    <g style={{ cursor: hint ? 'help' : 'default' }}>
      {hint && <title>{hint}</title>}
      <text x={x} y={y} textAnchor={textAnchor ?? 'middle'} fontSize={fs} fill="#475569">
        {payload.value}
        {hint && (
          <tspan fill="#94a3b8" fontSize={fs - 1}>
            {' '}ⓘ
          </tspan>
        )}
      </text>
    </g>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-[300px]">
      <p className="text-sm text-slate-400">Sin datos disponibles.</p>
    </div>
  )
}

function HowToReadGuide() {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 mb-4">
      <p className="text-[10px] sm:text-[11px] font-semibold text-[#003087] mb-1.5">
        Cómo interpretar
      </p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[10px] sm:text-[11px]">
        {RADAR_LEGEND_ITEMS.map(({ axis, description }) => (
          <React.Fragment key={axis}>
            <dt className="font-semibold text-slate-700">{axis}</dt>
            <dd className="text-slate-500">{description}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="mt-2 pt-2 border-t border-slate-200 space-y-0.5">
        <p className="text-[10px] text-slate-600 font-medium">{RADAR_READING_GUIDE}</p>
        <p className="text-[10px] text-slate-400">{RADAR_FOOTNOTE}</p>
      </div>
    </div>
  )
}

function buildRadarData(
  consultores: MetricasGlobales['consultorMetrics'],
  maxSesiones: number,
  maxDuracion: number,
  maxProductos: number,
): RadarEntry[] {
  const axes = ['Sesiones', 'Duración (avg)', 'Productos', 'Grabadas %']
  return axes.map((subject, idx) => {
    const entry: RadarEntry = { subject }
    consultores.forEach(c => {
      let val: number
      if (idx === 0) val = Math.round((c.sesiones / maxSesiones) * 100)
      else if (idx === 1) val = Math.round((c.duracionAvg / maxDuracion) * 100)
      else if (idx === 2) val = Math.round((c.productos / maxProductos) * 100)
      else val = Math.round(c.pctGrabadas)
      entry[c.consultor] = val
    })
    const sum = consultores.reduce((acc, c) => acc + Number(entry[c.consultor]), 0)
    entry[TEAM_AVG_KEY] = Math.round(sum / consultores.length)
    return entry
  })
}

interface TooltipEntry {
  name: string
  value: number
  color?: string
}

interface RadarTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

function RadarTooltip({ active, payload, label }: RadarTooltipProps) {
  if (!active || !payload?.length) return null
  const consultorEntries = payload
    .filter(p => p.name !== TEAM_AVG_KEY && p.value != null)
    .sort((a, b) => b.value - a.value)
  const avgEntry = payload.find(p => p.name === TEAM_AVG_KEY)
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-2 py-1.5 text-[11px] min-w-[140px]">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {consultorEntries.map(p => (
        <div key={p.name} className="flex items-center gap-1.5 py-px">
          {p.color && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          )}
          <span className="text-slate-600 truncate flex-1">{p.name}</span>
          <span className="font-mono font-semibold text-slate-800 shrink-0">{p.value}/100</span>
        </div>
      ))}
      {avgEntry && (
        <div className="flex items-center gap-2 py-0.5 mt-1 pt-1 border-t border-slate-100">
          <span className="text-slate-400 truncate flex-1">Promedio equipo</span>
          <span className="font-mono text-slate-500 shrink-0">{avgEntry.value}/100</span>
        </div>
      )}
    </div>
  )
}

function SideLegend({
  consultores,
  colors,
  selected,
  onSelect,
}: {
  consultores: Array<{ consultor: string }>
  colors: string[]
  selected: string | null
  onSelect: (name: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 justify-center shrink-0 w-[160px]">
      {consultores.map((c, i) => {
        const color = colors[i % colors.length]
        const dimmed = selected !== null && selected !== c.consultor
        return (
          <button
            key={c.consultor}
            type="button"
            onClick={() => onSelect(c.consultor)}
            className="flex items-start gap-1.5 text-left group cursor-pointer"
          >
            <span
              className="mt-0.5 w-2.5 h-2.5 rounded-sm shrink-0 transition-opacity"
              style={{ backgroundColor: color, opacity: dimmed ? 0.2 : 1 }}
            />
            <span
              className={`text-[10px] leading-tight transition-colors ${
                selected === c.consultor
                  ? 'font-semibold text-slate-800'
                  : 'text-slate-500 group-hover:text-slate-700'
              }`}
            >
              {c.consultor}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function ConsultorRadar({ metricas }: ConsultorRadarProps) {
  const [selectedConsultor, setSelectedConsultor] = useState<string | null>(null)
  const w = useWindowWidth()
  const isMobile = w < 640
  const isTablet = w >= 640 && w < 1024

  const margin = isMobile
    ? { top: 8, right: 8, left: 8, bottom: 8 }
    : isTablet
      ? { top: 12, right: 20, left: 20, bottom: 12 }
      : { top: 16, right: 32, left: 32, bottom: 16 }
  const tickFontSize = isMobile ? 9 : isTablet ? 10 : 11
  const chartHeight = isMobile ? 280 : 320

  const rawData = metricas.consultorMetrics

  if (rawData.length <= 1) {
    return (
      <MetricaChartCard title="Perfil de consultores" className="mb-8">
        <EmptyState />
        <HowToReadGuide />
      </MetricaChartCard>
    )
  }

  const topConsultores = [...rawData].sort((a, b) => b.sesiones - a.sesiones).slice(0, 6)
  const maxSesiones = Math.max(1, ...topConsultores.map(c => c.sesiones))
  const maxDuracion = Math.max(1, ...topConsultores.map(c => c.duracionAvg))
  const maxProductos = Math.max(1, ...topConsultores.map(c => c.productos))

  const radarData = buildRadarData(topConsultores, maxSesiones, maxDuracion, maxProductos)
  const isAllMode = selectedConsultor === null

  const visibleConsultores = isAllMode
    ? topConsultores
    : topConsultores.filter(c => c.consultor === selectedConsultor)

  return (
    <MetricaChartCard title="Perfil de consultores" className="mb-8">
      <HowToReadGuide />
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setSelectedConsultor(null)}
          className={`px-3 py-1 rounded-lg text-xs border transition-colors cursor-pointer ${
            isAllMode
              ? 'bg-[#003087] text-white border-[#003087]'
              : 'bg-white text-slate-600 border-slate-200 hover:border-[#003087]'
          }`}
        >
          Todos
        </button>
      </div>
      <div className="flex items-center gap-4">
        <SideLegend
          consultores={topConsultores}
          colors={BAR_COLORS}
          selected={selectedConsultor}
          onSelect={(name) => setSelectedConsultor(prev => (prev === name ? null : name))}
        />
        <div className="flex-1 min-w-0">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RadarChart data={radarData} margin={margin}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis
                dataKey="subject"
                tick={(props: Record<string, unknown>) => <CustomAxisTick {...props} fontSize={tickFontSize} />}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                tickCount={5}
              />
              <Radar
                name={TEAM_AVG_KEY}
                dataKey={TEAM_AVG_KEY}
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                fill="#94a3b8"
                fillOpacity={isAllMode ? 0 : 0.1}
                dot={false}
              />
              {visibleConsultores.map((c) => {
                const colorIdx = topConsultores.findIndex(t => t.consultor === c.consultor)
                const isSelected = selectedConsultor === c.consultor
                return (
                  <Radar
                    key={c.consultor}
                    name={c.consultor}
                    dataKey={c.consultor}
                    stroke={BAR_COLORS[colorIdx % BAR_COLORS.length]}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    fill={BAR_COLORS[colorIdx % BAR_COLORS.length]}
                    fillOpacity={isSelected ? 0.2 : 0}
                    dot={false}
                  />
                )
              })}
              <Tooltip content={<RadarTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          {!isAllMode && (
            <p className="text-[10px] text-slate-400 text-center mt-1">
              — — Línea gris punteada = promedio del equipo
            </p>
          )}
        </div>
      </div>
    </MetricaChartCard>
  )
}
