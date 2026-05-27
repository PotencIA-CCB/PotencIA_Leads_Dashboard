# KPI Consistency

## Purpose

Align "En Seguimiento" KPI card value with the donut chart segment count by introducing a new metric sourced from `porEstadoAtendidas`.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | `MetricasGlobales` SHALL include `consultoriasEnSeguimientoAtendidas: number` sourced from `porEstadoAtendidas` filtering `status === 'En seguimiento'` | SHALL |
| R2 | The "En Seguimiento" KPI card MUST display `consultoriasEnSeguimientoAtendidas` (not `casosEnSeguimientoLeads`) | MUST |
| R3 | `casosEnSeguimientoLeads` MUST remain unchanged in `MetricasGlobales` for use by other features | MUST |

### Scenario: KPI matches donut segment

- GIVEN `porEstadoAtendidas` has 4 "En seguimiento" consultorías
- WHEN the KPI card renders
- THEN "En Seguimiento" value is 4
- AND the donut chart segment also shows 4

### Scenario: New metric surfaces zero correctly

- GIVEN `porEstadoAtendidas` has no "En seguimiento" entries
- WHEN `consultoriasEnSeguimientoAtendidas` is computed
- THEN value is 0, not undefined or NaN

### Scenario: Leads-based metric unaffected

- GIVEN `casosEnSeguimientoLeads` returns 10
- WHEN the new metric is added
- THEN `casosEnSeguimientoLeads` still returns 10 (no regression)
