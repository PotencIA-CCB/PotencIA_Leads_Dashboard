# Tasks: Revisión Indicadores de Proceso — Jerarquía + Responsive

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~66 (30 adds + 36 deletes) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All fixes in one pass | PR 1 | Under 70 lines; single review session |

## Phase 1: Dead Code Removal (R4)

- [ ] 1.1 Remove `asistieronSinLandingNiBooking` from `FunnelStats` type (capturaStats.ts L20), computation block (L116–125), and return object (L135)
- [ ] 1.2 Remove `asistieronSinLandingNiBooking: 0` from `emptyFunnelStats` in bi/page.tsx L27
- [ ] 1.3 Clean dead field from test fixtures: LeadsFunnel.test.tsx L15+L26, capturaStats.test.ts L256, useBusinessIntelligence.test.ts L197

## Phase 2: CSS Corrections (R1, R3)

- [ ] 2.1 Fix `.funnel-branch-right::before` — change `left:16%/right:5%` → `left:25%/right:25%` in globals.css L114–115 (R1-S1)
- [ ] 2.2 Replace mobile hide rule (globals.css L123–134) — add `.funnel-child { border-left: 2px solid #e2e8f0; padding-left: 1rem; }` inside `@media (max-width: 639px)` (R3-S1)

## Phase 3: Component Responsive (R2)

- [ ] 3.1 Add `flex-col sm:flex-row` to `.funnel-branch` wrappers in LeadsFunnel.tsx L122 and L196 (R2-S1, R2-S2)
- [ ] 3.2 Add `flex-col sm:flex-row` to `.funnel-branch-right` wrapper in LeadsFunnel.tsx L149 (R2-S1)
- [ ] 3.3 Update root card `max-w`: `max-w-[600px]` → `max-w-full sm:max-w-[600px]` at L108 and L182 (R2-S3, R2-S4)
- [ ] 3.4 Update typography breakpoints in FunnelCard: números L36 (`text-[28px] sm:text-[34px] md:text-[40px]`), labels L41 (`text-[11px] sm:text-[13px] md:text-[15px]`), sub-label L42 (`text-[9px] sm:text-[10px] md:text-[11px]`)

## Phase 4: Test Corrections (R4)

- [ ] 4.1 Fix T-C04 assertion in LeadsFunnel.test.tsx L66: delete `expect(html).toContain('1')` — false positive for dead field (R4-S3)
- [ ] 4.2 Remove T-F08 test from capturaStats.test.ts L206–237 entirely — tests removed field (R4-S2)
- [ ] 4.3 Update `returns all zeros` test in capturaStats.test.ts L256 — remove `asistieronSinLandingNiBooking: 0` from expected object (R4-S4)

## Phase 5: Verification

- [ ] 5.1 Run `npx tsc --noEmit` — must pass with zero errors across all 7 modified files (R4-S6)
- [ ] 5.2 Run `npx vitest run` — all existing tests pass; no dead-field references remain (R4-S1)
