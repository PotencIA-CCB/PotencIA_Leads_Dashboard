import InfoTooltip from '@/components/metricas/InfoTooltip'

export function StatCard({ label, value, accent, helpText }: { label: string; value: string | number; accent: string; helpText?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4">
      <div className="flex items-center gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        {helpText && <InfoTooltip helpText={helpText} />}
      </div>
      <p className={`text-3xl font-extrabold ${accent} mt-1`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        {value}
      </p>
    </div>
  )
}
