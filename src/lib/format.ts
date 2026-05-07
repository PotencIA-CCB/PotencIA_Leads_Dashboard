/**
 * Formatters compartidos para texto que viene del Form PotencIA.
 */

/**
 * El Form PotencIA guarda el caso de uso slugificado (con guiones en lugar de espacios).
 * Esta función lo restaura a texto legible para mostrar en cards, modal y métricas.
 *
 * Ejemplos:
 *   "buzon-de-correo-inteligente"  → "Buzón de correo inteligente"
 *   "  análisis-de-datos  "        → "Análisis de datos"
 */
export function formatUseCase(text: string | null | undefined): string {
  if (!text) return ''
  const cleaned = text.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned.length === 0) return ''
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
