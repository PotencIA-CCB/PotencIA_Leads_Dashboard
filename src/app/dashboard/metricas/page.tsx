'use client'

import { useMetricas } from '@/hooks/useMetricas'
import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

const DONUT_COLORS = ['#003087', '#00C8FF', '#E8470A', '#004BB5']

export default function MetricasPage() {
  const { metricas, loading } = useMetricas()
  const [insights, setInsights] = useState<{ insights: string[]; recomendaciones: string[]; alertas: string[] } | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)

  useEffect(() => {
    async function cargarUltimoInsight() {
      const res = await fetch('/api/insights')
      const data = await res.json()
      if (data) setInsights(data)
    }
    if (!loading && metricas) cargarUltimoInsight()
  }, [loading, metricas])

  async function generarInsights() {
    setLoadingInsights(true)
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setInsights(data)
    } catch (e) {
      console.error(e)
    }
    setLoadingInsights(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-slate-400">Cargando métricas...</p>
    </div>
  )
  if (!metricas) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-red-400">Error al cargar métricas.</p>
    </div>
  )

  const resueltos = metricas.porEstado.find((e) => e.status === 'Resuelto')?.total || 0
  const enSeguimiento = metricas.porEstado.find((e) => e.status === 'En seguimiento')?.total || 0
  

  // Casos de uso con porcentaje
  const maxSolucion = Math.max(...metricas.porSolucion.map((s) => s.total), 1)
  const porSolucionPct = metricas.porSolucion.map((s) => ({
    ...s,
    pct: Math.round((s.total / metricas.totalLeads) * 100),
    barPct: Math.round((s.total / maxSolucion) * 100),
  }))

  const barColors = ['#003087', '#00C8FF', '#004BB5', '#E8470A', '#5A6475', '#003087']

  return (
    <>
      {/* Section Header */}
      <div className="mb-8">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider list-none p-0 m-0">
            <li className="flex items-center">
              <span>Analysis</span>
              <span className="material-symbols-outlined text-[14px] mx-1" aria-hidden="true">chevron_right</span>
            </li>
            <li>
              <span className="text-[#00C8FF]" aria-current="page">Métricas</span>
            </li>
          </ol>
        </nav>
        <h2 className="text-4xl font-extrabold text-[#001d59] tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Métricas Globales
        </h2>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Leads', value: metricas.totalLeads, icon: 'person_search', sub: 'Registrados' },
          { label: 'Sesiones Completadas', value: resueltos, icon: 'task_alt', sub: 'Estado Resuelto' },
          { label: 'En Seguimiento', value: enSeguimiento, icon: 'monitoring', sub: 'Active pipeline' },
          { label: '% Conversión', value: `${metricas.tasaConversion}%`, icon: 'trending_up', sub: 'Leads → Resuelto' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white p-6 rounded-[10px] border-t-[3px] border-[#004BB5] border border-[#E5E7EB] shadow-sm hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[12px] text-[#5A6475] font-medium tracking-tight">{kpi.label}</p>
              <span className="material-symbols-outlined text-[#00C8FF] text-xl">{kpi.icon}</span>
            </div>
            <h3 className="text-[32px] font-bold text-[#003087] leading-none" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{kpi.value}</h3>
            <p className="text-[10px] text-slate-400 mt-3">{kpi.sub}</p>
          </div>
        ))}
      </section>

      {/* Charts Row 1 */}
      <section className="grid grid-cols-12 gap-6 mb-8">

        {/* Line Chart: Leads por semana */}
        <div className="col-span-12 lg:col-span-8 bg-white p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-lg font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Leads por semana</h4>
              <p className="text-xs text-slate-400">Evolución histórica de captación de leads</p>
            </div>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={metricas.porSemana}>
                <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#003087" strokeWidth={3} dot={{ fill: '#003087', r: 5, stroke: 'white', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Leads por ciudad */}
        <div className="col-span-12 lg:col-span-4 bg-white p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm h-[400px] flex flex-col">
          <h4 className="text-lg font-bold text-[#003087] mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Leads por ciudad</h4>
          <div className="flex-1 flex items-end justify-around gap-2 px-2 pb-6 border-b border-slate-100 relative">
            {metricas.porCiudad.map((c, i) => {
              const maxCity = Math.max(...metricas.porCiudad.map((x) => x.total), 1)
              const heightPct = Math.round((c.total / maxCity) * 100)
              return (
                <div key={c.city} className="w-full flex flex-col items-center group">
                  <div
                    className="w-8 rounded-t-sm transition-all group-hover:opacity-80"
                    style={{ height: `${heightPct}%`, background: barColors[i % barColors.length], minHeight: '8px' }}
                  />
                  <p className="text-[10px] text-slate-500 mt-2 text-center">{c.city.slice(0, 5)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Charts Row 2 */}
      <section className="grid grid-cols-12 gap-6 mb-8">

        {/* Donut: Estado consultorías */}
        <div className="col-span-12 lg:col-span-5 bg-white p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm h-[380px] flex flex-col">
          <h4 className="text-lg font-bold text-[#003087] mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Estado consultorías</h4>
          <div className="flex-1 flex items-center justify-between gap-4">
            <div style={{ width: 200, height: 200, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={metricas.porEstado} dataKey="total" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={80}>
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
                  <div className="w-3 h-3 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="text-xs text-slate-600 font-medium">{e.status} ({e.total})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Horizontal bars: Casos de uso */}
        <div className="col-span-12 lg:col-span-7 bg-white p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm h-[380px] flex flex-col">
          <h4 className="text-lg font-bold text-[#003087] mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Casos de uso más solicitados</h4>
          <div className="space-y-5 flex-1 overflow-hidden">
            {porSolucionPct.map((s, i) => (
              <div key={s.solution} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>{s.solution}</span>
                  <span>{s.pct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${s.barPct}%`, background: barColors[i % barColors.length] }}
                  />
                </div>
              </div>
            ))}
            {porSolucionPct.length === 0 && <p className="text-sm text-slate-400">Sin datos</p>}
          </div>
        </div>
      </section>

      {/* AI Insights Panel */}
      <section className="bg-white rounded-[10px] shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="px-8 py-6 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#00C8FF] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            <h4 className="text-xl font-bold text-[#003087] tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>AI Strategic Insights</h4>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Powered by</span>
              <span className="text-xs font-extrabold text-[#004BB5]">DeepSeek</span>
            </div>
            <button
              onClick={generarInsights}
              disabled={loadingInsights}
              className="px-5 py-2 bg-[#003087] hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">{loadingInsights ? 'hourglass_empty' : 'refresh'}</span>
              {loadingInsights ? 'Generando...' : 'Actualizar insights'}
            </button>
          </div>
        </div>

        {!insights && !loadingInsights && (
          <div className="px-8 py-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-slate-200">psychology</span>
            <p className="text-sm text-slate-400 mt-3">Haz clic en <strong>Actualizar insights</strong> para generar análisis con IA basado en los datos actuales.</p>
          </div>
        )}

        {loadingInsights && (
          <div className="px-8 py-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-[#00C8FF] animate-spin">progress_activity</span>
            <p className="text-sm text-slate-400 mt-3">Analizando datos con DeepSeek...</p>
          </div>
        )}

        {insights && !loadingInsights && (
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="p-8 bg-[#F0F8FF] border-l-[6px] border-[#00C8FF]">
              <h5 className="text-sm font-extrabold text-[#00C8FF] uppercase tracking-widest mb-6">Insights Clave</h5>
              <ul className="space-y-4">
                {insights.insights.map((item, i) => (
                  <li key={i} className="flex gap-3"><span className="text-xl">💡</span><p className="text-sm text-slate-700 leading-relaxed">{item}</p></li>
                ))}
              </ul>
            </div>
            <div className="p-8 bg-[#EEF4FF] border-l-[6px] border-[#004BB5]">
              <h5 className="text-sm font-extrabold text-[#004BB5] uppercase tracking-widest mb-6">Recomendaciones</h5>
              <ul className="space-y-4">
                {insights.recomendaciones.map((item, i) => (
                  <li key={i} className="flex gap-3"><span className="text-xl">🎯</span><p className="text-sm text-slate-700 leading-relaxed">{item}</p></li>
                ))}
              </ul>
            </div>
            <div className="p-8 bg-[#FFF3EE] border-l-[6px] border-[#E8470A]">
              <h5 className="text-sm font-extrabold text-[#E8470A] uppercase tracking-widest mb-6">Puntos de Atención</h5>
              <ul className="space-y-4">
                {insights.alertas.map((item, i) => (
                  <li key={i} className="flex gap-3"><span className="text-xl">⚠️</span><p className="text-sm text-slate-700 leading-relaxed">{item}</p></li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
