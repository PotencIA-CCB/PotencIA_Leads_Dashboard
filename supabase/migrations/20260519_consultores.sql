-- PotencIA Leads Dashboard
-- Migration 2: consultores — equipo interno con auth gate

begin;

create table public.consultores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  nombre text not null,
  identificacion text,
  email text,
  email_institucional text not null unique,

  rol text not null default 'consultor'
    check (rol in ('admin', 'consultor')),
  auth_id uuid unique,
  activo boolean not null default true
);

-- Índices
create index consultores_email_inst_idx on consultores (lower(email_institucional));
create index consultores_email_idx on consultores (lower(email));
create index consultores_auth_id_idx on consultores (auth_id);
create index consultores_identificacion_idx on consultores (identificacion);

-- RLS
alter table public.consultores enable row level security;

create policy "consultores_select_auth"
  on public.consultores for select
  to authenticated
  using (true);

commit;
