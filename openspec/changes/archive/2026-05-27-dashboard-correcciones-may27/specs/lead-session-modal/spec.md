# Lead Session Modal

## Purpose

Display `registro_sesion` fields (`acciones_realizadas`, `estado_inicial`, `resultado_final`) in the lead detail modal.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | `LeadCardConsultoria` type SHALL extend with optional `registro_sesion` fields: `acciones_realizadas`, `estado_inicial`, `resultado_final` (all `string | null`) | SHALL |
| R2 | Lead detail page MUST fetch `registro_sesion` rows alongside consultorias and join on `id_consultoria` | MUST |
| R3 | LeadModal SHALL render a "Registro de sesión" section when any of the three fields is non-null | SHALL |

### Scenario: Session data available for consultoria

- GIVEN a consultoria has linked `registro_sesion` with `acciones_realizadas: "Revisión de flujo de caja"`
- WHEN user opens the lead modal
- THEN "Registro de sesión" section displays the actions text
- AND `estado_inicial` and `resultado_final` are shown if present

### Scenario: No session data for consultoria

- GIVEN a consultoria has no linked `registro_sesion` row
- WHEN lead modal renders that consultoria
- THEN "Registro de sesión" section is hidden
- AND no empty labels appear
