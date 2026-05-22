import { describe, it, expect } from 'vitest'
import {
  countUniqueNit,
  groupByPeriod,
  avgDuracionByConsultor,
  countByArea,
  countByConsultor,
  modalidadByConsultor,
  countByFranjaHoraria,
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
      makeConsultoria({ duracion_minutos: null, consultores: { nombre: 'Ana' } }),
    ]
    expect(avgDuracionByConsultor(data)).toEqual([])
  })

  it('computes average and sorts descending', () => {
    const data = [
      makeConsultoria({ duracion_minutos: 60, consultores: { nombre: 'Ana' } }),
      makeConsultoria({ duracion_minutos: 30, consultores: { nombre: 'Ana' } }),
      makeConsultoria({ duracion_minutos: 90, consultores: { nombre: 'Bob' } }),
    ]
    const result = avgDuracionByConsultor(data)
    expect(result).toEqual([
      { consultor: 'Bob', avg: 90 },
      { consultor: 'Ana', avg: 45 },
    ])
  })

  it('excludes consultor from result when all their duraciones are null', () => {
    const data = [
      makeConsultoria({ duracion_minutos: 60, consultores: { nombre: 'Ana' } }),
      makeConsultoria({ duracion_minutos: null, consultores: { nombre: 'Bob' } }),
    ]
    const result = avgDuracionByConsultor(data)
    expect(result).toHaveLength(1)
    expect(result[0].consultor).toBe('Ana')
  })

  it('uses "Sin consultor" when consultores is null', () => {
    const data = [
      makeConsultoria({ duracion_minutos: 45, consultores: null }),
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

  it('maps null consultores to "Sin consultor"', () => {
    const data = [makeConsultoria()]
    expect(countByConsultor(data)).toEqual([{ consultor: 'Sin consultor', count: 1 }])
  })

  it('counts and sorts descending', () => {
    const data = [
      makeConsultoria({ consultores: { nombre: 'Ana' } }),
      makeConsultoria({ consultores: { nombre: 'Ana' } }),
      makeConsultoria({ consultores: { nombre: 'Bob' } }),
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

  it('maps null modalidad to "Sin modalidad"', () => {
    const data = [makeConsultoria({ consultores: { nombre: 'Ana' }, modalidad: null })]
    const result = modalidadByConsultor(data)
    expect(result).toHaveLength(1)
    expect(result[0].consultor).toBe('Ana')
    expect(result[0]['Sin modalidad']).toBe(1)
  })

  it('produces one row per consultor with all modalidad keys', () => {
    const data = [
      makeConsultoria({ consultores: { nombre: 'Ana' }, modalidad: 'Presencial' }),
      makeConsultoria({ consultores: { nombre: 'Ana' }, modalidad: 'Virtual' }),
      makeConsultoria({ consultores: { nombre: 'Ana' }, modalidad: 'Presencial' }),
      makeConsultoria({ consultores: { nombre: 'Bob' }, modalidad: 'Virtual' }),
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
  it('returns all 7 buckets including zeros for empty input', () => {
    const result = countByFranjaHoraria([])
    expect(result).toHaveLength(7)
    expect(result.every((b) => b.count === 0)).toBe(true)
  })

  it('returns buckets in correct order', () => {
    const result = countByFranjaHoraria([])
    const labels = result.map((r) => r.franja)
    expect(labels).toEqual(['06-09', '09-12', '12-15', '15-18', '18-21', '21+', 'Sin hora'])
  })

  it('maps null hora_inicio to "Sin hora"', () => {
    const data = [makeConsultoria({ hora_inicio: null })]
    const result = countByFranjaHoraria(data)
    expect(result.find((b) => b.franja === 'Sin hora')?.count).toBe(1)
  })

  it('routes each franja bucket correctly', () => {
    const data = [
      makeConsultoria({ hora_inicio: '06:00:00' }), // 06-09
      makeConsultoria({ hora_inicio: '08:59:00' }), // 06-09
      makeConsultoria({ hora_inicio: '09:00:00' }), // 09-12
      makeConsultoria({ hora_inicio: '11:30:00' }), // 09-12
      makeConsultoria({ hora_inicio: '12:00:00' }), // 12-15
      makeConsultoria({ hora_inicio: '15:00:00' }), // 15-18
      makeConsultoria({ hora_inicio: '18:00:00' }), // 18-21
      makeConsultoria({ hora_inicio: '21:00:00' }), // 21+
      makeConsultoria({ hora_inicio: '23:59:00' }), // 21+
    ]
    const result = countByFranjaHoraria(data)
    const byLabel = Object.fromEntries(result.map((b) => [b.franja, b.count]))
    expect(byLabel['06-09']).toBe(2)
    expect(byLabel['09-12']).toBe(2)
    expect(byLabel['12-15']).toBe(1)
    expect(byLabel['15-18']).toBe(1)
    expect(byLabel['18-21']).toBe(1)
    expect(byLabel['21+']).toBe(2)
    expect(byLabel['Sin hora']).toBe(0)
  })

  it('sends invalid hora_inicio format to "Sin hora"', () => {
    const data = [makeConsultoria({ hora_inicio: 'invalid' })]
    const result = countByFranjaHoraria(data)
    expect(result.find((b) => b.franja === 'Sin hora')?.count).toBe(1)
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
