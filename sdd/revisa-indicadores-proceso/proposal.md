# Proposal: Revisión Indicadores de Proceso — Jerarquía + Responsive

## Intent

La sección "Indicadores de Proceso" tiene líneas de jerarquía asimétricas en Level 3 (CSS magic numbers) y carece de adaptación responsive. Se corrigen ambos problemas y se elimina código muerto detectado.

## Scope

### In Scope
- Corregir `.funnel-branch-right::before`: `left:16%/right:5%` → `left:25%/right:25%`
- Agregar `flex-col sm:flex-row` a `.funnel-branch` y `.funnel-branch-right` para que cards se apilen en mobile
- Jerarquía mobile alternativa: `border-l-2` + `pl-4` en `.funnel-child` en vez de ocultar líneas con `display:none`
- Tipografía responsive: `text-[28px] sm:text-[34px] md:text-[40px]` (números), equivalente para labels
- Root cards: `max-w-[600px]` → `max-w-full sm:max-w-[600px]`
- Eliminar campo muerto `asistieronSinLandingNiBooking` de tipo, cómputo, fixtures y tests
- Corregir test T-C04: remover aserción que coincidía con '10' en vez del valor real

### Out of Scope
- Unificar `totalBookings` dentro de `FunnelStats` (inconsistencia de diseño, no bug)

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None — cambios correctivos de implementación, no de requisitos.

## Approach

**CSS fix (1 línea)**: Reemplazar magic numbers por valores geométricamente correctos. Level 3 tiene 2 hijos `flex:1` (centros en 25% y 75%), igual que Level 2. La regla correcta es idéntica: `left:25%;right:25%`.

**Responsive (JSX + CSS)**: Agregar `flex-col sm:flex-row` en los wrappers `.funnel-branch` y `.funnel-branch-right` vía Tailwind. Mobile: cards apiladas. ≥640px: layout horizontal con líneas. Reemplazar media query que ocultaba líneas por `border-l-2 border-slate-200` con `pl-4` para indicar jerarquía por indentación.

**Dead code (4 archivos)**: `asistieronSinLandingNiBooking` se computa pero nunca se desestructura ni renderiza. Eliminar del tipo `FunnelStats`, del bucle final en `computeFunnelStats`, de `emptyFunnelStats`, y de fixtures de test. Eliminar test T-F08.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/globals.css` | Modified | Fix asymmetry (L114-115), replace mobile hide rule (L123-134) |
| `src/components/dashboard/LeadsFunnel.tsx` | Modified | Responsive classes, typography breakpoints, max-w |
| `src/lib/capturaStats.ts` | Modified | Remove `asistieronSinLandingNiBooking` |
| `src/app/dashboard/bi/page.tsx` | Modified | Remove from `emptyFunnelStats` |
| `src/**/__tests__/*.test.tsx` (2) | Modified | Remove dead field, fix T-C04, remove T-F08 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `max-w` change breaks desktop | Low | `sm:max-w-[600px]` preserves desktop identically |
| `flex-col` mobile reorder | Low | Natural top-to-bottom reading order |
| Dead field has hidden consumer | Low | Exhaustive grep confirmed no usage in any component |

## Rollback Plan

Revert commit. All changes are CSS + dead code removal — no migrations, no API changes. If `border-l` mobile doesn't look right, fallback to `display:none`.

## Dependencies

None.

## Success Criteria

- [ ] Level 3 tree line simétrica visualmente (centros alineados con T-junction)
- [ ] Mobile (<640px): cards apiladas verticalmente con indicador de jerarquía visible
- [ ] Tablet (640–1023px): tipografía escalada, layout funcional
- [ ] Desktop (≥1024px): idéntico al actual salvo la línea corregida
- [ ] Tests pasan con campo muerto eliminado y T-C04 corregido
- [ ] `asistieronSinLandingNiBooking` no existe en type, compute, fixtures ni tests
