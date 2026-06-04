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
// FunnelCard
// ---------------------------------------------------------------------------

interface CardData {
  value: number
  label: string
  sub?: string
  icon: string
  colorClass: string
  iconBg: string
  iconAccent: string
  level?: 0 | 1 | 2
}

const CARD_SIZES = {
  0: {
    wrap: 'px-5 sm:px-7 py-4 sm:py-6 gap-3 sm:gap-5',
    icon: 'w-[48px] h-[48px] sm:w-[56px] sm:h-[56px]',
    iconText: 'text-[22px] sm:text-[26px]',
    num: 'text-[32px] sm:text-[40px] md:text-[48px]',
    label: 'text-[12px] sm:text-[14px] md:text-[16px]',
    sub: 'text-[10px] sm:text-[11px] md:text-[12px]',
    radius: 'rounded-[18px]',
  },
  1: {
    wrap: 'px-4 sm:px-5 py-3.5 sm:py-4 gap-3 sm:gap-4',
    icon: 'w-[40px] h-[40px] sm:w-[46px] sm:h-[46px]',
    iconText: 'text-[18px] sm:text-[21px]',
    num: 'text-[24px] sm:text-[30px] md:text-[36px]',
    label: 'text-[11px] sm:text-[12px] md:text-[14px]',
    sub: 'text-[9px] sm:text-[10px] md:text-[11px]',
    radius: 'rounded-[14px]',
  },
  2: {
    wrap: 'px-3 sm:px-4 py-3 sm:py-3.5 gap-2.5 sm:gap-3',
    icon: 'w-[34px] h-[34px] sm:w-[38px] sm:h-[38px]',
    iconText: 'text-[15px] sm:text-[17px]',
    num: 'text-[20px] sm:text-[24px] md:text-[28px]',
    label: 'text-[10px] sm:text-[11px] md:text-[13px]',
    sub: 'text-[8px] sm:text-[9px] md:text-[10px]',
    radius: 'rounded-[12px]',
  },
} as const

function FunnelCard({ value, label, sub, icon, colorClass, iconBg, iconAccent, level = 1 }: CardData) {
  const s = CARD_SIZES[level]
  return (
    <div className={`bg-white ${s.radius} shadow-[0_4px_16px_rgba(15,23,42,0.06)] flex items-center ${s.wrap} border border-slate-100/60 w-full`}>
      <div className={`${s.icon} rounded-[12px] flex items-center justify-center shrink-0 ${iconBg}`}>
        <span className={`material-symbols-outlined ${s.iconText} ${iconAccent}`}>
          {icon}
        </span>
      </div>
      <div className="shrink-0">
        <span className={`${s.num} leading-none font-bold ${colorClass}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {value}
        </span>
      </div>
      <div className="min-w-0">
        <p className={`${s.label} font-semibold text-slate-800 leading-snug`}>{label}</p>
        {sub && <p className={`${s.sub} text-slate-400 mt-0.5`}>{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SummaryRow
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
      <div className="flex flex-col items-center">
        {/* Root */}
        <div className="w-full max-w-full sm:max-w-[600px]">
          <FunnelCard
            value={totalLandingLeads}
            label="se registraron en landing"
            icon="trending_up"
            colorClass="text-[#1d72f3]"
            iconBg="bg-blue-50"
            iconAccent="text-[#1d72f3]"
            level={0}
          />
        </div>

        <div className="funnel-stem" />

        {/* Level 2 */}
        <div className="funnel-branch w-full max-w-[940px] flex-col sm:flex-row">
          <div className="funnel-child px-2">
            <FunnelCard
              value={landingNeverBooked}
              label="nunca agendaron"
              sub="→ leads perdidos"
              icon="calendar_today"
              colorClass="text-[#1d72f3]"
              iconBg="bg-blue-50"
              iconAccent="text-[#1d72f3]"
              level={1}
            />
          </div>
          <div className="funnel-child px-2">
            <FunnelCard
              value={landingBooked}
              label="sí agendaron"
              icon="event_available"
              colorClass="text-[#1d72f3]"
              iconBg="bg-blue-50"
              iconAccent="text-[#1d72f3]"
              level={1}
            />

            {landingBooked > 0 && (
              <>
                <div className="funnel-stem" />

                {/* Level 3 */}
                <div className="funnel-branch-right w-full flex-col sm:flex-row">
                  <div className="funnel-child px-1.5">
                    <FunnelCard
                      value={noShows}
                      label="agendaron pero no asistieron"
                      sub="→ no-shows"
                      icon="person_off"
                      colorClass="text-[#ef4444]"
                      iconBg="bg-red-50"
                      iconAccent="text-[#ef4444]"
                      level={2}
                    />
                  </div>
                  <div className="funnel-child px-1.5">
                    <FunnelCard
                      value={cicloCompleto}
                      label="completaron todo el ciclo"
                      sub="(landing → booking → sesión)"
                      icon="check_circle"
                      colorClass="text-[#22c55e]"
                      iconBg="bg-emerald-50"
                      iconAccent="text-[#22c55e]"
                      level={2}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ==================== TREE 2 — Bookings ==================== */}
      <div className="flex flex-col items-center">
        {/* Root */}
        <div className="w-full max-w-full sm:max-w-[600px]">
          <FunnelCard
            value={totalBookings}
            label="bookings totales"
            icon="description"
            colorClass="text-[#7c5ce0]"
            iconBg="bg-violet-50"
            iconAccent="text-[#7c5ce0]"
            level={0}
          />
        </div>

        <div className="funnel-stem" />

        {/* Level 2 */}
        <div className="funnel-branch w-full max-w-[940px] flex-col sm:flex-row">
          <div className="funnel-child px-2">
            <FunnelCard
              value={soloBookedNoSession}
              label="solo agendaron"
              sub="(sin landing, sin asistencia)"
              icon="event_busy"
              colorClass="text-[#f59e0b]"
              iconBg="bg-amber-50"
              iconAccent="text-[#f59e0b]"
              level={1}
            />
          </div>
          <div className="funnel-child px-2">
            <FunnelCard
              value={bookedNoLandingDirecto}
              label="agendaron y asistieron sin landing"
              sub="→ canal directo"
              icon="group"
              colorClass="text-[#7c5ce0]"
              iconBg="bg-violet-50"
              iconAccent="text-[#7c5ce0]"
              level={1}
            />
          </div>
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
