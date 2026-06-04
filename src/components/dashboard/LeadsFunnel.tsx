import type { FunnelStats } from '@/lib/capturaStats'

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '0'
  return String(Math.round((numerator / denominator) * 100 * 10) / 10)
}

interface LeadsFunnelProps {
  stats: FunnelStats
  totalBookings: number
}

// ---------------------------------------------------------------------------
// Tree connector — SVG lines between parent and children
// ---------------------------------------------------------------------------

function BranchSVG({ children }: { children?: number }) {
  const count = children ?? 2
  if (count === 2) {
    return (
      <svg
        className="w-full h-10 sm:h-12 overflow-visible"
        viewBox="0 0 200 48"
        preserveAspectRatio="none"
      >
        <line x1="100" y1="0" x2="100" y2="18" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="46" y1="18" x2="154" y2="18" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="50" y1="18" x2="50" y2="48" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="150" y1="18" x2="150" y2="48" stroke="#cbd5e1" strokeWidth="1" />
      </svg>
    )
  }
  // fallback — simple vertical drop
  return (
    <svg className="w-full h-8 overflow-visible" viewBox="0 0 200 32" preserveAspectRatio="none">
      <line x1="100" y1="0" x2="100" y2="32" stroke="#cbd5e1" strokeWidth="1" />
    </svg>
  )
}

/** Narrower branch offset to the right (used for level-2 → level-3 under "sí agendaron") */
function BranchSVGRight() {
  return (
    <svg
      className="w-full h-10 sm:h-12 overflow-visible"
      viewBox="0 0 200 48"
      preserveAspectRatio="none"
    >
      <line x1="150" y1="0" x2="150" y2="18" stroke="#cbd5e1" strokeWidth="1" />
      <line x1="70" y1="18" x2="190" y2="18" stroke="#cbd5e1" strokeWidth="1" />
      <line x1="80" y1="18" x2="80" y2="48" stroke="#cbd5e1" strokeWidth="1" />
      <line x1="180" y1="18" x2="180" y2="48" stroke="#cbd5e1" strokeWidth="1" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// FunnelCard — unified card styling
// ---------------------------------------------------------------------------

interface CardData {
  value: number
  label: string
  sub?: string
  icon: string
  colorClass: string
  iconBg: string
  iconAccent: string
  wide?: boolean
}

function FunnelCard({ value, label, sub, icon, colorClass, iconBg, iconAccent, wide }: CardData) {
  return (
    <div className={`bg-white rounded-[18px] shadow-[0_4px_16px_rgba(15,23,42,0.06)] flex items-center gap-4 px-5 sm:px-6 py-4 sm:py-5 border border-slate-100/60 ${wide ? '' : 'max-w-[440px]'} w-full`}>
      <div className={`w-[48px] h-[48px] sm:w-[52px] sm:h-[52px] rounded-[14px] flex items-center justify-center shrink-0 ${iconBg}`}>
        <span className={`material-symbols-outlined text-[22px] sm:text-[24px] ${iconAccent}`}>
          {icon}
        </span>
      </div>
      <div className="shrink-0">
        <span className={`text-[34px] sm:text-[40px] leading-none font-bold ${colorClass}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {value}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] sm:text-[15px] font-semibold text-slate-800 leading-snug">{label}</p>
        {sub && <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary table row
// ---------------------------------------------------------------------------

function SummaryRow({
  icon,
  iconBg,
  iconAccent,
  label,
  value,
  valueColor,
}: {
  icon: string
  iconBg: string
  iconAccent: string
  label: string
  value: string | number
  valueColor: string
}) {
  return (
    <tr className="border-t border-slate-50">
      <td className="px-5 sm:px-6 py-3.5">
        <div className="flex items-center gap-3">
          <span className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
            <span className={`material-symbols-outlined text-[16px] ${iconAccent}`}>
              {icon}
            </span>
          </span>
          <span className="text-sm text-slate-600">{label}</span>
        </div>
      </td>
      <td className="px-5 sm:px-6 py-3.5 text-right">
        <strong className={`${valueColor} text-sm`}>{value}</strong>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LeadsFunnel({ stats, totalBookings }: LeadsFunnelProps) {
  const {
    totalLandingLeads,
    landingNeverBooked,
    landingBooked,
    noShows,
    cicloCompleto,
    bookedNoLandingDirecto,
    soloBookedNoSession,
  } = stats

  const landingPct = pct(landingNeverBooked, totalLandingLeads)

  return (
    <div className="space-y-16">
      {/* ==================== TREE 1 — Landing ==================== */}
      <div>
        {/* Root */}
        <div className="flex justify-center">
          <FunnelCard
            value={totalLandingLeads}
            label="se registraron en landing"
            icon="trending_up"
            colorClass="text-[#1d72f3]"
            iconBg="bg-blue-50"
            iconAccent="text-[#1d72f3]"
            wide
          />
        </div>

        <BranchSVG />

        {/* Level 2 */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-10">
          <FunnelCard
            value={landingNeverBooked}
            label="nunca agendaron"
            sub="→ leads perdidos"
            icon="calendar_today"
            colorClass="text-[#1d72f3]"
            iconBg="bg-blue-50"
            iconAccent="text-[#1d72f3]"
          />
          <FunnelCard
            value={landingBooked}
            label="sí agendaron"
            icon="event_available"
            colorClass="text-[#1d72f3]"
            iconBg="bg-blue-50"
            iconAccent="text-[#1d72f3]"
          />
        </div>

        {landingBooked > 0 && (
          <>
            <BranchSVGRight />

            {/* Level 3 */}
            <div className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-10 sm:pl-[200px]">
              <FunnelCard
                value={noShows}
                label="agendaron pero no asistieron"
                sub="→ no-shows"
                icon="person_off"
                colorClass="text-[#ef4444]"
                iconBg="bg-red-50"
                iconAccent="text-[#ef4444]"
              />
              <FunnelCard
                value={cicloCompleto}
                label="completaron todo el ciclo"
                sub="(landing → booking → sesión)"
                icon="check_circle"
                colorClass="text-[#22c55e]"
                iconBg="bg-emerald-50"
                iconAccent="text-[#22c55e]"
              />
            </div>
          </>
        )}
      </div>

      {/* ==================== TREE 2 — Bookings ==================== */}
      <div>
        <div className="flex justify-center">
          <FunnelCard
            value={totalBookings}
            label="bookings totales"
            icon="description"
            colorClass="text-[#7c5ce0]"
            iconBg="bg-violet-50"
            iconAccent="text-[#7c5ce0]"
            wide
          />
        </div>

        <BranchSVG />

        <div className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-10">
          <FunnelCard
            value={soloBookedNoSession}
            label="solo agendaron"
            sub="(sin landing, sin asistencia)"
            icon="event_busy"
            colorClass="text-[#f59e0b]"
            iconBg="bg-amber-50"
            iconAccent="text-[#f59e0b]"
          />
          <FunnelCard
            value={bookedNoLandingDirecto}
            label="agendaron y asistieron sin landing"
            sub="→ canal directo"
            icon="group"
            colorClass="text-[#7c5ce0]"
            iconBg="bg-violet-50"
            iconAccent="text-[#7c5ce0]"
          />
        </div>
      </div>

      {/* ==================== SUMMARY TABLE ==================== */}
      <div className="bg-white rounded-[18px] shadow-[0_4px_16px_rgba(15,23,42,0.06)] overflow-hidden border border-slate-100/60">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3
            className="text-lg font-bold text-slate-800"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Resumen ejecutivo
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                <th className="text-left px-5 sm:px-6 py-3">Segmento</th>
                <th className="text-right px-5 sm:px-6 py-3">Leads</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow
                icon="check_circle"
                iconBg="bg-emerald-50"
                iconAccent="text-[#22c55e]"
                label="Ciclo completo (landing + booking + asistencia)"
                value={cicloCompleto}
                valueColor="text-[#22c55e]"
              />
              <SummaryRow
                icon="person_off"
                iconBg="bg-blue-50"
                iconAccent="text-[#1d72f3]"
                label="Registrados pero nunca agendaron"
                value={`${landingNeverBooked} (${landingPct}% de landing)`}
                valueColor="text-[#1d72f3]"
              />
              <SummaryRow
                icon="close"
                iconBg="bg-red-50"
                iconAccent="text-[#ef4444]"
                label="Agendaron pero no asistieron (no-shows)"
                value={noShows}
                valueColor="text-[#ef4444]"
              />
              <SummaryRow
                icon="description"
                iconBg="bg-violet-50"
                iconAccent="text-[#7c5ce0]"
                label="Bookings sin landing ni asistencia"
                value={soloBookedNoSession}
                valueColor="text-[#7c5ce0]"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
