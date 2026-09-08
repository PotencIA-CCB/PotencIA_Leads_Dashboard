# Proposal: Módulo de ingesta de datos

## Intent

Reemplazar los dos workflows de n8n (`WF-2` bookings `.tsv`, `WF-3` registro de sesión `.xlsx`)
por un módulo dentro de la aplicación que parsee, normalice, valide y cargue ambos archivos con
previsualización antes de escribir. De paso, reconciliar los tres drifts de esquema que la
ingesta por n8n dejó pasar sin detección (ver `exploration.md` §2).

## Scope

### In Scope

- Página `/dashboard/cargas`, visible y ejecutable solo para rol `admin`.
- Parseo en el navegador: `.tsv` con código propio, `.xlsx` con `read-excel-file/browser`
  cargado por `import()` dinámico.
- Módulos puros de normalización en `src/lib/ingest/`, con tests co-locados.
- Previsualización con conteos (crear / actualizar / error) y detalle por fila antes de escribir.
- Distinción **error** (bloquea la fila) vs. **aviso** (la fila entra, se reporta).
- Ruta `/api/cargas` con autorización de sesión + rol admin, que revalida y escribe.
- Dos RPC nuevos (`ingest_bookings`, `ingest_sesiones`) que procesan el lote completo en una
  llamada, con savepoint por fila.
- Migración de reconciliación idempotente: `consultorias.booking_id` formalizada como identidad
  única del Booking Id, `registro_sesion.duracion_sesion_minutos`, ampliación del CHECK de
  `consultorias.status` a 7 estados.
- Redefinición de `trg_registro_sesion_after_insert` para que no colapse los estados ni escriba
  `resultado` en `nivel_potencia` (drift D-4).
- Alineación de `src/types/index.ts` con el esquema real.
- Corrección de `modalidad` en `/api/booking/route.ts` para respetar el CHECK.

### Out of Scope

- **Cambios en el módulo LEADS** (estado no dinámico en la card, quitar sector, regla de
  agendamiento mostrado, arreglo del filtro de consultor). Es el cambio B, posterior.
- Retiro de los workflows de n8n y borrado de `n8n/`. Convivencia deliberada hasta validar
  el módulo con cargas reales.
- Tabla de historial/auditoría de cargas.
- Deduplicación de las consultorías que WF-2 ya duplicó (ver Riesgos).
- Retiro de `bookings_entrante` y `trg_bookings_after_insert`, que la exploración confirmó como
  código muerto (nada inserta en esa tabla). Limpieza para un cambio aparte.
- Autenticación de `/api/insights/route.ts` (gap preexistente, sin relación con este cambio).
- Ingesta de `formularios_landing` (llega por webhook, no por archivo).

## Capabilities

### New Capabilities

- **`ingesta-archivos`**: página `/dashboard/cargas` + ruta `/api/cargas` + RPC de lote.
  Cubre autorización, flujo preview→commit, reporte de resultados y manejo de errores por fila.
- **`normalizacion-filas`**: módulos puros `src/lib/ingest/{columns,coerce,bookings,sesiones}.ts`.
  Cubren coerción de tipos, tolerancia a encabezados, mapeo a las tres tablas destino, claves
  naturales, y clasificación error/aviso.
- **`reconciliacion-esquema`**: migración idempotente (identidad, columna de duración, CHECK de
  estados, redefinición del trigger) + alineación de tipos + corrección de `modalidad` en
  `/api/booking/route.ts`.

## Approach

El parseo ocurre en el navegador y el archivo crudo nunca sube. La normalización vive en
funciones puras que corren **igual en el cliente y en el Worker**: el cliente las usa para armar
la previsualización, el servidor las vuelve a correr antes de escribir, así que la validación del
cliente no es la autoridad y un `POST` fabricado no puede colar filas inválidas.

La escritura se hace en **una sola llamada por carga**. Cada RPC recibe un `jsonb` con todas las
filas normalizadas y las recorre en plpgsql; cada iteración va dentro de un bloque
`begin ... exception when others then`, que crea un savepoint por fila. Eso da atomicidad por
fila (o entra completa en `leads` + `consultorias` + `registro_sesion`, o no entra nada de ella)
sin que una fila mala aborte el lote, y en un solo round trip. Es requisito de plataforma, no
preferencia: el patrón de n8n (~5 requests por fila, ~700 para un archivo de 142) supera el techo
de subrequests de un Worker.

**Impacto en el pipeline de métricas** (`src/lib/metricas.ts`): **ninguna función se modifica.**
El cambio es de datos, no de cálculo. Tres efectos indirectos, todos en la dirección de corregir:

1. `registro_sesion.duracion_sesion_minutos` pasa a existir de verdad, así que los seis puntos
   que ya la leen (`metricas.ts:526, 699, 821, 866, 1014`) empiezan a recibir valores en vez de
   `undefined`. Los KPI de duración pueden **subir desde cero** — eso es la corrección de D-2,
   no una regresión.
2. El KPI de reservas únicas (`metricas.ts:1077-1079`, `booking_id` distintos) **sigue
   funcionando sin cambios**, precisamente porque la identidad se consolida en `booking_id` y no
   en `id_reserva`. Esta fue la razón principal para invertir la decisión D7.
3. `consultorias.nivel_potencia` deja de recibir el texto de `resultado` que le inyectaba el
   trigger, así que la agrupación de `metricas.ts:1033` e `insights-context.ts:117` deja de
   mostrar `"Resuelto"` y `"En seguimiento"` como si fueran niveles de potencia. Las filas ya
   contaminadas **no se limpian** en este cambio; solo se detiene la contaminación futura.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/dashboard/cargas/page.tsx` | New | UI de subida, previsualización y confirmación |
| `src/app/api/cargas/route.ts` | New | Autorización admin, revalidación, invocación de RPC |
| `src/lib/ingest/columns.ts` | New | Match tolerante de encabezados (rescatado de WF-3) |
| `src/lib/ingest/coerce.ts` | New | `toDate` / `toTime` / `toInt` / `toBool` + seriales de Excel |
| `src/lib/ingest/bookings.ts` | New | Fila `.tsv` → `{ lead, consultoria }` + errores/avisos |
| `src/lib/ingest/sesiones.ts` | New | Fila `.xlsx` → `{ lead, consultoria, registro }` + errores/avisos |
| `src/lib/ingest/types.ts` | New | Contratos compartidos cliente/servidor |
| `supabase/migrations/20260908_*.sql` | New | Reconciliación de esquema + los dos RPC |
| `src/app/dashboard/DashboardShell.tsx` | Modified | Ítem `Cargas` en `navItems` con `adminOnly: true` |
| `src/types/index.ts` | Modified | `Consultoria` y `RegistroSesion` alineados al esquema real |
| `src/app/api/booking/route.ts` | Modified | Normaliza `modalidad` al CHECK (la columna que escribe ya es la correcta) |
| `package.json` | Modified | `+ read-excel-file` |
| `n8n/` | Untouched | Convivencia deliberada |
| `src/lib/metricas.ts` | Untouched | Sin cambios de código (ver impacto indirecto arriba) |

## Risks

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | `consultorias.booking_id` existe en la base viva pero no en migraciones, así que el repo y la base discrepan | Migración con `add column if not exists` que la formaliza, más backfill `booking_id = coalesce(booking_id, id_reserva)` dentro de un bloque `DO` que consulta `information_schema` primero. No se borra ninguna columna. |
| R2 | WF-2 ya duplicó consultorías, así que un índice único sobre `booking_id` fallaría al crearse | **No se crea constraint único.** El upsert hace select-then-write, como `/api/booking/route.ts`. La deduplicación queda para un cambio de limpieza aparte. |
| R3 | Convivencia con n8n = dos escritores de las mismas tablas | Deliberado y temporal. Ambos caminos quedan idempotentes por `booking_id` tras la migración. Quitar la mutación de status del trigger también mejora WF-3, que ya fija el status por su cuenta. Retiro de n8n en cambio posterior. |
| R4 | Validación en cliente podría eludirse | El servidor revalida con los mismos módulos puros antes de escribir. |
| R5 | Divergencia de zona horaria cliente (`America/Bogota`) / Worker (UTC) | `hora_fin` se calcula con aritmética entera sobre minutos, sin `Date`. Test que corre la misma fila bajo ambas `TZ` y exige resultado idéntico. |
| R6 | Datos personales de clientes en logs de Cloudflare | El route registra número de fila y motivo, nunca el contenido. Los mensajes de UI tampoco citan datos personales. |
| R7 | Los KPI de duración cambian de valor al poblarse `duracion_sesion_minutos` | Documentado como corrección esperada de D-2, no regresión. Avisar al revisar métricas tras la primera carga. |
| R8 | Redefinir el trigger cambia comportamiento del que podría depender algo no identificado | Los únicos escritores de `registro_sesion` son WF-3 y el módulo, y ambos fijan `status` explícitamente. La parte de `leads.origen` → `'ambos'` se conserva intacta. |
| R9 | Las filas con `nivel_potencia` ya contaminado siguen contaminadas | Fuera de alcance: limpiar datos históricos es un cambio aparte. Se detiene la contaminación futura y queda documentado. |

## Rollback Plan

El cambio se divide en dos partes con rollback independiente.

**Parte de aplicación** (página, ruta, módulos, tipos, `package.json`): revertir el commit.
n8n sigue operativo porque nunca se apagó, así que la ingesta no se interrumpe. Sin estado
persistente que limpiar — el módulo no crea tablas ni guarda archivos.

**Parte de base de datos**: las tres piezas de la migración son aditivas y seguras de dejar
puestas incluso si se revierte la aplicación.

- `registro_sesion.duracion_sesion_minutos`: columna nueva y nullable. WF-3 ya la escribe;
  dejarla puesta **corrige** el drift. No revertir.
- `consultorias.status` CHECK ampliado: dejarlo puesto es inocuo (solo admite más valores).
  Revertirlo requiere que ninguna fila tenga ya `No asistió` ni `Escalar`; si las hay, hay que
  mapearlas antes. Documentar el `UPDATE` de reversa en el `tasks.md`.
- Backfill `booking_id = coalesce(booking_id, id_reserva)`: no destructivo, `id_reserva` se
  conserva intacta. Reversa: ninguna necesaria.
- Los dos RPC: `drop function if exists public.ingest_bookings(jsonb)` / `ingest_sesiones(jsonb)`.
- `trg_registro_sesion_after_insert`: la definición original está en
  `supabase/migrations/20260519_rpc_triggers.sql` y se restaura con un `create or replace`.
  Reponerla solo si se revierte también el CHECK ampliado, porque la versión original colapsa
  `No asistió` y `Escalar` a `Resuelto`.

La única reversa con orden obligatorio es el CHECK: revertir el CHECK **antes** de que existan
filas con los estados nuevos, o mapear esas filas primero.
