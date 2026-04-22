# Delta: Dashboard UI - Brand Adaptation

## MODIFIED Requirements

### Requirement: Tokens de Color

Los tokens de color del dashboard DEBEN coincidir exactamente con el manual de identidad de marca de Máster IA.

Los colores DEBEN ser:
- Azul CCB: `#003087`
- Azul Medio: `#004BB5`
- Cian Acento: `#00C8FF`
- Azul Claro: `#E8EEFB`
- Gris Fondo: `#F4F6FA`
- Texto Suave: `#5A6070`

(Previously: Colores fuera de spec con valores aproximados)

#### Scenario: Colores aplicando manual

- GIVEN tokens CSS en globals.css
- WHEN se cargan los valores
- THEN cada tokens coincide exactamente con el hex del manual

#### Scenario: Color incorrecto persiste

- GIVEN un valor hardcodeado en componente (e.g., #00AEEF)
- WHEN se inspecciona en DevTools
- THEN debe mostrar error en lint/audit

### Requirement: Tipografía

La tipografía del dashboard DEBE seguir la jerarquía del manual:

- Display/Titulares: Space Grotesk
- Body/UI: Inter

(Previously: Poppins para display, Plus Jakarta Sans para UI)

#### Scenario: Headers usan Space Grotesk

- GIVEN un header .display en dashboard
- WHEN se renderiza
- THEN font-family es "Space Grotesk", fallbacks correctos

#### Scenario: Body usa Inter

- GIVEN texto de cuerpo en componentes
- WHEN se renderiza
- THEN font-family es "Inter", fallbacks correctos

## ADDED Requirements

### Requirement: Tokens CSS Centralizados

Los tokens de diseño DEBEN estar centralizados en un solo archivo (globals.css) para facilitar mantenimiento.

El sistema DEBE definir todos los tokens de color, tipografía y spacing en un único lugar.

#### Scenario: Token faltante

- GIVEN necesario usar un color del manual
- WHEN se busca en CSS
- THEN existe en globals.css como variable CSS