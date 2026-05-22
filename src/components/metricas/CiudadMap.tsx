'use client'
// Department name property key in GeoJSON: NOMBRE_DPT (string, uppercase)
// Example values: 'ANTIOQUIA', 'SANTAFE DE BOGOTA D.C', 'CUNDINAMARCA'
// Source: john-guerra/Colombia.geo.json simplified to 33 department polygons

import { useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import colombiaGeo from '@/lib/geo/colombia-departments.json'

interface CiudadMapProps {
  data: { dept: string; total: number }[]
  sinUbicacion: number
}

// 5-step blue color scale (light → dark)
const COLOR_SCALE = ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#003087']

function fillForCount(count: number, max: number): string {
  if (count === 0 || max === 0) return '#f1f5f9'
  const idx = Math.min(COLOR_SCALE.length - 1, Math.floor((count / max) * COLOR_SCALE.length))
  return COLOR_SCALE[idx]
}

export default function CiudadMap({ data, sinUbicacion }: CiudadMapProps) {
  const [tooltip, setTooltip] = useState<{ dept: string; count: number } | null>(null)

  const max = Math.max(1, ...data.map((d) => d.total))
  const byDept = Object.fromEntries(data.map((d) => [d.dept, d.total]))

  return (
    <div className="flex-1 flex flex-col">
      {tooltip && (
        <div className="text-xs text-slate-600 font-medium mb-2 h-5">
          {tooltip.dept}: <span className="text-[#003087] font-bold">{tooltip.count}</span> sesiones
        </div>
      )}
      {!tooltip && <div className="h-5 mb-2" />}

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [-74, 4], scale: 800 }}
        width={400}
        height={480}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography={colombiaGeo}>
          {({ geographies }) =>
            geographies.map((g) => {
              const deptName: string = g.properties.NOMBRE_DPT ?? ''
              const count = byDept[deptName] ?? 0
              return (
                <Geography
                  key={g.rsmKey}
                  geography={g}
                  fill={fillForCount(count, max)}
                  stroke="#ffffff"
                  strokeWidth={0.5}
                  onMouseEnter={() => setTooltip({ dept: deptName, count })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', opacity: 0.85 },
                    pressed: { outline: 'none' },
                  }}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>

      {sinUbicacion > 0 && (
        <p className="text-[10px] text-slate-400 mt-2">
          Sin ubicación: {sinUbicacion} sesiones
        </p>
      )}
    </div>
  )
}
