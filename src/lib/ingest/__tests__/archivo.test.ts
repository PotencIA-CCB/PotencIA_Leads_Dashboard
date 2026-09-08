/**
 * Lectura de archivo: conversión de matriz a filas crudas y detección del tipo.
 *
 * read-excel-file devuelve una matriz de celdas (arreglo de arreglos), no
 * objetos, así que la fila 0 hay que convertirla en encabezados a mano.
 *
 * encabezadosCorresponden existe para rechazar el archivo completo cuando se
 * subió en la pestaña equivocada, en vez de dejar que fallen 142 filas una
 * por una (spec ingesta-archivos R14).
 */
import { describe, it, expect } from 'vitest'
import { matrizARawRows, encabezadosCorresponden } from '../archivo'

describe('matrizARawRows', () => {
  it('usa la fila 0 como encabezados', () => {
    const matriz = [
      ['Id', 'Fecha de la Sesión'],
      ['SES-1', '2026-09-15'],
    ]
    expect(matrizARawRows(matriz)).toEqual([
      { 'Id': 'SES-1', 'Fecha de la Sesión': '2026-09-15' },
    ])
  })

  it('recorta espacios de los encabezados pero conserva el valor tal cual', () => {
    const matriz = [
      ['  Entregables Producidos  '],
      ['  una plantilla  '],
    ]
    const filas = matrizARawRows(matriz)
    expect(Object.keys(filas[0]!)).toEqual(['Entregables Producidos'])
    expect(filas[0]!['Entregables Producidos']).toBe('  una plantilla  ')
  })

  it('conserva números y objetos Date sin convertirlos a texto', () => {
    const fecha = new Date(Date.UTC(2026, 8, 15))
    const matriz = [
      ['Fecha de la Sesión', 'Duración de la Sesión / Minutos'],
      [fecha, 60],
    ]
    const filas = matrizARawRows(matriz)
    expect(filas[0]!['Fecha de la Sesión']).toBe(fecha)
    expect(filas[0]!['Duración de la Sesión / Minutos']).toBe(60)
  })

  it('rellena con null las celdas ausentes al final de una fila corta', () => {
    const matriz = [
      ['a', 'b', 'c'],
      ['1'],
    ]
    expect(matrizARawRows(matriz)).toEqual([{ a: '1', b: null, c: null }])
  })

  it('devuelve vacío sin filas de datos', () => {
    expect(matrizARawRows([['a', 'b']])).toEqual([])
    expect(matrizARawRows([])).toEqual([])
  })

  it('ignora columnas cuyo encabezado viene vacío', () => {
    const matriz = [
      ['Id', '', null],
      ['SES-1', 'huérfano', 'otro'],
    ]
    expect(Object.keys(matrizARawRows(matriz)[0]!)).toEqual(['Id'])
  })
})

describe('encabezadosCorresponden', () => {
  const bookings = ['Date Time', 'Customer Name', 'Customer Email', 'Booking Id']
  const sesiones = ['Id', 'Fecha de la Sesión', 'Correo del Usuario Atendido']

  it('acepta los encabezados de bookings en el tipo bookings', () => {
    expect(encabezadosCorresponden('bookings', bookings)).toBe(true)
  })

  it('acepta los encabezados de sesión en el tipo sesiones', () => {
    expect(encabezadosCorresponden('sesiones', sesiones)).toBe(true)
  })

  it('rechaza el archivo de sesión subido en el tipo bookings', () => {
    expect(encabezadosCorresponden('bookings', sesiones)).toBe(false)
  })

  it('rechaza el archivo de bookings subido en el tipo sesiones', () => {
    expect(encabezadosCorresponden('sesiones', bookings)).toBe(false)
  })

  it('rechaza una lista vacía en ambos tipos', () => {
    expect(encabezadosCorresponden('bookings', [])).toBe(false)
    expect(encabezadosCorresponden('sesiones', [])).toBe(false)
  })
})
