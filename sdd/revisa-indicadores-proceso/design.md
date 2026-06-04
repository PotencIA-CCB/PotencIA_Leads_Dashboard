# Design: Revisión Indicadores de Proceso — Jerarquía + Responsive

## Technical Approach

Corrección CSS de un magic number en `.funnel-branch-right::before` (geometría incorrecta), responsive design con Tailwind breakpoints para mobile, tablet y desktop, eliminación de campo muerto `asistieronSinLandingNiBooking` en 5 archivos, y fix del test falso positivo T-C04. Todos los cambios son locales — sin migraciones ni API.

## Architecture Decisions

| Decision | Options considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| Mobile hierarchy cue | A: `border-l-2` solo / B: `pl-6` solo / C: ambos | **C: border-l-2 + pl-4** | Máxima claridad jerárquica; el leve ruido visual es aceptable |
| Branch responsive layout | `flex-col sm:flex-row` | Elegida | Stacked en mobile legible; row en ≥640px preserva diseño actual |
| Typography breakpoints | `text-[28px] sm:text-[34px] md:text-[40px]` | Elegida | 3 escalones cubren mobile→tablet→desktop sin complejidad |
| Dead field `asistieronSinLandingNiBooking` | Dejar vs eliminar | **Eliminar** | Jamás se desestructura ni renderiza; 5 archivos a limpiar |
| `totalBookings` en FunnelStats | Unificar vs mantener separado | **Mantener separado (out of scope)** | Inconsistencia de diseño, no bug |

## Data Flow

Sin cambios. `computeFunnelStats()` → `LeadsFunnel(stats, totalBookings)` → `FunnelCard` / `SummaryRow`. Se elimina el campo `asistieronSinLandingNiBooking` del tipo y del cómputo porque ningún componente lo consume.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/globals.css` | Modify | Fix `.funnel-branch-right::before` (L114-115); replace mobile hide rule (L123-134) with hierarchy cue |
| `src/components/dashboard/LeadsFunnel.tsx` | Modify | Responsive classes: `flex-col sm:flex-row`, `max-w-full sm:max-w-[600px]`, typography `md:` breakpoints |
| `src/lib/capturaStats.ts` | Modify | Remove `asistieronSinLandingNiBooking` from `FunnelStats` type (L20), computation loop (L120-125), return object (L135) |
| `src/app/dashboard/bi/page.tsx` | Modify | Remove from `emptyFunnelStats` (L27) |
| `src/components/dashboard/__tests__/LeadsFunnel.test.tsx` | Modify | Remove from fixtures (L15); fix T-C04 assertion L66 |
| `src/lib/__tests__/capturaStats.test.ts` | Modify | Remove T-F08 test (L206-237); remove from empty test (L256) |

### Detailed code changes

**globals.css L114-115** — fix asymmetry:
```css
/* Before */
  left: 16%;
  right: 5%;
/* After */
  left: 25%;
  right: 25%;
```

**globals.css L123-134** — mobile hierarchy cue:
```css
/* Before */
@media (max-width: 639px) {
  .funnel-stem,
  .funnel-branch::before,
  .funnel-child::before,
  .funnel-branch-right::before { display: none; }
  .funnel-branch,
  .funnel-branch-right { padding-top: 0; }
}

/* After */
@media (max-width: 639px) {
  .funnel-stem,
  .funnel-branch::before,
  .funnel-child::before,
  .funnel-branch-right::before { display: none; }
  .funnel-branch,
  .funnel-branch-right { padding-top: 0; }
  .funnel-child {
    border-left: 2px solid #e2e8f0;
    padding-left: 1rem;
  }
}
```

**LeadsFunnel.tsx** — responsive classes (3 locations):
```tsx
// Root cards (L108, L182) — allow full width on mobile
/* Before */  <div className="w-full max-w-[600px]">
/* After */   <div className="w-full max-w-full sm:max-w-[600px]">

// Level 2 branches (L122, L196) — stack vertically on mobile
/* Before */  <div className="funnel-branch w-full max-w-[940px]">
/* After */   <div className="funnel-branch w-full max-w-[940px] flex-col sm:flex-row">

// Level 3 branch (L149) — stack vertically on mobile
/* Before */  <div className="funnel-branch-right w-full">
/* After */   <div className="funnel-branch-right w-full flex-col sm:flex-row">
```

**LeadsFunnel.tsx** — typography in FunnelCard (L36, L41-42):
```tsx
// Numbers
/* Before */  className="... text-[34px] sm:text-[40px] ..."
/* After */   className="... text-[28px] sm:text-[34px] md:text-[40px] ..."

// Labels
/* Before */  className="text-[13px] sm:text-[15px] ..."
/* After */   className="text-[11px] sm:text-[13px] md:text-[15px] ..."

// Sub labels
/* Before */  className="text-[10px] sm:text-[11px] ..."
/* After */   className="text-[9px] sm:text-[10px] md:text-[11px] ..."
```

**capturaStats.ts** — dead field removal:
```typescript
// Type (L12-21): remove line 20
export interface FunnelStats {
  totalLandingLeads: number
  landingNeverBooked: number
  landingBooked: number
  noShows: number
  cicloCompleto: number
  bookedNoLandingDirecto: number
  soloBookedNoSession: number
  // DELETE: asistieronSinLandingNiBooking: number
}

// computeFunnelStats (L120-125): remove computation block
// DELETE: let asistieronSinLandingNiBooking = 0 ... for loop

// Return object (L127-136): remove line 135
// DELETE: asistieronSinLandingNiBooking,
```

**bi/page.tsx L27** — remove from emptyFunnelStats:
```typescript
// DELETE: asistieronSinLandingNiBooking: 0,
```

**LeadsFunnel.test.tsx** — fixture + T-C04 fix:
```typescript
// Remove from defaultStats (L15): DELETE asistieronSinLandingNiBooking: 1,
// Remove from zeroStats (L26): DELETE asistieronSinLandingNiBooking: 0,

// T-C04 (L56-67): replace false positive assertion
/* Before */
  expect(html).toContain("1")  // asistieronSinLandingNiBooking — never rendered!
/* After */
  expect(html).toContain(">20<") // totalBookings — actually rendered via Tree 2 root
```

**capturaStats.test.ts** — remove T-F08 + field from empty test:
```typescript
// DELETE: T-F08 test (L206-237) — verifies removed field
// DELETE: asistieronSinLandingNiBooking: 0, from empty test (L256)
```

## Interfaces / Contracts

`FunnelStats` type (7 fields after removal):
```typescript
export interface FunnelStats {
  totalLandingLeads: number
  landingNeverBooked: number
  landingBooked: number
  noShows: number
  cicloCompleto: number
  bookedNoLandingDirecto: number
  soloBookedNoSession: number
}
```

No API changes. Component props unchanged (`stats: FunnelStats`, `totalBookings: number`).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (capturaStats) | `computeFunnelStats` returns 7 fields, not 8 | Existing test "returns all zeros" updated with new shape |
| Unit (capturaStats) | T-F08 removed | Delete test; field no longer exists |
| Component (LeadsFunnel) | T-C04 verifies rendered values, not dead fields | Assert `>20<` for totalBookings instead of `1` for dead field |
| Component (LeadsFunnel) | Mobile hierarchy | Visual check: border-l-2 visible on `.funnel-child` at viewport < 640px |
| Visual | Tree line symmetry | Screenshot Level 3: horizontal line spans 25%-75%, centered under T-junction |

## Migration / Rollout

No migration required. No data changes. CSS + dead code removal only. Rollback: revert commit or if `border-l` mobile doesn"t look right, fallback to `display:none` on lines only (remove the `.funnel-child` border rule).

## Open Questions

None — all decisions resolved in proposal.
