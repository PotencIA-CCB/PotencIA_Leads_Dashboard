# Tasks: Frontend Audit

## Phase 1: HTML Semántico

- [ ] 1.1 Agregar `lang="es"` en layout.tsx (html element)
- [ ] 1.2 Verificar landmark regions en dashboard/layout.tsx (nav, main, aside)
- [ ] 1.3 Cambiar breadcrumb spans → ol/li en dashboard/page.tsx

## Phase 2: Accesibilidad

- [ ] 2.1 Agregar role="button", tabIndex={0}, onKeyDown en LeadCard.tsx para keyboard
- [ ] 2.2 Agregar role="dialog", aria-modal, aria-labelledby en LeadModal.tsx
- [ ] 2.3 Agregar aria-label en botones iconográficos (sidebar, FAB)
- [ ] 2.4 Mejorar focus visible en search input (focus:ring)
- [ ] 2.5 Agregar prefers-reduced-motion CSS

## Phase 3: Animaciones

- [ ] 3.1 Agregar transición entrada LeadModal (opacity/transform)
- [ ] 3.2 Agregar transición salida LeadModal
- [ ] 3.3 Agregar transition faltante en login button
- [ ] 3.4 Consolidar transitions en un solo lugar si es posible

## Phase 4: CSS Cleanup

- [ ] 4.1 Eliminar fontFamily inline repetitivo en componentes
- [ ] 4.2 Verificar que todos usen tokens de globals.css
- [ ] 4.3 Crear @layer utilities para transiciones reusable

## Phase 5: Verificación

- [ ] 5.1 Verificar build sin errores
- [ ] 5.2 Test keyboard navigation: Tab + Enter en LeadCard
- [ ] 5.3 Test con screen reader si está disponible
- [ ] 5.4 Lighthouse accessibility score ( ≥90)