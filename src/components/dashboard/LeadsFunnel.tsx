import type { FunnelStats } from '@/lib/capturaStats'

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '0'
  return String(Math.round((numerator / denominator) * 100 * 10) / 10)
}

interface LeadsFunnelProps {
  stats: FunnelStats
  totalBookings: number
}

interface CardData {
  value: number
  label: string
  sub?: string
  icon: string
  colorClass: string
  iconBg: string
}

function FunnelCard({ value, label, sub, icon, colorClass, iconBg }: CardData) {
  return (
    <div className="bg-white rounded-[18px] shadow-[0_4px_16px_rgba(15,23,42,0.06)] flex items-center gap-4 px-6 py-5 border border-slate-100/60">
      <div className={`w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-2xl shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="shrink-0">
        <span className={`text-[40px] leading-none font-bold ${colorClass}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {value}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-slate-800 leading-snug">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function TreeConnector({ variant }: { variant: 'root' | 'two' }) {
  if (variant === 'root') {
    return (
      <div className="relative flex flex-col items-center h-10">
        <div className="w-px flex-1 bg-slate-300" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-slate-300" />
      </div>
    )
  }
  return (
    <div className="relative flex flex-col items-center h-9">
      <div className="w-px flex-1 bg-slate-300" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-slate-300" />
    </div>
  )
}

export default function LeadsFunnel({ stats, totalBookings }: LeadsFunnelProps) {
  const {
    totalLandingLeads,
    landingNeverBooked,
    landingBooked,
    noShows,
    cicloCompleto,
    bookedNoLandingDirecto,
    soloBookedNoSession,
    asistieronSinLandingNiBooking,
  } = stats

  const landingPct = pct(landingNeverBooked, totalLandingLeads)

  return (
    <div className="space-y-16">
      {/* ==================== TREE 1 — Landing ==================== */}
      <div>
        <div className="max-w-[700px] mx-auto">
          <FunnelCard
            value={totalLandingLeads}
            label="se registraron en landing"
            icon="📈"
            colorClass="text-[#1d72f3]"
            iconBg="bg-blue-50 text-[#1d72f3]"
          />
        </div>

        <div className="relative h-12 flex justify-center">
          <div className="w-px bg-slate-300 h-full" />
          <div className="absolute bottom-0 left-[calc(50%-250px)] right-[calc(50%-250px)] h-px bg-slate-300" />
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-8 sm:gap-16">
          <div className="max-w-[460px] w-full">
            <FunnelCard
              value={landingNeverBooked}
              label="nunca agendaron"
              sub="→ leads perdidos"
              icon="📅"
              colorClass="text-[#1d72f3]"
              iconBg="bg-blue-50 text-[#1d72f3]"
            />
          </div>
          <div className="max-w-[460px] w-full">
            <FunnelCard
              value={landingBooked}
              label="sí agendaron"
              icon="📅"
              colorClass="text-[#1d72f3]"
              iconBg="bg-blue-50 text-[#1d72f3]"
            />
          </div>
        </div>

        {landingBooked > 0 && (
          <>
            <div className="flex justify-end w-[calc(50%+230px)] ml-auto mr-auto sm:mr-[calc(50%-230px)]">
              <div className="relative flex flex-col items-center h-9" style={{ width: '460px' }}>
                <div className="w-px bg-slate-300 h-full" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-8 sm:gap-12 sm:ml-[250px]">
              <div className="max-w-[380px] w-full">
                <FunnelCard
                  value={noShows}
                  label="agendaron pero no asistieron"
                  sub="→ no-shows"
                  icon="👤"
                  colorClass="text-[#1d72f3]"
                  iconBg="bg-blue-50 text-[#1d72f3]"
                />
              </div>
              <div className="max-w-[380px] w-full">
                <FunnelCard
                  value={cicloCompleto}
                  label="completaron todo el ciclo"
                  sub="(landing → booking → sesión)"
                  icon="✅"
                  colorClass="text-[#22c55e]"
                  iconBg="bg-emerald-50 text-[#22c55e]"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ==================== TREE 2 — Bookings ==================== */}
      <div>
        <div className="max-w-[1150px] mx-auto">
          <FunnelCard
            value={totalBookings}
            label="bookings totales"
            icon="📄"
            colorClass="text-[#7c5ce0]"
            iconBg="bg-violet-50 text-[#7c5ce0]"
          />
        </div>

        <div className="relative h-9 flex justify-center">
          <div className="w-px bg-slate-300 h-full" />
          <div className="absolute bottom-0 left-[75px] right-[75px] h-px bg-slate-300" />
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-8 sm:gap-10">
          <div className="max-w-[460px] w-full">
            <FunnelCard
              value={soloBookedNoSession}
              label="solo agendaron"
              sub="(sin landing, sin asistencia)"
              icon="📅"
              colorClass="text-[#f59e0b]"
              iconBg="bg-amber-50 text-[#f59e0b]"
            />
          </div>
          <div className="max-w-[460px] w-full">
            <FunnelCard
              value={bookedNoLandingDirecto}
              label="agendaron y asistieron pero sin landing"
              sub="→ canal directo"
              icon="👥"
              colorClass="text-[#7c5ce0]"
              iconBg="bg-violet-50 text-[#7c5ce0]"
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
                <th className="text-left px-6 py-3">Segmento</th>
                <th className="text-right px-6 py-3">Emails</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-50">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-[10px] flex items-center justify-center text-sm bg-emerald-50 text-[#22c55e] shrink-0">✅</span>
                    <span className="text-sm text-slate-600">Ciclo completo (landing + booking + asistencia)</span>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <strong className="text-[#22c55e] text-sm">{cicloCompleto}</strong>
                </td>
              </tr>
              <tr className="border-t border-slate-50">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-[10px] flex items-center justify-center text-sm bg-blue-50 text-[#1d72f3] shrink-0">👤</span>
                    <span className="text-sm text-slate-600">Registrados pero nunca agendaron</span>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <strong className="text-[#1d72f3] text-sm">{landingNeverBooked} ({landingPct}% de landing)</strong>
                </td>
              </tr>
              <tr className="border-t border-slate-50">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-[10px] flex items-center justify-center text-sm bg-red-50 text-[#ef4444] shrink-0">✖</span>
                    <span className="text-sm text-slate-600">Agendaron pero no asistieron (no-shows)</span>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <strong className="text-[#ef4444] text-sm">{noShows}</strong>
                </td>
              </tr>
              <tr className="border-t border-slate-50">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-[10px] flex items-center justify-center text-sm bg-amber-50 text-[#f59e0b] shrink-0">📅</span>
                    <span className="text-sm text-slate-600">Asistieron sin landing ni booking conocido</span>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <strong className="text-[#f59e0b] text-sm">{asistieronSinLandingNiBooking}</strong>
                </td>
              </tr>
              <tr className="border-t border-slate-50">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-[10px] flex items-center justify-center text-sm bg-violet-50 text-[#7c5ce0] shrink-0">📄</span>
                    <span className="text-sm text-slate-600">Bookings sin landing ni asistencia</span>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <strong className="text-[#7c5ce0] text-sm">{soloBookedNoSession}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
