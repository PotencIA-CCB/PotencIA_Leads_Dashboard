# Session Data Insights

## Purpose

Integrate `registro_sesion` free-text fields into the AI insights pipeline to extract patterns from session data.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | `buildImpactContext()` MUST query `registro_sesion` rows within the insight period (fields: `acciones_realizadas`, `estado_inicial`, `resultado_final`) | MUST |
| R2 | The AI prompt template SHALL receive aggregated session data: top solutions requested, success rate patterns, and use cases mentioned | SHALL |
| R3 | Insight output SHOULD include a confidence qualifier ("Exploratorio") when patterns derive from free-text fields | SHOULD |

### Scenario: Session fields feed AI prompt

- GIVEN 50 `registro_sesion` rows in the analysis period
- WHEN insights are generated
- THEN the prompt includes categorized session data
- AND the AI output contains patterns like "70% of sessions involved financial review"

### Scenario: Empty session data degrades gracefully

- GIVEN no `registro_sesion` rows match the period
- WHEN `buildImpactContext()` runs
- THEN session data section in prompt is empty/omitted
- AND insight generation completes without error
