# Tasks: Insights from Registro Sesion

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~280 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto (user override from ask-always) |
| Chain strategy | Not needed |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Phase 1: Database — Schema Alignment

- [ ] 1.1 Drain existing `insights` rows via Supabase SQL editor (`DELETE FROM public.insights`)
- [ ] 1.2 Apply migration `20260520_insights_flat.sql` (already written — verify via Supabase dashboard)

## Phase 2: Prompt Enrichment — TDD RED/GREEN

- [x] 2.1 RED — Create `src/lib/__tests__/insights-context.test.ts`: mock `registro_sesion` rows with `pregunta`/`motivo_consulta`, assert output contains "PREGUNTAS DE LEADS" and "MOTIVOS DE CONSULTA"
- [x] 2.2 RED — Add test: 300-char `pregunta` truncated to 200 chars with `"..."`
- [x] 2.3 RED — Add test: null/empty `pregunta`/`motivo_consulta` produce no output lines
- [x] 2.4 GREEN — Add `pregunta` and `motivo_consulta` to `SesionRow` type and `.select()` query in `insights-context.ts`
- [x] 2.5 GREEN — Build "PREGUNTAS DE LEADS" and "MOTIVOS DE CONSULTA" sections capped at 30 samples total
- [x] 2.6 GREEN — Truncate free-text fields exceeding 200 chars with `"..."`
- [x] 2.7 Run `npm test` — existing 88 + route tests + new context tests all pass

## Phase 3: Defensive Insert — TDD RED/GREEN

- [x] 3.1 RED — Add test in `route.test.ts`: mock `insert` returning `{ error: { message: '...' } }`, assert status 500 with `reason: 'insert_failed'`
- [x] 3.2 GREEN — In `route.ts` line 365: destructure `const { error: insError }` from insert, return 500 if `insError`
- [x] 3.3 Run `npm test` — insert-failure test passes, existing 10 route tests intact

## Phase 4: Frontend — Auto-Generate on Mount

- [x] 4.1 Replace `cargarUltimoInsight()` GET-first in `page.tsx` useEffect with direct `generarInsights()` call
- [x] 4.2 Add `sessionStorage` cache: read `insights_cache` on mount, skip POST if `expiresAt > now`, render from cache
- [x] 4.3 On POST success, write `{ data, expiresAt: Date.now() + 5 * 60 * 1000 }` to `sessionStorage`
- [x] 4.4 On POST failure, fall back to GET `/api/insights` and render stored rows
- [x] 4.5 Run `npm test` — zero regressions, 134 tests passing. Build blocked by pre-existing Next.js 16 webpack `write EOF` on Windows (unrelated to changes).
