# Insights Prompt Enriched

## Purpose

Add `pregunta` and `motivo_consulta` from `registro_sesion` (`20260519_registro_sesion.sql`) to `buildImpactContext()` query and AI prompt samples, enriching pattern extraction beyond existing `acciones_realizadas`/`estado_inicial`/`resultado_final`.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | `buildImpactContext()` MUST select `pregunta` and `motivo_consulta` from `registro_sesion` alongside existing session fields | MUST |
| R2 | Non-empty `pregunta`/`motivo_consulta` values MUST appear in the prompt's "DATOS DE SESIÓN" section as labeled samples | MUST |
| R3 | Free-text fields SHOULD be truncated to 200 chars to stay within DeepSeek token budget (700 max_tokens) | SHOULD |
| R4 | Null or empty fields MUST produce no prompt noise (no empty lines, no "Pregunta: " without value) | MUST |

### Scenario: Session fields feed enriched prompt

- GIVEN 5 `registro_sesion` rows with non-empty `pregunta` and `motivo_consulta`
- WHEN `buildImpactContext()` runs
- THEN prompt includes samples like `"  - Pregunta: ¿Cómo escalar mi empresa?"` and `"  - Motivo: Crecimiento"`
- AND total session samples cap at 30 entries

### Scenario: Long text truncated

- GIVEN a `pregunta` field exceeds 200 characters
- WHEN building prompt samples
- THEN the value is truncated to 200 chars with `"..."`
- AND truncation does NOT break JSON output

### Scenario: Empty fields omitted

- GIVEN some `registro_sesion` rows have null `pregunta` or `motivo_consulta`
- WHEN building session samples
- THEN empty fields produce no output lines
- AND existing `acciones_realizadas`/`estado_inicial`/`resultado_final` samples still populate normally
