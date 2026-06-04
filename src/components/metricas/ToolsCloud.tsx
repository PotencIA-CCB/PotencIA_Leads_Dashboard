'use client'

/**
 * ToolsCloud — presentational component for the "Herramientas más usadas" section.
 *
 * Renders AI/digital tools as ranked pill chips, sized and weighted by occurrence count.
 * Deliberately styled to look like a designed data visualization, NOT a generic tag cloud.
 *
 * Design refs: Section 5 — PotencIA palette, pill chips, count badge, hover lift,
 * scaleWeight formula, skeleton loading, branded empty state.
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
 * Compute font size and weight for a tool chip based on its count relative to the max.
 *
 * Formula (design Section 5):
 *   ratio    = count / maxCount  (clamped 0..1)
 *   fontSize = 13 + ratio * 17   (13px min → 30px max)
 *   fontWeight = Math.round(500 + ratio * 200)  (500 min → 700 max, integer)
 *
 * Edge cases:
 *   - maxCount = 0 → ratio = 0 → returns minimum values (no divide-by-zero)
 *   - count > maxCount → ratio clamped to 1 → returns maximum values
 */
export function scaleWeight(count: number, maxCount: number): { fontSize: number; fontWeight: number } {
  if (maxCount <= 0) {
    return { fontSize: 13, fontWeight: 500 }
  }
  const ratio = Math.min(count / maxCount, 1)
  const fontSize = 13 + ratio * 17
  const fontWeight = Math.round(500 + ratio * 200)
  return { fontSize, fontWeight }
}

// ---------------------------------------------------------------------------
// Tier helpers — visual tier based on ratio position
// ---------------------------------------------------------------------------

type ChipTier = 'primary' | 'mid' | 'tail'

function getChipTier(ratio: number): ChipTier {
  if (ratio >= 0.65) return 'primary'
  if (ratio >= 0.3) return 'mid'
  return 'tail'
}

const TIER_CLASSES: Record<ChipTier, { text: string; bg: string; border: string }> = {
  // Top tools: navy text on cyan-tinted background
  primary: {
    text: 'text-[#003087]',
    bg: 'bg-[#E8F8FF]',
    border: 'border-[#00C8FF]',
  },
  // Mid-tier: medium blue on light blue tint
  mid: {
    text: 'text-[#004BB5]',
    bg: 'bg-[#EEF4FF]',
    border: 'border-[#004BB5]/30',
  },
  // Long tail: slate on near-white
  tail: {
    text: 'text-[#5A6475]',
    bg: 'bg-slate-50',
    border: 'border-[#E5E7EB]',
  },
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

const SKELETON_WIDTHS = ['w-24', 'w-32', 'w-20', 'w-36', 'w-28', 'w-40', 'w-16', 'w-32']

function ToolsSkeleton() {
  return (
    <div className="flex flex-wrap justify-center gap-2.5 p-6" aria-busy="true" aria-label="Cargando herramientas">
      {SKELETON_WIDTHS.map((width, i) => (
        <div
          key={i}
          className={`${width} h-8 rounded-full bg-slate-100 animate-pulse`}
          style={{ animationDelay: `${i * 80}ms` }}
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

  // Populated state
  const maxCount = tools[0]?.count ?? 1

  return (
    <div
      className="flex flex-wrap justify-center gap-2.5 p-6"
      role="list"
      aria-label="Herramientas de IA y software más usadas"
    >
      {tools.map((tool) => {
        const { fontSize, fontWeight } = scaleWeight(tool.count, maxCount)
        const ratio = maxCount > 0 ? Math.min(tool.count / maxCount, 1) : 0
        const tier = getChipTier(ratio)
        const { text, bg, border } = TIER_CLASSES[tier]

        return (
          <span
            key={tool.label}
            role="listitem"
            aria-label={`${tool.label}: ${tool.count} menciones`}
            title={`${tool.label}: ${tool.count} menciones`}
            className={[
              'inline-flex items-center gap-1.5',
              'rounded-full border px-3 py-1',
              'cursor-default select-none',
              'transition-all duration-200 ease-out',
              'motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md',
              text,
              bg,
              border,
            ].join(' ')}
            style={{ fontSize: `${fontSize}px`, fontWeight }}
          >
            <span style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{tool.label}</span>
            <span
              className="inline-flex items-center justify-center rounded-full bg-black/[0.07] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
              aria-hidden="true"
            >
              {tool.count}
            </span>
          </span>
        )
      })}
    </div>
  )
}
