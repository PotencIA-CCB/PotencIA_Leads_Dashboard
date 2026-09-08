/**
 * La columna consultorias.modalidad tiene un CHECK que solo admite
 * 'Virtual' y 'Presencial'. La versión anterior del route devolvía el texto
 * crudo cuando no reconocía el valor, violando el constraint.
 */
import { describe, it, expect } from 'vitest'
import { normalizeModalidad } from '../bookingUtils'

describe('normalizeModalidad', () => {
  it('reconoce virtual sin distinguir mayúsculas ni espacios', () => {
    expect(normalizeModalidad(' VIRTUAL ')).toBe('Virtual')
  })

  it('reconoce presencial sin distinguir mayúsculas ni espacios', () => {
    expect(normalizeModalidad('Presencial')).toBe('Presencial')
  })

  it('resuelve a Virtual cuando el texto no corresponde a ninguno', () => {
    expect(normalizeModalidad('Sesión híbrida en la sede norte')).toBe('Virtual')
  })

  it('resuelve a Virtual con cadena vacía', () => {
    expect(normalizeModalidad('')).toBe('Virtual')
  })

  it('resuelve a Virtual con undefined', () => {
    expect(normalizeModalidad(undefined)).toBe('Virtual')
  })
})
