# Proposal: Adaptación al Manual de Marca

## Intent

Actualizar el diseño del dashboard para cumplir con el manual de identidad de marca de Máster IA (Cámara de Comercio de Barranquilla). Los colores, tipografía y tokens CSS actuales no coinciden con la guía definida.

## Scope

### In Scope
- Actualizar tokens CSS en `globals.css` con colores del manual
- Cambiar tipografía: Poppins → Space Grotesk (display), Plus Jakarta Sans → Inter (UI)
- Actualizar layout.tsx con fonts correctos
- Verificar que todos los componentes usen los tokens actualizados

### Out of Scope
- Nuevos componentes UI
- Cambios en layout o estructura de páginas

## Capabilities

### Modified Capabilities
- `dashboard-ui`: tokens de diseño fuera de spec

## Approach

Reemplazar valores CSS en `globals.css` con los del manual:
- `--color-azul-medio`: #0050C8 → #004BB5
- `--color-cian-acento`: #00AEEF → #00C8FF
- `--color-gris-fondo`: #F2F4F7 → #F4F6FA
- Agregar variables para Space Grotesk e Inter
- Actualizar `@import` de Google Fonts en layout.tsx

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/globals.css` | Modified | Tokens de color y fuente |
| `src/app/layout.tsx` | Modified | Google Fonts import |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Componentes con hardcoded colors | Low | Buscar y reemplazar #00AEEF, #0050C8, #F2F4F7 |

## Rollback Plan

Reversión simple: restaurar `globals.css` y `layout.tsx` desde git.

## Dependencies

- Manual de identidad de marca proporcionado por el usuario

## Success Criteria

- [ ] Colores exactamente igual al manual (#003087, #004BB5, #00C8FF, #F4F6FA)
- [ ] Tipografía: Space Grotesk en headers, Inter en body
- [ ] Compilador sin errores
- [ ] Verificar en browser que cambios son visibles