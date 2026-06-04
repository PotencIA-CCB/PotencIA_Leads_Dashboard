'use client'

import { useState, useEffect } from 'react'
import { getCurrentConsultor } from '@/lib/supabase-browser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InsightsState = {
  insights: string[]
  recomendaciones: string[]
  alertas: string[]
} | null

// ---------------------------------------------------------------------------
// Cache constants (exported for testing)
// ---------------------------------------------------------------------------

export const DEFAULT_CACHE_KEY = 'bi_insights_cache'
export const BI_INSIGHTS_CACHE_KEY = 'bi_insights_cache'

// ---------------------------------------------------------------------------
// parseCacheEntry — pure cache validity check (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Given the raw string from sessionStorage (or null if absent), returns the
 * cached InsightsState if the entry is valid and within the 5-minute TTL.
 * Returns null for any invalid, missing, or expired input.
 */
export function parseCacheEntry(raw: string | null): InsightsState {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed.expiresAt > Date.now() && parsed.data) {
      return parsed.data as InsightsState
    }
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// InsightColumn — pure presentational sub-component (exported for testing)
// ---------------------------------------------------------------------------

const COLUMN_META: Record<string, { icon: string; accent: string; bg: string; border: string }> = {
  Patrones:     { icon: 'query_stats',    accent: 'text-[#003087]', bg: 'bg-blue-50',   border: 'border-blue-100' },
  'Qué Funciona': { icon: 'bolt',         accent: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  Hallazgos:    { icon: 'lightbulb',      accent: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100' },
}

export function InsightColumn({
  title,
  items,
}: {
  title: string
  items: string[] | undefined
}) {
  const meta = COLUMN_META[title] ?? { icon: 'info', accent: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100' }

  return (
    <div className="px-6 py-5 flex flex-col gap-4">
      {/* Column header */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${meta.bg} ${meta.border} border`}>
          <span className={`material-symbols-outlined text-[16px] ${meta.accent}`} aria-hidden="true">
            {meta.icon}
          </span>
        </span>
        <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</h5>
      </div>

      {!items || items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Sin datos</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${meta.bg} border ${meta.border} ring-1 ring-inset ${meta.accent.replace('text-', 'ring-')}`} />
              <p className="text-xs text-slate-600 leading-relaxed">{item}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InsightSectionProps {
  /** Gates auto-generation — parent passes !loading */
  ready: boolean
  /** sessionStorage key — defaults to 'bi_insights_cache' */
  cacheKey?: string
}

// ---------------------------------------------------------------------------
// InsightSection — main component
// ---------------------------------------------------------------------------

export default function InsightSection({
  ready,
  cacheKey = DEFAULT_CACHE_KEY,
}: InsightSectionProps) {
  const [insights, setInsights] = useState<InsightsState>(null)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)

  // Auto-generate when parent signals ready; check sessionStorage cache first
  useEffect(() => {
    if (!ready) return

    // Check sessionStorage cache first (5-min TTL)
    try {
      const cached = parseCacheEntry(sessionStorage.getItem(cacheKey))
      if (cached) {
        setInsights(cached)
        return
      }
    } catch {
      /* sessionStorage unavailable — proceed to generate */
    }

    // No valid cache → generate fresh insights
    generarInsights()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cacheKey])

  async function generarInsights() {
    setLoadingInsights(true)
    setInsightsError(null)
    try {
      const consultor = await getCurrentConsultor()
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_consultor: consultor?.id ?? null, minNew: 0 }),
      })
      const data = await res.json()
      if (data.skipped === true) {
        if (data.reason === 'threshold_not_met') {
          setInsightsError(
            `No hay suficientes datos nuevos para generar insights (se necesitan ${data.details?.threshold} nuevas consultorías).`,
          )
        } else if (data.reason === 'config_missing') {
          const missing = data.details?.missing?.join(', ') ?? ''
          setInsightsError(`Configuración incompleta. Faltan: ${missing || 'variables de entorno'}`)
        } else {
          setInsightsError('No se pudieron generar insights.')
        }
        // Try fallback to stored insights on skip
        await cargarInsightsGuardados()
        return
      }
      if (!res.ok) {
        setInsightsError(data.error ?? 'Error generando insights.')
        // Fall back to stored insights on API failure
        await cargarInsightsGuardados()
        return
      }
      setInsights(data)
      // Cache in sessionStorage with 5-min TTL
      try {
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            data,
            expiresAt: Date.now() + 5 * 60 * 1000,
          }),
        )
      } catch {
        /* sessionStorage full or unavailable — ignore */
      }
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Error desconocido')
      await cargarInsightsGuardados()
    } finally {
      setLoadingInsights(false)
    }
  }

  /** Fallback: fetch stored insights from GET /api/insights and render */
  async function cargarInsightsGuardados() {
    try {
      const res = await fetch('/api/insights')
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setInsights({
          insights: data
            .filter((r: { tipo: string; valor_texto: string }) => r.tipo === 'insight')
            .map((r: { tipo: string; valor_texto: string }) => r.valor_texto)
            .slice(0, 3),
          recomendaciones: data
            .filter((r: { tipo: string; valor_texto: string }) => r.tipo === 'recomendacion')
            .map((r: { tipo: string; valor_texto: string }) => r.valor_texto)
            .slice(0, 3),
          alertas: data
            .filter((r: { tipo: string; valor_texto: string }) => r.tipo === 'alerta')
            .map((r: { tipo: string; valor_texto: string }) => r.valor_texto)
            .slice(0, 3),
        })
        setInsightsError(null)
      }
    } catch {
      /* fallback failed — already showing error from POST */
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#003087]/8 border border-[#003087]/10">
            <span className="material-symbols-outlined text-[18px] text-[#003087]" aria-hidden="true">
              auto_awesome
            </span>
          </span>
          <div>
            <h4
              className="text-sm font-bold text-[#003087]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Análisis con IA
            </h4>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">Patrones · Impacto · Hallazgos accionables</p>
          </div>
        </div>
        <button
          onClick={generarInsights}
          disabled={loadingInsights}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#003087] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">
            {loadingInsights ? 'hourglass_empty' : 'refresh'}
          </span>
          {loadingInsights ? 'Generando…' : 'Actualizar'}
        </button>
      </div>

      {/* Empty state */}
      {!insights && !loadingInsights && !insightsError && (
        <div className="px-6 py-12 text-center">
          <span className="material-symbols-outlined text-slate-300 text-4xl" aria-hidden="true">
            auto_awesome
          </span>
          <p className="text-sm text-slate-400 mt-3">
            Hacé clic en <strong className="text-slate-600">Actualizar</strong> para generar el análisis.
          </p>
        </div>
      )}

      {/* Error state */}
      {insightsError && !loadingInsights && (
        <div className="px-6 py-8 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-400 text-xl shrink-0 mt-0.5" aria-hidden="true">
            warning
          </span>
          <p className="text-sm text-amber-700 leading-relaxed">{insightsError}</p>
        </div>
      )}

      {/* Loading state */}
      {loadingInsights && (
        <div className="px-6 py-12 text-center">
          <span className="material-symbols-outlined text-[#003087]/40 text-4xl animate-pulse" aria-hidden="true">
            auto_awesome
          </span>
          <p className="text-sm text-slate-400 mt-3">Analizando patrones e impacto…</p>
        </div>
      )}

      {/* Content */}
      {insights && !loadingInsights && (
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <InsightColumn title="Patrones" items={insights.insights} />
          <InsightColumn title="Qué Funciona" items={insights.recomendaciones} />
          <InsightColumn title="Hallazgos" items={insights.alertas} />
        </div>
      )}
    </section>
  )
}
