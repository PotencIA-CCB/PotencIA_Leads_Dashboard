'use client'

import { useState } from 'react'

/**
 * Returns true if helpText is a non-empty, non-whitespace string.
 * Pure function extracted for testability.
 */
export function hasHelpText(helpText: string): boolean {
  return helpText.trim().length > 0
}

interface InfoTooltipProps {
  helpText: string
  className?: string
}

/**
 * InfoTooltip — click-to-toggle popover with hover fallback on desktop.
 * Keyboard accessible: Enter/Space to open, Escape to close.
 *
 * Usage: <InfoTooltip helpText="Total de consultorías — COUNT(*)" />
 */
export default function InfoTooltip({ helpText, className = '' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)

  if (!hasHelpText(helpText)) return null

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((v) => !v)
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label="Información del indicador"
        className="material-symbols-outlined text-[14px] text-slate-400 hover:text-[#00C8FF] cursor-pointer select-none transition-colors"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
      >
        help
      </span>

      {open && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none"
        >
          <p className="leading-relaxed whitespace-normal">{helpText}</p>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </span>
  )
}
