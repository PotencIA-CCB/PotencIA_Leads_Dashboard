export function extractNombreCompleto(body: Record<string, string | undefined>): string {
  return (body.full_name ?? body.nombre ?? '').trim()
}
