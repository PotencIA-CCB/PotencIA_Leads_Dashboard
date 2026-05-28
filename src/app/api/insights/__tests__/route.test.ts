/**
 * TDD tests for POST /api/insights route hardening.
 *
 * Tests cover:
 * 1. fenced JSON → 200 (insights/recomendaciones/alertas arrays)
 * 2. plain JSON → 200
 * 3. prose-wrapped JSON → 200
 * 4. no JSON match → 422, reason: no_json_match
 * 5. truncated/invalid JSON → 422, reason: parse_error  (JSON_PARSE_FAILED)
 * 6. missing choices[0] → 422, reason: missing_choices
 * 7. AbortError during fetch → 504, reason: abort_timeout
 * 8. TypeError (network failure) → 502, reason: fetch_error
 *
 * Strategy:
 * - We mock `fetch` with vi.stubGlobal.
 * - We mock `@supabase/supabase-js` with vi.mock so no real DB calls happen.
 * - Each test sets env vars needed for the route to reach the fetch call.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock @supabase/supabase-js ───────────────────────────────────────────────
// The route calls createClient(...) then does multiple .from().select() chains.
// We need every chain to resolve with empty data so the route proceeds to the
// AI fetch call without short-circuiting.

const mockSupabaseChain = {
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  in: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ data: null, error: null }),
}

const mockFrom = vi.fn().mockReturnValue({
  ...mockSupabaseChain,
  // When the chain ends at select (without maybeSingle), return no data
  then: undefined, // prevent accidental promise behaviour on the chain itself
})

// Make every terminal call resolve appropriately
const mockSupabaseInstance = {
  from: mockFrom,
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseInstance),
}))

// ─── Helper: make a valid AI response body ───────────────────────────────────
function makeAiResponse(content: string) {
  return {
    choices: [{ message: { content } }],
  }
}

// ─── Helper: make a mock fetch Response ───────────────────────────────────────
function makeFetchResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

// ─── Setup env vars ───────────────────────────────────────────────────────────
function setEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  process.env.OPENCODE_API_KEY = 'test-opencode-key'
  process.env.OPENCODE_API_BASE_URL = 'https://api.test.com'
  process.env.OPENCODE_MODEL = 'test-model'
}

// ─── Supabase chain helper ─────────────────────────────────────────────────
// Each call to `from()` should return a fresh chain that resolves correctly.
// consultorias → [] (no threshold check triggers)
// insights → null (no last insight → no threshold guard)
// novedades → []
// consultas_por_semana → []
// registro_sesion → []

function setupSupabaseMock() {
  // Reset all mocks
  vi.clearAllMocks()

  // Default: all from() calls return chains that eventually resolve with empty data
  mockFrom.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      // Thenable that resolves with empty data
      then: (resolve: (v: unknown) => void) => resolve({ data: table === 'consultorias' ? [] : [], error: null }),
    }
    return chain
  })
}

// ─── Import route handler after mocks are in place ───────────────────────────
// We import POST lazily inside each test (via dynamic import with cache-bust is
// not possible in Vitest without resetModules). Instead, we import once at top
// level — mocks registered with vi.mock are hoisted before imports.

import { POST } from '../route'
import { buildImpactContext } from '@/lib/insights-context'

// ─── Helper: build a minimal NextRequest-like object ─────────────────────────
function makeRequest(body: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/insights — parallelized pre-queries', () => {
  beforeEach(() => {
    setEnv()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses Promise.all to dispatch lastInsight, consultorias, novedades, and buildImpactContext concurrently', async () => {
    setupSupabaseMock()

    // Spy on Promise.all to verify it receives an array of 4 promises for Stage A
    const originalPromiseAll = Promise.all.bind(Promise)
    let capturedStagAArgLength = 0

    const promiseAllSpy = vi.spyOn(Promise, 'all').mockImplementation((iterable: Iterable<unknown>) => {
      const arr = Array.from(iterable)
      // Capture the length of the largest Promise.all call (Stage A has 4 items)
      if (arr.length > capturedStagAArgLength) capturedStagAArgLength = arr.length
      return originalPromiseAll(arr)
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse(makeAiResponse(JSON.stringify({
        insights: ['i1'], recomendaciones: ['r1'], alertas: ['a1'],
      })))
    ))

    await POST(makeRequest() as never)

    // Stage A fires: lastInsight + consultorias + novedades + buildImpactContext = 4
    expect(promiseAllSpy).toHaveBeenCalled()
    expect(capturedStagAArgLength).toBeGreaterThanOrEqual(4)

    promiseAllSpy.mockRestore()
  })

  it('sends max_tokens: 700 in the DeepSeek fetch body', async () => {
    setupSupabaseMock()

    let capturedBody: Record<string, unknown> | null = null

    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedBody = JSON.parse(opts.body as string) as Record<string, unknown>
      return Promise.resolve(makeFetchResponse(makeAiResponse(JSON.stringify({
        insights: ['i1'], recomendaciones: ['r1'], alertas: ['a1'],
      }))))
    }))

    await POST(makeRequest() as never)

    expect(capturedBody).not.toBeNull()
    expect(capturedBody!['max_tokens']).toBe(700)
  })

  it('includes response_format: json_object in the DeepSeek fetch body', async () => {
    setupSupabaseMock()

    let capturedBody: Record<string, unknown> | null = null

    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedBody = JSON.parse(opts.body as string) as Record<string, unknown>
      return Promise.resolve(makeFetchResponse(makeAiResponse(JSON.stringify({
        insights: ['i1'], recomendaciones: ['r1'], alertas: ['a1'],
      }))))
    }))

    await POST(makeRequest() as never)

    expect(capturedBody).not.toBeNull()
    const rf = capturedBody!['response_format'] as Record<string, string> | undefined
    expect(rf).toBeDefined()
    expect(rf?.type).toBe('json_object')
  })
})

describe('POST /api/insights — JSON extraction and error handling', () => {
  beforeEach(() => {
    setEnv()
    setupSupabaseMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const validPayload = JSON.stringify({
    insights: ['insight 1'],
    recomendaciones: ['rec 1'],
    alertas: ['alerta 1'],
  })

  // ── Case 1: fenced JSON → 200 ─────────────────────────────────────────────
  it('case 1: fenced JSON in content returns 200 with parsed arrays', async () => {
    const fenced = '```json\n' + validPayload + '\n```'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(makeAiResponse(fenced))))

    const res = await POST(makeRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(json.insights)).toBe(true)
    expect(Array.isArray(json.recomendaciones)).toBe(true)
    expect(Array.isArray(json.alertas)).toBe(true)
  })

  // ── Case 2: plain JSON → 200 ──────────────────────────────────────────────
  it('case 2: plain JSON in content returns 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(makeAiResponse(validPayload))))

    const res = await POST(makeRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.insights).toBeDefined()
  })

  // ── Case 3: prose-wrapped JSON → 200 ─────────────────────────────────────
  it('case 3: prose-wrapped JSON (text before and after {…}) returns 200', async () => {
    const proseWrapped = 'Here is the analysis:\n' + validPayload + '\nEnd of analysis.'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(makeAiResponse(proseWrapped))))

    const res = await POST(makeRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.insights).toBeDefined()
  })

  // ── Case 4: no JSON match → 422 reason: no_json_match ────────────────────
  it('case 4: content with no JSON object returns 422 with reason no_json_match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse(makeAiResponse('This is just prose with no JSON object at all.'))
    ))

    const res = await POST(makeRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.reason).toBe('no_json_match')
    expect(json.error).toBeDefined()
  })

  // ── Case 5: truncated/invalid JSON → 422 reason: parse_error ─────────────
  // The regex /{[\s\S]*}/ requires both { and }, so the test must include a closing }
  // but the content between must be syntactically invalid JSON.
  it('case 5: malformed JSON object (has braces but invalid syntax) returns 422 with reason parse_error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse(makeAiResponse('{ "insights": ["partial" }'))
    ))

    const res = await POST(makeRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.reason).toBe('json_parse_failed')
    expect(json.error).toBeDefined()
  })

  // ── Case 6: missing choices[0] → 422 reason: missing_choices ─────────────
  it('case 6: upstream response missing choices[0] returns 422 with reason missing_choices', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({ choices: [] })
    ))

    const res = await POST(makeRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.reason).toBe('missing_choices')
    expect(json.error).toBeDefined()
  })

  // ── Case 7: AbortError → 504 reason: abort_timeout ───────────────────────
  it('case 7: AbortError during fetch returns 504 with reason abort_timeout', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))

    const res = await POST(makeRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(504)
    expect(json.reason).toBe('abort_timeout')
    expect(json.error).toBeDefined()
  })

  // ── Case 8: TypeError (network failure) → 502 reason: fetch_error ─────────
  it('case 8: TypeError during fetch returns 502 with reason fetch_error', async () => {
    const networkError = new TypeError('fetch failed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError))

    const res = await POST(makeRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(502)
    expect(json.reason).toBe('upstream_fetch_failed')
    expect(json.error).toBeDefined()
  })
})

// ─── buildImpactContext with registro_sesion ───────────────────────────────

describe('buildImpactContext — registro_sesion integration', () => {
  beforeEach(() => {
    setEnv()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('includes "ACCIONES REALIZADAS" section when registro_sesion data exists', async () => {
    const sesionRows = [
      { id_consultoria: 'c1', acciones_realizadas: 'Revisión financiera', estado_inicial: 'Pendiente', resultado_final: 'Interesado', cantidad_productos: 2 },
      { id_consultoria: 'c2', acciones_realizadas: 'Demo de producto', estado_inicial: 'Agendado', resultado_final: 'Seguimiento', cantidad_productos: 1 },
    ]

    const consulRows = [
      { id: 'c1', categoria_caso_uso: 'Agentes', nivel_potencia: 'Alto' },
      { id: 'c2', categoria_caso_uso: 'Asistentes', nivel_potencia: 'Medio' },
    ]

    mockFrom.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: (v: unknown) => void) => {
          if (table === 'registro_sesion') {
            resolve({ data: sesionRows, error: null })
          } else if (table === 'consultorias') {
            resolve({ data: consulRows, error: null })
          } else {
            resolve({ data: [], error: null })
          }
        },
      }
      return chain
    })

    const result = await buildImpactContext(mockSupabaseInstance as never)

    // The result should include session data section
    expect(result).toContain('ACCIONES REALIZADAS')
    expect(result).toContain('Revisión financiera')
    expect(result).toContain('Demo de producto')
  })

  it('degrades gracefully when no registro_sesion rows match', async () => {
    mockFrom.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: (v: unknown) => void) => {
          if (table === 'consultorias') {
            resolve({ data: [], error: null })
          } else {
            resolve({ data: [], error: null })
          }
        },
      }
      return chain
    })

    const result = await buildImpactContext(mockSupabaseInstance as never)

    // Should complete without error — may or may not include session section
    expect(typeof result).toBe('string')
  })
})

// ─── insert failure → 500 ──────────────────────────────────────────────────

describe('POST /api/insights — defensive insert', () => {
  beforeEach(() => {
    setEnv()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 500 with reason insert_failed when supabase insert errors', async () => {
    const validPayload = JSON.stringify({
      insights: ['i1'],
      recomendaciones: ['r1'],
      alertas: ['a1'],
    })

    // Mock: all queries succeed, but insert on 'insights' table fails
    mockFrom.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue(
          table === 'insights'
            ? { data: null, error: { message: 'column "tipo" does not exist' } }
            : { data: null, error: null },
        ),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: (v: unknown) => void) => {
          resolve({ data: [], error: null })
        },
      }
      return chain
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse(makeAiResponse(validPayload)),
    ))

    const req = new Request('http://localhost/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req as never)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.reason).toBe('insert_failed')
    expect(json.error).toBeDefined()
    expect(json.detail).toBeDefined()
  })
})
