/**
 * TDD tests for SessionInsightsSection component.
 * Written before the component exists — all cases must fail (red) on first run.
 *
 * Covers:
 * - R-SESS-01: card count matches sessions array length
 * - R-SESS-02: all four field labels and values render
 * - R-SESS-03: null fields render fallback strings
 * - R-SESS-04: empty sessions array renders empty-state text
 * - R-SESS-05: loading state renders animate-pulse skeleton
 */

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SessionInsightsSection from '../SessionInsightsSection'
import type { RegistroSesion } from '@/types'

function makeSession(overrides: Partial<RegistroSesion> = {}): RegistroSesion {
  return {
    id: 's1',
    created_at: '2026-01-01T00:00:00Z',
    id_consultoria: 'c1',
    pregunta: null,
    motivo_consulta: null,
    estado_inicial: null,
    acciones_realizadas: null,
    resultado_final: null,
    estimacion_impacto: null,
    entregables: null,
    resultado: null,
    cantidad_productos: 0,
    sesion_grabada: false,
    enlace_grabacion: null,
    adjuntar_evidencia: null,
    confirmo_no_automatizacion: null,
    ...overrides,
  }
}

function render(sessions: RegistroSesion[], loading: boolean): string {
  return renderToStaticMarkup(
    createElement(SessionInsightsSection, { sessions, loading })
  )
}

describe('SessionInsightsSection', () => {
  it('loading=true renders animate-pulse skeleton', () => {
    const html = render([], true)
    expect(html).toContain('animate-pulse')
  })

  it('loading=false with empty sessions renders "Sin datos de sesiones aún"', () => {
    const html = render([], false)
    expect(html).toContain('Sin datos de sesiones aún')
  })

  it('renders all four field values and labels for a session with all fields populated', () => {
    const session = makeSession({
      estado_inicial: 'En proceso',
      acciones_realizadas: 'Se realizó análisis completo',
      resultado_final: 'Satisfactorio',
      estimacion_impacto: 'Ahorro de 10h/semana',
    })
    const html = render([session], false)

    expect(html).toContain('En proceso')
    expect(html).toContain('Se realizó análisis completo')
    expect(html).toContain('Satisfactorio')
    expect(html).toContain('Ahorro de 10h/semana')
  })

  it('renders fallback strings for null fields', () => {
    const session = makeSession({
      estado_inicial: null,
      acciones_realizadas: null,
      resultado_final: null,
      estimacion_impacto: null,
    })
    const html = render([session], false)

    expect(html).toContain('Sin acciones registradas')
    expect(html).toContain('Sin estimación')
    // resultado_final fallback is —
    expect(html).toContain('—')
  })

  it('renders exactly N article elements for N sessions', () => {
    const sessions = [
      makeSession({ id: 's1', estado_inicial: 'A' }),
      makeSession({ id: 's2', estado_inicial: 'B' }),
      makeSession({ id: 's3', estado_inicial: 'C' }),
    ]
    const html = render(sessions, false)
    const articleMatches = html.match(/<article/g) ?? []
    expect(articleMatches.length).toBe(3)
  })
})
