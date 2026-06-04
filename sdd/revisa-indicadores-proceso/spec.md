# Indicadores de Proceso Specification

## Purpose
Specification for the funnel tree visualization in the BI dashboard. Defines connector geometry, responsive layout breakpoints, mobile hierarchy indicators, and data model hygiene.

## Requirements

### R1: Tree Connector Symmetry
The system MUST render every horizontal connector line symmetrically. For a flex row with two equal-width children (`flex:1`), each child center sits at 25% and 75% of container width. The connector line SHALL span from 25% to 75% (`left:25%;right:25%` in CSS). The `.funnel-branch-right::before` pseudo-element MUST use these values — not magic numbers.

| #   | Scenario                         | Given                                                | When                  | Then                                                                                             |
| --- | -------------------------------- | ---------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| S1  | Level 3 line aligned to centers  | Two FunnelCards inside `.funnel-branch-right`, ≥640px | Component renders     | Horizontal line spans 25%→75%; both child vertical stems intersect at exact child centers        |
| S2  | Hidden stem prevents orphan line | `landingBooked=0`, Level 3 conditional false         | Component renders     | No `.funnel-stem` rendered; no orphan horizontal line                                            |

### R2: Responsive Layout
Below 640px viewport, level containers MUST use `flex-col` so cards stack vertically. At 640px+ they SHALL use `flex-row` for horizontal tree. Root cards SHALL use `max-w-full` below 640px and `max-w-[600px]` above.

| #   | Scenario                  | Given                                 | When              | Then                                                          |
| --- | ------------------------- | ------------------------------------- | ----------------- | ------------------------------------------------------------- |
| S1  | Mobile stacking (<640px)  | Viewport 375px, `.funnel-branch`      | Component renders | Cards stack vertically; each spans full width                 |
| S2  | Desktop row (≥640px)      | Viewport 768px, 2 children            | Component renders | Cards side-by-side with symmetric tree lines                  |
| S3  | Root card mobile          | Viewport 375px                        | Root card renders | `max-w-full` applied; no horizontal overflow                  |
| S4  | Root card desktop         | Viewport 1440px                       | Root card renders | Width capped at 600px, centered                               |

### R3: Mobile Hierarchy Indicator
When tree lines are hidden below 640px, the system MUST show a visible nesting indicator. Each child card SHALL display `border-l-2 border-slate-200` with `pl-4`. Above 640px, original pseudo-element connectors SHALL render.

| #   | Scenario                   | Given                     | When              | Then                                                                       |
| --- | -------------------------- | ------------------------- | ----------------- | -------------------------------------------------------------------------- |
| S1  | Mobile left-border indent  | Viewport 375px, any level | Component renders | FunnelCard has 2px slate left border + 16px padding; tree lines hidden    |
| S2  | Desktop connector lines    | Viewport 1024px           | Component renders | No left border on cards; `.funnel-stem`/`::before` visible with R1 fix    |
| S3  | Boundary at 640px          | Viewport exactly 640px    | Component renders | Mobile hide inactive; tree lines shown with `flex-row`                    |

### R4: Dead Field Removal — `asistieronSinLandingNiBooking`
The `FunnelStats` type and `computeFunnelStats` function MUST NOT define or compute `asistieronSinLandingNiBooking`. This field has zero consumers in the render tree. All fixtures and tests SHALL be cleaned.

| #   | Scenario                   | Given                                        | When                        | Then                                                                                        |
| --- | -------------------------- | -------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| S1  | Interface pruned           | `src/lib/capturaStats.ts`                    | Field removed from type     | `grep asistieronSinLanding` returns zero matches                                            |
| S2  | Compute loop pruned        | `computeFunnelStats()` call                  | Return value inspected      | Object has exactly 7 keys (the 7 rendered fields)                                           |
| S3  | Dead test assertion fixed  | `LeadsFunnel.test.tsx` T-C04                 | `expect('1')` deleted       | `expect('20')` remains; no false-positive substring match on `'10'`                         |
| S4  | Test fixtures cleaned      | `defaultStats`, `zeroStats` in test file     | Fixtures inspected          | Each has 7 properties; `asistieronSinLandingNiBooking` absent                               |
| S5  | Empty stats fixture        | `bi/page.tsx` `emptyFunnelStats`             | File compiled               | 7 properties; no TypeScript errors                                                          |
| S6  | Full typecheck             | `npx tsc --noEmit`                           | All removals applied        | Zero errors across `capturaStats.ts`, `LeadsFunnel.tsx`, `bi/page.tsx`, and test file       |
