/**
 * TDD tests for tools-extraction.ts — pure helper functions.
 *
 * Covers the pure exported seams only (no IO, no Supabase, no fetch):
 *   - canonicalizeLabel: case/whitespace folding
 *   - mergeCanonical: dedup + count sum + sort desc
 *   - parseToolsResponse: LLM JSON → { label, count }[], handles fenced/prose/malformed
 *   - buildToolsPrompt: prompt shape, rules present, sample cap, empty input
 *
 * Spec scenarios addressed:
 *   1.1 variants collapse to one label
 *   1.2 distinct tools stay separate
 *   1.3 null/empty acciones skipped
 *   1.4 no tools mentioned → no entry
 *   1.5 duplicate variant within one record → count=1 for that record
 *   1.6 no records → []
 */

import { describe, it, expect } from 'vitest'
import {
  canonicalizeLabel,
  mergeCanonical,
  parseToolsResponse,
  buildToolsPrompt,
} from '../tools-extraction'

// ─── canonicalizeLabel ────────────────────────────────────────────────────────

describe('canonicalizeLabel', () => {
  // RED 1 — trims surrounding whitespace
  it('trims leading and trailing whitespace', () => {
    expect(canonicalizeLabel('  ChatGPT  ')).toBe('ChatGPT')
  })

  // RED 2 — collapses internal whitespace (multiple spaces → single space)
  it('collapses multiple internal spaces to a single space', () => {
    expect(canonicalizeLabel('Google  Sheets')).toBe('Google Sheets')
  })

  // TRIANGULATE — empty string after trim → empty string
  it('returns empty string when input is only whitespace', () => {
    expect(canonicalizeLabel('   ')).toBe('')
  })

  // TRIANGULATE — already clean label passes through unchanged
  it('returns the same string for an already clean label', () => {
    expect(canonicalizeLabel('Canva')).toBe('Canva')
  })

  // TRIANGULATE — tabs and mixed whitespace collapsed
  it('collapses tab characters and mixed whitespace', () => {
    expect(canonicalizeLabel('\tCanva\t')).toBe('Canva')
  })
})

// ─── mergeCanonical ───────────────────────────────────────────────────────────

describe('mergeCanonical', () => {
  // RED 1 — items with identical labels are merged, counts summed
  it('merges items with the same label and sums their counts', () => {
    const items = [
      { label: 'ChatGPT', count: 3 },
      { label: 'ChatGPT', count: 5 },
    ]
    const result = mergeCanonical(items)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ label: 'ChatGPT', count: 8 })
  })

  // RED 2 — distinct labels are kept separate
  it('keeps distinct labels as separate entries', () => {
    const items = [
      { label: 'Canva', count: 2 },
      { label: 'Gemini', count: 4 },
      { label: 'Excel', count: 1 },
    ]
    const result = mergeCanonical(items)
    expect(result).toHaveLength(3)
  })

  // RED 3 — result is sorted by count descending
  it('returns items sorted by count descending', () => {
    const items = [
      { label: 'Excel', count: 1 },
      { label: 'ChatGPT', count: 9 },
      { label: 'Canva', count: 4 },
    ]
    const result = mergeCanonical(items)
    expect(result[0].label).toBe('ChatGPT')
    expect(result[1].label).toBe('Canva')
    expect(result[2].label).toBe('Excel')
  })

  // TRIANGULATE — tie-break: equal counts sorted by label ascending
  it('sorts by label ascending when counts are equal (deterministic tie-break)', () => {
    const items = [
      { label: 'Notion', count: 5 },
      { label: 'Canva', count: 5 },
    ]
    const result = mergeCanonical(items)
    expect(result[0].label).toBe('Canva')
    expect(result[1].label).toBe('Notion')
  })

  // TRIANGULATE — empty array → empty array
  it('returns an empty array for empty input', () => {
    const result = mergeCanonical([])
    expect(result).toEqual([])
  })

  // TRIANGULATE — label equality is case-sensitive (LLM already canonicalized; this is the merge layer)
  it('treats "chatgpt" and "ChatGPT" as different labels (case-sensitive merge)', () => {
    const items = [
      { label: 'chatgpt', count: 2 },
      { label: 'ChatGPT', count: 3 },
    ]
    const result = mergeCanonical(items)
    // mergeCanonical is the post-canonicalization layer — labels should already be normalized
    // but it must NOT silently fold them; that's canonicalizeLabel's job
    expect(result).toHaveLength(2)
  })
})

// ─── parseToolsResponse ───────────────────────────────────────────────────────

describe('parseToolsResponse', () => {
  // RED 1 — plain JSON with herramientas array
  it('parses a clean LLM JSON response with herramientas array', () => {
    const input = JSON.stringify({
      herramientas: [
        { label: 'ChatGPT', count: 9 },
        { label: 'Canva', count: 3 },
      ],
    })
    const result = parseToolsResponse(input)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ label: 'ChatGPT', count: 9 })
    expect(result[1]).toEqual({ label: 'Canva', count: 3 })
  })

  // RED 2 — JSON wrapped in prose (LLM adds explanation)
  it('extracts herramientas from JSON wrapped in prose text', () => {
    const input = 'Aquí está el resultado: {"herramientas":[{"label":"Gemini","count":2}]} Listo.'
    const result = parseToolsResponse(input)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ label: 'Gemini', count: 2 })
  })

  // RED 3 — markdown-fenced JSON
  it('strips markdown fences and parses the JSON', () => {
    const input = '```json\n{"herramientas":[{"label":"Notion","count":4}]}\n```'
    const result = parseToolsResponse(input)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ label: 'Notion', count: 4 })
  })

  // RED 4 — malformed / no JSON → empty array (never throws)
  it('returns an empty array when the input has no JSON', () => {
    const result = parseToolsResponse('No JSON here at all')
    expect(result).toEqual([])
  })

  // RED 5 — unbalanced JSON → empty array
  it('returns an empty array for unbalanced/malformed JSON', () => {
    const result = parseToolsResponse('{"herramientas":[{"label":"X"')
    expect(result).toEqual([])
  })

  // TRIANGULATE — count is coerced to non-negative integer
  it('coerces float counts to integers', () => {
    const input = JSON.stringify({ herramientas: [{ label: 'Excel', count: 3.7 }] })
    const result = parseToolsResponse(input)
    expect(result[0].count).toBe(3)
  })

  // TRIANGULATE — negative count is clamped to 0 (spec: count >= 0, but drop if < 1 per spec shape)
  it('drops entries with count less than 1 after coercion', () => {
    const input = JSON.stringify({ herramientas: [{ label: 'Canva', count: 0 }, { label: 'Excel', count: 2 }] })
    const result = parseToolsResponse(input)
    // count: 0 is dropped (spec: count >= 1 in output shape)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Excel')
  })

  // TRIANGULATE — empty label is dropped
  it('drops entries with empty or whitespace-only labels', () => {
    const input = JSON.stringify({ herramientas: [{ label: '', count: 5 }, { label: '   ', count: 3 }, { label: 'Canva', count: 2 }] })
    const result = parseToolsResponse(input)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Canva')
  })

  // TRIANGULATE — herramientas array absent → empty array
  it('returns empty array when herramientas key is missing from the JSON', () => {
    const input = JSON.stringify({ other_key: [] })
    const result = parseToolsResponse(input)
    expect(result).toEqual([])
  })

  // TRIANGULATE — herramientas is empty array → empty array returned
  it('returns empty array when herramientas is an empty array', () => {
    const input = JSON.stringify({ herramientas: [] })
    const result = parseToolsResponse(input)
    expect(result).toEqual([])
  })
})

// ─── buildToolsPrompt ─────────────────────────────────────────────────────────

describe('buildToolsPrompt', () => {
  // RED 1 — contains canonicalization rules
  it('includes canonicalization rule instruction in the prompt', () => {
    const prompt = buildToolsPrompt(['usé ChatGPT', 'trabajé con Canva'])
    expect(prompt).toContain('NORMALIZA')
  })

  // RED 2 — contains explicit no-hallucination rule
  it('includes a no-hallucination rule ("NO inventes")', () => {
    const prompt = buildToolsPrompt(['usé ChatGPT'])
    expect(prompt).toContain('NO inventes')
  })

  // RED 3 — contains the acciones text in the prompt body
  it('includes the provided acciones text in the prompt', () => {
    const prompt = buildToolsPrompt(['usé ChatGPT', 'trabajé con Canva'])
    expect(prompt).toContain('usé ChatGPT')
    expect(prompt).toContain('trabajé con Canva')
  })

  // RED 4 — empty input array produces a valid prompt (no crash)
  it('returns a non-empty prompt string even for empty acciones input (scenario 1.6)', () => {
    const prompt = buildToolsPrompt([])
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })

  // TRIANGULATE — specifies the expected JSON output shape
  it('specifies the expected herramientas JSON output shape in the prompt', () => {
    const prompt = buildToolsPrompt(['usé Gemini'])
    expect(prompt).toContain('herramientas')
    expect(prompt).toContain('label')
    expect(prompt).toContain('count')
  })

  // TRIANGULATE — sample cap: prompts built from >80 entries are truncated to at most 80 samples
  it('caps included samples to at most 80 when more than 80 acciones are provided', () => {
    const manyAcciones = Array.from({ length: 120 }, (_, i) => `Acción ${i}: usé ChatGPT`)
    const prompt = buildToolsPrompt(manyAcciones)
    // Each accion is "Acción N: usé ChatGPT" — count occurrences of "Acción "
    const matches = prompt.match(/Acción \d+/g) ?? []
    expect(matches.length).toBeLessThanOrEqual(80)
  })

  // TRIANGULATE — individual samples are truncated at 200 chars
  it('truncates individual sample texts to 200 characters', () => {
    const longText = 'A'.repeat(300)
    const prompt = buildToolsPrompt([longText])
    expect(prompt).not.toContain(longText)           // full 300-char text not present
    expect(prompt).toContain('A'.repeat(200))         // first 200 chars are present
  })
})
