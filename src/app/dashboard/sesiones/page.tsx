'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Sesion, SesionStatus, Lead, Consultor } from '@/types'

const statusColors: Record<SesionStatus, { bg: string; color: string }> = {
  'Resuelto':        { bg: '#ECFDF5', color: '#065F46' },
  'En seguimiento':  { bg: '#EEF4FF', color: '#0050C8' },
  'Cancelado':       { bg: '#FEF2F2', color: '#991B1B' },
}

const emptyForm = {
  id_lead: '',
  fecha_sesion: '',
  hora_inicio: '',
  hora_fin: '',
  caso_de_uso: '',
  modalidad: 'Virtual',
  descripcion_sesion: '',
  resultados_obtenidos: '',
  entregable: '',
  url_video: '',
  url_evidencias: '',
  status: 'En seguimiento' as SesionStatus,
  notas_privadas: '',
}

export default function SesionesPage() {
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [consultorId, setConsultorId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: consultor } = await supabase
      .from('consultores').select('id, rol').eq('auth_id', user.id).single()
    if (!consultor) return

    setConsultorId(consultor.id)

    const sesQuery = supabase.from('sesiones').select('*').order('created_at', { ascending: false })
    if (consultor.rol === 'consultor') sesQuery.eq('id_consultor', consultor.id)

    const { data: sesData } = await sesQuery
    if (sesData) setSesiones(sesData as Sesion[])

    const leadsQuery = supabase.from('leads').select('id, full_name, email')
    if (consultor.rol === 'consultor') leadsQuery.eq('id_consultor_asignado', consultor.id)
    const { data: leadsData } = await leadsQuery
    if (leadsData) setLeads(leadsData as Lead[])

    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validar día hábil (lunes a viernes)
    if (form.fecha_sesion) {
      const dia = new Date(form.fecha_sesion + 'T00:00:00').getDay()
      if (dia === 0 || dia === 6) {
        alert('Las sesiones solo están disponibles de lunes a viernes.')
        return
      }
    }

    // Validar horario permitido (8am-12pm y 1pm-5pm)
    if (form.hora_inicio) {
      const [hI, mI] = form.hora_inicio.split(':').map(Number)
      const inicioMin = hI * 60 + mI
      const mananaInicio = 8 * 60
      const mananaFin = 12 * 60
      const tardeInicio = 13 * 60
      const tardeFin = 17 * 60
      const enManana = inicioMin >= mananaInicio && inicioMin < mananaFin
      const enTarde = inicioMin >= tardeInicio && inicioMin <= tardeFin
      if (!enManana && !enTarde) {
        alert('El horario de sesiones es 8:00am - 12:00pm y 1:00pm - 5:00pm.')
        return
      }
    }

    // Validar duración máxima de 2 horas
    if (form.hora_inicio && form.hora_fin) {
      const [hI, mI] = form.hora_inicio.split(':').map(Number)
      const [hF, mF] = form.hora_fin.split(':').map(Number)
      const inicio = hI * 60 + mI
      const fin = hF * 60 + mF
      if (fin <= inicio) {
        alert('La hora de finalización debe ser mayor a la hora de inicio.')
        return
      }
      if (fin - inicio > 120) {
        alert('La sesión no puede durar más de 2 horas.')
        return
      }
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('sesiones').insert({
      ...form,
      id_consultor: consultorId,
    })
    if (!error) {
      setSaved(true)
      setForm(emptyForm)
      setShowForm(false)
      fetchData()
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const leadName = (id: string) => leads.find((l) => l.id === id)?.full_name || id

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
            <span>Analysis</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-[#00AEEF]">Sesiones</span>
          </nav>
          <h2 className="text-4xl font-extrabold text-[#001d59] tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Seguimiento de Sesiones
          </h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-6 py-3 bg-[#003087] hover:opacity-90 text-white text-sm font-bold rounded-lg transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">{showForm ? 'close' : 'add_circle'}</span>
          {showForm ? 'Cancelar' : 'Nueva sesión'}
        </button>
      </div>

      {saved && (
        <div className="mb-6 px-5 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          Sesión registrada correctamente
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-[10px] border border-[#E5E7EB] shadow-sm p-8 mb-8">
          <h3 className="text-lg font-bold text-[#003087] mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Registrar nueva sesión
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">Lead / Cliente *</label>
              <select name="id_lead" required value={form.id_lead} onChange={handleChange}
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087]">
                <option value="">Seleccionar lead</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.full_name} — {l.email}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">Fecha de sesión *</label>
              <input type="date" name="fecha_sesion" required value={form.fecha_sesion} onChange={handleChange}
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087]" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">Hora de inicio</label>
              <select name="hora_inicio" value={form.hora_inicio} onChange={handleChange}
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087]">
                <option value="">Seleccionar hora</option>
                <optgroup label="Mañana (8:00am - 12:00pm)">
                  {['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30'].map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </optgroup>
                <optgroup label="Tarde (1:00pm - 5:00pm)">
                  {['13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30'].map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">Hora de finalización</label>
              <select name="hora_fin" value={form.hora_fin} onChange={handleChange}
                disabled={!form.hora_inicio}
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed">
                <option value="">Seleccionar hora</option>
                {form.hora_inicio && (() => {
                  const [h, m] = form.hora_inicio.split(':').map(Number)
                  const inicioMin = h * 60 + m
                  const horasValidas = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00']
                  return horasValidas
                    .filter(hora => {
                      const [hh, mm] = hora.split(':').map(Number)
                      const horaMin = hh * 60 + mm
                      return horaMin > inicioMin && horaMin <= inicioMin + 120
                    })
                    .map(h => <option key={h} value={h}>{h}</option>)
                })()}
              </select>
              {!form.hora_inicio && <p className="text-[11px] text-slate-400 italic">Selecciona primero la hora de inicio</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">Caso de uso</label>
              <input type="text" name="caso_de_uso" value={form.caso_de_uso} onChange={handleChange}
                placeholder="Ej: Automatización de procesos"
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087]" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">Modalidad</label>
              <select name="modalidad" value={form.modalidad} onChange={handleChange}
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087]">
                <option value="Virtual">Virtual</option>
                <option value="Presencial">Presencial</option>
                <option value="Híbrida">Híbrida</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">Estado *</label>
              <select name="status" required value={form.status} onChange={handleChange}
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087]">
                <option value="En seguimiento">En seguimiento</option>
                <option value="Resuelto">Resuelto</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">Descripción de la sesión</label>
              <textarea name="descripcion_sesion" value={form.descripcion_sesion} onChange={handleChange} rows={3}
                placeholder="Resumen de lo realizado en la sesión..."
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087] resize-none" />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">Resultados obtenidos</label>
              <textarea name="resultados_obtenidos" value={form.resultados_obtenidos} onChange={handleChange} rows={3}
                placeholder="Outcomes medibles del cliente..."
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087] resize-none" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">Entregable</label>
              <input type="text" name="entregable" value={form.entregable} onChange={handleChange}
                placeholder="Descripción o link del resultado obtenido"
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087]" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">Notas privadas</label>
              <input type="text" name="notas_privadas" value={form.notas_privadas} onChange={handleChange}
                placeholder="Notas internas del consultor"
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087]" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">🎥 Grabación de sesión (OneDrive)</label>
              {form.modalidad !== 'Presencial' ? (
                <input type="url" name="url_video" value={form.url_video} onChange={handleChange}
                  placeholder="https://onedrive.live.com/..."
                  className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087]" />
              ) : (
                <p className="text-xs text-slate-400 italic px-1">No aplica para sesiones presenciales</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-[#5A6475]">📎 Evidencias (link)</label>
              <input type="url" name="url_evidencias" value={form.url_evidencias} onChange={handleChange}
                placeholder="https://onedrive.live.com/..."
                className="border border-[#C8CDD5] rounded-lg px-4 py-3 text-sm text-[#1E2A3A] focus:outline-none focus:border-[#003087]" />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button type="submit" disabled={saving}
                className="px-8 py-3 bg-[#003087] hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm rounded-lg transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">{saving ? 'hourglass_empty' : 'save'}</span>
                {saving ? 'Guardando...' : 'Guardar sesión'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de sesiones */}
      <div className="bg-white rounded-[10px] border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-base font-bold text-[#003087]" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Historial de sesiones
          </h3>
          <span className="text-xs text-slate-400">{sesiones.length} sesiones registradas</span>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-slate-400">Cargando sesiones...</div>
        ) : sesiones.length === 0 ? (
          <div className="p-12 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-[48px] text-slate-200">event_note</span>
            <p className="text-sm text-slate-400 mt-3">No hay sesiones registradas aún.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-[#E5E7EB]">
                  <th className="px-6 py-4">Lead</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Horario</th>
                  <th className="px-6 py-4">Caso de uso</th>
                  <th className="px-6 py-4">Modalidad</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Entregable</th>
                  <th className="px-6 py-4">Video</th>
                  <th className="px-6 py-4">Evidencias</th>
                </tr>
              </thead>
              <tbody>
                {sesiones.map((s) => {
                  const sc = statusColors[s.status]
                  return (
                    <tr key={s.id_sesion} className="border-b border-[#F2F4F7] hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-[#001d59]">{leadName(s.id_lead)}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(s.fecha_sesion).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {s.hora_inicio && s.hora_fin
                          ? `${s.hora_inicio} - ${s.hora_fin}`
                          : s.hora_inicio
                          ? `Desde ${s.hora_inicio}`
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{s.caso_de_uso || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                          s.modalidad === 'Presencial' ? 'bg-amber-50 text-amber-700' :
                          s.modalidad === 'Híbrida' ? 'bg-purple-50 text-purple-700' :
                          'bg-blue-50 text-[#0050C8]'
                        }`}>{s.modalidad || 'Virtual'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate">{s.entregable || '—'}</td>
                      <td className="px-6 py-4">
                        {s.modalidad === 'Presencial' 
                          ? <span className="text-xs font-medium text-slate-500 italic">Sesión presencial</span>
                          : s.url_video
                            ? <a href={s.url_video} target="_blank" rel="noopener noreferrer" className="text-[#003087] hover:text-[#00AEEF] text-xs font-medium flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">videocam</span> Ver
                              </a>
                            : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        {s.url_evidencias
                          ? <a href={s.url_evidencias} target="_blank" rel="noopener noreferrer" className="text-[#003087] hover:text-[#00AEEF] text-xs font-medium flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px]">attach_file</span> Ver
                            </a>
                          : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
