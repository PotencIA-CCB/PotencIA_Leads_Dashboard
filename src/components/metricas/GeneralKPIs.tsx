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
} from 'recharts'
import { type MetricasGlobales, type ConsultoriaForMetricas, type Granularidad, groupByPeriod, canonicalStatus } from '@/lib/metricas'
import { MetricaChartCard } from './MetricaChartCard'
import { PeriodGranularitySelector } from './PeriodGranularitySelector'
import InfoTooltip from './InfoTooltip'

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

/** Format a YYYY-MM-DD label as DD/MM for readability. */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function GeneralKPIs({ metricas, consultorias }: GeneralKPIsProps) {
  const [period, setPeriod] = useState<Granularidad>('mes')
  const [range, setRange] = useState<{ start: string; end: string }>(() => ({
    start: ninetyDaysAgoISO(),
    end: todayISO(),
  }))

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

  const mergedData = useMemo(() => {
    const resueltoRaw = groupByPeriod(
      filtered.filter(c => canonicalStatus(c.status) === 'Resuelto'),
      period,
    )
    const agendadasRaw = groupByPeriod(filtered, period)

    const resueltoMap = new Map(resueltoRaw.map(d => [d.label, d.count]))

    return agendadasRaw.map(d => ({
      label: period === 'dia' ? dayLabel(d.label) : d.label,
      agendadas: d.count,
      resuelto: resueltoMap.get(d.label) ?? 0,
    }))
  }, [filtered, period])

  return (
    <MetricaChartCard title="Sesiones en el tiempo" className="mb-8">
      {/* KPI summary row */}
      <div className="flex flex-wrap gap-4 sm:gap-6 mb-5">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Total sesiones</p>
            <InfoTooltip helpText="Cantidad de sesiones efectivas registradas. Fuente: registro_sesion (count of rows)." />
          </div>
          <p className="text-2xl font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {metricas.totalConsultorias}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Empresas únicas</p>
            <InfoTooltip helpText="Cantidad de NIT únicos entre los leads con sesiones registradas. Fuente: registro_sesion → leads.nit" />
          </div>
          <p className="text-2xl font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {metricas.nitUnicos}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">(empresas con NIT registrado)</p>
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

      {/* Chart */}
      {mergedData.length === 0 ? (
        <div className="flex items-center justify-center h-[300px]">
          <p className="text-sm text-slate-400">Sin datos para el período seleccionado.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={mergedData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAgendado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00C8FF" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#00C8FF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorResuelto" x1="0" y1="0" x2="0" y2="1">
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
              contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #E5E7EB' }}
              labelStyle={{ fontWeight: 600, fontSize: 12, color: '#003087' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value: string) => value === 'agendadas' ? 'Agendadas' : 'Resueltas'}
            />
            <Area
              type="monotone"
              dataKey="agendadas"
              name="agendadas"
              stroke="#00C8FF"
              fill="url(#colorAgendado)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="resuelto"
              name="resuelto"
              stroke="#003087"
              fill="url(#colorResuelto)"
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
