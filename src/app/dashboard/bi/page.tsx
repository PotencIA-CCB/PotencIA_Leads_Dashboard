'use client'

import { useBusinessIntelligence } from '@/hooks/useBusinessIntelligence'
import { StatCard } from '@/components/dashboard/StatCard'
import LeadsFunnel from '@/components/dashboard/LeadsFunnel'
import InsightSection from '@/components/dashboard/InsightSection'
import type { FunnelStats } from '@/lib/capturaStats'

const emptyFunnelStats: FunnelStats = {
  totalLandingLeads: 0,
  landingNeverBooked: 0,
  landingBooked: 0,
  noShows: 0,
  cicloCompleto: 0,
  bookedNoLandingDirecto: 0,
  soloBookedNoSession: 0,
  asistieronSinLandingNiBooking: 0,
}

export default function BIPage() {
  const { biStats, funnelStats, totalBookings, loading } = useBusinessIntelligence()

  return (
    <>
      {/* Section Header */}
      <div className="mb-8">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider list-none p-0 m-0">
            <li className="flex items-center">
              <span>Analysis</span>
              <span className="material-symbols-outlined text-[14px] mx-1" aria-hidden="true">chevron_right</span>
            </li>
            <li>
              <span className="text-[#00C8FF]" aria-current="page">Business Intelligence</span>
            </li>
          </ol>
        </nav>
        <div>
          <h2
            className="text-[34px] font-extrabold text-[#001d59] tracking-tight leading-tight"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Business Intelligence
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Indicadores de resultado y embudo de captura del programa PotencIA.
          </p>
        </div>
      </div>

      {/* Section 1 — Result Indicators */}
      <section aria-labelledby="result-indicators-heading" className="mb-8">
        <h3
          id="result-indicators-heading"
          className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Indicadores de Resultado
        </h3>

        {loading ? (
          <SkeletonIndicators />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              label="Sesiones Totales"
              value={biStats?.sesionesTotales ?? 0}
              accent="text-[#003087]"
              helpText="Total de sesiones de consultoría registradas"
              icon="event_available"
              subtitle="Sesiones de consultoría registradas"
            />
            <StatCard
              label="NITs Únicos"
              value={biStats?.nitsUnicos ?? 0}
              accent="text-[#003087]"
              helpText="NITs distintos y no nulos registrados en leads"
              icon="tag"
              subtitle="NITs distintos y no nulos"
            />
            <StatCard
              label="NITs Válidos"
              value={biStats?.nitsValidos ?? 0}
              accent="text-[#003087]"
              helpText="NITs validados manualmente en cámara de comercio (RUES)"
              icon="verified"
              subtitle="Validados en RUES (cámara)"
            />
            <StatCard
              label="Empresas Registradas"
              value={biStats?.empresasRegistradas ?? 0}
              accent="text-[#003087]"
              helpText="Leads con nombre de empresa registrado"
              icon="apartment"
              subtitle="Leads con empresa registrada"
            />
            <StatCard
              label="Empresas Registradas y Renovadas"
              value={biStats?.empresasRenovadas ?? 0}
              accent="text-[#003087]"
              helpText="Empresas validadas en RUES con renovación activa en 2026"
              icon="autorenew"
              subtitle="Renovación activa en 2026"
            />
          </div>
        )}
      </section>

      {/* Section 2 — Embudo de Captura */}
      <section aria-labelledby="process-indicators-heading" className="mb-8">
        <h3
          id="process-indicators-heading"
          className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Indicadores de Proceso
        </h3>
        <LeadsFunnel
          stats={funnelStats ?? emptyFunnelStats}
          totalBookings={totalBookings}
        />
      </section>

      {/* Section 3 — Insights con IA */}
      <section aria-labelledby="insights-heading" className="mb-8">
        <h3
          id="insights-heading"
          className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Resumen Ejecutivo
        </h3>
        <InsightSection ready={!loading} />
      </section>

    </>
  )
}

function SkeletonIndicators() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4 animate-pulse"
        >
          <div className="flex items-start justify-between">
            <div className="h-2.5 bg-slate-200 rounded w-3/4" />
            <div className="h-8 w-8 bg-slate-200 rounded-lg" />
          </div>
          <div className="h-8 bg-slate-200 rounded w-1/2 mt-3" />
          <div className="h-2 bg-slate-200 rounded w-2/3 mt-2" />
        </div>
      ))}
    </div>
  )
}
