'use client'

import { useMetricas } from '@/hooks/useMetricas'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { getCurrentConsultor } from '@/lib/supabase-browser'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { GeneralKPIs } from '@/components/metricas/GeneralKPIs'
import { ProductividadKPIs } from '@/components/metricas/ProductividadKPIs'
import { RetentionFunnel } from '@/components/metricas/RetentionFunnel'
import { QualityKPIs } from '@/components/metricas/QualityKPIs'
import { ConsultorRadar } from '@/components/metricas/ConsultorRadar'
import { HeatmapDrilldown } from '@/components/metricas/HeatmapDrilldown'

const CiudadMap = dynamic(() => import('@/components/metricas/CiudadMap'), { ssr: false })

const DONUT_COLORS = ['#003087', '#00C8FF', '#E8470A', '#004BB5']

const STATUS_STACK_COLORS: Record<string, string> = {
  Agendado: '#00C8FF',
  'En seguimiento': '#6366F1',
  Resuelto: '#003087',
  Cancelado: '#E8470A',
  Otros: '#A78BFA',
}

type InsightsState = {
  insights: string[]
  recomendaciones: string[]
  alertas: string[]
} | null

export default function MetricasPage() {
  const { metricas, consultorias, loading } = useMetricas()
  const [insights, setInsights] = useState<InsightsState>(null)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  // TASK-16: drill-down state for heatmap cell clicks
  const [heatmapDrilldown, setHeatmapDrilldown] = useState<{
    dia: string
    franja: string
    consultoriaIds: string[]
  } | null>(null)

  useEffect(() => {
    async function cargarUltimoInsight() {
      const res = await fetch('/api/insights')
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) {
        generarInsights()
        return
      }
      setInsights({
        insights: data
          .filter((r: { tipo: string; valor_texto: string }) => r.tipo === 'insight')
          .map((r: { tipo: string; valor_texto: string }) => r.valor_texto),
        recomendaciones: data
          .filter((r: { tipo: string; valor_texto: string }) => r.tipo === 'recomendacion')
          .map((r: { tipo: string; valor_texto: string }) => r.valor_texto),
        alertas: data
          .filter((r: { tipo: string; valor_texto: string }) => r.tipo === 'alerta')
          .map((r: { tipo: string; valor_texto: string }) => r.valor_texto),
      })
    }
    if (!loading && metricas) cargarUltimoInsight()
  }, [loading, metricas])

  async function generarInsights() {
    setLoadingInsights(true)
    setInsightsError(null)
    try {
      const consultor = await getCurrentConsultor()
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_consultor: consultor?.id ?? null }),
      })
      const data = await res.json()
      if (data.skipped === true) {
        if (data.reason === 'threshold_not_met') {
          setInsightsError(
            `No hay suficientes datos nuevos para generar insights (se necesitan ${data.details?.threshold} nuevas consultorías).`,
          )
        } else if (data.reason === 'config_missing') {
          setInsightsError('Configuración incompleta. Verificá las variables de entorno.')
        } else {
          setInsightsError('No se pudieron generar insights.')
        }
        return
      }
      if (!res.ok) {
        setInsightsError(data.error ?? 'Error generando insights.')
        return
      }
      setInsights(data)
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoadingInsights(false)
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-slate-400">Cargando métricas...</p>
      </div>
    )
  if (!metricas)
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-red-400">Error al cargar métricas.</p>
      </div>
    )

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider list-none p-0 m-0">
            <li className="flex items-center">
              <span>Analysis</span>
              <span className="material-symbols-outlined text-[14px] mx-1" aria-hidden="true">
                chevron_right
              </span>
            </li>
            <li>
              <span className="text-[#00C8FF]" aria-current="page">
                Métricas
              </span>
            </li>
          </ol>
        </nav>
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#001d59] tracking-tight"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Métricas Globales
        </h2>
      </div>

      {/* KPI Cards — 8 tiles */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Consultorías', value: metricas.totalConsultorias, icon: 'event', sub: 'Resueltas + En seguimiento' },
          { label: 'Resueltas', value: metricas.consultoriasResueltas, icon: 'task_alt', sub: 'Estado Resuelto' },
          { label: 'En Seguimiento', value: metricas.casosEnSeguimientoLeads, icon: 'monitoring', sub: 'Leads en seguimiento' },
          { label: '% Conversión', value: `${metricas.tasaConversion}%`, icon: 'trending_up', sub: 'Consultorías → Resuelto' },
          { label: 'Productos generados', value: metricas.totalProductos, icon: 'inventory_2', sub: 'Total productos creados' },
          {
            label: 'Horas de consultoría',
            value: metricas.totalMinutos === 0 ? '0 h' : `${(metricas.totalMinutos / 60).toFixed(1)} h`,
            icon: 'schedule',
            sub: 'Tiempo total de sesiones',
          },
          { label: 'Eficiencia', value: metricas.eficiencia, icon: 'speed', sub: 'Productos por lead atendido' },
          { label: 'Escalamientos', value: `${metricas.tasaEscalamiento}%`, icon: 'escalator_warning', sub: 'Sesiones escaladas' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white p-6 rounded-[10px] border-t-[3px] border-[#004BB5] border border-[#E5E7EB] shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <p className="text-[12px] text-[#5A6475] font-medium tracking-tight">{kpi.label}</p>
              <span className="material-symbols-outlined text-[#00C8FF] text-xl">{kpi.icon}</span>
            </div>
            <h3
              className="text-2xl sm:text-3xl lg:text-[32px] font-bold text-[#003087] leading-none"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {kpi.value}
            </h3>
            <p className="text-[10px] text-slate-400 mt-3">{kpi.sub}</p>
          </div>
        ))}
      </section>

      {/* GeneralKPIs — sesiones en el tiempo with granularity selector */}
      <GeneralKPIs metricas={metricas} consultorias={consultorias} />

      {/* Charts — ciudad + estado */}
      <section className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white p-4 sm:p-6 lg:p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm flex flex-col">
          <h4
            className="text-lg font-bold text-[#003087] mb-6"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Distribución por departamento
          </h4>
          <CiudadMap data={metricas.porDepartamento} sinUbicacion={metricas.sinUbicacion} />
        </div>

        <div className="col-span-12 md:col-span-6 lg:col-span-5 bg-white p-4 sm:p-6 lg:p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm h-auto md:h-95 flex flex-col">
          <h4
            className="text-lg font-bold text-[#003087] mb-6"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Estado consultorías
          </h4>
          <div className="flex-1 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-[200px] h-[200px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metricas.porEstado}
                    dataKey="total"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                  >
                    {metricas.porEstado.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-3">
              {metricas.porEstado.map((e, i) => (
                <div key={e.status} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                  />
                  <span className="text-xs text-slate-600 font-medium">
                    {e.status} ({e.total})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Origen × estado (stacked bar) */}
        <div className="col-span-12 md:col-span-12 lg:col-span-3 bg-white p-4 sm:p-6 lg:p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm flex flex-col">
          <h4
            className="text-lg font-bold text-[#003087] mb-4"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Origen × estado
          </h4>
          {metricas.origenStatusBreakdown.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-slate-400">Sin datos de origen.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220} minWidth={0}>
                <BarChart
                  data={metricas.origenStatusBreakdown}
                  margin={{ top: 0, right: 8, left: 0, bottom: 20 }}
                >
                  <XAxis
                    dataKey="origen"
                    tick={{ fontSize: 9 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  {Object.entries(STATUS_STACK_COLORS).map(([status, color]) => (
                    <Bar key={status} dataKey={status} stackId="status" fill={color} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                {Object.entries(STATUS_STACK_COLORS).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                    <span className="text-[10px] text-slate-500 font-medium">{status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ProductividadKPIs — 7 charts in a 2-column grid */}
      <ProductividadKPIs
        metricas={metricas}
        onCellClick={(cell) => setHeatmapDrilldown(cell)}
      />

      {/* TASK-16: Heatmap drill-down panel — shown inline below the charts when a cell is clicked */}
      <HeatmapDrilldown
        consultorias={consultorias}
        cell={heatmapDrilldown}
        onClose={() => setHeatmapDrilldown(null)}
      />

      {/* RetentionFunnel — funnel + retention distribution */}
      <RetentionFunnel metricas={metricas} />

      {/* QualityKPIs — radial KPIs + scatter */}
      <QualityKPIs metricas={metricas} />

      {/* ConsultorRadar — normalized radar per consultor */}
      <ConsultorRadar metricas={metricas} />

      {/* AI Insights */}
      <section className="bg-white rounded-[10px] border border-[#E5E7EB] shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4
            className="text-sm font-bold text-[#003087] uppercase tracking-widest"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Insights con IA
          </h4>
          <button
            onClick={generarInsights}
            disabled={loadingInsights}
            className="text-xs font-semibold text-[#003087] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">
              {loadingInsights ? 'hourglass_empty' : 'refresh'}
            </span>
            {loadingInsights ? 'Generando' : 'Actualizar'}
          </button>
        </div>

        {!insights && !loadingInsights && !insightsError && (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-400">
              Haz clic en <strong className="text-slate-600">Actualizar</strong> para generar
              análisis basado en los datos actuales.
            </p>
          </div>
        )}
        {insightsError && !loadingInsights && (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-amber-600">{insightsError}</p>
          </div>
        )}
        {loadingInsights && (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-400">Analizando datos…</p>
          </div>
        )}
        {insights && !loadingInsights && (
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <InsightColumn title="Insights" items={insights.insights} />
            <InsightColumn title="Recomendaciones" items={insights.recomendaciones} />
            <InsightColumn title="Atención" items={insights.alertas} />
          </div>
        )}
      </section>
    </>
  )
}

function InsightColumn({ title, items }: { title: string; items: string[] | undefined }) {
  return (
    <div className="px-6 py-5">
      <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
        {title}
      </h5>
      {!items || items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Sin datos</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-slate-600 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
