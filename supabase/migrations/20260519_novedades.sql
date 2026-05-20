-- PotencIA Leads Dashboard
-- Migration 7: novedades — publicaciones de consultores
--
-- Consultores crean y editan sus novedades.
-- Admin puede crear, editar y borrar cualquier novedad.
-- Vinculables a un lead y/o consultoría.

begin;

create table public.novedades (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  id_consultor uuid not null references public.consultores(id) on delete cascade,
  id_lead uuid references public.leads(id) on delete set null,
  id_consultoria uuid references public.consultorias(id) on delete set null,

  titulo text not null,
  contenido text not null,
  tipo text not null check (tipo in (
    'caso_de_uso', 'mejora', 'incidencia', 'logro', 'sugerencia', 'otro'
  )),

  indicadores jsonb default '{}'::jsonb
);

-- Índices
create index novedades_consultor_idx on novedades (id_consultor);
create index novedades_lead_idx on novedades (id_lead);
create index novedades_consultoria_idx on novedades (id_consultoria);
create index novedades_tipo_idx on novedades (tipo);
create index novedades_created_at_idx on novedades (created_at desc);

-- RLS
alter table public.novedades enable row level security;

create policy "novedades_select_auth"
  on public.novedades for select
  to authenticated
  using (true);

create policy "novedades_insert_own"
  on public.novedades for insert
  to authenticated
  with check (
    id_consultor in (select id from public.consultores where auth_id = auth.uid())
  );

create policy "novedades_update_own"
  on public.novedades for update
  to authenticated
  using (
    id_consultor in (select id from public.consultores where auth_id = auth.uid())
    or exists (select 1 from public.consultores where auth_id = auth.uid() and rol = 'admin')
  );

create policy "novedades_delete_admin"
  on public.novedades for delete
  to authenticated
  using (
    exists (select 1 from public.consultores where auth_id = auth.uid() and rol = 'admin')
  );

commit;
