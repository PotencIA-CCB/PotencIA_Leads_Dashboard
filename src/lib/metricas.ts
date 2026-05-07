import type { Lead } from '@/types'

export interface MetricasGlobales {
  totalLeads: number
  porEstado: { status: string; total: number }[]
  tasaConversion: number
  porSolucion: { solution: string; total: number }[]
  porCasoUso: { caso: string; total: number }[]
  porCiudad: { city: string; total: number }[]
  porCargo: { cargo: string; total: number }[]
  porSemana: { semana: string; total: number }[]
}

export type LeadForMetricas = Pick<
  Lead,
  'created_at' | 'status' | 'solution' | 'use_case' | 'city' | 'company_role_level'
>

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
}

function isBetterLabel(next: string, prev: string) {
  const nextTrim = next.trim()
  const prevTrim = prev.trim()

  const nextHasDiacritics = nextTrim.normalize('NFD') !== nextTrim
  const prevHasDiacritics = prevTrim.normalize('NFD') !== prevTrim
  if (nextHasDiacritics && !prevHasDiacritics) return true

  const nextHasUpper = /[A-ZÁÉÍÓÚÑ]/.test(nextTrim)
  const prevHasUpper = /[A-ZÁÉÍÓÚÑ]/.test(prevTrim)
  if (nextHasUpper && !prevHasUpper) return true

  return nextTrim.length > prevTrim.length
}

function canonicalStatus(status: string) {
  const key = normalizeKey(status)
  if (key === 'pendiente') return 'Pendiente'
  if (key === 'agendado') return 'Agendado'
  if (key === 'en seguimiento' || key === 'enseguimiento') return 'En seguimiento'
  if (key === 'resuelto' || key === 'completada' || key === 'completado') return 'Resuelto'
  if (key === 'cancelado' || key === 'cancelada') return 'Cancelado'
  return status.trim()
}

export function computeMetricasFromLeads(leads: LeadForMetricas[]): MetricasGlobales {
  const totalLeads = leads.length

  const estadoMap: Record<string, number> = {}
  const solucionMap: Record<string, { label: string; total: number }> = {}
  const casoUsoMap: Record<string, { label: string; total: number }> = {}
  const ciudadMap: Record<string, { label: string; total: number }> = {}
  const cargoMap: Record<string, { label: string; total: number }> = {}
  const semanaMap: Record<string, number> = {}

  for (const lead of leads) {
    const status = canonicalStatus(lead.status)
    estadoMap[status] = (estadoMap[status] || 0) + 1

    if (lead.solution) {
      const key = normalizeKey(lead.solution)
      const bucket = solucionMap[key] ?? { label: lead.solution.trim(), total: 0 }
      if (isBetterLabel(lead.solution, bucket.label)) bucket.label = lead.solution.trim()
      bucket.total += 1
      solucionMap[key] = bucket
    }
    if (lead.use_case) {
      const key = normalizeKey(lead.use_case)
      const bucket = casoUsoMap[key] ?? { label: lead.use_case.trim(), total: 0 }
      if (isBetterLabel(lead.use_case, bucket.label)) bucket.label = lead.use_case.trim()
      bucket.total += 1
      casoUsoMap[key] = bucket
    }
    if (lead.city) {
      const key = normalizeKey(lead.city)
      const bucket = ciudadMap[key] ?? { label: lead.city.trim(), total: 0 }
      if (isBetterLabel(lead.city, bucket.label)) bucket.label = lead.city.trim()
      bucket.total += 1
      ciudadMap[key] = bucket
    }
    if (lead.company_role_level) {
      const key = normalizeKey(lead.company_role_level)
      const bucket = cargoMap[key] ?? { label: lead.company_role_level.trim(), total: 0 }
      if (isBetterLabel(lead.company_role_level, bucket.label)) bucket.label = lead.company_role_level.trim()
      bucket.total += 1
      cargoMap[key] = bucket
    }

    const date = new Date(lead.created_at)
    const semana = `${date.getFullYear()}-S${Math.ceil(date.getDate() / 7)}-${date.toLocaleString('es-CO', { month: 'short' })}`
    semanaMap[semana] = (semanaMap[semana] || 0) + 1
  }

  const porEstado = Object.entries(estadoMap).map(([status, total]) => ({ status, total }))

  const resueltos = estadoMap['Resuelto'] || 0
  const tasaConversion = totalLeads > 0 ? Math.round((resueltos / totalLeads) * 100) : 0

  const porSolucion = Object.values(solucionMap)
    .map(({ label, total }) => ({ solution: label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const porCasoUso = Object.values(casoUsoMap)
    .map(({ label, total }) => ({ caso: label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const porCiudad = Object.values(ciudadMap)
    .map(({ label, total }) => ({ city: label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const porCargo = Object.values(cargoMap)
    .map(({ label, total }) => ({ cargo: label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const porSemana = Object.entries(semanaMap).map(([semana, total]) => ({ semana, total }))

  return { totalLeads, porEstado, tasaConversion, porSolucion, porCasoUso, porCiudad, porCargo, porSemana }
}
