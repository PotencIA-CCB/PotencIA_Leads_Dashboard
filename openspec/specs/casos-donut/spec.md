# Casos Más Solicitados — Donut Chart

## Purpose

Convert the "Casos más solicitados" chart in `ProductividadKPIs.tsx` from a `BarChart` to a
pie/donut chart following the established `EstadoConsultoriasDonut` pattern, with a legend,
per-category color mapping from `DONUT_COLORS`, tooltip, and an explicit empty-state guard.

## Out of Scope

- `/dashboard/bi` page — untouched.
- `src/lib/metricas.ts` — `countByCategoriaCaso()` logic is not modified.
- `EstadoConsultoriasDonut.tsx` — reused as a structural pattern; the file itself is not modified.
- Any new color palette or styling system — only `DONUT_COLORS` is used.
- Pixel-level visual polish beyond readable labels and legend.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | The "Casos más solicitados" section SHALL render a `PieChart` with `Pie innerRadius` set (donut shape), not a `BarChart` | SHALL |
| R2 | The `Pie` element MUST use `dataKey="total"` and `nameKey="caso"` | MUST |
| R3 | Each slice MUST be wrapped in a `Cell` element with its fill color taken from `DONUT_COLORS` (cycling if more slices than colors) | MUST |
| R4 | A `Tooltip` MUST be present showing at minimum the category name (`caso`) and its count (`total`) | MUST |
| R5 | A `Legend` component SHALL be rendered showing all category names | SHALL |
| R6 | When `porCasoUso` is an empty array, the chart area SHALL render an explicit empty-state (e.g. "Sin datos") instead of a blank chart | SHALL |
| R7 | When `porCasoUso` contains exactly one category, a single full-circle slice SHALL render with its color from `DONUT_COLORS[0]` and the legend shows that one entry | SHALL |
| R8 | The chart MUST be wrapped in `ResponsiveContainer` (or equivalent) to fill its grid cell | MUST |
| R9 | The component MUST NOT import or depend on any canvas library | MUST |
| R10 | The `BarChart` previously rendering this data MUST be removed | MUST |

### Scenario: Standard rendering with multiple categories

- GIVEN `porCasoUso` returns `[{caso:"Automatización",total:12},{caso:"Chatbot",total:8},{caso:"RPA",total:5}]`
- WHEN `ProductividadKPIs` renders
- THEN a donut chart displays three slices
- AND each slice fill matches `DONUT_COLORS` at the corresponding index
- AND the legend lists "Automatización", "Chatbot", and "RPA"
- AND hovering a slice shows a tooltip with the category name and count

### Scenario: Single category

- GIVEN `porCasoUso` returns `[{caso:"Automatización",total:20}]`
- WHEN the chart renders
- THEN one full-circle slice renders with color `DONUT_COLORS[0]`
- AND the legend shows one entry: "Automatización"
- AND the tooltip shows count 20

### Scenario: Empty data — no cases

- GIVEN `porCasoUso` returns `[]`
- WHEN `ProductividadKPIs` renders the Casos section
- THEN no pie slice is rendered
- AND a visible empty-state indicator (text or placeholder) appears
- AND no runtime error is thrown

### Scenario: Color cycling when categories exceed DONUT_COLORS length

- GIVEN `porCasoUso` has more entries than `DONUT_COLORS` array length
- WHEN the chart renders
- THEN each `Cell` fill is assigned `DONUT_COLORS[index % DONUT_COLORS.length]`
- AND no slice renders with an undefined or empty fill

### Scenario: BarChart removal

- GIVEN the component source for the Casos section
- WHEN inspected
- THEN no `BarChart` element is present for this data binding
