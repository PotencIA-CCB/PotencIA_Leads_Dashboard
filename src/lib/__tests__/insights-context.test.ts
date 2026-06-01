/**
 * TDD tests for buildImpactContext — prompt enrichment with
 * registro_sesion.pregunta and motivo_consulta fields.
 *
 * Covers:
 * - R1: pregunta/motivo_consulta selected and appear in output
 * - R2: Free-text labeled sections ("PREGUNTAS DE LEADS", "MOTIVOS DE CONSULTA")
 * - R3: Truncation at 200 chars with "..."
 * - R4: Null/empty fields produce no output lines
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock @supabase/supabase-js ───────────────────────────────────────────────
// buildImpactContext creates several .from().select() chains that must resolve.
// We mimic the route.test.ts mock pattern: each chain is thenable.

const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

import { buildImpactContext } from '../insights-context'

// ─── Helper: build a mock supabase client ────────────────────────────────────
function makeMockSupabase(tableData: Record<string, unknown[]>) {
  const client = {
    from: vi.fn((table: string) => {
      const data = tableData[table] ?? []
      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: (v: unknown) => void) => {
          resolve({ data, error: null })
        },
      }
      return chain
    }),
  }
  return client
}

// ─── Helpers: build mock rows ─────────────────────────────────────────────────

function makeSesionRow(overrides: Record<string, unknown> = {}) {
  return {
    id_consultoria: 'c1',
    cantidad_productos: 2,
    acciones_realizadas: 'Revisión de procesos',
    estado_inicial: 'Pendiente',
    resultado_final: 'Interesado',
    pregunta: null,
    motivo_consulta: null,
    estimacion_impacto: null,
    ...overrides,
  }
}

function makeConsultoriaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    categoria_caso_uso: 'Agentes',
    nivel_potencia: 'Alto',
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildImpactContext — pregunta and motivo_consulta enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── RED 2.1: pregunta/motivo_consulta appear as labeled sections ──────────
  it('includes "PREGUNTAS DE LEADS" section when registro_sesion has non-empty pregunta', async () => {
    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', pregunta: '¿Cómo automatizar mi proceso de ventas?' }),
      makeSesionRow({ id_consultoria: 'c2', pregunta: 'Necesito crear un agente de atención al cliente' }),
    ]
    const consulRows = [
      makeConsultoriaRow({ id: 'c1' }),
      makeConsultoriaRow({ id: 'c2' }),
    ]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    expect(result).toContain('PREGUNTAS DE LEADS')
    expect(result).toContain('¿Cómo automatizar mi proceso de ventas?')
    expect(result).toContain('Necesito crear un agente de atención al cliente')
  })

  it('includes "MOTIVOS DE CONSULTA" section when registro_sesion has non-empty motivo_consulta', async () => {
    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', motivo_consulta: 'Optimización de procesos internos' }),
      makeSesionRow({ id_consultoria: 'c2', motivo_consulta: 'Implementación de IA generativa' }),
    ]
    const consulRows = [
      makeConsultoriaRow({ id: 'c1' }),
      makeConsultoriaRow({ id: 'c2' }),
    ]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    expect(result).toContain('MOTIVOS DE CONSULTA')
    expect(result).toContain('Optimización de procesos internos')
    expect(result).toContain('Implementación de IA generativa')
  })

  // ── RED 2.2: text truncated at 200 chars with "..." ────────────────────────
  it('truncates pregunta exceeding 200 chars with "..."', async () => {
    const longText = 'A'.repeat(250)
    const expectedTruncation = 'A'.repeat(200) + '...'

    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', pregunta: longText }),
    ]
    const consulRows = [makeConsultoriaRow({ id: 'c1' })]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    // The full 250-char text should NOT appear
    expect(result).not.toContain(longText)
    // The truncated version SHOULD appear
    expect(result).toContain(expectedTruncation)
  })

  it('truncates motivo_consulta exceeding 200 chars with "..."', async () => {
    const longText = 'B'.repeat(300)
    const expectedTruncation = 'B'.repeat(200) + '...'

    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', motivo_consulta: longText }),
    ]
    const consulRows = [makeConsultoriaRow({ id: 'c1' })]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    expect(result).not.toContain(longText)
    expect(result).toContain(expectedTruncation)
  })

  // ── RED 2.3: null/empty produce no output ──────────────────────────────────
  it('omits "PREGUNTAS DE LEADS" section when all pregunta are null', async () => {
    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', pregunta: null, acciones_realizadas: null, estado_inicial: null, resultado_final: null }),
      makeSesionRow({ id_consultoria: 'c2', pregunta: null, acciones_realizadas: null, estado_inicial: null, resultado_final: null }),
    ]
    const consulRows = [
      makeConsultoriaRow({ id: 'c1' }),
      makeConsultoriaRow({ id: 'c2' }),
    ]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    expect(result).not.toContain('PREGUNTAS DE LEADS')
    expect(result).not.toContain('MOTIVOS DE CONSULTA')
  })

  it('omits "MOTIVOS DE CONSULTA" section when all motivo_consulta are null', async () => {
    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', motivo_consulta: null, acciones_realizadas: null, estado_inicial: null, resultado_final: null }),
    ]
    const consulRows = [makeConsultoriaRow({ id: 'c1' })]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    expect(result).not.toContain('MOTIVOS DE CONSULTA')
  })

  it('omits empty string pregunta/motivo_consulta (treated same as null)', async () => {
    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', pregunta: '', motivo_consulta: '   ', acciones_realizadas: null, estado_inicial: null, resultado_final: null }),
    ]
    const consulRows = [makeConsultoriaRow({ id: 'c1' })]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    expect(result).not.toContain('PREGUNTAS DE LEADS')
    expect(result).not.toContain('MOTIVOS DE CONSULTA')
  })

  // ── TRIANGULATE: mixed data (some with, some without) ──────────────────────
  it('includes only non-empty values when mixed null/non-null rows exist', async () => {
    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', pregunta: '¿Cómo escalar mi empresa?', motivo_consulta: null }),
      makeSesionRow({ id_consultoria: 'c2', pregunta: null, motivo_consulta: 'Crecimiento empresarial' }),
      makeSesionRow({ id_consultoria: 'c3', pregunta: null, motivo_consulta: null, acciones_realizadas: null, estado_inicial: null, resultado_final: null }),
    ]
    const consulRows = [
      makeConsultoriaRow({ id: 'c1' }),
      makeConsultoriaRow({ id: 'c2' }),
      makeConsultoriaRow({ id: 'c3' }),
    ]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    // Only c1 has pregunta → PREGUNTAS DE LEADS should appear
    expect(result).toContain('PREGUNTAS DE LEADS')
    expect(result).toContain('¿Cómo escalar mi empresa?')

    // Only c2 has motivo → MOTIVOS DE CONSULTA should appear
    expect(result).toContain('MOTIVOS DE CONSULTA')
    expect(result).toContain('Crecimiento empresarial')

    // c3 has nothing → should NOT produce extra empty lines
  })

  // ── TRIANGULATE: text exactly at 200 chars — no truncation ─────────────────
  it('does NOT truncate or append "..." when text is exactly 200 chars', async () => {
    const exact200 = 'X'.repeat(200)

    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', pregunta: exact200 }),
    ]
    const consulRows = [makeConsultoriaRow({ id: 'c1' })]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    // Full text should be present without truncation marker
    expect(result).toContain(exact200)
    // Should NOT have the truncation ellipsis appended
    expect(result).not.toContain(exact200 + '...')
  })

  // ── TRIANGULATE: text at 199 chars — no truncation ─────────────────────────
  it('does NOT truncate text under 200 chars', async () => {
    const under200 = 'Y'.repeat(199)

    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', pregunta: under200 }),
    ]
    const consulRows = [makeConsultoriaRow({ id: 'c1' })]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    expect(result).toContain(under200)
    // No truncation marker anywhere for this field
    const preguntaIdx = result.indexOf(under200)
    const afterText = result.slice(preguntaIdx + under200.length, preguntaIdx + under200.length + 5)
    expect(afterText).not.toBe('...\n')
  })

  // ── TRIANGULATE: session sample cap at 30 (combined with existing fields) ──
  it('caps total session samples at 30 entries including existing fields', async () => {
    // Create 40 rows, each with pregunta (1 sample) + acciones_realizadas (1 sample) + estado_inicial (1 sample)
    // That's 3 samples per row → 120 total. Cap should limit to 30.
    const sesionRows = Array.from({ length: 40 }, (_, i) =>
      makeSesionRow({
        id_consultoria: `c${i}`,
        pregunta: `Pregunta ${i}`,
        motivo_consulta: `Motivo ${i}`,
        acciones_realizadas: `Accion ${i}`,
        estado_inicial: `Estado ${i}`,
        resultado_final: null,
      }),
    )
    const consulRows = sesionRows.map((s) =>
      makeConsultoriaRow({ id: s.id_consultoria }),
    )
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    // Count occurrences of "  - " (sample prefix) in the session section
    const sessionStart = result.indexOf('DADOS DE SESIÓN') !== -1
      ? result.indexOf('DADOS DE SESIÓN')
      : result.indexOf('DATOS DE SESIÓN')
    const sessionSection = result.slice(sessionStart)
    const sampleCount = (sessionSection.match(/  - /g) ?? []).length

    expect(sampleCount).toBeLessThanOrEqual(30)
  })
})

describe('buildImpactContext — estimacion_impacto enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('includes "IMPACTO ESTIMADO (muestra):" when a row has non-empty estimacion_impacto', async () => {
    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', estimacion_impacto: 'Ahorro de 20 horas semanales' }),
    ]
    const consulRows = [makeConsultoriaRow({ id: 'c1' })]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    expect(result).toContain('IMPACTO ESTIMADO (muestra):')
  })

  it('includes the truncated estimacion_impacto value in the output', async () => {
    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', estimacion_impacto: 'Reducción del 30% en costos operativos' }),
    ]
    const consulRows = [makeConsultoriaRow({ id: 'c1' })]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    expect(result).toContain('Reducción del 30% en costos operativos')
  })

  it('does NOT include "IMPACTO ESTIMADO (muestra):" when all estimacion_impacto are null', async () => {
    const sesionRows = [
      makeSesionRow({ id_consultoria: 'c1', estimacion_impacto: null, acciones_realizadas: null, estado_inicial: null, resultado_final: null }),
      makeSesionRow({ id_consultoria: 'c2', estimacion_impacto: null, acciones_realizadas: null, estado_inicial: null, resultado_final: null }),
    ]
    const consulRows = [
      makeConsultoriaRow({ id: 'c1' }),
      makeConsultoriaRow({ id: 'c2' }),
    ]
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    expect(result).not.toContain('IMPACTO ESTIMADO (muestra):')
  })

  it('total sample count stays ≤ 30 when all four categories are populated', async () => {
    const sesionRows = Array.from({ length: 40 }, (_, i) =>
      makeSesionRow({
        id_consultoria: `c${i}`,
        acciones_realizadas: `Accion ${i}`,
        pregunta: `Pregunta ${i}`,
        motivo_consulta: `Motivo ${i}`,
        estimacion_impacto: `Impacto ${i}`,
        estado_inicial: null,
        resultado_final: null,
      }),
    )
    const consulRows = sesionRows.map((s) =>
      makeConsultoriaRow({ id: s.id_consultoria }),
    )
    const supabase = makeMockSupabase({
      consultorias: consulRows,
      consultas_por_semana: [],
      registro_sesion: sesionRows,
    })

    const result = await buildImpactContext(supabase as never)

    const sessionStart = result.indexOf('DATOS DE SESIÓN')
    const sessionSection = sessionStart !== -1 ? result.slice(sessionStart) : result
    const sampleCount = (sessionSection.match(/  - /g) ?? []).length
    expect(sampleCount).toBeLessThanOrEqual(30)
  })
})
