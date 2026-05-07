'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getCurrentConsultor } from '@/lib/supabase-browser'
import { Lead, Consultor } from '@/types'
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-3xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

export default function ConsultoresPage() {
  const router = useRouter()
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
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
      const [{ data: cons }, { data: lds }] = await Promise.all([
        supabase.from('consultores').select('*'),
        supabase.from('leads').select('*'),
      ])
      if (cancelled) return
      if (cons) {
        setConsultores(cons as Consultor[])
        setSelectedId(cons[0]?.id || '')
      }
      if (lds) setLeads(lds as Lead[])
      setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [router])

  const leadsConsultor = leads.filter((l) => l.id_consultor_asignado === selectedId)

  // KPIs
  const total = leadsConsultor.length
  const resueltos = leadsConsultor.filter((l) => l.status === 'Resuelto').length
  const cancelados = leadsConsultor.filter((l) => l.status === 'Cancelado').length
  const tasaCancelacion = total > 0 ? Math.round((cancelados / total) * 100) : 0
  const tasaConversion = total > 0 ? Math.round((resueltos / total) * 100) : 0

  // Soluciones trabajadas
  const solucionMap: Record<string, number> = {}
  leadsConsultor.forEach((l) => {
    if (l.solution) solucionMap[l.solution] = (solucionMap[l.solution] || 0) + 1
  })
  const porSolucion = Object.entries(solucionMap).map(([solution, total]) => ({ solution, total }))

  // Por estado
  const estadoMap: Record<string, number> = {}
  leadsConsultor.forEach((l) => {
    estadoMap[l.status] = (estadoMap[l.status] || 0) + 1
  })
  const porEstado = Object.entries(estadoMap).map(([status, total]) => ({ status, total }))

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Métricas por Consultor</h1>
        <p className="text-sm text-gray-500 mt-1">Desempeño individual de cada miembro del equipo</p>
      </div>

      {/* Selector de consultor */}
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

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Leads atendidos" value={total} />
        <KPICard label="Resueltos" value={resueltos} />
        <KPICard label="Tasa de conversión" value={`${tasaConversion}%`} />
        <KPICard label="Tasa de cancelación" value={`${tasaCancelacion}%`} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Soluciones trabajadas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Soluciones trabajadas</h2>
          {porSolucion.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porSolucion} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="solution" type="category" tick={{ fontSize: 11 }} width={150} />
                <Tooltip />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {porSolucion.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Distribución por estado */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
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

      {/* Historial de leads */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Historial de leads</h2>
        {leadsConsultor.length === 0 ? (
          <p className="text-sm text-gray-400">Sin leads asignados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b">
                  <th className="pb-2 pr-4">Nombre</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Solución</th>
                  <th className="pb-2 pr-4">Estado</th>
                  <th className="pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {leadsConsultor.map((l) => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-800">{l.full_name}</td>
                    <td className="py-2 pr-4 text-gray-500">{l.email}</td>
                    <td className="py-2 pr-4 text-gray-500">{l.solution || '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[l.status]}`}>
                        {l.status}
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
        )}
      </div>
    </div>
  )
}
