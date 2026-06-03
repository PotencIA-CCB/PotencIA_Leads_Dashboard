/**
 * Pure helper functions for client-side lead filtering and pagination.
 * Exported so they can be imported directly in unit tests.
 */

export interface SearchableLead {
  nombre_completo: string | null
  email: string
  phone: string | null
  id_num: string | null
  empresa: string | null
  nit: string | null
}

/**
 * Returns true when the lead matches the search query.
 * Matches against: nombre_completo, email, phone, id_num, empresa, nit.
 * Empty/whitespace query always returns true (no filter applied).
 * Null/undefined fields are treated as non-matching (no runtime error).
 */
export function matchesSearch(lead: SearchableLead, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  return (
    (lead.nombre_completo ?? '').toLowerCase().includes(q) ||
    (lead.email ?? '').toLowerCase().includes(q) ||
    (lead.phone ?? '').toLowerCase().includes(q) ||
    (lead.id_num ?? '').toLowerCase().includes(q) ||
    (lead.empresa ?? '').toLowerCase().includes(q) ||
    (lead.nit ?? '').toLowerCase().includes(q)
  )
}

export interface PaginateResult<T> {
  slice: T[]
  totalPages: number
  from: number
  to: number
}

/**
 * Slices an array for the given page and size.
 * Page is 1-indexed.
 * totalPages is at least 1 (even for an empty array).
 * from/to are 1-indexed counts for the "Mostrando X–Y de N" label.
 */
export function paginate<T>(items: T[], page: number, size: number): PaginateResult<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / size))
  const from = items.length === 0 ? 1 : (page - 1) * size + 1
  const to = Math.min(page * size, items.length)
  const slice = items.slice((page - 1) * size, page * size)
  return { slice, totalPages, from, to }
}
