import type { RawRow } from './types'

/**
 * Normaliza un encabezado para comparar: sin acentos, minúsculas, espacios
 * colapsados, guiones tipográficos unificados.
 */
export function normKey(s: string): string {
  return String(s)
    .replace(/[–—]/g, '-')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function valorUtil(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * Busca el valor de la primera columna que coincida con alguno de los
 * candidatos, en orden, y lo devuelve **tal como vino**. Una columna presente
 * pero vacía no cuenta como encontrada: se sigue con el siguiente candidato.
 *
 * El match por prefijo solo acepta sufijos delimitados — `nombre (`, `nombre(`
 * o `nombre -` — para no resolver `Duración` a `Duración total acumulada`.
 *
 * Preservar el valor original importa para el .xlsx: read-excel-file entrega
 * las celdas de fecha y hora como Date y las numéricas como number, y
 * `coerce.ts` sabe leerlas así. Convertirlas a texto antes las arruina — el
 * String de un Date no lo entiende ningún parser nuestro.
 */
export function colValor(row: RawRow, ...candidatos: string[]): unknown {
  const porClaveNormalizada = new Map<string, unknown>()
  for (const clave of Object.keys(row)) {
    if (valorUtil(row[clave]) !== null) {
      porClaveNormalizada.set(normKey(clave), row[clave])
    }
  }

  for (const candidato of candidatos) {
    if (valorUtil(row[candidato]) !== null) return row[candidato]

    const nk = normKey(candidato)

    if (porClaveNormalizada.has(nk)) {
      const valor = porClaveNormalizada.get(nk)
      if (valorUtil(valor) !== null) return valor
    }

    for (const [clave, valor] of porClaveNormalizada) {
      if (clave.startsWith(`${nk} (`) || clave.startsWith(`${nk}(`) || clave.startsWith(`${nk} -`)) {
        if (valorUtil(valor) !== null) return valor
      }
    }
  }

  return null
}

/**
 * Igual que `colValor`, pero devuelve el valor ya como texto recortado. Es lo
 * que quieren los campos de texto; los que pasan por `coerce` deben usar
 * `colValor` para no perder el tipo de la celda.
 */
export function col(row: RawRow, ...candidatos: string[]): string | null {
  return valorUtil(colValor(row, ...candidatos))
}
