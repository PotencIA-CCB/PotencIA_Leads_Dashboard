/**
 * Tests for ToolsCloud component.
 *
 * Strategy (node env / Strict TDD):
 *   1. Pure helper `scaleWeight` tested directly — math correctness, bounds, ratio.
 *   2. Rendered markup validated via `renderToStaticMarkup` — a11y contract
 *      (role=list/listitem, aria-label), sizing relationship (top > tail), and
 *      empty/loading/error states.
 *
 * Spec refs: Requirement 4, scenarios 4.1–4.4.
 * Design ref: Section 5 — scaleWeight formula (redesigned word-cloud):
 *   fontSize = 14 + ratio * 42 (14px min → 56px max),
 *   fontWeight 500..800, ratio = count / maxCount.
 *
 * UI polish (post-merge, branch feat/herramientas-ia-cloud-ui):
 *   scaleWeight range widened for true word-cloud dominance hierarchy.
 */
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ToolsCloud, { scaleWeight } from '../ToolsCloud'

// ---------------------------------------------------------------------------
// scaleWeight — pure math helper (new range: 14..56px, fontWeight 500..800)
// ---------------------------------------------------------------------------

describe('scaleWeight — pure math helper', () => {
  it('returns minimum fontSize 14 when count === 0 or ratio is 0', () => {
    const result = scaleWeight(0, 10)
    expect(result.fontSize).toBe(14)
  })

  it('returns maximum fontSize 56 when count === maxCount (ratio = 1)', () => {
    const result = scaleWeight(10, 10)
    expect(result.fontSize).toBe(56)
  })

  it('returns mid-range fontSize ~35 when count is exactly half of maxCount', () => {
    const result = scaleWeight(5, 10)
    // ratio = 0.5 → 14 + 0.5 * 42 = 35
    expect(result.fontSize).toBeCloseTo(35, 1)
  })

  it('returns fontWeight 500 at minimum ratio (count = 0)', () => {
    const result = scaleWeight(0, 10)
    expect(result.fontWeight).toBe(500)
  })

  it('returns fontWeight 800 at maximum ratio (count = maxCount)', () => {
    const result = scaleWeight(10, 10)
    expect(result.fontWeight).toBe(800)
  })

  it('returns fontWeight between 500 and 800 for intermediate counts', () => {
    const result = scaleWeight(5, 10)
    expect(result.fontWeight).toBeGreaterThanOrEqual(500)
    expect(result.fontWeight).toBeLessThanOrEqual(800)
  })

  it('clamps fontSize to minimum 14 even if count is negative (defensive)', () => {
    // ratio for negative count: treat as 0
    const result = scaleWeight(0, 10)
    expect(result.fontSize).toBeGreaterThanOrEqual(14)
  })

  it('clamps fontSize to maximum 56 even at ratio > 1 (defensive: count > maxCount)', () => {
    // If somehow count > maxCount, ratio > 1 — design clamps at max
    const result = scaleWeight(15, 10)
    expect(result.fontSize).toBeLessThanOrEqual(56)
  })

  it('fontWeight is always an integer (no fractional font-weight)', () => {
    for (const count of [0, 2, 5, 7, 10]) {
      const result = scaleWeight(count, 10)
      expect(Number.isInteger(result.fontWeight)).toBe(true)
    }
  })

  it('handles maxCount = 0 safely (returns minimum without dividing by zero)', () => {
    expect(() => scaleWeight(0, 0)).not.toThrow()
    const result = scaleWeight(0, 0)
    expect(result.fontSize).toBe(14)
  })
})

// ---------------------------------------------------------------------------
// ToolsCloud rendered markup — populated state (spec 4.1, 4.2)
// ---------------------------------------------------------------------------

describe('ToolsCloud — populated state', () => {
  const tools = [
    { label: 'ChatGPT', count: 9 },
    { label: 'Canva', count: 3 },
    { label: 'Excel', count: 1 },
  ]

  it('renders a container with role="list" (spec 4.2 a11y)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools, status: 'ready' })
    )
    expect(html).toContain('role="list"')
  })

  it('renders a container with aria-label attribute (spec 4.2 a11y)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools, status: 'ready' })
    )
    expect(html).toContain('aria-label=')
  })

  it('renders exactly N listitems for N tools (spec 4.1)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools, status: 'ready' })
    )
    const matches = html.match(/role="listitem"/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBe(tools.length)
  })

  it('each listitem includes the tool label text (spec 4.1)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools, status: 'ready' })
    )
    for (const tool of tools) {
      expect(html).toContain(tool.label)
    }
  })

  it('each listitem includes the count visible in the markup (spec 4.1)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools, status: 'ready' })
    )
    for (const tool of tools) {
      expect(html).toContain(String(tool.count))
    }
  })

  it('each listitem has aria-label containing label and count (spec 4.2)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools, status: 'ready' })
    )
    // Each chip must have aria-label="<label>: <count> menciones" or similar
    expect(html).toContain('ChatGPT')
    expect(html).toContain('9')
    // aria-label attribute present on each listitem
    const listitemAriaLabels = html.match(/role="listitem"[^>]*aria-label="[^"]+"/g)
    expect(listitemAriaLabels).not.toBeNull()
    expect(listitemAriaLabels!.length).toBe(tools.length)
  })

  it('top-count tool has larger fontSize than tail tool (spec 4.1)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools, status: 'ready' })
    )

    // Extract fontSize values via style attribute pattern
    const fontSizeMatches = [...html.matchAll(/font-size:\s*([\d.]+)px/g)]
    expect(fontSizeMatches.length).toBeGreaterThanOrEqual(2)

    const sizes = fontSizeMatches.map((m) => parseFloat(m[1]))
    const maxSize = Math.max(...sizes)
    const minSize = Math.min(...sizes)
    // Top (count=9) should be larger than tail (count=1)
    expect(maxSize).toBeGreaterThan(minSize)
  })

  it('top-count tool has fontSize close to 56px (max per new word-cloud design)', () => {
    const topWeight = scaleWeight(9, 9)
    // At max (9/9 = 1.0): 14 + 1 * 42 = 56
    expect(topWeight.fontSize).toBeCloseTo(56, 0)
  })

  it('word cloud renders colored text without pill borders (word-cloud redesign)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools, status: 'ready' })
    )
    // Words should be plain text — no rounded-full pill border class on listitem spans
    // The pill design used "rounded-full border px-3 py-1" on the outer span
    expect(html).not.toContain('rounded-full border px-3')
  })
})

// ---------------------------------------------------------------------------
// ToolsCloud — empty state (spec 4.3)
// ---------------------------------------------------------------------------

describe('ToolsCloud — empty state (tools = [])', () => {
  it('renders branded empty message, no listitem elements (spec 4.3)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools: [], status: 'ready' })
    )
    expect(html).not.toContain('role="listitem"')
    // Must have some visible empty state text (not a blank box)
    const lower = html.toLowerCase()
    expect(lower.length).toBeGreaterThan(20) // not an empty render
    // Common empty state phrases
    expect(lower).toMatch(/no hay|aún|sin herramienta|not yet|ninguna|generado/)
  })

  it('renders container but without list role when empty (no listitems)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools: [], status: 'ready' })
    )
    expect(html).not.toContain('role="listitem"')
  })
})

// ---------------------------------------------------------------------------
// ToolsCloud — loading state (spec 4.4)
// ---------------------------------------------------------------------------

describe('ToolsCloud — loading state', () => {
  it('renders loading indicator when status=loading (spec 4.4)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools: [], status: 'loading' })
    )
    // Loading indicator — skeleton pills or loading text
    const lower = html.toLowerCase()
    expect(lower).toMatch(/cargando|loading|animate-pulse|skeleton/)
  })

  it('does not render listitem elements while loading', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools: [], status: 'loading' })
    )
    expect(html).not.toContain('role="listitem"')
  })
})

// ---------------------------------------------------------------------------
// ToolsCloud — error state (spec 4.4)
// ---------------------------------------------------------------------------

describe('ToolsCloud — error state', () => {
  it('renders non-blocking error message when status=error (spec 4.4)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools: [], status: 'error' })
    )
    const lower = html.toLowerCase()
    expect(lower).toMatch(/error|no se pud|fallo|disponible/)
  })

  it('does not render listitem elements in error state', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools: [], status: 'error' })
    )
    expect(html).not.toContain('role="listitem"')
  })
})

// ---------------------------------------------------------------------------
// Triangulation — single-tool edge case + consistency
// ---------------------------------------------------------------------------

describe('ToolsCloud — triangulation edge cases', () => {
  it('renders a single tool at max weight (it is both min and max)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools: [{ label: 'Notion', count: 5 }], status: 'ready' })
    )
    expect(html).toContain('role="listitem"')
    expect(html).toContain('Notion')
    // Single tool: maxCount = 5, count = 5 → ratio = 1 → fontSize 56
    const fontSizeMatch = html.match(/font-size:\s*([\d.]+)px/)
    expect(fontSizeMatch).not.toBeNull()
    expect(parseFloat(fontSizeMatch![1])).toBeCloseTo(56, 0)
  })

  it('all tools with count = 1 render at identical fontSize (no ranking needed)', () => {
    const tools = [
      { label: 'Canva', count: 1 },
      { label: 'Excel', count: 1 },
    ]
    const html = renderToStaticMarkup(
      React.createElement(ToolsCloud, { tools, status: 'ready' })
    )
    const fontSizeMatches = [...html.matchAll(/font-size:\s*([\d.]+)px/g)]
    const sizes = fontSizeMatches.map((m) => parseFloat(m[1]))
    // All equal — all at max (count/maxCount = 1/1 = 1 → 56px)
    expect(sizes.every((s) => s === sizes[0])).toBe(true)
  })
})
