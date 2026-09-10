-- PotencIA Leads Dashboard
-- Relevo del puesto iaconsultor5: Santiago Comas -> Diego Felipe Arbelaez
--
-- Santiago Comas salio el 25-ago-2026 y Diego Felipe Arbelaez Medrano heredo
-- su correo institucional. La sesion del 09-sep aparecia a nombre de Santiago.
--
-- Causa raiz: `consultores.email_institucional` es not null unique
-- (20260519_consultores.sql:14) y el RPC de ingesta resuelve el consultor por
-- correo antes que por nombre (20260908_ingest_rpc.sql:258-271). El correo es
-- del puesto, no de la persona, asi que al cambiar de manos no habia forma de
-- representar el relevo: una sola fila, y seguia diciendo Santiago.
--
-- Este es el arreglo de datos (opcion A): mueve el puesto a Diego sin tocar
-- esquema ni RPC. La solucion durable es modelar el puesto con vigencia
-- (correo -> consultor con desde/hasta) y resolver por (staff_email, fecha),
-- pendiente para la proxima rotacion: hay 6 puestos iaconsultorN.
--
-- El historial de Santiago NO se reasigna: sus 146 consultorias hasta el
-- 05-ago conservan su id_consultor.
--
-- Idempotente: correrla dos veces no cambia el resultado. Ningun DROP.
--
-- Reversa:
--   update public.consultores set activo = true,
--          email_institucional = 'iaconsultor5@camarabaq.org.co'
--    where id = '8b1e22cd-b280-49cd-bbb4-5c9ffb1c9aec';  -- borrar antes la fila de Diego
--   update public.consultorias
--      set id_consultor = '8b1e22cd-b280-49cd-bbb4-5c9ffb1c9aec',
--          staff_name   = 'Santiago Andres Comas Duran'
--    where id in ('d894337b-3616-4096-bd41-6db518dad95d',
--                 '5e35002a-1e49-4917-b529-eac88dcda9cb',
--                 '7d23dfc3-de39-4a2e-aa5c-75e685ce1bfa',
--                 'cf5cb247-485e-411c-9108-d48417b1b9a3');

begin;

-- 1) Liberar el puesto. email_institucional es unique, asi que Santiago no
--    puede conservarlo. Su columna `email` personal es null, de modo que el
--    correo archivado se sintetiza con plus-addressing para dejar rastro de
--    que puesto ocupo. No coincide con el correo del puesto, asi que el RPC
--    ya no lo resuelve por ahi.
update public.consultores
   set email_institucional = 'iaconsultor5+santiago.comas@camarabaq.org.co',
       activo = false
 where id = '8b1e22cd-b280-49cd-bbb4-5c9ffb1c9aec'
   and lower(email_institucional) = 'iaconsultor5@camarabaq.org.co';

-- 2) Diego entra como persona propia y toma el puesto.
insert into public.consultores (nombre, email_institucional, rol, activo)
select 'Diego Felipe Arbelaez Medrano', 'iaconsultor5@camarabaq.org.co', 'consultor', true
 where not exists (
   select 1 from public.consultores
    where lower(email_institucional) = 'iaconsultor5@camarabaq.org.co'
 );

-- 3) Repuntar las 4 sesiones posteriores al relevo, por id explicito para que
--    el cambio sea exacto y auditable. Recargar el Excel no las corregiria:
--    ingest_rpc.sql:322 hace id_consultor = coalesce(id_consultor, nuevo), o
--    sea que solo asigna si esta vacio.
update public.consultorias
   set id_consultor = (select id from public.consultores
                        where lower(email_institucional) = 'iaconsultor5@camarabaq.org.co'),
       staff_name   = 'Diego Felipe Arbelaez Medrano',
       updated_at   = now()
 where id in (
   'd894337b-3616-4096-bd41-6db518dad95d',  -- 2026-09-07
   '5e35002a-1e49-4917-b529-eac88dcda9cb',  -- 2026-09-08
   '7d23dfc3-de39-4a2e-aa5c-75e685ce1bfa',  -- 2026-09-09
   'cf5cb247-485e-411c-9108-d48417b1b9a3'   -- 2026-09-14
 );

commit;
