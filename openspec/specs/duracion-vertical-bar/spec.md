# Duración Promedio por Consultor — Vertical Bar Chart

## Purpose

Convert the "Duración promedio por consultor" chart in `ProductividadKPIs.tsx` from a horizontal bar
chart (`BarChart layout="vertical"`) to a standard vertical bar chart, with proper label-overflow
handling and graceful empty/zero-data behavior.

## Out of Scope

- `/dashboard/bi` page — untouched.
- `src/lib/metricas.ts` — `avgDuracionByConsultor()` logic is not modified.
- Any new card wrapper or color system.
- Pixel-level visual polish (margins, font sizes) beyond what is required for readable labels.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | The Duración chart SHALL render as a vertical bar chart: bars rise from the X-axis, Y-axis is numeric (minutes), X-axis is categorical (consultor names) | SHALL |
| R2 | The `BarChart` MUST NOT include `layout="vertical"` | MUST |
| R3 | `XAxis` MUST use `dataKey="consultor"` with `type="category"` (or the equivalent default) | MUST |
| R4 | `YAxis` SHALL carry the numeric average with no explicit `dataKey` binding to a string category | SHALL |
| R5 | When a consultor name exceeds 12 characters, the X-axis tick SHALL render at an angle (e.g. `angle={-35}`, `textAnchor="end"`) to prevent overlap | SHALL |
| R6 | `interval={0}` MUST be set on `XAxis` so every consultor label renders regardless of chart width | MUST |
| R7 | The chart container MUST include sufficient bottom margin (≥ 60px) to prevent angled labels from being clipped | MUST |
| R8 | When `avgDuracionByConsultor` returns an empty array, the chart area SHALL render an empty-state message (e.g. "Sin datos") instead of blank axes | SHALL |
| R9 | When all consultor entries have `avg === 0`, bars SHALL render at zero height; the Y-axis SHALL still display a numeric scale | SHALL |
| R10 | The `Bar` element MUST use `dataKey="avg"` | MUST |
| R11 | The component MUST NOT import or depend on any canvas library | MUST |

### Scenario: Standard rendering with multiple consultors

- GIVEN `avgDuracionByConsultor` returns `[{consultor:"Ana",avg:45},{consultor:"Bruno",avg:30}]`
- WHEN `ProductividadKPIs` renders
- THEN a vertical bar chart displays two bars
- AND the X-axis shows "Ana" and "Bruno" as category labels
- AND the Y-axis shows a numeric scale
- AND each bar height is proportional to its `avg` value

### Scenario: Long consultor name — label overflow mitigation

- GIVEN `avgDuracionByConsultor` returns `[{consultor:"Alejandra Martínez",avg:50}]`
- WHEN the chart renders
- THEN the X-axis tick for that name is rendered at an angle (non-zero rotation)
- AND the tick text is NOT clipped by the chart boundary

### Scenario: Empty data — no consultors

- GIVEN `avgDuracionByConsultor` returns `[]`
- WHEN `ProductividadKPIs` renders the Duración section
- THEN no bar is rendered
- AND a visible empty-state indicator (text or placeholder) appears in the chart area

### Scenario: All-zero durations

- GIVEN `avgDuracionByConsultor` returns `[{consultor:"Ana",avg:0},{consultor:"Bruno",avg:0}]`
- WHEN the chart renders
- THEN two zero-height bars appear at the baseline
- AND the Y-axis numeric scale is visible (not hidden or negative)
- AND no runtime error is thrown

### Scenario: No layout prop regression

- GIVEN the component source
- WHEN inspected
- THEN `BarChart` MUST NOT contain the attribute `layout="vertical"`
