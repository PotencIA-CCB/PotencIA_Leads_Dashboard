import { CITY_TO_DEPT } from './geo/cityToDept'

export interface RegistroSesionForMetricas {
  id_consultoria: string
  cantidad_productos: number | null
  sesion_grabada?: boolean | null
  resultado_final?: string | null
  duracion_sesion_minutos?: number | null
}

/** TASK-10: Build a Set of attended consultoria ids from registro_sesion rows. */
export function buildAttendedSet(registros: RegistroSesionForMetricas[]): Set<string> {
  const set = new Set<string>()
  for (const r of registros) {
    set.add(r.id_consultoria)
  }
  return set
}

export type Granularidad = 'dia' | 'semana' | 'mes' | 'año'

export interface MetricasGlobales {
  /** All consultorias (no status filter) */
  totalConsultorias: number
  /** Count of rows where canonicalStatus === 'Resuelto' */
  consultoriasResueltas: number
  /** COUNT(DISTINCT id_lead) whose latest consultoria has status 'En seguimiento' */
  casosEnSeguimientoLeads: number
  porEstado: { status: string; total: number }[]
  /** Attended sessions (id in registro_sesion.id_consultoria) AND status !== 'Agendado'.
   *  Used by the estado donut chart to avoid Agendado contamination. */
  porEstadoAtendidas: { status: string; total: number }[]
  tasaConversion: number
  porCasoUso: { caso: string; total: number }[]
  porCargo: { cargo: string; total: number }[]
  porSemana: { semana: string; total: number }[]
  // Track B additions
  porPotencia: { nivel: string; total: number }[]
  porOrigen: { origen: string; total: number }[]
  totalProductos: number
  totalMinutos: number
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
  /** Average minutes per session grouped by seniority level (company_role_level). Renamed from tiempoPorRol. */
  tiempoPromedioPorRol: { rol: string; minutos: number }[]
  /** OLS regression result over scatterDuracionProductos data points. */
  scatterRegression: { slope: number; intercept: number; line: { x: number; y: number }[] }
  /** Sessions grouped by department name (NOMBRE_DPT from GeoJSON) */
  porDepartamento: { dept: string; total: number }[]
  /** Count of consultorias whose city does not map to a known department */
  sinUbicacion: number
  // New metrics
  /** % leads únicos con ≥1 sesión Resuelto|En seguimiento vs total leads únicos del dataset */
  tasaLeadConversion: number
  /** total leads (param) - leads con consultoria */
  leadsSinConsultoria: number
  /** COUNT DISTINCT id_lead en el dataset */
  leadsConConsultoria: number
  /** % sesion_grabada=true en registro_sesion */
  tasaSesionesGrabadas: number
  /** % leads con 2+ consultorias vs leads con ≥1 */
  tasaRetorno: number
  /** % resultado_final IS NOT NULL en registro_sesion */
  tasaDocumentacion: number
  /** Count of porEstadoAtendidas entries with status 'En seguimiento'. Aligns KPI card with donut segment. */
  consultoriasEnSeguimientoAtendidas: number
  /** histogram: cuántos leads tuvieron N visitas */
  distribucionRetorno: { visitas: number; leads: number }[]
  /** Resuelto sin registro_sesion vinculado */
  consultoriasSinRegistro: number
  /** buckets ISO semanales para status Agendado */
  porAgendadoSemana: { semana: string; total: number }[]
  scatterDuracionProductos: { duracion: number; productos: number; consultor: string }[]
  /** TASK-15: cells carry ids for drill-down; only Mon–Fri, attended sessions only */
  heatmapFranjaDia: { franja: string; dia: string; count: number; consultoriaIds: string[] }[]
  consultorMetrics: { consultor: string; sesiones: number; duracionAvg: number; productos: number; pctGrabadas: number }[]
}

export interface ConsultoriaForMetricas {
  id?: string
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
  /** Booking reference from MS Bookings. Null when row was created by WF-3 with no matching WF-2 booking. */
  booking_id?: string | null
  leads: {
    nombre?: string | null
    apellidos?: string | null
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

/** @deprecated Use NORMALIZE_CATEGORIA_CASO for categoria_caso field instead. */
export const CASO_USO_NORMALIZATION_MAP: Record<string, string> = {
  'agente': 'Agentes',
  'asistentes de ia para tareas pequeñas y repetitivas': 'Asistentes',
  'asistente de ia para tareas pequeñas y repetitivas': 'Asistentes',
  'asistentes de ia para tareas pequeñas y repetitvas': 'Asistentes',
}

/** @deprecated Use normalizeCategoriaCaso instead. */
export function normalizeCasoUso(raw: string | null): string {
  if (raw == null || raw.trim() === '') return 'Sin categorizar'
  const key = raw.trim().toLowerCase()
  return CASO_USO_NORMALIZATION_MAP[key] ?? raw.trim()
}

/**
 * Normalization map for the `categoria_caso` field in the consultorias table.
 * Keys are lowercase; values are the canonical display labels.
 * The live DB contains typos and variant spellings — this map collapses them.
 */
export const NORMALIZE_CATEGORIA_CASO: Record<string, string> = {
  'agente': 'Agentes',
  'agente de ia': 'Agentes',
  'agentes de ia integrado a workspace': 'Agentes',
  'asistente de ia para tareas pequeñas y repetitivas': 'Asistentes',
  'asistentes de ia para tareas pequeñas y repetitivas': 'Asistentes',
  'asistentes de ia para tareas pequeñas y repetitvas': 'Asistentes', // typo in DB
  'asistente de ia para tareas repetitivas': 'Asistentes',
  'asistentes de ia para tareas repetitivas': 'Asistentes',
  'asistentes ia para tareas pequeñas y repetitivas': 'Asistentes',
  'asistente creador de contenido y copys creativos': 'Asistentes',
  'asistente de selección de candidatos': 'Asistentes',
  'asistente de gestión documental': 'Asistentes',
  'asistente de reportes financieros': 'Asistentes',
  'prototipado ágil con ia': 'Prototipados',
  'prototipado de apps con ia': 'Prototipados',
  'prototipos de landing page': 'Prototipados',
  'páginas web funcionales (landing page / mvp)': 'Prototipados',
  'landing pages y mvp funcional': 'Prototipados',
  'creación de dashboard': 'Otros',
  'creación de dashboards': 'Otros',
  'automatización': 'Otros',
}

/**
 * Normalize a raw `categoria_caso` value from the DB.
 * Applies the NORMALIZE_CATEGORIA_CASO map case-insensitively.
 */
export function normalizeCategoriaCaso(raw: string | null): string {
  if (raw == null || raw.trim() === '') return 'Sin categorizar'
  const key = raw.trim().toLowerCase()
  return NORMALIZE_CATEGORIA_CASO[key] ?? raw.trim()
}

export function normalizeKey(value: string | null | undefined, fallback: string): string {
  if (value == null || value.trim() === '') return fallback
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
}

export function canonicalStatus(status: string) {
  const key = normalizeKey(status, status)
  if (key === 'pendiente') return 'Pendiente'
  if (key === 'agendado') return 'Agendado'
  if (key === 'en seguimiento' || key === 'enseguimiento') return 'En seguimiento'
  if (key === 'resuelto' || key === 'completada' || key === 'completado') return 'Resuelto'
  if (key === 'cancelado' || key === 'cancelada') return 'Cancelado'
  if (key === 'escalar') return 'Escalar'
  if (key === 'no asistio' || key === 'no asistio') return 'No asistió'
  // Handle with diacritics already stripped by normalizeKey: 'no asistio'
  if (status.trim().toLowerCase() === 'no asistió') return 'No asistió'
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

/** Given an ISO year and week number, return the Thursday date of that week (ISO standard). */
function isoWeekThursday(isoYear: number, isoWeek: number): Date {
  const jan4 = new Date(isoYear, 0, 4)
  const jan4Day = (jan4.getDay() + 6) % 7 // Mon=0
  const mondayW1 = new Date(jan4)
  mondayW1.setDate(jan4.getDate() - jan4Day)
  const thursday = new Date(mondayW1)
  thursday.setDate(mondayW1.getDate() + (isoWeek - 1) * 7 + 3)
  return thursday
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

export function computeAgendadoWeeklyBuckets(
  consultorias: ConsultoriaForMetricas[],
): { semana: string; total: number }[] {
  const agendadas = consultorias.filter((c) => canonicalStatus(c.status) === 'Agendado')

  const buckets: Record<string, { label: string; bucketKey: string; total: number }> = {}

  for (const c of agendadas) {
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

/** Count distinct non-null nit values across leads with registro_sesion. */
export function countUniqueNit(
  consultorias: ConsultoriaForMetricas[],
  registroSesion: RegistroSesionForMetricas[],
): number {
  const attendedIds = new Set(registroSesion.map(r => r.id_consultoria))
  const seen = new Set<string>()
  for (const c of consultorias) {
    if (c.id && attendedIds.has(c.id) && c.leads?.nit != null) seen.add(c.leads.nit)
  }
  return seen.size
}

const MONTH_ABBR_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Group consultorias by time period (dia/semana/mes/año), sorted ascending. */
export function groupByPeriod(
  consultorias: ConsultoriaForMetricas[],
  period: Granularidad,
): { key: string; label: string; count: number }[] {
  const buckets: Record<string, { count: number }> = {}

  for (const c of consultorias) {
    if (!c.fecha) continue
    let sortKey: string
    if (period === 'dia') {
      sortKey = c.fecha.slice(0, 10)
    } else if (period === 'semana') {
      const d = new Date(c.fecha + 'T00:00:00')
      if (isNaN(d.getTime())) continue
      const { isoYear, isoWeek } = isoWeekParts(d)
      sortKey = `${isoYear}-W${String(isoWeek).padStart(2, '0')}`
    } else if (period === 'año') {
      sortKey = c.fecha.slice(0, 4)
    } else {
      sortKey = c.fecha.slice(0, 7)
    }
    if (!buckets[sortKey]) {
      buckets[sortKey] = { count: 0 }
    }
    buckets[sortKey].count++
  }

  const sorted = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { count }]) => ({ key, label: key, count }))

  // Assign sequential week-in-month labels for 'semana' using ISO Thursday
  if (period === 'semana') {
    let currentMonth = ''
    let weekInMonth = 0
    for (const entry of sorted) {
      const m = entry.key.match(/^(\d{4})-W(\d{2})$/)
      if (!m) continue
      const thu = isoWeekThursday(Number(m[1]), Number(m[2]))
      const month = MONTH_ABBR_ES[thu.getMonth()]
      weekInMonth = month !== currentMonth ? 1 : weekInMonth + 1
      currentMonth = month
      entry.label = `${month} S${weekInMonth}`
    }
  }

  return sorted
}

/**
 * Average duration per consultor, sorted by avg descending.
 * When registroSesion is provided, prefers registro.duracion_sesion_minutos over
 * consultoria.duracion_minutos for each session (same priority as computeConsultorMetrics).
 * The registroSesion param is OPTIONAL — existing 1-arg call sites remain valid.
 */
export function avgDuracionByConsultor(
  consultorias: ConsultoriaForMetricas[],
  registroSesion?: RegistroSesionForMetricas[],
): { consultor: string; avg: number }[] {
  const registroMap = new Map<string, RegistroSesionForMetricas>(
    registroSesion?.map((r) => [r.id_consultoria, r]) ?? [],
  )
  const map = new Map<string, { sum: number; count: number }>()

  for (const c of consultorias) {
    if (!c.id_consultor) continue
    const registro = c.id != null ? registroMap.get(c.id) : undefined
    const duracion = registro?.duracion_sesion_minutos
    if (duracion == null) continue
    const key = c.consultores?.nombre ?? 'Sin consultor'
    const entry = map.get(key)
    if (!entry) {
      map.set(key, { sum: duracion, count: 1 })
    } else {
      entry.sum += duracion
      entry.count++
    }
  }

  return Array.from(map.entries())
    .map(([consultor, { sum, count }]) => ({ consultor, avg: Math.round(sum / count) }))
    .sort((a, b) => b.avg - a.avg)
}

/**
 * TASK-13: Filter consultorias to only those with a matching registro_sesion row.
 * This is the single join-based attended filter used by all Batch B helpers.
 */
export function getAttendedConsultorias(
  consultorias: ConsultoriaForMetricas[],
  attendedIds: Set<string>,
): ConsultoriaForMetricas[] {
  return consultorias.filter((c) => c.id != null && attendedIds.has(c.id))
}

/**
 * Count consultorias grouped by categoria_caso, sorted by count descending.
 * TASK-13 (Batch B): when attendedIds is provided, replaces the provisional status filter
 * (TASK-03) with the accurate join-based filter.
 * Backward-compatible: when attendedIds is absent, falls back to status-based filter.
 */
export function countByArea(
  consultorias: ConsultoriaForMetricas[],
  attendedIds?: Set<string>,
): { area: string; count: number }[] {
  const map: Record<string, number> = {}

  const source = attendedIds != null
    ? getAttendedConsultorias(consultorias, attendedIds)
    : consultorias.filter((c) => {
        const s = canonicalStatus(c.status)
        return s === 'Resuelto' || s === 'En seguimiento'
      })

  for (const c of source) {
    const key = normalizeCategoriaCaso(c.categoria_caso)
    if (key === 'Sin categorizar') continue
    map[key] = (map[key] ?? 0) + 1
  }

  return Object.entries(map)
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Count consultorias grouped by consultor name, sorted by count descending.
 * TASK-13: when attendedIds is provided, only counts attended sessions (join filter).
 * Backward-compatible: when absent, counts all consultorias with an id_consultor.
 */
export function countByConsultor(
  consultorias: ConsultoriaForMetricas[],
  attendedIds?: Set<string>,
): { consultor: string; count: number }[] {
  const map: Record<string, number> = {}

  const source = attendedIds != null
    ? getAttendedConsultorias(consultorias, attendedIds)
    : consultorias

  for (const c of source) {
    if (!c.id_consultor) continue
    const key = c.consultores?.nombre ?? 'Sin consultor'
    map[key] = (map[key] ?? 0) + 1
  }

  return Object.entries(map)
    .map(([consultor, count]) => ({ consultor, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Cross-tab of consultor × modalidad counts. One object per consultor with modalidad keys.
 * TASK-14: when attendedIds is provided, only counts attended sessions (join filter).
 * Backward-compatible: when absent, counts all consultorias with an id_consultor.
 */
export function modalidadByConsultor(
  consultorias: ConsultoriaForMetricas[],
  attendedIds?: Set<string>,
): { consultor: string; [modalidad: string]: string | number }[] {
  // map: consultor → { modalidad → count }
  const map = new Map<string, Record<string, number>>()

  const source = attendedIds != null
    ? getAttendedConsultorias(consultorias, attendedIds)
    : consultorias

  for (const c of source) {
    if (!c.id_consultor) continue
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

const BUSINESS_HOUR_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '8-10am', min: 8, max: 10 },
  { label: '10am-12pm', min: 10, max: 12 },
  { label: '1-3pm', min: 13, max: 15 },
  { label: '3-5pm', min: 15, max: 17 },
]

/** Group consultorias by franja horaria bucket. Returns all 6 buckets always. */
export function countByFranjaHoraria(
  consultorias: ConsultoriaForMetricas[],
): { franja: string; count: number }[] {
  const counts: Record<string, number> = {
    '8-10am': 0,
    '10am-12pm': 0,
    '1-3pm': 0,
    '3-5pm': 0,
    'Fuera de horario': 0,
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
    const bucket = BUSINESS_HOUR_BUCKETS.find((b) => h >= b.min && h < b.max)
    if (bucket) {
      counts[bucket.label]++
    } else {
      counts['Fuera de horario']++
    }
  }

  // Preserve display order — all 6 buckets always present
  return ['8-10am', '10am-12pm', '1-3pm', '3-5pm', 'Fuera de horario', 'Sin hora'].map(
    (franja) => ({ franja, count: counts[franja] }),
  )
}

/**
 * Average duracion_minutos per session grouped by leads.company_role_level (seniority), sorted descending.
 * TASK-01: renamed from tiempoPorRol; changed aggregator from sum → average.
 */
export function tiempoPromedioPorRol(
  consultorias: ConsultoriaForMetricas[],
  registroSesion?: RegistroSesionForMetricas[],
): { rol: string; minutos: number }[] {
  const map: Record<string, { sum: number; count: number }> = {}
  const registroMap = new Map<string, RegistroSesionForMetricas>()
  for (const r of registroSesion ?? []) registroMap.set(r.id_consultoria, r)

  for (const c of consultorias) {
    const registro = c.id ? registroMap.get(c.id) : undefined
    const duracion = registro?.duracion_sesion_minutos ?? c.duracion_minutos
    if (duracion == null) continue
    const key = c.leads?.company_role_level ?? 'Sin rol'
    if (!map[key]) map[key] = { sum: 0, count: 0 }
    map[key].sum += duracion
    map[key].count++
  }

  return Object.entries(map)
    .map(([rol, { sum, count }]) => ({ rol, minutos: Math.round(sum / count) }))
    .sort((a, b) => b.minutos - a.minutos)
}

// Sessions without an assigned id_consultor are excluded from
// consultant-specific charts (duracion, recuento, modalidad). The total
// session count in `totalConsultorias` is unaffected.

/**
 * Group consultorias by department via city → NOMBRE_DPT lookup.
 * Null city or unmatched city increments sinUbicacion.
 */
export function countByDepartamento(consultorias: ConsultoriaForMetricas[]): {
  porDepartamento: { dept: string; total: number }[]
  sinUbicacion: number
} {
  const map: Record<string, number> = {}
  let sinUbicacion = 0

  for (const c of consultorias) {
    const city = c.leads?.city
    if (!city) {
      continue
    }
    const key = normalizeKey(city, '')
    const dept = CITY_TO_DEPT[key]
    if (!dept) {
      sinUbicacion++
      continue
    }
    map[dept] = (map[dept] ?? 0) + 1
  }

  const porDepartamento = Object.entries(map)
    .map(([dept, total]) => ({ dept, total }))
    .sort((a, b) => b.total - a.total)

  return { porDepartamento, sinUbicacion }
}

/**
 * TASK-15: Only Mon–Fri (Sáb and Dom removed per design decision D12).
 * Attended filter applied when attendedIds is provided.
 * Each cell carries consultoriaIds for drill-down.
 */
const HEATMAP_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const HEATMAP_FRANJAS = ['8-10am', '10am-12pm', '1-3pm', '3-5pm', 'Fuera de horario']

export function computeHeatmapFranjaDia(
  consultorias: ConsultoriaForMetricas[],
  attendedIds?: Set<string>,
): { franja: string; dia: string; count: number; consultoriaIds: string[] }[] {
  // Initialize all cells — count and ids list
  const cells: Record<string, { count: number; ids: string[] }> = {}
  for (const franja of HEATMAP_FRANJAS) {
    for (const dia of HEATMAP_DIAS) {
      cells[`${franja}__${dia}`] = { count: 0, ids: [] }
    }
  }

  const source = attendedIds != null
    ? getAttendedConsultorias(consultorias, attendedIds)
    : consultorias

  for (const c of source) {
    if (!c.fecha) continue
    const d = new Date(c.fecha + 'T00:00:00')
    if (isNaN(d.getTime())) continue
    const dayIndex = (d.getDay() + 6) % 7 // 0=Lun, 6=Dom
    // Only Mon–Fri (indices 0–4); skip Sat=5, Sun=6
    if (dayIndex > 4) continue
    const dia = HEATMAP_DIAS[dayIndex]

    let franja = 'Fuera de horario'
    if (c.hora_inicio != null) {
      const h = parseInt(c.hora_inicio.slice(0, 2), 10)
      if (!isNaN(h)) {
        const bucket = BUSINESS_HOUR_BUCKETS.find((b) => h >= b.min && h < b.max)
        if (bucket) franja = bucket.label
      }
    }

    const key = `${franja}__${dia}`
    if (key in cells) {
      cells[key].count++
      if (c.id != null) cells[key].ids.push(c.id)
    }
  }

  const result: { franja: string; dia: string; count: number; consultoriaIds: string[] }[] = []
  for (const franja of HEATMAP_FRANJAS) {
    for (const dia of HEATMAP_DIAS) {
      const cell = cells[`${franja}__${dia}`]
      result.push({ franja, dia, count: cell.count, consultoriaIds: cell.ids })
    }
  }
  return result
}

export function computeScatterDuracionProductos(
  consultorias: ConsultoriaForMetricas[],
  registroSesion: RegistroSesionForMetricas[],
): { duracion: number; productos: number; consultor: string }[] {
  const registroMap = new Map<string, RegistroSesionForMetricas>()
  for (const r of registroSesion) {
    registroMap.set(r.id_consultoria, r)
  }

  const result: { duracion: number; productos: number; consultor: string }[] = []
  for (const c of consultorias) {
    if (!c.id) continue
    const registro = registroMap.get(c.id)
    if (!registro) continue
    const duracion = registro.duracion_sesion_minutos ?? c.duracion_minutos
    if (duracion == null || duracion <= 0) continue
    result.push({
      duracion,
      productos: registro.cantidad_productos ?? 0,
      consultor: c.consultores?.nombre ?? 'Sin consultor',
    })
  }
  return result
}

export function computeConsultorMetrics(
  consultorias: ConsultoriaForMetricas[],
  registroSesion: RegistroSesionForMetricas[],
  attendedIds?: Set<string>,
): { consultor: string; sesiones: number; duracionAvg: number; productos: number; pctGrabadas: number }[] {
  const registroMap = new Map<string, RegistroSesionForMetricas>()
  for (const r of registroSesion) {
    registroMap.set(r.id_consultoria, r)
  }

  const map = new Map<string, {
    sesiones: number
    duracionSum: number
    duracionCount: number
    productos: number
    grabadas: number
    conRegistro: number
  }>()

  for (const c of consultorias) {
    if (!c.id_consultor) continue
    // When attendedIds is provided, only count consultorias whose id is in the set
    if (attendedIds != null && (c.id == null || !attendedIds.has(c.id))) continue
    const nombre = c.consultores?.nombre ?? 'Sin consultor'
    if (!map.has(nombre)) {
      map.set(nombre, { sesiones: 0, duracionSum: 0, duracionCount: 0, productos: 0, grabadas: 0, conRegistro: 0 })
    }
    const entry = map.get(nombre)!
    entry.sesiones++

    if (c.id) {
      const registro = registroMap.get(c.id)
      if (registro) {
        // Prefer registro.duracion_sesion_minutos; fall back to c.duracion_minutos (nullish, not falsy)
        const duracion = registro.duracion_sesion_minutos ?? c.duracion_minutos
        if (duracion != null && duracion > 0) {
          entry.duracionSum += duracion
          entry.duracionCount++
        }
        entry.conRegistro++
        entry.productos += registro.cantidad_productos ?? 0
        if (registro.sesion_grabada === true) entry.grabadas++
      } else if (c.duracion_minutos != null && c.duracion_minutos > 0) {
        // No registro row: fall back to consultoria duration for duration average only
        entry.duracionSum += c.duracion_minutos
        entry.duracionCount++
      }
    } else if (c.duracion_minutos != null && c.duracion_minutos > 0) {
      entry.duracionSum += c.duracion_minutos
      entry.duracionCount++
    }
  }

  return Array.from(map.entries())
    .map(([consultor, e]) => ({
      consultor,
      sesiones: e.sesiones,
      duracionAvg: e.duracionCount > 0 ? Math.round(e.duracionSum / e.duracionCount) : 0,
      productos: e.productos,
      pctGrabadas: e.conRegistro > 0 ? Math.round((e.grabadas / e.conRegistro) * 100) : 0,
    }))
    .sort((a, b) => b.sesiones - a.sesiones)
}

export function computeRetentionDistribution(
  consultorias: ConsultoriaForMetricas[],
): { visitas: number; leads: number }[] {
  const visitasByLead = new Map<string, number>()
  for (const c of consultorias) {
    visitasByLead.set(c.id_lead, (visitasByLead.get(c.id_lead) ?? 0) + 1)
  }

  const buckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const count of visitasByLead.values()) {
    const bucket = count >= 4 ? 4 : count
    buckets[bucket]++
  }

  return [
    { visitas: 1, leads: buckets[1] },
    { visitas: 2, leads: buckets[2] },
    { visitas: 3, leads: buckets[3] },
    { visitas: 4, leads: buckets[4] },
  ]
}

/**
 * Ordinary least squares linear regression.
 * Returns slope, intercept, and a 2-point line array spanning [min(x), max(x)]
 * suitable for overlaying as a <Line> in a Recharts ScatterChart.
 * Returns { slope: 0, intercept: NaN, line: [] } when:
 *   - fewer than 2 points are provided
 *   - all x values are identical (degenerate/zero variance)
 */
export function computeLinearRegression(
  points: { x: number; y: number }[],
): { slope: number; intercept: number; line: { x: number; y: number }[] } {
  const DEGENERATE = { slope: 0, intercept: NaN, line: [] as { x: number; y: number }[] }
  if (points.length < 2) return DEGENERATE

  const n = points.length
  let sumX = 0
  let sumY = 0
  let sumXX = 0
  let sumXY = 0

  for (const { x, y } of points) {
    sumX += x
    sumY += y
    sumXX += x * x
    sumXY += x * y
  }

  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return DEGENERATE // all x values identical

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  const xs = points.map((p) => p.x)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)

  return {
    slope,
    intercept,
    line: [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept },
    ],
  }
}

/**
 * Count consultorias grouped by normalized categoria_caso, sorted descending by count.
 * TASK-04: replaces the old countByCasoUso / categoria_caso_uso source.
 * Applies NORMALIZE_CATEGORIA_CASO map to collapse typos and variant spellings.
 */
export function countByCategoriaCaso(
  consultorias: ConsultoriaForMetricas[],
): { caso: string; total: number }[] {
  const map: Record<string, number> = {}

  for (const c of consultorias) {
    const label = normalizeCategoriaCaso(c.categoria_caso)
    if (label === 'Sin categorizar') continue
    map[label] = (map[label] ?? 0) + 1
  }

  return Object.entries(map)
    .map(([caso, total]) => ({ caso, total }))
    .sort((a, b) => b.total - a.total)
}

export function computeMetricasFromConsultorias({
  consultorias,
  registroSesion,
  period = 'mes',
  totalLeads,
  attendedIds,
}: {
  consultorias: ConsultoriaForMetricas[]
  registroSesion: RegistroSesionForMetricas[]
  period?: Granularidad
  totalLeads?: number
  /** TASK-12: Set of id_consultoria values from registro_sesion. Used for join-based attended filter. */
  attendedIds?: Set<string>
}): MetricasGlobales {
  // Count of rows in registro_sesion (effective sessions held)
  const totalConsultorias = registroSesion.length
  const consultoriasResueltas = consultorias.filter(
    (c) => canonicalStatus(c.status) === 'Resuelto',
  ).length

  // Item 6: latest consultoria per lead → count leads in 'En seguimiento'
  const latestByLead = latestConsultoriaByLead(consultorias)
  const casosEnSeguimientoLeads = [...latestByLead.values()].filter(
    (c) => canonicalStatus(c.status) === 'En seguimiento',
  ).length

  const totalProductos = registroSesion.reduce((sum, r) => sum + (r.cantidad_productos ?? 0), 0)
  /** Sum of registro_sesion.duracion_sesion_minutos in minutes. Zero until WF-3 loads duration data. */
  const totalMinutos = registroSesion.reduce((sum, r) => sum + (r.duracion_sesion_minutos ?? 0), 0)

  const estadoMap: Record<string, number> = {}
  const servicioMap: Record<string, number> = {}
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

    const potenciaKey = normalizeKey(con.nivel_potencia, 'Sin nivel')
    potenciaMap[potenciaKey] = (potenciaMap[potenciaKey] || 0) + 1

    if (con.leads?.city) {
      // dedup key stays normalized lowercase
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

  // porEstadoAtendidas: attended (id in attendedIds) AND status !== 'Agendado'
  const porEstadoAtendidas: { status: string; total: number }[] = (() => {
    if (attendedIds == null) {
      // Fallback when no join data: mirror porEstado but drop Agendado
      return porEstado.filter((e) => e.status !== 'Agendado')
    }
    const attMap: Record<string, number> = {}
    for (const c of consultorias) {
      if (c.id == null || !attendedIds.has(c.id)) continue
      const s = canonicalStatus(c.status)
      if (s === 'Agendado') continue
      attMap[s] = (attMap[s] ?? 0) + 1
    }
    return Object.entries(attMap).map(([status, total]) => ({ status, total }))
  })()

  // consultoriasEnSeguimientoAtendidas: derived from porEstadoAtendidas
  const consultoriasEnSeguimientoAtendidas =
    porEstadoAtendidas.find((e) => e.status === 'En seguimiento')?.total ?? 0

  const totalAll = consultorias.length
  // Sesiones efectivas / reservas únicas (booking_id distintos)
  const distinctBookings = new Set(
    consultorias.map((c) => c.booking_id).filter((b): b is string => b != null),
  ).size
  const tasaConversion = distinctBookings > 0
    ? Math.round((registroSesion.length / distinctBookings) * 10000) / 100
    : 0

  // TASK-04: porCasoUso now sources from categoria_caso with normalization
  const porCasoUso = countByCategoriaCaso(consultorias)

  // Item 2: apply titleCaseCity on the display label; dedup key was normalized lowercase
  const allCities = Object.entries(ciudadMap)
    .map(([city, total]) => ({ city: titleCaseCity(city), total }))
    .sort((a, b) => b.total - a.total)

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

  const porSemana = computeWeeklyBuckets(consultorias)

  // Item 4: top consultores + stacked origen×status breakdown
  const topConsultores = computeTopConsultores(consultorias)
  const origenStatusBreakdown = computeOrigenStatusBreakdown(consultorias)

  // Phase D: new KPI compute functions
  const nitUnicos = countUniqueNit(consultorias, registroSesion)
  const porPeriodo = groupByPeriod(consultorias, period)
  const duracionPorConsultor = avgDuracionByConsultor(consultorias, registroSesion)
  // TASK-12/13: pass attendedIds for join-based attended filter when available
  const consultasPorArea = countByArea(consultorias, attendedIds)
  const recuentoPorConsultor = countByConsultor(consultorias, attendedIds)
  const modalidadPorConsultor = modalidadByConsultor(consultorias, attendedIds)
  const consultasPorFranja = countByFranjaHoraria(consultorias)
  // TASK-01: renamed to tiempoPromedioPorRol; now computes average instead of sum
  const tiempoPromedioPorRolResult = tiempoPromedioPorRol(consultorias, registroSesion)
  const { porDepartamento, sinUbicacion } = countByDepartamento(consultorias)

  // New metrics
  const leadsConConsultoriaSet = new Set(consultorias.map(c => c.id_lead))
  const leadsConConsultoria = leadsConConsultoriaSet.size
  const leadsSinConsultoria = totalLeads != null ? Math.max(0, totalLeads - leadsConConsultoria) : 0

  // tasaLeadConversion: % leads únicos con ≥1 sesión Resuelto|En seguimiento vs total leads únicos del dataset
  const leadsConversionSet = new Set(
    consultorias
      .filter(c => ['Resuelto', 'En seguimiento'].includes(canonicalStatus(c.status)))
      .map(c => c.id_lead)
  )
  const tasaLeadConversion = leadsConConsultoria > 0
    ? Math.round((leadsConversionSet.size / leadsConConsultoria) * 100)
    : 0

  // tasaSesionesGrabadas: % sesion_grabada=true en registro_sesion
  const grabadas = registroSesion.filter(r => r.sesion_grabada === true).length
  const tasaSesionesGrabadas = registroSesion.length > 0
    ? Math.round((grabadas / registroSesion.length) * 100)
    : 0

  // tasaDocumentacion: % resultado_final IS NOT NULL en registro_sesion
  const conResultado = registroSesion.filter(r => r.resultado_final != null && r.resultado_final !== '').length
  const tasaDocumentacion = registroSesion.length > 0
    ? Math.round((conResultado / registroSesion.length) * 100)
    : 0

  // distribucionRetorno
  const distribucionRetorno = computeRetentionDistribution(consultorias)

  // tasaRetorno: (total agendadas / total atendidas) × 100
  const totalAtendidasRetorno = consultorias.filter(c =>
    ['Resuelto', 'En seguimiento', 'Escalar'].includes(c.status ?? '')
  ).length
  const tasaRetorno = totalAtendidasRetorno > 0
    ? Math.round((consultorias.length / totalAtendidasRetorno) * 100)
    : 0

  // consultoriasSinRegistro: Resuelto sin registro_sesion vinculado
  const registroIds = new Set(registroSesion.map(r => r.id_consultoria))
  const consultoriasSinRegistro = consultorias.filter(c => {
    if (canonicalStatus(c.status) !== 'Resuelto') return false
    if (!c.id) return false
    return !registroIds.has(c.id)
  }).length

  // porAgendadoSemana
  const porAgendadoSemana = computeAgendadoWeeklyBuckets(consultorias)

  // scatterDuracionProductos
  const scatterDuracionProductos = computeScatterDuracionProductos(consultorias, registroSesion)

  // TASK-02: OLS regression over scatter data (stored in MetricasGlobales for purely presentational components)
  const scatterRegression = computeLinearRegression(
    scatterDuracionProductos.map((p) => ({ x: p.duracion, y: p.productos })),
  )

  // heatmapFranjaDia — TASK-15: attended filter + Mon-Fri only + consultoriaIds
  const heatmapFranjaDia = computeHeatmapFranjaDia(consultorias, attendedIds)

  // consultorMetrics
  const consultorMetrics = computeConsultorMetrics(consultorias, registroSesion, attendedIds)

  // Suppress unused variable warning for sectorMap and servicioMap
  void Object.keys(sectorMap)
  void Object.keys(servicioMap)
  void allCities

  return {
    totalConsultorias,
    consultoriasResueltas,
    casosEnSeguimientoLeads,
    porEstado,
    porEstadoAtendidas,
    tasaConversion,
    porCasoUso,
    porCargo,
    porSemana,
    porPotencia,
    porOrigen,
    totalProductos,
    totalMinutos,
    topConsultores,
    origenStatusBreakdown,
    nitUnicos,
    porPeriodo,
    duracionPorConsultor,
    consultasPorArea,
    recuentoPorConsultor,
    modalidadPorConsultor,
    consultasPorFranja,
    tiempoPromedioPorRol: tiempoPromedioPorRolResult,
    scatterRegression,
    porDepartamento,
    sinUbicacion,
    tasaLeadConversion,
    leadsSinConsultoria,
    leadsConConsultoria,
    tasaSesionesGrabadas,
    tasaRetorno,
    tasaDocumentacion,
    distribucionRetorno,
    consultoriasSinRegistro,
    porAgendadoSemana,
    scatterDuracionProductos,
    heatmapFranjaDia,
    consultorMetrics,
    consultoriasEnSeguimientoAtendidas,
  }
}
