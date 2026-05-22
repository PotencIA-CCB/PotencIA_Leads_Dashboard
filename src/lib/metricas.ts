import { CITY_TO_DEPT } from './geo/cityToDept'

export interface RegistroSesionForMetricas {
  id_consultoria: string
  cantidad_productos: number | null
  sesion_grabada?: boolean | null
  resultado_final?: string | null
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
  porCasoUso: { caso: string; total: number }[]
  porCargo: { cargo: string; total: number }[]
  porSemana: { semana: string; total: number }[]
  // Track B additions
  porPotencia: { nivel: string; total: number }[]
  porOrigen: { origen: string; total: number }[]
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
  /** % status Escalar / total */
  tasaEscalamiento: number
  /** % sesion_grabada=true en registro_sesion */
  tasaSesionesGrabadas: number
  /** % leads con 2+ consultorias vs leads con ≥1 */
  tasaRetorno: number
  /** % resultado_final IS NOT NULL en registro_sesion */
  tasaDocumentacion: number
  /** histogram: cuántos leads tuvieron N visitas */
  distribucionRetorno: { visitas: number; leads: number }[]
  /** Resuelto sin registro_sesion vinculado */
  consultoriasSinRegistro: number
  /** buckets ISO semanales para status Agendado */
  porAgendadoSemana: { semana: string; total: number }[]
  scatterDuracionProductos: { duracion: number; productos: number; consultor: string }[]
  heatmapFranjaDia: { franja: string; dia: string; count: number }[]
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
    if (!c.id_consultor) continue
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
    if (!c.id_consultor) continue
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

const HEATMAP_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HEATMAP_FRANJAS = ['8-10am', '10am-12pm', '1-3pm', '3-5pm', 'Fuera de horario']

export function computeHeatmapFranjaDia(
  consultorias: ConsultoriaForMetricas[],
): { franja: string; dia: string; count: number }[] {
  // Initialize all cells to 0
  const counts: Record<string, number> = {}
  for (const franja of HEATMAP_FRANJAS) {
    for (const dia of HEATMAP_DIAS) {
      counts[`${franja}__${dia}`] = 0
    }
  }

  for (const c of consultorias) {
    if (!c.fecha) continue
    const d = new Date(c.fecha + 'T00:00:00')
    if (isNaN(d.getTime())) continue
    const dayIndex = (d.getDay() + 6) % 7 // 0=Lun, 6=Dom
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
    if (key in counts) {
      counts[key]++
    }
  }

  const result: { franja: string; dia: string; count: number }[] = []
  for (const franja of HEATMAP_FRANJAS) {
    for (const dia of HEATMAP_DIAS) {
      result.push({ franja, dia, count: counts[`${franja}__${dia}`] })
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
    if (c.duracion_minutos == null || c.duracion_minutos <= 0) continue
    result.push({
      duracion: c.duracion_minutos,
      productos: registro.cantidad_productos ?? 0,
      consultor: c.consultores?.nombre ?? 'Sin consultor',
    })
  }
  return result
}

export function computeConsultorMetrics(
  consultorias: ConsultoriaForMetricas[],
  registroSesion: RegistroSesionForMetricas[],
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
    const nombre = c.consultores?.nombre ?? 'Sin consultor'
    if (!map.has(nombre)) {
      map.set(nombre, { sesiones: 0, duracionSum: 0, duracionCount: 0, productos: 0, grabadas: 0, conRegistro: 0 })
    }
    const entry = map.get(nombre)!
    entry.sesiones++
    if (c.duracion_minutos != null) {
      entry.duracionSum += c.duracion_minutos
      entry.duracionCount++
    }

    if (c.id) {
      const registro = registroMap.get(c.id)
      if (registro) {
        entry.conRegistro++
        entry.productos += registro.cantidad_productos ?? 0
        if (registro.sesion_grabada === true) entry.grabadas++
      }
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

export function computeMetricasFromConsultorias({
  consultorias,
  registroSesion,
  period = 'mes',
  totalLeads,
}: {
  consultorias: ConsultoriaForMetricas[]
  registroSesion: RegistroSesionForMetricas[]
  period?: Granularidad
  totalLeads?: number
}): MetricasGlobales {
  // Counts only attended sessions (status Resuelto | En seguimiento)
  const totalConsultorias = consultorias.filter((c) => {
    const s = canonicalStatus(c.status)
    return s === 'Resuelto' || s === 'En seguimiento'
  }).length
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

  // Eficiencia: productos / leads atendidos
  const leadsAtendidosSet = new Set(
    consultorias
      .filter(c => ['Resuelto', 'En seguimiento'].includes(canonicalStatus(c.status)))
      .map(c => c.id_lead)
  )
  const eficiencia = leadsAtendidosSet.size === 0
    ? '—'
    : (totalProductos / leadsAtendidosSet.size).toFixed(2)

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

  const porCasoUso = Object.entries(casoUsoMap)
    .filter(([caso]) => caso !== 'Sin categorizar')
    .map(([caso, total]) => ({ caso, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N)

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
  const nitUnicos = countUniqueNit(consultorias)
  const porPeriodo = groupByPeriod(consultorias, period)
  const duracionPorConsultor = avgDuracionByConsultor(consultorias)
  const consultasPorArea = countByArea(consultorias)
  const recuentoPorConsultor = countByConsultor(consultorias)
  const modalidadPorConsultor = modalidadByConsultor(consultorias)
  const consultasPorFranja = countByFranjaHoraria(consultorias)
  const tiempoPorRolResult = tiempoPorRol(consultorias)
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

  // tasaEscalamiento: % status Escalar / total
  const escalamientos = estadoMap['Escalar'] ?? 0
  const tasaEscalamiento = totalAll > 0 ? Math.round((escalamientos / totalAll) * 100) : 0

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

  // tasaRetorno: % leads con 2+ consultorias vs leads con ≥1
  const visitasByLead = new Map<string, number>()
  for (const c of consultorias) {
    visitasByLead.set(c.id_lead, (visitasByLead.get(c.id_lead) ?? 0) + 1)
  }
  const leadsConRetorno = [...visitasByLead.values()].filter(v => v >= 2).length
  const tasaRetorno = leadsConConsultoria > 0
    ? Math.round((leadsConRetorno / leadsConConsultoria) * 100)
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

  // heatmapFranjaDia
  const heatmapFranjaDia = computeHeatmapFranjaDia(consultorias)

  // consultorMetrics
  const consultorMetrics = computeConsultorMetrics(consultorias, registroSesion)

  // Suppress unused variable warning for sectorMap and servicioMap
  void Object.keys(sectorMap)
  void Object.keys(servicioMap)
  void allCities

  return {
    totalConsultorias,
    consultoriasResueltas,
    casosEnSeguimientoLeads,
    porEstado,
    tasaConversion,
    porCasoUso,
    porCargo,
    porSemana,
    porPotencia,
    porOrigen,
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
    porDepartamento,
    sinUbicacion,
    tasaLeadConversion,
    leadsSinConsultoria,
    leadsConConsultoria,
    tasaEscalamiento,
    tasaSesionesGrabadas,
    tasaRetorno,
    tasaDocumentacion,
    distribucionRetorno,
    consultoriasSinRegistro,
    porAgendadoSemana,
    scatterDuracionProductos,
    heatmapFranjaDia,
    consultorMetrics,
  }
}
