/**
 * Unit tests for the novedades hook write helpers.
 *
 * Strategy: mock '@/lib/supabase-browser' so no real client is created.
 * We only exercise the exported async functions (createNovedad, updateNovedad,
 * deleteNovedad) — not the React hook itself.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { createClient, getCurrentConsultor } from '@/lib/supabase-browser'
import { createNovedad, updateNovedad, deleteNovedad } from '../useNovedades'

vi.mock('@/lib/supabase-browser', () => ({
  createClient: vi.fn(),
  getCurrentConsultor: vi.fn(),
}))

describe('useNovedades write helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createNovedad writes id_consultor (self) plus fecha_inicio/fecha_fin', async () => {
    ;(getCurrentConsultor as Mock).mockResolvedValue({ id: 'me-1', rol: 'consultor' })
    const single = vi.fn().mockResolvedValue({ data: { id: 'n1' }, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    ;(createClient as Mock).mockReturnValue({ from: vi.fn().mockReturnValue({ insert }) })

    await createNovedad({
      titulo: 'Feria BIZ',
      contenido: 'No atiendo',
      tipo: 'evento',
      fecha_inicio: '2026-06-02',
      fecha_fin: '2026-06-04',
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id_consultor: 'me-1',
        tipo: 'evento',
        fecha_inicio: '2026-06-02',
        fecha_fin: '2026-06-04',
      }),
    )
  })

  it('createNovedad defaults missing dates to null', async () => {
    ;(getCurrentConsultor as Mock).mockResolvedValue({ id: 'me-1', rol: 'consultor' })
    const single = vi.fn().mockResolvedValue({ data: { id: 'n1' }, error: null })
    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) })
    ;(createClient as Mock).mockReturnValue({ from: vi.fn().mockReturnValue({ insert }) })

    await createNovedad({ titulo: 'RAG', contenido: 'Implementé RAG', tipo: 'caso_de_uso' })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ fecha_inicio: null, fecha_fin: null }),
    )
  })

  it('createNovedad throws when there is no authenticated consultor', async () => {
    ;(getCurrentConsultor as Mock).mockResolvedValue(null)
    await expect(
      createNovedad({ titulo: 'x', contenido: 'y', tipo: 'otro' }),
    ).rejects.toThrow('No autorizado')
  })

  it('updateNovedad patches the row by id', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    ;(createClient as Mock).mockReturnValue({ from: vi.fn().mockReturnValue({ update }) })

    await updateNovedad('n1', { titulo: 'nuevo', fecha_inicio: '2026-06-05' })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: 'nuevo', fecha_inicio: '2026-06-05' }),
    )
    expect(eq).toHaveBeenCalledWith('id', 'n1')
  })

  it('deleteNovedad deletes by id and resolves on success', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ delete: del })
    ;(createClient as Mock).mockReturnValue({ from })

    await expect(deleteNovedad('n1')).resolves.toBeUndefined()
    expect(from).toHaveBeenCalledWith('novedades')
    expect(eq).toHaveBeenCalledWith('id', 'n1')
  })

  it('deleteNovedad throws when supabase returns an error (e.g. RLS denies)', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'permission denied' } })
    const del = vi.fn().mockReturnValue({ eq })
    ;(createClient as Mock).mockReturnValue({ from: vi.fn().mockReturnValue({ delete: del }) })

    await expect(deleteNovedad('n1')).rejects.toBeDefined()
  })
})
