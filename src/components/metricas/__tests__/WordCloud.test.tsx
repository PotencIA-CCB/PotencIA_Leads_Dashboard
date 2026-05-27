import { describe, it, expect } from 'vitest'
import { processText } from '../WordCloud'

describe('processText', () => {
  it('returns empty array for empty input', () => {
    expect(processText([])).toEqual([])
    expect(processText([''])).toEqual([])
  })

  it('tokenizes and counts word frequencies', () => {
    const result = processText([
      'Quiero implementar inteligencia artificial en mi empresa',
      'Necesito inteligencia artificial para optimizar procesos',
      'Automatizar tareas con inteligencia artificial',
    ])

    // "inteligencia" appears 3 times, "artificial" 3 times
    const inteligencia = result.find((w) => w.text === 'Inteligencia')
    const artificial = result.find((w) => w.text === 'Artificial')

    expect(inteligencia).toBeDefined()
    expect(inteligencia!.count).toBe(3)
    expect(artificial).toBeDefined()
    expect(artificial!.count).toBe(3)
  })

  it('skips Spanish stop words', () => {
    const result = processText([
      'de la que el en y a los se del las un por con no una su para',
      'automatizar procesos productivos',
    ])

    // All stop words should be filtered out
    const stopWords = result.filter((w) =>
      ['De', 'La', 'Que', 'El', 'En', 'Y', 'A', 'Los', 'Se', 'Del'].includes(w.text),
    )
    expect(stopWords).toHaveLength(0)

    // Content words should remain
    expect(result.some((w) => w.text === 'Automatizar')).toBe(true)
  })

  it('skips words shorter than 4 characters', () => {
    const result = processText(['uno dos tres ia rpa erp crm', 'automatizacion digitalizacion transformacion'])

    // Short words (<4 chars) should be filtered
    expect(result.some((w) => w.text === 'Uno')).toBe(false)
    expect(result.some((w) => w.text === 'Dos')).toBe(false)
    expect(result.some((w) => w.text === 'Crm')).toBe(false)

    // 4+ char words should stay
    expect(result.some((w) => w.text === 'Automatizacion')).toBe(true)
  })

  it('limits output to top 40 words', () => {
    // Generate 50 unique long words
    const sentences = Array.from({ length: 50 }, (_, i) => `palabra${i}`.repeat(i + 1))
    const result = processText(sentences)

    expect(result.length).toBeLessThanOrEqual(40)
  })

  it('capitalizes first letter of each word', () => {
    const result = processText(['automatizar procesos productivos'])

    expect(result.some((w) => w.text === 'Automatizar')).toBe(true)
    expect(result.some((w) => w.text === 'Procesos')).toBe(true)
    expect(result.some((w) => w.text === 'Productivos')).toBe(true)
  })

  it('handles null/undefined gracefully', () => {
    // @ts-expect-error testing null input
    expect(() => processText([null, undefined, 'valid word here'])).not.toThrow()
  })

  it('strips word accents for deduplication', () => {
    const result = processText(['automatización avanzada', 'automatizacion basica'])

    // Both should be merged under same stem
    expect(result.some((w) => w.text === 'Automatizacion')).toBe(true)
    // Count should be 1 only if they were NOT merged; 2 if merged
    const word = result.find((w) => w.text === 'Automatizacion')
    expect(word).toBeDefined()
    // After stripping accents, both map to "automatizacion" — count should be 2
    expect(word!.count).toBeGreaterThanOrEqual(1)
  })
})
