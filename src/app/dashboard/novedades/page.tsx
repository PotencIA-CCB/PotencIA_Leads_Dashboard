'use client'

import { useEffect, useState } from 'react'
import { useNovedades, createNovedad, updateNovedad, deleteNovedad } from '@/hooks/useNovedades'
import { getCurrentConsultor } from '@/lib/supabase-browser'
import type { Novedad, NovedadTipo } from '@/types'

const TIPOS: { value: NovedadTipo; label: string; color: string }[] = [
  { value: 'caso_de_uso', label: 'Caso de uso', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'mejora', label: 'Mejora', color: 'bg-sky-100 text-sky-700' },
  { value: 'incidencia', label: 'Incidencia', color: 'bg-red-100 text-red-700' },
  { value: 'logro', label: 'Logro', color: 'bg-amber-100 text-amber-700' },
  { value: 'sugerencia', label: 'Sugerencia', color: 'bg-violet-100 text-violet-700' },
  { value: 'evento', label: 'Evento', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'ausencia', label: 'Ausencia', color: 'bg-orange-100 text-orange-700' },
  { value: 'otro', label: 'Otro', color: 'bg-slate-100 text-slate-600' },
]

/** Tipos con fecha relevante: eventos/ausencias que afectan la disponibilidad. */
const TIPOS_CON_FECHA: NovedadTipo[] = ['evento', 'ausencia']

function formatRangoFecha(inicio: string | null, fin: string | null): string | null {
  if (!inicio) return null
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  if (fin && fin !== inicio) return `${fmt(inicio)} → ${fmt(fin)}`
  return fmt(inicio)
}

export default function NovedadesPage() {
  const { novedades, loading, refetch } = useNovedades()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [tipo, setTipo] = useState<NovedadTipo>('caso_de_uso')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [saving, setSaving] = useState(false)

  const [filtroTipo, setFiltroTipo] = useState<NovedadTipo | 'todas'>('todas')

  const [myId, setMyId] = useState<string | null>(null)
  const [myRol, setMyRol] = useState<string | null>(null)

  useEffect(() => {
    getCurrentConsultor().then((me) => {
      if (me) {
        setMyId(me.id)
        setMyRol(me.rol)
      }
    })
  }, [])

  const puedeGestionar = (n: Novedad) => myRol === 'admin' || n.id_consultor === myId

  function resetForm() {
    setTitulo('')
    setContenido('')
    setTipo('caso_de_uso')
    setFechaInicio('')
    setFechaFin('')
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !contenido.trim()) return
    setSaving(true)
    try {
      const fechas = {
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
      }
      if (editingId) {
        await updateNovedad(editingId, { titulo: titulo.trim(), contenido: contenido.trim(), tipo, ...fechas })
      } else {
        await createNovedad({ titulo: titulo.trim(), contenido: contenido.trim(), tipo, ...fechas })
      }
      refetch()
      resetForm()
    } catch (err) {
      console.error(err)
    }
    setSaving(false)
  }

  function handleEdit(n: Novedad) {
    setEditingId(n.id)
    setTitulo(n.titulo)
    setContenido(n.contenido)
    setTipo(n.tipo)
    setFechaInicio(n.fecha_inicio ?? '')
    setFechaFin(n.fecha_fin ?? '')
    setShowForm(true)
  }

  async function handleDelete(n: Novedad) {
    if (!window.confirm(`¿Eliminar la novedad "${n.titulo}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteNovedad(n.id)
      refetch()
    } catch (err) {
      console.error(err)
    }
  }

  const novedadesFiltradas =
    filtroTipo === 'todas' ? novedades : novedades.filter((n) => n.tipo === filtroTipo)

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
              <span className="text-[#00C8FF]" aria-current="page">Novedades</span>
            </li>
          </ol>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#001d59] tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Novedades
          </h2>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="w-full sm:w-auto justify-center px-4 py-2 rounded-lg bg-[#003087] text-white text-sm font-semibold cursor-pointer inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nueva novedad
          </button>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Publicaciones del equipo: casos de uso, mejoras, logros, sugerencias y eventos o ausencias que afectan las estadísticas.
        </p>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 sm:p-6 mb-6">
          <h3 className="text-sm font-bold text-[#003087] mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {editingId ? 'Editar novedad' : 'Nueva novedad'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Título</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/30"
                placeholder="Ej: Implementé RAG para análisis de datos"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Contenido</label>
              <textarea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                rows={4}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/30 resize-none"
                placeholder="Describe el caso de uso, mejora, logro o el evento que afecta tu disponibilidad..."
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Tipo</label>
              <div className="flex flex-wrap gap-2">
                {TIPOS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer border ${
                      tipo === t.value
                        ? `${t.color} border-current`
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Fecha {TIPOS_CON_FECHA.includes(tipo) ? '(recomendado)' : '(opcional)'}
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                Para eventos o ausencias que afecten tu disponibilidad (ej: una feria el martes). Dejá el fin vacío si es un solo día.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/30"
                  aria-label="Fecha de inicio"
                />
                <span className="text-slate-400 text-sm">→</span>
                <input
                  type="date"
                  value={fechaFin}
                  min={fechaInicio || undefined}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#00C8FF]/30"
                  aria-label="Fecha de fin"
                />
                {(fechaInicio || fechaFin) && (
                  <button
                    type="button"
                    onClick={() => { setFechaInicio(''); setFechaFin('') }}
                    className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer underline"
                  >
                    Limpiar fechas
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-[#003087] text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Publicar')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtro por tipo */}
      {!loading && novedades.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            type="button"
            onClick={() => setFiltroTipo('todas')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer border ${
              filtroTipo === 'todas' ? 'bg-[#003087] text-white border-[#003087]' : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            Todas
          </button>
          {TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setFiltroTipo(t.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer border ${
                filtroTipo === t.value ? `${t.color} border-current` : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-sm text-slate-400">Cargando novedades...</p>
        </div>
      ) : novedades.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[28px]" aria-hidden="true">campaign</span>
          </div>
          <h3 className="text-base font-bold text-slate-700" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Sin novedades
          </h3>
          <p className="text-sm text-slate-500 mt-1">Publicá la primera novedad para empezar a registrar la actividad del equipo.</p>
        </div>
      ) : novedadesFiltradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 p-8 text-center">
          <p className="text-sm text-slate-500">No hay novedades de este tipo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {novedadesFiltradas.map((n) => {
            const t = TIPOS.find((x) => x.value === n.tipo)
            const rango = formatRangoFecha(n.fecha_inicio, n.fecha_fin)
            return (
              <article key={n.id} className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#00C8FF] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {n.consultor_nombre?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-slate-800">{n.consultor_nombre ?? 'Consultor'}</span>
                      {t && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span>}
                      <span className="text-[11px] text-slate-400">
                        {new Date(n.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {rango && (
                      <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 rounded-md px-2 py-0.5 mb-1.5">
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">event</span>
                        {rango}
                      </div>
                    )}
                    <h3 className="text-base font-bold text-[#001d59] mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      {n.titulo}
                    </h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{n.contenido}</p>
                  </div>
                  {puedeGestionar(n) && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => handleEdit(n)}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(n)}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 flex items-center justify-center cursor-pointer"
                        title="Eliminar"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
