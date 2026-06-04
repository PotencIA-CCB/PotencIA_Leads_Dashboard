import { describe, it, expect } from 'vitest'
import { radarFillOpacity, computeBrecha, buildPorTema } from '../dashboardTransforms'

describe('radarFillOpacity', () => {
  it('returns 0.15 when selected is null (any consultor)', () => {
    expect(radarFillOpacity('Ana', null)).toBe(0.15)
  })

  it('returns 0.15 when selected is null regardless of consultor name', () => {
    expect(radarFillOpacity('Carlos', null)).toBe(0.15)
  })

  it('returns 0.4 when consultor matches selected', () => {
    expect(radarFillOpacity('Ana', 'Ana')).toBe(0.4)
  })

  it('returns 0.05 when consultor does not match selected', () => {
    expect(radarFillOpacity('Ana', 'Carlos')).toBe(0.05)
  })
})

describe('computeBrecha', () => {
  it('returns positive difference when agendadas > resuelto', () => {
    expect(computeBrecha(10, 6)).toBe(4)
  })

  it('returns 0 when agendadas equals resuelto', () => {
    expect(computeBrecha(5, 5)).toBe(0)
  })

  it('returns negative number when agendadas < resuelto', () => {
    expect(computeBrecha(3, 7)).toBe(-4)
  })
})

describe('buildPorTema', () => {
  it('returns [] when formularios is empty', () => {
    const cons = [{ id_lead: 'l1' }]
    expect(buildPorTema(cons, [])).toEqual([])
  })

  it('counts a formulario when tema is present and id_lead matches a cons entry', () => {
    const cons = [{ id_lead: 'l1' }]
    const formularios = [{ id_lead: 'l1', tema: 'Fiscalización' }]
    expect(buildPorTema(cons, formularios)).toEqual([{ servicio: 'Fiscalización', total: 1 }])
  })

  it('skips entry when tema is null (no throw)', () => {
    const cons = [{ id_lead: 'l1' }]
    const formularios = [{ id_lead: 'l1', tema: null }]
    expect(buildPorTema(cons, formularios)).toEqual([])
  })

  it('skips formulario when id_lead is not in cons', () => {
    const cons = [{ id_lead: 'l1' }]
    const formularios = [{ id_lead: 'l99', tema: 'Fiscalización' }]
    expect(buildPorTema(cons, formularios)).toEqual([])
  })

  it('aggregates multiple formularios with the same tema', () => {
    const cons = [{ id_lead: 'l1' }, { id_lead: 'l2' }]
    const formularios = [
      { id_lead: 'l1', tema: 'Fiscalización' },
      { id_lead: 'l2', tema: 'Fiscalización' },
    ]
    expect(buildPorTema(cons, formularios)).toEqual([{ servicio: 'Fiscalización', total: 2 }])
  })

  it('sorts multiple distinct temas descending by total', () => {
    const cons = [{ id_lead: 'l1' }, { id_lead: 'l2' }, { id_lead: 'l3' }]
    const formularios = [
      { id_lead: 'l1', tema: 'Contabilidad' },
      { id_lead: 'l2', tema: 'Fiscalización' },
      { id_lead: 'l3', tema: 'Fiscalización' },
    ]
    const result = buildPorTema(cons, formularios)
    expect(result[0]).toEqual({ servicio: 'Fiscalización', total: 2 })
    expect(result[1]).toEqual({ servicio: 'Contabilidad', total: 1 })
  })
})
