# Design: Dashboard Corrections — May 27

## Technical Approach

Six independent corrections across layout, data consistency, UX, and AI integration. The shared pattern: extract → isolate → compose. Each correction touches 1-3 files with minimal cross-cutting. `metricas.ts` gets one new computed field (`consultoriasEnSeguimientoAtendidas`), backward-compatible. Strict TDD per config — every change preceded by a failing test.

## Architecture Decisions

| # | Decision | Choice | Alternatives rejected | Rationale |
|---|----------|--------|-----------------------|-----------|
| D1 | Donut chart placement | Extract to `EstadoConsultoriasDonut`, render inside ProductividadKPIs grid, heatmap `md:col-span-1` | Creating grid wrapper in page.tsx (breaks component boundary); CSS-only repositioning (fragile) | ProductividadKPIs already owns the grid; adding a 5th item is natural. Existing `MetricaChartCard` wrapper gives consistent card chrome. |
| D2 | KPI "En Seguimiento" alignment | New `consultoriasEnSeguimientoAtendidas` metric, sourced from existing `porEstadoAtendidas["En seguimiento"]` | Change `casosEnSeguimientoLeads` logic (high blast radius — other consumers); rename-only UX fix (avoids real fix) | Pure computed field from existing data; zero new DB queries. `casosEnSeguimientoLeads` preserved for other consumers. Sub-label clarifies "Consultorías atendidas en seguimiento". |
| D3 | Info tooltips | Custom `InfoTooltip` component via `useState` toggle on click, hover on desktop | CSS-only `group-hover` (no touch support); `title` attribute (unstyled, no rich text); third-party popover lib (overkill) | Material Symbols `help` icon with `absolute` positioned popover; one component across all KPI sections. Adds `helpText` field to KPI definition objects. |
| D4 | Insights JSON mode | `response_format: { type: "json_object" }` + enhanced `console.error` logging with response shape snapshot | Function calling (OpenCode endpoint may not support); retry-without-JSON-mode fallback (adds latency) | One-line fix per OpenAI spec. Existing markdown-stripping remains as safety net. Enhanced logging captures `typeof content` + `Object.keys(aiData)` on failure. |
| D5 | Lead modal session data | Extend `LeadCardConsultoria` with optional `registro_sesion` fields; fetch in dashboard page alongside consultorias; merge into `LeadWithMeta` | Lazy-fetch on modal open (adds network delay + loading state per click) | One extra Supabase query at page load; data already joined by `id_consultoria`. Section hidden when no session data exists. |
| D6 | Session insights pipeline | Query `registro_sesion` in `buildImpactContext()` (last 30d, by consultoria IDs); pass `acciones_realizadas`, `estado_inicial`, `resultado_final` as raw text samples to AI prompt | Pre-compute aggregations in metricas.ts (adds compute, no real structure for free-text); categorize manually (unreliable without AI) | Raw text samples give the AI model context for pattern extraction; structured KPI extraction is exploratory per proposal risk assessment. |

## Data Flow

```
registro_sesion ──(id_consultoria)──► LeadCardConsultoria (type extension)
                                         │
dashboard/page.tsx ◄── fetch consultorias + registro_sesion (parallel)
     │                     │
     ▼                     ▼
LeadWithMeta            buildImpactContext()  ← new query for last 30d
     │                     │
     ▼                     ▼
LeadModal.newSection   AI prompt template ← raw text samples
```

```
EstadoConsultoriasDonut ──(porEstadoAtendidas)──► ProductividadKPIs grid
                                                    │
consultoriasEnSeguimientoAtendidas ──(derived)──► KPI card "En Seguimiento"
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/metricas/EstadoConsultoriasDonut.tsx` | **New** | Extracted donut chart; receives `porEstadoAtendidas` prop |
| `src/components/metricas/ProductividadKPIs.tsx` | Modify | Add EstadoConsultoriasDonut as 5th grid item; heatmap `md:col-span-2` → `md:col-span-1` |
| `src/app/dashboard/metricas/page.tsx` | Modify | Remove standalone donut `<section>`; pass data to ProductividadKPIs; KPI card uses new `consultoriasEnSeguimientoAtendidas`; add `InfoTooltip` to KPI loop |
| `src/lib/metricas.ts` | Modify | Add `consultoriasEnSeguimientoAtendidas` field to `MetricasGlobales` interface and return object |
| `src/components/metricas/InfoTooltip.tsx` | **New** | Click-to-toggle popover with hover fallback; receives `helpText: string` |
| `src/components/LeadCard.tsx` | Modify | Extend `LeadCardConsultoria` with optional `registro_sesion` fields |
| `src/app/dashboard/page.tsx` | Modify | Fetch `registro_sesion` alongside consultorias; merge into `LeadWithMeta` |
| `src/components/LeadModal.tsx` | Modify | New "Registro de sesión" `Section` with Row components for `estado_inicial`, `acciones_realizadas`, `resultado_final` |
| `src/app/api/insights/route.ts` | Modify | Add `response_format: json_object`; expand `buildImpactContext` with `registro_sesion` query; update prompt template |
| `src/components/metricas/GeneralKPIs.tsx` | Modify | Add `InfoTooltip` to KPI row |
| `src/components/metricas/RetentionFunnel.tsx` | Modify | Add `InfoTooltip` to KPI row |

## Interfaces / Contracts

```ts
// New metric in MetricasGlobales (src/lib/metricas.ts)
consultoriasEnSeguimientoAtendidas: number
// Derived from: sum of porEstadoAtendidas entries where status === 'En seguimiento'

// Extended LeadCardConsultoria (src/components/LeadCard.tsx)
type LeadCardConsultoria = {
  // ...existing fields...
  registro_sesion?: {
    estado_inicial: string | null
    acciones_realizadas: string | null
    resultado_final: string | null
  } | null
}

// InfoTooltip props (src/components/metricas/InfoTooltip.tsx)
interface InfoTooltipProps {
  helpText: string   // plain-language formula + source table.column
  className?: string
}
```

KPI definition objects gain optional `helpText`:
```ts
{ label: 'En Seguimiento', value: metricas.consultoriasEnSeguimientoAtendidas,
  helpText: 'Consultorías atendidas con estado "En seguimiento". Fuente: consultorias.status' }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `consultoriasEnSeguimientoAtendidas` in metricas.test.ts | RED: assert new field exists. GREEN: compute `porEstadoAtendidas["En seguimiento"]`. Verify 0 when no match. |
| Unit | `EstadoConsultoriasDonut` | Render with empty `porEstadoAtendidas` (empty state), with data (PieChart renders) |
| Unit | `InfoTooltip` | Toggle visibility on click; renders `helpText` content |
| Unit | `buildImpactContext` with registro_sesion | Mock supabase response; verify prompt includes "ACCIONES REALIZADAS" |
| Unit | Insights route `response_format` | Verify fetch body includes `response_format: { type: "json_object" }` |
| Integration | LeadModal session section | Mount with `LeadWithMeta` containing `registro_sesion`; verify Row rendering; verify section hidden when null |

Tests in co-located `__tests__/` directories following existing patterns. Run `npm test` per strict TDD — write RED first, then GREEN.

## Migration / Rollout

No data migration required. All columns already exist in DB (`registro_sesion.estado_inicial`, etc.). Rollback per-proposal plan: each correction is independently revertible via git revert. The `consultoriasEnSeguimientoAtendidas` addition in `MetricasGlobales` is pure computed — no DB writes.

## Open Questions

- [ ] Does the DeepSeek model at the configured `OPENCODE_MODEL` support `response_format: json_object`? Test pre-deploy.
- [ ] What is the NULL rate for `registro_sesion.acciones_realizadas` in production? If >50%, session insights section value is limited. Check Supabase before implementing D6 prompt changes.
