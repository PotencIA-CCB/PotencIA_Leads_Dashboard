export function radarFillOpacity(consultor: string, selected: string | null): number {
  if (selected === null) return 0.15
  return consultor === selected ? 0.4 : 0.05
}

export function computeBrecha(agendadas: number, resuelto: number): number {
  return agendadas - resuelto
}

export function buildPorTema(
  cons: { id_lead: string }[],
  formularios: { id_lead: string; tema: string | null }[],
): { servicio: string; total: number }[] {
  const leadIds = new Set(cons.map(c => c.id_lead))
  const acc: Record<string, number> = {}
  for (const f of formularios) {
    if (!f.tema || !leadIds.has(f.id_lead)) continue
    acc[f.tema] = (acc[f.tema] ?? 0) + 1
  }
  return Object.entries(acc)
    .map(([servicio, total]) => ({ servicio, total }))
    .sort((a, b) => b.total - a.total)
}
