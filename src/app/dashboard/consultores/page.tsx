'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getCurrentConsultor } from '@/lib/supabase-browser'
import { Consultor, Consultoria, Lead, leadFullName, FormularioLanding, RegistroSesion } from '@/types'
import { buildPorTema } from '@/lib/dashboardTransforms'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']

// Tool extraction from acciones_realizadas
const TOOL_KEYWORDS: { tool: string; category: string; keywords: string[] }[] = [
  { tool: 'ChatGPT', category: 'Asistentes IA', keywords: ['chatgpt', 'chat gpt', 'gpt-4', 'gpt4', 'openai'] },
  { tool: 'Claude', category: 'Asistentes IA', keywords: ['claude', 'anthropic'] },
  { tool: 'Gemini', category: 'Asistentes IA', keywords: ['gemini', 'bard'] },
  { tool: 'Copilot', category: 'Asistentes IA', keywords: ['copilot'] },
  { tool: 'n8n', category: 'Automatización', keywords: ['n8n'] },
  { tool: 'Make', category: 'Automatización', keywords: ['make.com'] },
  { tool: 'Zapier', category: 'Automatización', keywords: ['zapier'] },
  { tool: 'Lovable', category: 'Desarrollo sin código', keywords: ['lovable'] },
  { tool: 'Bolt.new', category: 'Desarrollo sin código', keywords: ['bolt.new', 'bolt new'] },
  { tool: 'Repaint AI', category: 'Desarrollo sin código', keywords: ['repaint'] },
  { tool: 'Manus', category: 'Agentes IA', keywords: ['manus'] },
  { tool: 'Canva AI', category: 'Diseño y contenido', keywords: ['canva'] },
  { tool: 'WhatsApp Business', category: 'Comunicación', keywords: ['whatsapp'] },
]

function extractToolsFromText(text: string): string[] {
  const lower = text.toLowerCase()
  return TOOL_KEYWORDS
    .filter(({ keywords }) => keywords.some(k => lower.includes(k)))
    .map(({ tool }) => tool)
}

function buildToolStats(acciones: (string | null)[]) {
  const counts: Record<string, number> = {}
  for (const text of acciones) {
    if (!text) continue
    for (const tool of extractToolsFromText(text)) {
      counts[tool] = (counts[tool] || 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
}

function getTopCategory(toolStats: { tool: string; count: number }[]): { category: string; count: number } | null {
  const catCounts: Record<string, number> = {}
  for (const { tool, count } of toolStats) {
    const cat = TOOL_KEYWORDS.find(t => t.tool === tool)?.category ?? 'Otros'
    catCounts[cat] = (catCounts[cat] || 0) + count
  }
  const top = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]
  return top ? { category: top[0], count: top[1] } : null
}


function calcLeftWidth(labels: string[]): number {
  return Math.min(130, Math.max(60, ...labels.map(l => l.length * 6.5)))
}

interface InsightItem {
  titulo: string
  detalle: string
  tipo: string
}

const INSIGHT_STYLE: Record<string, { bg: string; border: string; title: string; icon: string }> = {
  caso_uso:    { bg: 'bg-violet-50',  border: 'border-violet-100', title: 'text-violet-800', icon: '🎯' },
  sector:      { bg: 'bg-blue-50',    border: 'border-blue-100',   title: 'text-blue-800',   icon: '🏢' },
  herramienta: { bg: 'bg-amber-50',   border: 'border-amber-100',  title: 'text-amber-800',  icon: '🛠️' },
  efectividad: { bg: 'bg-emerald-50', border: 'border-emerald-100',title: 'text-emerald-800',icon: '✅' },
  patron:      { bg: 'bg-rose-50',    border: 'border-rose-100',   title: 'text-rose-800',   icon: '💡' },
}

function KPICard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl sm:text-3xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

type SesionRow = Pick<RegistroSesion, 'id' | 'id_consultoria' | 'acciones_realizadas'>

export default function ConsultoresPage() {
  const router = useRouter()
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [consultorias, setConsultorias] = useState<Consultoria[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [formularios, setFormularios] = useState<Pick<FormularioLanding, 'id_lead' | 'tema'>[]>([])
  const [registroSesiones, setRegistroSesiones] = useState<SesionRow[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<InsightItem[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      const me = await getCurrentConsultor()
      if (cancelled) return
      if (!me) { router.replace('/login'); return }
      if (me.rol !== 'admin') { router.replace('/dashboard'); return }

      const supabase = createClient()
      const [{ data: cons }, { data: lds }, { data: forms }, { data: sesiones }, { data: consor }] = await Promise.all([
        supabase.from('consultores').select('*').eq('rol', 'consultor').eq('activo', true).order('nombre'),
        supabase.from('leads').select('*'),
        supabase.from('formularios_landing').select('id_lead, tema'),
        supabase.from('registro_sesion').select('id, id_consultoria, acciones_realizadas'),
        supabase.from('consultorias').select('*'),
      ])
      if (cancelled) return
      if (cons) {
        setConsultores(cons as Consultor[])
        setSelectedId(cons[0]?.id || '')
      }
      if (lds) setLeads(lds as Lead[])
      if (forms) setFormularios(forms as Pick<FormularioLanding, 'id_lead' | 'tema'>[])
      if (sesiones) setRegistroSesiones(sesiones as SesionRow[])
      if (consor) setConsultorias(consor as Consultoria[])
      setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    if (!selectedId) return
    setInsights([])
    setInsightsLoading(true)
    fetch('/api/consultor-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consultorId: selectedId }),
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.insights)) setInsights(data.insights) })
      .catch(() => {})
      .finally(() => setInsightsLoading(false))
  }, [selectedId])

  const conConsultor = consultorias.filter((c) => c.id_consultor === selectedId)
  const consultoriaIds = new Set(conConsultor.map(c => c.id))
  const sesionesConsultor = registroSesiones.filter(rs => consultoriaIds.has(rs.id_consultoria))

  // KPIs desde registro_sesion
  const totalSesiones = sesionesConsultor.length
  const resueltos = sesionesConsultor.filter(rs =>
    conConsultor.find(c => c.id === rs.id_consultoria)?.status === 'Resuelto'
  ).length

  // Servicios trabajados
  const porServicio = buildPorTema(conConsultor, formularios)

  // Herramientas IA
  const toolStats = buildToolStats(sesionesConsultor.map(rs => rs.acciones_realizadas))
  const topCategory = getTopCategory(toolStats)
  const topTool = toolStats[0] ?? null

  // Leads del consultor
  const leadIds = conConsultor.map((c) => c.id_lead)
  const leadsConsultor = leads.filter((l) => leadIds.includes(l.id))

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando...</div>

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Métricas por Consultor</h1>
        <p className="text-sm text-gray-500 mt-1">Desempeño individual de cada miembro del equipo</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {consultores.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
              selectedId === c.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <KPICard label="Sesiones" value={totalSesiones} />
        <KPICard label="Resueltos" value={resueltos} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Servicios trabajados</h2>
          {porServicio.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porServicio} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  dataKey="servicio"
                  type="category"
                  tick={{ fontSize: 10 }}
                  width={calcLeftWidth(porServicio.map(d => d.servicio))}
                  tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 18) + '…' : v}
                />
                <Tooltip />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {porServicio.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-700">Perfil del consultor</h2>
            {insightsLoading && (
              <span className="text-[11px] text-indigo-500 animate-pulse">Generando…</span>
            )}
            {!insightsLoading && insights.length > 0 && (
              <button
                onClick={() => {
                  setInsights([])
                  setInsightsLoading(true)
                  fetch('/api/consultor-insights', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ consultorId: selectedId, force: true }),
                  })
                    .then(r => r.json())
                    .then(data => { if (Array.isArray(data.insights)) setInsights(data.insights) })
                    .catch(() => {})
                    .finally(() => setInsightsLoading(false))
                }}
                className="text-[11px] text-gray-400 hover:text-indigo-500 transition-colors cursor-pointer"
                title="Regenerar insights"
              >
                ↻ actualizar
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mb-3">Generado por IA · basado en acciones de cada sesión</p>

          {insightsLoading ? (
            <div className="flex flex-col gap-2.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[60px] rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : insights.length === 0 ? (
            <p className="text-sm text-gray-400">Sin acciones registradas para generar insights</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {insights.map((ins, i) => {
                const s = INSIGHT_STYLE[ins.tipo] ?? INSIGHT_STYLE.patron
                return (
                  <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${s.bg} ${s.border}`}>
                    <span className="text-base leading-none mt-0.5 shrink-0">{s.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${s.title} leading-snug`}>{ins.titulo}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{ins.detalle}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Herramientas IA */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Herramientas IA más usadas</h2>
        <p className="text-xs text-gray-400 mb-4">Detectadas automáticamente en el registro de acciones de cada sesión</p>

        {toolStats.length === 0 ? (
          <p className="text-sm text-gray-400">Sin acciones registradas para este consultor</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {topCategory && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-medium">
                  💡 Perfil fuerte en <strong>{topCategory.category}</strong> — {topCategory.count} menciones
                </span>
              )}
              {topTool && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full font-medium">
                  ⭐ Herramienta favorita: <strong>{topTool.tool}</strong> ({topTool.count} sesiones)
                </span>
              )}
              {toolStats.length >= 3 && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full font-medium">
                  🔧 Maneja {toolStats.length} herramientas distintas
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={Math.max(160, toolStats.length * 36)}>
              <BarChart data={toolStats} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  dataKey="tool"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={calcLeftWidth(toolStats.map(d => d.tool))}
                />
                <Tooltip formatter={(value) => [`${value} sesiones`, 'Usos']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {toolStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Historial de leads */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Historial de leads</h2>
        {leadsConsultor.length === 0 ? (
          <p className="text-sm text-gray-400">Sin leads asignados</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b">
                    <th className="pb-2 pr-4">Nombre</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Empresa</th>
                    <th className="pb-2 pr-4">Origen</th>
                    <th className="pb-2">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsConsultor.map((l) => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-800">{leadFullName(l)}</td>
                      <td className="py-2 pr-4 text-gray-500">{l.email}</td>
                      <td className="py-2 pr-4 text-gray-500">{l.empresa || '—'}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {l.origen}
                        </span>
                      </td>
                      <td className="py-2 text-gray-400 text-xs">
                        {new Date(l.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {leadsConsultor.map((l) => (
                <div key={l.id} className="rounded-xl border border-gray-100 p-3 bg-white">
                  <p className="text-sm font-semibold text-gray-800">{leadFullName(l)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{l.email}</p>
                  <p className="text-xs text-gray-500">{l.empresa || '—'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {l.origen}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(l.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
