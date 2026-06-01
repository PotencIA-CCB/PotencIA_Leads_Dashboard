import { describe, it, expect } from 'vitest'
import { filterByAiTerms, type WordData } from '../../lib/wordcloud-filter'

describe('filterByAiTerms', () => {
  // Spec scenario: "Matched AI term passes through" (R5, R6)
  it('passes an AI term through unchanged', () => {
    const input: WordData[] = [{ text: 'automatizacion', count: 5 }]
    const result = filterByAiTerms(input)
    expect(result).toEqual([{ text: 'automatizacion', count: 5 }])
  })

  // Spec scenario: "Non-AI word is excluded" (R8)
  it('excludes non-AI words and keeps AI words', () => {
    const input: WordData[] = [
      { text: 'empresa', count: 3 },
      { text: 'chatbot', count: 7 },
    ]
    const result = filterByAiTerms(input)
    expect(result).toEqual([{ text: 'chatbot', count: 7 }])
  })

  // Accent-stripping is done by processText() upstream — input is already accent-free
  // Verify "automatizacion" (stripped form) matches allowlist (R7)
  it('matches accent-free input (processText strips accents upstream)', () => {
    const input: WordData[] = [{ text: 'automatizacion', count: 4 }]
    const result = filterByAiTerms(input)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('automatizacion')
  })

  // Spec scenario: "Empty input array" (R11)
  it('returns [] for empty input without throwing', () => {
    expect(filterByAiTerms([])).toEqual([])
  })

  // Spec scenario: "No tokens match allowlist"
  it('returns [] when no tokens match allowlist', () => {
    const input: WordData[] = [
      { text: 'empresa', count: 3 },
      { text: 'ventas', count: 2 },
      { text: 'reuniones', count: 1 },
    ]
    expect(filterByAiTerms(input)).toEqual([])
  })

  // R9: input array must not be mutated
  it('does not mutate the input array', () => {
    const input: WordData[] = [
      { text: 'empresa', count: 3 },
      { text: 'inteligencia', count: 5 },
    ]
    const copy = input.map((w) => ({ ...w }))
    filterByAiTerms(input)
    expect(input).toEqual(copy)
  })

  // R12: filterByAiTerms preserves counts as-is (dedup is processText's responsibility)
  it('preserves count values from input as-is', () => {
    const input: WordData[] = [
      { text: 'artificial', count: 10 },
      { text: 'asistente', count: 3 },
    ]
    const result = filterByAiTerms(input)
    expect(result).toHaveLength(2)
    const artificial = result.find((w) => w.text === 'artificial')
    const asistente = result.find((w) => w.text === 'asistente')
    expect(artificial?.count).toBe(10)
    expect(asistente?.count).toBe(3)
  })

  // Case-insensitive matching (processText Title-cases output, so "Agentes" is common)
  it('matches Title-cased tokens case-insensitively', () => {
    const input: WordData[] = [
      { text: 'Agentes', count: 6 },
      { text: 'Inteligencia', count: 4 },
      { text: 'Empresa', count: 2 },
    ]
    const result = filterByAiTerms(input)
    expect(result).toHaveLength(2)
    expect(result.map((w) => w.text)).toContain('Agentes')
    expect(result.map((w) => w.text)).toContain('Inteligencia')
  })

  // stem startsWith matching: "Automatizar" should match via "automatiz" stem
  it('matches inflected forms via stem startsWith', () => {
    const input: WordData[] = [
      { text: 'Automatizar', count: 3 },
      { text: 'Digitalizacion', count: 2 },
    ]
    const result = filterByAiTerms(input)
    expect(result).toHaveLength(2)
  })
})
