/**
 * wordcloud-filter.ts
 * Pure utilities for filtering processText() output to AI/automation terms only.
 * Designed to run in Cloudflare Workers (no canvas, no Node-only deps).
 *
 * IMPORTANT: This module is composed AFTER processText().
 * processText() already:
 *   - lowercases and strips accents
 *   - drops tokens < 4 chars (so ia/ml/rpa/nlp/gpt/bot/erp/crm are unreachable)
 *   - removes stop words
 *   - Title-cases the final output
 * Therefore AI_TERMS uses 4+ char accent-free lowercase stems and matching is
 * case-insensitive startsWith so Title-cased tokens are handled correctly.
 */

export interface WordData {
  text: string
  count: number
}

/**
 * Accent-free lowercase stems (4+ chars).
 * Sub-4-char acronyms (ia, ml, rpa, nlp, gpt, bot, erp, crm) are dropped by
 * processText() BEFORE this function runs and cannot appear in input.
 * `bots` (4 chars) and `chatbot` (7 chars) are reachable.
 */
export const AI_TERMS: readonly string[] = [
  // Core AI / ML concepts
  'automatiz',    // automatizacion, automatizar, automatizado
  'inteligencia', // inteligencia (artificial)
  'artificial',   // artificial (inteligencia)
  'agente',       // agente, agentes
  'chatbot',      // chatbot, chatbots
  'machine',      // machine (learning)
  'learning',     // learning (machine)
  'modelo',       // modelo, modelos
  'prediccion',   // prediccion, predicciones
  'asistente',    // asistente, asistentes
  'prototipo',    // prototipo, prototipos
  // Digitalization / automation
  'digitaliz',    // digitalizacion, digitalizar, digitalizado
  'transformaci', // transformacion digital
  'optimizaci',   // optimizacion
  'implementar',  // implementar, implementacion
  'eficiencia',   // eficiencia
  'productividad',// productividad
  'innovaci',     // innovacion
  // Data / tech terms
  'datos',        // datos
  'procesar',     // procesar
  'algoritmo',    // algoritmo, algoritmos
  'integraci',    // integracion, integrar
  'plataforma',   // plataforma, plataformas
  'workflow',     // workflow
  'proceso',      // 'proceso' is a stop word in WordCloud.tsx, so only 'procesos' (plural) reaches here and matches via startsWith
  'sistema',      // sistema, sistemas
  'tecnologi',    // tecnologia, tecnologias
  'solucion',     // solucion, soluciones
  // Industry-specific AI terms
  'bots',         // bots (4 chars, reachable)
  'herramienta',  // herramienta, herramientas
  'generativ',    // generativa, generativo (IA generativa)
  'lenguaje',     // lenguaje natural
  'clasificaci',  // clasificacion
  'analisis',     // analisis (de datos)
  'visualizaci',  // visualizacion
  'programaci',   // programacion
  'aplicaci',     // aplicacion, aplicaciones
]

/**
 * Filters a WordData[] (output of processText()) to keep only tokens
 * that match an AI/automation stem from AI_TERMS.
 *
 * Matching rules:
 * - Case-insensitive: token.text.toLowerCase() is compared
 * - Stem startsWith: token matches if its lowercased form starts with any stem
 * - Pure function: does NOT mutate input
 *
 * @param tokens - Output of processText() — Title-cased, accent-free tokens
 * @returns Filtered subset of tokens matching AI/automation stems; order preserved
 */
export function filterByAiTerms(tokens: WordData[]): WordData[] {
  return tokens.filter((token) => {
    const lower = token.text.toLowerCase()
    return AI_TERMS.some((stem) => lower.startsWith(stem))
  })
}
