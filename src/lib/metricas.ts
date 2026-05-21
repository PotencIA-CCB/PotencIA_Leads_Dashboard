export interface RegistroSesionForMetricas {
  id_consultoria: string
  cantidad_productos: number | null
}

export interface MetricasGlobales {
  totalConsultorias: number
  porEstado: { status: string; total: number }[]
  tasaConversion: number
  porServicio: { servicio: string; total: number }[] // @deprecated — use porCasoUso
  porCasoUso: { caso: string; total: number }[]
  porCiudad: { city: string; total: number }[]
  porCargo: { cargo: string; total: number }[]
  porSemana: { semana: string; total: number }[]
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
  categoria_caso: string | null
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

export const EFFECTIVE_STATUSES = ['Resuelto'] as const

export const CASO_USO_NORMALIZATION_MAP: Record<string, string> = {
  'agente': 'Agentes',
  'asistentes de ia para tareas pequeñas y repetitivas': 'Asistentes',
  'asistente de ia para tareas pequeñas y repetitivas': 'Asistentes',
  'asistentes de ia para tareas pequeñas y repetitvas': 'Asistentes',
}

export function normalizeCasoUso(raw: string | null): string {
  if (raw == null || raw.trim() === '') return 'Sin categorizar'
  const key = raw.trim().toLowerCase()
  return CASO_USO_NORMALIZATION_MAP[key] ?? raw.trim()
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

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function computeWeeklyBuckets(
  consultorias: ConsultoriaForMetricas[],
): { semana: string; total: number }[] {
  const resueltas = consultorias.filter((c) => canonicalStatus(c.status) === 'Resuelto')

  // bucket key → { label, isoDate for sorting }
  const buckets: Record<string, { label: string; isoDate: string; total: number }> = {}

  for (const c of resueltas) {
    if (!c.fecha) continue
    const d = new Date(c.fecha + 'T00:00:00')
    if (isNaN(d.getTime())) continue

    const day = d.getDate()
    const weekNum = Math.ceil(day / 7)
    const mesLabel = MESES_ES[d.getMonth()]
    const label = `Sem ${weekNum} ${mesLabel}`

    // key for deduplication: year + month + weekNum
    const bucketKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${weekNum}`

    if (!buckets[bucketKey]) {
      buckets[bucketKey] = { label, isoDate: bucketKey, total: 0 }
    }
    buckets[bucketKey].total++
  }

  return Object.values(buckets)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    .map(({ label, total }) => ({ semana: label, total }))
}

const TOP_N = 6

export function computeMetricasFromConsultorias({
  consultorias,
  registroSesion,
}: {
  consultorias: ConsultoriaForMetricas[]
  registroSesion: RegistroSesionForMetricas[]
}): MetricasGlobales {
  const totalConsultorias = consultorias.filter((c) => canonicalStatus(c.status) === 'Resuelto').length

  const totalProductos = registroSesion.reduce((sum, r) => sum + (r.cantidad_productos ?? 0), 0)
  const totalMinutos = consultorias.reduce((sum, c) => sum + (c.duracion_minutos ?? 0), 0)
  const eficiencia = '—'

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

    const casoLabel = normalizeCasoUso(con.categoria_caso)
    casoUsoMap[casoLabel] = (casoUsoMap[casoLabel] || 0) + 1

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

    const origenKey = normalizeKey(con.leads?.origen ?? null, 'Sin origen')
    origenMap[origenKey] = (origenMap[origenKey] || 0) + 1

    const sectorKey = normalizeKey(con.leads?.sector ?? null, 'Sin sector')
    sectorMap[sectorKey] = (sectorMap[sectorKey] || 0) + 1
  }

  const porEstado = Object.entries(estadoMap).map(([status, total]) => ({ status, total }))

  const resueltos = estadoMap['Resuelto'] || 0
  const totalAll = consultorias.length
  const tasaConversion = totalAll > 0 ? Math.round((resueltos / totalAll) * 100) : 0

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

  const porSemana = computeWeeklyBuckets(consultorias)

  return {
    totalConsultorias,
    porEstado,
    tasaConversion,
    porServicio,
    porCasoUso,
    porCiudad,
    porCargo,
    porSemana,
    porPotencia,
    porOrigen,
    porSector,
    totalProductos,
    totalMinutos,
    eficiencia,
  }
}
