-- PotencIA Leads Dashboard
-- Migration 5: consultorias — sesiones de consultoría (agenda + status)
--
-- Datos de agenda vienen de Microsoft Bookings.
-- Status se actualiza desde el registro de sesión.
-- Columnas slim: lo que necesita la card del dashboard.

begin;

create table public.consultorias (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Relaciones
  id_lead uuid not null references public.leads(id) on delete cascade,
  id_consultor uuid references public.consultores(id) on delete set null,

  -- Identificación externa
  id_reserva text,

  -- Agenda
  fecha date not null,
  hora_inicio time,
  hora_fin time,
  duracion_minutos int,
  modalidad text check (modalidad in ('Virtual', 'Presencial')),

  -- Servicio (de Bookings)
  servicio text,
  ubicacion text,
  staff_name text,
  staff_email text,

  -- Clasificación
  nivel_potencia text,
  categoria_caso text,
  categoria_caso_uso text,

  -- Estado
  status text not null default 'Agendado'
    check (status in ('Pendiente', 'Agendado', 'En seguimiento', 'Resuelto', 'Cancelado'))
);

-- Índices
create index consultorias_lead_idx on consultorias (id_lead);
create index consultorias_consultor_idx on consultorias (id_consultor);
create index consultorias_fecha_idx on consultorias (fecha desc);
create index consultorias_status_idx on consultorias (status);
create index consultorias_id_reserva_idx on consultorias (id_reserva);

-- RLS
alter table public.consultorias enable row level security;

create policy "consultorias_select_auth"
  on public.consultorias for select
  to authenticated
  using (true);

create policy "consultorias_insert_auth"
  on public.consultorias for insert
  to authenticated
  with check (true);

create policy "consultorias_update_auth"
  on public.consultorias for update
  to authenticated
  using (true);

commit;
