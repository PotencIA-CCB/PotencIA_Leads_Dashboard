export function extractNombreCompleto(body: Record<string, string | undefined>): string {
  return (body.full_name ?? body.nombre ?? '').trim()
}

/**
 * Normaliza la modalidad al único par de valores que admite el CHECK de
 * consultorias.modalidad. Cualquier texto no reconocido resuelve a 'Virtual'.
 */
export function normalizeModalidad(raw: unknown): 'Virtual' | 'Presencial' {
  if (typeof raw !== 'string') return 'Virtual'
  return /presencial/i.test(raw.trim()) ? 'Presencial' : 'Virtual'
}
