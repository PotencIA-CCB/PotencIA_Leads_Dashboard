-- PotencIA Leads Dashboard
-- Migration: insights_flat — replace jsonb schema with flat columns
--
-- The original 20260519_insights.sql used contenido jsonb / contexto_kpis jsonb.
-- The API and page already write and read flat columns. This migration aligns the DB.
-- Pre-flight guard: raises an exception if any rows exist before DROP.

begin;

do $$
begin
  if (select count(*) from public.insights) > 0 then
    raise exception 'insights-schema-repair aborted: table has % row(s). Drain or archive data before applying.', (select count(*) from public.insights);
  end if;
end $$;

drop table if exists public.insights cascade;

create table public.insights (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),
  tipo          text        not null    check (tipo in ('insight', 'recomendacion', 'alerta', 'kpi')),
  metrica       text        not null,
  valor_texto   text,
  descripcion   text,
  fuente        text        not null    default 'DeepSeek',
  periodo_inicio date       not null,
  periodo_fin    date       not null,
  id_consultor  uuid        references public.consultores(id) on delete set null
);

-- RLS
alter table public.insights enable row level security;

create policy "insights_select_auth"
  on public.insights for select
  to authenticated
  using (true);

-- Indexes
create index insights_created_at_idx on public.insights (created_at desc);
create index insights_tipo_idx       on public.insights (tipo);

commit;
