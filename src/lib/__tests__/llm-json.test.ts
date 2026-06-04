/**
 * TDD tests for llm-json.ts — shared balanced-JSON extraction and repair helpers.
 *
 * Covers:
 * - extractBalancedJSON: clean JSON, prose-wrapped JSON, fenced JSON, malformed/unbalanced → null
 * - repairJSON: trailing commas, newlines, carriage returns
 *
 * These helpers are extracted from src/app/api/insights/route.ts (ADR-4).
 * The insights route tests MUST remain green after extraction (behavior-preserving).
 */

import { describe, it, expect } from 'vitest'
import { extractBalancedJSON, repairJSON } from '../llm-json'

// ─── extractBalancedJSON ──────────────────────────────────────────────────────

describe('extractBalancedJSON', () => {
  // RED 1 — clean JSON object returned as-is (well, the balanced slice)
  it('returns the JSON object from a clean JSON string', () => {
    const input = '{"key":"value"}'
    const result = extractBalancedJSON(input)
    expect(result).toBe('{"key":"value"}')
  })

  // RED 2 — JSON wrapped in prose before and after
  it('extracts JSON object from a string with leading and trailing prose', () => {
    const input = 'Here is the result: {"herramientas":[{"label":"ChatGPT","count":5}]} Hope that helps!'
    const result = extractBalancedJSON(input)
    expect(result).toBe('{"herramientas":[{"label":"ChatGPT","count":5}]}')
  })

  // RED 3 — no JSON object → null
  it('returns null when the string has no opening brace', () => {
    const result = extractBalancedJSON('No JSON here at all')
    expect(result).toBeNull()
  })

  // RED 4 — unbalanced braces (opens but never closes) → null
  it('returns null for an unbalanced JSON string (opens but never closes)', () => {
    const result = extractBalancedJSON('{"key": "value"')
    expect(result).toBeNull()
  })

  // TRIANGULATE — nested objects are handled correctly
  it('handles nested objects by returning the outermost balanced JSON', () => {
    const input = 'prefix {"outer":{"inner":"val"}} suffix'
    const result = extractBalancedJSON(input)
    expect(result).toBe('{"outer":{"inner":"val"}}')
  })

  // TRIANGULATE — string containing braces inside string values (not confused as delimiters)
  it('does not count braces inside string values as structural delimiters', () => {
    const input = '{"key":"contains{brace}inside"}'
    const result = extractBalancedJSON(input)
    expect(result).toBe('{"key":"contains{brace}inside"}')
  })

  // TRIANGULATE — escaped quote inside string value
  it('handles escaped quotes inside string values without breaking balance tracking', () => {
    const input = '{"msg":"he said \\"hello\\""}'
    const result = extractBalancedJSON(input)
    expect(result).toBe('{"msg":"he said \\"hello\\""}')
  })

  // TRIANGULATE — markdown fenced JSON (fence already stripped by caller, but naked braces work)
  it('extracts JSON that was preceded by markdown fence text', () => {
    const input = '```json\n{"herramientas":[]}\n```'
    // extractBalancedJSON looks for the first '{' regardless of surrounding text
    const result = extractBalancedJSON(input)
    expect(result).toBe('{"herramientas":[]}')
  })

  // TRIANGULATE — empty string → null
  it('returns null for an empty string', () => {
    const result = extractBalancedJSON('')
    expect(result).toBeNull()
  })
})

// ─── repairJSON ───────────────────────────────────────────────────────────────

describe('repairJSON', () => {
  // RED 1 — trailing comma before closing brace
  it('removes trailing comma before a closing brace', () => {
    const input = '{"a":1,"b":2,}'
    const result = repairJSON(input)
    expect(result).toBe('{"a":1,"b":2}')
  })

  // RED 2 — trailing comma before closing bracket
  it('removes trailing comma before a closing bracket', () => {
    const input = '{"items":["x","y",]}'
    const result = repairJSON(input)
    expect(result).toBe('{"items":["x","y"]}')
  })

  // RED 3 — newlines replaced with spaces
  it('replaces newlines with spaces', () => {
    const input = '{"a":"line1\nline2"}'
    const result = repairJSON(input)
    expect(result).toBe('{"a":"line1 line2"}')
  })

  // TRIANGULATE — carriage returns removed
  it('removes carriage return characters', () => {
    const input = '{"a":"text\r\nmore"}'
    const result = repairJSON(input)
    // \r removed, \n replaced with space
    expect(result).toBe('{"a":"text more"}')
  })

  // TRIANGULATE — valid JSON passes through unchanged (except normalization)
  it('returns clean JSON unchanged (no commas or newlines to fix)', () => {
    const input = '{"label":"ChatGPT","count":9}'
    const result = repairJSON(input)
    expect(result).toBe('{"label":"ChatGPT","count":9}')
  })

  // TRIANGULATE — multiple trailing commas in same string
  it('removes all trailing commas in a single pass', () => {
    const input = '{"a":1,,"b":[1,2,],"c":{"d":3,}}'
    const result = repairJSON(input)
    // After repair: double comma becomes comma (only trailing one before } or ] removed)
    // ,, is not a trailing comma before } — it's between values — so only trailing ones are fixed
    expect(result).not.toContain(',}')
    expect(result).not.toContain(',]')
  })
})
