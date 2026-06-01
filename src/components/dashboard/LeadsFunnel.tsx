import type { FunnelStats } from '@/lib/capturaStats'
import { StatCard } from '@/components/dashboard/StatCard'

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
  const cicloCompletoPct = pct(cicloCompleto, totalLandingLeads)

  const stages = [
    {
      label: 'Registrados en Landing',
      value: totalLandingLeads,
      icon: 'ads_click',
      helpText: 'Total de leads que entraron al embudo de captura a través del landing page.',
      accent: 'text-[#003087]',
      subtitle: 'formularios_registro',
    },
    {
      label: 'Nunca Agendaron',
      value: landingNeverBooked,
      icon: 'event_busy',
      helpText: 'Leads registrados en landing que nunca agendaron una consultoría — leads perdidos.',
      accent: 'text-amber-600',
      subtitle: `${landingPct}% de landing · formularios sin consultoría`,
    },
    {
      label: 'Sí Agendaron',
      value: landingBooked,
      icon: 'event_available',
      helpText: 'Leads del landing que sí agendaron al menos una consultoría.',
      accent: 'text-sky-600',
      subtitle: 'formularios + consultorías',
    },
    {
      label: 'No-Shows',
      value: noShows,
      icon: 'person_off',
      helpText: 'Leads que agendaron pero no asistieron a la consultoría.',
      accent: 'text-rose-500',
      subtitle: 'consultorías · status = No asistió',
    },
    {
      label: 'Ciclo Completo',
      value: cicloCompleto,
      icon: 'verified',
      helpText: 'Leads que completaron todo el ciclo: landing, booking y asistencia a consultoría.',
      accent: 'text-emerald-600',
      subtitle: `${cicloCompletoPct}% de landing · formularios + consultorías + sesiones`,
    },
    {
      label: 'Bookings Totales',
      value: totalBookings,
      icon: 'calendar_month',
      helpText: 'Total de bookings registrados en el sistema, independientemente del origen.',
      accent: 'text-indigo-600',
      subtitle: 'consultorías (todos los orígenes)',
    },
    {
      label: 'Canal Directo',
      value: bookedNoLandingDirecto,
      icon: 'person_pin',
      helpText: 'Leads que agendaron y asistieron sin haber pasado por el landing page.',
      accent: 'text-sky-600',
      subtitle: 'consultorías + sesiones sin landing',
    },
    {
      label: 'Solo Agendaron',
      value: soloBookedNoSession,
      icon: 'event_note',
      helpText: 'Leads que solo agendaron (sin landing, sin asistencia registrada).',
      accent: 'text-slate-600',
      subtitle: 'consultorías sin sesión ni landing',
    },
    {
      label: 'Sin Origen Conocido',
      value: asistieronSinLandingNiBooking,
      icon: 'help_outline',
      helpText: 'Leads que asistieron a una sesión sin landing ni booking conocido en el sistema.',
      accent: 'text-slate-400',
      subtitle: 'sesiones sin formulario ni consultoría',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {stages.map((stage) => (
        <StatCard
          key={stage.label}
          label={stage.label}
          value={stage.value}
          icon={stage.icon}
          helpText={stage.helpText}
          accent={stage.accent}
          subtitle={stage.subtitle}
        />
      ))}
    </div>
  )
}
