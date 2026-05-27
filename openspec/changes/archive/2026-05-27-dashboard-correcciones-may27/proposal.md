# Proposal: Dashboard Corrections — May 27

## Intent

Fix 6 UX, data consistency, and AI integration issues: conflicting "En Seguimiento" KPI counts (10 vs 4), charts stacking vertically instead of side-by-side, AI insights returning "forma inesperada" errors, missing session data in lead modals, and KPI cards without context hints.

## Scope

### In Scope
- Donut (Estado consultorías) + heatmap (Franja horaria) side-by-side
- Align KPI card "En Seguimiento" with donut segment count
- Info tooltips on all KPI cards: formula, calculation method, data source
- `response_format: json_object` in DeepSeek API call
- `acciones_realizadas`, `estado_inicial`, `resultado_final` in lead modal
- AI insights from `registro_sesion` free-text fields

### Out of Scope
- New chart types or dashboard pages
- Schema migrations (columns already exist)
- Bookings pipeline changes
- Performance optimization of metrics queries

## Capabilities

### New Capabilities
- `dashboard-chart-layout`: Extract donut to `EstadoConsultoriasDonut`; place side-by-side with heatmap in ProductividadKPIs grid (`md:col-span-1` each)
- `kpi-consistency`: Add `consultoriasEnSeguimientoAtendidas` to `MetricasGlobales` (sourced from `porEstadoAtendidas`); update KPI card value + sub-label; keep `casosEnSeguimientoLeads` for other use
- `kpi-help-hints`: Build `InfoTooltip` component with click/hover popover; each KPI definition gains `helpText` field with plain-language formula and source table.column
- `insights-json-response`: Add `response_format: { type: "json_object" }` to DeepSeek call in `insights/route.ts`; improve error logging with raw response shape
- `lead-session-modal`: Extend `LeadCardConsultoria` type with optional `registro_sesion` fields; fetch alongside consultorias; render "Registro de sesión" section in LeadModal
- `session-data-insights`: Query `registro_sesion` in `buildImpactContext()`; pass `acciones_realizadas`, `estado_inicial`, `resultado_final` to AI prompt; extract patterns (solutions requested, success rates, use cases to implement)

## Approach

Extract donut into reusable component → add to ProductividadKPIs grid. Add new metric to `metricas.ts`, wire to KPI card. Build lightweight tooltip using click/hover pattern. One-line API fix + enhanced error logging. Extend types and data fetching for session data; add modal section with Row components. Expand `buildImpactContext` with `registro_sesion` query; update AI prompt template with new data sections.

**Metrics pipeline impact** (`lib/metricas.ts`): +1 new computed metric (`consultoriasEnSeguimientoAtendidas`), pure function, no existing functions modified. Minimal blast radius, backward compatible.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/metricas.ts` | Modified | New `consultoriasEnSeguimientoAtendidas` metric |
| `src/app/api/insights/route.ts` | Modified | `response_format` + `buildImpactContext` expansion |
| `src/app/dashboard/metricas/page.tsx` | Modified | Donut extraction, KPI value/label, tooltips |
| `src/components/metricas/ProductividadKPIs.tsx` | Modified | New grid item, col-span changes |
| `src/components/LeadModal.tsx` | Modified | New session data section |
| `src/app/dashboard/page.tsx` | Modified | Fetch `registro_sesion` alongside consultorias |
| `src/components/LeadCard.tsx` | Modified | Type extension for registration fields |
| `src/components/metricas/GeneralKPIs.tsx` | Modified | Tooltip integration |
| `src/components/metricas/RetentionFunnel.tsx` | Modified | Tooltip integration |
| New: `EstadoConsultoriasDonut` | New | Extracted donut component |
| New: `InfoTooltip` | New | KPI help hint component |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `json_object` unsupported by DeepSeek model | Low | Test against OpenCode endpoint; fallback to markdown-stripping parser |
| KPI value changes break 88 existing tests | Medium | Full test suite before/after; update assertions to match new metric |
| `registro_sesion` fields have high NULL rates | Medium | Query NULL% before implementation; hide section if no data available |
| Free-text field insights unreliable | High | Treat as exploratory; add confidence note in UI |

## Rollback Plan

- **Layout**: Revert ProductividadKPIs grid + restore standalone donut `<section>`. Git revert.
- **KPI alignment**: Revert `metricas.ts` addition + KPI card value. `casosEnSeguimientoLeads` remains untouched.
- **Help hints**: Remove `InfoTooltip` import + `helpText` fields. Pure UI — no data impact.
- **Insights API**: Remove `response_format` line. Immediate behavioral restore.
- **Lead modal**: Revert type extensions + fetch. Modal falls back to current display.
- **Session insights**: Remove `registro_sesion` query from `buildImpactContext`. Prompt returns to template.

## Dependencies

- DeepSeek API endpoint must support `response_format: json_object` (verify pre-deploy)
- Supabase `registro_sesion` table populated with data (already in use by the app)

## Success Criteria

- [ ] Donut + heatmap render side-by-side on viewports ≥768px
- [ ] "En Seguimiento" KPI card value matches donut segment count
- [ ] All KPI cards show info tooltip on hover/click with formula + data source
- [ ] Insights API returns valid JSON without "forma inesperada" error
- [ ] Lead modal shows `acciones_realizadas`, `estado_inicial`, `resultado_final` when data exists
- [ ] Insights include patterns from session data (solutions, success rates, use cases)
- [ ] All 88 existing tests pass; new tests written RED→GREEN per strict TDD
