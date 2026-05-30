'use client'

import { useEffect, useState } from 'react'
import { createClient, getCurrentConsultor } from '@/lib/supabase-browser'
import type { Novedad, NovedadTipo } from '@/types'

export function useNovedades() {
  const [novedades, setNovedades] = useState<(Novedad & { consultor_nombre?: string })[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNovedades = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('novedades')
      .select('*, consultores!inner(nombre)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setNovedades(data.map((n: Record<string, unknown>) => ({
        ...n,
        consultor_nombre: (n.consultores as { nombre: string })?.nombre ?? null,
      })) as (Novedad & { consultor_nombre?: string })[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchNovedades()
  }, [])

  return { novedades, loading, refetch: fetchNovedades }
}

export async function createNovedad(payload: {
  titulo: string
  contenido: string
  tipo: NovedadTipo
  fecha_inicio?: string | null
  fecha_fin?: string | null
  id_lead?: string | null
  id_consultoria?: string | null
  indicadores?: Record<string, unknown>
}) {
  const me = await getCurrentConsultor()
  if (!me) throw new Error('No autorizado')

  const supabase = createClient()
  const { data, error } = await supabase.from('novedades').insert({
    id_consultor: me.id,
    titulo: payload.titulo,
    contenido: payload.contenido,
    tipo: payload.tipo,
    fecha_inicio: payload.fecha_inicio ?? null,
    fecha_fin: payload.fecha_fin ?? null,
    id_lead: payload.id_lead ?? null,
    id_consultoria: payload.id_consultoria ?? null,
    indicadores: payload.indicadores ?? {},
  }).select().single()

  if (error) throw error
  return data as Novedad
}

export async function updateNovedad(
  id: string,
  updates: {
    titulo?: string
    contenido?: string
    tipo?: NovedadTipo
    fecha_inicio?: string | null
    fecha_fin?: string | null
  },
) {
  const supabase = createClient()
  const { error } = await supabase.from('novedades').update(updates).eq('id', id)
  if (error) throw error
}

/** Borra una novedad. La RLS solo permite borrar las propias (o admin). */
export async function deleteNovedad(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('novedades').delete().eq('id', id)
  if (error) throw error
}
