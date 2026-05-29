export interface SesionRow {
  id_consultoria: string
  resultado: string | null
}

export interface ConsultoriaRow {
  id: string
  id_lead: string
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
