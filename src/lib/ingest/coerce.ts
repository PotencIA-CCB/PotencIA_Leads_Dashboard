/**
 * Coerciones de tipos para la ingesta de archivos.
 *
 * Reglas de este módulo (spec `normalizacion-filas` R1, R9, R10):
 *   - sin DOM, sin red
 *   - ningún cálculo depende de la zona horaria del proceso: los componentes de
 *     fecha se leen en UTC y las horas se manipulan como minutos enteros
 */

/** Excel cuenta los días desde este instante (con el bug del año 1900 incluido). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const probe = new Date(Date.UTC(year, month - 1, day))
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
}

function utcYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/**
 * Acepta ISO (`YYYY-MM-DD` o timestamp), serial de Excel, `DD/MM/YYYY` y
 * objetos Date. Devuelve `YYYY-MM-DD` o null.
 *
 * No usa `new Date(string)` como último recurso: para cadenas ambiguas el
 * resultado dependería de la zona horaria del proceso.
 */
export function toDate(v: unknown): string | null {
  if (v === null || v === undefined) return null

  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : utcYmd(v)
  }

  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return null
    return utcYmd(new Date(EXCEL_EPOCH_MS + Math.floor(v) * 86400000))
  }

  const s = String(v).trim()
  if (s === '') return null

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const [, y, m, d] = iso
    return isValidYmd(Number(y), Number(m), Number(d)) ? `${y}-${m}-${d}` : null
  }

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (!Number.isFinite(n) || n <= 0) return null
    return utcYmd(new Date(EXCEL_EPOCH_MS + Math.floor(n) * 86400000))
  }

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3])
    if (!isValidYmd(year, month, day)) return null
    return `${year}-${pad2(month)}-${pad2(day)}`
  }

  return null
}

/** Acepta `HH:MM[:SS]` y fracción de día de Excel. Devuelve `HH:MM` o null. */
export function toTime(v: unknown): string | null {
  if (v === null || v === undefined) return null

  // read-excel-file entrega las celdas de hora como Date. Se lee en UTC por la
  // misma razón que toDate usa utcYmd: la librería construye la fecha a
  // medianoche UTC y leerla en horario local corre el valor un día.
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return `${pad2(v.getUTCHours())}:${pad2(v.getUTCMinutes())}`
  }

  if (typeof v === 'number') {
    if (!(v >= 0 && v < 1)) return null
    const total = Math.round(v * 1440)
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
  }

  const s = String(v).trim()
  if (s === '') return null

  const hm = s.match(/^(\d{1,2}):(\d{2})/)
  if (hm) {
    const h = Number(hm[1])
    const m = Number(hm[2])
    if (h > 23 || m > 59) return null
    return `${pad2(h)}:${pad2(m)}`
  }

  if (/^\d?\.\d+$/.test(s)) {
    const f = Number(s)
    if (!(f >= 0 && f < 1)) return null
    const total = Math.round(f * 1440)
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
  }

  return null
}

export function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null
  const s = String(v).trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

const AFIRMATIVOS = new Set(['si', 'sí', 'yes', 'true', '1'])

export function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (v === null || v === undefined) return false
  return AFIRMATIVOS.has(String(v).trim().toLowerCase())
}

/**
 * Suma minutos a `HH:MM` con aritmética entera, envolviendo a las 24 horas.
 * Reemplaza el cálculo de hora_fin de WF-2, que dependía de la zona horaria.
 */
export function addMinutes(hhmm: string | null, minutes: number | null): string | null {
  if (hhmm === null || minutes === null) return null
  if (!Number.isFinite(minutes)) return null

  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null

  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null

  const raw = (h * 60 + mi + Math.trunc(minutes)) % 1440
  const total = raw < 0 ? raw + 1440 : raw
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
}
