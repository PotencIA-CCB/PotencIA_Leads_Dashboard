-- PotencIA Leads Dashboard
-- Migration: cross-channel dedup by phone_normalized.
--
-- Problem: Microsoft Bookings doesn't capture cédula in its default form. So when
-- a customer books with email A (no cédula) and later fills the landing form with
-- email B + cédula, the cédula match fails (booking lead has id_num=null).
--
-- Solution: add phone_normalized as an additional matching signal — if both records
-- carry the same normalized phone, they're almost certainly the same person.
-- Match priority becomes:
--   1. booking_customer_id (Microsoft stable ID)
--   2. email (canonical or booking_email)
--   3. id_num (cédula)
--   4. phone_normalized — NEW (was a 72h-windowed match, now unconstrained)
--   5. INSERT
--
-- Plus a retroactive dedup of existing leads sharing phone_normalized,
-- gated by first-name match to avoid false positives.

begin;

-- ---------------------------------------------------------------------------
-- 1) Update merge_prelead_into_leads to add phone_normalized matching
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

  -- 1) email (canonical or booking_email)
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

  -- 3) phone_normalized (cross-channel: same person, different email AND no cédula in booking)
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
      perfil_personal    = coalesce(l.perfil_personal,                p_prelead.perfil_personal),
      perfil_empresa     = coalesce(l.perfil_empresa,                 p_prelead.perfil_empresa),
      autorizo_datos     = coalesce(l.autorizo_datos,                 p_prelead.autorizo_datos),
      phone_normalized   = coalesce(l.phone_normalized,               v_phone_norm)
    where l.id = v_lead_id;
    return v_lead_id;
  end if;

  -- New landing lead
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
-- 2) merge_or_create_lead: replace 72h phone_window with unconstrained phone match
-- ---------------------------------------------------------------------------
drop function if exists public.merge_or_create_lead(text, text, text, text, text, uuid, text, text, text, int);

create or replace function public.merge_or_create_lead(
  p_booking_email text,
  p_full_name text,
  p_phone text default null,
  p_city text default null,
  p_solution text default null,
  p_consultor_id uuid default null,
  p_booking_customer_id text default null,
  p_id_num text default null,
  p_nit text default null,
  p_phone_window_hours int default 72  -- kept for signature compat; no longer used
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
  v_id_num text := nullif(trim(coalesce(p_id_num, '')), '');
  v_nit text := nullif(trim(coalesce(p_nit, '')), '');
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
        id_num = coalesce(id_num, v_id_num),
        nit = coalesce(nit, v_nit),
        booking_email = v_email,
        booking_customer_id = p_booking_customer_id,
        phone_normalized = coalesce(v_phone_norm, phone_normalized),
        id_consultor_asignado = coalesce(p_consultor_id, id_consultor_asignado),
        status = 'Agendado'
      where id = v_lead_id;

      lead_id := v_lead_id;
      matched_by := 'booking_customer_id';
      return next;
      return;
    end if;
  end if;

  -- 2) email
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
      id_num = coalesce(id_num, v_id_num),
      nit = coalesce(nit, v_nit),
      booking_email = v_email,
      booking_customer_id = coalesce(nullif(trim(p_booking_customer_id), ''), booking_customer_id),
      phone_normalized = coalesce(v_phone_norm, phone_normalized),
      id_consultor_asignado = coalesce(p_consultor_id, id_consultor_asignado),
      status = 'Agendado'
    where id = v_lead_id;

    lead_id := v_lead_id;
    matched_by := 'email';
    return next;
    return;
  end if;

  -- 3) cédula
  if v_id_num is not null then
    select l.id into v_lead_id
    from public.leads l
    where l.id_num = v_id_num
    order by l.created_at asc
    limit 1
    for update;

    if v_lead_id is not null then
      update public.leads
      set
        full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
        phone = coalesce(nullif(trim(p_phone), ''), phone),
        city = coalesce(nullif(trim(p_city), ''), city),
        solution = coalesce(nullif(trim(p_solution), ''), solution),
        id_num = coalesce(id_num, v_id_num),
        nit = coalesce(nit, v_nit),
        booking_email = coalesce(booking_email, v_email),
        booking_customer_id = coalesce(nullif(trim(p_booking_customer_id), ''), booking_customer_id),
        phone_normalized = coalesce(v_phone_norm, phone_normalized),
        id_consultor_asignado = coalesce(p_consultor_id, id_consultor_asignado),
        status = 'Agendado'
      where id = v_lead_id;

      lead_id := v_lead_id;
      matched_by := 'id_num';
      return next;
      return;
    end if;
  end if;

  -- 4) phone_normalized (unconstrained — handles "different email, same phone")
  if v_phone_norm is not null then
    select l.id into v_lead_id
    from public.leads l
    where l.phone_normalized = v_phone_norm
    order by l.created_at asc
    limit 1
    for update;

    if v_lead_id is not null then
      update public.leads
      set
        full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
        phone = coalesce(nullif(trim(p_phone), ''), phone),
        city = coalesce(nullif(trim(p_city), ''), city),
        solution = coalesce(nullif(trim(p_solution), ''), solution),
        id_num = coalesce(id_num, v_id_num),
        nit = coalesce(nit, v_nit),
        booking_email = coalesce(booking_email, v_email),
        booking_customer_id = coalesce(nullif(trim(p_booking_customer_id), ''), booking_customer_id),
        phone_normalized = v_phone_norm,
        id_consultor_asignado = coalesce(p_consultor_id, id_consultor_asignado),
        status = 'Agendado'
      where id = v_lead_id;

      lead_id := v_lead_id;
      matched_by := 'phone';
      return next;
      return;
    end if;
  end if;

  -- 5) New booking lead
  insert into public.leads (
    full_name, email, phone, city, solution,
    id_num, nit,
    booking_email, booking_customer_id, phone_normalized,
    id_consultor_asignado, status, source
  )
  values (
    trim(p_full_name),
    v_email,
    nullif(trim(p_phone), ''),
    nullif(trim(p_city), ''),
    nullif(trim(p_solution), ''),
    v_id_num,
    v_nit,
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

-- ---------------------------------------------------------------------------
-- 3) Retroactive dedup: merge leads that share phone_normalized
--    Safety: skip when first names differ (avoid merging unrelated people
--    who happen to share a phone — rare, but possible).
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_primary uuid;
  v_dup uuid;
  v_primary_first text;
  v_dup_first text;
begin
  for r in
    select array_agg(id order by
      case
        when booking_customer_id is not null then 0
        when booking_email is not null      then 1
        else 2
      end,
      created_at asc
    ) as ids
    from public.leads
    where phone_normalized is not null and trim(phone_normalized) <> ''
    group by phone_normalized
    having count(*) > 1
  loop
    v_primary := r.ids[1];

    for i in 2..array_length(r.ids, 1) loop
      v_dup := r.ids[i];

      -- Pull first names (lowercased) for safety check
      select lower(split_part(coalesce(full_name, ''), ' ', 1))
        into v_primary_first
      from public.leads where id = v_primary;

      select lower(split_part(coalesce(full_name, ''), ' ', 1))
        into v_dup_first
      from public.leads where id = v_dup;

      -- If both have a first name and they differ, skip — likely different people
      if v_primary_first <> '' and v_dup_first <> '' and v_primary_first <> v_dup_first then
        raise notice 'Skip phone-dedup % into %: first names differ (% vs %)',
          v_dup, v_primary, v_dup_first, v_primary_first;
        continue;
      end if;

      -- Enrich primary with non-null fields from duplicate
      update public.leads p
      set
        full_name             = coalesce(nullif(trim(p.full_name), ''), d.full_name),
        id_num                = coalesce(p.id_num,                      d.id_num),
        nit                   = coalesce(p.nit,                         d.nit),
        phone                 = coalesce(p.phone,                       d.phone),
        city                  = coalesce(p.city,                        d.city),
        company_role_level    = coalesce(p.company_role_level,          d.company_role_level),
        company_role_area     = coalesce(p.company_role_area,           d.company_role_area),
        solution              = coalesce(p.solution,                    d.solution),
        use_case              = coalesce(p.use_case,                    d.use_case),
        comments              = coalesce(p.comments,                    d.comments),
        perfil_personal       = coalesce(p.perfil_personal,             d.perfil_personal),
        perfil_empresa        = coalesce(p.perfil_empresa,              d.perfil_empresa),
        autorizo_datos        = coalesce(p.autorizo_datos,              d.autorizo_datos),
        booking_email         = coalesce(p.booking_email,               d.booking_email),
        booking_customer_id   = coalesce(p.booking_customer_id,         d.booking_customer_id),
        id_consultor_asignado = coalesce(p.id_consultor_asignado,       d.id_consultor_asignado),
        notas_consultor       = coalesce(p.notas_consultor,             d.notas_consultor),
        status = case
          when d.status in ('Resuelto', 'En seguimiento', 'Agendado') and p.status = 'Pendiente' then d.status
          else p.status
        end
      from public.leads d
      where p.id = v_primary and d.id = v_dup;

      -- Reassign sesiones to primary
      update public.sesiones set id_lead = v_primary where id_lead = v_dup;

      -- Drop the duplicate
      delete from public.leads where id = v_dup;

      raise notice 'Dedup: merged % into % by shared phone_normalized', v_dup, v_primary;
    end loop;
  end loop;
end$$;

commit;
