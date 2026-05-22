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
  tiempoPorRol,
  type ConsultoriaForMetricas,
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
    leads: {
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

  it('groups by semana (YYYY-Www) sorted ascending', () => {
    const data = [
      makeConsultoria({ fecha: '2024-01-15' }), // W03
      makeConsultoria({ fecha: '2024-01-08' }), // W02
      makeConsultoria({ fecha: '2024-01-09' }), // W02
    ]
    const result = groupByPeriod(data, 'semana')
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('2024-W02')
    expect(result[0].count).toBe(2)
    expect(result[1].label).toBe('2024-W03')
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

  it('maps null area to "Sin área"', () => {
    const data = [makeConsultoria()]
    expect(countByArea(data)).toEqual([{ area: 'Sin área', count: 1 }])
  })

  it('counts and sorts by count descending', () => {
    const data = [
      makeConsultoria({ leads: { city: null, company_role_level: null, origen: null, sector: null, company_role_area: 'Tech', nit: null } }),
      makeConsultoria({ leads: { city: null, company_role_level: null, origen: null, sector: null, company_role_area: 'Tech', nit: null } }),
      makeConsultoria({ leads: { city: null, company_role_level: null, origen: null, sector: null, company_role_area: 'Ventas', nit: null } }),
    ]
    const result = countByArea(data)
    expect(result[0]).toEqual({ area: 'Tech', count: 2 })
    expect(result[1]).toEqual({ area: 'Ventas', count: 1 })
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

// ─── T-13: totalConsultorias filter ──────────────────────────────────────────

describe('totalConsultorias — only Resuelto + En seguimiento', () => {
  const noOp: import('../metricas').RegistroSesionForMetricas[] = []

  it('counts only Resuelto and En seguimiento', () => {
    const data = [
      makeConsultoria({ status: 'Resuelto' }),
      makeConsultoria({ status: 'En seguimiento' }),
      makeConsultoria({ status: 'Pendiente' }),
      makeConsultoria({ status: 'Agendado' }),
      makeConsultoria({ status: 'Cancelado' }),
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: noOp })
    expect(result.totalConsultorias).toBe(2)
  })

  it('returns 0 when all rows are Pendiente', () => {
    const data = [
      makeConsultoria({ status: 'Pendiente' }),
      makeConsultoria({ status: 'Pendiente' }),
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: noOp })
    expect(result.totalConsultorias).toBe(0)
  })

  it('handles status variants via canonicalStatus normalization', () => {
    const data = [
      makeConsultoria({ status: 'completada' }),  // normalizes to Resuelto
      makeConsultoria({ status: 'enseguimiento' }), // normalizes to En seguimiento
      makeConsultoria({ status: 'cancelado' }),
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: noOp })
    expect(result.totalConsultorias).toBe(2)
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

// ─── T-13: porCasoUso — no 'Sin categorizar' ─────────────────────────────────

describe('porCasoUso — excludes Sin categorizar', () => {
  const noOp: import('../metricas').RegistroSesionForMetricas[] = []

  it('row with null categoria_caso_uso produces no Sin categorizar entry', () => {
    const data = [makeConsultoria({ categoria_caso_uso: null })]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: noOp })
    expect(result.porCasoUso.find((e) => e.caso === 'Sin categorizar')).toBeUndefined()
  })

  it('rows with valid categories appear unaffected', () => {
    const data = [
      makeConsultoria({ categoria_caso_uso: 'Agentes' }),
      makeConsultoria({ categoria_caso_uso: 'Agentes' }),
      makeConsultoria({ categoria_caso_uso: null }), // should be excluded
    ]
    const result = computeMetricasFromConsultorias({ consultorias: data, registroSesion: noOp })
    const casos = result.porCasoUso
    expect(casos.find((e) => e.caso === 'Agentes')?.total).toBe(2)
    expect(casos.find((e) => e.caso === 'Sin categorizar')).toBeUndefined()
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

// ─── tiempoPorRol ─────────────────────────────────────────────────────────────

describe('tiempoPorRol', () => {
  it('returns empty array for empty input', () => {
    expect(tiempoPorRol([])).toEqual([])
  })

  it('ignores entries with null duracion_minutos', () => {
    const data = [makeConsultoria({ duracion_minutos: null })]
    expect(tiempoPorRol(data)).toEqual([])
  })

  it('sums minutos per rol and sorts descending', () => {
    const data = [
      makeConsultoria({
        duracion_minutos: 30,
        leads: { city: null, company_role_level: 'Director', origen: null, sector: null, company_role_area: null, nit: null },
      }),
      makeConsultoria({
        duracion_minutos: 60,
        leads: { city: null, company_role_level: 'Director', origen: null, sector: null, company_role_area: null, nit: null },
      }),
      makeConsultoria({
        duracion_minutos: 45,
        leads: { city: null, company_role_level: 'Analista', origen: null, sector: null, company_role_area: null, nit: null },
      }),
    ]
    const result = tiempoPorRol(data)
    expect(result[0]).toEqual({ rol: 'Director', minutos: 90 })
    expect(result[1]).toEqual({ rol: 'Analista', minutos: 45 })
  })

  it('maps null company_role_level to "Sin rol"', () => {
    const data = [makeConsultoria({ duracion_minutos: 30, leads: null })]
    const result = tiempoPorRol(data)
    expect(result).toEqual([{ rol: 'Sin rol', minutos: 30 }])
  })
})
