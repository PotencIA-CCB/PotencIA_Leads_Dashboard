'use client'

import { useEffect, useState } from 'react'
import { getCurrentConsultor } from '@/lib/supabase-browser'
import { parseTsv } from '@/lib/ingest/bookings'
import { matrizARawRows, encabezadosCorresponden } from '@/lib/ingest/archivo'
import type { CargaResponse, RawRow, TipoCarga } from '@/lib/ingest/types'

type Estado = 'inicial' | 'parseando' | 'previsualizado' | 'cargando' | 'cargado'

const TIPOS: Array<{
  id: TipoCarga
  label: string
  extension: string
  accept: string
  nota: string
}> = [
  {
    id: 'bookings',
    label: 'Microsoft Bookings',
    extension: '.tsv',
    accept: '.tsv,text/tab-separated-values,text/plain',
    nota: 'Export crudo de Microsoft Bookings, separado por tabuladores.',
  },
  {
    id: 'sesiones',
    label: 'Registro de sesión',
    extension: '.xlsx',
    accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    nota: 'Excel de evidencias de consultoría.',
  },
]

/**
 * Lee el .xlsx en el navegador. La importación es dinámica para que
 * read-excel-file no entre en el bundle inicial ni en el del Worker.
 */
async function leerXlsx(file: File): Promise<RawRow[]> {
  // Se usa el export nombrado `readSheet`, NO el export por defecto.
  // `readXlsxFile` (el default) devuelve `Sheet[]` — un objeto `{ sheet, data }`
  // por cada hoja del libro — mientras que `matrizARawRows` espera la matriz de
  // celdas de UNA hoja. Pasarle el default haría que llamara `.map` sobre un
  // objeto y reventara en la primera carga. `readSheet` sin hoja explícita toma
  // la primera, que es lo que queremos.
  const { readSheet } = await import('read-excel-file/browser')
  return matrizARawRows(await readSheet(file))
}

export default function CargasPage() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [tipo, setTipo] = useState<TipoCarga>('bookings')
  const [estado, setEstado] = useState<Estado>('inicial')
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [filas, setFilas] = useState<RawRow[]>([])
  const [previsualizacion, setPrevisualizacion] = useState<CargaResponse | null>(null)
  const [resultado, setResultado] = useState<CargaResponse | null>(null)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    getCurrentConsultor().then((c) => {
      if (vigente) setAutorizado(c?.rol === 'admin')
    })
    return () => {
      vigente = false
    }
  }, [])

  function reiniciar() {
    setEstado('inicial')
    setNombreArchivo(null)
    setFilas([])
    setPrevisualizacion(null)
    setResultado(null)
    setErrorGlobal(null)
  }

  function cambiarTipo(nuevo: TipoCarga) {
    setTipo(nuevo)
    reiniciar()
  }

  async function llamarApi(accion: 'preview' | 'commit', crudas: RawRow[]): Promise<CargaResponse> {
    const res = await fetch('/api/cargas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, tipo, filas: crudas }),
    })
    if (!res.ok) {
      const cuerpo = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(cuerpo.error ?? 'Error inesperado del servidor.')
    }
    return (await res.json()) as CargaResponse
  }

  async function manejarArchivo(file: File) {
    reiniciar()
    setNombreArchivo(file.name)
    setEstado('parseando')

    try {
      const crudas = tipo === 'bookings' ? parseTsv(await file.text()) : await leerXlsx(file)

      if (crudas.length === 0) {
        setErrorGlobal('El archivo no tiene filas de datos.')
        setEstado('inicial')
        return
      }

      if (!encabezadosCorresponden(tipo, Object.keys(crudas[0]!))) {
        const esperado = TIPOS.find((t) => t.id === tipo)!
        setErrorGlobal(
          `Los encabezados no corresponden a ${esperado.label}. ¿Elegiste la pestaña correcta?`,
        )
        setEstado('inicial')
        return
      }

      setFilas(crudas)
      setPrevisualizacion(await llamarApi('preview', crudas))
      setEstado('previsualizado')
    } catch (e) {
      setErrorGlobal(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
      setEstado('inicial')
    }
  }

  async function confirmar() {
    setEstado('cargando')
    try {
      setResultado(await llamarApi('commit', filas))
      setEstado('cargado')
    } catch (e) {
      setErrorGlobal(e instanceof Error ? e.message : 'No se pudo completar la carga.')
      setEstado('previsualizado')
    }
  }

  if (autorizado === null) {
    return <p className="text-sm text-slate-500">Verificando permisos…</p>
  }

  if (!autorizado) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h1
          className="text-lg font-bold text-slate-900"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Cargas
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta sección está disponible solo para administradores.
        </p>
      </div>
    )
  }

  const tipoActual = TIPOS.find((t) => t.id === tipo)!
  const informe = resultado ?? previsualizacion
  const aEscribir = informe ? informe.creadas + informe.actualizadas : 0

  return (
    <div className="space-y-5">
      <header>
        <h1
          className="text-xl font-bold text-slate-900"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Cargas
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          El archivo se lee en tu navegador y se revisa antes de escribir nada.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de carga">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tipo === t.id}
            onClick={() => cambiarTipo(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border cursor-pointer ${
              tipo === t.id
                ? 'bg-[#003087] text-white border-[#003087]'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {t.label}
            <span className="ml-2 text-[11px] font-normal opacity-80">{t.extension}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <p className="text-xs text-slate-500 mb-3">{tipoActual.nota}</p>

        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 cursor-pointer">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            upload_file
          </span>
          Elegir archivo {tipoActual.extension}
          <input
            type="file"
            accept={tipoActual.accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void manejarArchivo(file)
              e.target.value = ''
            }}
          />
        </label>

        {nombreArchivo && (
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-medium">{nombreArchivo}</span>
            {filas.length > 0 && <span className="text-slate-500"> · {filas.length} filas</span>}
          </p>
        )}

        {estado === 'parseando' && (
          <p className="mt-3 text-sm text-slate-500" aria-live="polite">
            Leyendo y revisando el archivo…
          </p>
        )}

        {errorGlobal && (
          <p
            className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
            role="alert"
          >
            {errorGlobal}
          </p>
        )}
      </div>

      {informe && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">
            {resultado ? 'Resultado de la carga' : 'Previsualización'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Contador
              tono="emerald"
              valor={informe.creadas}
              etiqueta={resultado ? 'creadas' : 'se van a crear'}
            />
            <Contador
              tono="sky"
              valor={informe.actualizadas}
              etiqueta={resultado ? 'actualizadas' : 'se van a actualizar'}
            />
            <Contador
              tono="rose"
              valor={informe.fallidas.length}
              etiqueta={resultado ? 'fallaron' : 'con error'}
            />
          </div>

          <ListaIncidencias
            titulo="Errores por fila"
            tono="rose"
            items={informe.fallidas}
            vacio="Ninguna fila con error."
          />

          <ListaIncidencias
            titulo="Avisos"
            tono="amber"
            items={informe.avisos}
            vacio="Ningún aviso."
          />

          {!resultado ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={reiniciar}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => void confirmar()}
                disabled={estado === 'cargando' || aEscribir === 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#003087] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {estado === 'cargando' ? 'Cargando…' : `Cargar ${aEscribir} filas`}
              </button>
              <span className="text-xs text-slate-500">Nada se ha escrito todavía.</span>
            </div>
          ) : (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                onClick={reiniciar}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#003087] cursor-pointer"
              >
                Cargar otro archivo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const TONOS: Record<string, string> = {
  emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  sky: 'text-sky-700 bg-sky-50 border-sky-200',
  rose: 'text-rose-700 bg-rose-50 border-rose-200',
  amber: 'text-amber-800 bg-amber-50 border-amber-200',
}

function Contador({ tono, valor, etiqueta }: { tono: string; valor: number; etiqueta: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${TONOS[tono]}`}>
      <p
        className="text-2xl font-bold leading-none"
        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs font-medium">{etiqueta}</p>
    </div>
  )
}

function ListaIncidencias({
  titulo,
  tono,
  items,
  vacio,
}: {
  titulo: string
  tono: string
  items: Array<{ fila: number; motivo: string }>
  vacio: string
}) {
  return (
    <div className="mt-5">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
        {titulo}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{vacio}</p>
      ) : (
        <ul className={`rounded-xl border divide-y divide-white/60 ${TONOS[tono]}`}>
          {items.map((item, i) => (
            <li key={`${item.fila}-${i}`} className="px-3 py-2 text-xs">
              <span className="font-semibold">Fila {item.fila}</span>
              <span className="mx-1.5 opacity-50" aria-hidden="true">
                ·
              </span>
              <span>{item.motivo}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
