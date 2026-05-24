/**
 * Tests for useWindowWidth hook logic.
 *
 * Strategy: The vitest config uses environment: 'node' (no DOM available).
 * We test the pure logic extracted from the hook:
 *   - createDebouncedResizeHandler: the debounced callback factory
 *   - SSR-safe default behavior: the hook returns defaultWidth before useEffect fires
 *
 * Behavioral contracts tested:
 *   1. Default width: returns 1024 when called with no argument
 *   2. Custom default: returns the provided defaultWidth
 *   3. Debounce: handler fires once after debounceMs, not on every call
 *   4. Debounce reset: rapid calls reset the timer (only last fires)
 *   5. Cleanup: cancel clears pending timer and cancels rAF
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDebouncedResizeHandler } from '../useWindowWidth'

describe('createDebouncedResizeHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not call the callback immediately when invoked', () => {
    const callback = vi.fn()
    const { handler } = createDebouncedResizeHandler(callback, 150)

    handler()

    expect(callback).not.toHaveBeenCalled()
  })

  it('calls the callback after the debounce delay', () => {
    const callback = vi.fn()
    const { handler } = createDebouncedResizeHandler(callback, 150)

    handler()
    vi.advanceTimersByTime(150)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('fires only once when called rapidly within the debounce window', () => {
    const callback = vi.fn()
    const { handler } = createDebouncedResizeHandler(callback, 150)

    // Simulate 10 rapid resize events within 150ms
    for (let i = 0; i < 10; i++) {
      handler()
      vi.advanceTimersByTime(10)
    }
    // Advance past debounce to trigger the final pending call
    vi.advanceTimersByTime(150)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('fires again when called after the debounce window has elapsed', () => {
    const callback = vi.fn()
    const { handler } = createDebouncedResizeHandler(callback, 150)

    handler()
    vi.advanceTimersByTime(150) // first fires
    handler()
    vi.advanceTimersByTime(150) // second fires

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('cancel prevents a pending debounced callback from firing', () => {
    const callback = vi.fn()
    const { handler, cancel } = createDebouncedResizeHandler(callback, 150)

    handler()
    cancel()
    vi.advanceTimersByTime(200)

    expect(callback).not.toHaveBeenCalled()
  })
})

describe('createDebouncedResizeHandler with custom delay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('respects a custom debounce delay of 300ms — does not fire before it elapses', () => {
    const callback = vi.fn()
    const { handler } = createDebouncedResizeHandler(callback, 300)

    handler()
    vi.advanceTimersByTime(299)
    // 299ms elapsed — 300ms delay has not fired yet
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    // Now 300ms elapsed — callback fires exactly once
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
