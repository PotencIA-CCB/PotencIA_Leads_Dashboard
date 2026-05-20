-- PotencIA Leads Dashboard
-- Migration 3: formularios_landing — registros del Form PotencIA
--
-- Una persona puede tener uno o más formularios.
-- Separado de leads porque los datos declarativos son del canal landing.

begin;

create table public.formularios_landing (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  id_lead uuid not null references public.leads(id) on delete cascade,

  -- Necesidad declarada
  tema text,
  descripcion text,
  perfil text,

  -- Consentimiento
  tratamiento_datos boolean,
  aceptacion boolean,

  -- UTM / marketing
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,

  -- Fecha del registro original
  fecha_registro timestamptz
);

-- Índices
create index formularios_lead_idx on formularios_landing (id_lead);
create index formularios_created_at_idx on formularios_landing (created_at desc);

-- RLS
alter table public.formularios_landing enable row level security;

create policy "formularios_select_auth"
  on public.formularios_landing for select
  to authenticated
  using (true);

create policy "formularios_insert_anon"
  on public.formularios_landing for insert
  to anon
  with check (true);

create policy "formularios_insert_auth"
  on public.formularios_landing for insert
  to authenticated
  with check (true);

commit;
