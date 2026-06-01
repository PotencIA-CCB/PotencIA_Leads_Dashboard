# Proposal: BI Section Redesign — Vertical Bars, Donut, and AI-Focused Word Cloud

## Intent

Three visualization changes on the **Métricas** page (`/dashboard/metricas`) to improve how
productivity and intent data is read at a glance:

1. "Duración promedio por consultor" currently renders as a **horizontal** bar chart
   (`BarChart layout="vertical"`), which reads awkwardly for a per-consultant comparison. It should
   be a **true vertical** bar chart (bars rising from the X-axis).
2. "Casos más solicitados" is a bar chart, but with only ~4 categories it communicates
   share-of-total far better as a **pie/donut** chart.
3. The word cloud is sourced from `registro_sesion.pregunta` and shows generic session text. It
   should be re-pointed to the landing-form intent field (`formularios_landing.descripcion`,
   "Describe lo que quieres lograr en esta sesión") and **filtered to AI/automation terms only**, so
   the cloud surfaces what prospects actually want to automate.

Success looks like: a vertical bar chart with readable consultant labels, a donut with a legend for
case categories, and a word cloud built from landing-form descriptions that shows only
AI/automation vocabulary — all reusing existing card/styling, with the new text-filter function
covered by Vitest.

## Scope

### In Scope
- `ProductividadKPIs.tsx` (~line 127): convert "Duración promedio por consultor" from
  `BarChart layout="vertical"` (horizontal) to a standard **vertical** bar chart — remove
  `layout="vertical"`, swap XAxis/YAxis types so `consultor` is the category X-axis and `avg` the
  numeric Y-axis. Handle long consultant-name overflow (angled X-axis ticks / `interval`).
- `ProductividadKPIs.tsx` (~line 186): convert "Casos más solicitados" from `BarChart` to a
  **donut** following the `EstadoConsultoriasDonut.tsx` pattern (`PieChart > Pie > Cell + Tooltip`,
  `DONUT_COLORS`), with `dataKey="total" nameKey="caso"`. Add a **legend** (few categories) and an
  **empty-state** guard.
- `WordCloud.tsx`: add a co-located, Vitest-tested pure function `filterByAiTerms()` that keeps only
  AI/automation terms using a Spanish, **accent-stripped** keyword allowlist. Reuse existing
  `processText()` (accent-strip + stopwords). Keep the **CSS-flex** rendering (no canvas library).
- `src/app/dashboard/metricas/page.tsx`: add/re-point the word-cloud Supabase query to
  `formularios_landing.descripcion` (replacing the `registro_sesion.pregunta` source for the cloud).
- `WordCloud.test.tsx`: extend with tests for `filterByAiTerms()`.

### Out of Scope
- The BI page (`/dashboard/bi`) is **untouched** — despite the change name, all three charts live on
  the Métricas page (confirmed in exploration); nothing is moved to or added to `/dashboard/bi`.
- **No canvas / DOM-measuring word-cloud library** (react-wordcloud, d3-cloud) — Cloudflare Workers
  runtime forbids it. CSS-flex tag cloud stays.
- No new chart **card wrapper** or styling system — reuse `MetricaChartCard`, `DONUT_COLORS`,
  `BAR_COLORS`.
- No changes to `src/lib/metricas.ts` pure aggregations (`avgDuracionByConsultor`,
  `countByCategoriaCaso`) — only the chart rendering changes.
- No spatial/true-cloud layout algorithm (linear CSS flex layout is accepted).

## Capabilities

### New Capabilities
- `wordcloud-ai-filter`: `filterByAiTerms()` keeps only AI/automation-related tokens from processed
  landing-form text, via an accent-stripped Spanish keyword allowlist; pure and unit-tested.
- `wordcloud-landing-source`: word cloud is sourced from `formularios_landing.descripcion` instead of
  `registro_sesion.pregunta`.

### Modified Capabilities
- `dashboard-chart-layout` (existing spec): "Duración promedio" becomes a vertical bar chart and
  "Casos más solicitados" becomes a donut with a legend. Delta spec to be authored in `sdd-spec`.

## Approach

Three independent, low-risk work units, all on the Métricas surface:

1. **Vertical bar (Duración)** — remove `layout="vertical"` from the `BarChart`, set `XAxis` to the
   `consultor` category and `YAxis` to the `avg` numeric value, and mitigate label overflow with
   angled ticks (`angle={-35}`, `textAnchor="end"`, increased bottom margin) or `interval={0}`.
2. **Donut (Casos)** — clone the proven `EstadoConsultoriasDonut` structure (`ResponsiveContainer >
   PieChart > Pie innerRadius/outerRadius > Cell` + `Tooltip`), bind `dataKey="total"
   nameKey="caso"`, map `DONUT_COLORS` per slice, add `<Legend />`, and render an empty-state when
   `porCasoUso` is empty.
3. **Word cloud (data + filter)** — under strict TDD: write the `filterByAiTerms()` test first, then
   the function (reusing `processText()` for accent-strip + stopwords), then re-point the
   Métricas-page query to `formularios_landing.descripcion` and pipe results through
   `processText()` → `filterByAiTerms()` before rendering with the existing CSS-flex cloud.

Rationale: each unit is isolated (no shared state), reuses an established in-repo pattern, and keeps
`metricas.ts` untouched, minimizing blast radius and review effort.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/metricas/ProductividadKPIs.tsx` | Modified | Duración → vertical bars; Casos → donut + legend + empty-state |
| `src/components/metricas/WordCloud.tsx` | Modified | Add `filterByAiTerms()`; apply it after `processText()`; keep CSS-flex render |
| `src/components/metricas/__tests__/WordCloud.test.tsx` | Modified | Add unit tests for `filterByAiTerms()` (TDD-first) |
| `src/app/dashboard/metricas/page.tsx` | Modified | Re-point word-cloud query to `formularios_landing.descripcion` |
| `src/components/metricas/EstadoConsultoriasDonut.tsx` | Reference | Pattern + `DONUT_COLORS` source — reused, not changed |
| `src/components/metricas/MetricaChartCard.tsx` | Reference | Card wrapper reused, not changed |
| `src/lib/metricas.ts` | **No impact** | Pure aggregations unchanged; only rendering changes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Long consultant names overflow X-axis on vertical bars | High | Angled ticks (`angle={-35}`, `textAnchor="end"`), larger bottom margin, `interval={0}`; truncate with ellipsis if needed |
| Donut with too few/zero categories looks empty or unbalanced | Medium | Add explicit empty-state ("Sin datos"); legend + tooltip clarify small slices; `DONUT_COLORS` covers ≥4 categories |
| `formularios_landing.descripcion` has low volume / few AI terms → sparse cloud | Medium | **Verify volume first** (query NULL% and row count in `sdd-spec`/`sdd-design`); if too sparse, fall back to keeping `registro_sesion.pregunta` or merging both sources — record decision in design |
| AI keyword allowlist misses Spanish synonyms / accents | Medium | Allowlist matches **post-`processText()` accent-stripped** forms (e.g. `automatizacion`, `inteligencia`, `artificial`, `agentes`, `bots`, `chatbot`, `machine`, `learning`, `nlp`, `gpt`, `rpa`, `digitalizacion`); cover edge cases in Vitest tests |
| Accidentally adding a canvas word-cloud lib breaks Workers build | Low | Out-of-scope by contract; CSS-flex render preserved; no new dependency |
| Recharts axis-swap regression on `layout` removal | Low | Recharts v3.x supports vertical default; validate visually + existing tests green |

## Rollback Plan

1. **Charts**: `git revert` the `ProductividadKPIs.tsx` change — restores horizontal bars and the bar
   "Casos" chart. No data or schema dependency.
2. **Word cloud**: revert `WordCloud.tsx` and the `metricas/page.tsx` query to source
   `registro_sesion.pregunta`. `filterByAiTerms()` is additive and pure — safe to leave or remove.
3. No migration, no API, no `metricas.ts` change — rollback is purely frontend `git revert`.

## Review Workload Estimate

- **Estimated changed lines**: ~150–220 across 4 files (chart re-render ~60–90; donut ~40–60;
  `filterByAiTerms()` + tests ~50–70; page query ~10).
- **400-line budget**: **Within budget** — low risk of exceeding. Single PR is appropriate.
- **PRs**: 1 PR recommended. If reviewers prefer, it splits cleanly into 2 work-unit commits
  (charts; word-cloud data+filter), but chaining is **not required**.
- **TDD note**: `filterByAiTerms()` (and any text-aggregation change) **MUST be TDD-tested** —
  Vitest test written before the function, co-located in `__tests__/WordCloud.test.tsx`.

## Success Criteria

- [ ] "Duración promedio por consultor" renders as a vertical bar chart with readable consultant labels
- [ ] "Casos más solicitados" renders as a donut with a legend and a graceful empty-state
- [ ] Word cloud is sourced from `formularios_landing.descripcion` and shows only AI/automation terms
- [ ] `filterByAiTerms()` exists as a pure function with passing Vitest tests (TDD)
- [ ] No canvas/word-cloud library added; CSS-flex rendering preserved
- [ ] `src/lib/metricas.ts` untouched; existing tests pass (zero regression)
- [ ] `npm run build` succeeds; Cloudflare Workers deploy unaffected
