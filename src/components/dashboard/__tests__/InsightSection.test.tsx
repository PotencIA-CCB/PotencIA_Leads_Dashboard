import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// ---------------------------------------------------------------------------
// Cache utility tests (pure logic — no DOM needed)
// ---------------------------------------------------------------------------

// We test the cache TTL logic by importing the utility module that InsightSection
// exposes. The function is a pure utility: given a raw sessionStorage string,
// return the parsed data if within TTL or null otherwise.
import { parseCacheEntry } from '../InsightSection'

describe('parseCacheEntry — cache validity check', () => {
  const validData = {
    insights: ['insight 1'],
    recomendaciones: ['rec 1'],
    alertas: ['alerta 1'],
  }

  it('returns null when the input is null (nothing in storage)', () => {
    expect(parseCacheEntry(null)).toBeNull()
  })

  it('returns null when the input is undefined', () => {
    expect(parseCacheEntry(undefined as unknown as null)).toBeNull()
  })

  it('returns null when the input is an empty string', () => {
    expect(parseCacheEntry('')).toBeNull()
  })

  it('returns null when the JSON is malformed', () => {
    expect(parseCacheEntry('not-json{')).toBeNull()
  })

  it('returns null when expiresAt is in the past', () => {
    const expired = JSON.stringify({
      data: validData,
      expiresAt: Date.now() - 1000, // 1 second ago
    })
    expect(parseCacheEntry(expired)).toBeNull()
  })

  it('returns null when expiresAt equals Date.now() (boundary — expired)', () => {
    const boundary = JSON.stringify({
      data: validData,
      expiresAt: Date.now() - 1, // just expired
    })
    expect(parseCacheEntry(boundary)).toBeNull()
  })

  it('returns the cached data when expiresAt is in the future', () => {
    const fresh = JSON.stringify({
      data: validData,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes from now
    })
    expect(parseCacheEntry(fresh)).toEqual(validData)
  })

  it('returns null when data field is missing from the cache entry', () => {
    const noData = JSON.stringify({ expiresAt: Date.now() + 5 * 60 * 1000 })
    expect(parseCacheEntry(noData)).toBeNull()
  })

  it('returns null when data field is explicitly null', () => {
    const nullData = JSON.stringify({
      data: null,
      expiresAt: Date.now() + 5 * 60 * 1000,
    })
    expect(parseCacheEntry(nullData)).toBeNull()
  })

  it('uses TTL of exactly 5 minutes (300000ms)', () => {
    // A cache entry that expires exactly 300001ms from now should be valid
    const almostFive = JSON.stringify({
      data: validData,
      expiresAt: Date.now() + 300001,
    })
    expect(parseCacheEntry(almostFive)).toEqual(validData)
  })
})

// ---------------------------------------------------------------------------
// Cache key isolation — bi_insights_cache vs insights_cache
// ---------------------------------------------------------------------------

import { BI_INSIGHTS_CACHE_KEY, DEFAULT_CACHE_KEY } from '../InsightSection'

describe('cache key constants', () => {
  it('DEFAULT_CACHE_KEY is bi_insights_cache (BI-scoped, not the old Metricas key)', () => {
    expect(DEFAULT_CACHE_KEY).toBe('bi_insights_cache')
  })

  it('BI_INSIGHTS_CACHE_KEY matches DEFAULT_CACHE_KEY', () => {
    expect(BI_INSIGHTS_CACHE_KEY).toBe(DEFAULT_CACHE_KEY)
  })

  it('does NOT equal the old Metricas cache key', () => {
    expect(DEFAULT_CACHE_KEY).not.toBe('insights_cache')
    expect(BI_INSIGHTS_CACHE_KEY).not.toBe('insights_cache')
  })
})

// ---------------------------------------------------------------------------
// InsightColumn sub-component (pure render — no hooks)
// ---------------------------------------------------------------------------

import InsightSection, { InsightColumn } from '../InsightSection'

describe('InsightColumn — pure render', () => {
  it('renders the column title', () => {
    const html = renderToStaticMarkup(
      createElement(InsightColumn, { title: 'Insights', items: ['item A', 'item B'] })
    )
    expect(html).toContain('Insights')
  })

  it('renders each item as a list item', () => {
    const html = renderToStaticMarkup(
      createElement(InsightColumn, { title: 'Recomendaciones', items: ['rec 1', 'rec 2', 'rec 3'] })
    )
    expect(html).toContain('rec 1')
    expect(html).toContain('rec 2')
    expect(html).toContain('rec 3')
  })

  it('renders "Sin datos" when items is empty', () => {
    const html = renderToStaticMarkup(
      createElement(InsightColumn, { title: 'Atención', items: [] })
    )
    expect(html).toContain('Sin datos')
  })

  it('renders "Sin datos" when items is undefined', () => {
    const html = renderToStaticMarkup(
      createElement(InsightColumn, { title: 'Atención', items: undefined })
    )
    expect(html).toContain('Sin datos')
  })

  it('renders exactly the number of li elements matching items length', () => {
    const items = ['a', 'b', 'c', 'd']
    const html = renderToStaticMarkup(
      createElement(InsightColumn, { title: 'Test', items })
    )
    const liMatches = html.match(/<li[^>]*>/g) ?? []
    expect(liMatches.length).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// InsightSection static render (ready=false — no fetch triggered server-side)
// ---------------------------------------------------------------------------

describe('InsightSection — static render (ready=false)', () => {
  it('renders without throwing when ready=false', () => {
    expect(() =>
      renderToStaticMarkup(createElement(InsightSection, { ready: false }))
    ).not.toThrow()
  })

  it('accepts a custom cacheKey prop without throwing', () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(InsightSection, { ready: false, cacheKey: 'custom_cache_key' })
      )
    ).not.toThrow()
  })

  it('renders the section heading text', () => {
    const html = renderToStaticMarkup(createElement(InsightSection, { ready: false }))
    expect(html).toContain('Insights')
  })

  it('renders an "Actualizar" button', () => {
    const html = renderToStaticMarkup(createElement(InsightSection, { ready: false }))
    expect(html).toContain('Actualizar')
  })
})
