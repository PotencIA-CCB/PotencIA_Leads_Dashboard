# Insights Defensive Insert

## Purpose

The POST `/api/insights` handler currently does not check the `{ error }` returned by `supabase.from('insights').insert()`. Insert failures are silently swallowed, causing missing insights with no diagnostic.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | POST handler MUST destructure `{ error }` from the Supabase insert call | MUST |
| R2 | On insert error, handler MUST return HTTP 500 with error details (`{ error: string, reason: 'insert_failed', detail: string }`) | MUST |
| R3 | Successful insert MUST NOT alter the existing response payload (`{ insights, recomendaciones, alertas, _meta }`) | MUST |
| R4 | Empty rows edge case (no insights generated) MUST still return the parsed AI response without attempting insert | MUST |

### Scenario: Successful insert

- GIVEN AI returns valid parsed JSON with 3 insights, 3 recomendaciones, 3 alertas
- WHEN rows are inserted into `insights`
- THEN `{ error }` is null
- AND response returns `{ insights: [...], recomendaciones: [...], alertas: [...], _meta: {...} }`

### Scenario: Insert fails

- GIVEN Supabase insert fails (e.g., CHECK constraint violation, FK violation)
- WHEN handler checks `{ error }`
- THEN response is HTTP 500 with `{ error: "Error guardando insights", reason: "insert_failed", detail: "..." }`

### Scenario: No insights generated, skip insert

- GIVEN AI returns empty arrays (`{ insights: [], recomendaciones: [], alertas: [] }`)
- WHEN handler evaluates `rows.length > 0`
- THEN insert is skipped
- AND response returns `{ insights: [], recomendaciones: [], alertas: [], _meta: {...} }` (200 OK)
