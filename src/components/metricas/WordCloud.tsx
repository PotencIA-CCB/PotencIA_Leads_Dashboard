'use client'

import { useMemo } from 'react'
import { filterByAiTerms } from '@/lib/wordcloud-filter'

// Most common Spanish stop words to filter out
const SPANISH_STOP_WORDS = new Set([
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'se', 'del',
  'las', 'un', 'por', 'con', 'no', 'una', 'su', 'para', 'es',
  'al', 'lo', 'como', 'más', 'o', 'pero', 'sus', 'le', 'ha',
  'me', 'si', 'sin', 'sobre', 'este', 'ya', 'entre', 'cuando',
  'todo', 'esta', 'ser', 'son', 'dos', 'también', 'fue', 'era',
  'muy', 'años', 'desde', 'mi', 'porque', 'qué', 'solo', 'han',
  'yo', 'hay', 'vez', 'puede', 'todos', 'así', 'nos', 'ni',
  'parte', 'tiene', 'él', 'uno', 'donde', 'bien', 'tiempo',
  'mismo', 'ese', 'ahora', 'cada', 'e', 'vida', 'después',
  'te', 'otros', 'aunque', 'esa', 'eso', 'hace', 'otra',
  'tan', 'durante', 'siempre', 'día', 'tanto', 'ella', 'tres',
  'sí', 'gran', 'manera', 'cual', 'hacer', 'poder', 'tener',
  'decir', 'ir', 'ver', 'dar', 'saber', 'querer', 'llegar',
  'pasar', 'deber', 'poner', 'parecer', 'quedar', 'creer',
  'hablar', 'llevar', 'dejar', 'seguir', 'encontrar', 'llamar',
  'entonces', 'además', 'luego', 'ademas', 'asi', 'sino',
  'sea', 'estar', 'van', 'uso', 'caso', 'tipo', 'forma',
  'nivel', 'proceso', 'tema', 'temas', 'sesion', 'sesión',
])

interface WordData {
  text: string
  count: number
}

function processText(sentences: string[]): WordData[] {
  const wordCounts: Record<string, number> = {}

  for (const sentence of sentences) {
    if (!sentence) continue
    // Tokenize: lowercase, split on non-alphanumeric chars (keep Spanish accents)
    const tokens = sentence
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents for dedup
      .split(/[^a-záéíóúüñ0-9]+/i)
      .filter(Boolean)

    for (const token of tokens) {
      // Skip short words, numbers-only, and stop words
      if (token.length < 4) continue
      if (/^\d+$/.test(token)) continue
      if (SPANISH_STOP_WORDS.has(token)) continue

      wordCounts[token] = (wordCounts[token] || 0) + 1
    }
  }

  // Sort by frequency and take top 40
  return Object.entries(wordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 40)
    .map(([text, count]) => ({ text: text.replace(/\b\w/g, (c) => c.toUpperCase()), count }))
}

// Color palette for the tag cloud
const COLORS = [
  'text-[#003087]',  // PotencIA navy
  'text-[#00C8FF]',  // PotencIA cyan
  'text-[#004BB5]',  // Medium blue
  'text-[#5A6475]',  // Slate
  'text-[#1e40af]',  // Blue-800
  'text-[#0891b2]',  // Cyan-600
  'text-[#6366f1]',  // Indigo-500
]

interface WordCloudProps {
  sentences: string[]
}

export default function WordCloud({ sentences }: WordCloudProps) {
  const words = useMemo(() => filterByAiTerms(processText(sentences)), [sentences])

  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        Sin términos AI encontrados
      </div>
    )
  }

  const maxCount = words[0]?.count ?? 1

  return (
    <div className="flex flex-wrap justify-center gap-3 p-4" role="list" aria-label="Nube de palabras">
      {words.map((word, i) => {
        // Scale font size from 12px (least frequent) to 48px (most frequent)
        const ratio = word.count / maxCount
        const fontSize = 12 + ratio * 36 // 12px to 48px
        const color = COLORS[i % COLORS.length]

        return (
          <span
            key={word.text}
            role="listitem"
            className={`${color} font-bold leading-tight cursor-default transition-transform hover:scale-110`}
            style={{ fontSize: `${fontSize}px` }}
            title={`${word.text}: ${word.count} menciones`}
          >
            {word.text}
          </span>
        )
      })}
    </div>
  )
}

export { processText }
