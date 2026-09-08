# Normalización de filas

## Purpose

Módulos puros en `src/lib/ingest/` que convierten una fila cruda de cada archivo en la estructura
que espera la base de datos, clasificando los problemas en **errores** (bloquean la fila) y
**avisos** (la fila entra y se reporta). Corren idénticos en navegador y Worker.

## Requirements

### Generales

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | Los módulos de `src/lib/ingest/` MUST NOT usar APIs del DOM, red, ni `Date` dependiente de zona horaria local | MUST |
| R2 | `normalizeBookingRow` y `normalizeSesionRow` SHALL devolver `{ ok: true, row, avisos }` o `{ ok: false, fila, errores }` | SHALL |
| R3 | Un **error** MUST impedir que la fila se escriba; un **aviso** MUST NOT impedirlo | MUST |
| R4 | Cada error y cada aviso SHALL incluir el número de fila (1-indexado respecto al archivo, contando el encabezado como fila 1) y un motivo legible en español | SHALL |
| R5 | Los motivos MUST NOT incluir datos personales de la fila | MUST |

### Coerción — `coerce.ts`

| # | Requirement | Strength |
|---|-------------|----------|
| R6 | `toDate` MUST aceptar `YYYY-MM-DD`, texto de fecha parseable, y serial numérico de Excel con base `1899-12-30`, devolviendo `YYYY-MM-DD` o `null` | MUST |
| R7 | `toTime` MUST aceptar `HH:MM` y fracción de día de Excel (`0.5` → `12:00`), devolviendo `HH:MM` o `null` | MUST |
| R8 | `toBool` SHALL devolver `true` para `si`, `sí`, `yes`, `true`, `1` (sin distinguir mayúsculas) y `false` en otro caso | SHALL |
| R9 | `addMinutes` MUST calcular la hora final con aritmética entera sobre minutos, sin construir objetos `Date` | MUST |
| R10 | `addMinutes` SHALL producir el mismo resultado bajo `TZ=UTC` y `TZ=America/Bogota` | SHALL |

### Encabezados — `columns.ts`

| # | Requirement | Strength |
|---|-------------|----------|
| R11 | `col(row, ...candidatos)` MUST encontrar la columna ignorando acentos, mayúsculas, espacios repetidos y espacios al final | MUST |
| R12 | `col` MUST unificar guiones tipográficos (`–`, `—`) con el guion simple antes de comparar | MUST |
| R13 | `col` SHALL hacer match por prefijo cuando el encabezado real trae un sufijo entre paréntesis o tras un guion | SHALL |
| R14 | `col` MUST ignorar valores vacíos: una columna presente pero vacía no cuenta como encontrada, y se sigue con el siguiente candidato | MUST |

### Bookings `.tsv` — `bookings.ts`

| # | Requirement | Strength |
|---|-------------|----------|
| R15 | `parseTsv` MUST separar por tabuladores, tratar la fila 0 como encabezados y descartar líneas vacías | MUST |
| R16 | Una fila sin `Customer Email` que contenga `@` MUST producir un error | MUST |
| R17 | `Date Time` MUST interpretarse como `DD/MM/YYYY H:MM` (día primero, export Colombia) | MUST |
| R18 | Un `Date Time` con mes > 12, día inválido, o que no coincida con el patrón MUST producir un error | MUST |
| R19 | `hora_fin` SHALL calcularse como `hora_inicio + Duration (mins.)` usando `addMinutes` | SHALL |
| R20 | `modalidad` MUST resolverse desde el JSON de `Custom Fields`, clave `Selecciona la Modalidad de tu sesión`: `/presencial/i` → `Presencial`, cualquier otro caso → `Virtual` | MUST |
| R21 | `modalidad` MUST ser siempre `'Virtual'` o `'Presencial'`, los únicos valores que admite el CHECK de `consultorias.modalidad` | MUST |
| R22 | Un `Custom Fields` ausente o con JSON inválido MUST resolver a `Virtual` sin producir error | MUST |
| R23 | El lead SHALL resolverse con `match_or_create_lead(p_origen := 'booking')`, pasando `Customer Email` como `p_email` y como `p_booking_email`, y `Booking Id` como `p_booking_customer_id` | SHALL |
| R24 | El consultor SHALL buscarse en `consultores` por `email_institucional`, luego `email`, luego `nombre` | SHALL |
| R25 | Si ningún consultor coincide, `id_consultor` MUST quedar nulo y la fila MUST producir un **aviso**, no un error | MUST |
| R26 | `categoria_caso_uso` SHALL escribirse desde `Service` solo si la consultoría existente la tiene vacía | SHALL |
| R27 | La clave natural SHALL ser la columna `Booking Id` del archivo, comparada contra `consultorias.booking_id`; si viene vacía, `id_lead + fecha + hora_inicio` | SHALL |

### Registro de sesión `.xlsx` — `sesiones.ts`

| # | Requirement | Strength |
|---|-------------|----------|
| R28 | Una fila sin correo del usuario atendido que contenga `@` MUST producir un error | MUST |
| R29 | Una fila cuya `Fecha de la Sesión` no sea parseable por `toDate` MUST producir un error | MUST |
| R30 | El lead SHALL resolverse con `match_or_create_lead(p_origen := 'sesion')`, pasando correo, nombre, celular, cédula, NIT, municipio, cargo, nivel del cargo, área, empresa y sexo | SHALL |
| R31 | `mapResultadoAStatus` MUST mapear `Resultado de la sesión` a uno de los 7 estados admitidos, con `Resuelto` como valor por defecto cuando **hay texto** que no coincide con ningún patrón | MUST |
| R31b | Si `Resultado de la sesión` viene vacío o ausente, `mapResultadoAStatus` MUST devolver `null` y el status de la consultoría MUST quedar sin modificar — conservando el que ya tenía, o el default `'Agendado'` si la consultoría es nueva. La fila NO produce error: el registro de sesión se escribe igual | MUST |
| R32 | El mapeo SHALL reconocer `cancelado` → `Cancelado`, `seguimiento` → `En seguimiento`, `no asisti` → `No asistió`, `escalar` → `Escalar`, `resuelto` → `Resuelto` | SHALL |
| R33 | La consultoría destino SHALL resolverse por `registro_sesion.id_externo` = columna `Id`; si no hay coincidencia, por `id_lead + fecha` **exacta**; si tampoco, se crea una consultoría nueva | SHALL |
| R34 | `id_externo` MUST escribirse únicamente en `registro_sesion`, nunca en `consultorias` | MUST |
| R35 | `duracion_sesion_minutos` SHALL escribirse en `registro_sesion` desde la columna de duración de la sesión | SHALL |
| R36 | La relación `registro_sesion` ↔ `consultorias` MUST seguir siendo 1:1, respetando el `unique` de `registro_sesion.id_consultoria` | MUST |

### Scenario: Fecha en formato colombiano con día mayor a 12

- GIVEN una fila de bookings con `Date Time` = `25/09/2026 14:30`
- WHEN se normaliza
- THEN `fecha` es `2026-09-25` y `hora_inicio` es `14:30`
- AND no se produce ningún error

### Scenario: Mes inválido

- GIVEN una fila de bookings con `Date Time` = `31/13/2026 10:00`
- WHEN se normaliza
- THEN la fila produce un error con motivo de fecha ilegible
- AND la fila no se incluye en el lote de escritura

### Scenario: Serial de Excel en la fecha de sesión

- GIVEN una fila de sesión cuya `Fecha de la Sesión` llega como el número `46000`
- WHEN se normaliza
- THEN `toDate` la convierte a la fecha calendario correspondiente contando desde `1899-12-30`

### Scenario: Fracción de día en la hora

- GIVEN una fila de sesión cuya `Hora de inicio` llega como `0.5`
- WHEN se normaliza
- THEN `toTime` devuelve `12:00`

### Scenario: Encabezado con acentos, espacios dobles y sufijo

- GIVEN un `.xlsx` cuyo encabezado real es `Acciones Realizadas Durante la Sesión (Describir paso a paso lo trabajado)` con un espacio final
- WHEN `col` busca `Acciones Realizadas Durante la Sesión`
- THEN encuentra la columna por match de prefijo
- AND el valor se asigna a `registro_sesion.acciones_realizadas`

### Scenario: Staff sin consultor correspondiente

- GIVEN una fila de bookings cuyo `Staff Email` no coincide con ningún `consultores.email_institucional`, `email` ni `nombre`
- WHEN se normaliza
- THEN la fila es válida y se escribe
- AND `consultorias.id_consultor` queda nulo
- AND la previsualización muestra un **aviso** indicando que ese staff no tiene consultor asignable

### Scenario: Sesión el día siguiente a lo agendado

- GIVEN un lead con una consultoría `Agendado` con `fecha` = `2026-09-14`
- AND una fila del Excel de sesión con `Fecha de la Sesión` = `2026-09-15` y sin columna `Id`
- WHEN se normaliza y se escribe
- THEN la consultoría del `2026-09-14` queda intacta con status `Agendado`
- AND se crea una consultoría nueva con `fecha` = `2026-09-15` y el status derivado del resultado

### Scenario: Independencia de zona horaria

- GIVEN una fila de bookings con `Date Time` = `10/09/2026 23:45` y `Duration (mins.)` = `30`
- WHEN se normaliza bajo `TZ=UTC` y bajo `TZ=America/Bogota`
- THEN `hora_fin` es `00:15` en ambos casos

### Scenario: Resultado de sesión vacío

- GIVEN un lead con una consultoría existente con status `Agendado`
- AND una fila del Excel de sesión que la referencia y cuyo `Resultado de la sesión` está vacío
- WHEN se normaliza y se escribe
- THEN el `registro_sesion` se escribe con sus demás campos
- AND el status de la consultoría sigue siendo `Agendado`
- AND la fila no produce error

### Scenario: Resultado "no asistió"

- GIVEN una fila de sesión con `Resultado de la sesión` = `El usuario no asistió a la sesión`
- WHEN se normaliza
- THEN el status resultante es `No asistió`
- AND la escritura no viola el CHECK de `consultorias.status`
