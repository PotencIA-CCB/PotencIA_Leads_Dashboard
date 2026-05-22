'use client'

import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { type MetricasGlobales, type ConsultoriaForMetricas, type Granularidad, groupByPeriod } from '@/lib/metricas'
import { MetricaChartCard } from './MetricaChartCard'
import { PeriodGranularitySelector } from './PeriodGranularitySelector'

interface GeneralKPIsProps {
  metricas: MetricasGlobales
  consultorias: ConsultoriaForMetricas[]
}

export function GeneralKPIs({ metricas, consultorias }: GeneralKPIsProps) {
  const [period, setPeriod] = useState<Granularidad>('mes')

  const periodData = useMemo(
    () => groupByPeriod(consultorias, period),
    [consultorias, period],
  )

  return (
    <MetricaChartCard title="Sesiones en el tiempo" className="mb-8">
      {/* KPI summary row */}
      <div className="flex flex-wrap gap-6 mb-5">
        <div>
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Total sesiones</p>
          <p className="text-2xl font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {metricas.totalConsultorias}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Empresas únicas</p>
          <p className="text-2xl font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {metricas.nitUnicos}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">(empresas con NIT registrado)</p>
        </div>
      </div>

      {/* Granularity selector */}
      <div className="mb-4">
        <PeriodGranularitySelector value={period} onChange={setPeriod} />
      </div>

      {/* Chart */}
      {periodData.length === 0 ? (
        <div className="flex items-center justify-center h-[300px]">
          <p className="text-sm text-slate-400">Sin datos para el período seleccionado.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={periodData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#003087"
              strokeWidth={3}
              dot={{ fill: '#003087', r: 4, stroke: 'white', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </MetricaChartCard>
  )
}
