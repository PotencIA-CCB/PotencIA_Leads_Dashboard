'use client'

/**
 * ToolsCloud — presentational component for the "Herramientas IA más usadas" section.
 *
 * UI polish (post-merge, branch feat/herramientas-ia-cloud-ui):
 * Redesigned from uniform pill chips into a TRUE distributed word cloud.
 * Each tool renders as colored text whose SIZE and WEIGHT scale with frequency.
 * No pill chrome and no visible count number. The count drives size/weight only;
 * it stays available via title + aria-label for hover/accessibility.
 *
 * Design direction: luxury/refined editorial — PotencIA navy-to-cyan palette,
 * Space Grotesk typeface, generous breathing room, organic word distribution
 * via size variance (big and small words interleave naturally by count desc order).
 *
 * Design refs: Section 5 — PotencIA palette, word-cloud scaleWeight formula,
 * skeleton loading, branded empty state.
 *
 * scaleWeight formula (redesigned):
 *   ratio    = count / maxCount  (clamped 0..1)
 *   fontSize = 14 + ratio * 42  (14px min → 56px max)
 *   fontWeight = Math.round(500 + ratio * 300)  (500 min → 800 max, integer)
 *
 * Props:
 *   tools  — { label: string; count: number }[] from GET /api/herramientas
 *   status — 'loading' | 'ready' | 'error'
 *
 * Exports:
 *   default  ToolsCloud   — the component
 *   named    scaleWeight  — pure helper (exported for unit testing)
 */

export interface ToolItem {
  label: string
  count: number
}

export type ToolsStatus = 'loading' | 'ready' | 'error'

interface ToolsCloudProps {
  tools: ToolItem[]
  status: ToolsStatus
}

/**
 * Compute font size and weight for a word-cloud token based on its count
 * relative to the max count.
 *
 * Formula (redesigned for word-cloud dominance hierarchy):
 *   ratio    = count / maxCount  (clamped 0..1)
 *   fontSize = 14 + ratio * 42   (14px min → 56px max)
 *   fontWeight = Math.round(500 + ratio * 300)  (500 min → 800 max, integer)
 *
 * Edge cases:
 *   - maxCount = 0 → ratio = 0 → returns minimum values (no divide-by-zero)
 *   - count > maxCount → ratio clamped to 1 → returns maximum values
 */
export function scaleWeight(count: number, maxCount: number): { fontSize: number; fontWeight: number } {
  if (maxCount <= 0) {
    return { fontSize: 14, fontWeight: 500 }
  }
  const ratio = Math.min(count / maxCount, 1)
  const fontSize = 14 + ratio * 42
  const fontWeight = Math.round(500 + ratio * 300)
  return { fontSize, fontWeight }
}

// ---------------------------------------------------------------------------
// Tier helpers — color tier based on frequency ratio
// ---------------------------------------------------------------------------

type WordTier = 'primary' | 'mid' | 'accent' | 'tail'

function getWordTier(ratio: number): WordTier {
  if (ratio >= 0.65) return 'primary'
  if (ratio >= 0.4) return 'mid'
  if (ratio >= 0.2) return 'accent'
  return 'tail'
}

const TIER_COLORS: Record<WordTier, string> = {
  // Top tools: deep navy — dominant, authoritative
  primary: '#001d59',
  // Mid-tier: rich blue
  mid: '#003087',
  // Accent: electric blue — energetic
  accent: '#0057D9',
  // Long tail: muted slate — recessive, supporting
  tail: '#5A6475',
}

// Subtle hover color shift per tier
const TIER_HOVER_COLORS: Record<WordTier, string> = {
  primary: '#004BB5',
  mid: '#0057D9',
  accent: '#00C8FF',
  tail: '#004BB5',
}

// ---------------------------------------------------------------------------
// Loading skeleton — cloud-shaped varied widths/heights
// ---------------------------------------------------------------------------

const SKELETON_ITEMS = [
  { width: 80, height: 36 },
  { width: 120, height: 52 },
  { width: 64, height: 28 },
  { width: 160, height: 64 },
  { width: 96, height: 42 },
  { width: 140, height: 56 },
  { width: 72, height: 32 },
  { width: 112, height: 48 },
  { width: 56, height: 26 },
  { width: 128, height: 50 },
]

function ToolsSkeleton() {
  return (
    <div
      className="flex flex-wrap justify-center items-baseline gap-x-6 gap-y-4 px-8 py-10 min-h-[180px]"
      aria-busy="true"
      aria-label="Cargando herramientas"
    >
      {SKELETON_ITEMS.map((item, i) => (
        <div
          key={i}
          className="rounded-md bg-slate-100 animate-pulse"
          style={{
            width: `${item.width}px`,
            height: `${item.height}px`,
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ToolsCloud({ tools, status }: ToolsCloudProps) {
  // Loading state
  if (status === 'loading') {
    return <ToolsSkeleton />
  }

  // Error state — non-blocking, page must still render around it
  if (status === 'error') {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-red-500/80 px-6">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          error_outline
        </span>
        <span>No fue posible cargar las herramientas. Intenta recargar la página.</span>
      </div>
    )
  }

  // Empty state — branded, not a blank box (spec 4.3)
  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
        <span
          className="material-symbols-outlined text-[32px] text-[#00C8FF]/60"
          aria-hidden="true"
        >
          category
        </span>
        <p className="text-sm font-medium text-[#5A6475]">Aún no hay datos de herramientas</p>
        <p className="text-[11px] text-slate-400 max-w-xs">
          Las herramientas de IA y software surgirán aquí después de la próxima generación.
        </p>
      </div>
    )
  }

  // Populated state — word cloud
  const maxCount = tools[0]?.count ?? 1

  return (
    <div
      className="flex flex-wrap justify-center items-baseline gap-x-5 gap-y-3 px-8 py-10 min-h-[180px]"
      role="list"
      aria-label="Herramientas de IA y software más usadas"
    >
      {tools.map((tool) => {
        const { fontSize, fontWeight } = scaleWeight(tool.count, maxCount)
        const ratio = maxCount > 0 ? Math.min(tool.count / maxCount, 1) : 0
        const tier = getWordTier(ratio)
        const color = TIER_COLORS[tier]
        const hoverColor = TIER_HOVER_COLORS[tier]

        return (
          <span
            key={tool.label}
            role="listitem"
            aria-label={`${tool.label}: ${tool.count} menciones`}
            title={`${tool.label}: ${tool.count} menciones`}
            className={[
              'inline-flex items-baseline gap-0.5',
              'cursor-default select-none',
              'transition-all duration-200 ease-out',
              'motion-safe:hover:scale-110',
            ].join(' ')}
            style={{
              fontSize: `${fontSize}px`,
              fontWeight,
              fontFamily: 'Space Grotesk, sans-serif',
              color,
              // Subtle letter-spacing: tighter for large dominant words
              letterSpacing: ratio >= 0.65 ? '-0.02em' : ratio >= 0.4 ? '-0.01em' : '0em',
              // CSS custom property trick for hover — handled by Tailwind motion-safe:hover:scale-110
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = hoverColor
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = color
            }}
          >
            {tool.label}
          </span>
        )
      })}
    </div>
  )
}
