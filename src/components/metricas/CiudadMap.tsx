'use client'
// TASK-05: Replaced react-simple-maps choropleth with a vertical BarChart.
// Top 10 departments by consultation count, sorted descending.

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface CiudadMapProps {
  data: { dept: string; total: number }[]
  sinUbicacion: number
}

const BAR_COLORS = ['#003087', '#004BB5', '#00C8FF', '#6366F1', '#E8470A', '#5A6475']

export default function CiudadMap({ data, sinUbicacion }: CiudadMapProps) {
  const top10 = data.slice(0, 10)

  if (top10.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-[260px]">
        <p className="text-sm text-slate-400">Sin datos de ubicación disponibles.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          layout="vertical"
          data={top10}
          margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="dept"
            tick={{ fontSize: 10 }}
            width={140}
          />
          <Tooltip
            formatter={(value) => [value, 'Consultas']}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {top10.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {sinUbicacion > 0 && (
        <p className="text-[10px] text-slate-400 mt-2">
          Sin ubicación: {sinUbicacion} sesiones
        </p>
      )}
    </div>
  )
}
