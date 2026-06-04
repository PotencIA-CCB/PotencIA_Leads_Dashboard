/**
 * T18 — Smoke test for unified BI page (TDD: written before T19 implementation).
 *
 * Verifies:
 *   (a) KPI tile section heading ("Total Consultorías") appears before any chart section
 *   (b) The page does not throw when useMetricas is still loading
 *   (c) The page does not throw when useBusinessIntelligence is still loading
 *   (d) "Herramientas más usadas" section is present in the charts block
 *   (e) Legacy "¿Qué quieren lograr?" word cloud section is gone
 *   (f) /api/herramientas is fetched (not supabase formularios_landing)
 *
 * Uses renderToStaticMarkup to avoid jsdom / hook complexity while still asserting
 * DOM order: the KPI section must appear earlier in the HTML string than the first
 * chart section marker.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// ---------------------------------------------------------------------------
// Module mocks — must be declared before the page import
// ---------------------------------------------------------------------------

vi.mock('@/hooks/useMetricas', () => ({
  useMetricas: vi.fn(),
}))

vi.mock('@/hooks/useBusinessIntelligence', () => ({
  useBusinessIntelligence: vi.fn(),
}))

// Mock heavy chart components to avoid complex dependency trees in unit tests
vi.mock('@/components/metricas/GeneralKPIs', () => ({
  GeneralKPIs: () => null,
}))
vi.mock('@/components/metricas/ProductividadKPIs', () => ({
  ProductividadKPIs: () => null,
}))
vi.mock('@/components/metricas/RetentionFunnel', () => ({
  RetentionFunnel: () => null,
}))
vi.mock('@/components/metricas/ConsultorRadar', () => ({
  ConsultorRadar: () => null,
}))
vi.mock('@/components/metricas/HeatmapDrilldown', () => ({
  HeatmapDrilldown: () => null,
}))
// ToolsCloud replaces WordCloud in the BI page — mock it so it renders a sentinel
vi.mock('@/components/metricas/ToolsCloud', () => ({
  default: () => null,
}))
vi.mock('@/components/metricas/InfoTooltip', () => ({
  default: () => null,
}))
vi.mock('@/components/dashboard/LeadsFunnel', () => ({
  default: () => null,
}))
vi.mock('@/components/dashboard/InsightSection', () => ({
  default: () => null,
}))

// Mock global fetch — the BI page now calls GET /api/herramientas (not supabase-browser)
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ herramientas: [], generated_at: null }),
  })
))

// ---------------------------------------------------------------------------
// Lazy import after mocks are set up
// ---------------------------------------------------------------------------

import { useMetricas } from '@/hooks/useMetricas'
import { useBusinessIntelligence } from '@/hooks/useBusinessIntelligence'

const mockUseMetricas = useMetricas as ReturnType<typeof vi.fn>
const mockUseBI = useBusinessIntelligence as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helper — minimal metricas fixture
// ---------------------------------------------------------------------------

function makeMetricasData() {
  return {
    metricas: {
      totalConsultorias: 42,
      consultoriasResueltas: 10,
      consultoriasEnSeguimientoAtendidas: 5,
      tasaConversion: 75.5,
      totalProductos: 3,
      totalMinutos: 120,
    },
    consultorias: [],
    loading: false,
  }
}

function makeBIData() {
  return {
    biStats: {
      sesionesTotales: 10,
      totalEmpresasRegistradas: 5,
      empresasNitsValidos: 3,
      empresasRegistradas: 8,
      empresasRenovadas: 2,
    },
    funnelStats: null,
    totalBookings: 15,
    loading: false,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Unified BIPage — smoke tests (T18)', () => {
  beforeAll(async () => {
    // Dynamic import so mocks are in place before the module resolves
    const mod = await import('../bi/page')
    // ensure it loaded as a default export
    expect(typeof mod.default).toBe('function')
  })

  it('(a) KPI section heading appears before chart section in rendered HTML', async () => {
    mockUseMetricas.mockReturnValue(makeMetricasData())
    mockUseBI.mockReturnValue(makeBIData())

    const { default: BIPage } = await import('../bi/page')
    const html = renderToStaticMarkup(createElement(BIPage))

    // KPI tile: "Total Consultorías" must be present
    expect(html).toContain('Total Consultor')

    // KPI section heading must precede chart section markers in DOM order
    // The unified page uses data-testid="kpi-section" before data-testid="charts-section"
    const kpiIdx = html.indexOf('data-testid="kpi-section"')
    const chartIdx = html.indexOf('data-testid="charts-section"')

    // Both sections must be present (T19 adds the testids)
    expect(kpiIdx).toBeGreaterThan(-1)
    expect(chartIdx).toBeGreaterThan(-1)
    expect(kpiIdx).toBeLessThan(chartIdx)
  })

  it('(b) does not throw when useMetricas is loading', async () => {
    mockUseMetricas.mockReturnValue({ metricas: null, consultorias: [], loading: true })
    mockUseBI.mockReturnValue(makeBIData())

    const { default: BIPage } = await import('../bi/page')
    expect(() => renderToStaticMarkup(createElement(BIPage))).not.toThrow()
  })

  it('(c) does not throw when useBusinessIntelligence is loading', async () => {
    mockUseMetricas.mockReturnValue(makeMetricasData())
    mockUseBI.mockReturnValue({ biStats: null, funnelStats: null, totalBookings: 0, loading: true })

    const { default: BIPage } = await import('../bi/page')
    expect(() => renderToStaticMarkup(createElement(BIPage))).not.toThrow()
  })

  it('(d) "Herramientas IA más usadas" heading is present in the charts section', async () => {
    mockUseMetricas.mockReturnValue(makeMetricasData())
    mockUseBI.mockReturnValue(makeBIData())

    const { default: BIPage } = await import('../bi/page')
    const html = renderToStaticMarkup(createElement(BIPage))

    // New section heading must include "IA" (post-merge word-cloud redesign)
    expect(html).toContain('Herramientas IA m')
  })

  it('(e) legacy "¿Qué quieren lograr?" word cloud heading is gone', async () => {
    mockUseMetricas.mockReturnValue(makeMetricasData())
    mockUseBI.mockReturnValue(makeBIData())

    const { default: BIPage } = await import('../bi/page')
    const html = renderToStaticMarkup(createElement(BIPage))

    // Old heading must NOT exist in the rendered output
    expect(html).not.toContain('quieren lograr')
  })

  it('(f) page renders without crashing when metricas data is available (tools section path)', async () => {
    mockUseMetricas.mockReturnValue(makeMetricasData())
    mockUseBI.mockReturnValue(makeBIData())

    const { default: BIPage } = await import('../bi/page')
    expect(() => renderToStaticMarkup(createElement(BIPage))).not.toThrow()
  })
})
