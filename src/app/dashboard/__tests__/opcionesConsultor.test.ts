/**
 * Opciones del desplegable de consultor.
 *
 * La card y el filtro responden preguntas distintas a propósito: la card dice
 * quién atendió al lead —dato real, venga de donde venga—, y el filtro solo
 * ofrece a quienes están dados de alta en `consultores`. Felipe atendió 19
 * leads pero no está en esa tabla, así que se ve en su card y no se ofrece
 * como opción.
 */
import { describe, it, expect } from 'vitest'
import { opcionesDeConsultor } from '../searchHelpers'

describe('opcionesDeConsultor', () => {
  it('ofrece solo a los consultores asignados desde la tabla', () => {
    expect(opcionesDeConsultor([
      { consultor_nombre: 'Yiseth Paola Gutierrez Aragon' },
      { consultor_nombre: 'Adrian Andres Gutierrez Regino' },
    ])).toEqual(['Adrian Andres Gutierrez Regino', 'Yiseth Paola Gutierrez Aragon'])
  })

  it('no ofrece a quien solo existe como staff de la reserva', () => {
    // El cast es deliberado: la firma ni siquiera admite `consultoria`, así que
    // el staff de la reserva no puede llegar al desplegable ni por accidente.
    const conStaff = [
      { consultor_nombre: null, consultoria: { staff_name: 'Felipe Zapata' } },
      { consultor_nombre: null, consultoria: { staff_name: 'Felipe De Jesus Zapata Linero; ;' } },
    ] as unknown as Array<{ consultor_nombre?: string | null }>

    expect(opcionesDeConsultor(conStaff)).toEqual([])
  })

  it('no repite ni deja huecos, y ordena alfabéticamente', () => {
    expect(opcionesDeConsultor([
      { consultor_nombre: 'Santiago Andres Comas Duran' },
      { consultor_nombre: 'Adrian Andres Gutierrez Regino' },
      { consultor_nombre: 'Santiago Andres Comas Duran' },
      { consultor_nombre: null },
      { consultor_nombre: '   ' },
    ])).toEqual(['Adrian Andres Gutierrez Regino', 'Santiago Andres Comas Duran'])
  })

  it('sin leads devuelve lista vacía', () => {
    expect(opcionesDeConsultor([])).toEqual([])
  })
})
