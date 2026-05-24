'use client'
import { useEffect, useState } from 'react'

/**
 * Creates a debounced handler with a cancel function.
 * Exported for unit testing — pure factory, no DOM/rAF dependencies.
 *
 * @param callback   - function to call after the debounce delay
 * @param debounceMs - debounce window in milliseconds
 * @returns { handler, cancel }
 */
export function createDebouncedResizeHandler(
  callback: () => void,
  debounceMs: number,
): { handler: () => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  function handler() {
    if (timeoutId !== null) clearTimeout(timeoutId)
    timeoutId = setTimeout(callback, debounceMs)
  }

  function cancel() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return { handler, cancel }
}

/**
 * SSR-safe viewport width subscription with debounced resize.
 *
 * Returns `defaultWidth` on the server and during first client render
 * to avoid hydration mismatches. Subscribes to `window.resize` in
 * `useEffect` and updates state when the viewport changes.
 *
 * @param defaultWidth - width to use on server / before hydration (default: 1024)
 * @param debounceMs   - resize debounce window in ms (default: 150)
 */
export function useWindowWidth(defaultWidth = 1024, debounceMs = 150): number {
  const [width, setWidth] = useState<number>(defaultWidth)

  useEffect(() => {
    // Capture real width synchronously after mount
    setWidth(window.innerWidth)

    let raf = 0
    const { handler, cancel } = createDebouncedResizeHandler(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setWidth(window.innerWidth))
    }, debounceMs)

    window.addEventListener('resize', handler, { passive: true })

    return () => {
      window.removeEventListener('resize', handler)
      cancel()
      cancelAnimationFrame(raf)
    }
  }, [debounceMs])

  return width
}
