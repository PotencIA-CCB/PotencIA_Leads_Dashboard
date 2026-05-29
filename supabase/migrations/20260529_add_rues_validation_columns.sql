-- Migration: add_rues_validation_columns
-- Adds boolean columns for RUES NIT validation and 2026 renewal tracking.
-- NOT NULL DEFAULT false backfills existing rows automatically.

ALTER TABLE leads
  ADD COLUMN nit_validado_rues boolean NOT NULL DEFAULT false,
  ADD COLUMN renovado_2026 boolean NOT NULL DEFAULT false;
