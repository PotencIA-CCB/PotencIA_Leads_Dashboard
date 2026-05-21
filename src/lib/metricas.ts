export interface PicoSemanal {
  semana_inicio: string
  total: number
  leads_atendidos: number
  resueltas: number
  en_seguimiento: number
  productos_creados: number | null
  minutos_totales: number | null
}

export interface MetricasGlobales {
  totalConsultorias: number
  porEstado: { status: string; total: number }[]
  tasaConversion: number
  porServicio: { servicio: string; total: number }[] // @deprecated — use porCasoUso
  porCasoUso: { caso: string; total: number }[]
  porCiudad: { city: string; total: number }[]
  porCargo: { cargo: string; total: number }[]
  porSemana: { semana: string; total: number }[] // @deprecated — use picos
  picos: PicoSemanal[]
  // Track B additions
  porPotencia: { nivel: string; total: number }[]
  porOrigen: { origen: string; total: number }[]
  porSector: { sector: string; total: number }[]
  totalProductos: number
  totalMinutos: number
  /** totalProductos / totalLeadsAtendidos rounded to 2 decimals; '—' when denominator is 0 */
  eficiencia: string
}

export interface ConsultoriaForMetricas {
  fecha: string
  status: string
  servicio: string | null
  categoria_caso_uso: string | null
  nivel_potencia: string | null
  duracion_minutos: number | null
  id_consultor: string | null
  id_lead: string
  leads: {
    city: string | null
    company_role_level: string | null
    origen: string | null
    sector: string | null
  } | null
}

function normalizeKey(value: string | null | undefined, fallback: string): string {
  if (value == null || value.trim() === '') return fallback
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
}

function canonicalStatus(status: string) {
  const key = normalizeKey(status, status)
  if (key === 'pendiente') return 'Pendiente'
  if (key === 'agendado') return 'Agendado'
  if (key === 'en seguimiento' || key === 'enseguimiento') return 'En seguimiento'
  if (key === 'resuelto' || key === 'completada' || key === 'completado') return 'Resuelto'
  if (key === 'cancelado' || key === 'cancelada') return 'Cancelado'
  return status.trim()
}

const TOP_N = 6

export function computeMetricasFromConsultorias(
  consultorias: ConsultoriaForMetricas[],
  picos: PicoSemanal[] = [],
): MetricasGlobales {
  const totalConsultorias = consultorias.length

  const estadoMap: Record<string, number> = {}
  const servicioMap: Record<string, number> = {}
  const casoUsoMap: Record<string, number> = {}
  const ciudadMap: Record<string, number> = {}
  const cargoMap: Record<string, number> = {}
  const potenciaMap: Record<string, number> = {}
  const origenMap: Record<string, number> = {}
  const sectorMap: Record<string, number> = {}

  for (const con of consultorias) {
    const status = canonicalStatus(con.status)
    estadoMap[status] = (estadoMap[status] || 0) + 1

    if (con.servicio) {
      const key = normalizeKey(con.servicio, 'Sin categorizar')
      servicioMap[key] = (servicioMap[key] || 0) + 1
    }

    const casoKey = normalizeKey(con.categoria_caso_uso, 'Sin categorizar')
    casoUsoMap[casoKey] = (casoUsoMap[casoKey] || 0) + 1

    // nivel_potencia — null → 'Sin nivel'
    const potenciaKey = normalizeKey(con.nivel_potencia, 'Sin nivel')
    potenciaMap[potenciaKey] = (potenciaMap[potenciaKey] || 0) + 1

    if (con.leads?.city) {
      const key = normalizeKey(con.leads.city, 'Sin ciudad')
      ciudadMap[key] = (ciudadMap[key] || 0) + 1
    }

    if (con.leads?.company_role_level) {
      const key = normalizeKey(con.leads.company_role_level, 'Sin cargo')
      cargoMap[key] = (cargoMap[key] || 0) + 1
    }

    // leads.origen — null/empty → 'Sin origen'
    const origenKey = normalizeKey(con.leads?.origen ?? null, 'Sin origen')
    origenMap[origenKey] = (origenMap[origenKey] || 0) + 1

    // leads.sector — null/empty → 'Sin sector'
    const sectorKey = normalizeKey(con.leads?.sector ?? null, 'Sin sector')
    sectorMap[sectorKey] = (sectorMap[sectorKey] || 0) + 1
  }

  const porEstado = Object.entries(estadoMap).map(([status, total]) => ({ status, total }))

  const resueltos = estadoMap['Resuelto'] || 0
  const tasaConversion = totalConsultorias > 0 ? Math.round((resueltos / totalConsultorias) * 100) : 0

  const porServicio = Object.entries(servicioMap)
    .map(([servicio, total]) => ({ servicio, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N)

  const porCasoUso = Object.entries(casoUsoMap)
    .map(([caso, total]) => ({ caso, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N)

  const allCities = Object.entries(ciudadMap)
    .map(([city, total]) => ({ city, total }))
    .sort((a, b) => b.total - a.total)

  const topCities = allCities.slice(0, TOP_N)
  const otrosCities = allCities.slice(TOP_N)
  if (otrosCities.length > 0) {
    topCities.push({ city: 'Otros', total: otrosCities.reduce((acc, c) => acc + c.total, 0) })
  }
  const porCiudad = topCities

  const porCargo = Object.entries(cargoMap)
    .map(([cargo, total]) => ({ cargo, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const porPotencia = Object.entries(potenciaMap)
    .map(([nivel, total]) => ({ nivel, total }))
    .sort((a, b) => b.total - a.total)

  const porOrigen = Object.entries(origenMap)
    .map(([origen, total]) => ({ origen, total }))
    .sort((a, b) => b.total - a.total)

  const allSectors = Object.entries(sectorMap)
    .map(([sector, total]) => ({ sector, total }))
    .sort((a, b) => b.total - a.total)
  const topSectors = allSectors.slice(0, TOP_N)
  const otrosSectors = allSectors.slice(TOP_N)
  if (otrosSectors.length > 0) {
    topSectors.push({ sector: 'Otros', total: otrosSectors.reduce((acc, s) => acc + s.total, 0) })
  }
  const porSector = topSectors

  // Aggregate picos-derived KPIs
  const totalProductos = picos.reduce((acc, p) => acc + (p.productos_creados ?? 0), 0)
  const totalMinutos = picos.reduce((acc, p) => acc + (p.minutos_totales ?? 0), 0)
  // totalLeadsAtendidos: sum of leads_atendidos across all picos weeks
  const totalLeadsAtendidos = picos.reduce((acc, p) => acc + p.leads_atendidos, 0)
  // eficiencia = totalProductos / totalLeadsAtendidos; '—' when denominator is 0
  const eficiencia = totalLeadsAtendidos === 0 ? '—' : (totalProductos / totalLeadsAtendidos).toFixed(2)

  // @deprecated porSemana — retained for one release; use picos instead
  const porSemana: { semana: string; total: number }[] = []

  return {
    totalConsultorias,
    porEstado,
    tasaConversion,
    porServicio,
    porCasoUso,
    porCiudad,
    porCargo,
    porSemana,
    picos,
    porPotencia,
    porOrigen,
    porSector,
    totalProductos,
    totalMinutos,
    eficiencia,
  }
}
