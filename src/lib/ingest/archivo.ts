import { headersLookLikeBookings } from './bookings'
import { headersLookLikeSesiones } from './sesiones'
import type { RawRow, TipoCarga } from './types'

/**
 * Convierte la matriz de celdas que devuelve read-excel-file en filas crudas.
 *
 * Los valores se conservan tal cual llegan — números y Date incluidos — porque
 * `coerce.ts` ya sabe interpretarlos y convertirlos a texto acá perdería
 * información. Las columnas con encabezado vacío se descartan.
 */
export function matrizARawRows(matriz: unknown[][]): RawRow[] {
  if (matriz.length < 2) return []

  const encabezados = (matriz[0] ?? []).map((h) => String(h ?? '').trim())

  return matriz.slice(1).map((linea) => {
    const fila: RawRow = {}
    encabezados.forEach((h, i) => {
      if (h !== '') fila[h] = linea[i] ?? null
    })
    return fila
  })
}

/**
 * ¿Los encabezados corresponden al tipo de carga elegido? Permite rechazar el
 * archivo completo de una vez, en vez de dejar que fallen todas las filas.
 */
export function encabezadosCorresponden(tipo: TipoCarga, encabezados: string[]): boolean {
  return tipo === 'bookings'
    ? headersLookLikeBookings(encabezados)
    : headersLookLikeSesiones(encabezados)
}
