# Insights Schema Flat

## Purpose

Replace the old `contenido jsonb` schema with flat columns matching the API's write pattern. Migration `20260520_insights_flat.sql` applies after draining existing rows.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | The `insights` table MUST use flat columns: `tipo`, `metrica`, `valor_texto`, `descripcion`, `fuente`, `periodo_inicio`, `periodo_fin`, `id_consultor` | MUST |
| R2 | `tipo` MUST be constrained to `('insight', 'recomendacion', 'alerta', 'kpi')` via CHECK | MUST |
| R3 | Migration pre-flight guard MUST abort with `raise exception` if any rows exist before `drop table` | MUST |
| R4 | RLS MUST allow authenticated SELECT on all rows | MUST |

### Scenario: Migration on empty table

- GIVEN `insights` table has zero rows
- WHEN migration `20260520_insights_flat.sql` runs
- THEN old table is dropped and recreated with flat columns
- AND CHECK constraint on `tipo` is active

### Scenario: Migration blocked by existing data

- GIVEN `insights` table has existing rows
- WHEN migration runs
- THEN pre-flight guard raises `insights-schema-repair aborted`
- AND table is NOT dropped

### Scenario: API insert aligns with schema

- GIVEN POST handler writes rows with flat-column fields
- WHEN `supabase.from('insights').insert(rows)` executes
- THEN insert succeeds without column mismatch errors
