'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { type MetricasGlobales, type ConsultoriaForMetricas, type Granularidad, groupByPeriod, canonicalStatus } from '@/lib/metricas'
import { computeBrecha } from '@/lib/dashboardTransforms'
import { MetricaChartCard } from './MetricaChartCard'
import { PeriodGranularitySelector } from './PeriodGranularitySelector'
import InfoTooltip from './InfoTooltip'
import { useNovedades } from '@/hooks/useNovedades'
import type { Novedad } from '@/types'

interface GeneralKPIsProps {
  metricas: MetricasGlobales
  consultorias: ConsultoriaForMetricas[]
}

function ninetyDaysAgoISO(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().slice(0, 10)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function isoWeekPartsLocal(d: Date): { isoYear: number; isoWeek: number } {
  const target = new Date(d.valueOf())
  const dayOfWeek = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayOfWeek + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const firstThursdayDay = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDay + 3)
  const isoYear = target.getFullYear()
  const isoWeek = 1 + Math.round((target.valueOf() - firstThursday.valueOf()) / 604800000)
  return { isoYear, isoWeek }
}

function dateToKey(iso: string, period: Granularidad): string {
  if (period === 'dia') return iso.slice(0, 10)
  if (period === 'mes') return iso.slice(0, 7)
  if (period === 'año') return iso.slice(0, 4)
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  const { isoYear, isoWeek } = isoWeekPartsLocal(d)
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`
}

type NovedadWithConsultor = Novedad & { consultor_nombre?: string }

interface ChartTooltipProps {
  active?: boolean
  payload?: { dataKey: string; name: string; value: number; color: string }[]
  label?: string
  novedadesMap: Map<string, NovedadWithConsultor[]>
}

function ChartTooltip({ active, payload, label, novedadesMap }: ChartTooltipProps) {
  if (!active || !payload?.length || !label) return null
  const novs = novedadesMap.get(label) ?? []
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm text-xs max-w-[260px]">
      <p className="font-semibold text-[#003087] mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name === 'agendadas' ? 'Agendadas' : 'Resueltas'}:{' '}
          <span className="font-semibold">{p.value}</span>
        </p>
      ))}
      {payload.length >= 2 && (() => {
        const agendadas = payload.find(p => p.dataKey === 'agendadas')?.value ?? 0
        const resuelto = payload.find(p => p.dataKey === 'resuelto')?.value ?? 0
        return (
          <p className="text-slate-600 mt-0.5">
            Brecha: <span className="font-semibold">{computeBrecha(agendadas, resuelto)}</span>
          </p>
        )
      })()}
      {novs.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-2 space-y-2">
          <p className="text-[10px] text-[#E8470A] font-semibold uppercase tracking-wide">
            {novs.length === 1 ? 'Novedad' : 'Novedades'}
          </p>
          {novs.map(n => (
            <div key={n.id}>
              <p className="font-semibold text-slate-700 leading-snug">{n.titulo}</p>
              <p className="text-slate-500 mt-0.5 leading-snug">{n.contenido}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function GeneralKPIs({ metricas, consultorias }: GeneralKPIsProps) {
  const [period, setPeriod] = useState<Granularidad>('mes')
  const [range, setRange] = useState<{ start: string; end: string }>(() => ({
    start: ninetyDaysAgoISO(),
    end: todayISO(),
  }))
  const [showNovedades, setShowNovedades] = useState(false)

  const { novedades } = useNovedades()

  const filtered = useMemo(
    () =>
      consultorias.filter((c) => {
        if (!c.fecha) return false
        if (range.start && c.fecha < range.start) return false
        if (range.end && c.fecha > range.end) return false
        return true
      }),
    [consultorias, range],
  )

  const { chartData, keyToLabel } = useMemo(() => {
    const resueltoRaw = groupByPeriod(
      filtered.filter(c => canonicalStatus(c.status) === 'Resuelto'),
      period,
    )
    const agendadasRaw = groupByPeriod(filtered, period)
    const resueltoMap = new Map(resueltoRaw.map(d => [d.key, d.count]))
    const keyToLabel = new Map(
      agendadasRaw.map(d => [d.key, period === 'dia' ? dayLabel(d.label) : d.label])
    )
    const chartData = agendadasRaw.map(d => ({
      label: period === 'dia' ? dayLabel(d.label) : d.label,
      agendadas: d.count,
      resuelto: resueltoMap.get(d.key) ?? 0,
    }))
    return { chartData, keyToLabel }
  }, [filtered, period])

  const novedadesMap = useMemo(() => {
    const map = new Map<string, NovedadWithConsultor[]>()
    if (!showNovedades || novedades.length === 0) return map
    for (const n of novedades) {
      if (!n.fecha_inicio) continue
      if (range.start && n.fecha_inicio < range.start) continue
      if (range.end && n.fecha_inicio > range.end) continue
      const key = dateToKey(n.fecha_inicio, period)
      const label = keyToLabel.get(key)
      if (!label) continue
      const arr = map.get(label) ?? []
      arr.push(n)
      map.set(label, arr)
    }
    return map
  }, [novedades, showNovedades, period, keyToLabel, range])

  return (
    <MetricaChartCard
      title="Sesiones en el tiempo"
      className="mb-8"
      titleAdornment={
        <InfoTooltip helpText="Agendadas = sesiones programadas. Resueltas = con resultado registrado. La brecha = pendientes de resolver." />
      }
    >
      {/* KPI summary row */}
      <div className="flex flex-wrap gap-4 sm:gap-6 mb-5">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Total sesiones</p>
            <InfoTooltip helpText="Cantidad de sesiones efectivas registradas. Fuente: registro_sesion (count of rows)." />
          </div>
          <p className="text-2xl font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {metricas.totalConsultorias}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Empresas únicas</p>
            <InfoTooltip helpText="Cantidad de NIT únicos entre los leads con sesiones registradas. Fuente: registro_sesion → leads.nit" />
          </div>
          <p className="text-2xl font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {metricas.nitUnicos}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">(empresas con NIT registrado)</p>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 mb-4">
        <label className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
          Desde
          <input
            type="date"
            value={range.start}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            className="ml-0 sm:ml-1 w-full sm:w-auto text-[11px] border border-slate-200 rounded px-2 py-0.5 text-slate-700 focus:outline-none focus:border-[#004BB5]"
          />
        </label>
        <label className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
          Hasta
          <input
            type="date"
            value={range.end}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            className="ml-0 sm:ml-1 w-full sm:w-auto text-[11px] border border-slate-200 rounded px-2 py-0.5 text-slate-700 focus:outline-none focus:border-[#004BB5]"
          />
        </label>
        <button
          type="button"
          onClick={() => setRange({ start: '', end: '' })}
          className="text-[11px] font-semibold text-[#003087] border border-[#003087] rounded px-2 py-0.5 hover:bg-[#003087] hover:text-white transition-colors"
        >
          Todo
        </button>
      </div>

      {/* Granularity selector */}
      <div className="mb-4">
        <PeriodGranularitySelector value={period} onChange={setPeriod} />
      </div>

      {/* Novedades toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          role="switch"
          aria-checked={showNovedades}
          onClick={() => setShowNovedades(v => !v)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003087] ${showNovedades ? 'bg-[#E8470A]' : 'bg-slate-200'}`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showNovedades ? 'translate-x-4' : 'translate-x-0.5'}`}
          />
        </button>
        <span className="text-[11px] text-slate-500 font-medium select-none">
          Mostrar novedades
        </span>
        {showNovedades && novedadesMap.size > 0 && (
          <span className="text-[10px] text-[#E8470A] font-medium">
            ({novedadesMap.size} en este período)
          </span>
        )}
      </div>

      {/* Chart */}
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[300px]">
          <p className="text-sm text-slate-400">Sin datos para el período seleccionado.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAgendadoGKPI" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00C8FF" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#00C8FF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorResueltoGKPI" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#003087" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#003087" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval={period === 'dia' ? 'preserveStartEnd' : 0}
            />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  payload={props.payload as unknown as ChartTooltipProps['payload']}
                  label={props.label as string}
                  novedadesMap={novedadesMap}
                />
              )}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value: string) => value === 'agendadas' ? 'Agendadas' : 'Resueltas'}
            />
            {showNovedades && Array.from(novedadesMap.keys()).map(label => (
              <ReferenceLine
                key={label}
                x={label}
                stroke="#E8470A"
                strokeDasharray="4 2"
                strokeWidth={1.5}
              />
            ))}
            <Area
              type="monotone"
              dataKey="agendadas"
              name="agendadas"
              stroke="#00C8FF"
              fill="url(#colorAgendadoGKPI)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="resuelto"
              name="resuelto"
              stroke="#003087"
              fill="url(#colorResueltoGKPI)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </MetricaChartCard>
  )
}
