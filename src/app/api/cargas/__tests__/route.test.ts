/**
 * TDD tests para POST /api/cargas.
 *
 * Cubre:
 *  A1. Sin sesión → 403
 *  A2. Consultor no admin → 403
 *  A3. No se instancia el cliente de servicio antes de autorizar (R3)
 *  V1. Cuerpo que no es JSON → 400
 *  V2. Acción inválida → 400
 *  V3. Tipo inválido → 400
 *  V4. filas que no es arreglo → 400
 *  N1. El servidor normaliza él mismo y descarta filas inválidas (R5)
 *  N2. Numeración de filas: la primera de datos es la fila 2 (encabezado = 1)
 *  R1. preview invoca el RPC con p_dry_run true
 *  R2. commit invoca el RPC con p_dry_run false
 *  R3. Una sola invocación de RPC sin importar el número de filas (R7)
 *  R4. Los resultados del RPC se agregan en creadas / actualizadas / fallidas
 *  R5. Los avisos del RPC llegan a la respuesta
 *  R6. Error del RPC → 500
 *  L1. Los logs no contienen datos personales de las filas (R15)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock del cliente de servicio ────────────────────────────────────────────

const mockRpc = vi.fn()
const mockServiceInstance = { rpc: mockRpc }
const mockCreateServiceClient = vi.fn(() => mockServiceInstance)

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateServiceClient(...(args as [])),
}))

// ─── Mock del cliente de sesión ──────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockSingle = vi.fn()

const mockSessionInstance = {
  auth: { getUser: mockGetUser },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ single: mockSingle })),
    })),
  })),
}

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(async () => mockSessionInstance),
}))

// ─── Importar el handler DESPUÉS de los mocks ────────────────────────────────

import { POST } from '../route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pedir(body: unknown): Request {
  return new Request('http://localhost/api/cargas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function filaBooking(valores: Record<string, string> = {}): Record<string, string> {
  return {
    'Date Time': '15/09/2026 14:30',
    'Customer Name': 'Ana Pérez',
    'Customer Email': 'ana@empresa.com',
    'Customer Phone': '3001234567',
    'Staff Name': 'Carlos',
    'Staff Email': 'carlos@camarabaq.org.co',
    'Service': 'Consultoría',
    'Duration (mins.)': '60',
    'Booking Id': 'BK-001',
    'Custom Fields': '',
    ...valores,
  }
}

function comoAdmin() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
  mockSingle.mockResolvedValue({ data: { rol: 'admin' }, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ejemplo.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba'
  mockRpc.mockResolvedValue({ data: [], error: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Autorización ────────────────────────────────────────────────────────────

describe('POST /api/cargas — autorización', () => {
  it('A1: responde 403 sin sesión', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(pedir({ accion: 'preview', tipo: 'bookings', filas: [] }) as never)
    expect(res.status).toBe(403)
  })

  it('A2: responde 403 para un consultor que no es admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
    mockSingle.mockResolvedValue({ data: { rol: 'consultor' }, error: null })
    const res = await POST(pedir({ accion: 'preview', tipo: 'bookings', filas: [] }) as never)
    expect(res.status).toBe(403)
  })

  it('A3: no instancia el cliente de servicio si la autorización falla', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    await POST(pedir({ accion: 'commit', tipo: 'bookings', filas: [filaBooking()] }) as never)
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

// ─── Validación del cuerpo ───────────────────────────────────────────────────

describe('POST /api/cargas — validación', () => {
  beforeEach(comoAdmin)

  it('V1: responde 400 con un cuerpo que no es JSON', async () => {
    const req = new Request('http://localhost/api/cargas', { method: 'POST', body: 'no json' })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('V2: responde 400 con una acción inválida', async () => {
    const res = await POST(pedir({ accion: 'borrar', tipo: 'bookings', filas: [] }) as never)
    expect(res.status).toBe(400)
  })

  it('V3: responde 400 con un tipo inválido', async () => {
    const res = await POST(pedir({ accion: 'preview', tipo: 'facturas', filas: [] }) as never)
    expect(res.status).toBe(400)
  })

  it('V4: responde 400 si filas no es un arreglo', async () => {
    const res = await POST(pedir({ accion: 'preview', tipo: 'bookings', filas: 'nope' }) as never)
    expect(res.status).toBe(400)
  })
})

// ─── Normalización del lado servidor ─────────────────────────────────────────

describe('POST /api/cargas — normalización autoritativa', () => {
  beforeEach(comoAdmin)

  it('N1: descarta una fila cruda inválida antes de invocar el RPC', async () => {
    const res = await POST(pedir({
      accion: 'commit',
      tipo: 'bookings',
      filas: [filaBooking({ 'Customer Email': 'sin-arroba' })],
    }) as never)

    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.fallidas).toHaveLength(1)
    expect(body.fallidas[0].fila).toBe(2)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('N2: numera la primera fila de datos como fila 2', async () => {
    const res = await POST(pedir({
      accion: 'commit',
      tipo: 'bookings',
      filas: [
        filaBooking({ 'Customer Email': 'sin-arroba' }),
        filaBooking({ 'Customer Email': 'tampoco' }),
      ],
    }) as never)

    const body = await res.json()
    expect(body.fallidas.map((f: { fila: number }) => f.fila)).toEqual([2, 3])
  })

  it('N3: avisa de filas duplicadas dentro del mismo archivo', async () => {
    // El dry-run del RPC revierte cada fila antes de procesar la siguiente, así que
    // no puede ver duplicados intra-lote. La ruta sí, porque tiene todas las filas.
    const filas = [
      filaBooking({ 'Booking Id': 'BK-DUP' }),
      filaBooking({ 'Booking Id': 'BK-DUP' }),
    ]
    const res = await POST(pedir({ accion: 'preview', tipo: 'bookings', filas }) as never)
    const body = await res.json()

    const dup = body.avisos.filter((a: { fila: number; motivo: string }) => /duplicado/i.test(a.motivo))
    expect(dup).toHaveLength(1)
    expect(dup[0].fila).toBe(3)
    expect(dup[0].motivo).toContain('fila 2')
  })

  it('N4: no avisa de duplicado cuando las claves difieren', async () => {
    const filas = [
      filaBooking({ 'Booking Id': 'BK-1' }),
      filaBooking({ 'Booking Id': 'BK-2' }),
    ]
    const res = await POST(pedir({ accion: 'preview', tipo: 'bookings', filas }) as never)
    const body = await res.json()
    expect(body.avisos.filter((a: { motivo: string }) => /duplicado/i.test(a.motivo))).toHaveLength(0)
  })
})

// ─── Invocación del RPC ──────────────────────────────────────────────────────

describe('POST /api/cargas — RPC', () => {
  beforeEach(comoAdmin)

  it('R1: preview invoca el RPC con p_dry_run true', async () => {
    await POST(pedir({ accion: 'preview', tipo: 'bookings', filas: [filaBooking()] }) as never)
    expect(mockRpc).toHaveBeenCalledWith('ingest_bookings', expect.objectContaining({ p_dry_run: true }))
  })

  it('R2: commit invoca el RPC con p_dry_run false', async () => {
    await POST(pedir({ accion: 'commit', tipo: 'bookings', filas: [filaBooking()] }) as never)
    expect(mockRpc).toHaveBeenCalledWith('ingest_bookings', expect.objectContaining({ p_dry_run: false }))
  })

  it('R3: hace una sola invocación de RPC con 50 filas', async () => {
    const filas = Array.from({ length: 50 }, (_, i) => filaBooking({ 'Booking Id': `BK-${i}` }))
    await POST(pedir({ accion: 'commit', tipo: 'bookings', filas }) as never)
    expect(mockRpc).toHaveBeenCalledTimes(1)
    const args = mockRpc.mock.calls[0]![1] as { p_filas: unknown[] }
    expect(args.p_filas).toHaveLength(50)
  })

  it('R4: agrega los resultados en creadas, actualizadas y fallidas', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { fila: 2, accion: 'creada', aviso: null, error: null },
        { fila: 3, accion: 'actualizada', aviso: null, error: null },
        { fila: 4, accion: null, aviso: null, error: 'violates check constraint' },
      ],
      error: null,
    })

    const filas = [filaBooking(), filaBooking({ 'Booking Id': 'BK-2' }), filaBooking({ 'Booking Id': 'BK-3' })]
    const res = await POST(pedir({ accion: 'commit', tipo: 'bookings', filas }) as never)
    const body = await res.json()

    expect(body.creadas).toBe(1)
    expect(body.actualizadas).toBe(1)
    expect(body.fallidas).toEqual([{ fila: 4, motivo: 'violates check constraint' }])
  })

  it('R5: propaga los avisos del RPC a la respuesta', async () => {
    mockRpc.mockResolvedValue({
      data: [{ fila: 2, accion: 'creada', aviso: 'staff sin consultor', error: null }],
      error: null,
    })

    const res = await POST(pedir({ accion: 'preview', tipo: 'bookings', filas: [filaBooking()] }) as never)
    const body = await res.json()

    expect(body.avisos).toContainEqual({ fila: 2, motivo: 'staff sin consultor' })
  })

  it('R6: responde 500 cuando el RPC devuelve error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await POST(pedir({ accion: 'commit', tipo: 'bookings', filas: [filaBooking()] }) as never)
    expect(res.status).toBe(500)
  })

  it('usa ingest_sesiones para el tipo sesiones', async () => {
    const filaSesion = {
      'Id': 'SES-1',
      'Fecha de la Sesión': '2026-09-15',
      'Correo del Usuario Atendido': 'ana@empresa.com',
      'Nombre del Usuario Atendido': 'Ana Pérez',
      'Resultado de la sesión': 'Resuelto',
    }
    await POST(pedir({ accion: 'commit', tipo: 'sesiones', filas: [filaSesion] }) as never)
    expect(mockRpc).toHaveBeenCalledWith('ingest_sesiones', expect.objectContaining({ p_dry_run: false }))
  })
})

// ─── Logs sin datos personales ───────────────────────────────────────────────

describe('POST /api/cargas — logs', () => {
  beforeEach(comoAdmin)

  it('L1: no escribe datos personales en los logs', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    await POST(pedir({
      accion: 'commit',
      tipo: 'bookings',
      filas: [filaBooking({ 'Customer Email': 'ana.perez@empresa.com', 'Customer Name': 'Ana Pérez' })],
    }) as never)

    const registrado = spy.mock.calls.flat().map(String).join(' ')
    expect(registrado).not.toContain('ana.perez@empresa.com')
    expect(registrado).not.toContain('Ana Pérez')
    expect(registrado).not.toContain('3001234567')
  })
})
