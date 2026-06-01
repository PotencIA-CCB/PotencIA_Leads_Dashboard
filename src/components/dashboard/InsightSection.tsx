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

export function InsightColumn({
  title,
  items,
}: {
  title: string
  items: string[] | undefined
}) {
  return (
    <div className="px-6 py-5">
      <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
        {title}
      </h5>
      {!items || items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Sin datos</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-slate-600 leading-relaxed">
              {item}
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
          setInsightsError('Configuración incompleta. Verificá las variables de entorno.')
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
            .map((r: { tipo: string; valor_texto: string }) => r.valor_texto),
          recomendaciones: data
            .filter((r: { tipo: string; valor_texto: string }) => r.tipo === 'recomendacion')
            .map((r: { tipo: string; valor_texto: string }) => r.valor_texto),
          alertas: data
            .filter((r: { tipo: string; valor_texto: string }) => r.tipo === 'alerta')
            .map((r: { tipo: string; valor_texto: string }) => r.valor_texto),
        })
      }
    } catch {
      /* fallback failed — already showing error from POST */
    }
  }

  return (
    <section className="bg-white rounded-[10px] border border-[#E5E7EB] shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h4
          className="text-sm font-bold text-[#003087] uppercase tracking-widest"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Insights con IA
        </h4>
        <button
          onClick={generarInsights}
          disabled={loadingInsights}
          className="text-xs font-semibold text-[#003087] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[16px]">
            {loadingInsights ? 'hourglass_empty' : 'refresh'}
          </span>
          {loadingInsights ? 'Generando' : 'Actualizar'}
        </button>
      </div>

      {!insights && !loadingInsights && !insightsError && (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-slate-400">
            Haz clic en <strong className="text-slate-600">Actualizar</strong> para generar
            análisis basado en los datos actuales.
          </p>
        </div>
      )}
      {insightsError && !loadingInsights && (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-amber-600">{insightsError}</p>
        </div>
      )}
      {loadingInsights && (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-slate-400">Analizando datos…</p>
        </div>
      )}
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
