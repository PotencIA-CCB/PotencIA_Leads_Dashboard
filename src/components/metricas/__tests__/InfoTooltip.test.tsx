/**
 * Tests for InfoTooltip component.
 *
 * Strategy: Extract pure helper functions for testability (node env, no jsdom).
 * The component is a click/hover popover — its toggle logic is React state (not extractable).
 */
import { describe, it, expect } from 'vitest'
import { hasHelpText } from '../InfoTooltip'

describe('InfoTooltip — hasHelpText', () => {
  it('returns false for empty string', () => {
    expect(hasHelpText('')).toBe(false)
  })

  it('returns false for whitespace-only string', () => {
    expect(hasHelpText('   ')).toBe(false)
  })

  it('returns true for non-empty help text', () => {
    expect(hasHelpText('Total de consultorías en la tabla consultorias — COUNT(*)')).toBe(true)
  })

  it('returns true for short truthy text', () => {
    expect(hasHelpText('a')).toBe(true)
  })
})
