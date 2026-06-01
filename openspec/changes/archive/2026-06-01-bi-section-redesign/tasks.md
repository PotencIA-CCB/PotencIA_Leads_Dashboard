# Tasks: BI Section Redesign

**Change**: bi-section-redesign
**Delivery strategy**: ask-on-risk
**Artifact store**: openspec + engram

---

## Work Unit A — Word-Cloud Filter Library + Tests (TDD)

Files: `src/lib/wordcloud-filter.ts` (CREATE), `src/lib/__tests__/wordcloud-filter.test.ts` (CREATE)
Spec: `wordcloud-ai-filter` — R1, R4–R9, R12–R13
Sequential: A1 → A2 (test-first mandate)

### A1 — Write failing Vitest spec for `filterByAiTerms`

- [x] Create `src/lib/__tests__/wordcloud-filter.test.ts`
- [x] Import `filterByAiTerms` from `../../lib/wordcloud-filter` (will not exist yet — test must fail)
- [x] Write test case: matched AI term passes through
  - Input `[{text:"automatizacion",count:5}]` → output `[{text:"automatizacion",count:5}]`
  - Spec scenario: "Matched AI term passes through" (R5, R6)
- [x] Write test case: non-AI word excluded
  - Input `[{text:"empresa",count:3},{text:"chatbot",count:7}]` → output `[{text:"chatbot",count:7}]`
  - Spec scenario: "Non-AI word is excluded" (R8)
- [x] Write test case: accented input matches — accent-stripping is done by `processText()` upstream so input is already `"automatizacion"`; verify it matches allowlist (R7)
- [x] Write test case: empty input array → output `[]`, no throw (R11, spec scenario "Empty input array")
- [x] Write test case: no tokens match allowlist → output `[]` (spec scenario "No tokens match allowlist")
- [x] Write test case: input array is not mutated (R9)
- [x] Write test case: duplicate-token aggregation — `processText()` handles this upstream; verify `filterByAiTerms` preserves counts as-is (R12 coverage note)
- [x] Confirm `npm test -- wordcloud-filter` fails (red phase) — implementation does not exist yet
- [x] **Implementation note**: `filterByAiTerms` accepts `{ text: string; count: number }[]` (matching `processText()` output, which uses `count` not `value`). Spec used `value` as generic notation; wire to `count` at implementation time.

### A2 — Implement `filterByAiTerms` in `src/lib/wordcloud-filter.ts`

- [x] Create `src/lib/wordcloud-filter.ts`
- [x] Export `WordData` interface: `{ text: string; count: number }` (matches `processText()` shape)
- [x] Define `AI_TERMS` allowlist as `readonly string[]` — 4+ char accent-free lowercase stems. MUST include at minimum: `automatizacion`, `inteligencia`, `artificial`, `agentes`, `chatbot`, `machine`, `learning`, `digitalizacion`, `automatizar`, `modelo`, `datos`, `procesos`, `asistente`, `prototipo`, `prediccion`, `transformacion`, `optimizacion`, `implementar`, `eficiencia`, `productividad`
  - **Constraint**: terms `ia`, `ml`, `rpa`, `nlp`, `gpt`, `bot` are < 4 chars and dropped by `processText()` BEFORE this function runs — do NOT include them (they are unreachable)
  - `bots` (4 chars) and `chatbot` (7 chars) are reachable — include
- [x] Implement `filterByAiTerms(tokens: WordData[]): WordData[]`
  - Pure function — no side effects, no mutation of input
  - Filter: keep tokens where `token.text.toLowerCase()` matches any entry in `AI_TERMS` exactly (accent-free, lowercased matching; `processText()` already strips accents and lowercases before Title-casing, so compare `token.text.toLowerCase()`)
  - Return filtered subset; order not specified
- [x] Export `filterByAiTerms` (named export)
- [x] Confirm `npm test -- wordcloud-filter` passes (green phase) — all A1 cases pass
- [x] Confirm existing `npm test` suite still passes (no regressions)

---

## Work Unit B — Word-Cloud Data Re-source + Wiring

Files: `src/app/dashboard/metricas/page.tsx` (MODIFY), `src/components/metricas/WordCloud.tsx` (MODIFY)
Spec: `wordcloud-ai-filter` — R2, R3, R10, R11, R15
Sequential: B1 → B2 (page supplies data, component consumes it)
Dependency: A2 must be complete (filterByAiTerms must exist before wiring)

### B1 — Replace data source in `metricas/page.tsx`

- [x] Add new `useEffect` (or extend existing fetch block) that queries `formularios_landing`, column `descripcion`, with `.not('descripcion', 'is', null).limit(200)`
- [x] Remove the existing `registro_sesion.pregunta` Supabase query that feeds `wordCloudSentences` (R2 — old query MUST be removed; **no fallback/merge** per locked decision and verified data)
- [x] Map result rows to `string[]` and call `setWordCloudSentences(data.map((r) => r.descripcion))`
- [x] Confirm TypeScript compiles without errors (the `FormularioLanding` type has `descripcion: string | null`; filter nulls before setting state)
- [x] Spec scenario "Data source is formularios_landing.descripcion" satisfied

### B2 — Apply `filterByAiTerms` in `WordCloud.tsx`

- [x] Import `filterByAiTerms` from `@/lib/wordcloud-filter`
- [x] Update `useMemo` pipeline: `processText(sentences)` → `filterByAiTerms(result)` → assign to `words`
  - Before: `const words = useMemo(() => processText(sentences), [sentences])`
  - After: `const words = useMemo(() => filterByAiTerms(processText(sentences)), [sentences])`
- [x] Update empty-state message from `"Sin datos de preguntas para mostrar."` to `"Sin términos AI encontrados"` (R10, spec scenario "Empty-state rendered when no AI terms found")
- [x] Verify `words.length === 0` branch still guards against runtime errors for zero-row case (R11)
- [x] Confirm `npm run build` succeeds (R15)
- [x] Confirm existing `WordCloud.test.tsx` tests (`processText` suite) still pass — no regressions

---

## Work Unit C — Duración Promedio: Vertical Bar Chart

Files: `src/components/metricas/ProductividadKPIs.tsx` (MODIFY, ~line 127 block)
Spec: `duracion-vertical-bar` — R1–R11
Parallel: C is independent of A, B, D

### C1 — Convert Duración chart from horizontal to vertical bars

- [x] Locate the `BarChart layout="vertical"` block at ~line 132 in `ProductividadKPIs.tsx` (the Duración promedio chart — distinct from the second BarChart at ~line 162)
- [x] Remove `layout="vertical"` prop from `BarChart` (R2)
- [x] Replace `YAxis dataKey="consultor" type="category"` (or equivalent categorical axis) with `XAxis dataKey="consultor" type="category"` (R3)
- [x] Set `XAxis` props: `angle={-35}` `textAnchor="end"` `interval={0}` `height={70}` `fontSize={10}` (R5, R6, R7)
- [x] Set `YAxis` to numeric — remove any `dataKey` string-category binding; ensure `type="number"` or default (R4)
- [x] Ensure `Bar` uses `dataKey="avg"` (R10)
- [x] Add `radius={[4,4,0,0]}` to `Bar` for rounded top corners (design decision)
- [x] Verify `margin` on `BarChart` includes `bottom: 60` (or ≥ 60) to prevent clipped rotated labels (R7)
- [x] Confirm empty-state branch is preserved — when `avgDuracionByConsultor` returns `[]`, existing empty-state renders (R8)
- [x] Confirm all-zero case does not throw (R9)
- [x] No canvas import introduced (R11)
- [x] Confirm `npm run build` succeeds after this change

---

## Work Unit D — Casos Más Solicitados: Inline Donut Chart

Files: `src/components/metricas/ProductividadKPIs.tsx` (MODIFY, ~line 186 block)
Spec: `casos-donut` — R1–R10
Parallel: D is independent of A, B, C

### D1 — Replace Casos BarChart with inline PieChart/donut

- [x] Locate the `BarChart layout="vertical"` block at ~line 192 in `ProductividadKPIs.tsx` (the Casos más solicitados chart)
- [x] Confirm `DONUT_COLORS` is already imported in `ProductividadKPIs.tsx`; if not, add import from the same source used by `EstadoConsultoriasDonut`
- [x] Add Recharts imports if not present: `PieChart`, `Pie`, `Cell`, `Tooltip`, `Legend` (do NOT import from `EstadoConsultoriasDonut` — inline the pattern)
- [x] Remove the existing `BarChart` block entirely (R10)
- [x] Preserve the existing `porCasoUso.length === 0` empty-state guard — it must render before the chart (R6)
- [x] Replace with inline `PieChart` structure:
  ```
  <ResponsiveContainer width="100%" height={260}>
    <PieChart>
      <Pie
        data={metricas.porCasoUso}
        dataKey="total"
        nameKey="caso"
        innerRadius={55}
        outerRadius={80}
      >
        {metricas.porCasoUso.map((_, i) => (
          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
        ))}
      </Pie>
      <Tooltip formatter={(value, name) => [value, name]} />
      <Legend />
    </PieChart>
  </ResponsiveContainer>
  ```
  - R1: PieChart with innerRadius (donut shape)
  - R2: dataKey="total" nameKey="caso"
  - R3: Cell per slice with DONUT_COLORS[i % length] — handles cycling (R3)
  - R4: Tooltip present
  - R5: Legend present
  - R7: single-category edge case — one Cell renders full circle, DONUT_COLORS[0]
  - R8: wrapped in ResponsiveContainer
- [x] Confirm no canvas import introduced (R9)
- [x] Confirm `npm run build` succeeds after this change

---

## Execution Order

```
A1 (TDD spec) → A2 (impl) → B1 (page resource) → B2 (wiring)
C1 (vertical bar)                 [parallel with A+B]
D1 (donut)                        [parallel with A+B+C]
```

A, B are sequential (A must precede B).
C, D are fully independent of A/B and of each other.
Minimum sequential depth: 3 steps (A1 → A2 → B1 → B2).

---

## Review Workload Forecast

| Metric | Estimate |
|---|---|
| Files changed | 5 |
| `src/lib/wordcloud-filter.ts` (new) | ~35 lines |
| `src/lib/__tests__/wordcloud-filter.test.ts` (new) | ~70 lines |
| `src/components/metricas/WordCloud.tsx` (modify) | ~5 lines delta |
| `src/components/metricas/ProductividadKPIs.tsx` (modify) | ~60 lines delta (two chart blocks replaced) |
| `src/app/dashboard/metricas/page.tsx` (modify) | ~15 lines delta |
| **Total estimated changed lines** | **~185 lines** |
| Fits 400-line single-PR budget | **Yes** |
| Chained PRs recommended | **No** |
| 400-line budget risk | **Low** |
| Decision needed before apply | **No** |

All five files fit comfortably within the 400-line budget as a single PR. The four work units (A–D) are independently reviewable commits within that single PR.
