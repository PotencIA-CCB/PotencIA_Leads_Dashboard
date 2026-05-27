# Exploration: Dashboard Corrections — May 27

Date: 2026-05-27  
Explored by: sdd-explore executor

---

## 1. Layout: "Estado de consultorías" + "Consulta por franja horaria" side by side

### Current State

- **Estado consultorías donut chart**: `src/app/dashboard/metricas/page.tsx` lines 177–221 — rendered in its own `<section>` with `grid grid-cols-12` and `col-span-12`, taking a full-width row
- **Franja horaria heatmap**: Inside `src/components/metricas/ProductividadKPIs.tsx` line 253 — `<MetricaChartCard title="Consultas por franja horaria" className="md:col-span-2">` within a `grid grid-cols-1 md:grid-cols-2` parent. Also spans a full row (2 of 2 columns)
- Both charts are in **separate parent containers**, so they ALWAYS stack vertically

### Root Cause

The donut chart is a standalone `<section>` in the page, not part of the `ProductividadKPIs` grid. The heatmap is inside `ProductividadKPIs` but also takes `col-span-2` (full width).

### Affected Areas

| File | Role |
|------|------|
| `src/app/dashboard/metricas/page.tsx` lines 177–221 | Donut chart section to move |
| `src/components/metricas/ProductividadKPIs.tsx` lines 123, 253 | Grid parent; heatmap with `col-span-2` |

### Approaches

1. **Move donut into ProductividadKPIs grid** — Extract the donut chart into a standalone component, add it as a grid item in ProductividadKPIs alongside the heatmap, each taking 1 column (`md:col-span-1`). Remove the standalone `<section>` from the page.
   - Pros: Clean, uses existing grid infrastructure
   - Cons: Donut component extraction needed; heatmap needs to fit 1-col width
   - Effort: Medium

2. **Create shared grid wrapper in the page** — Wrap both the donut `<section>` and the heatmap call in a shared `grid-cols-2` container directly in page.tsx, removing the standalone section's full-width layout.
   - Pros: Minimal refactor of existing components
   - Cons: Breaks component boundary (page.tsx gets heavier); heatmap extraction from ProductividadKPIs needed
   - Effort: Medium

3. **Shrink both to 1-col and add a new grid section** — Restructure the page so both charts are in a single `grid grid-cols-1 md:grid-cols-2` section, keeping the donut section intact but moving it.
   - Pros: Least invasive to chart internals
   - Cons: Still requires heatmap isolation from ProductividadKPIs
   - Effort: Medium

### Recommendation

**Approach 1** — Extract the donut chart into a reusable component (`EstadoConsultoriasDonut`), add it as the 5th item in ProductividadKPIs's grid. Change heatmap from `md:col-span-2` to `md:col-span-1`. This keeps the chart library centralized and the page cleaner.

---

## 2. KPI Tracking Count Mismatch: "En Seguimiento" 10 (chart) vs 4 (KPI card)

### Current State

Two different metrics are displayed for "En Seguimiento":

**KPI Card** (`page.tsx` line 142):
```tsx
{ label: 'En Seguimiento', value: metricas.casosEnSeguimientoLeads, ... }
```
Source: `src/lib/metricas.ts` lines 898–901:
```ts
const latestByLead = latestConsultoriaByLead(consultorias)
const casosEnSeguimientoLeads = [...latestByLead.values()]
  .filter((c) => canonicalStatus(c.status) === 'En seguimiento').length
```
→ Counts **distinct leads** whose **latest** consultoria has status "En seguimiento". Per-lead, deduplicated.

**Donut Chart** (`page.tsx` line 190):
```tsx
data={metricas.porEstadoAtendidas}
```
Source: `src/lib/metricas.ts` lines 956–970 — filters to only consultorias with a matching `registro_sesion` row (`attendedIds`) AND excludes `Agendado`:
```ts
for (const c of consultorias) {
  if (c.id == null || !attendedIds.has(c.id)) continue
  const s = canonicalStatus(c.status)
  if (s === 'Agendado') continue
  attMap[s] = (attMap[s] ?? 0) + 1
}
```
→ Counts **attended consultorias** grouped by status (not deduplicated by lead).

**Also in main dashboard** (`page.tsx` line 170):
```ts
const enSeguimiento = leads.filter((l) => effectiveStatus(l) === 'En seguimiento').length
```
→ Counts leads whose **first/most-recent consultoria** has status "En seguimiento" (from `LeadCardConsultoria`).

### Root Cause

Three different definitions of "En seguimiento" exist:
- `casosEnSeguimientoLeads`: distinct leads with LATEST consultoria = En seguimiento
- `porEstadoAtendidas["En seguimiento"]`: all attended consultorias with that status
- Dashboard stat bar: leads whose first/most-recent consultoria = En seguimiento

A lead with 3 "En seguimiento" consultorias would show: chart=3, KPI=1.

### Affected Areas

| File | What |
|------|------|
| `src/lib/metricas.ts` lines 898–901, 955–970 | Two different "seguimiento" aggregations |
| `src/app/dashboard/metricas/page.tsx` line 142 | KPI card using `casosEnSeguimientoLeads` |
| `src/app/dashboard/page.tsx` line 170 | Third "enSeguimiento" stat |

### Approaches

1. **Align KPI card with donut chart** — Change KPI card to show `porEstadoAtendidas` total for "En seguimiento". This matches the chart the user sees.
   - Pros: Visual consistency between card and chart
   - Cons: Semantically changes what the KPI means (from "leads" to "consultorias")
   - Effort: Low

2. **Align donut chart with KPI card** — Filter `porEstadoAtendidas` to only count leads once (deduplicate). This is harder because the donut data structure doesn't have lead-level data.
   - Pros: Semantically cleaner ("leads en seguimiento")
   - Cons: Requires significant data pipeline changes
   - Effort: High

3. **Keep both but clarify labels** — Rename KPI card to "Leads en seguimiento" and donut segment stays "Consultorías en seguimiento". Add help hints explaining the difference.
   - Pros: No data logic changes, just UX
   - Cons: Doesn't fix the visual confusion
   - Effort: Low

### Recommendation

**Approach 1 + 3 hybrid**: Add a new metric to `MetricasGlobales` that counts "En seguimiento" consultorias from `porEstadoAtendidas` (simpler, matches the chart the user sees). Update the KPI card to use this new value. Keep `casosEnSeguimientoLeads` available for other use. Also improve the KPI card sub-label to clarify "Consultorías en seguimiento (atendidas)".

---

## 3. Help Hints / Tooltips for KPI Indicators

### Current State

The KPI cards in `page.tsx` (lines 153–169) render as:
```tsx
<div key={kpi.label} className="bg-white p-6 rounded-[10px] border-t-[3px] ...">
  <p className="text-[12px] ...">{kpi.label}</p>
  <span className="material-symbols-outlined ...">{kpi.icon}</span>
  <h3 className="text-2xl ...">{kpi.value}</h3>
  <p className="text-[10px] text-slate-400 mt-3">{kpi.sub}</p>
</div>
```

- No `title` attributes on the cards
- No info/help icons
- No tooltip component
- The `sub` text is minimal (e.g., "Resueltas + En seguimiento", "Leads en seguimiento")
- No explanation of calculation methodology or data sources

### Affected Areas

| File | What |
|------|------|
| `src/app/dashboard/metricas/page.tsx` lines 138–171 | KPI cards definition and rendering |
| `src/components/metricas/GeneralKPIs.tsx` lines 78–101 | KPI summary row inside GeneralKPIs |
| `src/components/metricas/RetentionFunnel.tsx` lines 46–67 | KPI row in RetentionFunnel |
| New: tooltip/help hint component | To be created |

### Approaches

1. **Simple `title` attribute** — Add `title` prop to each KPI card `div` with a description. Browser-native, zero dependencies.
   - Pros: Trivially simple
   - Cons: Unstyled, no icon, not mobile-friendly (no touch)
   - Effort: Low

2. **Info icon with popover/tooltip** — Add a `(?)` or `ℹ` icon next to each KPI label that shows a tooltip on click/hover with full explanation.
   - Pros: Professional UX, works on mobile (click), can include rich text
   - Cons: Need to build or import a tooltip component; more UI work
   - Effort: Medium

3. **Hover tooltip using CSS-only** — Use `group-hover` Tailwind pattern for a CSS-only tooltip that appears on hover.
   - Pros: No JS, accessible via `title` fallback
   - Cons: Limited placement control, no mobile touch
   - Effort: Low-Medium

### Recommendation

**Approach 2** — Build a lightweight `InfoTooltip` component (or use a simple popover pattern). Each KPI definition object gains a `helpText` field. The info icon (`help` or `info` from Material Symbols) triggers a small popover on click/hover with:
- What this metric measures
- How it's calculated (plain language)
- Data source (which table/column)

---

## 4. Insights Error: "Respuesta del proveedor IA con forma inesperada"

### Current State

Error originates in `src/app/api/insights/route.ts` lines 274–281:
```ts
const content = aiData?.choices?.[0]?.message?.content
if (typeof content !== 'string' || content.length === 0) {
  return NextResponse.json(
    { error: 'Respuesta del proveedor IA con forma inesperada', reason: 'missing_choices' },
    { status: 422 },
  )
}
```

The error is displayed in `page.tsx` line 91 (catch block) → line 273:
```tsx
<p className="text-sm text-amber-600">{insightsError}</p>
```

### Root Cause Analysis

The API call to the OpenCode/DeepSeek endpoint (lines 239–251) does **NOT** set `response_format: { type: "json_object" }`:
```ts
body: JSON.stringify({
  model: openAiModel,
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.7,
  max_tokens: 700,
  // MISSING: response_format: { type: "json_object" }
})
```

Without JSON mode:
- DeepSeek models may return reasoning tokens instead of content, or empty content
- The model may wrap JSON in markdown fences inconsistently
- Responses may include prose before/after the JSON
- The prompt says "Responde ÚNICAMENTE con un JSON" but this is a soft instruction, not enforced by the API

Additional possible causes:
- The model might return `reasoning_content` instead of `content` (DeepSeek R1 behavior)
- Network errors returning HTML error pages that parse as valid JSON but without choices
- API rate limiting returning a different response shape

### Affected Areas

| File | What |
|------|------|
| `src/app/api/insights/route.ts` lines 239–281 | API call and error handling |
| `src/app/dashboard/metricas/page.tsx` lines 62–95 | `generarInsights()` caller, error display |

### Approaches

1. **Add `response_format: { type: "json_object" }`** — Forces the model to output valid JSON. The prompt must include the word "JSON" somewhere (it already does). This is the standard fix.
   - Pros: Simple, one-line fix, industry standard for structured output
   - Cons: Some models (DeepSeek R1) may not fully support it; needs testing
   - Effort: Low

2. **Add `response_format` + fallback parsing** — Add JSON mode AND improve the content extraction with better markdown-stripping, handling reasoning_content, and retry logic.
   - Pros: More robust
   - Cons: More code, more edge cases
   - Effort: Medium

3. **Switch to function/tool calling** — Instead of parsing free-text JSON, use OpenAI-compatible function calling with a defined schema.
   - Pros: Most reliable structured output
   - Cons: Requires schema definition; not all OpenCode endpoints support function calling
   - Effort: High

### Recommendation

**Approach 1 + enhanced error handling**: Add `response_format: { type: "json_object" }` to the API call. Additionally, improve the error logging to capture the raw response shape on failure (already partially done with `console.error`). Test with the actual DeepSeek model to confirm JSON mode support. If the model doesn't support it, fall back to approach 2 (better parsing).

---

## 5. Lead Modal Columns: `acciones_realizadas`, `estado_inicial`, `resultado_final`

### Current State

**Database/Type Layer Confirmed**: `src/types/index.ts` lines 96–113 — `RegistroSesion` includes:
- `estado_inicial: string | null` (line 102)
- `acciones_realizadas: string | null` (line 103)
- `resultado_final: string | null` (line 104)

**Data Fetching**: `src/app/dashboard/page.tsx` lines 75–81 fetches `consultorias` but does **NOT** fetch `registro_sesion`.

**Modal Component**: `src/components/LeadModal.tsx` receives `LeadWithMeta` which includes:
- `Lead` (all lead fields)
- `LeadCardFormulario` (tema, descripcion, fecha_registro)
- `LeadCardConsultoria` (consultoria fields — NO registro_sesion fields)

The modal currently shows: Contact info, Professional info, Client need (from form), Booking/Agendamiento details. No session/registro data.

**LeadCardConsultoria type** (`src/components/LeadCard.tsx` lines 5–18): Only has consultoria fields — no registro_sesion fields.

### Affected Areas

| File | What to change |
|------|---------------|
| `src/components/LeadCard.tsx` lines 5–18, 26–30 | Add registro_sesion fields to types |
| `src/app/dashboard/page.tsx` lines 75–81 | Fetch registro_sesion alongside consultorias |
| `src/components/LeadModal.tsx` | Display new columns in the modal body |

### Approaches

1. **Add registro_sesion to LeadCardConsultoria type** — Extend `LeadCardConsultoria` with optional registro fields. Fetch registro_sesion in dashboard page with a left join on `id_consultoria`. Pass through `LeadWithMeta` to the modal.
   - Pros: Minimal type changes, data fetched once per page load
   - Cons: Tightly couples lead card and registration data
   - Effort: Medium

2. **Fetch registro_sesion on modal open** — Keep types unchanged; when modal opens, fetch `registro_sesion` for that lead's consultoria on demand. Display in a dedicated "Registro de sesión" section.
   - Pros: Lazy loading, clean separation of concerns
   - Cons: Additional network request per modal open; slight UX delay
   - Effort: Medium

3. **Create separate `SessionInfo` component** — Add a new section in the modal that accepts registro_sesion props. Fetch data either upfront or lazy.
   - Pros: Clean component boundary
   - Cons: More files, same data-fetching question
   - Effort: Medium

### Recommendation

**Approach 1**: Extend `LeadCardConsultoria` with optional `registro_sesion` fields. Add a Supabase query in dashboard `page.tsx` line 75 that also fetches `registro_sesion(id_consultoria, estado_inicial, acciones_realizadas, resultado_final)` matching the lead's consultoria IDs. Merge into `LeadWithMeta`. In LeadModal, add a new "Registro de sesión" `<Section>` with `Row` components for each of the 3 columns. If no session record exists for the consultoria, hide the section.

---

## 6. Insights from Lead Data: `acciones_realizadas`, `estado_inicial`, `resultado_final`

### Current State

The insights API (`src/app/api/insights/route.ts`) only queries:
- `consultorias.categoria_caso_uso` (line 27) → for "Top 5 casos de uso"
- `consultorias.nivel_potencia` (line 27) → for "Distribución nivel PotencIA"
- `consultas_por_semana` (line 31) — materialized view for weekly stats
- `novedades` (line 140) — latest 20 updates from consultants

It does **NOT** query `registro_sesion` at all. The `estado_inicial`, `acciones_realizadas`, and `resultado_final` columns are completely unused in the insights pipeline.

### Data Available for Insights

From `src/types/index.ts` (RegistroSesion):
- `estado_inicial` — initial state of the lead before the session (free text)
- `acciones_realizadas` — actions taken during the session (free text)
- `resultado_final` — final outcome of the session (free text)
- `motivo_consulta` — reason for consultation
- `pregunta` — the lead's question

### Affected Areas

| File | What |
|------|------|
| `src/app/api/insights/route.ts` `buildImpactContext()` lines 19–82 | Add registro_sesion query |
| `src/app/api/insights/route.ts` prompt lines 196–234 | Add registro_sesion data to prompt |
| `src/lib/metricas.ts` (optional) | Could pre-compute aggregations for efficiency |

### Recommended Insights to Implement

Using the data-analysis skill methodology:

1. **Top soluciones más solicitadas** (most requested solutions)
   - Category: Conversion
   - Source: `registro_sesion.acciones_realizadas` (text analysis/frequency)
   - Chart: Horizontal bar
   - Priority: High
   - Notes: Free-text field; needs categorization or AI-based extraction

2. **Soluciones menos solicitadas** (least requested)
   - Category: Product
   - Source: `registro_sesion.acciones_realizadas`
   - Chart: Table or bar
   - Priority: Medium
   - Notes: Useful for identifying underutilized features to promote or deprecate

3. **Distribución de estado inicial** (initial state distribution)
   - Category: Quality
   - Source: `registro_sesion.estado_inicial`
   - Chart: Pie/donut
   - Priority: Medium
   - Notes: Shows what state leads arrive in — useful for funnel analysis

4. **Tasa de éxito por tipo de caso** (success rate by case type)
   - Category: Quality
   - Source: Cross-reference `consultorias.categoria_caso` + `registro_sesion.resultado_final`
   - Chart: Stacked bar
   - Priority: High
   - Notes: Requires result categorization

5. **Casos de uso a implementar** (use cases to implement)
   - Category: Product
   - Source: `registro_sesion.motivo_consulta` + `registro_sesion.pregunta`
   - Chart: AI-generated text insight
   - Priority: Medium
   - Notes: AI-driven, identifies gaps where leads ask for features not yet available

### Data Gaps

- `acciones_realizadas`, `estado_inicial`, `resultado_final` are free-text fields — they'd need either:
  - AI-based categorization (sent to the DeepSeek model as context)
  - Pre-computed normalized categories (a new mapping table or normalization function in `metricas.ts`)
- These fields may have high NULL rates — should query before relying on them

### Approach

1. **Query registro_sesion in buildImpactContext** — Add a query for `registro_sesion.acciones_realizadas, estado_inicial, resultado_final` (last 30 days, matching the existing consulData IDs).
2. **Aggregate free-text fields** — Use simple frequency counting or pass raw samples to the AI model for analysis.
3. **Update prompt template** — Add new data sections: "ACCIONES REALIZADAS (últ. 30 días)" and "ESTADOS INICIALES", "RESULTADOS FINALES". Ask the AI to extract patterns.
4. **Add structured KPI metrics to persisted rows** — Store computed aggregations as `tipo: 'kpi'` rows in the insights table.

---

## Summary of All Findings

| # | Issue | Root Cause | Complexity | New Files | Modified Files |
|---|-------|-----------|------------|-----------|---------------|
| 1 | Layout: charts stacked instead of side-by-side | Donut in standalone section, heatmap spans full width in separate grid | Medium | Possibly 1 new component | 2 files |
| 2 | KPI count mismatch (10 vs 4) | Different aggregation: per-consultoria (chart) vs per-lead deduplicated (KPI) | Low | 0 | 1–2 files |
| 3 | No help hints on KPIs | No tooltip/info component ever built | Medium | 1 new component | 3+ files |
| 4 | Insights "forma inesperada" error | Missing `response_format: json_object` in AI API call | Low | 0 | 1 file |
| 5 | Missing lead modal columns | registro_sesion not fetched or passed to modal | Medium | 0 | 3 files |
| 6 | Insights from lead session data | registro_sesion columns not queried in insights pipeline | Medium | 0 | 1 file |

---

## Risks

- **Correction 2**: Changing KPI values may break existing tests or confuse users accustomed to current numbers. Verify with actual DB data before deploying.
- **Correction 4**: `response_format: json_object` may not be supported by the specific DeepSeek model in use; test with the actual OpenCode endpoint before finalizing.
- **Correction 5**: registro_sesion may have NULLs for many consultorias; the modal should handle missing data gracefully.
- **Correction 6**: Free-text field analysis via AI is inherently less reliable than structured data; manage expectations with fallback handling.

## Data Gaps (for reference)

- `registro_sesion.acciones_realizadas`, `estado_inicial`, `resultado_final` — free-text fields with unknown NULL rates. Should query Supabase to determine data quality before building insights on them.
- Supabase MCP connection was unavailable during exploration. Schema verification was limited to TypeScript types (`src/types/index.ts`), which are the canonical representation but may drift from the actual DB. A live schema check is recommended before implementation.
