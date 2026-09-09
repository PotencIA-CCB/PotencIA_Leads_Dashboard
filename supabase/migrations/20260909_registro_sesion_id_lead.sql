-- PotencIA Leads Dashboard
-- Reconciliación de esquema: registro_sesion.id_lead
--
-- Drift descubierto durante la verificación manual del módulo de ingesta
-- (I4, 2026-09-09), de la misma familia que D-1 y D-2 pero no detectado por la
-- exploración: `20260519_registro_sesion.sql:16` declara la columna `id_lead`
-- not null con FK a leads, pero la tabla en producción no la tiene.
--
-- Nadie la echó en falta porque nada la lee: la app une siempre por
-- id_consultoria (metricas.ts, insights-context.ts, consultores/page.tsx) y
-- n8n/WF-3 tampoco la escribía. El RPC ingest_sesiones sí la escribe, y por eso
-- las 399 filas del .xlsx fallaban con
-- 'column "id_lead" of relation "registro_sesion" does not exist'.
--
-- Se agrega nullable, no not null como declara la migración original: hay filas
-- de registro_sesion con id_consultoria nulo (la columna quedó nullable en la
-- base real), y para esas el backfill no tiene de dónde sacar el lead. Un not
-- null haría fallar la migración. El RPC siempre provee el valor, así que las
-- filas nuevas quedan completas igual.
--
-- Idempotente: correrla dos veces no produce error ni cambia el resultado.
-- No ejecuta ningún DROP.

begin;

alter table public.registro_sesion
  add column if not exists id_lead uuid references public.leads(id) on delete cascade;

-- Backfill desde la consultoría, que es la dueña de la relación con el lead.
update public.registro_sesion rs
   set id_lead = c.id_lead
  from public.consultorias c
 where c.id = rs.id_consultoria
   and rs.id_lead is null;

create index if not exists registro_sesion_lead_idx
  on public.registro_sesion (id_lead);

commit;
