# Archive Report

**Change**: insights-from-registro-sesion
**Archived**: 2026-05-29
**Mode**: openspec
**Verdict**: PASS WITH WARNINGS (Phase 1 DB migration confirmed applied post-verify)

---

## Specs Synced

All 4 domains are NEW capabilities (no existing specs to merge). Delta specs were full specs, copied directly into `openspec/specs/`.

| Domain | Action | Details |
|--------|--------|---------|
| insights-schema-flat | Created | Flat-column `insights` table (`tipo`, `metrica`, `valor_texto`, `descripcion`, `fuente`, `periodo_inicio`, `periodo_fin`, `id_consultor`); CHECK constraint; pre-flight guard; RLS SELECT |
| insights-prompt-enriched | Created | AI prompt receives `pregunta`/`motivo_consulta` from `registro_sesion`; 200-char truncation; 30-sample cap; null/empty omitted |
| insights-defensive-insert | Created | POST handler destructures `{ error }` from insert and returns 500 on failure |
| insights-auto-generate | Created | Frontend POSTs `/api/insights` on mount; 5-min sessionStorage cache; GET fallback on failure |

## Archive Contents

| Artifact | Status |
|----------|--------|
| proposal.md | ✅ |
| exploration.md | ✅ |
| design.md | ✅ |
| tasks.md | ✅ (14/16 tasks marked; the 2 incomplete were manual DB ops — now confirmed applied) |
| verify-report.md | ✅ |
| specs/ (4 domains) | ✅ |
| archive-report.md | ✅ |

## Config Rule Compliance

### Rule: "Warn before merging delta specs that affect metricas.ts (high blast radius)"

✅ **NO BLAST RADIUS**: This change does not touch `src/lib/metricas.ts`. Verified in verify-report (Coherence: "Metricas.ts unchanged — No diff"). Only `insights-context.ts`, `route.ts`, and `metricas/page.tsx` were modified.

### Rule: "Verify no regression on 88 existing tests"

✅ **PASS**: 134/134 tests pass across 10 files, including 88 metricas tests with zero regressions (per verify-report).

## Phase 1 Resolution (post-verify)

The verify-report flagged CRITICAL #1: Phase 1 tasks 1.1 (drain rows) and 1.2 (apply migration `20260520_insights_flat.sql`) were pending manual Supabase access at verification time.

**Confirmed resolved on 2026-05-29** via live DB inspection: the `public.insights` table now has the exact flat schema from the migration (`id, created_at, tipo, metrica, valor_texto, descripcion, fuente, periodo_inicio, periodo_fin, id_consultor`) and holds 22 rows written by the API — proving inserts succeed against the migrated schema. Phase 1 is complete.

## Verification Status (from verify-report)

| Check | Result |
|-------|--------|
| Tests | 134/134 pass (10 files) |
| TypeScript | Clean (`tsc --noEmit`) |
| Build | Pre-existing Next.js 16 webpack `write EOF` on Windows (not a regression) |
| Spec compliance | 21/27 scenarios compliant; 5 untested (frontend — no integration infra); Phase 1 now applied |
| Coverage (changed files) | 89.25% avg |

### Issues Carried Forward

1. **WARNING**: ESLint — unused `err` at `route.ts:306` (prefix `_err`).
2. **WARNING**: ESLint — `useEffect` missing dependency `generarInsights` at `page.tsx:51` (currently safe; stable function).
3. **RISK (acknowledged)**: `insights-auto-generate` Phase 4 has no component-level tests — integration testing unavailable per `openspec/config.yaml`.

## Source of Truth Updated

- `openspec/specs/insights-schema-flat/spec.md`
- `openspec/specs/insights-prompt-enriched/spec.md`
- `openspec/specs/insights-defensive-insert/spec.md`
- `openspec/specs/insights-auto-generate/spec.md`

---

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. All 4 insights capabilities are now source of truth. Ready for the next change.
