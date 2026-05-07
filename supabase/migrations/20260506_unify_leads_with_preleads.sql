-- PotencIA Leads Dashboard
-- Migration: unify leads (Microsoft Bookings) with preleads (landing form) in one table.
--
-- Goals:
-- 1. Add `source` column to leads ('landing' | 'booking' | 'manual') tracking acquisition channel.
-- 2. Backfill existing leads to 'booking' (or 'manual' if no booking signals).
-- 3. Trigger on preleads → upsert into leads by email, enriching without overwriting existing data.
-- 4. Backfill existing preleads into leads.
-- 5. merge_or_create_lead now sets source='booking' on INSERT (preserves source on UPDATE for first-touch attribution).

begin;

-- ---------------------------------------------------------------------------
-- 1) source column + check + index
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_source_check'
  ) then
    alter table public.leads
      add constraint leads_source_check
      check (source is null or source in ('landing', 'booking', 'manual'));
  end if;
end$$;

create index if not exists leads_source_idx on public.leads (source);

-- Backfill: every existing lead came from Bookings if it has booking signals.
update public.leads
set source = case
  when source is not null then source
  when booking_email is not null or booking_customer_id is not null then 'booking'
  else 'manual'
end
where source is null;

alter table public.leads alter column source set default 'manual';

-- ---------------------------------------------------------------------------
-- 2) Helper: merge a prelead row into leads (enrich, never overwrite)
-- ---------------------------------------------------------------------------
create or replace function public.merge_prelead_into_leads(p_prelead public.preleads)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_prelead.email, '')));
  v_phone_norm text := public._normalize_phone(p_prelead.phone);
  v_lead_id uuid;
begin
  if v_email = '' then
    return null;
  end if;

  -- Match existing lead by email (canonical) or booking_email.
  select l.id into v_lead_id
  from public.leads l
  where lower(l.email) = v_email
     or lower(coalesce(l.booking_email, '')) = v_email
  order by l.created_at asc
  limit 1
  for update;

  if v_lead_id is not null then
    -- Enrich-only: COALESCE preserves any existing value, fills NULL/empty fields.
    update public.leads l
    set
      full_name          = coalesce(nullif(trim(l.full_name), ''),    nullif(trim(p_prelead.full_name), '')),
      id_num             = coalesce(l.id_num,                         nullif(trim(p_prelead.id_num), '')),
      nit                = coalesce(l.nit,                            nullif(trim(p_prelead.nit), '')),
      phone              = coalesce(l.phone,                          nullif(trim(p_prelead.phone), '')),
      city               = coalesce(l.city,                           nullif(trim(p_prelead.city), '')),
      company_role_level = coalesce(l.company_role_level,             nullif(trim(p_prelead.company_role_level), '')),
      company_role_area  = coalesce(l.company_role_area,              nullif(trim(p_prelead.company_role_area), '')),
      solution           = coalesce(l.solution,                       nullif(trim(p_prelead.solution), '')),
      use_case           = coalesce(l.use_case,                       nullif(trim(p_prelead.use_case), '')),
      comments           = coalesce(l.comments,                       nullif(trim(p_prelead.comments), '')),
      perfil_personal    = coalesce(l.perfil_personal,                p_prelead.perfil_personal),
      perfil_empresa     = coalesce(l.perfil_empresa,                 p_prelead.perfil_empresa),
      autorizo_datos     = coalesce(l.autorizo_datos,                 p_prelead.autorizo_datos),
      phone_normalized   = coalesce(l.phone_normalized,               v_phone_norm)
    where l.id = v_lead_id;

    return v_lead_id;
  end if;

  -- No existing lead: create a fresh one tagged as 'landing'.
  insert into public.leads (
    full_name, email, id_num, nit, phone, city,
    company_role_level, company_role_area,
    solution, use_case, comments,
    perfil_personal, perfil_empresa, autorizo_datos,
    phone_normalized, source, status
  )
  values (
    nullif(trim(p_prelead.full_name), ''),
    v_email,
    nullif(trim(p_prelead.id_num), ''),
    nullif(trim(p_prelead.nit), ''),
    nullif(trim(p_prelead.phone), ''),
    nullif(trim(p_prelead.city), ''),
    nullif(trim(p_prelead.company_role_level), ''),
    nullif(trim(p_prelead.company_role_area), ''),
    nullif(trim(p_prelead.solution), ''),
    nullif(trim(p_prelead.use_case), ''),
    nullif(trim(p_prelead.comments), ''),
    p_prelead.perfil_personal,
    p_prelead.perfil_empresa,
    p_prelead.autorizo_datos,
    v_phone_norm,
    'landing',
    'Pendiente'
  )
  returning id into v_lead_id;

  return v_lead_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Trigger: every prelead insert → merge into leads
-- ---------------------------------------------------------------------------
create or replace function public.preleads_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.merge_prelead_into_leads(NEW);
  return NEW;
end;
$$;

drop trigger if exists trg_preleads_after_insert on public.preleads;
create trigger trg_preleads_after_insert
  after insert on public.preleads
  for each row
  execute function public.preleads_after_insert();

-- ---------------------------------------------------------------------------
-- 4) Backfill: replay every existing prelead through the merge function
-- ---------------------------------------------------------------------------
do $$
declare
  r public.preleads%rowtype;
begin
  for r in select * from public.preleads order by created_at asc loop
    perform public.merge_prelead_into_leads(r);
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 5) merge_or_create_lead: stamp source='booking' on creation; preserve on update
-- ---------------------------------------------------------------------------
create or replace function public.merge_or_create_lead(
  p_booking_email text,
  p_full_name text,
  p_phone text default null,
  p_city text default null,
  p_solution text default null,
  p_consultor_id uuid default null,
  p_booking_customer_id text default null,
  p_phone_window_hours int default 72
)
returns table (
  lead_id uuid,
  matched_by text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_booking_email, '')));
  v_phone_norm text := public._normalize_phone(p_phone);
  v_lead_id uuid;
begin
  if v_email = '' then
    raise exception 'p_booking_email is required';
  end if;

  -- 1) Stable booking customer id
  if p_booking_customer_id is not null and trim(p_booking_customer_id) <> '' then
    select l.id into v_lead_id
    from public.leads l
    where l.booking_customer_id = p_booking_customer_id
    limit 1
    for update;

    if v_lead_id is not null then
      update public.leads
      set
        full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
        phone = coalesce(nullif(trim(p_phone), ''), phone),
        city = coalesce(nullif(trim(p_city), ''), city),
        solution = coalesce(nullif(trim(p_solution), ''), solution),
        booking_email = v_email,
        booking_customer_id = p_booking_customer_id,
        phone_normalized = coalesce(v_phone_norm, phone_normalized),
        id_consultor_asignado = coalesce(p_consultor_id, id_consultor_asignado),
        status = 'Agendado'
        -- source preserved: first-touch attribution wins
      where id = v_lead_id;

      lead_id := v_lead_id;
      matched_by := 'booking_customer_id';
      return next;
      return;
    end if;
  end if;

  -- 2) Match by booking email or canonical email
  select l.id into v_lead_id
  from public.leads l
  where lower(l.booking_email) = v_email
     or lower(l.email) = v_email
  limit 1
  for update;

  if v_lead_id is not null then
    update public.leads
    set
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      phone = coalesce(nullif(trim(p_phone), ''), phone),
      city = coalesce(nullif(trim(p_city), ''), city),
      solution = coalesce(nullif(trim(p_solution), ''), solution),
      booking_email = v_email,
      booking_customer_id = coalesce(nullif(trim(p_booking_customer_id), ''), booking_customer_id),
      phone_normalized = coalesce(v_phone_norm, phone_normalized),
      id_consultor_asignado = coalesce(p_consultor_id, id_consultor_asignado),
      status = 'Agendado'
      -- source preserved
    where id = v_lead_id;

    lead_id := v_lead_id;
    matched_by := 'email';
    return next;
    return;
  end if;

  -- 3) Conservative phone-window match
  if v_phone_norm is not null then
    select l.id into v_lead_id
    from public.leads l
    where l.phone_normalized = v_phone_norm
      and l.created_at >= (now() - make_interval(hours => greatest(p_phone_window_hours, 1)))
      and l.status in ('Pendiente', 'Agendado')
    order by l.created_at desc
    limit 1
    for update;

    if v_lead_id is not null then
      update public.leads
      set
        full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
        phone = coalesce(nullif(trim(p_phone), ''), phone),
        city = coalesce(nullif(trim(p_city), ''), city),
        solution = coalesce(nullif(trim(p_solution), ''), solution),
        booking_email = v_email,
        booking_customer_id = coalesce(nullif(trim(p_booking_customer_id), ''), booking_customer_id),
        phone_normalized = v_phone_norm,
        id_consultor_asignado = coalesce(p_consultor_id, id_consultor_asignado),
        status = 'Agendado'
        -- source preserved
      where id = v_lead_id;

      lead_id := v_lead_id;
      matched_by := 'phone_window';
      return next;
      return;
    end if;
  end if;

  -- 4) Brand-new lead from Bookings
  insert into public.leads (
    full_name,
    email,
    phone,
    city,
    solution,
    booking_email,
    booking_customer_id,
    phone_normalized,
    id_consultor_asignado,
    status,
    source
  )
  values (
    trim(p_full_name),
    v_email,
    nullif(trim(p_phone), ''),
    nullif(trim(p_city), ''),
    nullif(trim(p_solution), ''),
    v_email,
    nullif(trim(p_booking_customer_id), ''),
    v_phone_norm,
    p_consultor_id,
    'Agendado',
    'booking'
  )
  returning id into v_lead_id;

  lead_id := v_lead_id;
  matched_by := 'created';
  return next;
end;
$$;

commit;
