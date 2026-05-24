import { type ReactNode } from 'react'

interface MetricaChartCardProps {
  title: string
  className?: string
  children: ReactNode
}

export function MetricaChartCard({ title, className = '', children }: MetricaChartCardProps) {
  return (
    <div
      className={`bg-white p-4 sm:p-6 rounded-[10px] border border-[#E5E7EB] shadow-sm flex flex-col overflow-hidden min-w-0 ${className}`}
    >
      <h4
        className="text-sm sm:text-base font-bold text-[#003087] mb-4"
        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
      >
        {title}
      </h4>
      {children}
    </div>
  )
}
