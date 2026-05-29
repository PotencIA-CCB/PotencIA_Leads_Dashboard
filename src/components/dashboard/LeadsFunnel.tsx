import type { FunnelStats } from '@/lib/capturaStats'

interface LeadsFunnelProps {
  stats: FunnelStats
  totalBookings: number
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '0'
  return String(Math.round((numerator / denominator) * 100 * 10) / 10)
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
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-6 py-5 mb-6">
      <h3
        className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4"
        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
      >
        Embudo de captura
      </h3>

      {/* Landing tree block */}
      <div className="font-mono text-sm whitespace-pre mb-5">
        <div className="text-slate-700 font-semibold">
          {totalLandingLeads} <span className="font-normal text-slate-500">se registraron en landing</span>
        </div>
        <div className="pl-4 text-amber-600">
          {'└─ '}
          <span className="font-semibold">{landingNeverBooked}</span>
          <span className="text-slate-500 font-normal"> nunca agendaron</span>
          <span className="ml-2 text-xs text-amber-500">→ leads perdidos</span>
        </div>
        <div className="pl-4 text-slate-700">
          {'└─ '}
          <span className="font-semibold">{landingBooked}</span>
          <span className="text-slate-500 font-normal"> sí agendaron</span>
        </div>
        <div className="pl-8 text-rose-500">
          {'└─ '}
          <span className="font-semibold">{noShows}</span>
          <span className="text-slate-500 font-normal"> agendaron pero no asistieron</span>
          <span className="ml-2 text-xs text-rose-400">→ no-shows</span>
        </div>
        <div className="pl-8 text-emerald-600">
          {'└─ '}
          <span className="font-semibold">{cicloCompleto}</span>
          <span className="text-slate-500 font-normal"> completaron todo el ciclo</span>
          <span className="ml-2">✅</span>
        </div>
      </div>

      {/* Bookings tree block */}
      <div className="font-mono text-sm whitespace-pre mb-5">
        <div className="text-slate-700 font-semibold">
          {totalBookings} <span className="font-normal text-slate-500">bookings totales</span>
        </div>
        <div className="pl-4 text-slate-600">
          {'└─ '}
          <span className="font-semibold">{soloBookedNoSession}</span>
          <span className="text-slate-500 font-normal"> solo agendaron (sin landing, sin asistencia)</span>
        </div>
        <div className="pl-4 text-sky-600">
          {'└─ '}
          <span className="font-semibold">{bookedNoLandingDirecto}</span>
          <span className="text-slate-500 font-normal"> agendaron y asistieron pero sin landing</span>
          <span className="ml-2 text-xs text-sky-400">→ canal directo</span>
        </div>
      </div>

      {/* Summary table */}
      <div className="border-t border-slate-100 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Resumen ejecutivo</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <th className="text-left pb-2 pr-4 font-bold">Segmento</th>
              <th className="text-right pb-2 font-bold">Emails</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-50">
              <td className="py-1.5 pr-4 text-slate-600">Ciclo completo (landing + booking + asistencia)</td>
              <td className="py-1.5 text-right font-semibold text-emerald-600">{cicloCompleto}</td>
            </tr>
            <tr className="border-t border-slate-50">
              <td className="py-1.5 pr-4 text-slate-600">Registrados pero nunca agendaron</td>
              <td className="py-1.5 text-right font-semibold text-amber-600">
                {landingNeverBooked} ({landingPct}% de landing)
              </td>
            </tr>
            <tr className="border-t border-slate-50">
              <td className="py-1.5 pr-4 text-slate-600">Agendaron pero no asistieron (no-shows)</td>
              <td className="py-1.5 text-right font-semibold text-rose-500">{noShows}</td>
            </tr>
            <tr className="border-t border-slate-50">
              <td className="py-1.5 pr-4 text-slate-600">Asistieron sin landing ni booking conocido</td>
              <td className="py-1.5 text-right font-semibold text-slate-600">{asistieronSinLandingNiBooking}</td>
            </tr>
            <tr className="border-t border-slate-50">
              <td className="py-1.5 pr-4 text-slate-600">Bookings sin landing ni asistencia</td>
              <td className="py-1.5 text-right font-semibold text-sky-600">{soloBookedNoSession}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
