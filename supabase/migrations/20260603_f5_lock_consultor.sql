-- F5 — Lock consultorias.id_consultor: only service_role / postgres / supabase_admin may update it.
--
-- T08 findings (OI-2 resolution):
--   - request.jwt.claim.role is the Supabase PostgREST JWT role claim GUC.
--     It is set as a session-level GUC by PostgREST before executing queries.
--     For authenticated app users this is 'authenticated'; for service-role clients it is 'service_role'.
--   - current_user reflects the DB role:
--       PostgREST requests: 'authenticator' → SET ROLE to 'authenticated' or 'service_role'
--       Direct DB connections (migrations, admin scripts): 'postgres' or 'supabase_admin'
--   - Both checks together cover all allowed write paths:
--       (a) PostgREST service-role clients   → request.jwt.claim.role = 'service_role'
--       (b) Direct postgres/supabase_admin   → current_user in ('service_role','postgres','supabase_admin')
--
-- Bookings trigger (trg_bookings_after_insert) writes id_consultor on INSERT — not UPDATE.
-- This BEFORE UPDATE trigger never fires during booking ingestion, so the lock is
-- naturally compatible with the existing SECURITY DEFINER ingestion path.

begin;

-- ============================================================================
-- 1. Guard function — SECURITY INVOKER so session GUCs are visible as set by
--    the calling context (PostgREST sets request.jwt.claim.role before exec).
-- ============================================================================
create or replace function public.guard_consultoria_consultor()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Allow when id_consultor is not actually changing (covers NULLs via IS NOT DISTINCT FROM)
  if new.id_consultor is not distinct from old.id_consultor then
    return new;
  end if;

  -- Allow service_role JWT (PostgREST service-role clients)
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;

  -- Allow direct DB connections from trusted roles (migrations, admin scripts, definer functions)
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  raise exception 'id_consultor es inmutable: solo el rol de servicio puede reasignarlo'
    using errcode = 'insufficient_privilege';
end;
$$;

-- ============================================================================
-- 2. Attach trigger to consultorias table
--    Drop first so this migration is idempotent on re-run.
-- ============================================================================
drop trigger if exists trg_guard_consultoria_consultor on public.consultorias;

create trigger trg_guard_consultoria_consultor
  before update on public.consultorias
  for each row execute function public.guard_consultoria_consultor();

commit;

-- ============================================================================
-- Manual verification steps (run after deploying this migration):
--
-- (a) As authenticated app user — MUST fail:
--     UPDATE consultorias SET id_consultor = NULL WHERE id = '<any-id>';
--     Expected: ERROR: id_consultor es inmutable: solo el rol de servicio puede reasignarlo
--
-- (b) As authenticated app user — MUST succeed (id_consultor unchanged):
--     UPDATE consultorias SET status = 'Resuelto' WHERE id = '<any-id>';
--     Expected: UPDATE 1
--
-- (c) As service_role — MUST succeed:
--     UPDATE consultorias SET id_consultor = '<consultor-id>' WHERE id = '<any-id>';
--     Expected: UPDATE 1
-- ============================================================================
