'use client'

import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { type MetricasGlobales } from '@/lib/metricas'
import { MetricaChartCard } from './MetricaChartCard'

interface QualityKPIsProps {
  metricas: MetricasGlobales
}

const BAR_COLORS = ['#003087', '#00C8FF', '#004BB5', '#E8470A', '#5A6475', '#6366F1']

function RadialKPI({ value, label, color }: { value: number; label: string; color: string }) {
  const data = [{ value, fill: color }]
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[120px] h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius={35}
            outerRadius={55}
            barSize={14}
            startAngle={90}
            endAngle={-270}
            data={data}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              dataKey="value"
              angleAxisId={0}
              cornerRadius={7}
              background={{ fill: '#F1F5F9' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-lg font-bold text-[#003087]"
            style={{ fontFamily: 'Space Grotesk' }}
          >
            {value}%
          </span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 text-center mt-1">{label}</p>
    </div>
  )
}

export function QualityKPIs({ metricas }: QualityKPIsProps) {
  // Group scatter data by consultor
  const consultorNames = Array.from(
    new Set(metricas.scatterDuracionProductos.map(d => d.consultor))
  )
  const scatterByConsultor = consultorNames.map((nombre, i) => ({
    nombre,
    color: BAR_COLORS[i % BAR_COLORS.length],
    data: metricas.scatterDuracionProductos
      .filter(d => d.consultor === nombre)
      .map(d => ({ x: d.duracion, y: d.productos })),
  }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Calidad de sesiones — Radial KPIs */}
      <MetricaChartCard title="Calidad de sesiones">
        <div className="flex flex-wrap justify-around gap-4 py-4">
          <RadialKPI
            value={metricas.tasaSesionesGrabadas}
            label="Sesiones grabadas"
            color="#00C8FF"
          />
          <RadialKPI
            value={metricas.tasaDocumentacion}
            label="Con resultado"
            color="#003087"
          />
          <RadialKPI
            value={metricas.tasaRetorno}
            label="Tasa de retorno"
            color="#6366F1"
          />
        </div>
      </MetricaChartCard>

      {/* Duración vs. Productos — Scatter */}
      <MetricaChartCard title="Duración vs. Productos">
        {metricas.scatterDuracionProductos.length === 0 ? (
          <div className="flex items-center justify-center h-[260px]">
            <p className="text-sm text-slate-400">Sin datos disponibles.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                type="number"
                dataKey="x"
                name="Duración (min)"
                tick={{ fontSize: 10 }}
                label={{ value: 'Duración (min)', position: 'insideBottom', offset: -4, fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Productos"
                tick={{ fontSize: 10 }}
                label={{ value: 'Productos', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10 }}
                allowDecimals={false}
              />
              <ZAxis range={[40, 40]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value, name) => [value, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {scatterByConsultor.map(({ nombre, color, data }) => (
                <Scatter
                  key={nombre}
                  name={nombre}
                  data={data}
                  fill={color}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </MetricaChartCard>
    </div>
  )
}
