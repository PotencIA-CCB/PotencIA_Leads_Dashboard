/**
 * TDD — RED phase for paginate pure helper.
 * These tests must be RED until T14 implements the helper.
 */
import { describe, it, expect } from 'vitest'
import { paginate } from '../searchHelpers'

const items = Array.from({ length: 73 }, (_, i) => i + 1) // [1, 2, ..., 73]

describe('paginate — basic slicing', () => {
  it('returns the correct slice for page 1 with size 25', () => {
    const result = paginate(items, 1, 25)
    expect(result.slice).toHaveLength(25)
    expect(result.slice[0]).toBe(1)
    expect(result.slice[24]).toBe(25)
  })

  it('returns the correct slice for page 2 with size 25', () => {
    const result = paginate(items, 2, 25)
    expect(result.slice).toHaveLength(25)
    expect(result.slice[0]).toBe(26)
    expect(result.slice[24]).toBe(50)
  })

  it('returns the correct slice for the last partial page', () => {
    // page 3 of 73 items at size 25: items 51–73 (23 items)
    const result = paginate(items, 3, 25)
    expect(result.slice).toHaveLength(23)
    expect(result.slice[0]).toBe(51)
    expect(result.slice[22]).toBe(73)
  })

  it('returns empty array when page exceeds total pages', () => {
    const result = paginate(items, 10, 25) // only 3 pages exist
    expect(result.slice).toHaveLength(0)
  })
})

describe('paginate — totalPages calculation', () => {
  it('calculates totalPages correctly for 73 items at size 25', () => {
    expect(paginate(items, 1, 25).totalPages).toBe(3)
  })

  it('calculates totalPages as 1 when items fit exactly in one page', () => {
    const exact = Array.from({ length: 25 }, (_, i) => i)
    expect(paginate(exact, 1, 25).totalPages).toBe(1)
  })

  it('calculates totalPages as 1 for empty array', () => {
    expect(paginate([], 1, 25).totalPages).toBe(1)
  })

  it('calculates totalPages for size 50', () => {
    // 73 items, size 50: 2 pages
    expect(paginate(items, 1, 50).totalPages).toBe(2)
  })

  it('calculates totalPages for size 100', () => {
    // 73 items, size 100: 1 page
    expect(paginate(items, 1, 100).totalPages).toBe(1)
  })
})

describe('paginate — from/to labels', () => {
  it('computes correct from/to for page 1 of 73 items at size 25', () => {
    const result = paginate(items, 1, 25)
    expect(result.from).toBe(1)
    expect(result.to).toBe(25)
  })

  it('computes correct from/to for page 2 of 73 items at size 25', () => {
    const result = paginate(items, 2, 25)
    expect(result.from).toBe(26)
    expect(result.to).toBe(50)
  })

  it('computes correct from/to for the last partial page (page 3, 73 items, size 25)', () => {
    const result = paginate(items, 3, 25)
    expect(result.from).toBe(51)
    expect(result.to).toBe(73) // Math.min(3*25, 73) = 73
  })

  it('computes from=1 and to=0 for empty array', () => {
    const result = paginate([], 1, 25)
    expect(result.from).toBe(1)
    expect(result.to).toBe(0)
  })
})

describe('paginate — different page sizes', () => {
  it('works correctly with page size 50', () => {
    const result = paginate(items, 1, 50)
    expect(result.slice).toHaveLength(50)
    expect(result.slice[0]).toBe(1)
  })

  it('works correctly with page size 100 when all items fit', () => {
    const result = paginate(items, 1, 100)
    expect(result.slice).toHaveLength(73)
  })
})
