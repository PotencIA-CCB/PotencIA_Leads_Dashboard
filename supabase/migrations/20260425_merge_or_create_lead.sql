-- PotencIA Leads Dashboard
-- Migration: merge_or_create_lead RPC + supporting columns
--
-- Apply this file in Supabase SQL editor (or via supabase migrations).
-- Notes:
-- - Keeps `leads.email` as the canonical email used by the booking.
-- - Stores extra identity signals in `booking_email`, `booking_customer_id`, and `phone_normalized`.
-- - Uses a conservative phone-window heuristic only when no email/customer_id match exists.

begin;

alter table public.leads
  add column if not exists booking_email text,
  add column if not exists booking_customer_id text,
  add column if not exists phone_normalized text;

create index if not exists leads_booking_email_idx
  on public.leads (lower(booking_email));

create index if not exists leads_booking_customer_id_idx
  on public.leads (booking_customer_id);

create index if not exists leads_phone_normalized_idx
  on public.leads (phone_normalized);

create or replace function public._normalize_phone(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p, ''), '[^0-9]+', '', 'g'), '')
$$;

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

  -- 1) Prefer a stable booking customer id if available.
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
      where id = v_lead_id;

      lead_id := v_lead_id;
      matched_by := 'booking_customer_id';
      return next;
      return;
    end if;
  end if;

  -- 2) Match by booking email against booking_email and email.
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
    where id = v_lead_id;

    lead_id := v_lead_id;
    matched_by := 'email';
    return next;
    return;
  end if;

  -- 3) Conservative phone-window match (only if we have a phone).
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
      where id = v_lead_id;

      lead_id := v_lead_id;
      matched_by := 'phone_window';
      return next;
      return;
    end if;
  end if;

  -- 4) Create a new lead.
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
    status
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
    'Agendado'
  )
  returning id into v_lead_id;

  lead_id := v_lead_id;
  matched_by := 'created';
  return next;
end;
$$;

commit;

