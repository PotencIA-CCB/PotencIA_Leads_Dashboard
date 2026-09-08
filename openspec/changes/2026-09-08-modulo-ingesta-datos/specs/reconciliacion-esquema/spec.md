# Reconciliación de esquema

## Purpose

Dejar el esquema en un estado conocido y documentado, resolviendo los tres drifts que la ingesta
por n8n dejó pasar sin detección (`exploration.md` §2). La migración debe correr correctamente
sin saber de antemano qué columnas tiene la base viva.

## Requirements

### Migración

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | La migración MUST ser idempotente: correrla dos veces MUST NOT producir error ni cambiar el resultado | MUST |
| R2 | La migración MUST NOT ejecutar `drop column` sobre ninguna tabla | MUST |
| R3 | Toda referencia a una columna cuya existencia no está garantizada por migraciones previas MUST hacerse dentro de un bloque `DO` que consulte `information_schema.columns` primero | MUST |

#### D-1 · Identidad de la consultoría

| # | Requirement | Strength |
|---|-------------|----------|
| R4 | `consultorias.booking_id` SHALL ser la única columna que almacena el Booking Id de Microsoft Bookings, y MUST quedar formalizada en migraciones con `add column if not exists booking_id text` | SHALL |
| R5 | La migración MUST hacer backfill `booking_id = coalesce(booking_id, id_reserva)` donde `id_reserva` no sea nulo, dentro de un bloque `DO` que verifique primero que `id_reserva` existe | MUST |
| R6 | `consultorias.id_reserva` e `consultorias.id_externo`, si existen, MUST conservarse en la base; su limpieza queda para un cambio posterior | MUST |
| R7 | La migración MUST NOT crear un índice único sobre `consultorias.booking_id` | MUST |
| R7b | La migración SHALL crear `create index if not exists consultorias_booking_id_idx on consultorias (booking_id)` para sostener el lookup de idempotencia | SHALL |
| R7c | El KPI de reservas únicas (`src/lib/metricas.ts:1077-1079`) MUST seguir devolviendo el mismo valor tras la migración, dado que sigue leyendo `booking_id` | MUST |

#### D-2 · Duración de la sesión

| # | Requirement | Strength |
|---|-------------|----------|
| R8 | `registro_sesion.duracion_sesion_minutos` MUST existir como `int` nullable tras la migración | MUST |
| R9 | La columna MUST crearse con `add column if not exists`, dado que la base viva probablemente ya la tiene | MUST |

#### D-3 · Estados de la consultoría

| # | Requirement | Strength |
|---|-------------|----------|
| R10 | El CHECK de `consultorias.status` MUST admitir exactamente estos 7 valores: `Pendiente`, `Agendado`, `En seguimiento`, `Resuelto`, `Cancelado`, `No asistió`, `Escalar` | MUST |
| R11 | El CHECK anterior MUST eliminarse antes de crear el nuevo. La migración `20260519_consultorias.sql:42` lo declara inline y sin nombre, así que Postgres lo nombró `consultorias_status_check`; la migración MUST localizarlo consultando `pg_constraint` (por `conrelid` y por mención de `status` en su definición) y eliminarlo dinámicamente, en vez de asumir ese nombre | MUST |
| R12 | El valor por defecto de `consultorias.status` SHALL seguir siendo `'Agendado'` | SHALL |

#### D-4 · Trigger que pisa el status

| # | Requirement | Strength |
|---|-------------|----------|
| R12b | `trg_registro_sesion_after_insert` MUST redefinirse con `create or replace function` para que **no** modifique `consultorias.status` | MUST |
| R12c | La función redefinida MUST NOT escribir en `consultorias.nivel_potencia` | MUST |
| R12d | La función redefinida SHALL conservar intacta la actualización de `leads.origen` a `'ambos'` cuando el lead venía de `'landing'` o `'booking'` | SHALL |
| R12e | Tras la redefinición, el `status` de una consultoría MUST quedar determinado únicamente por su escritor (el RPC del módulo, o el nodo `Update consultoria status` de WF-3) | MUST |

### Alineación de tipos

| # | Requirement | Strength |
|---|-------------|----------|
| R13 | `Consultoria` en `src/types/index.ts` MUST eliminar `id_externo`, conservar `booking_id`, y declarar `id_reserva` como opcional (columna vestigial) | MUST |
| R14 | `RegistroSesion` en `src/types/index.ts` MUST añadir `id_externo: string \| null` y `duracion_sesion_minutos: number \| null` | MUST |
| R15 | `ConsultoriaStatus` SHALL conservar los 7 valores que ya declara | SHALL |
| R16 | `npx tsc --noEmit` MUST pasar tras la alineación | MUST |

### Corrección de `/api/booking/route.ts`

| # | Requirement | Strength |
|---|-------------|----------|
| R17 | El `insert` en `consultorias` SHALL seguir escribiendo `booking_id`, que la exploración confirmó como la columna correcta | SHALL |
| R18 | `modalidad` MUST normalizarse a `'Virtual'` o `'Presencial'`; cualquier otro texto SHALL resolver a `'Virtual'` | MUST |
| R19 | Los tests existentes en `src/app/api/booking/__tests__/` MUST seguir pasando | MUST |

### Verificación global

| # | Requirement | Strength |
|---|-------------|----------|
| R20 | `npm test` MUST pasar sin regresiones sobre la suite existente | MUST |
| R21 | `npm run build` MUST completarse sin error | MUST |
| R22 | `src/lib/metricas.ts` MUST NOT modificarse en este cambio | MUST |

### Scenario: La base viva tiene booking_id pero no está en migraciones

- GIVEN `consultorias.booking_id` existe en producción (escrita por WF-2, WF-3 y `/api/booking`, leída por `useMetricas.ts:25`) pero ninguna migración la declara
- WHEN corre la migración
- THEN `add column if not exists booking_id text` la deja formalizada sin alterar los datos existentes
- AND el KPI de reservas únicas sigue devolviendo el mismo valor
- AND ninguna columna se elimina

### Scenario: Backfill desde id_reserva

- GIVEN algunas filas tienen `id_reserva` con valor y `booking_id` nula
- WHEN corre la migración
- THEN esas filas quedan con `booking_id` igual a su `id_reserva`
- AND `id_reserva` conserva sus valores

### Scenario: id_reserva no existe en la base

- GIVEN `consultorias` no tiene la columna `id_reserva`
- WHEN corre la migración
- THEN el bloque de backfill se omite sin error
- AND el resto de la migración se aplica normalmente

### Scenario: La columna de duración ya existe

- GIVEN `registro_sesion.duracion_sesion_minutos` ya existe en la base viva con datos escritos por WF-3
- WHEN corre la migración
- THEN la columna se conserva con sus datos intactos
- AND no se produce error

### Scenario: Escritura de un estado antes rechazado

- GIVEN el CHECK ampliado ya está aplicado
- WHEN se escribe `status = 'No asistió'` en una consultoría
- THEN la escritura tiene éxito
- AND el mismo `UPDATE` habría fallado antes de la migración

### Scenario: Migración corrida dos veces

- GIVEN la migración ya se aplicó una vez
- WHEN se aplica de nuevo
- THEN no se produce error
- AND el esquema queda idéntico al de la primera aplicación

### Scenario: El webhook y el módulo comparten identidad

- GIVEN la migración ya está aplicada
- WHEN llega un `POST` a `/api/booking` con `booking_id` en el cuerpo
- THEN la consultoría creada tiene ese valor en `booking_id`
- AND una carga posterior del `.tsv` con el mismo `Booking Id` **actualiza** esa consultoría en vez de duplicarla

### Scenario: El trigger ya no colapsa el estado

- GIVEN la migración ya está aplicada
- AND una fila de sesión cuyo `Resultado de la sesión` dice `El usuario no asistió`
- WHEN el RPC escribe `consultorias.status = 'No asistió'` y luego inserta el `registro_sesion`
- THEN el status final de la consultoría es `No asistió`
- AND `consultorias.nivel_potencia` no recibió el texto del resultado
- AND `leads.origen` sí pasó a `'ambos'` si el lead venía de `'landing'` o `'booking'`
