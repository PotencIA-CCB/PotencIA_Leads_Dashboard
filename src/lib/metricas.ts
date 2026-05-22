export interface RegistroSesionForMetricas {
  id_consultoria: string
  cantidad_productos: number | null
}

export type Granularidad = 'dia' | 'semana' | 'mes'

export interface MetricasGlobales {
  /** All consultorias (no status filter) */
  totalConsultorias: number
  /** Count of rows where canonicalStatus === 'Resuelto' */
  consultoriasResueltas: number
  /** COUNT(DISTINCT id_lead) whose latest consultoria has status 'En seguimiento' */
  casosEnSeguimientoLeads: number
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
  // Track C (PR 4) additions
  topConsultores: { id_consultor: string; nombre: string; total: number }[]
  origenStatusBreakdown: {
    origen: string
    Pendiente: number
    Agendado: number
    'En seguimiento': number
    Resuelto: number
    Cancelado: number
    Otros: number
  }[]
  // Track D (PR 1 data layer) additions
  nitUnicos: number
  porPeriodo: { label: string; count: number }[]
  duracionPorConsultor: { consultor: string; avg: number }[]
  consultasPorArea: { area: string; count: number }[]
  recuentoPorConsultor: { consultor: string; count: number }[]
  modalidadPorConsultor: { consultor: string; [modalidad: string]: string | number }[]
  consultasPorFranja: { franja: string; count: number }[]
  tiempoPorRol: { rol: string; minutos: number }[]
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
  hora_inicio: string | null
  modalidad: string | null
  leads: {
    city: string | null
    company_role_level: string | null
    origen: string | null
    sector: string | null
    company_role_area: string | null
    nit: string | null
  } | null
  /** Left-joined from consultores table; null when no matching consultor row */
  consultores: { nombre: string | null } | null
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

/**
 * Returns ISO week number and ISO week-year for a given Date.
 * Uses the standard ISO 8601 algorithm (week starts Monday; Jan 4 is always in week 1).
 * This handles the year-boundary edge case: e.g. Dec 31 may belong to ISO week 1 of
 * the next year, and Jan 1 may belong to the last ISO week of the previous year.
 */
function isoWeekParts(d: Date): { isoYear: number; isoWeek: number } {
  // Copy and set to Thursday in the current week (ISO weeks always contain their Thursday)
  const target = new Date(d.valueOf())
  const dayOfWeek = (d.getDay() + 6) % 7 // Mon=0, Sun=6
  target.setDate(target.getDate() - dayOfWeek + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const firstThursdayDay = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDay + 3)
  const isoYear = target.getFullYear()
  const isoWeek =
    1 + Math.round((target.valueOf() - firstThursday.valueOf()) / 604800000)
  return { isoYear, isoWeek }
}

export function computeWeeklyBuckets(
  consultorias: ConsultoriaForMetricas[],
): { semana: string; total: number }[] {
  const resueltas = consultorias.filter((c) => canonicalStatus(c.status) === 'Resuelto')

  const buckets: Record<string, { label: string; bucketKey: string; total: number }> = {}

  for (const c of resueltas) {
    if (!c.fecha) continue
    const d = new Date(c.fecha + 'T00:00:00')
    if (isNaN(d.getTime())) continue

    const { isoYear, isoWeek } = isoWeekParts(d)
    const bucketKey = `${isoYear}-W${String(isoWeek).padStart(2, '0')}`
    const label = `Sem ${isoWeek}`

    if (!buckets[bucketKey]) {
      buckets[bucketKey] = { label, bucketKey, total: 0 }
    }
    buckets[bucketKey].total++
  }

  return Object.values(buckets)
    .sort((a, b) => a.bucketKey.localeCompare(b.bucketKey))
    .map(({ label, total }) => ({ semana: label, total }))
}

/** Returns title-cased version of a city key (each word's first letter uppercased). */
function titleCaseCity(key: string): string {
  return key.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

/**
 * O(n) pass keeping the latest consultoria per id_lead.
 * Rows with invalid/missing fecha do not displace a valid row.
 */
function latestConsultoriaByLead(
  consultorias: ConsultoriaForMetricas[],
): Map<string, ConsultoriaForMetricas> {
  const map = new Map<string, ConsultoriaForMetricas>()
  for (const c of consultorias) {
    const existing = map.get(c.id_lead)
    if (!existing) {
      map.set(c.id_lead, c)
      continue
    }
    // Keep the row with the greater fecha string (ISO date strings sort lexicographically)
    if (c.fecha && (!existing.fecha || c.fecha > existing.fecha)) {
      map.set(c.id_lead, c)
    }
  }
  return map
}

export function computeTopConsultores(
  consultorias: ConsultoriaForMetricas[],
  limit = 6,
): { id_consultor: string; nombre: string; total: number }[] {
  const countMap = new Map<string, { nombre: string; total: number }>()
  for (const c of consultorias) {
    if (!c.id_consultor) continue
    const entry = countMap.get(c.id_consultor)
    const nombre = c.consultores?.nombre ?? 'Sin nombre'
    if (!entry) {
      countMap.set(c.id_consultor, { nombre, total: 1 })
    } else {
      entry.total++
    }
  }
  return Array.from(countMap.entries())
    .map(([id_consultor, { nombre, total }]) => ({ id_consultor, nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

const CANONICAL_STATUSES = ['Pendiente', 'Agendado', 'En seguimiento', 'Resuelto', 'Cancelado'] as const

export function computeOrigenStatusBreakdown(
  consultorias: ConsultoriaForMetricas[],
): MetricasGlobales['origenStatusBreakdown'] {
  type Row = MetricasGlobales['origenStatusBreakdown'][number]
  const rowMap = new Map<string, Row>()

  const emptyRow = (origen: string): Row => ({
    origen,
    Pendiente: 0,
    Agendado: 0,
    'En seguimiento': 0,
    Resuelto: 0,
    Cancelado: 0,
    Otros: 0,
  })

  for (const c of consultorias) {
    const origenKey = normalizeKey(c.leads?.origen ?? null, 'Sin origen')
    if (!rowMap.has(origenKey)) rowMap.set(origenKey, emptyRow(origenKey))
    const row = rowMap.get(origenKey)!
    const status = canonicalStatus(c.status)
    if ((CANONICAL_STATUSES as readonly string[]).includes(status)) {
      ;(row as Record<string, number | string>)[status] =
        ((row as Record<string, number | string>)[status] as number) + 1
    } else {
      row.Otros++
    }
  }

  // Sort by total sum desc
  return Array.from(rowMap.values()).sort((a, b) => {
    const sumA = CANONICAL_STATUSES.reduce((s, k) => s + (a[k] as number), 0) + a.Otros
    const sumB = CANONICAL_STATUSES.reduce((s, k) => s + (b[k] as number), 0) + b.Otros
    return sumB - sumA
  })
}

const TOP_N = 6

// ─── Phase D compute functions ────────────────────────────────────────────────

/** Count distinct non-null nit values across all leads. */
export function countUniqueNit(consultorias: ConsultoriaForMetricas[]): number {
  const seen = new Set<string>()
  for (const c of consultorias) {
    if (c.leads?.nit != null) seen.add(c.leads.nit)
  }
  return seen.size
}

/** Group consultorias by time period (dia/semana/mes), sorted ascending. */
export function groupByPeriod(
  consultorias: ConsultoriaForMetricas[],
  period: Granularidad,
): { label: string; count: number }[] {
  const buckets: Record<string, number> = {}

  for (const c of consultorias) {
    if (!c.fecha) continue
    let label: string
    if (period === 'dia') {
      label = c.fecha.slice(0, 10)
    } else if (period === 'semana') {
      const d = new Date(c.fecha + 'T00:00:00')
      if (isNaN(d.getTime())) continue
      const { isoYear, isoWeek } = isoWeekParts(d)
      label = `${isoYear}-W${String(isoWeek).padStart(2, '0')}`
    } else {
      label = c.fecha.slice(0, 7)
    }
    buckets[label] = (buckets[label] ?? 0) + 1
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({ label, count }))
}

/** Average duracion_minutos per consultor, sorted by avg descending. */
export function avgDuracionByConsultor(
  consultorias: ConsultoriaForMetricas[],
): { consultor: string; avg: number }[] {
  const map = new Map<string, { sum: number; count: number }>()

  for (const c of consultorias) {
    if (c.duracion_minutos == null) continue
    const key = c.consultores?.nombre ?? 'Sin consultor'
    const entry = map.get(key)
    if (!entry) {
      map.set(key, { sum: c.duracion_minutos, count: 1 })
    } else {
      entry.sum += c.duracion_minutos
      entry.count++
    }
  }

  return Array.from(map.entries())
    .map(([consultor, { sum, count }]) => ({ consultor, avg: Math.round(sum / count) }))
    .sort((a, b) => b.avg - a.avg)
}

/** Count consultorias grouped by leads.company_role_area, sorted by count descending. */
export function countByArea(
  consultorias: ConsultoriaForMetricas[],
): { area: string; count: number }[] {
  const map: Record<string, number> = {}

  for (const c of consultorias) {
    const key = c.leads?.company_role_area ?? 'Sin área'
    map[key] = (map[key] ?? 0) + 1
  }

  return Object.entries(map)
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count)
}

/** Count consultorias grouped by consultor name, sorted by count descending. */
export function countByConsultor(
  consultorias: ConsultoriaForMetricas[],
): { consultor: string; count: number }[] {
  const map: Record<string, number> = {}

  for (const c of consultorias) {
    const key = c.consultores?.nombre ?? 'Sin consultor'
    map[key] = (map[key] ?? 0) + 1
  }

  return Object.entries(map)
    .map(([consultor, count]) => ({ consultor, count }))
    .sort((a, b) => b.count - a.count)
}

/** Cross-tab of consultor × modalidad counts. One object per consultor with modalidad keys. */
export function modalidadByConsultor(
  consultorias: ConsultoriaForMetricas[],
): { consultor: string; [modalidad: string]: string | number }[] {
  // map: consultor → { modalidad → count }
  const map = new Map<string, Record<string, number>>()

  for (const c of consultorias) {
    const consultor = c.consultores?.nombre ?? 'Sin consultor'
    const modalidad = c.modalidad ?? 'Sin modalidad'
    if (!map.has(consultor)) map.set(consultor, {})
    const entry = map.get(consultor)!
    entry[modalidad] = (entry[modalidad] ?? 0) + 1
  }

  return Array.from(map.entries()).map(([consultor, counts]) => ({
    consultor,
    ...counts,
  }))
}

const FRANJA_BUCKETS: { label: string; from: number; to: number }[] = [
  { label: '06-09', from: 6, to: 9 },
  { label: '09-12', from: 9, to: 12 },
  { label: '12-15', from: 12, to: 15 },
  { label: '15-18', from: 15, to: 18 },
  { label: '18-21', from: 18, to: 21 },
  { label: '21+', from: 21, to: 24 },
]

/** Group consultorias by franja horaria bucket (incl. 'Sin hora'). Returns all buckets. */
export function countByFranjaHoraria(
  consultorias: ConsultoriaForMetricas[],
): { franja: string; count: number }[] {
  const counts: Record<string, number> = {
    '06-09': 0,
    '09-12': 0,
    '12-15': 0,
    '15-18': 0,
    '18-21': 0,
    '21+': 0,
    'Sin hora': 0,
  }

  for (const c of consultorias) {
    if (c.hora_inicio == null) {
      counts['Sin hora']++
      continue
    }
    const h = parseInt(c.hora_inicio.slice(0, 2), 10)
    if (isNaN(h)) {
      counts['Sin hora']++
      continue
    }
    if (h >= 21) {
      counts['21+']++
    } else {
      const bucket = FRANJA_BUCKETS.find((b) => h >= b.from && h < b.to)
      if (bucket) {
        counts[bucket.label]++
      } else {
        counts['Sin hora']++
      }
    }
  }

  return [...FRANJA_BUCKETS.map((b) => b.label), 'Sin hora'].map((franja) => ({
    franja,
    count: counts[franja] ?? 0,
  }))
}

/** Sum duracion_minutos grouped by leads.company_role_level, sorted descending. */
export function tiempoPorRol(
  consultorias: ConsultoriaForMetricas[],
): { rol: string; minutos: number }[] {
  const map: Record<string, number> = {}

  for (const c of consultorias) {
    if (c.duracion_minutos == null) continue
    const key = c.leads?.company_role_level ?? 'Sin rol'
    map[key] = (map[key] ?? 0) + c.duracion_minutos
  }

  return Object.entries(map)
    .map(([rol, minutos]) => ({ rol, minutos }))
    .sort((a, b) => b.minutos - a.minutos)
}

export function computeMetricasFromConsultorias({
  consultorias,
  registroSesion,
  period = 'mes',
}: {
  consultorias: ConsultoriaForMetricas[]
  registroSesion: RegistroSesionForMetricas[]
  period?: Granularidad
}): MetricasGlobales {
  // Item 7: totalConsultorias = ALL rows; consultoriasResueltas = Resuelto-only
  const totalConsultorias = consultorias.length
  const consultoriasResueltas = consultorias.filter(
    (c) => canonicalStatus(c.status) === 'Resuelto',
  ).length

  // Item 6: latest consultoria per lead → count leads in 'En seguimiento'
  const latestByLead = latestConsultoriaByLead(consultorias)
  const casosEnSeguimientoLeads = [...latestByLead.values()].filter(
    (c) => canonicalStatus(c.status) === 'En seguimiento',
  ).length

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

    // Item 3: use categoria_caso_uso (not categoria_caso)
    const casoLabel = normalizeCasoUso(con.categoria_caso_uso)
    casoUsoMap[casoLabel] = (casoUsoMap[casoLabel] || 0) + 1

    const potenciaKey = normalizeKey(con.nivel_potencia, 'Sin nivel')
    potenciaMap[potenciaKey] = (potenciaMap[potenciaKey] || 0) + 1

    if (con.leads?.city) {
      // Item 2: dedup key stays normalized lowercase
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

  // Item 2: apply titleCaseCity on the display label; dedup key was normalized lowercase
  const allCities = Object.entries(ciudadMap)
    .map(([city, total]) => ({ city: titleCaseCity(city), total }))
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

  // Item 4: top consultores + stacked origen×status breakdown
  const topConsultores = computeTopConsultores(consultorias)
  const origenStatusBreakdown = computeOrigenStatusBreakdown(consultorias)

  // Phase D: new KPI compute functions
  const nitUnicos = countUniqueNit(consultorias)
  const porPeriodo = groupByPeriod(consultorias, period)
  const duracionPorConsultor = avgDuracionByConsultor(consultorias)
  const consultasPorArea = countByArea(consultorias)
  const recuentoPorConsultor = countByConsultor(consultorias)
  const modalidadPorConsultor = modalidadByConsultor(consultorias)
  const consultasPorFranja = countByFranjaHoraria(consultorias)
  const tiempoPorRolResult = tiempoPorRol(consultorias)

  return {
    totalConsultorias,
    consultoriasResueltas,
    casosEnSeguimientoLeads,
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
    topConsultores,
    origenStatusBreakdown,
    nitUnicos,
    porPeriodo,
    duracionPorConsultor,
    consultasPorArea,
    recuentoPorConsultor,
    modalidadPorConsultor,
    consultasPorFranja,
    tiempoPorRol: tiempoPorRolResult,
  }
}
