# Tasks: Dashboard Corrections — May 27

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300–350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All 6 corrections + tests | PR 1 | Single PR; under 400-line budget; each correction independently revertible |

## Phase 1: Foundation — Types, Metric, Reusable Components

- [x] 1.1 **RED** — Add failing test for `consultoriasEnSeguimientoAtendidas` in `src/lib/__tests__/metricas.test.ts`: assert field exists in `MetricasGlobales`, returns 0 with no "En seguimiento", returns correct count
- [x] 1.2 **GREEN** — Add `consultoriasEnSeguimientoAtendidas: number` to `MetricasGlobales` interface and return in `computeMetricasFromConsultorias`, computed from `porEstadoAtendidas` where `status === 'En seguimiento'` (default 0)
- [x] 1.3 **RED** — Add failing test for `EstadoConsultoriasDonut` in co-located `__tests__/EstadoConsultoriasDonut.test.tsx`: renders empty state when no data, renders PieChart segments with `porEstadoAtendidas` prop
- [x] 1.4 **GREEN** — Create `src/components/metricas/EstadoConsultoriasDonut.tsx`: receives `porEstadoAtendidas`, wraps PieChart in existing `MetricaChartCard`, title "Estado consultorías"
- [x] 1.5 **RED** — Add failing test for `InfoTooltip` in co-located `__tests__/InfoTooltip.test.tsx`: icon renders, popover toggles on click, displays `helpText` content
- [x] 1.6 **GREEN** — Create `src/components/metricas/InfoTooltip.tsx`: `helpText: string` prop, Material Symbols `help` icon trigger, `useState` toggle popover with `absolute` positioning, keyboard-accessible (`Enter`/`Escape`)
- [x] 1.7 **GREEN** — Extend `LeadCardConsultoria` type in `src/components/LeadCard.tsx` with optional `registro_sesion?: { estado_inicial, acciones_realizadas, resultado_final } | null`

## Phase 2: Integration — Wiring Components and Backend

- [x] 2.1 **GREEN** — Add `EstadoConsultoriasDonut` as 5th grid item in `ProductividadKPIs.tsx`; change heatmap `md:col-span-2` → `md:col-span-1`; import from new file
- [x] 2.2 **GREEN** — Remove standalone donut `<section>` from `src/app/dashboard/metricas/page.tsx`; pass `porEstadoAtendidas` via existing data flow to `ProductividadKPIs`
- [x] 2.3 **GREEN** — Wire `consultoriasEnSeguimientoAtendidas` into "En Seguimiento" KPI card value + sub-label in metricas `page.tsx`; keep `casosEnSeguimientoLeads` untouched
- [x] 2.4 **GREEN** — Add `helpText` field to KPI definitions in metricas `page.tsx`, `GeneralKPIs.tsx`, `RetentionFunnel.tsx`; render `InfoTooltip` alongside each KPI label
- [x] 2.5 **RED** — Add test in `src/app/api/insights/__tests__/` verifying fetch body includes `response_format: { type: "json_object" }`
- [x] 2.6 **GREEN** — Add `response_format: { type: "json_object" }` to DeepSeek API call in `insights/route.ts`; enhance `console.error` to log `{ responseType: typeof content, responsePreview: content?.slice(0,200) }` on parse failure
- [x] 2.7 **RED** — Add test for `buildImpactContext`: mock supabase returning `registro_sesion` rows; verify prompt includes "ACCIONES REALIZADAS" section with sample text
- [x] 2.8 **GREEN** — Expand `buildImpactContext()` in `insights/route.ts`: query `registro_sesion` (last 30d, joined by `id_consultoria` from active consultorias); append `acciones_realizadas`, `estado_inicial`, `resultado_final` as raw text samples to AI prompt
- [x] 2.9 **RED** — Add test for `LeadModal` rendering "Registro de sesión" `Section` when `registro_sesion` fields present in `LeadWithMeta`
- [x] 2.10 **GREEN** — Fetch `registro_sesion` in `src/app/dashboard/page.tsx` (parallel with consultores); merge into `LeadWithMeta`; add "Registro de sesión" section in `LeadModal.tsx` with `Row` components for each field

## Phase 3: Verification

- [x] 3.1 Run `npm test` — confirm 88 existing + all new tests pass; run `npm run build` — no TypeScript or build errors (tsc --noEmit clean; build has pre-existing win32 pipe issue)
- [x] 3.2 Verify all 7 success criteria from proposal: side-by-side layout ≥768px, KPI matches donut, tooltips on all cards, valid JSON from insights, session data in modal, patterns in insights, all tests pass

### DeepSeek json_object Fallback

If `response_format: json_object` is unsupported by the configured model and `JSON.parse()` still fails:
1. Improve markdown-stripping parser: strip ` ```json ` fences and any `reasoning_content` prefix
2. Re-run insight generation test
3. Document model capability finding in `insights/route.ts` comment
