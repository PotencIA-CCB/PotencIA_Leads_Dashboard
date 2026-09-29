/**
 * Tests para POST /api/consultor-insights.
 *
 * El modelo en produccion es deepseek/deepseek-v4.1-flash. Las variantes de
 * DeepSeek devuelven la respuesta en choices[0].message.reasoning_content y
 * dejan content vacio. /api/insights (commit db5ef53) y tools-extraction.ts ya
 * contemplan ese caso; esta ruta se escribio despues sin el fallback y por eso
 * devolvia 502 {"error":"JSON parse failed","raw":""}.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock @supabase/supabase-js ───────────────────────────────────────────────
// La ruta encadena: insights(cache) → consultorias → registro_sesion → insights.insert
const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null })

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    insert: insertSpy,
    then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
  }
  for (const m of ['select', 'eq', 'gte', 'in', 'not', 'order', 'limit']) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

// Cache vacia, una consultoria y una sesion con acciones → la ruta llega al LLM.
function setupSupabaseMock() {
  insertSpy.mockClear()
  mockFrom.mockImplementation((table: string) => {
    if (table === 'consultorias') {
      return makeChain([{ id: 'c1', categoria_caso: 'Automatizacion', servicio: 'IA', status: 'Resuelto' }])
    }
    if (table === 'registro_sesion') {
      return makeChain([{ acciones_realizadas: 'Se configuro un flujo en n8n', resultado_final: 'ok' }])
    }
    return makeChain([]) // insights: sin cache
  })
}

function makeFetchResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

function setEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key'
  process.env.OPENROUTER_API_URL = 'https://api.test.com'
  process.env.OPENROUTER_MODEL = 'deepseek/deepseek-v4.1-flash'
}

import { POST } from '../route'

function makeRequest(body: Record<string, unknown> = { consultorId: 'consultor-1' }): Request {
  return new Request('http://localhost/api/consultor-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const PAYLOAD = JSON.stringify({
  insights: [{ titulo: 'Especialista en n8n', detalle: 'Configura flujos en la mayoria de sesiones.', tipo: 'herramienta' }],
})

describe('POST /api/consultor-insights — respuestas de DeepSeek', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEnv()
    setupSupabaseMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('usa reasoning_content cuando content viene vacio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({ choices: [{ message: { content: '', reasoning_content: PAYLOAD } }] })
    ))

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.insights).toHaveLength(1)
    expect(data.insights[0].titulo).toBe('Especialista en n8n')
    expect(data.insights[0].tipo).toBe('herramienta')
  })

  it('usa reasoning_content cuando content viene null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({ choices: [{ message: { content: null, reasoning_content: PAYLOAD } }] })
    ))

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.insights).toHaveLength(1)
  })

  it('sigue prefiriendo content cuando ambos vienen llenos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({ choices: [{ message: { content: PAYLOAD, reasoning_content: 'ruido de razonamiento' } }] })
    ))

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.insights[0].titulo).toBe('Especialista en n8n')
  })

  it('extrae el JSON cuando reasoning_content lo trae envuelto en prosa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({
        choices: [{ message: { content: '', reasoning_content: `Analizando las acciones...\n${PAYLOAD}\nEso es todo.` } }],
      })
    ))

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.insights).toHaveLength(1)
  })

  it('cuando no hay contenido en ningun campo responde 502 con la forma de la respuesta, no raw vacio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({ id: 'gen-1', choices: [] })
    ))

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(502)
    expect(data.reason).toBe('missing_content')
    expect(data.debug).toBeTruthy()
    expect(data.debug.choicesLen).toBe(0)
  })

  it('persiste los insights generados en la tabla insights', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({ choices: [{ message: { content: '', reasoning_content: PAYLOAD } }] })
    ))

    await POST(makeRequest())

    expect(insertSpy).toHaveBeenCalledTimes(1)
    const rows = insertSpy.mock.calls[0][0] as { metrica: string; fuente: string; id_consultor: string }[]
    expect(rows[0].metrica).toBe('Especialista en n8n')
    expect(rows[0].fuente).toBe('consultor-profile')
    expect(rows[0].id_consultor).toBe('consultor-1')
  })
})
