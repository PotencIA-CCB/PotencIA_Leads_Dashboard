import type { FunnelStats } from '@/lib/capturaStats'
import InfoTooltip from '@/components/metricas/InfoTooltip'

interface LeadsFunnelProps {
  stats: FunnelStats
  totalBookings: number
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '0'
  return String(Math.round((numerator / denominator) * 100 * 10) / 10)
}

interface StageCardProps {
  label: string
  value: number
  icon: string
  helpText: string
  accent?: string
  note?: string
}

function StageCard({ label, value, icon, helpText, accent = 'text-slate-700', note }: StageCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4 flex flex-col">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
          <InfoTooltip helpText={helpText} />
        </div>
        <span className="inline-flex items-center justify-center rounded-lg bg-cyan-50 w-8 h-8 shrink-0">
          <span className="material-symbols-outlined text-[#00C8FF] text-2xl" aria-hidden="true">
            {icon}
          </span>
        </span>
      </div>
      {/* Value */}
      <p className={`text-3xl font-extrabold ${accent} mt-2`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        {value}
      </p>
      {/* Note / rate */}
      {note && <p className="text-xs text-slate-400 mt-1 leading-snug">{note}</p>}
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
  const cicloCompletoPct = pct(cicloCompleto, totalLandingLeads)

  const stages = [
    {
      label: 'Registrados en Landing',
      value: totalLandingLeads,
      icon: 'ads_click',
      helpText: 'Total de leads que entraron al embudo de captura a través del landing page.',
      accent: 'text-[#003087]',
    },
    {
      label: 'Nunca Agendaron',
      value: landingNeverBooked,
      icon: 'event_busy',
      helpText: 'Leads registrados en landing que nunca agendaron una consultoría — leads perdidos.',
      accent: 'text-amber-600',
      note: `${landingPct}% de landing`,
    },
    {
      label: 'Sí Agendaron',
      value: landingBooked,
      icon: 'event_available',
      helpText: 'Leads del landing que sí agendaron al menos una consultoría.',
      accent: 'text-sky-600',
    },
    {
      label: 'No-Shows',
      value: noShows,
      icon: 'person_off',
      helpText: 'Leads que agendaron pero no asistieron a la consultoría.',
      accent: 'text-rose-500',
    },
    {
      label: 'Ciclo Completo',
      value: cicloCompleto,
      icon: 'verified',
      helpText: 'Leads que completaron todo el ciclo: landing, booking y asistencia a consultoría.',
      accent: 'text-emerald-600',
      note: `${cicloCompletoPct}% de landing`,
    },
    {
      label: 'Bookings Totales',
      value: totalBookings,
      icon: 'calendar_month',
      helpText: 'Total de bookings registrados en el sistema, independientemente del origen.',
      accent: 'text-indigo-600',
    },
    {
      label: 'Canal Directo',
      value: bookedNoLandingDirecto,
      icon: 'person_pin',
      helpText: 'Leads que agendaron y asistieron sin haber pasado por el landing page.',
      accent: 'text-sky-600',
    },
    {
      label: 'Solo Agendaron',
      value: soloBookedNoSession,
      icon: 'event_note',
      helpText: 'Leads que solo agendaron (sin landing, sin asistencia registrada).',
      accent: 'text-slate-600',
    },
    {
      label: 'Sin Origen Conocido',
      value: asistieronSinLandingNiBooking,
      icon: 'help_outline',
      helpText: 'Leads que asistieron a una sesión sin landing ni booking conocido en el sistema.',
      accent: 'text-slate-400',
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-6 py-5 mb-6">
      <h3
        className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4"
        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
      >
        Embudo de captura
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stages.map((stage) => (
          <StageCard
            key={stage.label}
            label={stage.label}
            value={stage.value}
            icon={stage.icon}
            helpText={stage.helpText}
            accent={stage.accent}
            note={stage.note}
          />
        ))}
      </div>
    </div>
  )
}
