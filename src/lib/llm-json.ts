/**
 * Shared LLM JSON extraction and repair helpers.
 *
 * Extracted from src/app/api/insights/route.ts (ADR-4) so that both
 * the insights route and the herramientas extraction pipeline share the
 * same balanced-JSON parsing logic without duplication.
 *
 * These functions are pure (no side effects) and fully unit-testable.
 */

/**
 * Extract a JSON object with balanced braces from a string that may contain
 * extra text before/after. More robust than a simple greedy regex.
 *
 * Returns the first balanced JSON object substring, or null if not found.
 */
export function extractBalancedJSON(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\' && inString) {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Repair common JSON issues from AI output:
 * - Trailing commas before } or ]
 * - Unescaped newlines in string values (replace with space)
 * - Carriage returns (remove)
 */
export function repairJSON(text: string): string {
  return text
    .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
    .replace(/\n/g, ' ')            // collapse newlines
    .replace(/\r/g, '')             // remove carriage returns
}
