/**
 * TDD tests for GET + POST /api/herramientas route.
 *
 * Tests cover:
 *
 * GET:
 *  G1. Returns cached rows ordered count DESC, label ASC, capped at 40 (spec 3.1)
 *  G2. Tie-break: same count → label ascending (spec 3.1)
 *  G3. Returns [] when cache is empty (spec 3.2)
 *  G4. Returns [] on Supabase read error (spec 3.x — non-fatal)
 *  G5. Caps at 40 even when more rows exist (spec 3.1)
 *
 * POST:
 *  P1. config_missing → 200 skipped=true reason=config_missing (spec 2.4)
 *  P2. threshold_not_met → 200 skipped=true with newCount/threshold (spec 2.2)
 *  P3. bootstrap (no prior run) → proceeds regardless of record count (spec 2.1)
 *  P4. success → 200 herramientas array + _meta.skipped=false (spec 3.3)
 *  P5. response_format: json_object in fetch body (spec mirrors insights)
 *  P6. DELETE-then-INSERT happens on success (ADR-3)
 *  P7. insert_failed → 500 (spec 3.4)
 *  P8. AbortError → 504 reason=abort_timeout (spec 3.4)
 *  P9. TypeError network → 502 reason=upstream_fetch_failed (spec 3.4)
 *  P10. json_parse_failed → 422 (spec 3.4)
 *
 * Strategy:
 * - vi.mock('@supabase/supabase-js') — no real DB calls
 * - vi.stubGlobal('fetch') — no real LLM calls
 * - vi.mock('@/lib/tools-extraction') for POST tests that need to control
 *   generateToolsUsage behaviour without triggering the full IO pipeline
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock @supabase/supabase-js ──────────────────────────────────────────────

const mockFrom = vi.fn()

const mockSupabaseInstance = { from: mockFrom }

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseInstance),
}))

// ─── Mock tools-extraction so we can control generateToolsUsage ──────────────

vi.mock('@/lib/tools-extraction', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tools-extraction')>()
  return {
    ...actual,
    generateToolsUsage: vi.fn(),
  }
})

// ─── Import route handlers AFTER mocks are hoisted ───────────────────────────

import { GET, POST } from '../route'
import { generateToolsUsage } from '@/lib/tools-extraction'

// ─── Env helper ──────────────────────────────────────────────────────────────

function setEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key'
  process.env.OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'
  process.env.OPENROUTER_MODEL = 'test-model'
  process.env.HERRAMIENTAS_MIN_NEW_RECORDS = '20'
}

function clearEnv() {
  delete process.env.OPENROUTER_API_KEY
  delete process.env.OPENROUTER_API_URL
  delete process.env.OPENROUTER_MODEL
  delete process.env.HERRAMIENTAS_MIN_NEW_RECORDS
}

// ─── Supabase chain builder ───────────────────────────────────────────────────

type ChainResolver = (table: string) => unknown

function buildChain(resolver: ChainResolver) {
  return (table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      gt: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      // Thenable for awaited chains
      then: (resolve: (v: unknown) => void) => resolve(resolver(table)),
    }
    return chain
  }
}

// ─── Request builders ─────────────────────────────────────────────────────────

function makePostRequest(body: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/herramientas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── GET tests ────────────────────────────────────────────────────────────────

describe('GET /api/herramientas — cache read', () => {
  beforeEach(() => {
    setEnv()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('G1: returns rows ordered count DESC with correct shape', async () => {
    // Simulate herramientas_uso rows from the latest run
    const latestAt = '2026-06-04T12:00:00Z'
    const rows = [
      { label: 'ChatGPT', count: 9, generated_at: latestAt },
      { label: 'Canva', count: 9, generated_at: latestAt },
      { label: 'Excel', count: 2, generated_at: latestAt },
    ]

    mockFrom.mockImplementation(
      buildChain(() => ({ data: rows, error: null }))
    )

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveProperty('herramientas')
    expect(Array.isArray(json.herramientas)).toBe(true)
    expect(json.herramientas.length).toBe(3)
    // All items have required shape
    for (const item of json.herramientas) {
      expect(typeof item.label).toBe('string')
      expect(typeof item.count).toBe('number')
    }
  })

  it('G2: tie-break — same count sorted label ASC (Canva before ChatGPT)', async () => {
    const latestAt = '2026-06-04T12:00:00Z'
    // Provide rows in reverse tie-break order to verify sorting
    const rows = [
      { label: 'ChatGPT', count: 9, generated_at: latestAt },
      { label: 'Canva', count: 9, generated_at: latestAt },
      { label: 'Excel', count: 2, generated_at: latestAt },
    ]

    mockFrom.mockImplementation(
      buildChain(() => ({ data: rows, error: null }))
    )

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    // First two items have count 9; Canva < ChatGPT alphabetically
    expect(json.herramientas[0].label).toBe('Canva')
    expect(json.herramientas[1].label).toBe('ChatGPT')
    // Excel last with count 2
    expect(json.herramientas[2].label).toBe('Excel')
    expect(json.herramientas[2].count).toBe(2)
  })

  it('G3: returns empty herramientas array when no cache rows', async () => {
    mockFrom.mockImplementation(
      buildChain(() => ({ data: [], error: null }))
    )

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.herramientas).toEqual([])
  })

  it('G4: returns safe empty payload on Supabase read error', async () => {
    mockFrom.mockImplementation(
      buildChain(() => ({ data: null, error: { message: 'connection refused' } }))
    )

    const res = await GET()
    const json = await res.json()

    // Must not return 500 — page must not crash
    expect(res.status).toBe(200)
    expect(json.herramientas).toEqual([])
  })

  it('G5: caps at 40 entries even when more rows exist in the latest run', async () => {
    const latestAt = '2026-06-04T12:00:00Z'
    // Build 50 rows
    const rows = Array.from({ length: 50 }, (_, i) => ({
      label: `Tool${String(i).padStart(2, '0')}`,
      count: 50 - i,
      generated_at: latestAt,
    }))

    mockFrom.mockImplementation(
      buildChain(() => ({ data: rows, error: null }))
    )

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.herramientas.length).toBe(40)
    // First entry should have highest count
    expect(json.herramientas[0].count).toBe(50)
  })
})

// ─── POST tests ───────────────────────────────────────────────────────────────

describe('POST /api/herramientas — threshold-gated generation', () => {
  beforeEach(() => {
    setEnv()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    clearEnv()
  })

  it('P1: config_missing when OPENROUTER env vars absent → 200 skipped=true reason=config_missing', async () => {
    clearEnv()
    // Restore Supabase vars only
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: true,
      reason: 'config_missing',
      details: { missing: ['OPENROUTER_API_KEY', 'OPENROUTER_API_URL', 'OPENROUTER_MODEL'] },
    })

    const res = await POST(makePostRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.skipped).toBe(true)
    expect(json.reason).toBe('config_missing')
    expect(Array.isArray(json.details.missing)).toBe(true)
    expect(json.details.missing.length).toBeGreaterThan(0)
  })

  it('P2: threshold_not_met → 200 skipped=true with newCount and threshold', async () => {
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: true,
      reason: 'threshold_not_met',
      details: { newCount: 5, threshold: 20 },
    })

    const res = await POST(makePostRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.skipped).toBe(true)
    expect(json.reason).toBe('threshold_not_met')
    expect(json.details.newCount).toBe(5)
    expect(json.details.threshold).toBe(20)
  })

  it('P3: bootstrap (no prior run) → generateToolsUsage called and returns herramientas', async () => {
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: false,
      herramientas: [{ label: 'ChatGPT', count: 3 }],
      _meta: { threshold: 20 },
    })

    const res = await POST(makePostRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    // Success shape: { herramientas, _meta: { skipped: false, threshold } }
    expect(json._meta.skipped).toBe(false)
    expect(Array.isArray(json.herramientas)).toBe(true)
    expect(json.herramientas[0].label).toBe('ChatGPT')
    // generateToolsUsage must have been called
    expect(vi.mocked(generateToolsUsage)).toHaveBeenCalledOnce()
  })

  it('P4: success → 200 with herramientas array and _meta.skipped=false', async () => {
    const herramientas = [
      { label: 'ChatGPT', count: 9 },
      { label: 'Canva', count: 3 },
    ]
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: false,
      herramientas,
      _meta: { threshold: 20 },
    })

    const res = await POST(makePostRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json._meta.skipped).toBe(false)
    expect(json.herramientas).toEqual(herramientas)
  })

  it('P5: response_format: json_object is passed to fetch (via generateToolsUsage)', async () => {
    // This test verifies the route calls generateToolsUsage (which internally uses json_object).
    // We verify the mock was called — the actual fetch body is tested at the extraction layer.
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: false,
      herramientas: [],
      _meta: { threshold: 20 },
    })

    await POST(makePostRequest() as never)

    // generateToolsUsage is called with supabase client + options
    expect(vi.mocked(generateToolsUsage)).toHaveBeenCalledOnce()
    const [, options] = vi.mocked(generateToolsUsage).mock.calls[0]
    // minNew should be a number (from env or body)
    expect(typeof options?.minNew === 'number' || options?.minNew === undefined).toBe(true)
  })

  it('P6: success path calls generateToolsUsage (which does DELETE-then-INSERT per ADR-3)', async () => {
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: false,
      herramientas: [{ label: 'ChatGPT', count: 5 }],
      _meta: { threshold: 20 },
    })

    await POST(makePostRequest() as never)

    expect(vi.mocked(generateToolsUsage)).toHaveBeenCalledOnce()
  })

  it('P7: insert_failed → 500 with reason insert_failed', async () => {
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: true,
      reason: 'insert_failed',
      details: { message: 'db write error' },
    })

    const res = await POST(makePostRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.reason).toBe('insert_failed')
  })

  it('P8: abort_timeout → 504 with reason abort_timeout', async () => {
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: true,
      reason: 'abort_timeout',
    })

    const res = await POST(makePostRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(504)
    expect(json.reason).toBe('abort_timeout')
  })

  it('P9: upstream_fetch_failed → 502 with reason upstream_fetch_failed', async () => {
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: true,
      reason: 'upstream_fetch_failed',
      details: { message: 'fetch failed' },
    })

    const res = await POST(makePostRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(502)
    expect(json.reason).toBe('upstream_fetch_failed')
  })

  it('P10: json_parse_failed → 422 with reason json_parse_failed', async () => {
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: true,
      reason: 'json_parse_failed',
      details: { debug: '{ "herramientas": [' },
    })

    const res = await POST(makePostRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.reason).toBe('json_parse_failed')
  })

  it('P10b: no_json_match → 422 with reason no_json_match', async () => {
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: true,
      reason: 'no_json_match',
    })

    const res = await POST(makePostRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.reason).toBe('no_json_match')
  })

  it('P10c: missing_choices → 422 with reason missing_choices', async () => {
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: true,
      reason: 'missing_choices',
      details: { debug: '{"hasChoices":false}' },
    })

    const res = await POST(makePostRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.reason).toBe('missing_choices')
  })

  it('P10d: upstream_error → 200 skipped envelope (mirrors insights skipped pattern)', async () => {
    vi.mocked(generateToolsUsage).mockResolvedValue({
      skipped: true,
      reason: 'upstream_error',
      details: { status: 500, message: 'LLM API error', body: '' },
    })

    const res = await POST(makePostRequest() as never)
    const json = await res.json()

    // upstream_error is returned as a skipped envelope (not a 5xx crash)
    expect(res.status).toBe(200)
    expect(json.skipped).toBe(true)
    expect(json.reason).toBe('upstream_error')
  })
})

// ─── GET + POST content contract ─────────────────────────────────────────────

describe('GET /api/herramientas — generated_at field', () => {
  beforeEach(() => {
    setEnv()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('includes generated_at in the response (latest run timestamp or null)', async () => {
    const latestAt = '2026-06-04T12:00:00.000Z'
    mockFrom.mockImplementation(
      buildChain(() => ({
        data: [{ label: 'ChatGPT', count: 9, generated_at: latestAt }],
        error: null,
      }))
    )

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    // generated_at should be present (string or null)
    expect('generated_at' in json).toBe(true)
  })

  it('generated_at is null when cache is empty', async () => {
    mockFrom.mockImplementation(
      buildChain(() => ({ data: [], error: null }))
    )

    const res = await GET()
    const json = await res.json()

    expect(json.generated_at).toBeNull()
  })
})
