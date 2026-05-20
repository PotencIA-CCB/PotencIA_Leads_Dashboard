export interface MetricasGlobales {
  totalConsultorias: number
  porEstado: { status: string; total: number }[]
  tasaConversion: number
  porServicio: { servicio: string; total: number }[]
  porCiudad: { city: string; total: number }[]
  porCargo: { cargo: string; total: number }[]
  porSemana: { semana: string; total: number }[]
}

export interface ConsultoriaForMetricas {
  fecha: string
  status: string
  servicio: string | null
  duracion_minutos: number | null
  id_consultor: string | null
  id_lead: string
  leads: {
    city: string | null
    company_role_level: string | null
  } | null
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
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

export function computeMetricasFromConsultorias(consultorias: ConsultoriaForMetricas[]): MetricasGlobales {
  const totalConsultorias = consultorias.length

  const estadoMap: Record<string, number> = {}
  const servicioMap: Record<string, number> = {}
  const ciudadMap: Record<string, number> = {}
  const cargoMap: Record<string, number> = {}
  const semanaMap: Record<string, number> = {}

  for (const con of consultorias) {
    const status = canonicalStatus(con.status)
    estadoMap[status] = (estadoMap[status] || 0) + 1

    if (con.servicio) {
      const key = normalizeKey(con.servicio)
      servicioMap[key] = (servicioMap[key] || 0) + 1
    }

    if (con.leads?.city) {
      const key = normalizeKey(con.leads.city)
      ciudadMap[key] = (ciudadMap[key] || 0) + 1
    }

    if (con.leads?.company_role_level) {
      const key = normalizeKey(con.leads.company_role_level)
      cargoMap[key] = (cargoMap[key] || 0) + 1
    }

    const date = new Date(con.fecha + 'T00:00:00')
    const semana = `${date.getFullYear()}-S${Math.ceil(date.getDate() / 7)}-${date.toLocaleString('es-CO', { month: 'short' })}`
    semanaMap[semana] = (semanaMap[semana] || 0) + 1
  }

  const porEstado = Object.entries(estadoMap).map(([status, total]) => ({ status, total }))

  const resueltos = estadoMap['Resuelto'] || 0
  const tasaConversion = totalConsultorias > 0 ? Math.round((resueltos / totalConsultorias) * 100) : 0

  const porServicio = Object.entries(servicioMap)
    .map(([servicio, total]) => ({ servicio, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const porCiudad = Object.entries(ciudadMap)
    .map(([city, total]) => ({ city, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const porCargo = Object.entries(cargoMap)
    .map(([cargo, total]) => ({ cargo, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const porSemana = Object.entries(semanaMap).map(([semana, total]) => ({ semana, total }))

  return { totalConsultorias, porEstado, tasaConversion, porServicio, porCiudad, porCargo, porSemana }
}
