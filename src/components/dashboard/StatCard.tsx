import InfoTooltip from '@/components/metricas/InfoTooltip'

export function StatCard({
  label,
  value,
  accent,
  helpText,
  icon,
  iconAccent = 'text-[#00C8FF]',
  subtitle,
}: {
  label: string
  value: string | number
  accent: string
  helpText?: string
  icon?: string
  iconAccent?: string
  subtitle?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm px-5 py-4 lg:px-6 lg:py-5 flex flex-col">
      {/* Top row: label + InfoTooltip (left) | accent icon square (right) */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
          {helpText && <InfoTooltip helpText={helpText} />}
        </div>
        {icon && (
          <span className="inline-flex items-center justify-center rounded-lg bg-cyan-50 w-8 h-8 shrink-0">
            <span className={`material-symbols-outlined ${iconAccent} text-2xl`} aria-hidden="true">
              {icon}
            </span>
          </span>
        )}
      </div>
      {/* Value — classes text-3xl font-extrabold preserved (tests assert these) */}
      <p className={`text-3xl font-extrabold ${accent} mt-2`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        {value}
      </p>
      {/* Subtitle */}
      {subtitle && <p className="text-xs text-slate-400 mt-1 leading-snug">{subtitle}</p>}
    </div>
  )
}
