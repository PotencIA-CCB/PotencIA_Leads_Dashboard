-- PotencIA Leads Dashboard
-- Migration: herramientas_uso — cache table for AI/software tools extracted from registro_sesion
--
-- Each POST to /api/herramientas runs a full recompute (ADR-2) and writes a new batch
-- tagged by generated_at (ADR-3). GET reads the latest-run group ordered by count desc.
-- Writes go through SERVICE_ROLE_KEY (bypasses RLS), identical to insights pattern.

begin;

create table public.herramientas_uso (
  id            uuid        primary key default gen_random_uuid(),
  generated_at  timestamptz not null    default now(),
  label         text        not null,
  count         integer     not null    default 0 check (count >= 0),
  fuente        text        not null    default 'AI'
);

-- RLS: read for authenticated (mirrors insights_select_auth)
alter table public.herramientas_uso enable row level security;

create policy "herramientas_uso_select_auth"
  on public.herramientas_uso for select
  to authenticated
  using (true);

-- Indexes: latest-run lookup + ordering by frequency
create index herramientas_uso_generated_at_idx on public.herramientas_uso (generated_at desc);
create index herramientas_uso_count_idx        on public.herramientas_uso (count desc);

commit;
