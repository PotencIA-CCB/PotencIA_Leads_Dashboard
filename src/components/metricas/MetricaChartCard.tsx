import { type ReactNode } from 'react'

interface MetricaChartCardProps {
  title: string
  className?: string
  titleAdornment?: ReactNode
  children: ReactNode
}

export function MetricaChartCard({ title, className = '', titleAdornment, children }: MetricaChartCardProps) {
  return (
    <div
      className={`bg-white p-4 sm:p-6 lg:p-8 rounded-[10px] border border-[#E5E7EB] shadow-sm flex flex-col overflow-visible min-w-0 ${className}`}
    >
      <div className="flex items-center gap-1.5 mb-4">
        <h4
          className="text-sm sm:text-base font-bold text-[#003087]"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          {title}
        </h4>
        {titleAdornment}
      </div>
      {children}
    </div>
  )
}
