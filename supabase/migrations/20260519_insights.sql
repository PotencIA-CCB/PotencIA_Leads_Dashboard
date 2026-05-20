-- PotencIA Leads Dashboard
-- Migration 8: insights — análisis generados por IA (DeepSeek)

begin;

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contenido jsonb not null,
  contexto_kpis jsonb,
  generado_por text default 'DeepSeek',
  id_consultor uuid references public.consultores(id) on delete set null
);

-- Índice
create index insights_created_at_idx on insights (created_at desc);

-- RLS
alter table public.insights enable row level security;

create policy "insights_select_auth"
  on public.insights for select
  to authenticated
  using (true);

commit;
