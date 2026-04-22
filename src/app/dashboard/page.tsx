'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Lead, LeadStatus, Consultor } from '@/types'
import LeadCard from '@/components/LeadCard'
import LeadModal from '@/components/LeadModal'

const statuses = ['Todos', 'Pendiente', 'Agendado', 'En seguimiento', 'Resuelto', 'Cancelado']

const statusChipStyle: Record<string, string> = {
  Todos:            'bg-[#003087] text-white shadow-md',
  Pendiente:        'bg-white text-orange-600 border border-orange-100 hover:bg-orange-50',
  Agendado:         'bg-white text-blue-500 border border-blue-100 hover:bg-blue-50',
  'En seguimiento': 'bg-white text-blue-500 border border-blue-100 hover:bg-blue-50',
  Resuelto:         'bg-white text-emerald-600 border border-emerald-100 hover:bg-emerald-50',
  Cancelado:        'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50',
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [rol, setRol] = useState('')

  const fetchData = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: consultor } = await supabase
      .from('consultores').select('id, rol').eq('auth_id', user.id).single()
    if (!consultor) return

    setRol(consultor.rol)

    const query = supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (consultor.rol === 'consultor') query.eq('id_consultor_asignado', consultor.id)

    const { data: leadsData } = await query
    if (leadsData) setLeads(leadsData as Lead[])

    if (consultor.rol === 'admin') {
      const { data: consData } = await supabase.from('consultores').select('*')
      if (consData) setConsultores(consData as Consultor[])
    }
    setLoading(false)
  }

  useEffect(() => {
    let ignore = false
    async function load() {
      await fetchData()
    }
    if (!ignore) load()
    return () => { ignore = true }
  }, [])

  async function handleStatusChange(id: string, status: LeadStatus) {
    const supabase = createClient()
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l))
    if (selectedLead?.id === id) setSelectedLead((prev) => prev ? { ...prev, status } : prev)
  }

  async function handleAsignarConsultor(id: string, id_consultor_asignado: string) {
    const supabase = createClient()
    await supabase.from('leads').update({ id_consultor_asignado }).eq('id', id)
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, id_consultor_asignado } : l))
    if (selectedLead?.id === id) setSelectedLead((prev) => prev ? { ...prev, id_consultor_asignado } : prev)
  }

  const sinAsignar = rol === 'admin'
    ? leads.filter((l) => l.status === 'Agendado' && !l.id_consultor_asignado)
    : []

  const filtered = leads.filter((l) => {
    const matchSearch = l.full_name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'Todos' || l.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <>
      {/* Banner: leads agendados sin consultor — solo admin */}
      {sinAsignar.length > 0 && (
        <div
          className="mb-6 flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => setFilterStatus('Agendado')}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-500 text-[22px]">notification_important</span>
            <div>
              <p className="text-sm font-bold text-amber-800">
                {sinAsignar.length} lead{sinAsignar.length > 1 ? 's' : ''} agendado{sinAsignar.length > 1 ? 's' : ''} sin consultor asignado
              </p>
              <p className="text-xs text-amber-600">Llegaron desde Microsoft Bookings. Haz clic para verlos.</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-amber-400 text-[20px]">arrow_forward</span>
        </div>
      )}

      {/* Section Header */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <nav aria-label="Breadcrumb" className="mb-2">
              <ol className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider list-none p-0 m-0">
                <li className="flex items-center">
                  <span>Analysis</span>
                  <span className="material-symbols-outlined text-[14px] mx-1" aria-hidden="true">chevron_right</span>
                </li>
                <li>
                  <span className="text-[#00C8FF]" aria-current="page">Leads</span>
                </li>
              </ol>
            </nav>
            <h2 className="text-4xl font-extrabold text-[#001d59] tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Leads Registrados
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{leads.length} leads en total</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[260px]">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#00C8FF] text-[20px]">search</span>
          <input
            className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/20"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Filtrar por:</span>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              filterStatus === s ? statusChipStyle[s] || 'bg-[#003087] text-white' : statusChipStyle[s] || 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-slate-400">Cargando leads...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={setSelectedLead} />
          ))}

          {/* Empty state card */}
          {filtered.length === 0 && (
            <div className="bg-[#F4F6FA]/40 border-2 border-dashed border-slate-200 rounded-[10px] p-6 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[32px]">search_off</span>
              </div>
              <h3 className="text-lg font-bold text-slate-500" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Sin resultados</h3>
              <p className="text-sm text-slate-400 mt-2">No hay leads que coincidan con el filtro</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
          onAsignarConsultor={rol === 'admin' ? handleAsignarConsultor : undefined}
          consultores={rol === 'admin' ? consultores : []}
        />
      )}
    </>
  )
}
