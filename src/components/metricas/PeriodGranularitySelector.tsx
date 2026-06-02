import { type Granularidad } from '@/lib/metricas'

interface PeriodGranularidadSelectorProps {
  value: Granularidad
  onChange: (g: Granularidad) => void
}

const OPTIONS: { label: string; value: Granularidad }[] = [
  { label: 'Día', value: 'dia' },
  { label: 'Semana', value: 'semana' },
  { label: 'Mes', value: 'mes' },
  { label: 'Año', value: 'año' },
]

export function PeriodGranularitySelector({ value, onChange }: PeriodGranularidadSelectorProps) {
  return (
    <div className="inline-flex items-center rounded-full border border-[#E5E7EB] bg-slate-50 p-0.5 gap-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer',
            value === opt.value
              ? 'bg-[#003087] text-white shadow-sm'
              : 'text-slate-500 hover:text-[#003087]',
          ].join(' ')}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
