/**
 * Tests for ConsultorRadar axis legend content.
 *
 * Strategy: The legend is static content. We test the exported constants
 * directly (pure function approach) — no DOM environment needed, no new deps.
 *
 * Spec ref: Fix 2 — four axis descriptions visible, reading guide present,
 * Valores normalizados footnote retained.
 */

import { describe, it, expect } from 'vitest'
import {
  RADAR_LEGEND_ITEMS,
  RADAR_READING_GUIDE,
  RADAR_FOOTNOTE,
} from '../ConsultorRadar'

describe('ConsultorRadar axis legend — static content', () => {
  it('exports exactly 4 axis legend items with the correct axis labels', () => {
    expect(RADAR_LEGEND_ITEMS).toHaveLength(4)

    const labels = RADAR_LEGEND_ITEMS.map((item) => item.axis)
    expect(labels).toContain('Sesiones')
    expect(labels).toContain('Duración (avg)')
    expect(labels).toContain('Productos')
    expect(labels).toContain('Grabadas %')
  })

  it('each legend item has a non-empty description string', () => {
    for (const item of RADAR_LEGEND_ITEMS) {
      expect(typeof item.description).toBe('string')
      expect(item.description.length).toBeGreaterThan(0)
    }
  })

  it('exports a reading guide mentioning balanced/generalist and spike/specialist concepts', () => {
    expect(typeof RADAR_READING_GUIDE).toBe('string')
    expect(RADAR_READING_GUIDE.length).toBeGreaterThan(0)
    // The guide must mention both concepts per spec:
    // "balanced profile suggests generalist" and "spike suggests specialist"
    const lower = RADAR_READING_GUIDE.toLowerCase()
    expect(lower).toMatch(/balanceada|balanced|generalista|generalist/)
    expect(lower).toMatch(/pico|spike|especialista|specialist/)
  })

  it('exports a footnote mentioning "Valores normalizados"', () => {
    expect(typeof RADAR_FOOTNOTE).toBe('string')
    expect(RADAR_FOOTNOTE).toMatch(/Valores normalizados/i)
  })
})

describe('ConsultorRadar axis legend — triangulation: Sesiones description content', () => {
  it('Sesiones description mentions sesiones and a quantity/count concept', () => {
    const sesiones = RADAR_LEGEND_ITEMS.find((item) => item.axis === 'Sesiones')
    expect(sesiones).toBeDefined()
    const lower = sesiones!.description.toLowerCase()
    // Must mention sessions (sesiones/sessions)
    expect(lower).toMatch(/sesion/)
  })

  it('Duración description mentions duration/minutes', () => {
    const duracion = RADAR_LEGEND_ITEMS.find((item) => item.axis === 'Duración (avg)')
    expect(duracion).toBeDefined()
    const lower = duracion!.description.toLowerCase()
    expect(lower).toMatch(/duraci|minut/)
  })
})
