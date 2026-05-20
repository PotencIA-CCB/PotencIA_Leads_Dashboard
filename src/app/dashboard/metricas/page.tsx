'use client'

import { useMetricas } from '@/hooks/useMetricas'
import { useState, useEffect } from 'react'
import { getCurrentConsultor } from '@/lib/supabase-browser'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

const DONUT_COLORS = ['#003087', '#00C8FF', '#E8470A', '#004BB5']

export default function MetricasPage() {
  const { metricas, loading } = useMetricas()
  const [insights, setInsights] = useState<{ insights: string[]; recomendaciones: string[]; alertas: string[] } | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [picosSemanales, setPicosSemanales] = useState<Array<{
    semana_inicio: string
    total: number
    personas_atendidas: number
    resueltas: number
    en_seguimiento: number
  }> | null>(null)

  useEffect(() => {
    async function cargarUltimoInsight() {
      const res = await fetch('/api/insights')
      const data = await res.json()
      if (data) setInsights(data)
    }
    if (!loading && metricas) cargarUltimoInsight()
  }, [loading, metricas])

  useEffect(() => {
    async function cargarPicos() {
      try {
        const { createClient } = await import('@/lib/supabase-browser')
        const supabase = createClient()
        const { data } = await supabase
          .from('consultas_por_semana')
          .select('*')
          .order('semana_inicio', { ascending: false })
          .limit(12)
        if (data) setPicosSemanales(data)
      } catch { /* vista no disponible aún */ }
    }
    cargarPicos()
  }, [])

  async function generarInsights() {
    setLoadingInsights(true)
    try {
      const consultor = await getCurrentConsultor()
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_consultor: consultor?.id ?? null }),
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

  const maxServicio = Math.max(...metricas.porServicio.map((c) => c.total), 1)
  const porServicioPct = metricas.porServicio.map((c) => ({
    ...c,
    pct: Math.round((c.total / maxServicio) * 100),
  }))

  const barColors = ['#003087', '#00C8FF', '#004BB5', '#E8470A', '#5A6475', '#003087']

  return (
    <>
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
          { label: 'Total Consultorías', value: metricas.totalConsultorias, icon: 'event', sub: 'Sesiones registradas' },
          { label: 'Resueltas', value: resueltos, icon: 'task_alt', sub: 'Estado Resuelto' },
          { label: 'En Seguimiento', value: enSeguimiento, icon: 'monitoring', sub: 'Active pipeline' },
          { label: '% Conversión', value: `${metricas.tasaConversion}%`, icon: 'trending_up', sub: 'Consultorías → Resuelto' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white p-6 rounded-[10px] border-t-[3px] border-[#004BB5] border border-[#E5E7EB] shadow-sm">
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
        <div className="col-span-12 lg:col-span-8 bg-white p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-lg font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Consultorías por semana</h4>
              <p className="text-xs text-slate-400">Evolución histórica de sesiones</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300} minWidth={0}>
            <LineChart data={metricas.porSemana}>
              <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#003087" strokeWidth={3} dot={{ fill: '#003087', r: 5, stroke: 'white', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-white p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm h-100 flex flex-col">
          <h4 className="text-lg font-bold text-[#003087] mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Consultorías por ciudad</h4>
          <div className="flex-1 flex items-end justify-around gap-2 px-2 pb-6 border-b border-slate-100 relative">
            {metricas.porCiudad.map((c, i) => {
              const maxCity = Math.max(...metricas.porCiudad.map((x) => x.total), 1)
              const heightPct = Math.round((c.total / maxCity) * 100)
              return (
                <div key={c.city} className="w-full flex flex-col items-center min-w-0">
                  <span className="text-xs font-bold text-slate-700 mb-1 tabular-nums">{c.total}</span>
                  <div
                    className="w-8 rounded-t-sm"
                    style={{ height: `${heightPct}%`, background: barColors[i % barColors.length], minHeight: '8px' }}
                  />
                  <p className="text-[10px] text-slate-500 mt-2 text-center leading-tight w-full" title={c.city}>
                    {c.city}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Charts Row 2 */}
      <section className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 lg:col-span-5 bg-white p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm h-95 flex flex-col">
          <h4 className="text-lg font-bold text-[#003087] mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Estado consultorías</h4>
          <div className="flex-1 flex items-center justify-between gap-4">
            <div className="shrink-0">
              <PieChart width={200} height={200}>
                <Pie data={metricas.porEstado} dataKey="total" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={80}>
                  {metricas.porEstado.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
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

        <div className="col-span-12 lg:col-span-7 bg-white p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm h-95 flex flex-col">
          <h4 className="text-lg font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Servicios más solicitados</h4>
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {porServicioPct.map((c, i) => (
              <div key={c.servicio} className="space-y-1.5">
                <div className="flex justify-between gap-3 text-xs font-medium text-slate-700">
                  <span className="truncate" title={c.servicio}>{c.servicio}</span>
                  <span className="font-bold text-slate-600 tabular-nums shrink-0">{c.total}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${c.pct}%`, background: barColors[i % barColors.length] }}
                  />
                </div>
              </div>
            ))}
            {porServicioPct.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <span className="material-symbols-outlined text-[32px] text-slate-300 mb-2" aria-hidden="true">format_quote</span>
                <p className="text-sm text-slate-400">Aún no hay consultorías registradas.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Picos semanales */}
      {picosSemanales && picosSemanales.length > 0 && (
        <section className="bg-white rounded-[10px] border border-[#E5E7EB] shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-slate-100">
            <h4 className="text-sm font-bold text-[#003087] uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Picos semanales
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b">
                  <th className="pb-2 pl-6 pr-4">Semana inicio</th>
                  <th className="pb-2 pr-4">Total</th>
                  <th className="pb-2 pr-4">Personas</th>
                  <th className="pb-2 pr-4">Resueltas</th>
                  <th className="pb-2 pr-6">En seguimiento</th>
                </tr>
              </thead>
              <tbody>
                {picosSemanales.map((p) => (
                  <tr key={p.semana_inicio} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2.5 pl-6 pr-4 font-medium text-slate-700">
                      {new Date(p.semana_inicio + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2.5 pr-4 font-bold text-[#003087]">{p.total}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{p.personas_atendidas}</td>
                    <td className="py-2.5 pr-4 text-emerald-600 font-medium">{p.resueltas}</td>
                    <td className="py-2.5 pr-6 text-indigo-600 font-medium">{p.en_seguimiento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* AI Insights */}
      <section className="bg-white rounded-[10px] border border-[#E5E7EB] shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-[#003087] uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Insights con IA
          </h4>
          <button
            onClick={generarInsights}
            disabled={loadingInsights}
            className="text-xs font-semibold text-[#003087] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">{loadingInsights ? 'hourglass_empty' : 'refresh'}</span>
            {loadingInsights ? 'Generando' : 'Actualizar'}
          </button>
        </div>

        {!insights && !loadingInsights && (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-400">Haz clic en <strong className="text-slate-600">Actualizar</strong> para generar análisis basado en los datos actuales.</p>
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

function InsightColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="px-6 py-5">
      <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{title}</h5>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Sin datos</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-slate-600 leading-relaxed">{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
