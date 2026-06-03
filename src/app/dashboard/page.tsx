'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient, getCurrentConsultor } from '@/lib/supabase-browser'
import { Lead, ConsultoriaStatus, Consultor, leadFullName } from '@/types'
import LeadCard, { effectiveStatus, type LeadWithMeta, type LeadCardConsultoria, type LeadCardFormulario } from '@/components/LeadCard'
import LeadModal from '@/components/LeadModal'

const statusOptions: Array<'Todos' | ConsultoriaStatus> = ['Todos', 'Pendiente', 'Agendado', 'En seguimiento', 'Resuelto', 'Cancelado']

const statusChip: Record<string, { active: string; idle: string }> = {
  Todos:            { active: 'bg-[#003087] text-white border border-[#003087]',     idle: 'bg-white text-slate-600 border border-slate-200' },
  Pendiente:        { active: 'bg-amber-500 text-white border border-amber-500',     idle: 'bg-white text-amber-700 border border-amber-200' },
  Agendado:         { active: 'bg-sky-600 text-white border border-sky-600',         idle: 'bg-white text-sky-700 border border-sky-200' },
  'En seguimiento': { active: 'bg-indigo-600 text-white border border-indigo-600',   idle: 'bg-white text-indigo-700 border border-indigo-200' },
  Resuelto:         { active: 'bg-emerald-600 text-white border border-emerald-600', idle: 'bg-white text-emerald-700 border border-emerald-200' },
  Cancelado:        { active: 'bg-slate-600 text-white border border-slate-600',     idle: 'bg-white text-slate-600 border border-slate-200' },
}


export default function DashboardPage() {
  const [leads, setLeads] = useState<LeadWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<LeadWithMeta | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'Todos' | ConsultoriaStatus>('Todos')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [pendientesMas5, setPendientesMas5] = useState(false)
const fetchData = async () => {
    setLoading(true)
    const consultor = await getCurrentConsultor()
    if (!consultor) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    // 1) Fetch all leads ordered by updated_at desc
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false })

    const baseLeads = (leadsData as Lead[]) || []
    if (baseLeads.length === 0) {
      setLeads([])
      setLoading(false)
      return
    }

    const leadIds = baseLeads.map((l) => l.id)

    // 2) Fetch latest formulario_landing per lead
    const { data: formulariosData } = await supabase
      .from('formularios_landing')
      .select('id_lead, tema, descripcion, fecha_registro')
      .in('id_lead', leadIds)
      .order('created_at', { ascending: true })

    const formularioByLead: Record<string, LeadCardFormulario> = {}
    if (formulariosData) {
      for (const f of formulariosData) {
        if (!formularioByLead[f.id_lead]) {
          formularioByLead[f.id_lead] = { tema: f.tema, descripcion: f.descripcion, fecha_registro: f.fecha_registro }
        }
      }
    }

    // 3) Fetch all consultorias for these leads
    const { data: consultoriasData } = await supabase
      .from('consultorias')
      .select('id, id_lead, id_consultor, fecha, hora_inicio, hora_fin, modalidad, duracion_minutos, servicio, staff_name, staff_email, categoria_caso_uso, status')
      .in('id_lead', leadIds)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })

    const consultoriaByLead: Record<string, LeadCardConsultoria> = {}
    const allConsultorIds: string[] = []
    const allConsultoriaIds: string[] = []
    const consultoriaCountByLead: Record<string, number> = {}
    if (consultoriasData) {
      for (const c of consultoriasData) {
        if (!consultoriaByLead[c.id_lead]) consultoriaByLead[c.id_lead] = c as LeadCardConsultoria
        if (c.id_consultor) allConsultorIds.push(c.id_consultor)
        if (c.id) allConsultoriaIds.push(c.id)
        consultoriaCountByLead[c.id_lead] = (consultoriaCountByLead[c.id_lead] ?? 0) + 1
      }
    }

    // 4) Fetch consultores + registro_sesion (parallel — independent)
    const [consRes, sesionRes] = await Promise.all([
      supabase.from('consultores').select('id, nombre, email, rol, created_at'),
      allConsultoriaIds.length > 0
        ? supabase.from('registro_sesion').select('id_consultoria, estado_inicial, acciones_realizadas, resultado_final, resultado').in('id_consultoria', allConsultoriaIds)
        : Promise.resolve({ data: [] as Array<{ id_consultoria: string; estado_inicial: string | null; acciones_realizadas: string | null; resultado_final: string | null; resultado: string | null }> }),
    ])

    const allConsultores = (consRes.data as Consultor[]) || []
    const consultorById: Record<string, string> = {}
    for (const c of allConsultores) consultorById[c.id] = c.nombre

    // Build session data map by consultoria ID
    const sesionByConsultoria: Record<string, LeadCardConsultoria['registro_sesion']> = {}
    if (sesionRes.data) {
      for (const s of sesionRes.data) {
        sesionByConsultoria[s.id_consultoria] = {
          estado_inicial: s.estado_inicial,
          acciones_realizadas: s.acciones_realizadas,
          resultado_final: s.resultado_final,
        }
      }
    }

    // 5) Build LeadWithMeta list
    let merged: LeadWithMeta[] = baseLeads.map((l) => {
      const con = consultoriaByLead[l.id] ?? null
      // Attach registro_sesion data to the consultoria
      if (con?.id && sesionByConsultoria[con.id]) {
        con.registro_sesion = sesionByConsultoria[con.id]
      }
      return {
        ...l,
        formulario: formularioByLead[l.id] ?? null,
        consultoria: con,
        consultor_nombre: con?.id_consultor ? (consultorById[con.id_consultor] ?? null) : null,
      }
    })

    // 6) Role-based filtering: consultor only sees leads where they're assigned
    if (consultor.rol === 'consultor') {
      merged = merged.filter((l) => l.consultoria?.id_consultor === consultor.id)
    }

    setLeads(merged)
    setLoading(false)
  }

  useEffect(() => {
    let ignore = false
    async function load() { await fetchData() }
    if (!ignore) load()
    return () => { ignore = true }
  }, [])

  async function handleStatusChange(_leadId: string, consultoriaId: string, status: ConsultoriaStatus) {
    const supabase = createClient()
    await supabase.from('consultorias').update({ status }).eq('id', consultoriaId)
    setLeads((prev) => prev.map((l) =>
      l.consultoria?.id === consultoriaId
        ? { ...l, consultoria: { ...l.consultoria!, status } }
        : l
    ))
    if (selectedLead?.consultoria?.id === consultoriaId) {
      setSelectedLead((prev) => prev ? {
        ...prev,
        consultoria: { ...prev.consultoria!, status },
      } : prev)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const hace5 = new Date(Date.now() - 5 * 86400000)
    const fromTs = filterDateFrom ? new Date(filterDateFrom + 'T00:00:00') : null
    const toTs = filterDateTo ? new Date(filterDateTo + 'T23:59:59') : null

    return leads.filter((l) => {
      const matchSearch = !q
        || leadFullName(l).toLowerCase().includes(q)
        || l.email.toLowerCase().includes(q)
        || (l.phone ?? '').toLowerCase().includes(q)
        || (l.id_num ?? '').toLowerCase().includes(q)
      const eff = effectiveStatus(l)
      const matchStatus = filterStatus === 'Todos' || eff === filterStatus

      const regRaw = l.formulario?.fecha_registro ?? l.created_at
      const regTs = regRaw ? new Date(regRaw) : null
      const matchDateFrom = !fromTs || (regTs !== null && regTs >= fromTs)
      const matchDateTo = !toTs || (regTs !== null && regTs <= toTs)
      const matchPendientes5 = !pendientesMas5 || (eff === 'Pendiente' && regTs !== null && regTs <= hace5)

      return matchSearch && matchStatus && matchDateFrom && matchDateTo && matchPendientes5
    })
  }, [leads, search, filterStatus, filterDateFrom, filterDateTo, pendientesMas5])

  function clearFilters() {
    setFilterStatus('Todos')
    setSearch('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setPendientesMas5(false)
  }

  return (
    <>
      {/* Section Header */}
      <div className="mb-8">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider list-none p-0 m-0">
            <li className="flex items-center">
              <span>Analysis</span>
              <span className="material-symbols-outlined text-[14px] mx-1" aria-hidden="true">chevron_right</span>
            </li>
            <li>
              <span className="text-[#00C8FF]" aria-current="page">Leads</span>
            </li>
          </ol>
        </nav>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-[34px] font-extrabold text-[#001d59] tracking-tight leading-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Leads
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Vista unificada — Form PotencIA, Microsoft Bookings y registros de sesión en una sola card por persona.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 mb-6">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[20px]" aria-hidden="true">search</span>
          <input
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/30 focus:border-[#00C8FF]/50 transition-colors"
            placeholder="Buscar por nombre, email, teléfono o cédula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Estado</span>
          {statusOptions.map((s) => {
            const active = filterStatus === s
            const styles = statusChip[s]
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${active ? styles.active : styles.idle}`}
              >
                {s}
              </button>
            )
          })}
          <div className="w-px h-4 bg-slate-200 mx-1" aria-hidden="true" />
          <button
            onClick={() => setPendientesMas5((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              pendientesMas5
                ? 'bg-amber-500 text-white border border-amber-500'
                : 'bg-white text-amber-700 border border-amber-200'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]" aria-hidden="true">schedule</span>
            Pendientes +5 días
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registro</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 shrink-0">Desde</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/30 focus:border-[#00C8FF]/50 text-slate-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 shrink-0">Hasta</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/30 focus:border-[#00C8FF]/50 text-slate-700"
            />
          </div>
          {(filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
              className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
            >
              Limpiar fechas
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState onClear={clearFilters} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={setSelectedLead} />
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  )
}


function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 border border-slate-300 rounded-2xl overflow-hidden">
          <div className="p-5 space-y-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-200 rounded w-2/3" />
                <div className="h-2.5 bg-slate-200 rounded w-1/2" />
              </div>
            </div>
            <div className="h-16 bg-white/60 rounded-xl border border-slate-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-12 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[28px]" aria-hidden="true">search_off</span>
      </div>
      <h3 className="text-base font-bold text-slate-700" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        Sin resultados
      </h3>
      <p className="text-sm text-slate-500 mt-1">No hay leads que coincidan con tus filtros.</p>
      <button
        onClick={onClear}
        className="mt-5 px-4 py-2 rounded-lg bg-[#003087] text-white text-xs font-semibold cursor-pointer"
      >
        Limpiar filtros
      </button>
    </div>
  )
}
