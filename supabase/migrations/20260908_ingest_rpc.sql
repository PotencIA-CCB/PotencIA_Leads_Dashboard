-- PotencIA Leads Dashboard
-- RPC de ingesta por lote para el módulo /dashboard/cargas.
--
-- Un solo RPC por carga, no una llamada por fila: el patrón de n8n hace ~5
-- requests HTTP por fila (~700 para un archivo de 142) y supera el techo de
-- subrequests de un Cloudflare Worker.
--
-- Savepoint por fila vía `begin ... exception`: una fila que falla no aborta el
-- lote, y las escrituras de una fila son atómicas entre las tres tablas.
--
-- p_dry_run recorre el mismo camino de código y luego revierte las escrituras
-- de cada fila lanzando ZZ001, que su propio manejador atrapa. Las variables
-- plpgsql ya calculadas sobreviven a la excepción, así que devuelve la acción
-- que se habría aplicado. Eso hace que la previsualización sea exacta.

begin;

-- ============================================================================
-- ingest_bookings — .tsv de Microsoft Bookings → leads + consultorias
-- ============================================================================

create or replace function public.ingest_bookings(
  p_filas jsonb,
  p_dry_run boolean default false
)
returns table (fila int, accion text, aviso text, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r          jsonb;
  v_lead_j   jsonb;
  v_con_j    jsonb;
  v_fila     int;
  v_lead     uuid;
  v_consultor uuid;
  v_con      uuid;
  v_accion   text;
  v_aviso    text;
  v_booking  text;
begin
  for r in select value from jsonb_array_elements(p_filas) as t(value)
  loop
    v_fila := (r->>'fila')::int;
    v_accion := null;
    v_aviso := null;

    begin
      v_lead_j := r->'lead';
      v_con_j  := r->'consultoria';
      v_booking := nullif(v_con_j->>'booking_id', '');

      -- 1) Lead: dedup cross-canal por booking_customer_id → id_num → email → teléfono
      select ml.lead_id into v_lead
      from public.match_or_create_lead(
        p_email               := v_lead_j->>'p_email',
        p_nombre_completo     := v_lead_j->>'p_nombre_completo',
        p_phone               := v_lead_j->>'p_phone',
        p_id_num              := v_lead_j->>'p_id_num',
        p_nit                 := v_lead_j->>'p_nit',
        p_city                := v_lead_j->>'p_city',
        p_cargo               := v_lead_j->>'p_cargo',
        p_company_role_level  := v_lead_j->>'p_company_role_level',
        p_company_role_area   := v_lead_j->>'p_company_role_area',
        p_sector              := v_lead_j->>'p_sector',
        p_empresa             := v_lead_j->>'p_empresa',
        p_sexo                := v_lead_j->>'p_sexo',
        p_booking_email       := v_lead_j->>'p_booking_email',
        p_booking_customer_id := v_lead_j->>'p_booking_customer_id',
        p_origen              := 'booking'
      ) ml;

      -- 2) Consultor: email institucional → email alternativo → nombre
      v_consultor := null;

      if nullif(v_con_j->>'staff_email', '') is not null then
        select c.id into v_consultor
        from public.consultores c
        where lower(c.email_institucional) = lower(v_con_j->>'staff_email')
           or lower(coalesce(c.email, '')) = lower(v_con_j->>'staff_email')
        limit 1;
      end if;

      if v_consultor is null and nullif(v_con_j->>'staff_name', '') is not null then
        select c.id into v_consultor
        from public.consultores c
        where lower(c.nombre) = lower(v_con_j->>'staff_name')
        limit 1;
      end if;

      if v_consultor is null then
        v_aviso := 'El staff de la reserva no corresponde a ningún consultor: id_consultor queda sin asignar';
      end if;

      -- 3) Localizar la consultoría: booking_id, luego lead + fecha + hora
      v_con := null;

      if v_booking is not null then
        select c.id into v_con
        from public.consultorias c
        where c.booking_id = v_booking
        order by c.created_at
        limit 1;
      end if;

      if v_con is null then
        select c.id into v_con
        from public.consultorias c
        where c.id_lead = v_lead
          and c.fecha = (v_con_j->>'fecha')::date
          and c.hora_inicio is not distinct from (nullif(v_con_j->>'hora_inicio', ''))::time
        order by c.created_at
        limit 1;
      end if;

      -- 4) Upsert. El archivo manda: se actualizan los campos que trae.
      if v_con is null then
        insert into public.consultorias (
          id_lead, id_consultor, booking_id,
          fecha, hora_inicio, hora_fin, duracion_minutos, modalidad,
          servicio, staff_name, staff_email, categoria_caso_uso, status
        ) values (
          v_lead, v_consultor, v_booking,
          (v_con_j->>'fecha')::date,
          (nullif(v_con_j->>'hora_inicio', ''))::time,
          (nullif(v_con_j->>'hora_fin', ''))::time,
          (nullif(v_con_j->>'duracion_minutos', ''))::int,
          v_con_j->>'modalidad',
          nullif(v_con_j->>'servicio', ''),
          nullif(v_con_j->>'staff_name', ''),
          nullif(v_con_j->>'staff_email', ''),
          nullif(v_con_j->>'categoria_caso_uso', ''),
          coalesce(nullif(v_con_j->>'status', ''), 'Agendado')
        )
        returning id into v_con;

        v_accion := 'creada';
      else
        update public.consultorias set
          booking_id       = coalesce(v_booking, booking_id),
          -- id_consultor solo se llena si está vacío: respeta el lock de la
          -- migración f5, que lo declara inmutable salvo para el rol de servicio
          id_consultor     = coalesce(id_consultor, v_consultor),
          hora_inicio      = coalesce((nullif(v_con_j->>'hora_inicio', ''))::time, hora_inicio),
          hora_fin         = coalesce((nullif(v_con_j->>'hora_fin', ''))::time, hora_fin),
          duracion_minutos = coalesce((nullif(v_con_j->>'duracion_minutos', ''))::int, duracion_minutos),
          modalidad        = v_con_j->>'modalidad',
          servicio         = coalesce(nullif(v_con_j->>'servicio', ''), servicio),
          staff_name       = coalesce(nullif(v_con_j->>'staff_name', ''), staff_name),
          staff_email      = coalesce(nullif(v_con_j->>'staff_email', ''), staff_email),
          -- categoria_caso_uso solo si está vacía, igual que hace /api/booking
          categoria_caso_uso = coalesce(categoria_caso_uso, nullif(v_con_j->>'categoria_caso_uso', '')),
          updated_at       = now()
        where id = v_con;

        v_accion := 'actualizada';
      end if;

      if p_dry_run then
        raise exception 'dry run' using errcode = 'ZZ001';
      end if;

      fila := v_fila; accion := v_accion; aviso := v_aviso; error := null;
      return next;

    exception
      when sqlstate 'ZZ001' then
        -- Las escrituras de esta fila quedaron revertidas por el savepoint,
        -- pero v_accion y v_aviso sobreviven a la excepción.
        fila := v_fila; accion := v_accion; aviso := v_aviso; error := null;
        return next;
      when others then
        fila := v_fila; accion := null; aviso := v_aviso; error := SQLERRM;
        return next;
    end;
  end loop;
end;
$$;

-- ============================================================================
-- ingest_sesiones — .xlsx de registro de sesión → leads + consultorias + registro_sesion
-- ============================================================================

create or replace function public.ingest_sesiones(
  p_filas jsonb,
  p_dry_run boolean default false
)
returns table (fila int, accion text, aviso text, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r           jsonb;
  v_lead_j    jsonb;
  v_con_j     jsonb;
  v_reg_j     jsonb;
  v_fila      int;
  v_lead      uuid;
  v_consultor uuid;
  v_con       uuid;
  v_accion    text;
  v_aviso     text;
  v_status    text;
  v_id_ext    text;
begin
  for r in select value from jsonb_array_elements(p_filas) as t(value)
  loop
    v_fila := (r->>'fila')::int;
    v_accion := null;
    v_aviso := null;

    begin
      v_lead_j := r->'lead';
      v_con_j  := r->'consultoria';
      v_reg_j  := r->'registro';
      v_id_ext := nullif(v_reg_j->>'id_externo', '');
      v_status := nullif(v_con_j->>'status', '');

      -- 1) Lead
      select ml.lead_id into v_lead
      from public.match_or_create_lead(
        p_email               := v_lead_j->>'p_email',
        p_nombre_completo     := v_lead_j->>'p_nombre_completo',
        p_phone               := v_lead_j->>'p_phone',
        p_id_num              := v_lead_j->>'p_id_num',
        p_nit                 := v_lead_j->>'p_nit',
        p_city                := v_lead_j->>'p_city',
        p_cargo               := v_lead_j->>'p_cargo',
        p_company_role_level  := v_lead_j->>'p_company_role_level',
        p_company_role_area   := v_lead_j->>'p_company_role_area',
        p_sector              := v_lead_j->>'p_sector',
        p_empresa             := v_lead_j->>'p_empresa',
        p_sexo                := v_lead_j->>'p_sexo',
        p_booking_email       := null,
        p_booking_customer_id := null,
        p_origen              := 'sesion'
      ) ml;

      -- 2) Consultor
      v_consultor := null;

      if nullif(v_con_j->>'staff_email', '') is not null then
        select c.id into v_consultor
        from public.consultores c
        where lower(c.email_institucional) = lower(v_con_j->>'staff_email')
           or lower(coalesce(c.email, '')) = lower(v_con_j->>'staff_email')
        limit 1;
      end if;

      if v_consultor is null and nullif(v_con_j->>'staff_name', '') is not null then
        select c.id into v_consultor
        from public.consultores c
        where lower(c.nombre) = lower(v_con_j->>'staff_name')
        limit 1;
      end if;

      if v_consultor is null then
        v_aviso := 'El consultor de la sesión no corresponde a ningún registro en consultores: id_consultor queda sin asignar';
      end if;

      -- 3) Localizar la consultoría: id_externo del registro, luego lead + fecha EXACTA
      v_con := null;

      if v_id_ext is not null then
        select rs.id_consultoria into v_con
        from public.registro_sesion rs
        where rs.id_externo = v_id_ext
        limit 1;
      end if;

      if v_con is null then
        select c.id into v_con
        from public.consultorias c
        where c.id_lead = v_lead
          and c.fecha = (v_con_j->>'fecha')::date
        order by c.created_at
        limit 1;
      end if;

      -- 4) Upsert de la consultoría
      if v_con is null then
        insert into public.consultorias (
          id_lead, id_consultor,
          fecha, hora_inicio, hora_fin, duracion_minutos, modalidad,
          staff_name, staff_email,
          nivel_potencia, categoria_caso, categoria_caso_uso, status
        ) values (
          v_lead, v_consultor,
          (v_con_j->>'fecha')::date,
          (nullif(v_con_j->>'hora_inicio', ''))::time,
          (nullif(v_con_j->>'hora_fin', ''))::time,
          (nullif(v_con_j->>'duracion_minutos', ''))::int,
          v_con_j->>'modalidad',
          nullif(v_con_j->>'staff_name', ''),
          nullif(v_con_j->>'staff_email', ''),
          nullif(v_con_j->>'nivel_potencia', ''),
          nullif(v_con_j->>'categoria_caso', ''),
          nullif(v_con_j->>'categoria_caso_uso', ''),
          coalesce(v_status, 'Agendado')
        )
        returning id into v_con;

        v_accion := 'creada';
      else
        update public.consultorias set
          id_consultor     = coalesce(id_consultor, v_consultor),
          hora_inicio      = coalesce((nullif(v_con_j->>'hora_inicio', ''))::time, hora_inicio),
          hora_fin         = coalesce((nullif(v_con_j->>'hora_fin', ''))::time, hora_fin),
          duracion_minutos = coalesce((nullif(v_con_j->>'duracion_minutos', ''))::int, duracion_minutos),
          modalidad        = v_con_j->>'modalidad',
          staff_name       = coalesce(nullif(v_con_j->>'staff_name', ''), staff_name),
          staff_email      = coalesce(nullif(v_con_j->>'staff_email', ''), staff_email),
          nivel_potencia   = coalesce(nullif(v_con_j->>'nivel_potencia', ''), nivel_potencia),
          categoria_caso   = coalesce(nullif(v_con_j->>'categoria_caso', ''), categoria_caso),
          categoria_caso_uso = coalesce(nullif(v_con_j->>'categoria_caso_uso', ''), categoria_caso_uso),
          -- status null = resultado de sesión vacío: no se modifica (R31b)
          status           = coalesce(v_status, status),
          updated_at       = now()
        where id = v_con;

        v_accion := 'actualizada';
      end if;

      -- 5) Upsert del registro de sesión (1:1 por el unique de id_consultoria)
      insert into public.registro_sesion (
        id_consultoria, id_lead, id_externo,
        pregunta, motivo_consulta, estado_inicial, acciones_realizadas,
        resultado_final, estimacion_impacto, entregables, cantidad_productos,
        sesion_grabada, enlace_grabacion, adjuntar_evidencia,
        confirmo_no_automatizacion, resultado, duracion_sesion_minutos
      ) values (
        v_con, v_lead, v_id_ext,
        nullif(v_reg_j->>'pregunta', ''),
        nullif(v_reg_j->>'motivo_consulta', ''),
        nullif(v_reg_j->>'estado_inicial', ''),
        nullif(v_reg_j->>'acciones_realizadas', ''),
        nullif(v_reg_j->>'resultado_final', ''),
        nullif(v_reg_j->>'estimacion_impacto', ''),
        nullif(v_reg_j->>'entregables', ''),
        coalesce((nullif(v_reg_j->>'cantidad_productos', ''))::int, 0),
        coalesce((v_reg_j->>'sesion_grabada')::boolean, false),
        nullif(v_reg_j->>'enlace_grabacion', ''),
        nullif(v_reg_j->>'adjuntar_evidencia', ''),
        (nullif(v_reg_j->>'confirmo_no_automatizacion', ''))::boolean,
        nullif(v_reg_j->>'resultado', ''),
        (nullif(v_reg_j->>'duracion_sesion_minutos', ''))::int
      )
      on conflict (id_consultoria) do update set
        id_externo                 = coalesce(excluded.id_externo, registro_sesion.id_externo),
        pregunta                   = coalesce(excluded.pregunta, registro_sesion.pregunta),
        motivo_consulta            = coalesce(excluded.motivo_consulta, registro_sesion.motivo_consulta),
        estado_inicial             = coalesce(excluded.estado_inicial, registro_sesion.estado_inicial),
        acciones_realizadas        = coalesce(excluded.acciones_realizadas, registro_sesion.acciones_realizadas),
        resultado_final            = coalesce(excluded.resultado_final, registro_sesion.resultado_final),
        estimacion_impacto         = coalesce(excluded.estimacion_impacto, registro_sesion.estimacion_impacto),
        entregables                = coalesce(excluded.entregables, registro_sesion.entregables),
        cantidad_productos         = excluded.cantidad_productos,
        sesion_grabada             = excluded.sesion_grabada,
        enlace_grabacion           = coalesce(excluded.enlace_grabacion, registro_sesion.enlace_grabacion),
        adjuntar_evidencia         = coalesce(excluded.adjuntar_evidencia, registro_sesion.adjuntar_evidencia),
        confirmo_no_automatizacion = coalesce(excluded.confirmo_no_automatizacion, registro_sesion.confirmo_no_automatizacion),
        resultado                  = coalesce(excluded.resultado, registro_sesion.resultado),
        duracion_sesion_minutos    = coalesce(excluded.duracion_sesion_minutos, registro_sesion.duracion_sesion_minutos);

      if p_dry_run then
        raise exception 'dry run' using errcode = 'ZZ001';
      end if;

      fila := v_fila; accion := v_accion; aviso := v_aviso; error := null;
      return next;

    exception
      when sqlstate 'ZZ001' then
        fila := v_fila; accion := v_accion; aviso := v_aviso; error := null;
        return next;
      when others then
        fila := v_fila; accion := null; aviso := v_aviso; error := SQLERRM;
        return next;
    end;
  end loop;
end;
$$;

-- ============================================================================
-- Permisos: son security definer, así que NADIE salvo service_role los ejecuta
-- ============================================================================

revoke all on function public.ingest_bookings(jsonb, boolean) from public;
revoke all on function public.ingest_sesiones(jsonb, boolean) from public;

grant execute on function public.ingest_bookings(jsonb, boolean) to service_role;
grant execute on function public.ingest_sesiones(jsonb, boolean) to service_role;

commit;
