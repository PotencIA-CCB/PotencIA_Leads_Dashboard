-- F6 — Schema cleanup: rename leads name column to nombre_completo, drop apellidos,
-- update _enrich_lead + match_or_create_lead RPCs and trg_bookings_after_insert trigger.
--
-- Defensive: handles two possible live states:
--   a) live DB has leads.nombre + leads.apellidos  (current production state)
--   b) fresh DB from on-disk migrations has leads.full_name (no apellidos)
--
-- Stale RPC overloads to drop before recreate:
--   1. public.match_or_create_lead(p_email, p_full_name, ...)   — on-disk variant
--   2. public.match_or_create_lead(p_email, p_nombre, p_apellidos, ...) — live variant
--
-- consultores.nombre is NOT touched anywhere in this migration.

begin;

-- ============================================================================
-- 1. Rename the name column to nombre_completo (defensive: whichever exists)
-- ============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'nombre'
  ) then
    alter table public.leads rename column nombre to nombre_completo;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'full_name'
  ) then
    alter table public.leads rename column full_name to nombre_completo;
  end if;
  -- If nombre_completo already exists (idempotent re-run), do nothing.
end $$;

-- ============================================================================
-- 2. Drop apellidos if it exists
-- ============================================================================
alter table public.leads drop column if exists apellidos;

-- ============================================================================
-- 3. Drop stale match_or_create_lead overloads
--    Drop by exact argument-type signature so only the target overload is removed.
-- ============================================================================

-- On-disk variant: second param is p_full_name text (positional)
drop function if exists public.match_or_create_lead(
  text,  -- p_email
  text,  -- p_full_name
  text,  -- p_phone
  text,  -- p_id_num
  text,  -- p_nit
  text,  -- p_city
  text,  -- p_cargo
  text,  -- p_company_role_level
  text,  -- p_company_role_area
  text,  -- p_sector
  text,  -- p_empresa
  text,  -- p_sexo
  text,  -- p_booking_email
  text,  -- p_booking_customer_id
  text   -- p_origen
);

-- Live variant: p_nombre + p_apellidos (confirmed from booking route.ts)
-- Same type list because postgres overloads are distinguished by arg types only.
-- If the live variant has fewer params, it uses the same type list — drop by name to be safe.
-- Using IF EXISTS ensures no failure if already dropped.
drop function if exists public.match_or_create_lead(
  text,  -- p_email
  text,  -- p_nombre
  text,  -- p_apellidos
  text,  -- p_phone
  text,  -- p_city
  text,  -- p_booking_customer_id
  text,  -- p_id_num
  text,  -- p_nit
  text,  -- p_sector
  text,  -- p_empresa
  text   -- p_origen
);

-- Drop _enrich_lead on-disk variant as well (p_full_name)
drop function if exists public._enrich_lead(
  uuid,  -- p_id
  text,  -- p_full_name
  text,  -- p_phone
  text,  -- p_id_num
  text,  -- p_nit
  text,  -- p_city
  text,  -- p_cargo
  text,  -- p_company_role_level
  text,  -- p_company_role_area
  text,  -- p_sector
  text,  -- p_empresa
  text,  -- p_sexo
  text,  -- p_booking_email
  text,  -- p_booking_customer_id
  text   -- p_caller_origen
);

-- ============================================================================
-- 4. Redefine _enrich_lead with p_nombre_completo
-- ============================================================================
create or replace function public._enrich_lead(
  p_id uuid,
  p_nombre_completo text default null,
  p_phone text default null,
  p_id_num text default null,
  p_nit text default null,
  p_city text default null,
  p_cargo text default null,
  p_company_role_level text default null,
  p_company_role_area text default null,
  p_sector text default null,
  p_empresa text default null,
  p_sexo text default null,
  p_booking_email text default null,
  p_booking_customer_id text default null,
  p_caller_origen text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orig text;
begin
  update public.leads set
    updated_at = now(),
    nombre_completo = coalesce(nullif(trim(p_nombre_completo), ''), nombre_completo),
    phone = coalesce(phone, nullif(trim(p_phone), '')),
    phone_normalized = coalesce(
      phone_normalized,
      public._normalize_phone(p_phone)
    ),
    id_num = coalesce(id_num, nullif(trim(p_id_num), '')),
    nit = coalesce(nit, nullif(trim(p_nit), '')),
    city = coalesce(city, nullif(trim(p_city), '')),
    cargo = coalesce(cargo, nullif(trim(p_cargo), '')),
    company_role_level = coalesce(company_role_level, nullif(trim(p_company_role_level), '')),
    company_role_area = coalesce(company_role_area, nullif(trim(p_company_role_area), '')),
    sector = coalesce(sector, nullif(trim(p_sector), '')),
    empresa = coalesce(empresa, nullif(trim(p_empresa), '')),
    sexo = coalesce(sexo, nullif(trim(p_sexo), '')),
    booking_email = coalesce(booking_email, nullif(trim(p_booking_email), '')),
    booking_customer_id = coalesce(booking_customer_id, nullif(trim(p_booking_customer_id), ''))
  where id = p_id;

  -- Update origen: if lead existed under a different canal → 'ambos'
  if p_caller_origen is not null then
    select origen into v_orig from public.leads where id = p_id;
    if v_orig is not null and v_orig <> p_caller_origen and v_orig not in ('ambos', 'sesion') then
      update public.leads set origen = 'ambos', updated_at = now() where id = p_id;
    end if;
    if v_orig = 'sesion' and p_caller_origen in ('landing', 'booking') then
      update public.leads set origen = 'ambos', updated_at = now() where id = p_id;
    end if;
  end if;
end;
$$;

-- ============================================================================
-- 5. Redefine match_or_create_lead with p_nombre_completo
-- ============================================================================
create or replace function public.match_or_create_lead(
  p_email text,
  p_nombre_completo text,
  p_phone text default null,
  p_id_num text default null,
  p_nit text default null,
  p_city text default null,
  p_cargo text default null,
  p_company_role_level text default null,
  p_company_role_area text default null,
  p_sector text default null,
  p_empresa text default null,
  p_sexo text default null,
  p_booking_email text default null,
  p_booking_customer_id text default null,
  p_origen text default 'landing'
)
returns table (lead_id uuid, matched_by text, es_nueva boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_phone_norm text := public._normalize_phone(p_phone);
  v_lid uuid;
begin
  -- 1) booking_customer_id (stable Microsoft ID)
  if p_booking_customer_id is not null and trim(p_booking_customer_id) <> '' then
    select l.id into v_lid from public.leads l
    where l.booking_customer_id = p_booking_customer_id
    limit 1;
    if v_lid is not null then
      perform public._enrich_lead(v_lid, p_nombre_completo, p_phone, p_id_num, p_nit, p_city,
        p_cargo, p_company_role_level, p_company_role_area, p_sector, p_empresa, p_sexo,
        p_booking_email, p_booking_customer_id, p_origen);
      lead_id := v_lid; matched_by := 'booking_customer_id'; es_nueva := false;
      return next; return;
    end if;
  end if;

  -- 2) id_num (cedula / document)
  if p_id_num is not null and trim(p_id_num) <> '' then
    select l.id into v_lid from public.leads l
    where l.id_num = trim(p_id_num)
    limit 1;
    if v_lid is not null then
      perform public._enrich_lead(v_lid, p_nombre_completo, p_phone, p_id_num, p_nit, p_city,
        p_cargo, p_company_role_level, p_company_role_area, p_sector, p_empresa, p_sexo,
        p_booking_email, p_booking_customer_id, p_origen);
      lead_id := v_lid; matched_by := 'id_num'; es_nueva := false;
      return next; return;
    end if;
  end if;

  -- 3) email (canonical or booking_email)
  select l.id into v_lid from public.leads l
  where lower(l.email) = v_email
     or lower(coalesce(l.booking_email, '')) = v_email
  limit 1;
  if v_lid is not null then
    perform public._enrich_lead(v_lid, p_nombre_completo, p_phone, p_id_num, p_nit, p_city,
      p_cargo, p_company_role_level, p_company_role_area, p_sector, p_empresa, p_sexo,
      p_booking_email, p_booking_customer_id, p_origen);
    lead_id := v_lid; matched_by := 'email'; es_nueva := false;
    return next; return;
  end if;

  -- 4) phone_normalized
  if v_phone_norm is not null and v_phone_norm <> '' then
    select l.id into v_lid from public.leads l
    where l.phone_normalized = v_phone_norm
    limit 1;
    if v_lid is not null then
      perform public._enrich_lead(v_lid, p_nombre_completo, p_phone, p_id_num, p_nit, p_city,
        p_cargo, p_company_role_level, p_company_role_area, p_sector, p_empresa, p_sexo,
        p_booking_email, p_booking_customer_id, p_origen);
      lead_id := v_lid; matched_by := 'phone'; es_nueva := false;
      return next; return;
    end if;
  end if;

  -- 5) New lead
  insert into public.leads (
    nombre_completo, email, phone, phone_normalized, id_num, nit, city,
    cargo, company_role_level, company_role_area, sector, empresa, sexo,
    booking_email, booking_customer_id, origen
  ) values (
    trim(p_nombre_completo), v_email, nullif(trim(p_phone), ''),
    nullif(v_phone_norm, ''), nullif(trim(p_id_num), ''),
    nullif(trim(p_nit), ''), nullif(trim(p_city), ''),
    nullif(trim(p_cargo), ''), nullif(trim(p_company_role_level), ''),
    nullif(trim(p_company_role_area), ''), nullif(trim(p_sector), ''),
    nullif(trim(p_empresa), ''), nullif(trim(p_sexo), ''),
    nullif(trim(p_booking_email), ''), nullif(trim(p_booking_customer_id), ''),
    p_origen
  )
  returning id into v_lid;

  lead_id := v_lid; matched_by := 'created'; es_nueva := true;
  return next;
end;
$$;

-- ============================================================================
-- 6. Update trg_bookings_after_insert to pass p_nombre_completo
-- ============================================================================
create or replace function public.trg_bookings_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_consultor_id uuid;
  v_consultoria_id uuid;
begin
  if NEW.procesado then return NEW; end if;

  -- 1) Match or create lead using nombre_completo
  select ml.lead_id
  into v_lead_id
  from public.match_or_create_lead(
    p_email            := NEW.email_cliente,
    p_nombre_completo  := NEW.nombre_cliente,
    p_phone            := NEW.telefono_cliente,
    p_city             := NEW.direccion_cliente,
    p_booking_email    := NEW.email_cliente,
    p_booking_customer_id := NEW.booking_id,
    p_origen           := 'booking'
  ) ml;

  -- 2) Find consultor by institutional email, alt email, or name
  if NEW.email_personal is not null then
    select c.id into v_consultor_id
    from public.consultores c
    where lower(c.email_institucional) = lower(trim(NEW.email_personal))
       or lower(coalesce(c.email, '')) = lower(trim(NEW.email_personal))
    limit 1;
  end if;
  if v_consultor_id is null and NEW.nombre_personal is not null then
    select c.id into v_consultor_id
    from public.consultores c
    where lower(c.nombre) = lower(trim(NEW.nombre_personal))
    limit 1;
  end if;

  -- 3) Insert consultoria
  insert into public.consultorias (
    id_lead, id_consultor,
    id_reserva,
    fecha, hora_inicio, duracion_minutos,
    servicio, ubicacion,
    staff_name, staff_email,
    status
  ) values (
    v_lead_id, v_consultor_id,
    NEW.booking_id,
    NEW.fecha_hora::date, NEW.fecha_hora::time,
    NEW.duracion_minutos,
    NEW.servicio, NEW.ubicacion,
    NEW.nombre_personal, NEW.email_personal,
    'Agendado'
  )
  returning id into v_consultoria_id;

  -- 4) Mark processed and store references
  update public.bookings_entrante set
    procesado = true,
    id_lead = v_lead_id,
    id_consultoria = v_consultoria_id
  where id = NEW.id;

  return NEW;
end;
$$;

drop trigger if exists trg_bookings_after_insert on public.bookings_entrante;
create trigger trg_bookings_after_insert
  after insert on public.bookings_entrante
  for each row execute function public.trg_bookings_after_insert();

commit;
