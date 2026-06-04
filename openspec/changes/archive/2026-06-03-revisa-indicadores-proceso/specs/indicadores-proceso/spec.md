# Indicadores de Proceso Specification

## Purpose

Specification for the funnel tree visualization in the BI dashboard. Defines connector geometry, responsive layout breakpoints, mobile hierarchy indicators, and data model hygiene.

## Requirements

### R1: Tree Connector Symmetry

The system MUST render every horizontal connector line symmetrically. For a flex row with two equal-width children (`flex:1`), each child center sits at 25% and 75% of container width. The connector line SHALL span from 25% to 75% (`left:25%;right:25%` in CSS). The `.funnel-branch-right::before` pseudo-element MUST use these values — not magic numbers.

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| S1 | Level 3 line aligned to child centers | Two FunnelCards inside `.funnel-branch-right` at viewport ≥640px | The component renders | Horizontal line spans 25%→75%; both child vertical stems intersect it at their exact centers |
| S2 | Hidden stem prevents orphan lines | `landingBooked=0` — Level 3 JSX conditional is false | The component renders | No `.funnel-stem` element exists; no orphan horizontal line drawn |

### R2: Responsive Layout

Below 640px viewport, level containers MUST use `flex-col` so cards stack vertically. At 640px and above they SHALL use `flex-row` for the horizontal tree layout. Root cards SHALL use `max-w-full` below 640px and `max-w-[600px]` above.

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| S1 | Mobile stacking (<640px) | Viewport 375px, 2 children in `.funnel-branch` | Component renders | Cards stack vertically; each card spans full container width |
| S2 | Desktop/tablet row (≥640px) | Viewport 768px, 2 children | Component renders | Cards displayed side-by-side in `flex-row` with symmetric tree lines |
| S3 | Root card mobile constraint | Viewport 375px | Root card renders | Card fills available width (`max-w-full`); no horizontal overflow |
| S4 | Root card desktop cap | Viewport 1440px | Root card renders | Card width capped at 600px, centered |

### R3: Mobile Hierarchy Indicator

When CSS tree lines are hidden below 640px, the system MUST provide a visible nesting indicator. Each child card SHALL display `border-l-2 border-slate-200` with `pl-4` (left border + left padding) to signal depth. Above 640px, the original pseudo-element connectors SHALL render.

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| S1 | Mobile left-border indent | Viewport 375px, any funnel level | Component renders | Each FunnelCard has a 2px slate left border and 16px left padding; tree lines hidden |
| S2 | Desktop connector lines | Viewport 1024px | Component renders | No left border on cards; `.funnel-stem`, `.funnel-branch::before`, and `.funnel-child::before` visible with R1-correct geometry |
| S3 | Boundary at 640px | Viewport exactly 640px | Component renders | Mobile hide rules inactive; tree lines shown with `flex-row` layout |

### R4: Dead Field Removal

The `FunnelStats` type and `computeFunnelStats` function MUST NOT define or compute `asistieronSinLandingNiBooking`. This field has zero consumers in the render tree. All fixtures and tests SHALL be cleaned to match.

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| S1 | TypeScript interface pruned | `src/lib/capturaStats.ts` | Field removed from `FunnelStats` interface | `grep asistieronSinLanding` returns zero matches in the file |
| S2 | Compute loop pruned | `computeFunnelStats()` called | Return value inspected | Object has exactly 7 keys — the 7 rendered fields only |
| S3 | Dead test assertion removed | `LeadsFunnel.test.tsx` T-C04 | `expect(html).toContain('1')` deleted; `expect(html).toContain('20')` remains | Test passes; `'1'` no longer matches substring of `'10'` in `totalLandingLeads` |
| S4 | Test fixtures cleaned | `defaultStats` and `zeroStats` in test file | Fixtures inspected | Each has 7 properties; no `asistieronSinLandingNiBooking` |
| S5 | Empty stats fixture updated | `bi/page.tsx` `emptyFunnelStats` | File compiles | Object has 7 properties; no TypeScript errors |
| S6 | Full typecheck passes | `npx tsc --noEmit` run | After all removals | Zero errors across all affected files |
