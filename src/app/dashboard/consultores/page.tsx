'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getCurrentConsultor } from '@/lib/supabase-browser'
import { Consultor, Consultoria, Lead, leadFullName, FormularioLanding } from '@/types'
import { buildPorTema } from '@/lib/dashboardTransforms'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']

const statusColors: Record<string, string> = {
  Pendiente: 'bg-yellow-100 text-yellow-800',
  Agendado: 'bg-blue-100 text-blue-800',
  'En seguimiento': 'bg-purple-100 text-purple-800',
  Resuelto: 'bg-green-100 text-green-800',
  Cancelado: 'bg-red-100 text-red-800',
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

export default function ConsultoresPage() {
  const router = useRouter()
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [consultorias, setConsultorias] = useState<Consultoria[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [formularios, setFormularios] = useState<Pick<FormularioLanding, 'id_lead' | 'tema'>[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      const me = await getCurrentConsultor()
      if (cancelled) return
      if (!me) { router.replace('/login'); return }
      if (me.rol !== 'admin') { router.replace('/dashboard'); return }

      const supabase = createClient()
      const [{ data: cons }, { data: lds }, { data: forms }] = await Promise.all([
        supabase.from('consultores').select('*'),
        supabase.from('leads').select('*'),
        supabase.from('formularios_landing').select('id_lead, tema'),
      ])
      if (cancelled) return
      if (cons) {
        setConsultores(cons as Consultor[])
        setSelectedId(cons[0]?.id || '')
      }
      if (lds) setLeads(lds as Lead[])
      if (forms) setFormularios(forms as Pick<FormularioLanding, 'id_lead' | 'tema'>[])

      // Fetch todas las consultorias (no es ideal para escala pero funciona para equipos chicos)
      const { data: consor } = await supabase.from('consultorias').select('*')
      if (consor) setConsultorias(consor as Consultoria[])
      setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [router])

  const conConsultor = consultorias.filter((c) => c.id_consultor === selectedId)

  // KPIs
  const total = conConsultor.length
  const resueltos = conConsultor.filter((c) => c.status === 'Resuelto').length

  // Servicios trabajados
  const porServicio = buildPorTema(conConsultor, formularios)

  // Por estado
  const estadoMap: Record<string, number> = {}
  conConsultor.forEach((c) => {
    estadoMap[c.status] = (estadoMap[c.status] || 0) + 1
  })
  const porEstado = Object.entries(estadoMap).map(([status, total]) => ({ status, total }))

  // Leads del consultor (para el historial)
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
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
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
        <KPICard label="Consultorías" value={total} />
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
                <YAxis dataKey="servicio" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {porServicio.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Distribución por estado</h2>
          {porEstado.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos</p>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {porEstado.map((e) => (
                <div key={e.status} className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[e.status] || 'bg-gray-100 text-gray-600'}`}>
                    {e.status}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">{e.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Historial de leads</h2>
        {leadsConsultor.length === 0 ? (
          <p className="text-sm text-gray-400">Sin leads asignados</p>
        ) : (
          <>
            {/* Desktop table */}
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
            {/* Mobile card list */}
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
