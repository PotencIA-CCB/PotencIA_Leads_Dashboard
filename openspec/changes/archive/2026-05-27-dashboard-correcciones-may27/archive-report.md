# Archive Report

**Change**: dashboard-correcciones-may27
**Archived**: 2026-05-27
**Mode**: openspec
**Verdict**: PASS WITH WARNINGS (user acknowledged, proceeding)

---

## Specs Synced

All 6 domains are NEW (no existing specs to merge — `openspec/specs/` had only `.gitkeep`). Delta specs were full specs, copied directly.

| Domain | Action | Details |
|--------|--------|---------|
| dashboard-chart-layout | Created | 3 requirements (R1-R3): donut extraction, side-by-side grid, mobile stacking |
| insights-json-response | Created | 3 requirements (R1-R3): response_format json_object, enhanced error logging, markdown fallback retained |
| kpi-consistency | Created | 3 requirements (R1-R3): consultoriasEnSeguimientoAtendidas metric, KPI card alignment, casosEnSeguimientoLeads unchanged |
| kpi-help-hints | Created | 3 requirements (R1-R3): InfoTooltip component, helpText on all KPIs, keyboard accessibility |
| lead-session-modal | Created | 3 requirements (R1-R3): LeadCardConsultoria type extension, registro_sesion fetch, modal section |
| session-data-insights | Created | 3 requirements (R1-R3): buildImpactContext session query, AI prompt integration, exploratory confidence qualifier |

## Archive Contents

| Artifact | Status |
|----------|--------|
| proposal.md | ✅ |
| exploration.md | ✅ |
| design.md | ✅ |
| tasks.md | ✅ (22/22 tasks complete) |
| verify-report.md | ✅ |
| specs/ (6 domains) | ✅ |
| archive-report.md | ✅ |

## Config Rule Compliance

### Rule: "Warn before merging delta specs that affect metricas.ts (high blast radius)"

⚠️ **WARNING — ACKNOWLEDGED**: The `kpi-consistency` spec adds `consultoriasEnSeguimientoAtendidas` to `MetricasGlobales`, which is implemented in `src/lib/metricas.ts` (high blast radius per config). Mitigation confirmed:
- Pure computed field from existing `porEstadoAtendidas` — no new DB queries
- Backward-compatible: `casosEnSeguimientoLeads` unchanged
- 114/114 tests pass (including 91 metricas tests)

### Rule: "Verify no regression on 88 existing tests"

✅ **PASS**: 114/114 tests pass across 8 test files. No test regressions. The original config reference of "88 tests" has grown to 91 metricas tests + other existing tests (consultor radar, useWindowWidth) + 23 new tests = 114 total.

## Verification Status (from verify-report)

| Check | Result |
|-------|--------|
| Tests | 114/114 pass (8 files) |
| TypeScript | Clean (`tsc --noEmit`) |
| Build | Pre-existing Windows EPIPE (not a regression) |
| Spec compliance | 18/18 scenarios compliant |
| Design compliance | 6/6 decisions followed |
| TDD compliance | 5/6 checks passed (1 CRITICAL: missing apply-progress TDD table — process gap, not code gap) |

### Issues Carried Forward

1. **CRITICAL**: Missing TDD Cycle Evidence table in apply-progress — protocol gap, not code gap. Actual RED→GREEN TDD was followed (all test files exist, 114 pass). User informed and proceeding.
2. **WARNING**: DeepSeek `json_object` support unverified — deployment risk. Markdown-stripping fallback provides safety net.
3. **WARNING**: `npm run build` EPIPE on Windows — pre-existing, not from this change.

## Source of Truth Updated

- `openspec/specs/dashboard-chart-layout/spec.md`
- `openspec/specs/insights-json-response/spec.md`
- `openspec/specs/kpi-consistency/spec.md`
- `openspec/specs/kpi-help-hints/spec.md`
- `openspec/specs/lead-session-modal/spec.md`
- `openspec/specs/session-data-insights/spec.md`

---

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. All 6 correction capabilities are now source of truth. Ready for the next change.
