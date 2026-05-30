-- PotencIA Leads Dashboard
-- Migration: novedades_general — generalize novedades to capture anything
-- that influences global statistics (events/absences with dates), and fix RLS.
--
-- Context (live DB state at authoring time):
--   * novedades had NO check constraint on `tipo` (accepted any text).
--   * RLS was over-permissive: `auth_write` (INSERT) + `auth_update` (UPDATE)
--     let ANY authenticated user create/edit ANY row, and there was NO delete
--     policy (nobody but service_role could delete).
-- This migration moves novedades to an owner-scoped model:
--   everyone reads; each consultor creates/edits/deletes only their own;
--   admins manage all. Table is empty, so all changes are data-safe.

begin;

-- 1. Date fields for time-bound events (nullable: knowledge posts don't need them).
alter table public.novedades add column if not exists fecha_inicio date;
alter table public.novedades add column if not exists fecha_fin    date;

-- 2. Integrity: every novedad must belong to a consultor (table is empty).
alter table public.novedades alter column id_consultor set not null;

-- 3. CHECK constraint on `tipo` (none existed). Adds `evento` and `ausencia`.
alter table public.novedades drop constraint if exists novedades_tipo_check;
alter table public.novedades add constraint novedades_tipo_check
  check (tipo in (
    'caso_de_uso', 'mejora', 'incidencia', 'logro',
    'sugerencia', 'otro', 'evento', 'ausencia'
  ));

-- 4. Optional sanity: if a date range is given, end must not precede start.
alter table public.novedades drop constraint if exists novedades_fecha_range_check;
alter table public.novedades add constraint novedades_fecha_range_check
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio);

-- 5. RLS — replace the over-permissive policies with an owner-scoped model.
alter table public.novedades enable row level security;

-- Drop the loose authenticated write/update policies (keep auth_read + svc_all).
drop policy if exists auth_write  on public.novedades;
drop policy if exists auth_update on public.novedades;
-- Drop any owner-scoped policies from a prior run of this migration (idempotency).
drop policy if exists novedades_insert_own    on public.novedades;
drop policy if exists novedades_update_own    on public.novedades;
drop policy if exists novedades_delete_own    on public.novedades;

-- INSERT: only as yourself.
create policy novedades_insert_own
  on public.novedades for insert to authenticated
  with check (
    id_consultor in (select id from public.consultores where auth_id = auth.uid())
  );

-- UPDATE: your own rows, or admin.
create policy novedades_update_own
  on public.novedades for update to authenticated
  using (
    id_consultor in (select id from public.consultores where auth_id = auth.uid())
    or exists (select 1 from public.consultores where auth_id = auth.uid() and rol = 'admin')
  )
  with check (
    id_consultor in (select id from public.consultores where auth_id = auth.uid())
    or exists (select 1 from public.consultores where auth_id = auth.uid() and rol = 'admin')
  );

-- DELETE: your own rows, or admin (enables consultor self-correction).
create policy novedades_delete_own
  on public.novedades for delete to authenticated
  using (
    id_consultor in (select id from public.consultores where auth_id = auth.uid())
    or exists (select 1 from public.consultores where auth_id = auth.uid() and rol = 'admin')
  );

commit;
