'use client'

import { useMetricas } from '@/hooks/useMetricas'
import { useState, useEffect } from 'react'
import { GeneralKPIs } from '@/components/metricas/GeneralKPIs'
import { ProductividadKPIs } from '@/components/metricas/ProductividadKPIs'
import { RetentionFunnel } from '@/components/metricas/RetentionFunnel'
import { ConsultorRadar } from '@/components/metricas/ConsultorRadar'
import { HeatmapDrilldown } from '@/components/metricas/HeatmapDrilldown'
import InfoTooltip from '@/components/metricas/InfoTooltip'
import WordCloud from '@/components/metricas/WordCloud'
import { createClient } from '@/lib/supabase-browser'

export default function MetricasPage() {
  const { metricas, consultorias, loading } = useMetricas()
  // TASK-16: drill-down state for heatmap cell clicks
  const [heatmapDrilldown, setHeatmapDrilldown] = useState<{
    dia: string
    franja: string
    consultoriaIds: string[]
  } | null>(null)
  const [wordCloudSentences, setWordCloudSentences] = useState<string[]>([])

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

    </>
  )
}
