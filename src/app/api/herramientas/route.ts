// Required env vars:
// NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
// SUPABASE_SERVICE_ROLE_KEY  — Supabase service role key (bypasses RLS)
// OPENCODE_API_KEY           — API key for Opencode Go (used by generateToolsUsage)
// OPENCODE_API_BASE_URL      — Base URL for Opencode Go API
// OPENCODE_MODEL             — Model ID to use
// HERRAMIENTAS_MIN_NEW_RECORDS — Min new registro_sesion records before regenerating (default: 20)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateToolsUsage } from '@/lib/tools-extraction'

export const dynamic = 'force-dynamic'

// Max entries returned by GET — parity with WordCloud top-40 cap (spec 3.1)
const GET_CAP = 40

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/herramientas
 *
 * Returns the cached tool set from the latest generation run.
 * Ordered: count DESC, label ASC (tie-break — deterministic, spec 3.1).
 * Capped at GET_CAP (40) entries.
 *
 * Never returns 500 to the client — degrading to empty array on any error
 * keeps the page alive (spec Req 3).
 *
 * Response shape: { herramientas: { label: string; count: number }[]; generated_at: string | null }
 */
export async function GET() {
  const supabase = getSupabase()

  try {
    // Fetch all rows ordered by generated_at desc first so we get the latest run,
    // then within that run by count desc. We over-fetch (limit 200) and do the
    // latest-run filter + label-asc tie-break in-memory (volume is small).
    const { data, error } = await supabase
      .from('herramientas_uso')
      .select('label, count, generated_at')
      .order('generated_at', { ascending: false })
      .order('count', { ascending: false })
      .limit(200)

    if (error || !data) {
      return NextResponse.json({ herramientas: [], generated_at: null })
    }

    if (data.length === 0) {
      return NextResponse.json({ herramientas: [], generated_at: null })
    }

    // Filter to the latest run only (all rows with the same max generated_at)
    const latestAt = data[0].generated_at
    const latestRows = data.filter((r) => r.generated_at === latestAt)

    // Sort: count DESC, label ASC (tie-break per spec 3.1)
    const sorted = [...latestRows].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label)
    )

    // Cap at 40
    const herramientas = sorted.slice(0, GET_CAP).map(({ label, count }) => ({ label, count }))

    return NextResponse.json({ herramientas, generated_at: latestAt })
  } catch {
    // Non-fatal — return empty payload so the page renders
    return NextResponse.json({ herramientas: [], generated_at: null })
  }
}

/**
 * POST /api/herramientas
 *
 * Triggers threshold-gated regeneration via generateToolsUsage.
 * NEVER invoked on render — only called explicitly (fire-and-forget from page
 * on empty cache, or manual admin trigger).
 *
 * Response envelopes mirror /api/insights:
 * - success:          200 { herramientas, _meta: { skipped: false, threshold } }
 * - threshold_not_met: 200 { skipped: true, reason, details }
 * - config_missing:    200 { skipped: true, reason, details }
 * - upstream_error:    200 { skipped: true, reason, details }
 * - insert_failed:     500 { reason, error }
 * - abort_timeout:     504 { reason, error }
 * - upstream_fetch_failed: 502 { reason, error }
 * - json_parse_failed: 422 { reason }
 * - no_json_match:     422 { reason }
 * - missing_choices:   422 { reason }
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase()

  // Parse optional body override for minNew
  let minNew: number | undefined
  try {
    const body = await req.json()
    if (typeof body?.minNew === 'number') minNew = body.minNew
  } catch { /* no body or invalid JSON — use env default */ }

  const result = await generateToolsUsage(supabase, { minNew })

  // Map result to HTTP response envelope

  if (!result.skipped) {
    // Success
    return NextResponse.json({
      herramientas: result.herramientas,
      _meta: { skipped: false, threshold: result._meta.threshold },
    })
  }

  // Error/skip envelopes — map reason to HTTP status
  switch (result.reason) {
    case 'insert_failed':
      return NextResponse.json(
        { error: 'Error guardando herramientas', reason: result.reason, detail: result.details?.message },
        { status: 500 }
      )

    case 'abort_timeout':
      return NextResponse.json(
        { error: 'Timeout esperando al proveedor IA', reason: result.reason },
        { status: 504 }
      )

    case 'upstream_fetch_failed':
      return NextResponse.json(
        { error: 'Fallo de red al contactar al proveedor IA', reason: result.reason, detail: result.details?.message },
        { status: 502 }
      )

    case 'json_parse_failed':
    case 'no_json_match':
    case 'missing_choices':
      return NextResponse.json(
        { error: 'Respuesta del proveedor IA no es JSON válido', reason: result.reason },
        { status: 422 }
      )

    // threshold_not_met, config_missing, upstream_error — skipped envelopes, 200
    default:
      return NextResponse.json({ skipped: true, reason: result.reason, details: (result as { details?: unknown }).details })
  }
}
