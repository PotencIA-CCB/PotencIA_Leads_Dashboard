'use client'

import { useMetricas } from '@/hooks/useMetricas'
import { useState, useEffect } from 'react'
import { getCurrentConsultor } from '@/lib/supabase-browser'
import { GeneralKPIs } from '@/components/metricas/GeneralKPIs'
import { ProductividadKPIs } from '@/components/metricas/ProductividadKPIs'
import { RetentionFunnel } from '@/components/metricas/RetentionFunnel'
import { ConsultorRadar } from '@/components/metricas/ConsultorRadar'
import { HeatmapDrilldown } from '@/components/metricas/HeatmapDrilldown'
import InfoTooltip from '@/components/metricas/InfoTooltip'
import WordCloud from '@/components/metricas/WordCloud'
import { createClient } from '@/lib/supabase-browser'

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
  const [wordCloudSentences, setWordCloudSentences] = useState<string[]>([])

  useEffect(() => {
    if (loading || !metricas) return

    // Check sessionStorage cache first (5-min TTL)
    try {
      const cached = sessionStorage.getItem('insights_cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed.expiresAt > Date.now() && parsed.data) {
          setInsights(parsed.data)
          return
        }
      }
    } catch { /* corrupted cache — ignore and regenerate */ }

    // No valid cache → generate fresh insights
    generarInsights()
  }, [loading, metricas])

  // Fetch pregunta text from registro_sesion for word cloud
  useEffect(() => {
    async function cargarPreguntas() {
      const supabase = createClient()
      const { data } = await supabase
        .from('registro_sesion')
        .select('pregunta')
        .not('pregunta', 'is', null)
        .limit(200)
      if (data) {
        setWordCloudSentences(data.map((r: { pregunta: string }) => r.pregunta))
      }
    }
    cargarPreguntas()
  }, [])

  async function generarInsights() {
    setLoadingInsights(true)
    setInsightsError(null)
    try {
      const consultor = await getCurrentConsultor()
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_consultor: consultor?.id ?? null, minNew: 0 }),
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
        // Try fallback to stored insights on skip
        await cargarInsightsGuardados()
        return
      }
      if (!res.ok) {
        setInsightsError(data.error ?? 'Error generando insights.')
        // Fall back to stored insights on API failure
        await cargarInsightsGuardados()
        return
      }
      setInsights(data)
      // Cache in sessionStorage with 5-min TTL
      try {
        sessionStorage.setItem('insights_cache', JSON.stringify({
          data,
          expiresAt: Date.now() + 5 * 60 * 1000,
        }))
      } catch { /* sessionStorage full or unavailable — ignore */ }
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Error desconocido')
      await cargarInsightsGuardados()
    } finally {
      setLoadingInsights(false)
    }
  }

  /** Fallback: fetch stored insights from GET /api/insights and render */
  async function cargarInsightsGuardados() {
    try {
      const res = await fetch('/api/insights')
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
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
    } catch { /* fallback failed — already showing error from POST */ }
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
          { label: 'Total Consultorías', value: metricas.totalConsultorias, icon: 'event', sub: 'Resueltas + En seguimiento', helpText: 'Total de sesiones con estado Resuelto o En seguimiento. Fuente: consultorias.status' },
          { label: 'Resueltas', value: metricas.consultoriasResueltas, icon: 'task_alt', sub: 'Estado Resuelto', helpText: 'Sesiones con estado Resuelto. Fuente: consultorias.status' },
          { label: 'En Seguimiento', value: metricas.consultoriasEnSeguimientoAtendidas, icon: 'monitoring', sub: 'Consultorías atendidas en seguimiento', helpText: 'Consultorías atendidas con estado "En seguimiento". Fuente: consultorias.status filtrado por registro_sesion' },
          { label: '% Conversión', value: `${metricas.tasaConversion}%`, icon: 'trending_up', sub: 'Consultorías → Resuelto', helpText: 'Porcentaje de consultorías resueltas respecto al total. Fórmula: (Resuelto / Total) × 100. Fuente: consultorias.status' },
          { label: 'Productos generados', value: metricas.totalProductos, icon: 'inventory_2', sub: 'Total productos creados', helpText: 'Suma de cantidad_productos en registro_sesion. Fuente: registro_sesion.cantidad_productos' },
          {
            label: 'Horas de consultoría',
            value: metricas.totalMinutos === 0 ? '0 h' : `${(metricas.totalMinutos / 60).toFixed(1)} h`,
            icon: 'schedule',
            sub: 'Tiempo total de sesiones',
            helpText: 'Suma de duracion_minutos de todas las consultorías, expresado en horas. Fuente: consultorias.duracion_minutos',
          },
          { label: 'Eficiencia', value: metricas.eficiencia, icon: 'speed', sub: 'Productos por lead atendido', helpText: 'Productos totales dividido por leads únicos atendidos (Resuelto + En seguimiento). Fuente: registro_sesion.cantidad_productos / leads.id' },
          { label: 'Escalamientos', value: `${metricas.tasaEscalamiento}%`, icon: 'escalator_warning', sub: 'Sesiones escaladas', helpText: 'Porcentaje de consultorías con estado Escalar respecto al total. Fórmula: (Escalar / Total) × 100. Fuente: consultorias.status' },
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
            <p className="text-[10px] text-slate-400 mt-3">{kpi.sub}</p>
          </div>
        ))}
      </section>

      {/* GeneralKPIs — sesiones en el tiempo with granularity selector */}
      <GeneralKPIs metricas={metricas} consultorias={consultorias} />

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

      {/* ConsultorRadar — normalized radar per consultor */}
      <ConsultorRadar metricas={metricas} />

      {/* Word Cloud — what leads want to achieve */}
      <section className="bg-white rounded-[10px] border border-[#E5E7EB] shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h4
            className="text-sm font-bold text-[#003087] uppercase tracking-widest"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            ¿Qué quieren lograr?
          </h4>
          <p className="text-[11px] text-slate-400 mt-1">
            Palabras más frecuentes en las solicitudes de consultoría
          </p>
        </div>
        <WordCloud sentences={wordCloudSentences} />
      </section>

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
