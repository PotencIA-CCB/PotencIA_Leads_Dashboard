'use client'

import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { type MetricasGlobales } from '@/lib/metricas'
import { MetricaChartCard } from './MetricaChartCard'
import InfoTooltip from './InfoTooltip'

interface RetentionFunnelProps {
  metricas: MetricasGlobales
}

const BAR_COLORS = ['#003087', '#00C8FF', '#004BB5', '#E8470A', '#5A6475', '#6366F1']

export function RetentionFunnel({ metricas }: RetentionFunnelProps) {
  const totalAgendadas = metricas.porEstado.reduce((sum, e) => sum + e.total, 0)
  const totalAtendidas = metricas.porEstado
    .filter(e => ['Resuelto', 'En seguimiento', 'Escalar'].includes(e.status))
    .reduce((sum, e) => sum + e.total, 0)
  const totalResueltas = metricas.consultoriasResueltas

  const funnelData = [
    { value: totalAgendadas, name: 'Total agendadas', fill: '#C7D9FF' },
    { value: totalAtendidas, name: 'Atendidas', fill: '#004BB5' },
    { value: totalResueltas, name: 'Resueltas', fill: '#003087' },
  ]

  const retentionData = metricas.distribucionRetorno.map(d => ({
    ...d,
    label: d.visitas >= 4 ? '4+' : `${d.visitas}`,
  }))

  return (
    <MetricaChartCard title="Retención y funnel de conversión" className="mb-8">
      {/* KPI row */}
      <div className="flex flex-wrap gap-6 mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Leads con consultoría</p>
            <InfoTooltip helpText="Cantidad de leads únicos que tienen al menos una consultoría registrada. Fuente: consultorias.id_lead (DISTINCT)" />
          </div>
          <p className="text-2xl font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {metricas.leadsConConsultoria}
          </p>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Tasa de retorno</p>
            <InfoTooltip helpText="Comparativo entre sesiones atendidas y agendadas. Fórmula: (total atendidas / total agendadas) × 100. Atendidas = Resuelto + En seguimiento + Escalar. Fuente: consultorias.status" />
          </div>
          <p className="text-2xl font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {metricas.tasaRetorno}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">agendadas / atendidas</p>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Sin consultoría</p>
            <InfoTooltip helpText="Leads que no tienen ninguna consultoría registrada (total de leads menos leads con consultoría). Fuente: leads vs consultorias" />
          </div>
          <p className="text-2xl font-bold text-[#E8470A]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {metricas.leadsSinConsultoria}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">leads huérfanos</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Funnel */}
        <div>
          <p className="text-[11px] text-slate-400 font-medium mb-2 uppercase tracking-wide">Funnel de consultoría</p>
          <ResponsiveContainer width="100%" height={220}>
            <FunnelChart>
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
                <LabelList
                  position="right"
                  fill="#374151"
                  stroke="none"
                  dataKey="name"
                  style={{ fontSize: 11 }}
                />
              </Funnel>
              <Tooltip formatter={(value, name) => [value, name]} />
            </FunnelChart>
          </ResponsiveContainer>
        </div>

        {/* Retention bar chart */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Distribución de visitas por lead</p>
            <InfoTooltip helpText="Cantidad de leads agrupados por número de visitas (sesiones) que han tenido. Cada barra muestra cuántos leads registran 1, 2, 3 o 4+ consultorías. Fuente: consultorias.id_lead (DISTINCT count por lead)." />
          </div>
          {metricas.distribucionRetorno.every(d => d.leads === 0) ? (
            <div className="flex items-center justify-center h-[220px]">
              <p className="text-sm text-slate-400">Sin datos disponibles.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={retentionData}
                margin={{ top: 4, right: 16, left: 0, bottom: 28 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} label={{ value: 'Visitas', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} label={{ value: 'Leads', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10 }} />
                <Tooltip formatter={(value) => [value, 'Leads']} labelFormatter={(label) => `${label} visita${label === '1' ? '' : 's'}`} />
                <Bar dataKey="leads" radius={[4, 4, 0, 0]}>
                  {retentionData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </MetricaChartCard>
  )
}
