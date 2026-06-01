# Design: BI Section Redesign (Métricas page)

## Technical Approach

Three independent, in-place edits on the Métricas page. (1) `ProductividadKPIs.tsx` L127 chart flips from horizontal to vertical bars. (2) L186 chart becomes a donut by inlining the `EstadoConsultoriasDonut` pattern (not the component — shape differs). (3) `WordCloud.tsx` gains a TDD-tested pure `filterByAiTerms()` and the page re-sources from `formularios_landing.descripcion`. No changes to `src/lib/metricas.ts`. Strict TDD: `filterByAiTerms()` is test-first.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Duración bars | Remove `layout="vertical"`; `XAxis dataKey="consultor" type="category"` with `angle={-35} textAnchor="end" interval={0} height={70} tick fontSize 10`; `YAxis type="number"`; bar radius `[4,4,0,0]` | Keep horizontal; rotate container | Spec asks for true vertical bars; angled ticks + `interval={0}` guarantees every consultant label renders without overlap; `height={70}` reserves room for rotated labels |
| Casos donut | Inline new `PieChart>Pie>Cell+Tooltip+legend` in `ProductividadKPIs.tsx`, reusing imported `DONUT_COLORS` | Reuse `EstadoConsultoriasDonut` component directly | Component is hard-coded to `{status,total}` + its own title "Estado consultorías"; our data is `{caso,total}`. Inlining the proven markup (innerRadius 55/outerRadius 80, side legend) avoids prop-shape contortion and a second title |
| Donut legend/empty | Side legend mapping `{caso} ({total})` like Estado donut; existing `EmptyState()` when `porCasoUso.length===0` | Recharts `<Legend>` | Matches established visual pattern in the same file; `EmptyState` already exists locally |
| `filterByAiTerms` location | New `src/lib/wordcloud-filter.ts` (pure, exported), imported by `WordCloud.tsx` | Co-locate inside `WordCloud.tsx` | Pure logic belongs in `src/lib` for clean Vitest unit testing without rendering a client component; mirrors `metricas.ts` convention |
| Filter composition order | Filter the RAW sentences BEFORE `processText()` is NOT viable; instead run `processText()` then `filterByAiTerms(words)` on the capitalized/accent-stripped output | Filter raw tokens first | `processText` already lowercases, strips accents, drops `<4` chars and stopwords; allowlist must match its OUTPUT form (Title-case, accent-free). Filtering after reuses all existing normalization |
| Allowlist form & matching | Accent-stripped lowercase stems, substring/`startsWith` stem match (e.g. `automatiz` matches `automatizacion`/`automatizar`) | Exact-token match | `processText` Title-cases and truncates nothing, but Spanish inflections vary; stem `startsWith` catches `agente/agentes`, `automatiz*`, `digitaliz*` without enumerating every form |
| Short-term gotcha | Allowlist uses 4+ char stems only; terms `ia, ml, rpa, nlp, gpt, erp, crm, bot` are dropped by `processText` `<4` filter and CANNOT pass — document as known limitation; keep `chatbot, agentes, automatizacion, inteligencia, artificial, digitalizacion, prototipo, asistente, modelo, datos, prediccion` | Lower `processText` min length to 2 | Lowering min length would pollute the cloud with noise across the whole app; accept that sub-4-char acronyms are out of scope for this cloud |
| Data source | `formularios_landing.descripcion` via new `useEffect` query in `metricas/page.tsx`; if empty, fall back/merge with `registro_sesion.pregunta` | Hard replace | Volume unverified at design time (see Open Questions); resilient fallback prevents an empty cloud regression |

## Data Flow

```
metricas/page.tsx mount
  └─ useEffect → supabase.from('formularios_landing')
        .select('descripcion').not('descripcion','is',null).limit(200)
        ├─ rows.length > 0 → sentences = rows.descripcion
        └─ rows.length === 0 → fallback query registro_sesion.pregunta (merge)
  └─ <WordCloud sentences={...} />
        └─ processText(sentences)  → WordData[] (accent-stripped, Title-case, top40)
        └─ filterByAiTerms(words)  → keep only AI/automation stems
        └─ CSS flex tag cloud (NO canvas — Workers constraint)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/wordcloud-filter.ts` | Create | Pure `filterByAiTerms(words: WordData[]): WordData[]` + exported `AI_TERMS` stem list |
| `src/lib/__tests__/wordcloud-filter.test.ts` | Create | TDD-first unit tests (see Testing) |
| `src/components/metricas/WordCloud.tsx` | Modify | Import + apply `filterByAiTerms` after `processText`; export `WordData` type for reuse; update empty-state copy |
| `src/components/metricas/ProductividadKPIs.tsx` | Modify | L127 → vertical bars; L186 → inline donut with `DONUT_COLORS` + legend + `EmptyState` |
| `src/app/dashboard/metricas/page.tsx` | Modify | Re-source `useEffect` to `formularios_landing.descripcion` with `registro_sesion.pregunta` fallback |

## Interfaces / Contracts

```ts
// src/lib/wordcloud-filter.ts
export interface WordData { text: string; count: number }
export const AI_TERMS: string[]           // accent-free lowercase stems
export function filterByAiTerms(words: WordData[]): WordData[]
// matches when word.text (lowercased) startsWith any stem in AI_TERMS
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (TDD) | `filterByAiTerms` keeps AI stems | `[{text:'Automatizacion'},{text:'Empresa'}]` → only `Automatizacion` |
| Unit | inflection via stem `startsWith` | `Agentes`, `Automatizar` both kept |
| Unit | empty input → `[]`; no AI terms → `[]` | edge cases |
| Unit | case-insensitive match | `inteligencia` and `Inteligencia` both kept |
| Unit | preserves `count` and order | mapping is filter-only, no mutation |
| Regression | existing `processText` + `metricas` suites pass | `npm test` green before/after |
| Presentational | `WordCloud` render, both charts | NOT unit-tested — visual/manual |

## Migration / Rollout

No DB migration. Client-side query change only. Rollback = `git revert` per file. If `descripcion` proves sparse post-deploy, the fallback already merges `registro_sesion.pregunta` — no code change needed.

## Review Budget

Est. ~170–210 changed lines across 5 files. Within 400-line single-PR budget. Decision needed before apply: No.

## Open Questions

- [ ] `formularios_landing.descripcion` live volume / NULL ratio NOT measured: Supabase `execute_sql` MCP tool is not exposed to this design sub-agent. The fallback/merge to `registro_sesion.pregunta` makes the design safe regardless, but the orchestrator (or apply phase) SHOULD run `select count(*) filter (where descripcion is not null) as filled, count(*) as total from formularios_landing` to confirm whether the fallback path will trigger in practice.
