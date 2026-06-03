import { describe, it, expect } from 'vitest'
import { leadFullName } from '../index'

describe('leadFullName', () => {
  it('returns nombre_completo when set', () => {
    expect(leadFullName({ nombre_completo: 'Juan Pérez' })).toBe('Juan Pérez')
  })

  it('returns "Sin nombre" when nombre_completo is null', () => {
    expect(leadFullName({ nombre_completo: null })).toBe('Sin nombre')
  })

  it('returns "Sin nombre" when nombre_completo is empty string', () => {
    expect(leadFullName({ nombre_completo: '' })).toBe('Sin nombre')
  })
})
