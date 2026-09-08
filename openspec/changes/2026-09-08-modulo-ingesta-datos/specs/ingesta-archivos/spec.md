# Ingesta de archivos

## Purpose

Página `/dashboard/cargas` y ruta `/api/cargas` que permiten a un administrador cargar el `.tsv`
de Microsoft Bookings y el `.xlsx` de registro de sesión, con previsualización antes de escribir
y reporte de resultados después.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | `DashboardShell.navItems` SHALL incluir `{ label: 'Cargas', href: '/dashboard/cargas', adminOnly: true }` | SHALL |
| R2 | `/api/cargas` MUST resolver la sesión con el cliente de `src/lib/supabase-server.ts` y responder `403` si el consultor autenticado no tiene `rol === 'admin'` | MUST |
| R3 | `/api/cargas` MUST NOT construir el cliente con `SUPABASE_SERVICE_ROLE_KEY` antes de haber verificado R2 | MUST |
| R4 | `/api/cargas` SHALL aceptar `accion: 'preview'` y `accion: 'commit'`. Ambas reciben **las mismas filas crudas parseadas** y difieren únicamente en el valor de `p_dry_run` que pasan al RPC | SHALL |
| R5 | En ambas acciones, `/api/cargas` MUST normalizar las filas crudas él mismo con el módulo correspondiente y descartar las que no validen. El resultado de la normalización del cliente MUST NOT influir en lo que se escribe | MUST |
| R6 | El archivo binario MUST NOT subirse al servidor; solo viajan las filas crudas ya parseadas como JSON (pares encabezado→valor) | MUST |
| R7 | Cada acción SHALL ejecutarse en una sola invocación de `ingest_bookings(jsonb, boolean)` o `ingest_sesiones(jsonb, boolean)`, sin importar el número de filas | SHALL |
| R7b | Con `p_dry_run := true`, los RPC MUST recorrer el mismo camino de código que en la escritura real y luego revertir las escrituras de cada fila, devolviendo el `accion` que se habría aplicado | MUST |
| R7c | Con `p_dry_run := true`, los RPC MUST NOT dejar ninguna escritura en `leads`, `consultorias` ni `registro_sesion` | MUST |
| R8 | Cada RPC MUST procesar cada fila dentro de un bloque `begin ... exception when others then`, de modo que una fila fallida no aborte el lote | MUST |
| R9 | Cada fila MUST ser atómica: sus escrituras en `leads`, `consultorias` y `registro_sesion` se aplican todas o ninguna | MUST |
| R10 | Los RPC SHALL devolver un conjunto de filas `(fila int, accion text, aviso text, error text)` con `accion` en `'creada' \| 'actualizada'` | SHALL |
| R10b | Los RPC MUST poblar `aviso` con el motivo cuando la fila se escribe pero algo merece reportarse — en particular cuando el staff no corresponde a ningún consultor e `id_consultor` queda nulo | MUST |
| R10c | Los RPC MUST tener `execute` revocado de `public` y concedido únicamente a `service_role`, dado que son `security definer` | MUST |
| R11 | El parseo del `.xlsx` MUST cargarse con `import()` dinámico, de modo que `read-excel-file` no entre en el bundle inicial ni en el del Worker | MUST |
| R12 | La previsualización SHALL mostrar, antes de cualquier escritura: cantidad a crear, cantidad a actualizar, y cantidad con error con su número de fila y motivo | SHALL |
| R13 | La página MUST requerir una confirmación explícita del usuario entre la previsualización y la escritura | MUST |
| R14 | Si los encabezados del archivo no corresponden al tipo de carga elegido, el archivo MUST rechazarse completo en el parseo, sin intentar fila por fila | MUST |
| R15 | Los logs del servidor MUST NOT incluir contenido de las filas; solo número de fila y motivo | MUST |
| R16 | Los mensajes de error mostrados al usuario MUST NOT citar datos personales (nombres, correos, teléfonos, cédulas) | MUST |
| R17 | Los workflows en `n8n/` MUST permanecer sin cambios | MUST |

### Scenario: Consultor no admin intenta cargar

- GIVEN un usuario autenticado cuyo `consultores.rol` es `'consultor'`
- WHEN visita `/dashboard/cargas` o hace `POST` a `/api/cargas`
- THEN el ítem `Cargas` no aparece en el menú
- AND la ruta responde `403`
- AND no se ha instanciado ningún cliente con `SUPABASE_SERVICE_ROLE_KEY`

### Scenario: Previsualización de archivo con filas mixtas

- GIVEN un `.xlsx` de registro de sesión con 142 filas, de las cuales 5 no tienen correo válido
  o fecha parseable
- AND 19 de las 137 restantes corresponden a consultorías que ya existen
- WHEN el admin selecciona el archivo
- THEN se invoca `ingest_sesiones(filas, p_dry_run := true)`
- AND la previsualización muestra 118 a crear, 19 a actualizar y 5 con error
- AND cada fila con error se lista con su número y su motivo
- AND una consulta posterior a `leads`, `consultorias` y `registro_sesion` confirma que no quedó
  ninguna escritura

### Scenario: Confirmación de carga

- GIVEN una previsualización con 137 filas válidas
- WHEN el admin confirma la carga
- THEN se hace **una** invocación de `ingest_sesiones(filas, p_dry_run := false)` con las 137 filas
- AND el reporte final indica cuántas se crearon, cuántas se actualizaron y cuántas fallaron
- AND las filas que fallaron se listan con número de fila y motivo

### Scenario: Una fila viola un constraint durante la escritura

- GIVEN un lote de 50 filas en el que la fila 23 viola un constraint de la base
- WHEN se ejecuta el RPC
- THEN las otras 49 filas se escriben correctamente
- AND la fila 23 se reporta con su error
- AND ninguna escritura parcial de la fila 23 queda en `leads`, `consultorias` ni `registro_sesion`

### Scenario: Archivo del tipo equivocado

- GIVEN el admin está en la pestaña de bookings
- WHEN selecciona el `.xlsx` de registro de sesión
- THEN el archivo se rechaza completo indicando que los encabezados no corresponden
- AND no se muestra ninguna previsualización de filas

### Scenario: POST manipulado con una fila inválida

- GIVEN un `POST` a `/api/cargas` con `accion: 'commit'` y una fila cruda cuyo correo no contiene `@`
- WHEN el servidor procesa la petición
- THEN la normalización del servidor descarta esa fila antes de invocar el RPC
- AND la respuesta la reporta como fallida

### Scenario: Staff sin consultor reportado en la previsualización

- GIVEN una fila de bookings cuyo `Staff Email` no corresponde a ningún consultor
- WHEN se ejecuta la previsualización
- THEN la fila aparece como `creada` o `actualizada`, no como error
- AND trae un `aviso` indicando que el staff no tiene consultor asignable
