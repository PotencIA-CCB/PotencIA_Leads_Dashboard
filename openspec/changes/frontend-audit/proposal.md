# Proposal: Auditoría Frontend

## Intent

Realizar auditoría y mejoras de frontend siguiendo mejores prácticas: HTML semántico, accesibilidad, animaciones y performance. El código actual tiene issues de a11y y semántica que deben corregirse.

## Scope

### In Scope
- HTML semántico: agregar lang, roles, landmark regions
- Accesibilidad: aria-labels, focus states, keyboard navigation
- Animaciones: entrada/salida de modals, transiciones suaves
- CSS: eliminar styles inline重复, consolidar tokens
- SEO: meta tags, semantic heading hierarchy

### Out of Scope
- Nuevas páginas o rutas
- Cambios en lógica de negocio

## Capabilities

### Modified Capabilities
- `dashboard-ui`: calidad frontend fuera de spec

## Approach

1. **HTML Semántico**
   - Agregar `lang="es"` en layout.tsx
   - Cambiar breadcrumb spans → ol/li
   - Agregar landmark regions (main, nav, aside)
   
2. **Accesibilidad**
   - Agregar `role="button"` y `tabIndex={0}` en LeadCard clickable
   - Agregar `role="dialog"` y `aria-modal` en LeadModal
   - Agregar `aria-label` en botones iconográficos
   - Mejorar focus visible
   
3. **Animaciones**
   - Agregar CSS transitions para LeadModal entrada/salida
   - Verificar que todos los hover states tengan transition
   - Reducir motion prefereces si está definido

4. **CSS**
   - Eliminar fontFamily inline repetitivo
   - Consolidar en Tailwind + globals.css

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/layout.tsx` | Modified | lang, meta |
| `src/app/dashboard/page.tsx` | Modified | semantic breadcrumb |
| `src/components/LeadCard.tsx` | Modified | roles, a11y |
| `src/components/LeadModal.tsx` | Modified | a11y, animations |
| `src/app/dashboard/layout.tsx` | Modified | landmarks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking cambios en UI | Low | Cambios incrementales, verificar visual |
| Motion sensitivity | Low | Respetar prefers-reduced-motion |

## Rollback Plan

Reversión desde git de archivos modificados.

## Dependencies

- Ninguno (trabajo interno de calidad)

## Success Criteria

- [ ] Lighthouse accessibility ≥ 90
- [ ] No errores de axe-core
- [ ] Keyboard navigation completa
- [ ] Animaciones suaves (60fps)
- [ ] prefers-reduced-motion respetado