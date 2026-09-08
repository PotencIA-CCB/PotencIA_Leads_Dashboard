-- PotencIA Leads Dashboard
-- Reconciliación de esquema para el módulo de ingesta.
--
-- Resuelve cuatro drifts documentados en
-- openspec/changes/2026-09-08-modulo-ingesta-datos/exploration.md §2:
--   D-1  consultorias tenía tres nombres para el Booking Id → se consolida en booking_id
--   D-2  registro_sesion.duracion_sesion_minutos se leía sin existir en migraciones
--   D-3  el CHECK de status rechazaba 'No asistió' y 'Escalar'
--   D-4  trg_registro_sesion_after_insert colapsaba estados y contaminaba nivel_potencia
--
-- Idempotente: correrla dos veces no produce error ni cambia el resultado.
-- No ejecuta ningún DROP COLUMN.

begin;

-- ============================================================================
-- D-1 · booking_id como identidad única del Booking Id
-- ============================================================================

alter table public.consultorias add column if not exists booking_id text;

-- Backfill desde id_reserva solo si esa columna existe (es vestigial: la
-- escribía trg_bookings_after_insert, que depende de bookings_entrante, tabla
-- en la que nada inserta).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'consultorias'
      and column_name = 'id_reserva'
  ) then
    execute $q$
      update public.consultorias
         set booking_id = id_reserva
       where id_reserva is not null
         and booking_id is null
    $q$;
  end if;
end $$;

create index if not exists consultorias_booking_id_idx
  on public.consultorias (booking_id);

-- ============================================================================
-- D-2 · duracion_sesion_minutos en registro_sesion
-- ============================================================================

alter table public.registro_sesion
  add column if not exists duracion_sesion_minutos int;

alter table public.registro_sesion
  add column if not exists id_externo text;

create index if not exists registro_sesion_id_externo_idx
  on public.registro_sesion (id_externo);

-- ============================================================================
-- D-3 · CHECK de status ampliado a 7 estados
-- ============================================================================

-- El CHECK original se declaró inline y sin nombre en
-- 20260519_consultorias.sql:42, así que Postgres lo autonombró. Se localiza por
-- catálogo en vez de asumir el nombre.
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.consultorias'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.consultorias drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.consultorias
  add constraint consultorias_status_check
  check (status in (
    'Pendiente', 'Agendado', 'En seguimiento', 'Resuelto',
    'Cancelado', 'No asistió', 'Escalar'
  ));

-- ============================================================================
-- D-4 · El trigger deja de ser dueño del status
-- ============================================================================
--
-- La versión original colapsaba a 'Resuelto' todo resultado que no dijera
-- "resuelto" ni "seguimiento" (incluidos cancelado, no asistió y escalar), y
-- escribía el texto de resultado en consultorias.nivel_potencia — dimensión que
-- metricas.ts:1033 e insights-context.ts:117 agrupan esperando niveles.
--
-- Los dos escritores de registro_sesion (n8n WF-3 hoy, el módulo de ingesta
-- mañana) fijan el status explícitamente, así que la lógica era redundante
-- además de incorrecta. Se conserva solo la actualización de leads.origen.

create or replace function public.trg_registro_sesion_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orig text;
begin
  select origen into v_orig from public.leads where id = NEW.id_lead;

  if v_orig in ('landing', 'booking') then
    update public.leads set
      origen = 'ambos',
      updated_at = now()
    where id = NEW.id_lead;
  end if;

  return NEW;
end;
$$;

commit;
