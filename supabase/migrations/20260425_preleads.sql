-- PotencIA Leads Dashboard
-- Migration: preleads table (landing submissions)
--
-- Goal: store landing form submissions WITHOUT creating dashboard cards.
-- The dashboard cards (table `leads`) are created/updated only from Microsoft Bookings via /api/booking.

begin;

create extension if not exists pgcrypto;

create table if not exists public.preleads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  id_num text not null,
  nit text null,
  email text not null,
  phone text null,
  city text null,
  company_role_level text null,
  company_role_area text null,
  solution text null,
  use_case text null,
  comments text null,
  perfil_personal boolean null,
  perfil_empresa boolean null,
  autorizo_datos boolean null,
  user_agent text null
);

create index if not exists preleads_created_at_idx on public.preleads (created_at desc);
create index if not exists preleads_email_idx on public.preleads (lower(email));
create index if not exists preleads_id_num_idx on public.preleads (id_num);

alter table public.preleads enable row level security;

-- Landing uses publishable/anon key. Allow anonymous inserts only.
drop policy if exists "preleads_anon_insert" on public.preleads;
create policy "preleads_anon_insert"
  on public.preleads
  for insert
  to anon
  with check (true);

commit;

