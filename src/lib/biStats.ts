// Pure compute functions for Business Intelligence indicators.
// All functions are stateless and free of side effects — no Supabase calls.
// Input shapes use minimal Pick<> to avoid tight coupling to the full Lead type.

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

interface BiSesionRow {
  id_consultoria: string
}

interface BiLeadRow {
  nit: string | null
  empresa: string | null
  renovado?: string | null
}

// ---------------------------------------------------------------------------
// Compute functions
// ---------------------------------------------------------------------------

/**
 * Total number of session rows.
 * Business definition: COUNT(*) of registro_sesion rows.
 */
export function countSesionesTotales(
  rows: Pick<BiSesionRow, 'id_consultoria'>[],
): number {
  return rows.length
}

/**
 * Number of distinct non-null, non-empty nit values across all leads.
 * Business definition: DISTINCT non-null, non-empty leads.nit.
 */
export function countNitsUnicos(
  leads: Pick<BiLeadRow, 'nit'>[],
): number {
  const seen = new Set<string>()
  for (const lead of leads) {
    if (lead.nit !== null && lead.nit !== '') {
      seen.add(lead.nit)
    }
  }
  return seen.size
}

export function countTotalEmpresasRegistradas(leads: Pick<BiLeadRow, 'nit'>[]): number {
  const seen = new Set<string>()
  for (const lead of leads) {
    if (lead.nit !== null && lead.nit !== '') {
      seen.add(lead.nit)
    }
  }
  return seen.size
}

export function countEmpresasNitsValidos(leads: Pick<BiLeadRow, 'nit' | 'renovado'>[]): number {
  const seen = new Set<string>()
  for (const lead of leads) {
    if (lead.nit !== null && lead.nit !== '' && lead.renovado != null && lead.renovado !== '') {
      seen.add(lead.nit)
    }
  }
  return seen.size
}

export function countEmpresasRenovadas(leads: Pick<BiLeadRow, 'nit' | 'renovado'>[]): number {
  const seen = new Set<string>()
  for (const lead of leads) {
    if (lead.nit !== null && lead.nit !== '' && lead.renovado === 'Renovado') {
      seen.add(lead.nit)
    }
  }
  return seen.size
}

/**
 * Number of leads with a non-null, non-whitespace empresa.
 * Business definition: COUNT leads WHERE empresa IS NOT NULL AND trim != ''.
 */
export function countEmpresasRegistradas(
  leads: Pick<BiLeadRow, 'empresa'>[],
): number {
  return leads.filter(
    (l) => l.empresa !== null && l.empresa.trim() !== '',
  ).length
}
