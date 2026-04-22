# Delta: Dashboard UI - Frontend Audit

## ADDED Requirements

### Requirement: HTML Semántico

El markup HTML DEBE usar elementos semánticos correctos para accesibilidad y SEO.

El documento DEBE:
- Tener atributo `lang` en el elemento html
- Usar landmark regions: `header`, `nav`, `main`, `aside`, `footer`
- Usar listas ordenadas para breadcrumbs
- Usar botones para elementos clickeables

#### Scenario: Lang definido

- GIVEN layout.tsx
- WHEN se renderiza
- THEN `<html lang="es">`

#### Scenario: Breadcrumb semántico

- GIVEN breadcrumb en dashboard/page.tsx
- WHEN se inspecciona markup
- THEN usa `<ol><li>` no spans

#### Scenario: LeadCard es botón

- GIVEN LeadCard con onClick
- WHEN usuario navega con Tab
- THEN recibe focus y active con Enter

### Requirement: Accesibilidad

Todos los componentes interactivos DEBEN ser accesibles por teclado y lectores de pantalla.

El sistema DEBE:
-Tener aria-label en botones iconográficos
- Tener role="dialog" y aria-modal en modals
- Usar indicadores de estado no solo color

#### Scenario: LeadModal tiene a11y

- GIVEN LeadModal open
- WHEN se abre con screen reader
- THEN anuncia "dialog" y título

#### Scenario: Focus visible

- GIVEN input de búsqueda
- WHEN recibe focus
- THEN outline visible

#### Scenario: prefers-reduced-motion

- GIVEN usuario con configuración motion reduce
- WHEN página carga
- THEN animaciones respetan media query

### Requirement: Animaciones

Los componentes interactivos DEBEN tener transiciones suaves que respeten accesibilidad.

Las animaciones DEBEN:
- Usar CSS transitions (no JS)
- Duración entre 150-300ms
- Respetar prefers-reduced-motion

#### Scenario: LeadModal entrada

- GIVEN LeadModal se abre
- WHEN se renderiza
- THEN animación fade-in suave

#### Scenario: LeadModal salida

- GIVEN LeadModal open
- WHEN se cierra
- THEN animación fade-out

#### Scenario: Hover states

- GIVEN LeadCard en lista
- WHEN mouse enter
- THEN transición suave (150-300ms)