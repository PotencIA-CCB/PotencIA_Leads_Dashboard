export interface SesionRow {
  id_consultoria: string
  resultado: string | null
}

export interface ConsultoriaRow {
  id: string
  id_lead: string
  status?: string
}

export interface FunnelStats {
  totalLandingLeads: number
  landingNeverBooked: number
  landingBooked: number
  noShows: number
  cicloCompleto: number
  bookedNoLandingDirecto: number
  soloBookedNoSession: number
  asistieronSinLandingNiBooking: number
}

export interface FormularioRow {
  id_lead: string
}

export interface LeadRow {
  id: string
}

export interface CapturaStats {
  caso1: number
  enSeguimiento: number
  resuelto: number
  escalar: number
}

export function computeCapturaStats(
  leads: LeadRow[],
  formulariosData: FormularioRow[],
  consultoriasData: ConsultoriaRow[],
  sesionRows: SesionRow[],
): CapturaStats {
  const landingSet = new Set(formulariosData.map((f) => f.id_lead))

  const consultoriaSet = new Set(consultoriasData.map((c) => c.id_lead))

  const leadByConsultoriaId = new Map(consultoriasData.map((c) => [c.id, c.id_lead]))

  const sesionSet = new Set<string>()
  for (const s of sesionRows) {
    const leadId = leadByConsultoriaId.get(s.id_consultoria)
    if (leadId) sesionSet.add(leadId)
  }

  let caso1 = 0
  for (const l of leads) {
    if (landingSet.has(l.id) && consultoriaSet.has(l.id) && sesionSet.has(l.id)) {
      caso1++
    }
  }

  const enSeguimiento = sesionRows.filter((r) => r.resultado === 'Seguimiento').length
  const resuelto = sesionRows.filter((r) => r.resultado === 'Resuelto').length
  const escalar = sesionRows.filter((r) => r.resultado === 'Escalar').length

  return { caso1, enSeguimiento, resuelto, escalar }
}

export function statCardShowsTooltip(helpText: string | undefined): boolean {
  return typeof helpText === 'string' && helpText.trim().length > 0
}

export function computeFunnelStats(
  leads: LeadRow[],
  formulariosData: FormularioRow[],
  consultoriasData: ConsultoriaRow[],
  sesionRows: SesionRow[],
): FunnelStats {
  // Build lookup sets
  const landingSet = new Set(formulariosData.map((f) => f.id_lead))

  const consultoriaSet = new Set(consultoriasData.map((c) => c.id_lead))

  const leadByConsultoriaId = new Map(consultoriasData.map((c) => [c.id, c.id_lead]))

  const sesionSet = new Set<string>()
  for (const s of sesionRows) {
    const leadId = leadByConsultoriaId.get(s.id_consultoria)
    if (leadId) sesionSet.add(leadId)
  }

  // No-shows: landing leads with a consultoria row status === 'No asistió'
  const noShowLeadSet = new Set<string>()
  for (const c of consultoriasData) {
    if (c.status === 'No asistió' && landingSet.has(c.id_lead)) {
      noShowLeadSet.add(c.id_lead)
    }
  }

  let totalLandingLeads = 0
  let landingNeverBooked = 0
  let landingBooked = 0
  let cicloCompleto = 0
  let bookedNoLandingDirecto = 0
  let soloBookedNoSession = 0

  for (const l of leads) {
    const L = landingSet.has(l.id)
    const C = consultoriaSet.has(l.id)
    const S = sesionSet.has(l.id)

    if (L) totalLandingLeads++
    if (L && !C) landingNeverBooked++
    if (L && C) landingBooked++
    if (L && C && S) cicloCompleto++
    if (C && S && !L) bookedNoLandingDirecto++
    if (C && !S && !L) soloBookedNoSession++
  }

  // asistieronSinLandingNiBooking: leads in sesionSet with no landing and no consultoria
  // These are leads whose id was resolved via sesionSet (via leadByConsultoriaId) but
  // are not in our leads array (they would not be counted above). Since we iterate only
  // known leads, count them from sesionSet directly.
  let asistieronSinLandingNiBooking = 0
  for (const leadId of sesionSet) {
    if (!landingSet.has(leadId) && !consultoriaSet.has(leadId)) {
      asistieronSinLandingNiBooking++
    }
  }

  const noShows = noShowLeadSet.size

  return {
    totalLandingLeads,
    landingNeverBooked,
    landingBooked,
    noShows,
    cicloCompleto,
    bookedNoLandingDirecto,
    soloBookedNoSession,
    asistieronSinLandingNiBooking,
  }
}
