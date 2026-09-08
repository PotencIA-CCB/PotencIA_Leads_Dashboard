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
 * candidatos, en orden. Una columna presente pero vacía no cuenta como
 * encontrada: se sigue con el siguiente candidato.
 *
 * El match por prefijo solo acepta sufijos delimitados — `nombre (`, `nombre(`
 * o `nombre -` — para no resolver `Duración` a `Duración total acumulada`.
 */
export function col(row: RawRow, ...candidatos: string[]): string | null {
  const porClaveNormalizada = new Map<string, unknown>()
  for (const clave of Object.keys(row)) {
    if (valorUtil(row[clave]) !== null) {
      porClaveNormalizada.set(normKey(clave), row[clave])
    }
  }

  for (const candidato of candidatos) {
    const directo = valorUtil(row[candidato])
    if (directo !== null) return directo

    const nk = normKey(candidato)

    const exacto = porClaveNormalizada.get(nk)
    if (exacto !== undefined) {
      const v = valorUtil(exacto)
      if (v !== null) return v
    }

    for (const [clave, valor] of porClaveNormalizada) {
      if (clave.startsWith(`${nk} (`) || clave.startsWith(`${nk}(`) || clave.startsWith(`${nk} -`)) {
        const v = valorUtil(valor)
        if (v !== null) return v
      }
    }
  }

  return null
}
