import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase-server'
import { normalizeBookingRow } from '@/lib/ingest/bookings'
import { normalizeSesionRow } from '@/lib/ingest/sesiones'
import type {
  CargaRequest,
  CargaResponse,
  FilaResultado,
  NormalizedBookingRow,
  NormalizedSesionRow,
  RawRow,
} from '@/lib/ingest/types'

export const dynamic = 'force-dynamic'

const RPC_POR_TIPO = {
  bookings: 'ingest_bookings',
  sesiones: 'ingest_sesiones',
} as const

/**
 * La única autoridad de acceso. El filtro `adminOnly` del menú es cosmético:
 * oculta el enlace, no protege nada.
 *
 * Se resuelve con la llave anónima y la cookie de sesión. El cliente de
 * servicio no se instancia hasta después de pasar por acá, porque su llave
 * salta RLS y el trigger trg_guard_consultoria_consultor de la migración f5.
 */
async function esAdmin(): Promise<boolean> {
  const sesion = await createSessionClient()

  const { data: auth, error: authError } = await sesion.auth.getUser()
  if (authError || !auth?.user) return false

  const { data, error } = await sesion
    .from('consultores')
    .select('rol')
    .eq('auth_id', auth.user.id)
    .single()

  if (error || !data) return false
  return data.rol === 'admin'
}

export async function POST(req: NextRequest) {
  if (!(await esAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: CargaRequest
  try {
    body = (await req.json()) as CargaRequest
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const { accion, tipo, filas } = body

  if (accion !== 'preview' && accion !== 'commit') {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }
  if (tipo !== 'bookings' && tipo !== 'sesiones') {
    return NextResponse.json({ error: 'Tipo de carga inválido' }, { status: 400 })
  }
  if (!Array.isArray(filas)) {
    return NextResponse.json({ error: 'Se esperaba un arreglo de filas' }, { status: 400 })
  }

  // El servidor normaliza las filas CRUDAS él mismo: es la autoridad. Lo que
  // el cliente haya calculado para pintar su pantalla no influye acá.
  const validas: Array<NormalizedBookingRow | NormalizedSesionRow> = []
  const fallidas: Array<{ fila: number; motivo: string }> = []
  const avisos: Array<{ fila: number; motivo: string }> = []

  filas.forEach((raw, i) => {
    // La fila 1 del archivo es el encabezado, así que la primera de datos es 2.
    const numero = i + 2

    const resultado = tipo === 'bookings'
      ? normalizeBookingRow(raw as RawRow, numero)
      : normalizeSesionRow(raw as RawRow, numero)

    if (resultado.ok) {
      validas.push(resultado.row)
      for (const a of resultado.avisos) avisos.push({ fila: a.fila, motivo: a.motivo })
    } else {
      for (const e of resultado.errores) fallidas.push({ fila: e.fila, motivo: e.motivo })
    }
  })

  // Filas duplicadas dentro del mismo archivo. El dry-run del RPC no puede verlas:
  // revierte cada fila antes de procesar la siguiente, así que dos filas de la misma
  // reserva previsualizan como «crear + crear» cuando la carga real dará
  // «crear + actualizar». Acá sí se ven todas juntas, así que se avisan.
  const primeraAparicion = new Map<string, number>()
  for (const row of validas) {
    const previa = primeraAparicion.get(row.clave)
    if (previa === undefined) {
      primeraAparicion.set(row.clave, row.fila)
    } else {
      avisos.push({
        fila: row.fila,
        motivo: `Duplicado dentro del archivo: ya aparece en la fila ${previa}. La previsualización lo cuenta como nuevo, pero la carga real lo actualizará.`,
      })
    }
  }

  let creadas = 0
  let actualizadas = 0

  if (validas.length > 0) {
    const servicio = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data, error } = await servicio.rpc(RPC_POR_TIPO[tipo], {
      p_filas: validas,
      p_dry_run: accion === 'preview',
    })

    if (error) {
      // Solo conteo y mensaje del motor: nunca el contenido de las filas,
      // que trae nombres, correos, teléfonos y cédulas de clientes reales.
      console.error(`[cargas] ${tipo}/${accion}: el RPC falló con ${validas.length} filas — ${error.message}`)
      return NextResponse.json({ error: 'Error procesando el lote' }, { status: 500 })
    }

    for (const r of (data ?? []) as FilaResultado[]) {
      if (r.error !== null) {
        fallidas.push({ fila: r.fila, motivo: r.error })
      } else if (r.accion === 'creada') {
        creadas += 1
      } else if (r.accion === 'actualizada') {
        actualizadas += 1
      }
      if (r.aviso !== null) avisos.push({ fila: r.fila, motivo: r.aviso })
    }
  }

  if (fallidas.length > 0) {
    const numeros = fallidas.map((f) => f.fila).join(', ')
    console.error(`[cargas] ${tipo}/${accion}: ${fallidas.length} filas fallidas (filas ${numeros})`)
  }

  const respuesta: CargaResponse = {
    creadas,
    actualizadas,
    fallidas: fallidas.sort((a, b) => a.fila - b.fila),
    avisos: avisos.sort((a, b) => a.fila - b.fila),
  }

  return NextResponse.json(respuesta)
}
