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
  nit_validado_rues: boolean
  renovado_2026: boolean
}

interface BiConsultoriaRow {
  id: string
  id_lead: string
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

/**
 * Number of distinct non-null, non-empty nit values for leads that have
 * at least one registro_sesion row.
 * Join: registro_sesion.id_consultoria → consultorias.id → consultorias.id_lead → leads.nit
 */
export function countNitsUnicosFromSesiones(
  sesiones: Pick<BiSesionRow, 'id_consultoria'>[],
  consultorias: Pick<BiConsultoriaRow, 'id' | 'id_lead'>[],
  leads: { id: string; nit: string | null }[],
): number {
  const consulMap = new Map(consultorias.map((c) => [c.id, c.id_lead]))
  const leadNitMap = new Map(leads.map((l) => [l.id, l.nit]))
  const seen = new Set<string>()
  for (const s of sesiones) {
    const id_lead = consulMap.get(s.id_consultoria)
    if (!id_lead) continue
    const nit = leadNitMap.get(id_lead)
    if (nit !== null && nit !== undefined && nit !== '') {
      seen.add(nit)
    }
  }
  return seen.size
}

/**
 * Number of leads where nit_validado_rues is true.
 * Business definition: COUNT leads WHERE nit_validado_rues = true.
 */
export function countNitsValidos(
  leads: Pick<BiLeadRow, 'nit_validado_rues'>[],
): number {
  return leads.filter((l) => l.nit_validado_rues === true).length
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

/**
 * Number of leads where renovado_2026 is true.
 * Business definition: COUNT leads WHERE renovado_2026 = true.
 */
export function countEmpresasRenovadas(
  leads: Pick<BiLeadRow, 'renovado_2026'>[],
): number {
  return leads.filter((l) => l.renovado_2026 === true).length
}
