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

  it('usa reasoning cuando es el unico campo con texto', async () => {
    // OpenRouter normaliza el razonamiento a message.reasoning. reasoning_content
    // es el nombre de la API directa de DeepSeek; por OpenRouter no llega.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({ choices: [{ message: { content: null, reasoning: PAYLOAD } }] })
    ))

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.insights).toHaveLength(1)
  })

  it('usa reasoning_details[].text cuando reasoning viene estructurado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({
        choices: [{
          message: {
            content: null,
            reasoning_details: [
              { type: 'reasoning.text', text: 'Reviso las acciones. ' },
              { type: 'reasoning.text', text: PAYLOAD },
            ],
          },
        }],
      })
    ))

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.insights).toHaveLength(1)
  })

  it('prefiere content sobre reasoning cuando ambos traen texto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({
        choices: [{ message: { content: PAYLOAD, reasoning: '{"insights":[{"titulo":"ruido","detalle":"x","tipo":"patron"}]}' } }],
      })
    ))

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(data.insights[0].titulo).toBe('Especialista en n8n')
  })

  it('cuando no hay contenido en ningun campo responde 502 con las claves reales del mensaje', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({
        id: 'gen-1',
        choices: [{ finish_reason: 'length', message: { role: 'assistant', content: null } }],
        usage: { completion_tokens: 600, completion_tokens_details: { reasoning_tokens: 600 } },
      })
    ))

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(502)
    expect(data.reason).toBe('missing_content')
    expect(data.debug.choicesLen).toBe(1)
    // Sin estas tres no se puede distinguir "campo con otro nombre" de
    // "el razonamiento se comio el presupuesto de tokens".
    expect(data.debug.messageKeys).toEqual(['role', 'content'])
    expect(data.debug.finishReason).toBe('length')
    expect(data.debug.usage.completion_tokens_details.reasoning_tokens).toBe(600)
  })

  it('si el texto no es JSON, el 502 de parseo incluye finishReason y usage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeFetchResponse({
        choices: [{ finish_reason: 'length', message: { content: null, reasoning: 'Estoy pensando en las acciones y' } }],
        usage: { completion_tokens: 600 },
      })
    ))

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(502)
    expect(data.reason).toBe('parse_error')
    expect(data.finishReason).toBe('length')
    expect(data.usage.completion_tokens).toBe(600)
    expect(data.raw).toContain('Estoy pensando')
  })

  it('pide max_tokens suficiente para que el razonamiento no agote el presupuesto', async () => {
    // En produccion con max_tokens 600 el modelo gastaba reasoning_tokens 600 y
    // devolvia finish_reason 'length' sin llegar a escribir el JSON.
    let capturedBody: Record<string, unknown> | null = null
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedBody = JSON.parse(opts.body as string) as Record<string, unknown>
      return Promise.resolve(makeFetchResponse({ choices: [{ message: { content: PAYLOAD } }] }))
    }))

    await POST(makeRequest())

    expect(capturedBody).not.toBeNull()
    expect(capturedBody!['max_tokens']).toBe(2000)
  })

  it('aborta si el cuerpo de la respuesta se queda colgado, sin llegar al maxDuration', async () => {
    // El clearTimeout se llamaba en cuanto fetch resolvia las cabeceras, asi que
    // leer el cuerpo quedaba sin limite: la funcion corria hasta los 60s de
    // maxDuration y Vercel devolvia 504 en vez del 502 de la ruta.
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, opts: RequestInit) => Promise.resolve({
      ok: true,
      status: 200,
      // Cabeceras al instante, cuerpo que no llega nunca salvo que aborte la senal.
      json: () => new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
      text: () => Promise.resolve(''),
    } as unknown as Response)))

    const pending = POST(makeRequest())
    await vi.advanceTimersByTimeAsync(46_000)
    const res = await pending

    expect(res.status).toBe(502)
    expect((await res.json()).error).toContain('timeout')
    vi.useRealTimers()
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
