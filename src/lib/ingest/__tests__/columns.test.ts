/**
 * Match tolerante de encabezados.
 *
 * El .xlsx de registro de sesión tiene encabezados largos e inestables: con
 * acentos, espacios dobles, espacio final, sufijos entre paréntesis y a veces
 * un dígito pegado (`Categoría del caso (Potencia)1`). Este helper viene del
 * nodo `Normalize Rows` de n8n/WF-3, donde estaba minificado y sin tests.
 */
import { describe, it, expect } from 'vitest'
import { col, normKey } from '../columns'

describe('normKey', () => {
  it('quita acentos, baja a minúsculas y recorta', () => {
    expect(normKey('  Fecha de la Sesión  ')).toBe('fecha de la sesion')
  })

  it('colapsa espacios repetidos y no separables', () => {
    expect(normKey('Motivo  de la   Consulta')).toBe('motivo de la consulta')
  })

  it('unifica guiones tipográficos con el guion simple', () => {
    expect(normKey('Estado Inicial – Antes')).toBe('estado inicial - antes')
    expect(normKey('Estado Inicial — Antes')).toBe('estado inicial - antes')
  })
})

describe('col', () => {
  it('encuentra la columna por nombre exacto', () => {
    expect(col({ Pregunta: 'hola' }, 'Pregunta')).toBe('hola')
  })

  it('encuentra la columna ignorando acentos y mayúsculas', () => {
    expect(col({ 'FECHA DE LA SESION': '2026-09-15' }, 'Fecha de la Sesión')).toBe('2026-09-15')
  })

  it('encuentra la columna con espacio final en el encabezado real', () => {
    expect(col({ 'Entregables Producidos ': 'un informe' }, 'Entregables Producidos')).toBe('un informe')
  })

  it('encuentra la columna con espacios dobles en el encabezado real', () => {
    expect(col({ 'Motivo  de la  Consulta': 'flujo de caja' }, 'Motivo de la Consulta')).toBe('flujo de caja')
  })

  it('encuentra la columna cuando el encabezado real trae un sufijo entre paréntesis', () => {
    const row = { 'Acciones Realizadas Durante la Sesión (Describir paso a paso)': 'se hizo X' }
    expect(col(row, 'Acciones Realizadas Durante la Sesión')).toBe('se hizo X')
  })

  it('encuentra la columna con paréntesis pegado y dígito al final', () => {
    const row = { 'Categoría del caso (Potencia)1': 'Alto' }
    expect(col(row, 'Categoría del caso')).toBe('Alto')
  })

  it('encuentra la columna cuando el encabezado real trae un sufijo tras un guion', () => {
    const row = { 'Estado Inicial – Situación Antes de la Intervención': 'sin proceso' }
    expect(col(row, 'Estado Inicial')).toBe('sin proceso')
  })

  it('prueba los candidatos en orden y devuelve el primero con valor', () => {
    const row = { 'Correo electrónico': 'b@x.com' }
    expect(col(row, 'Correo del Usuario Atendido', 'Correo electrónico', 'email')).toBe('b@x.com')
  })

  it('salta un candidato cuya columna existe pero está vacía', () => {
    const row = { 'Correo del Usuario Atendido': '   ', 'Correo electrónico': 'b@x.com' }
    expect(col(row, 'Correo del Usuario Atendido', 'Correo electrónico')).toBe('b@x.com')
  })

  it('recorta el valor devuelto', () => {
    expect(col({ Pregunta: '  hola  ' }, 'Pregunta')).toBe('hola')
  })

  it('devuelve null cuando ningún candidato coincide', () => {
    expect(col({ Otra: 'x' }, 'Pregunta', 'pregunta')).toBeNull()
  })

  it('devuelve null con una fila vacía', () => {
    expect(col({}, 'Pregunta')).toBeNull()
  })

  it('no confunde un prefijo con una columna distinta que solo lo contiene', () => {
    // 'Duración' no debe resolver a 'Duración de la Sesión' por contención
    // arbitraria: solo por sufijo delimitado (paréntesis o guion).
    expect(col({ 'Duración total acumulada': '90' }, 'Duración')).toBeNull()
  })

  it('convierte números a cadena', () => {
    expect(col({ 'Cantidad de nuevos productos creados': 3 }, 'Cantidad de nuevos productos creados')).toBe('3')
  })
})
