-- PotencIA Leads Dashboard
-- Migration 1: leads — entidad central unificada
--
-- Una fila = una persona que interactúa con PotencIA.
-- Agrupa identidad, perfil profesional y señales de matching cross-canal.

begin;

create extension if not exists pgcrypto;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Identidad
  full_name text not null,
  id_num text,
  nit text,
  email text not null,
  phone text,
  phone_normalized text,
  city text,

  -- Perfil profesional
  cargo text,
  company_role_level text,
  company_role_area text,
  sector text,
  empresa text,
  sexo text,

  -- Señales de matching cross-canal (Microsoft Bookings)
  booking_email text,
  booking_customer_id text,

  -- Trazabilidad
  origen text not null default 'landing'
    check (origen in ('landing', 'booking', 'sesion', 'ambos'))
);

-- Índices
create index leads_email_idx on leads (lower(email));
create index leads_id_num_idx on leads (id_num);
create index leads_phone_norm_idx on leads (phone_normalized);
create index leads_booking_email_idx on leads (lower(booking_email));
create index leads_booking_customer_id_idx on leads (booking_customer_id);
create index leads_origen_idx on leads (origen);
create index leads_created_at_idx on leads (created_at desc);

-- Helper: normalizar teléfono a solo dígitos
create or replace function public._normalize_phone(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p, ''), '[^0-9]+', '', 'g'), '')
$$;

-- RLS
alter table public.leads enable row level security;

create policy "leads_select_auth"
  on public.leads for select
  to authenticated
  using (true);

create policy "leads_insert_anon"
  on public.leads for insert
  to anon
  with check (true);

create policy "leads_insert_auth"
  on public.leads for insert
  to authenticated
  with check (true);

create policy "leads_update_auth"
  on public.leads for update
  to authenticated
  using (true);

commit;
