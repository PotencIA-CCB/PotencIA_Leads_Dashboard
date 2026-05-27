# KPI Help Hints

## Purpose

Add contextual help tooltips to all KPI cards showing formula, calculation method, and data source.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | An `InfoTooltip` component MUST exist accepting `helpText: string` and rendering a trigger icon with a popover on click/hover | MUST |
| R2 | Every KPI definition SHALL include a `helpText` field with: plain-language formula, calculation method, and source `table.column` | SHALL |
| R3 | Tooltips MUST be keyboard-accessible (`Enter`/`Space` to toggle, `Escape` to close) | MUST |

### Scenario: User hovers over info icon

- GIVEN a KPI card with `helpText: "Total de consultorías en la tabla consultorias — COUNT(*)"`
- WHEN user hovers over info icon
- THEN popover displays the full help text
- AND popover closes on mouse leave

### Scenario: Keyboard user activates tooltip

- GIVEN a KPI card with info icon focused
- WHEN user presses `Enter`
- THEN popover opens with help text
- AND pressing `Escape` closes it
