'use client'

import { useState, useEffect } from 'react'
import { useBusinessIntelligence } from '@/hooks/useBusinessIntelligence'
import { useMetricas } from '@/hooks/useMetricas'
import { StatCard } from '@/components/dashboard/StatCard'
import LeadsFunnel from '@/components/dashboard/LeadsFunnel'
import InsightSection from '@/components/dashboard/InsightSection'
import { GeneralKPIs } from '@/components/metricas/GeneralKPIs'
import { ProductividadKPIs } from '@/components/metricas/ProductividadKPIs'
import { RetentionFunnel } from '@/components/metricas/RetentionFunnel'
import { ConsultorRadar } from '@/components/metricas/ConsultorRadar'
import { HeatmapDrilldown } from '@/components/metricas/HeatmapDrilldown'
import InfoTooltip from '@/components/metricas/InfoTooltip'
import ToolsCloud from '@/components/metricas/ToolsCloud'
import type { ToolsStatus } from '@/components/metricas/ToolsCloud'
import type { FunnelStats } from '@/lib/capturaStats'

const emptyFunnelStats: FunnelStats = {
  totalLandingLeads: 0,
  landingNeverBooked: 0,
  landingBooked: 0,
  noShows: 0,
  cicloCompleto: 0,
  bookedNoLandingDirecto: 0,
  soloBookedNoSession: 0,
}

export default function BIPage() {
  const { biStats, funnelStats, totalBookings, loading: biLoading } = useBusinessIntelligence()
  const { metricas, consultorias, loading: metricasLoading } = useMetricas()

  const [heatmapDrilldown, setHeatmapDrilldown] = useState<{
    dia: string
    franja: string
    consultoriaIds: string[]
  } | null>(null)
  const [tools, setTools] = useState<{ label: string; count: number }[]>([])
  const [toolsStatus, setToolsStatus] = useState<ToolsStatus>('loading')

  // Fetch cached tools from GET /api/herramientas; fire-and-forget POST when cache is empty
  useEffect(() => {
    async function fetchTools() {
      try {
        const res = await fetch('/api/herramientas')
        if (!res.ok) throw new Error('fetch failed')
        const body = await res.json() as { herramientas: { label: string; count: number }[]; generated_at: string | null }
        setTools(body.herramientas ?? [])
        setToolsStatus('ready')
        // Trigger threshold-gated generation if cache is empty (fire-and-forget)
        if (!body.herramientas || body.herramientas.length === 0) {
          fetch('/api/herramientas', { method: 'POST' }).catch(() => { /* non-blocking */ })
        }
      } catch {
        setToolsStatus('error')
      }
    }
    fetchTools()
  }, [])

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider list-none p-0 m-0">
            <li className="flex items-center">
              <span>Analysis</span>
              <span className="material-symbols-outlined text-[14px] mx-1" aria-hidden="true">chevron_right</span>
            </li>
            <li>
              <span className="text-[#00C8FF]" aria-current="page">Business Intelligence</span>
            </li>
          </ol>
        </nav>
        <div>
          <h2
            className="text-[34px] font-extrabold text-[#001d59] tracking-tight leading-tight"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Business Intelligence
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Indicadores de resultado y embudo de captura del programa PotencIA.
          </p>
        </div>
      </div>

      {/* ================================================================
          SECTION 1 — NUMERIC INDICATORS (all KPI tiles / stat cards)
          Both hook loading states are independent — each gates its own block.
          ================================================================ */}
      <div data-testid="kpi-section">

        {/* 1a — Indicadores Globales (from useMetricas) */}
        <section aria-labelledby="global-indicators-heading" className="mb-6">
          <h3
            id="global-indicators-heading"
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Indicadores Globales
          </h3>

          {metricasLoading ? (
            <SkeletonKPIGrid count={6} />
          ) : !metricas ? (
            <p className="text-sm text-red-400">Error al cargar indicadores globales.</p>
          ) : (
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
              {[
                {
                  label: 'Total Consultorías',
                  value: metricas.totalConsultorias,
                  icon: 'event',
                  sub: 'Sesiones efectivas realizadas',
                  helpText: 'Cantidad de sesiones efectivas realizadas. Fuente: registro_sesion (count of rows).',
                },
                {
                  label: 'Resueltas',
                  value: metricas.consultoriasResueltas,
                  icon: 'task_alt',
                  sub: 'Estado Resuelto',
                  helpText: 'Sesiones con estado Resuelto. Fuente: consultorias.status',
                },
                {
                  label: 'En Seguimiento',
                  value: metricas.consultoriasEnSeguimientoAtendidas,
                  icon: 'monitoring',
                  sub: 'Consultorías atendidas en seguimiento',
                  helpText: 'Consultorías atendidas con estado "En seguimiento". Fuente: consultorias.status filtrado por registro_sesion',
                },
                {
                  label: '% Conversión',
                  value: `${metricas.tasaConversion.toFixed(2)}%`,
                  icon: 'trending_up',
                  sub: 'Sesiones / reservas únicas',
                  helpText: 'Sesiones efectivas / reservas únicas (booking_id distintos). Fórmula: registro_sesion.count / DISTINCT consultorias.booking_id × 100.',
                },
                {
                  label: 'Productos generados',
                  value: metricas.totalProductos,
                  icon: 'inventory_2',
                  sub: 'Total productos creados',
                  helpText: 'Suma de cantidad_productos en registro_sesion. Fuente: registro_sesion.cantidad_productos',
                },
                {
                  label: 'Horas de consultoría',
                  value: metricas.totalMinutos === 0 ? '0 h' : `${(metricas.totalMinutos / 60).toFixed(1)} h`,
                  icon: 'schedule',
                  sub: 'Tiempo total de sesiones',
                  helpText: 'Suma de duracion_sesion_minutos de las sesiones registradas, expresado en horas. Fuente: registro_sesion.duracion_sesion_minutos.',
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="bg-white p-6 rounded-[10px] border-t-[3px] border-[#004BB5] border border-[#E5E7EB] shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px] text-[#5A6475] font-medium tracking-tight">{kpi.label}</p>
                      <InfoTooltip helpText={kpi.helpText} />
                    </div>
                    <span className="material-symbols-outlined text-[#00C8FF] text-xl">{kpi.icon}</span>
                  </div>
                  <h3
                    className="text-2xl sm:text-3xl lg:text-[32px] font-bold text-[#003087] leading-none"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    {kpi.value}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-3">{kpi.sub}</p>
                </div>
              ))}
            </section>
          )}
        </section>

        {/* 1b — Indicadores de Resultado (from useBusinessIntelligence) */}
        <section aria-labelledby="result-indicators-heading" className="mb-8">
          <h3
            id="result-indicators-heading"
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Indicadores de Resultado
          </h3>

          {biLoading ? (
            <SkeletonStatCards />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Total Empresas Registradas"
                value={biStats?.totalEmpresasRegistradas ?? 0}
                accent="text-[#003087]"
                helpText="NITs únicos registrados sin importar estado. Fuente: leads.nit (DISTINCT, no nulos)"
                icon="domain"
                subtitle="NITs únicos registrados"
              />
              <StatCard
                label="Empresas con NITs válidos"
                value={biStats?.empresasNitsValidos ?? 0}
                accent="text-[#003087]"
                helpText="NITs únicos con estado Renovado, No renovado o Proponentes. Excluye Sin dato."
                icon="verified"
                subtitle="NITs con estado de renovación válido"
              />
              <StatCard
                label="Empresas Renovadas"
                value={biStats?.empresasRenovadas ?? 0}
                accent="text-[#003087]"
                helpText="NITs únicos donde renovado = 'Renovado'"
                icon="autorenew"
                subtitle="Empresas con renovación activa"
              />
            </div>
          )}
        </section>

      </div>{/* end kpi-section */}

      {/* ================================================================
          SECTION 2 — CHARTS (all visualizations, below KPI tiles)
          ================================================================ */}
      <div data-testid="charts-section">

        {/* Embudo de Captura */}
        <section aria-labelledby="process-indicators-heading" className="mb-8">
          <h3
            id="process-indicators-heading"
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Indicadores de Proceso
          </h3>
          <LeadsFunnel
            stats={funnelStats ?? emptyFunnelStats}
            totalBookings={totalBookings}
          />
        </section>

        {/* Resumen Ejecutivo con IA */}
        <section aria-labelledby="insights-heading" className="mb-8">
          <h3
            id="insights-heading"
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Resumen Ejecutivo
          </h3>
          <InsightSection ready={!biLoading} />
        </section>

        {/* Metricas charts — gated on metricas data */}
        {!metricasLoading && metricas && (
          <>
            {/* Sesiones en el tiempo */}
            <GeneralKPIs metricas={metricas} consultorias={consultorias} />

            {/* Productividad + Heatmap drill-down */}
            <ProductividadKPIs
              metricas={metricas}
              onCellClick={(cell) => setHeatmapDrilldown(cell)}
            />
            <HeatmapDrilldown
              consultorias={consultorias}
              cell={heatmapDrilldown}
              onClose={() => setHeatmapDrilldown(null)}
            />

            {/* Funnel de retención */}
            <RetentionFunnel metricas={metricas} />

            {/* Radar por consultor */}
            <ConsultorRadar metricas={metricas} />

            {/* Herramientas más usadas */}
            <section className="bg-white rounded-[10px] border border-[#E5E7EB] shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100">
                <h4
                  className="text-sm font-bold text-[#003087] uppercase tracking-widest"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  Herramientas IA más usadas
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Herramientas IA más utilizadas en las sesiones de consultoría
                </p>
              </div>
              <ToolsCloud tools={tools} status={toolsStatus} />
            </section>
          </>
        )}

      </div>{/* end charts-section */}
    </>
  )
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function SkeletonKPIGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white p-6 rounded-[10px] border-t-[3px] border-slate-200 border border-slate-100 shadow-sm animate-pulse"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="h-3 bg-slate-200 rounded w-2/3" />
            <div className="h-5 w-5 bg-slate-200 rounded" />
          </div>
          <div className="h-8 bg-slate-200 rounded w-1/2 mt-2" />
          <div className="h-2 bg-slate-200 rounded w-3/4 mt-3" />
        </div>
      ))}
    </div>
  )
}

function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4 animate-pulse"
        >
          <div className="flex items-start justify-between">
            <div className="h-2.5 bg-slate-200 rounded w-3/4" />
            <div className="h-8 w-8 bg-slate-200 rounded-lg" />
          </div>
          <div className="h-8 bg-slate-200 rounded w-1/2 mt-3" />
          <div className="h-2 bg-slate-200 rounded w-2/3 mt-2" />
        </div>
      ))}
    </div>
  )
}
