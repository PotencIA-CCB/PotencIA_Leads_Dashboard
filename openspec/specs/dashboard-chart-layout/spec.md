# Dashboard Chart Layout

## Purpose

Arrange the estado consultorías donut chart and franja horaria heatmap side-by-side in the ProductividadKPIs grid, using a reusable `EstadoConsultoriasDonut` component.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | Donut chart MUST be extracted to a `EstadoConsultoriasDonut` component receiving `porEstadoAtendidas` as prop | MUST |
| R2 | Donut + heatmap SHALL render side-by-side in the ProductividadKPIs grid, each with `md:col-span-1` | SHALL |
| R3 | On viewports below `md` breakpoint, both cards MUST stack vertically (full-width) | MUST |

### Scenario: Desktop layout renders side-by-side

- GIVEN viewport width ≥ 768px
- WHEN ProductividadKPIs renders
- THEN donut and heatmap occupy equal-width columns
- AND neither wraps below the other

### Scenario: Mobile layout stacks vertically

- GIVEN viewport width < 768px
- WHEN ProductividadKPIs renders
- THEN donut and heatmap each span full container width
- AND heatmap appears below donut

### Scenario: Donut receives correct data

- GIVEN `porEstadoAtendidas` contains `[{status:"En seguimiento",total:4}]`
- WHEN `EstadoConsultoriasDonut` renders
- THEN donut "En seguimiento" segment displays count 4
