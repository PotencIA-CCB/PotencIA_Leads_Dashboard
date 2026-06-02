import { describe, it, expect } from 'vitest'
import {
  countUniqueNit,
  groupByPeriod,
  avgDuracionByConsultor,
  countByArea,
  countByConsultor,
  modalidadByConsultor,
  countByFranjaHoraria,
  countByDepartamento,
  computeMetricasFromConsultorias,
  tiempoPromedioPorRol,
  computeConsultorMetrics,
  computeWeeklyBuckets,
  monthWeekLabel,
  type ConsultoriaForMetricas,
  type RegistroSesionForMetricas,
} from '../metricas'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConsultoria(
  overrides: Partial<ConsultoriaForMetricas> = {},
): ConsultoriaForMetricas {
  return {
    fecha: '2024-01-15',
    status: 'Resuelto',
    servicio: null,
    categoria_caso_uso: null,
    categoria_caso: null,
    nivel_potencia: null,
    duracion_minutos: null,
    id_consultor: null,
    id_lead: 'lead-1',
    hora_inicio: null,
    modalidad: null,
    booking_id: null,
    leads: {
      nombre: null,
      apellidos: null,
      city: null,
      company_role_level: null,
      origen: null,
      sector: null,
      company_role_area: null,
      nit: null,
    },
    consultores: null,
    ...overrides,
  }
}

// ─── countUniqueNit ───────────────────────────────────────────────────────────

describe('countUniqueNit', () => {
  it('returns 0 for empty array', () => {
    expect(countUniqueNit([])).toBe(0)
  })

  it('returns 0 when all nit values are null', () => {
    const data = [makeConsultoria(), makeConsultoria()]
    expect(countUniqueNit(data)).toBe(0)
  })

  it('counts unique non-null nit values', () => {
    const data = [
      makeConsultoria({ leads: { city: null, company_role_level: null, origen: null, sector: null, company_role_area: null, nit: '123' } }),
      makeConsultoria({ leads: { city: null, company_role_level: null, origen: null, sector: null, company_role_area: null, nit: '456' } }),
      makeConsultoria({ leads: { city: null, company_role_level: null, origen: null, sector: null, company_role_area: null, nit: '123' } }),
      makeConsultoria({ leads: null }),
    ]
    expect(countUniqueNit(data)).toBe(2)
  })

  it('handles null leads object', () => {
    const data = [makeConsultoria({ leads: null })]
    expect(countUniqueNit(data)).toBe(0)
  })
})

// ─── groupByPeriod ────────────────────────────────────────────────────────────

describe('groupByPeriod', () => {
  it('returns empty array for empty input', () => {
    expect(groupByPeriod([], 'dia')).toEqual([])
    expect(groupByPeriod([], 'semana')).toEqual([])
    expect(groupByPeriod([], 'mes')).toEqual([])
  })

  it('groups by dia (YYYY-MM-DD) sorted ascending', () => {
    const data = [
      makeConsultoria({ fecha: '2024-01-20' }),
      makeConsultoria({ fecha: '2024-01-15' }),
      makeConsultoria({ fecha: '2024-01-15' }),
    ]
    const result = groupByPeriod(data, 'dia')
    expect(result).toEqual([
      { label: '2024-01-15', count: 2 },
      { label: '2024-01-20', count: 1 },
    ])
  })

  it('groups by semana using Mon-SN display labels, sorted ascending by ISO key', () => {
    const data = [
      makeConsultoria({ fecha: '2024-01-15' }), // W03 → Ene S3 (day 15: floor(14/7)+1=3)
      makeConsultoria({ fecha: '2024-01-08' }), // W02 → Ene S2 (day 8: floor(7/7)+1=2)
      makeConsultoria({ fecha: '2024-01-09' }), // W02 → Ene S2
    ]
    const result = groupByPeriod(data, 'semana')
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('Ene S2')
    expect(result[0].count).toBe(2)
    expect(result[1].label).toBe('Ene S3')
    expect(result[1].count).toBe(1)
  })

  it('groups by mes (YYYY-MM) sorted ascending', () => {
    const data = [
      makeConsultoria({ fecha: '2024-03-10' }),
      makeConsultoria({ fecha: '2024-01-15' }),
      makeConsultoria({ fecha: '2024-01-20' }),
    ]
    const result = groupByPeriod(data, 'mes')
    expect(result).toEqual([
      { label: '2024-01', count: 2 },
      { label: '2024-03', count: 1 },
    ])
  })

  it('skips entries with no fecha', () => {
    const data = [
      makeConsultoria({ fecha: '' }),
      makeConsultoria({ fecha: '2024-01-15' }),
    ]
    expect(groupByPeriod(data, 'dia')).toEqual([{ label: '2024-01-15', count: 1 }])
  })
})

// ─── avgDuracionByConsultor ───────────────────────────────────────────────────

describe('avgDuracionByConsultor', () => {
  it('returns empty array for empty input', () => {
    expect(avgDuracionByConsultor([])).toEqual([])
  })

  it('returns empty array when all duracion_minutos are null', () => {
    const data = [
      makeConsultoria({ duracion_minutos: null, consultores: { nombre: 'Ana' }, id_consultor: 'c-1' }),
    ]
    expect(avgDuracionByConsultor(data)).toEqual([])
  })

  it('computes average and sorts descending', () => {
    const data = [
      makeConsultoria({ duracion_minutos: 60, consultores: { nombre: 'Ana' }, id_consultor: 'c-1' }),
      makeConsultoria({ duracion_minutos: 30, consultores: { nombre: 'Ana' }, id_consultor: 'c-1' }),
      makeConsultoria({ duracion_minutos: 90, consultores: { nombre: 'Bob' }, id_consultor: 'c-2' }),
    ]
    const result = avgDuracionByConsultor(data)
    expect(result).toEqual([
      { consultor: 'Bob', avg: 90 },
      { consultor: 'Ana', avg: 45 },
    ])
  })

  it('excludes consultor from result when all their duraciones are null', () => {
    const data = [
      makeConsultoria({ duracion_minutos: 60, consultores: { nombre: 'Ana' }, id_consultor: 'c-1' }),
      makeConsultoria({ duracion_minutos: null, consultores: { nombre: 'Bob' }, id_consultor: 'c-2' }),
    ]
    const result = avgDuracionByConsultor(data)
    expect(result).toHaveLength(1)
    expect(result[0].consultor).toBe('Ana')
  })

  it('excludes row when id_consultor is null (even if consultores is null)', () => {
    // id_consultor=null means the row has no assigned consultant — must be excluded
    const data = [
      makeConsultoria({ duracion_minutos: 45, consultores: null, id_consultor: null }),
    ]
    const result = avgDuracionByConsultor(data)
    expect(result).toEqual([])
  })

  it('includes row when id_consultor is set but consultores join is null (deleted consultant)', () => {
    const data = [
      makeConsultoria({ duracion_minutos: 45, consultores: null, id_consultor: 'c-1' }),
    ]
    const result = avgDuracionByConsultor(data)
    expect(result).toEqual([{ consultor: 'Sin consultor', avg: 45 }])
  })
})

// ─── countByArea ──────────────────────────────────────────────────────────────

describe('countByArea', () => {
  it('returns empty array for empty input', () => {
    expect(countByArea([])).toEqual([])
  })

  it('skips null categoria_caso (no "Sin categorizar" entry)', () => {
    // countByArea now groups by categoria_caso; null is skipped
    const data = [makeConsultoria({ categoria_caso: null })]
    expect(countByArea(data)).toEqual([])
  })

  it('counts and sorts by count descending using categoria_caso', () => {
    const data = [
      makeConsultoria({ categoria_caso: 'Agentes' }),
      makeConsultoria({ categoria_caso: 'Agentes' }),
      makeConsultoria({ categoria_caso: 'Prototipado ágil con ia' }), // maps to Prototipados
    ]
    const result = countByArea(data)
    expect(result[0]).toEqual({ area: 'Agentes', count: 2 })
    expect(result[1]).toEqual({ area: 'Prototipados', count: 1 })
  })
})

// ─── countByConsultor ─────────────────────────────────────────────────────────

describe('countByConsultor', () => {
  it('returns empty array for empty input', () => {
    expect(countByConsultor([])).toEqual([])
  })

  it('excludes rows with null id_consultor', () => {
    // makeConsultoria default has id_consultor: null — should produce empty result
    const data = [makeConsultoria()]
    expect(countByConsultor(data)).toEqual([])
  })

  it('counts and sorts descending', () => {
    const data = [
      makeConsultoria({ consultores: { nombre: 'Ana' }, id_consultor: 'c-1' }),
      makeConsultoria({ consultores: { nombre: 'Ana' }, id_consultor: 'c-1' }),
      makeConsultoria({ consultores: { nombre: 'Bob' }, id_consultor: 'c-2' }),
    ]
    const result = countByConsultor(data)
    expect(result[0]).toEqual({ consultor: 'Ana', count: 2 })
    expect(result[1]).toEqual({ consultor: 'Bob', count: 1 })
  })
})

// ─── modalidadByConsultor ─────────────────────────────────────────────────────

describe('modalidadByConsultor', () => {
  it('returns empty array for empty input', () => {
    expect(modalidadByConsultor([])).toEqual([])
  })

  it('excludes rows with null id_consultor', () => {
    // makeConsultoria default has id_consultor: null
    const data = [makeConsultoria({ consultores: { nombre: 'Ana' }, modalidad: null })]
    expect(modalidadByConsultor(data)).toEqual([])
  })

  it('maps null modalidad to "Sin modalidad" when id_consultor is set', () => {
    const data = [makeConsultoria({ consultores: { nombre: 'Ana' }, modalidad: null, id_consultor: 'c-1' })]
    const result = modalidadByConsultor(data)
    expect(result).toHaveLength(1)
    expect(result[0].consultor).toBe('Ana')
    expect(result[0]['Sin modalidad']).toBe(1)
  })

  it('produces one row per consultor with all modalidad keys', () => {
    const data = [
      makeConsultoria({ consultores: { nombre: 'Ana' }, modalidad: 'Presencial', id_consultor: 'c-1' }),
      makeConsultoria({ consultores: { nombre: 'Ana' }, modalidad: 'Virtual', id_consultor: 'c-1' }),
      makeConsultoria({ consultores: { nombre: 'Ana' }, modalidad: 'Presencial', id_consultor: 'c-1' }),
      makeConsultoria({ consultores: { nombre: 'Bob' }, modalidad: 'Virtual', id_consultor: 'c-2' }),
    ]
    const result = modalidadByConsultor(data)
    const ana = result.find((r) => r.consultor === 'Ana')
    const bob = result.find((r) => r.consultor === 'Bob')
    expect(ana?.['Presencial']).toBe(2)
    expect(ana?.['Virtual']).toBe(1)
    expect(bob?.['Virtual']).toBe(1)
  })
})

// ─── countByFranjaHoraria ─────────────────────────────────────────────────────

describe('countByFranjaHoraria', () => {
  it('returns all 6 buckets including zeros for empty input', () => {
    const result = countByFranjaHoraria([])
    expect(result).toHaveLength(6)
    expect(result.every((b) => b.count === 0)).toBe(true)
  })

  it('returns buckets in correct order', () => {
    const result = countByFranjaHoraria([])
    const labels = result.map((r) => r.franja)
    expect(labels).toEqual(['8-10am', '10am-12pm', '1-3pm', '3-5pm', 'Fuera de horario', 'Sin hora'])
  })

  it('maps null hora_inicio to "Sin hora"', () => {
    const data = [makeConsultoria({ hora_inicio: null })]
    const result = countByFranjaHoraria(data)
    expect(result.find((b) => b.franja === 'Sin hora')?.count).toBe(1)
  })

  it('sends invalid hora_inicio format to "Sin hora"', () => {
    const data = [makeConsultoria({ hora_inicio: 'invalid' })]
    const result = countByFranjaHoraria(data)
    expect(result.find((b) => b.franja === 'Sin hora')?.count).toBe(1)
  })

  it('routes each business-hour bucket correctly', () => {
    const data = [
      makeConsultoria({ hora_inicio: '08:00:00' }), // 8-10am (boundary: min=8)
      makeConsultoria({ hora_inicio: '09:30:00' }), // 8-10am
      makeConsultoria({ hora_inicio: '10:00:00' }), // 10am-12pm (boundary: min=10)
      makeConsultoria({ hora_inicio: '11:59:00' }), // 10am-12pm
      makeConsultoria({ hora_inicio: '13:00:00' }), // 1-3pm (boundary: min=13)
      makeConsultoria({ hora_inicio: '14:00:00' }), // 1-3pm
      makeConsultoria({ hora_inicio: '15:00:00' }), // 3-5pm (boundary: min=15)
      makeConsultoria({ hora_inicio: '16:30:00' }), // 3-5pm
    ]
    const result = countByFranjaHoraria(data)
    const byLabel = Object.fromEntries(result.map((b) => [b.franja, b.count]))
    expect(byLabel['8-10am']).toBe(2)
    expect(byLabel['10am-12pm']).toBe(2)
    expect(byLabel['1-3pm']).toBe(2)
    expect(byLabel['3-5pm']).toBe(2)
    expect(byLabel['Fuera de horario']).toBe(0)
    expect(byLabel['Sin hora']).toBe(0)
  })

  it('routes out-of-business hours to "Fuera de horario"', () => {
    const data = [
      makeConsultoria({ hora_inicio: '07:00:00' }), // before business hours
      makeConsultoria({ hora_inicio: '12:00:00' }), // lunch hour (not in any business bucket)
      makeConsultoria({ hora_inicio: '12:30:00' }), // lunch hour
      makeConsultoria({ hora_inicio: '17:00:00' }), // after 3-5pm (max=17)
      makeConsultoria({ hora_inicio: '20:00:00' }), // evening
    ]
    const result = countByFranjaHoraria(data)
    const byLabel = Object.fromEntries(result.map((b) => [b.franja, b.count]))
    expect(byLabel['Fuera de horario']).toBe(5)
    expect(byLabel['8-10am']).toBe(0)
  })

  it('bucket boundaries: hour=8 → 8-10am, hour=12 → Fuera de horario, hour=13 → 1-3pm', () => {
    const result8 = countByFranjaHoraria([makeConsultoria({ hora_inicio: '08:00:00' })])
    expect(result8.find((b) => b.franja === '8-10am')?.count).toBe(1)

    const result12 = countByFranjaHoraria([makeConsultoria({ hora_inicio: '12:00:00' })])
    expect(result12.find((b) => b.franja === 'Fuera de horario')?.count).toBe(1)

    const result13 = countByFranjaHoraria([makeConsultoria({ hora_inicio: '13:00:00' })])
    expect(result13.find((b) => b.franja === '1-3pm')?.count).toBe(1)
  })

  it('all 6 buckets always present even when data only has one bucket', () => {
    const data = [makeConsultoria({ hora_inicio: '08:30:00' })] // only 8-10am
    const result = countByFranjaHoraria(data)
    expect(result).toHaveLength(6)
    const byLabel = Object.fromEntries(result.map((b) => [b.franja, b.count]))
    expect(byLabel['8-10am']).toBe(1)
    expect(byLabel['10am-12pm']).toBe(0)
    expect(byLabel['1-3pm']).toBe(0)
    expect(byLabel['3-5pm']).toBe(0)
    expect(byLabel['Fuera de horario']).toBe(0)
    expect(byLabel['Sin hora']).toBe(0)
  })
})

// ─── T-13: totalConsultorias — updated: now sources from registro_sesion ─────

describe('totalConsultorias — sources registro_sesion (updated from old status-filter)', () => {
  it('equals registroSesion.length regardless of consultoria status', () => {
    const data = [
      makeConsultoria({ status: 'Resuelto' }),
      makeConsultoria({ status: 'En seguimiento' }),
      makeConsultoria({ status: 'Pendiente' }),
      makeConsultoria({ status: 'Agendado' }),
      makeConsultoria({ status: 'Cancelado' }),
    ]
    const registros: import('../metricas').RegistroSesionForMetricas[] = [
      { id_consultoria: 'r1', cantidad_productos: 0 },
      { id_consultoria: 'r2', cantidad_productos: 0 },
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: registros })
    expect(result.totalConsultorias).toBe(2)
  })

  it('returns 0 when registroSesion is empty', () => {
    const data = [
      makeConsultoria({ status: 'Pendiente' }),
      makeConsultoria({ status: 'Pendiente' }),
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: [] })
    expect(result.totalConsultorias).toBe(0)
  })

  it('counts all status variants — only registroSesion length matters', () => {
    const data = [
      makeConsultoria({ status: 'completada' }),
      makeConsultoria({ status: 'enseguimiento' }),
      makeConsultoria({ status: 'cancelado' }),
    ]
    const registros: import('../metricas').RegistroSesionForMetricas[] = [
      { id_consultoria: 'r1', cantidad_productos: 0 },
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: registros })
    expect(result.totalConsultorias).toBe(1)
  })
})

// ─── T-13: Sin consultor guards ───────────────────────────────────────────────

describe('avgDuracionByConsultor — excludes null id_consultor', () => {
  it('row with null id_consultor is absent from output', () => {
    const data = [
      makeConsultoria({ duracion_minutos: 60, id_consultor: null, consultores: { nombre: 'Ghost' } }),
    ]
    expect(avgDuracionByConsultor(data)).toEqual([])
  })

  it('row with valid id_consultor appears in output', () => {
    const data = [
      makeConsultoria({ duracion_minutos: 60, id_consultor: 'c-1', consultores: { nombre: 'Ana' } }),
    ]
    const result = avgDuracionByConsultor(data)
    expect(result).toHaveLength(1)
    expect(result[0].consultor).toBe('Ana')
  })
})

describe('countByConsultor — excludes null id_consultor', () => {
  it('row with null id_consultor is absent from output', () => {
    const data = [makeConsultoria({ id_consultor: null, consultores: { nombre: 'Ghost' } })]
    expect(countByConsultor(data)).toEqual([])
  })

  it('row with valid id_consultor appears in output', () => {
    const data = [makeConsultoria({ id_consultor: 'c-1', consultores: { nombre: 'Ana' } })]
    const result = countByConsultor(data)
    expect(result).toHaveLength(1)
    expect(result[0].consultor).toBe('Ana')
  })
})

describe('modalidadByConsultor — excludes null id_consultor', () => {
  it('row with null id_consultor is absent from output', () => {
    const data = [
      makeConsultoria({ id_consultor: null, consultores: { nombre: 'Ghost' }, modalidad: 'Virtual' }),
    ]
    expect(modalidadByConsultor(data)).toEqual([])
  })

  it('row with valid id_consultor appears in output', () => {
    const data = [
      makeConsultoria({ id_consultor: 'c-1', consultores: { nombre: 'Ana' }, modalidad: 'Virtual' }),
    ]
    const result = modalidadByConsultor(data)
    expect(result).toHaveLength(1)
    expect(result[0].consultor).toBe('Ana')
  })
})

// ─── T-13: porCasoUso — sources from categoria_caso (TASK-04) ────────────────

describe('porCasoUso — sources from categoria_caso, excludes Sin categorizar', () => {
  const noOp: import('../metricas').RegistroSesionForMetricas[] = []

  it('row with null categoria_caso produces no Sin categorizar entry', () => {
    const data = [makeConsultoria({ categoria_caso: null })]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: noOp })
    expect(result.porCasoUso.find((e) => e.caso === 'Sin categorizar')).toBeUndefined()
  })

  it('rows with valid categories appear unaffected', () => {
    const data = [
      makeConsultoria({ categoria_caso: 'Agentes' }),
      makeConsultoria({ categoria_caso: 'Agentes' }),
      makeConsultoria({ categoria_caso: null }), // should be excluded
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: noOp })
    const casos = result.porCasoUso
    expect(casos.find((e) => e.caso === 'Agentes')?.total).toBe(2)
    expect(casos.find((e) => e.caso === 'Sin categorizar')).toBeUndefined()
  })

  it('normalizes typo variants to canonical labels', () => {
    const data = [
      makeConsultoria({ categoria_caso: 'agente de ia' }),
      makeConsultoria({ categoria_caso: 'agente' }),
      makeConsultoria({ categoria_caso: 'asistentes de ia para tareas pequeñas y repetitvas' }), // typo
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: noOp })
    const casos = result.porCasoUso
    expect(casos.find((e) => e.caso === 'Agentes')?.total).toBe(2)
    expect(casos.find((e) => e.caso === 'Asistentes')?.total).toBe(1)
  })
})

// ─── porEstadoAtendidas — attended filter, excludes Agendado ─────────────────

describe('porEstadoAtendidas — excludes Agendado and unattended', () => {
  const noOp: import('../metricas').RegistroSesionForMetricas[] = []

  it('returns empty when attendedIds provided but no consultorias match', () => {
    const data = [
      makeConsultoria({ id: 'c1', status: 'Resuelto' }),
      makeConsultoria({ id: 'c2', status: 'Agendado' }),
    ]
    const result = computeMetricasFromConsultorias({
      consultorias: data,
      registroSesion: noOp,
      attendedIds: new Set<string>(), // none attended
    })
    expect(result.porEstadoAtendidas).toEqual([])
  })

  it('excludes Agendado even when in attendedIds', () => {
    const data = [
      makeConsultoria({ id: 'c1', status: 'Resuelto' }),
      makeConsultoria({ id: 'c2', status: 'Agendado' }),
      makeConsultoria({ id: 'c3', status: 'En seguimiento' }),
    ]
    const result = computeMetricasFromConsultorias({
      consultorias: data,
      registroSesion: noOp,
      attendedIds: new Set(['c1', 'c2', 'c3']),
    })
    const labels = result.porEstadoAtendidas.map((e) => e.status).sort()
    expect(labels).toEqual(['En seguimiento', 'Resuelto'])
    expect(result.porEstadoAtendidas.find((e) => e.status === 'Agendado')).toBeUndefined()
  })

  it('counts only sessions whose id is in attendedIds', () => {
    const data = [
      makeConsultoria({ id: 'c1', status: 'Resuelto' }),  // attended
      makeConsultoria({ id: 'c2', status: 'Resuelto' }),  // NOT attended
      makeConsultoria({ id: 'c3', status: 'Cancelado' }), // attended
    ]
    const result = computeMetricasFromConsultorias({
      consultorias: data,
      registroSesion: noOp,
      attendedIds: new Set(['c1', 'c3']),
    })
    expect(result.porEstadoAtendidas.find((e) => e.status === 'Resuelto')?.total).toBe(1)
    expect(result.porEstadoAtendidas.find((e) => e.status === 'Cancelado')?.total).toBe(1)
  })

  it('does NOT mutate porEstado (Agendado still present there)', () => {
    const data = [
      makeConsultoria({ id: 'c1', status: 'Resuelto' }),
      makeConsultoria({ id: 'c2', status: 'Agendado' }),
    ]
    const result = computeMetricasFromConsultorias({
      consultorias: data,
      registroSesion: noOp,
      attendedIds: new Set(['c1']),
    })
    expect(result.porEstado.find((e) => e.status === 'Agendado')?.total).toBe(1)
  })

  it('fallback when attendedIds undefined: mirror porEstado minus Agendado', () => {
    const data = [
      makeConsultoria({ id: 'c1', status: 'Resuelto' }),
      makeConsultoria({ id: 'c2', status: 'Agendado' }),
    ]
    const result = computeMetricasFromConsultorias({
      consultorias: data,
      registroSesion: noOp,
      // no attendedIds
    })
    expect(result.porEstadoAtendidas.find((e) => e.status === 'Agendado')).toBeUndefined()
    expect(result.porEstadoAtendidas.find((e) => e.status === 'Resuelto')?.total).toBe(1)
  })
})

// ─── T-14: countByDepartamento ────────────────────────────────────────────────

describe('countByDepartamento', () => {
  it('maps bogota (normalized) to SANTAFE DE BOGOTA D.C', () => {
    const data = [
      makeConsultoria({ leads: { city: 'bogota', company_role_level: null, origen: null, sector: null, company_role_area: null, nit: null } }),
    ]
    const { porDepartamento, sinUbicacion } = countByDepartamento(data)
    expect(porDepartamento[0].dept).toBe('SANTAFE DE BOGOTA D.C')
    expect(porDepartamento[0].total).toBe(1)
    expect(sinUbicacion).toBe(0)
  })

  it('maps Bogotá (with accent) to same department', () => {
    const data = [
      makeConsultoria({ leads: { city: 'Bogotá', company_role_level: null, origen: null, sector: null, company_role_area: null, nit: null } }),
    ]
    const { porDepartamento } = countByDepartamento(data)
    expect(porDepartamento[0].dept).toBe('SANTAFE DE BOGOTA D.C')
  })

  it('unrecognized city increments sinUbicacion', () => {
    const data = [
      makeConsultoria({ leads: { city: 'CiudadInventada', company_role_level: null, origen: null, sector: null, company_role_area: null, nit: null } }),
    ]
    const { porDepartamento, sinUbicacion } = countByDepartamento(data)
    expect(porDepartamento).toHaveLength(0)
    expect(sinUbicacion).toBe(1)
  })

  it('null city is silently excluded (no sinUbicacion increment)', () => {
    const data = [makeConsultoria({ leads: { city: null, company_role_level: null, origen: null, sector: null, company_role_area: null, nit: null } })]
    const { sinUbicacion, porDepartamento } = countByDepartamento(data)
    expect(sinUbicacion).toBe(0)
    expect(porDepartamento).toHaveLength(0)
  })

  it('null leads is silently excluded (no sinUbicacion increment)', () => {
    const data = [makeConsultoria({ leads: null })]
    const { sinUbicacion, porDepartamento } = countByDepartamento(data)
    expect(sinUbicacion).toBe(0)
    expect(porDepartamento).toHaveLength(0)
  })

  it('3 bogota rows + 1 unknown → porDepartamento has Bogotá dept with 3, sinUbicacion=1', () => {
    const bogota = { city: 'bogota', company_role_level: null, origen: null, sector: null, company_role_area: null, nit: null }
    const unknown = { city: 'atlantida', company_role_level: null, origen: null, sector: null, company_role_area: null, nit: null }
    const data = [
      makeConsultoria({ leads: bogota }),
      makeConsultoria({ leads: bogota }),
      makeConsultoria({ leads: bogota }),
      makeConsultoria({ leads: unknown }),
    ]
    const { porDepartamento, sinUbicacion } = countByDepartamento(data)
    expect(porDepartamento).toHaveLength(1)
    expect(porDepartamento[0].dept).toBe('SANTAFE DE BOGOTA D.C')
    expect(porDepartamento[0].total).toBe(3)
    expect(sinUbicacion).toBe(1)
  })
})

// ─── tiempoPromedioPorRol (renamed from tiempoPorRol; now computes average) ────

describe('tiempoPromedioPorRol', () => {
  it('returns empty array for empty input', () => {
    expect(tiempoPromedioPorRol([])).toEqual([])
  })

  it('ignores entries with null duracion_minutos', () => {
    const data = [makeConsultoria({ duracion_minutos: null })]
    expect(tiempoPromedioPorRol(data)).toEqual([])
  })

  it('computes average minutos per rol and sorts descending', () => {
    const data = [
      makeConsultoria({
        duracion_minutos: 30,
        leads: { city: null, company_role_level: 'Director', origen: null, sector: null, company_role_area: null, nit: null },
      }),
      makeConsultoria({
        duracion_minutos: 90,
        leads: { city: null, company_role_level: 'Director', origen: null, sector: null, company_role_area: null, nit: null },
      }),
      makeConsultoria({
        duracion_minutos: 45,
        leads: { city: null, company_role_level: 'Analista', origen: null, sector: null, company_role_area: null, nit: null },
      }),
    ]
    const result = tiempoPromedioPorRol(data)
    // Director average: (30 + 90) / 2 = 60
    expect(result[0]).toEqual({ rol: 'Director', minutos: 60 })
    expect(result[1]).toEqual({ rol: 'Analista', minutos: 45 })
  })

  it('maps null company_role_level to "Sin rol"', () => {
    const data = [makeConsultoria({ duracion_minutos: 30, leads: null })]
    const result = tiempoPromedioPorRol(data)
    expect(result).toEqual([{ rol: 'Sin rol', minutos: 30 }])
  })
})

// ─── computeConsultorMetrics ──────────────────────────────────────────────────

/**
 * Fixture layout (design doc §5):
 *   id   | id_consultor | dur_min | registro? | reg.dur_sesion_min | reg.productos | reg.grabada
 *   c1   | A            | 30      | yes       | 45                 | 2             | true
 *   c2   | A            | 60      | yes       | null               | 1             | false
 *   c3   | A            | 20      | no        | —                  | —             | —
 *   c4   | B            | 90      | yes       | 120                | 3             | true
 *   c5   | B            | null    | yes       | 60                 | 0             | null
 *
 * attendedIds = { c1, c2, c4, c5 }
 */
describe('computeConsultorMetrics', () => {
  function makeReg(
    id_consultoria: string,
    duracion_sesion_minutos: number | null,
    cantidad_productos: number | null,
    sesion_grabada: boolean | null,
  ): RegistroSesionForMetricas {
    return { id_consultoria, duracion_sesion_minutos, cantidad_productos, sesion_grabada }
  }

  const consulA1 = makeConsultoria({ id: 'c1', id_consultor: 'A', duracion_minutos: 30, consultores: { nombre: 'Ana' } })
  const consulA2 = makeConsultoria({ id: 'c2', id_consultor: 'A', duracion_minutos: 60, consultores: { nombre: 'Ana' } })
  const consulA3 = makeConsultoria({ id: 'c3', id_consultor: 'A', duracion_minutos: 20, consultores: { nombre: 'Ana' } })
  const consulB4 = makeConsultoria({ id: 'c4', id_consultor: 'B', duracion_minutos: 90, consultores: { nombre: 'Bob' } })
  const consulB5 = makeConsultoria({ id: 'c5', id_consultor: 'B', duracion_minutos: null, consultores: { nombre: 'Bob' } })

  const regC1 = makeReg('c1', 45, 2, true)
  const regC2 = makeReg('c2', null, 1, false)
  const regC4 = makeReg('c4', 120, 3, true)
  const regC5 = makeReg('c5', 60, 0, null)

  const allConsultorias = [consulA1, consulA2, consulA3, consulB4, consulB5]
  const allRegistros = [regC1, regC2, regC4, regC5]
  const attendedIds = new Set(['c1', 'c2', 'c4', 'c5'])

  it('case 1: prefers registro.duracion_sesion_minutos over consultoria.duracion_minutos', () => {
    // c1 should contribute 45 (from registro), not 30 (from consultoria)
    const result = computeConsultorMetrics(allConsultorias, allRegistros, attendedIds)
    const ana = result.find((r) => r.consultor === 'Ana')
    // Ana: c1 contributes 45, c2 contributes 60 (fallback). avg = round((45+60)/2) = 52 (or 53)
    expect(ana).toBeDefined()
    expect(ana!.duracionAvg).toBe(Math.round((45 + 60) / 2))
  })

  it('case 2: falls back to consultoria.duracion_minutos when registro.duracion_sesion_minutos is null', () => {
    // c2 has registro.duracion_sesion_minutos = null, so fallback to 60
    const result = computeConsultorMetrics(allConsultorias, allRegistros, attendedIds)
    const bob = result.find((r) => r.consultor === 'Bob')
    // Bob: c4 contributes 120, c5 contributes 60. avg = round((120+60)/2) = 90
    expect(bob).toBeDefined()
    expect(bob!.duracionAvg).toBe(90)
  })

  it('case 3: excludes consultorias without registro when attendedIds provided (A.sesiones=2)', () => {
    // c3 has no registro, so it must be excluded when attendedIds is provided
    const result = computeConsultorMetrics(allConsultorias, allRegistros, attendedIds)
    const ana = result.find((r) => r.consultor === 'Ana')
    expect(ana!.sesiones).toBe(2)
  })

  it('case 4: backward compat — without attendedIds includes all consultorias (A.sesiones=3)', () => {
    // Without attendedIds, all 3 Ana consultorias count
    const result = computeConsultorMetrics(allConsultorias, allRegistros)
    const ana = result.find((r) => r.consultor === 'Ana')
    expect(ana!.sesiones).toBe(3)
  })

  it('case 5: productos unchanged — computed from registro only (A=3, B=3)', () => {
    const result = computeConsultorMetrics(allConsultorias, allRegistros, attendedIds)
    const ana = result.find((r) => r.consultor === 'Ana')
    const bob = result.find((r) => r.consultor === 'Bob')
    expect(ana!.productos).toBe(3)  // c1:2 + c2:1
    expect(bob!.productos).toBe(3)  // c4:3 + c5:0
  })

// ─── consultoriasEnSeguimientoAtendidas ────────────────────────────────────────

describe('consultoriasEnSeguimientoAtendidas', () => {
  const noOp: import('../metricas').RegistroSesionForMetricas[] = []

  it('returns 0 when porEstadoAtendidas has no "En seguimiento" entries', () => {
    const data = [
      makeConsultoria({ id: 'c1', status: 'Resuelto' }),
      makeConsultoria({ id: 'c2', status: 'Agendado' }),
    ]
    const result = computeMetricasFromConsultorias({
      consultorias: data,
      registroSesion: noOp,
      attendedIds: new Set(['c1', 'c2']),
    })
    expect(result.consultoriasEnSeguimientoAtendidas).toBe(0)
  })

  it('returns correct count when "En seguimiento" exists in porEstadoAtendidas', () => {
    const data = [
      makeConsultoria({ id: 'c1', status: 'En seguimiento' }),
      makeConsultoria({ id: 'c2', status: 'En seguimiento' }),
      makeConsultoria({ id: 'c3', status: 'En seguimiento' }),
      makeConsultoria({ id: 'c4', status: 'En seguimiento' }),
      makeConsultoria({ id: 'c5', status: 'Resuelto' }),
    ]
    const result = computeMetricasFromConsultorias({
      consultorias: data,
      registroSesion: noOp,
      attendedIds: new Set(['c1', 'c2', 'c3', 'c4', 'c5']),
    })
    expect(result.consultoriasEnSeguimientoAtendidas).toBe(4)
  })

  it('does not count Agendado even when in attendedIds', () => {
    const data = [
      makeConsultoria({ id: 'c1', status: 'En seguimiento' }),
      makeConsultoria({ id: 'c2', status: 'Agendado' }),
    ]
    const result = computeMetricasFromConsultorias({
      consultorias: data,
      registroSesion: noOp,
      attendedIds: new Set(['c1', 'c2']),
    })
    expect(result.consultoriasEnSeguimientoAtendidas).toBe(1)
  })

  it('casosEnSeguimientoLeads remains unaffected by new metric', () => {
    const data = [
      makeConsultoria({ id: 'c1', id_lead: 'lead-a', status: 'En seguimiento', fecha: '2024-06-01' }),
      makeConsultoria({ id: 'c2', id_lead: 'lead-b', status: 'En seguimiento', fecha: '2024-06-02' }),
    ]
    const result = computeMetricasFromConsultorias({
      consultorias: data,
      registroSesion: noOp,
      attendedIds: new Set(['c1']), // only one attended: 1 from attended, 2 from leads
    })
    expect(result.consultoriasEnSeguimientoAtendidas).toBe(1)
    expect(result.casosEnSeguimientoLeads).toBe(2) // both leads have En seguimiento
  })
})

  it('case 6: pctGrabadas unchanged — A=50% (1 of 2 with registro), B=50% (1 of 2 with registro)', () => {
    const result = computeConsultorMetrics(allConsultorias, allRegistros, attendedIds)
    const ana = result.find((r) => r.consultor === 'Ana')
    const bob = result.find((r) => r.consultor === 'Bob')
    // Ana: c1 grabada=true, c2 grabada=false → 1/2 = 50%
    expect(ana!.pctGrabadas).toBe(50)
    // Bob: c4 grabada=true, c5 grabada=null (falsy) → 1/2 = 50%
    expect(bob!.pctGrabadas).toBe(50)
  })
})

// ─── monthWeekLabel ───────────────────────────────────────────────────────────

describe('monthWeekLabel', () => {
  it('day 1 of Jan → Ene S1', () => {
    expect(monthWeekLabel(new Date('2024-01-01T00:00:00'))).toBe('Ene S1')
  })

  it('day 8 of Jan → Ene S2', () => {
    expect(monthWeekLabel(new Date('2024-01-08T00:00:00'))).toBe('Ene S2')
  })

  it('day 29 of Jan → Ene S4 (floor((28)/7)+1=5 → capped at 4)', () => {
    expect(monthWeekLabel(new Date('2024-01-29T00:00:00'))).toBe('Ene S4')
  })

  it('day 15 of Mar → Mar S3', () => {
    expect(monthWeekLabel(new Date('2024-03-15T00:00:00'))).toBe('Mar S3')
  })

  it('day 1 of Dec → Dic S1', () => {
    expect(monthWeekLabel(new Date('2024-12-01T00:00:00'))).toBe('Dic S1')
  })
})

// ─── groupByPeriod — semana labels via monthWeekLabel ─────────────────────────

describe('groupByPeriod semana — monthWeekLabel labels', () => {
  it('returns Mon-SN label for period=semana', () => {
    const data = [makeConsultoria({ fecha: '2024-01-01' })]
    const result = groupByPeriod(data, 'semana')
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Ene S1')
  })

  it('groups same week (Mon S label) into single bucket', () => {
    const data = [
      makeConsultoria({ fecha: '2024-01-01' }),
      makeConsultoria({ fecha: '2024-01-03' }),
    ]
    const result = groupByPeriod(data, 'semana')
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Ene S1')
    expect(result[0].count).toBe(2)
  })

  it('orders buckets chronologically across months, not alphabetically by label', () => {
    // Out-of-order input spanning Jan→Apr; alphabetical label sort would give Abr<Ene<Feb<Mar
    const data = [
      makeConsultoria({ fecha: '2024-04-02' }),
      makeConsultoria({ fecha: '2024-01-02' }),
      makeConsultoria({ fecha: '2024-03-05' }),
      makeConsultoria({ fecha: '2024-02-06' }),
    ]
    const result = groupByPeriod(data, 'semana')
    expect(result.map((d) => d.label)).toEqual(['Ene S1', 'Feb S1', 'Mar S1', 'Abr S1'])
  })
})

// ─── computeWeeklyBuckets regression — Sem N labels unchanged ─────────────────

describe('computeWeeklyBuckets — Sem N labels unchanged (regression)', () => {
  it('still produces "Sem N" semana labels after monthWeekLabel is added', () => {
    const data = [makeConsultoria({ fecha: '2024-01-08', status: 'Resuelto' })]
    const result = computeWeeklyBuckets(data)
    expect(result).toHaveLength(1)
    expect(result[0].semana).toBe('Sem 2')
    expect(result[0].total).toBe(1)
  })
})

// ─── totalConsultorias — sources registro_sesion ──────────────────────────────

describe('totalConsultorias — sources registro_sesion', () => {
  it('GIVEN 3 consultorias (mixed status) AND 2 registros → totalConsultorias === 2', () => {
    const data = [
      makeConsultoria({ status: 'Resuelto' }),
      makeConsultoria({ status: 'Agendado' }),
      makeConsultoria({ status: 'Escalar' }),
    ]
    const registros: RegistroSesionForMetricas[] = [
      { id_consultoria: 'r1', cantidad_productos: 0 },
      { id_consultoria: 'r2', cantidad_productos: 0 },
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: registros })
    expect(result.totalConsultorias).toBe(2)
  })

  it('GIVEN 0 consultorias AND 0 registros → totalConsultorias === 0', () => {
    const result = computeMetricasFromConsultorias({ consultorias: [], registroSesion: [] })
    expect(result.totalConsultorias).toBe(0)
  })

  it('GIVEN 5 consultorias (all Agendado) AND 5 registros → totalConsultorias === 5', () => {
    const data = Array.from({ length: 5 }, () => makeConsultoria({ status: 'Agendado' }))
    const registros: RegistroSesionForMetricas[] = Array.from({ length: 5 }, (_, i) => ({
      id_consultoria: `r${i}`,
      cantidad_productos: 0,
    }))
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: registros })
    expect(result.totalConsultorias).toBe(5)
  })
})

// ─── tasaConversion — distinct bookings denominator ───────────────────────────

describe('tasaConversion — distinct bookings denominator', () => {
  it('4 consultorias booking_id=[A,A,B,B] AND 3 registros → round(3/2*100)=150', () => {
    const data = [
      makeConsultoria({ booking_id: 'A' }),
      makeConsultoria({ booking_id: 'A' }),
      makeConsultoria({ booking_id: 'B' }),
      makeConsultoria({ booking_id: 'B' }),
    ]
    const registros: RegistroSesionForMetricas[] = [
      { id_consultoria: 'r1', cantidad_productos: 0 },
      { id_consultoria: 'r2', cantidad_productos: 0 },
      { id_consultoria: 'r3', cantidad_productos: 0 },
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: registros })
    expect(result.tasaConversion).toBe(Math.round(3 / 2 * 10000) / 100)
  })

  it('all booking_id=null AND 2 registros → tasaConversion === 0', () => {
    const data = [
      makeConsultoria({ booking_id: null }),
      makeConsultoria({ booking_id: null }),
    ]
    const registros: RegistroSesionForMetricas[] = [
      { id_consultoria: 'r1', cantidad_productos: 0 },
      { id_consultoria: 'r2', cantidad_productos: 0 },
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: registros })
    expect(result.tasaConversion).toBe(0)
  })

  it('353 distinct booking_ids AND 217 registros → tasaConversion === 61.47 (2 decimals)', () => {
    const data = Array.from({ length: 353 }, (_, i) => makeConsultoria({ booking_id: `bk-${i}` }))
    const registros: RegistroSesionForMetricas[] = Array.from({ length: 217 }, (_, i) => ({
      id_consultoria: `r${i}`,
      cantidad_productos: 0,
    }))
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: registros })
    expect(result.tasaConversion).toBe(Math.round(217 / 353 * 10000) / 100)
    expect(result.tasaConversion).toBe(61.47)
  })
})

// ─── totalMinutos — sources registro_sesion ───────────────────────────────────

describe('totalMinutos — sources registro_sesion', () => {
  it('SUM registro.duracion; consultorias.duracion_minutos ignored', () => {
    const data = [
      makeConsultoria({ duracion_minutos: 120 }),
      makeConsultoria({ duracion_minutos: 120 }),
      makeConsultoria({ duracion_minutos: 120 }),
    ]
    const registros: RegistroSesionForMetricas[] = [
      { id_consultoria: 'r1', cantidad_productos: 0, duracion_sesion_minutos: 60 },
      { id_consultoria: 'r2', cantidad_productos: 0, duracion_sesion_minutos: 90 },
      { id_consultoria: 'r3', cantidad_productos: 0, duracion_sesion_minutos: null },
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: registros })
    expect(result.totalMinutos).toBe(150)
  })

  it('all duracion_sesion_minutos null → totalMinutos === 0 (not NaN)', () => {
    const data = [makeConsultoria({ duracion_minutos: 120 })]
    const registros: RegistroSesionForMetricas[] = [
      { id_consultoria: 'r1', cantidad_productos: 0, duracion_sesion_minutos: null },
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: registros })
    expect(result.totalMinutos).toBe(0)
    expect(Number.isNaN(result.totalMinutos)).toBe(false)
  })
})

// ─── avgDuracionByConsultor — registro priority ───────────────────────────────

describe('avgDuracionByConsultor — registro priority (new 2-arg form)', () => {
  it('uses registro.duracion_sesion_minutos over consultoria.duracion_minutos', () => {
    const data = [
      makeConsultoria({ id: 'c1', id_consultor: 'x', duracion_minutos: 120, consultores: { nombre: 'Ana' } }),
      makeConsultoria({ id: 'c2', id_consultor: 'x', duracion_minutos: 120, consultores: { nombre: 'Ana' } }),
    ]
    const registros: RegistroSesionForMetricas[] = [
      { id_consultoria: 'c1', cantidad_productos: 0, duracion_sesion_minutos: 45 },
      { id_consultoria: 'c2', cantidad_productos: 0, duracion_sesion_minutos: 75 },
    ]
    const result = avgDuracionByConsultor(data, registros)
    expect(result).toEqual([{ consultor: 'Ana', avg: 60 }])
  })

  it('falls back to consultoria.duracion_minutos when registroSesion=[]', () => {
    const data = [
      makeConsultoria({ id: 'c1', id_consultor: 'x', duracion_minutos: 90, consultores: { nombre: 'Ana' } }),
    ]
    const result = avgDuracionByConsultor(data, [])
    expect(result).toEqual([{ consultor: 'Ana', avg: 90 }])
  })

  it('excludes entry when both registro.duracion and c.duracion are null', () => {
    const data = [
      makeConsultoria({ id: 'c1', id_consultor: 'x', duracion_minutos: null, consultores: { nombre: 'Ana' } }),
    ]
    const registros: RegistroSesionForMetricas[] = [
      { id_consultoria: 'c1', cantidad_productos: 0, duracion_sesion_minutos: null },
    ]
    const result = avgDuracionByConsultor(data, registros)
    expect(result).toEqual([])
  })

  it('still works with 1-arg call (backward compat)', () => {
    const data = [
      makeConsultoria({ id: 'c1', id_consultor: 'x', duracion_minutos: 60, consultores: { nombre: 'Ana' } }),
    ]
    const result = avgDuracionByConsultor(data)
    expect(result).toEqual([{ consultor: 'Ana', avg: 60 }])
  })
})

// ─── computeMetricasFromConsultorias — duracionPorConsultor uses registro ──────

describe('computeMetricasFromConsultorias — duracionPorConsultor uses registro priority', () => {
  it('duracionPorConsultor entries use registro values, not consultorias.duracion_minutos', () => {
    const data = [
      makeConsultoria({ id: 'c1', id_consultor: 'x', duracion_minutos: 120, consultores: { nombre: 'Ana' } }),
    ]
    const registros: RegistroSesionForMetricas[] = [
      { id_consultoria: 'c1', cantidad_productos: 0, duracion_sesion_minutos: 45 },
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: registros })
    const ana = result.duracionPorConsultor.find((r) => r.consultor === 'Ana')
    expect(ana?.avg).toBe(45)
  })
})
