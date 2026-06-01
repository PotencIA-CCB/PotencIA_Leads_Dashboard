import type { FunnelStats } from '@/lib/capturaStats'

interface LeadsFunnelProps {
  stats: FunnelStats
  totalBookings: number
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '0'
  return String(Math.round((numerator / denominator) * 100 * 10) / 10)
}

const NUM = 'font-extrabold text-[#003087]'

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
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-6 py-5">
      {/* Landing tree */}
      <div className="font-mono text-sm mb-5 leading-relaxed">
        <div>
          <span className={NUM}>{totalLandingLeads}</span>{' '}
          <span className="text-slate-500">se registraron en landing</span>
        </div>
        <div className="pl-4">
          <span className="text-slate-300">{'└─ '}</span>
          <span className={NUM}>{landingNeverBooked}</span>
          <span className="text-slate-500"> nunca agendaron</span>
          <span className="ml-2 text-xs text-slate-400">→ leads perdidos</span>
        </div>
        <div className="pl-4">
          <span className="text-slate-300">{'└─ '}</span>
          <span className={NUM}>{landingBooked}</span>
          <span className="text-slate-500"> sí agendaron</span>
        </div>
        <div className="pl-8">
          <span className="text-slate-300">{'└─ '}</span>
          <span className={NUM}>{noShows}</span>
          <span className="text-slate-500"> agendaron pero no asistieron</span>
          <span className="ml-2 text-xs text-slate-400">→ no-shows</span>
        </div>
        <div className="pl-8">
          <span className="text-slate-300">{'└─ '}</span>
          <span className={NUM}>{cicloCompleto}</span>
          <span className="text-slate-500"> completaron todo el ciclo</span>
          <span className="ml-1">✅</span>
          <span className="text-xs text-slate-400 ml-1">(landing → booking → sesión)</span>
        </div>
      </div>

      {/* Bookings tree */}
      <div className="font-mono text-sm mb-5 leading-relaxed">
        <div>
          <span className={NUM}>{totalBookings}</span>{' '}
          <span className="text-slate-500">bookings totales</span>
        </div>
        <div className="pl-4">
          <span className="text-slate-300">{'└─ '}</span>
          <span className={NUM}>{soloBookedNoSession}</span>
          <span className="text-slate-500"> solo agendaron (sin landing, sin asistencia)</span>
        </div>
        <div className="pl-4">
          <span className="text-slate-300">{'└─ '}</span>
          <span className={NUM}>{bookedNoLandingDirecto}</span>
          <span className="text-slate-500"> agendaron y asistieron pero sin landing</span>
          <span className="ml-2 text-xs text-slate-400">→ canal directo</span>
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
              <td className="py-1.5 text-right font-semibold text-[#003087]">{cicloCompleto}</td>
            </tr>
            <tr className="border-t border-slate-50">
              <td className="py-1.5 pr-4 text-slate-600">Registrados pero nunca agendaron</td>
              <td className="py-1.5 text-right font-semibold text-[#003087]">
                {landingNeverBooked} ({landingPct}% de landing)
              </td>
            </tr>
            <tr className="border-t border-slate-50">
              <td className="py-1.5 pr-4 text-slate-600">Agendaron pero no asistieron (no-shows)</td>
              <td className="py-1.5 text-right font-semibold text-[#003087]">{noShows}</td>
            </tr>
            <tr className="border-t border-slate-50">
              <td className="py-1.5 pr-4 text-slate-600">Asistieron sin landing ni booking conocido</td>
              <td className="py-1.5 text-right font-semibold text-[#003087]">{asistieronSinLandingNiBooking}</td>
            </tr>
            <tr className="border-t border-slate-50">
              <td className="py-1.5 pr-4 text-slate-600">Bookings sin landing ni asistencia</td>
              <td className="py-1.5 text-right font-semibold text-[#003087]">{soloBookedNoSession}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
