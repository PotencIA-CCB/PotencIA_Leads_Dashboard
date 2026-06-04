/**
 * Tools extraction and canonicalization helpers.
 *
 * Pure exported functions (test seams — no IO, no side effects):
 *   - canonicalizeLabel: defensive formatting normalization (trim, collapse whitespace)
 *   - mergeCanonical: merge + sum counts for identical labels, sort desc
 *   - parseToolsResponse: parse LLM JSON response → { label, count }[]
 *   - buildToolsPrompt: assemble the canonicalization prompt for the LLM
 *
 * IO orchestration (depends on Supabase + fetch — not unit-tested directly):
 *   - generateToolsUsage: threshold-gated extraction pipeline (called by POST /api/herramientas)
 *
 * Architecture: mirrors the proven insights pipeline.
 *   - env: OPENCODE_API_KEY / OPENCODE_API_BASE_URL / OPENCODE_MODEL
 *   - env: HERRAMIENTAS_MIN_NEW_RECORDS (default 20, clamped 0..1000)
 *   - LLM temperature: 0.2 (determinism over creativity — tool names are facts)
 *   - Timeout: 25s AbortController (mirrors insights)
 *   - Cache strategy: DELETE-then-INSERT per generated_at run (ADR-3)
 */

import { extractBalancedJSON, repairJSON } from './llm-json'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Sample caps ──────────────────────────────────────────────────────────────

const MAX_SAMPLES = 80
const MAX_CHARS_PER_SAMPLE = 200

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Defensive client-side formatting normalization: trim outer whitespace and
 * collapse internal runs of whitespace/tabs to a single space.
 *
 * The LLM handles SEMANTIC canonicalization (chat gpt → ChatGPT).
 * This function only ensures identical post-LLM labels are not split by
 * trivial whitespace differences.
 */
export function canonicalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * Merge items that share the same label (exact string equality), sum their
 * counts, and return sorted by count descending with label ascending as the
 * tie-break (deterministic ordering for tests and GET cap).
 */
export function mergeCanonical(
  items: { label: string; count: number }[]
): { label: string; count: number }[] {
  const map = new Map<string, number>()
  for (const item of items) {
    map.set(item.label, (map.get(item.label) ?? 0) + item.count)
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/**
 * Parse the LLM response text into a validated { label, count }[] array.
 *
 * Handles:
 * - Clean JSON
 * - JSON wrapped in prose
 * - Markdown-fenced JSON
 * - Malformed JSON (balanced extraction + repair)
 * - Missing herramientas key → []
 * - Empty labels → dropped
 * - count < 1 after coercion → dropped
 * - Never throws — returns [] on any failure
 */
export function parseToolsResponse(
  content: string
): { label: string; count: number }[] {
  // Strip markdown fences
  const cleaned = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Strategy 1: direct parse
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Strategy 2: extract balanced JSON object from prose
    const extracted = extractBalancedJSON(cleaned)
    if (!extracted) return []

    try {
      parsed = JSON.parse(extracted)
    } catch {
      // Strategy 3: repair common issues and retry
      const repaired = repairJSON(extracted)
      try {
        parsed = JSON.parse(repaired)
      } catch {
        return []
      }
    }
  }

  // Validate shape
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).herramientas)
  ) {
    return []
  }

  const herramientas = (parsed as { herramientas: unknown[] }).herramientas

  const result: { label: string; count: number }[] = []
  for (const item of herramientas) {
    if (typeof item !== 'object' || item === null) continue

    const raw = item as Record<string, unknown>
    const label = canonicalizeLabel(String(raw.label ?? ''))
    if (!label) continue // drop empty labels

    const count = Math.floor(Number(raw.count ?? 0))
    if (count < 1) continue // drop zero/negative

    result.push({ label, count })
  }

  return result
}

/**
 * Build the canonicalization prompt for the LLM.
 *
 * Caps at MAX_SAMPLES (80) entries, each truncated to MAX_CHARS_PER_SAMPLE (200) chars.
 * Handles empty acciones input gracefully (returns a valid prompt with no data section).
 */
export function buildToolsPrompt(acciones: string[]): string {
  const samples = acciones
    .slice(0, MAX_SAMPLES)
    .map((a) => (a.length > MAX_CHARS_PER_SAMPLE ? a.slice(0, MAX_CHARS_PER_SAMPLE) : a))
    .filter((a) => a.trim().length > 0)

  const dataSection =
    samples.length > 0
      ? samples.map((a, i) => `${i + 1}. ${a}`).join('\n')
      : '(sin datos de acciones)'

  return `Eres un analista que identifica las HERRAMIENTAS de IA y software mencionadas
literalmente en las acciones realizadas durante consultorías PotencIA.
REGLAS:
- Extrae SOLO herramientas mencionadas explícitamente en el texto (ChatGPT, Gemini,
  Claude, Canva, Excel, Google Sheets, GPTs personalizados, n8n, Make, Zapier, etc.).
- NORMALIZA variantes a UNA etiqueta canónica: "chat gpt"/"chatgpt"/"GPT-4" -> "ChatGPT";
  "google sheets"/"hojas de cálculo de google" -> "Google Sheets".
- NO inventes herramientas que no aparezcan en el texto.
- count = número de menciones (consultorías distintas donde aparece).
Responde ÚNICAMENTE con este JSON:
{ "herramientas": [ { "label": "ChatGPT", "count": 12 }, ... ] }

ACCIONES REALIZADAS:
${dataSection}`
}

// ─── IO orchestration ─────────────────────────────────────────────────────────

export type ToolsUsageResult =
  | { skipped: false; herramientas: { label: string; count: number }[]; _meta: { threshold: number } }
  | { skipped: true; reason: 'config_missing'; details: { missing: string[] } }
  | { skipped: true; reason: 'threshold_not_met'; details: { newCount: number; threshold: number } }
  | { skipped: true; reason: 'upstream_error'; details: { status: number; message: string; body: string } }
  | { skipped: true; reason: 'abort_timeout' }
  | { skipped: true; reason: 'upstream_fetch_failed'; details: { message: string } }
  | { skipped: true; reason: 'no_json_match' }
  | { skipped: true; reason: 'json_parse_failed'; details: { debug: string } }
  | { skipped: true; reason: 'missing_choices'; details: { debug: string } }
  | { skipped: true; reason: 'insert_failed'; details: { message: string } }

/**
 * Threshold-gated tools extraction orchestrator.
 *
 * Called by POST /api/herramientas. Performs:
 * 1. Config check (OPENCODE_* env vars)
 * 2. Threshold check via latest herramientas_uso.generated_at anchor
 * 3. Read all registro_sesion.acciones_realizadas
 * 4. Build prompt → call Opencode Go → parse response
 * 5. DELETE old rows then INSERT new batch (ADR-3)
 *
 * Returns a typed result envelope. Never throws (all errors are caught and returned).
 */
export async function generateToolsUsage(
  supabase: SupabaseClient,
  options: { minNew?: number } = {}
): Promise<ToolsUsageResult> {
  // ── Config check ──────────────────────────────────────────────────────────
  const openAiKey = process.env.OPENCODE_API_KEY
  const openAiBase = process.env.OPENCODE_API_BASE_URL
  const openAiModel = process.env.OPENCODE_MODEL
  if (!openAiKey || !openAiBase || !openAiModel) {
    const missing = ['OPENCODE_API_KEY', 'OPENCODE_API_BASE_URL', 'OPENCODE_MODEL'].filter(
      (k) => !process.env[k]
    )
    return { skipped: true, reason: 'config_missing', details: { missing } }
  }

  // ── Resolve minNew threshold ──────────────────────────────────────────────
  let minNew = options.minNew ?? Number(process.env.HERRAMIENTAS_MIN_NEW_RECORDS ?? '20')
  if (!Number.isFinite(minNew) || minNew < 0) minNew = 20
  if (minNew > 1000) minNew = 1000

  try {
    // ── Get latest run anchor ────────────────────────────────────────────────
    const { data: lastRunRow } = await supabase
      .from('herramientas_uso')
      .select('generated_at')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // ── Threshold check (only if a prior run exists) ─────────────────────────
    if (lastRunRow) {
      const { count: newCount } = await supabase
        .from('registro_sesion')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', lastRunRow.generated_at)

      if (typeof newCount === 'number' && newCount < minNew) {
        return {
          skipped: true,
          reason: 'threshold_not_met',
          details: { newCount, threshold: minNew },
        }
      }
    }

    // ── Read all acciones_realizadas ─────────────────────────────────────────
    const { data: sesionRows, error: sesionError } = await supabase
      .from('registro_sesion')
      .select('acciones_realizadas')

    if (sesionError) {
      return {
        skipped: true,
        reason: 'upstream_error',
        details: { status: 500, message: sesionError.message, body: '' },
      }
    }

    const accionesList = (sesionRows ?? [])
      .map((r: { acciones_realizadas: string | null }) => r.acciones_realizadas ?? '')
      .filter((a: string) => a.trim().length > 0)

    const prompt = buildToolsPrompt(accionesList)

    // ── LLM call ─────────────────────────────────────────────────────────────
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25_000)

    const response = await fetch(`${openAiBase}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: openAiModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    }).finally(() => clearTimeout(timeoutId))

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      return {
        skipped: true,
        reason: 'upstream_error',
        details: { status: response.status, message: `LLM API error: ${response.status}`, body: errBody },
      }
    }

    let aiData: { choices?: { message?: { content?: string; reasoning_content?: string } }[] }
    try {
      aiData = await response.json()
    } catch {
      return {
        skipped: true,
        reason: 'upstream_fetch_failed',
        details: { message: 'upstream JSON parse failed' },
      }
    }

    // Handle reasoning_content fallback (DeepSeek R1 variants)
    const choice = aiData?.choices?.[0]?.message
    let content = choice?.content
    if (
      (typeof content !== 'string' || content.length === 0) &&
      typeof choice?.reasoning_content === 'string' &&
      choice.reasoning_content.length > 0
    ) {
      content = choice.reasoning_content
    }

    if (typeof content !== 'string' || content.length === 0) {
      const debugShape = JSON.stringify({
        hasChoices: Array.isArray(aiData?.choices),
        choicesLen: aiData?.choices?.length ?? 0,
        topKeys: aiData ? Object.keys(aiData).slice(0, 10) : [],
      })
      return {
        skipped: true,
        reason: 'missing_choices',
        details: { debug: debugShape },
      }
    }

    // ── Parse LLM response ───────────────────────────────────────────────────
    const parsed = parseToolsResponse(content)

    // Check if parsing succeeded (empty could be genuine or failure)
    // If content was non-empty but parsing returned nothing, try to diagnose
    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const extracted = extractBalancedJSON(cleaned)
    if (!extracted && parsed.length === 0 && content.trim().length > 0) {
      return {
        skipped: true,
        reason: 'no_json_match',
      }
    }

    // Merge canonical (handles any post-LLM duplicates)
    const herramientas = mergeCanonical(parsed)

    // ── Persist: DELETE old rows, INSERT new batch ───────────────────────────
    const { error: deleteError } = await supabase.from('herramientas_uso').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteError) {
      return {
        skipped: true,
        reason: 'insert_failed',
        details: { message: deleteError.message },
      }
    }

    if (herramientas.length > 0) {
      const generatedAt = new Date().toISOString()
      const rows = herramientas.map((h) => ({
        label: h.label,
        count: h.count,
        generated_at: generatedAt,
        fuente: openAiModel,
      }))

      const { error: insertError } = await supabase.from('herramientas_uso').insert(rows)
      if (insertError) {
        return {
          skipped: true,
          reason: 'insert_failed',
          details: { message: insertError.message },
        }
      }
    }

    return {
      skipped: false,
      herramientas,
      _meta: { threshold: minNew },
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { skipped: true, reason: 'abort_timeout' }
    }
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      return {
        skipped: true,
        reason: 'upstream_fetch_failed',
        details: { message: error.message },
      }
    }
    return {
      skipped: true,
      reason: 'upstream_error',
      details: { status: 500, message: String(error), body: '' },
    }
  }
}
