-- Inserta consultores (emails nuevos) para que /api/booking pueda asignar consultor por `staff_email`.
-- Ajusta `rol` si alguno debe ser `admin`.
--
-- Nota: el acceso al dashboard depende de `consultores.auth_id` (UUID de Supabase Auth).
-- Después de que cada persona inicie sesión por primera vez, copia su `user.id` (Auth → Users)
-- y actualiza `auth_id` en esta tabla.

insert into consultores (nombre, email, rol)
values
  ('Carlos Ortiz', 'carlos.ortiz@bblabs.io', 'consultor'),
  ('Adrian Gutierrez', 'adrian.gutierrez@bblabs.io', 'consultor'),
  ('Santiago Comas', 'santiago.comas@bblabs.io', 'consultor'),
  ('Fabian Beleno', 'fabian.beleno@bblabs.io', 'consultor');

-- Ejemplo para volver a un usuario admin (elige el correo correcto):
-- update consultores set rol = 'admin' where email = 'fabian.beleno@bblabs.io';

