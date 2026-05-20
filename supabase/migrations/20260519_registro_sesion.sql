-- PotencIA Leads Dashboard
-- Migration 6: registro_sesion — diagnóstico y resultados post-consulta
--
-- Datos vienen del Excel de registro de sesión (asistieron).
-- Relación 1:1 con consultorias.
-- Columnas de texto grande: solo se cargan al abrir el modal de detalle.

begin;

create table public.registro_sesion (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Relaciones
  id_consultoria uuid not null unique references public.consultorias(id) on delete cascade,
  id_lead uuid not null references public.leads(id) on delete cascade,

  -- Identificación externa (del Excel de sesión)
  id_externo text,

  -- Diagnóstico
  pregunta text,
  motivo_consulta text,
  estado_inicial text,

  -- Intervención
  acciones_realizadas text,
  metodologia_aplicada text,

  -- Resultados
  resultado_final text,
  estimacion_impacto text,
  entregables text,
  cantidad_productos int default 0,

  -- Metadata
  sesion_grabada boolean default false,
  enlace_grabacion text,
  adjuntar_evidencia text,
  confirmo_no_automatizacion boolean,

  -- Resultado original del Excel (texto libre)
  resultado text
);

-- Índices
create index registro_sesion_consultoria_idx on registro_sesion (id_consultoria);
create index registro_sesion_lead_idx on registro_sesion (id_lead);
create index registro_sesion_id_externo_idx on registro_sesion (id_externo);

-- RLS
alter table public.registro_sesion enable row level security;

create policy "registro_sesion_select_auth"
  on public.registro_sesion for select
  to authenticated
  using (true);

create policy "registro_sesion_insert_auth"
  on public.registro_sesion for insert
  to authenticated
  with check (true);

create policy "registro_sesion_update_auth"
  on public.registro_sesion for update
  to authenticated
  using (true);

commit;
