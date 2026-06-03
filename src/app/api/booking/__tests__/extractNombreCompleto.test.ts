import { describe, it, expect } from 'vitest'
import { extractNombreCompleto } from '../bookingUtils'

describe('extractNombreCompleto', () => {
  it('returns full_name when both full_name and nombre are present (full_name wins)', () => {
    expect(extractNombreCompleto({ full_name: 'Juan Pérez', nombre: 'Juan' })).toBe('Juan Pérez')
  })

  it('falls back to nombre when full_name is absent', () => {
    expect(extractNombreCompleto({ nombre: 'María López' })).toBe('María López')
  })

  it('returns empty string when both are absent', () => {
    expect(extractNombreCompleto({})).toBe('')
  })

  it('trims whitespace from the result', () => {
    expect(extractNombreCompleto({ full_name: '  Ana Torres  ' })).toBe('Ana Torres')
  })

  it('returns empty string when full_name is empty and nombre is absent', () => {
    expect(extractNombreCompleto({ full_name: '' })).toBe('')
  })
})
