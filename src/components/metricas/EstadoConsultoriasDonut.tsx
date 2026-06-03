'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { MetricaChartCard } from './MetricaChartCard'

export const DONUT_COLORS = ['#003087', '#00C8FF', '#E8470A', '#004BB5']

export interface DonutSegment {
  status: string
  total: number
}

/**
 * Prepares donut chart data from porEstadoAtendidas.
 * Returns the same array (identity) — chart handles empty via conditional rendering.
 * Pure function extracted for testability.
 */
export function prepareDonutData(data: DonutSegment[]): DonutSegment[] {
  return data
}

interface EstadoConsultoriasDonutProps {
  porEstadoAtendidas: DonutSegment[]
}

export default function EstadoConsultoriasDonut({
  porEstadoAtendidas,
}: EstadoConsultoriasDonutProps) {
  const data = prepareDonutData(porEstadoAtendidas)

  return (
    <MetricaChartCard title="Estado consultorías">
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[260px]">
          <p className="text-sm text-slate-400">Sin datos disponibles.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-[200px] h-[200px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="total"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, String(name)]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-3">
            {data.map((e, i) => (
              <div key={e.status} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span className="text-xs text-slate-600 font-medium">
                  {e.status} ({e.total})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </MetricaChartCard>
  )
}
