-- PotencIA Leads Dashboard
-- Migration: fix merge logic for perfil_* flags coming from Form PotencIA.
--
-- Problem: leads.perfil_personal/perfil_empresa/autorizo_datos likely have
-- DEFAULT FALSE in the schema. When a Microsoft Bookings webhook creates a
-- new lead, these columns get filled with false. Later when the customer
-- submits the landing form (prelead) with TRUE values, the merge function
-- did `coalesce(l.flag, p_prelead.flag)` which preserves the existing false
-- and never propagates the prelead's true. Result: every lead shows "No"
-- in the dashboard even when the user actually checked the box.
--
-- Fix:
--   1. In merge_prelead_into_leads, invert the COALESCE order for these flags
--      so the prelead's value wins when non-null. Form PotencIA is the source
--      of truth for these fields; bookings don't capture them.
--   2. Backfill: replay every prelead's flags into the matched lead so the
--      existing leads get corrected.

begin;

-- ---------------------------------------------------------------------------
-- 1) Updated merge_prelead_into_leads: prelead wins for perfil flags
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
  v_id_num text := nullif(trim(coalesce(p_prelead.id_num, '')), '');
  v_lead_id uuid;
begin
  if v_email = '' and v_id_num is null and v_phone_norm is null then
    return null;
  end if;

  -- 1) email
  if v_email <> '' then
    select l.id into v_lead_id
    from public.leads l
    where lower(l.email) = v_email
       or lower(coalesce(l.booking_email, '')) = v_email
    order by l.created_at asc
    limit 1
    for update;
  end if;

  -- 2) cédula
  if v_lead_id is null and v_id_num is not null then
    select l.id into v_lead_id
    from public.leads l
    where l.id_num = v_id_num
    order by l.created_at asc
    limit 1
    for update;
  end if;

  -- 3) phone_normalized
  if v_lead_id is null and v_phone_norm is not null then
    select l.id into v_lead_id
    from public.leads l
    where l.phone_normalized = v_phone_norm
    order by l.created_at asc
    limit 1
    for update;
  end if;

  if v_lead_id is not null then
    update public.leads l
    set
      -- text/identity fields: enrich-only (existing wins, only fills if NULL/empty)
      full_name          = coalesce(nullif(trim(l.full_name), ''),    nullif(trim(p_prelead.full_name), '')),
      id_num             = coalesce(l.id_num,                         v_id_num),
      nit                = coalesce(l.nit,                            nullif(trim(p_prelead.nit), '')),
      phone              = coalesce(l.phone,                          nullif(trim(p_prelead.phone), '')),
      city               = coalesce(l.city,                           nullif(trim(p_prelead.city), '')),
      company_role_level = coalesce(l.company_role_level,             nullif(trim(p_prelead.company_role_level), '')),
      company_role_area  = coalesce(l.company_role_area,              nullif(trim(p_prelead.company_role_area), '')),
      solution           = coalesce(l.solution,                       nullif(trim(p_prelead.solution), '')),
      use_case           = coalesce(l.use_case,                       nullif(trim(p_prelead.use_case), '')),
      comments           = coalesce(l.comments,                       nullif(trim(p_prelead.comments), '')),
      phone_normalized   = coalesce(l.phone_normalized,               v_phone_norm),
      -- Form PotencIA flags: prelead wins (source of truth — bookings don't capture them)
      perfil_personal    = coalesce(p_prelead.perfil_personal,        l.perfil_personal),
      perfil_empresa     = coalesce(p_prelead.perfil_empresa,         l.perfil_empresa),
      autorizo_datos     = coalesce(p_prelead.autorizo_datos,         l.autorizo_datos)
    where l.id = v_lead_id;
    return v_lead_id;
  end if;

  -- No match: brand new landing lead
  insert into public.leads (
    full_name, email, id_num, nit, phone, city,
    company_role_level, company_role_area,
    solution, use_case, comments,
    perfil_personal, perfil_empresa, autorizo_datos,
    phone_normalized, source, status
  )
  values (
    nullif(trim(p_prelead.full_name), ''),
    nullif(v_email, ''),
    v_id_num,
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
-- 2) Backfill: re-apply perfil flags from existing preleads to matched leads
-- ---------------------------------------------------------------------------
do $$
declare
  p public.preleads%rowtype;
  v_email text;
  v_phone_norm text;
  v_id_num text;
  v_lead_id uuid;
begin
  for p in select * from public.preleads order by created_at asc loop
    -- skip if prelead has no perfil signal at all
    if p.perfil_personal is null and p.perfil_empresa is null and p.autorizo_datos is null then
      continue;
    end if;

    v_email := lower(trim(coalesce(p.email, '')));
    v_phone_norm := public._normalize_phone(p.phone);
    v_id_num := nullif(trim(coalesce(p.id_num, '')), '');
    v_lead_id := null;

    -- Match by email > cédula > phone (same priority as the trigger)
    if v_email <> '' then
      select id into v_lead_id from public.leads
      where lower(email) = v_email or lower(coalesce(booking_email, '')) = v_email
      order by created_at asc limit 1;
    end if;
    if v_lead_id is null and v_id_num is not null then
      select id into v_lead_id from public.leads
      where id_num = v_id_num
      order by created_at asc limit 1;
    end if;
    if v_lead_id is null and v_phone_norm is not null then
      select id into v_lead_id from public.leads
      where phone_normalized = v_phone_norm
      order by created_at asc limit 1;
    end if;

    if v_lead_id is not null then
      update public.leads l
      set
        perfil_personal = coalesce(p.perfil_personal, l.perfil_personal),
        perfil_empresa  = coalesce(p.perfil_empresa,  l.perfil_empresa),
        autorizo_datos  = coalesce(p.autorizo_datos,  l.autorizo_datos)
      where l.id = v_lead_id;
    end if;
  end loop;
end$$;

commit;
