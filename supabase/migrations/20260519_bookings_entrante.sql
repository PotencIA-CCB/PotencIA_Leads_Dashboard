-- PotencIA Leads Dashboard
-- Migration 4: bookings_entrante — staging para Microsoft Bookings .tsv
--
-- n8n inserta datos crudos del .tsv acá.
-- El trigger trg_bookings_after_insert procesa y mueve a leads + consultorias.

begin;

create table public.bookings_entrante (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  procesado boolean not null default false,

  -- Columnas crudas del .tsv de Microsoft Bookings
  booking_id text,
  fecha_hora timestamptz,
  nombre_cliente text,
  email_cliente text,
  telefono_cliente text,
  direccion_cliente text,
  nombre_personal text,
  email_personal text,
  servicio text,
  ubicacion text,
  duracion_minutos int,

  -- Trazabilidad post-procesamiento
  id_lead uuid references public.leads(id) on delete set null,
  id_consultoria uuid references public.consultorias(id) on delete set null
);

-- RLS: service_role o authenticated insertan
alter table public.bookings_entrante enable row level security;

create policy "bookings_insert_auth"
  on public.bookings_entrante for insert
  to authenticated
  with check (true);

commit;
