# Design: Módulo de ingesta de datos

## Technical Approach

Tres capas con una frontera clara entre ellas.

1. **Módulos puros** (`src/lib/ingest/`) — sin DOM, sin red, sin `Date` local. Reciben filas
   crudas y devuelven filas normalizadas o errores. Corren idénticos en navegador y Worker.
2. **Cliente** (`/dashboard/cargas`) — lee el archivo, lo parsea, invoca los módulos puros para
   armar la previsualización, y confirma.
3. **Servidor** (`/api/cargas` + dos RPC) — autoriza, revalida con los mismos módulos puros, y
   escribe en una sola llamada a Postgres.

La frontera importante es la 1↔3: el cliente **propone**, el servidor **decide**. Todo lo que el
cliente muestra es un cálculo local sobre el archivo; nada de lo que el cliente afirma se cree
sin recomputarlo del lado servidor.

## Architecture Decisions

| # | Decision | Choice | Alternatives rejected | Rationale |
|---|----------|--------|-----------------------|-----------|
| D1 | Dónde se parsea el archivo | En el navegador; solo sube el JSON normalizado | Parseo en el Worker con subida `multipart` | Workers no guardan estado entre requests, así que preview→confirmar exigiría KV/R2 (infra nueva, y se descartó el historial de cargas) o subir el archivo dos veces. Además mantiene el parser de XLSX fuera del bundle del Worker. |
| D2 | Librería para `.xlsx` | `read-excel-file` por su entry point `./browser`, con `import()` dinámico | `xlsx` (SheetJS); `exceljs` | `xlsx@0.18.5` en npm tiene 2 avisos de severidad alta con **"No fix available"** (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9): SheetJS dejó de publicar en npm. Son datos de clientes reales. `exceljs` pesa 21.8 MB y no publica desde 2024-12. `read-excel-file` audita limpio, pesa 2.4 MB. |
| D3 | Autoridad de la validación | El servidor revalida cada fila con los mismos módulos puros antes de escribir | Confiar en la validación del cliente; esquema de validación separado en el servidor | Cuesta casi nada porque los módulos son puros y sin dependencias de entorno. Un solo cuerpo de reglas evita que cliente y servidor divergan. |
| D4 | Estrategia de escritura | Un RPC por tipo de carga que recibe `jsonb` con el lote completo; savepoint por fila vía `begin ... exception` | N llamadas PostgREST por fila (patrón n8n); una transacción todo-o-nada | El patrón n8n hace ~5 requests/fila (~700 para 142 filas) y revienta el techo de subrequests del Worker. Todo-o-nada haría que una fila mala descarte el archivo entero. El savepoint por fila da atomicidad por fila **y** tolerancia al lote, en un round trip. |
| D5 | Atomicidad | Por fila: `leads` + `consultorias` + `registro_sesion` entran juntas o no entran | Por tabla (todos los leads, luego todas las consultorías) | Evita el estado a medias que ya produce n8n: consultoría creada cuyo `registro_sesion` falló después. |
| D6 | Cálculo de `hora_fin` | Aritmética entera sobre minutos, sin objetos `Date` | `new Date(...)` + `getHours()`, como WF-2 | El navegador corre en `America/Bogota` y el Worker en UTC. Con `Date` local, la misma fila daría `hora_fin` distinta en la previsualización y en la escritura. |
| D7 | Identidad de la consultoría | **`consultorias.booking_id`** como única columna del Booking Id, formalizada en migraciones | `id_reserva` (la única en migraciones); mantener las tres columnas | `booking_id` es el estándar de facto: lo escriben WF-2, WF-3 y `/api/booking`, y **lo lee el pipeline de métricas** (`useMetricas.ts:25`, `metricas.ts:1079` — KPI de reservas únicas). `grep -rn "id_reserva" src/` da **cero** resultados: solo la escribe `trg_bookings_after_insert`, que depende de `bookings_entrante`, tabla en la que **nada inserta**. Consolidar en `id_reserva` habría exigido modificar `metricas.ts` (alta blast radius) y habría orfanado los Booking Id ya cargados. El `Id` del Excel identifica el *registro de sesión*, no la reserva, así que `id_externo` vive solo en `registro_sesion` y la consultoría se alcanza por su FK. |
| D8 | Idempotencia | Select-then-write por clave natural, sin constraint único | Índice único sobre `booking_id` con `on conflict` | WF-2 siempre insertó, así que la base viva ya tiene duplicados; crear el índice único fallaría. Deduplicar es destructivo y va en un cambio aparte. |
| D9 | Match sesión → consultoría | `registro_sesion.id_externo`, luego `id_lead + fecha` **exacta** | Consultoría abierta más cercana; tolerancia de ±N días | Decisión del usuario. Conserva las dos filas (`Agendado` + `Resuelto`) cuando la sesión se corre de día, y deja que la card decida cuál mostrar — que es la regla pedida para el cambio B. |
| D10 | Fila ya existente | El archivo manda: se actualizan los campos con lo que traiga el archivo | La base manda (saltar existentes); preservar estado editado a mano | Decisión del usuario. Resubir un export corregido arregla los datos. Consecuencia aceptada: una carga posterior puede pisar un cambio manual de estado. |
| D11 | Severidad por fila | Dos niveles: **error** bloquea la fila, **aviso** la deja pasar y se reporta | Un solo nivel bloqueante | `Staff Email` sin match en `consultores` no debe descartar la sesión — pero hoy pasa en silencio y es la causa raíz del filtro de consultor roto. Como aviso, se corrige en el origen. |
| D12 | Autorización | Sesión con llave anónima (`src/lib/supabase-server.ts`) → verificar `rol === 'admin'` → recién entonces cliente con `service_role` | Solo `service_role` (patrón de `/api/insights/route.ts`); secreto en header (patrón de `/api/booking/route.ts`) | `service_role` salta RLS y el trigger `trg_guard_consultoria_consultor` de la migración `f5`. Nunca debe usarse antes de saber quién llama. El secreto en header sirve para un webhook de máquina, no para una acción de usuario autenticado. |
| D13 | Logs | Solo número de fila y motivo | `console.error` del error crudo, como `/api/booking/route.ts:` | Los archivos traen nombres, correos, teléfonos y cédulas de clientes reales; el error crudo puede arrastrar el payload a los logs de Cloudflare. |
| D14 | Estados admitidos | Ampliar el CHECK a 7: `Pendiente`, `Agendado`, `En seguimiento`, `Resuelto`, `Cancelado`, `No asistió`, `Escalar` | Reducir a los 5 del CHECK actual; ampliar solo con `No asistió` | Decisión del usuario. `ConsultoriaStatus` ya declara los 7 y `Map Session Status` ya los produce; hoy el CHECK los rechaza en silencio (drift D-3). |
| D15 | Trigger `trg_registro_sesion_after_insert` | Redefinirlo para que conserve solo la actualización de `leads.origen` → `'ambos'`, quitando la mutación de `status` y de `nivel_potencia` | Dejarlo como está; hacer que el módulo escriba el `registro_sesion` antes del status para que el trigger gane | El trigger colapsa a `Resuelto` todo resultado que no diga "resuelto" ni "seguimiento" — incluidos `cancelado`, `no asistió` y `escalar` — así que pisaría los estados que escriba el módulo. Es la segunda causa del síntoma de D-3. Además escribe el texto de `resultado` en `nivel_potencia`, dimensión que `metricas.ts:1033` e `insights-context.ts:117` agrupan esperando niveles. Los dos escritores de `registro_sesion` (WF-3 hoy, el módulo mañana) ya fijan el status explícitamente, así que la lógica es redundante además de incorrecta. Quitarla también **mejora WF-3** durante la convivencia. |

## Data Flow

### Flujo preview → commit

```
NAVEGADOR                                    WORKER                      POSTGRES
─────────                                    ──────                      ────────
admin elige tipo + archivo
        │
        ├─ .tsv  → parseTsv()
        └─ .xlsx → await import('read-excel-file/browser')
        │
        ▼
  src/lib/ingest/{bookings|sesiones}.ts
  cada fila → { ok:true, row } | { ok:false, errores }
        │
        │  POST /api/cargas
        │  { accion:'preview', tipo, claves:[...] }
        ├──────────────────────────────────────►  autoriza (sesión + admin)
        │                                              │
        │                                              ├─ select claves existentes ──►
        │                                              │  ◄── claves encontradas
        │  ◄───────────────────────────────────── { existentes:[...] }
        ▼
  previsualización
  ✓ crear   ↻ actualizar   ⚠ error (fila + motivo)
        │
        │  [ Cargar ]
        │  POST /api/cargas
        │  { accion:'commit', tipo, filas:[...] }
        ├──────────────────────────────────────►  autoriza (sesión + admin)
        │                                              │
        │                                              ├─ REVALIDA con los mismos
        │                                              │  módulos puros
        │                                              │
        │                                              ├─ rpc ingest_bookings(jsonb) ──►
        │                                              │  o ingest_sesiones(jsonb)
        │                                              │        │
        │                                              │        │  por cada fila:
        │                                              │        │   savepoint
        │                                              │        │   match_or_create_lead
        │                                              │        │   lookup consultor
        │                                              │        │   upsert consultoria
        │                                              │        │   upsert registro_sesion
        │                                              │        │   release / rollback
        │                                              │  ◄──── (fila, accion, error)[]
        │  ◄───────────────────────────────────── { creadas, actualizadas, fallidas }
        ▼
  reporte final
```

### Claves naturales

```
BOOKINGS .tsv
  Booking Id ──────────────► consultorias.booking_id
       └─ si viene vacío ──► id_lead + fecha + hora_inicio

REGISTRO DE SESIÓN .xlsx
  columna Id ──────────────► registro_sesion.id_externo ──(FK)──► consultorias
       └─ si viene vacío ──► id_lead + fecha (exacta)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/ingest/types.ts` | New | `RowError`, `RowAviso`, `NormalizeResult<T>`, `NormalizedBookingRow`, `NormalizedSesionRow`, contratos de request/response de `/api/cargas` |
| `src/lib/ingest/coerce.ts` | New | `toDate`, `toTime`, `toInt`, `toBool`, `addMinutes` (aritmética entera) |
| `src/lib/ingest/columns.ts` | New | `col(row, ...candidatos)` — normaliza acentos, colapsa espacios, unifica guiones, match por prefijo |
| `src/lib/ingest/bookings.ts` | New | `parseTsv`, `normalizeBookingRow`, `EXPECTED_BOOKING_HEADERS` |
| `src/lib/ingest/sesiones.ts` | New | `normalizeSesionRow`, `mapResultadoAStatus` (7 estados), `EXPECTED_SESION_HEADERS` |
| `src/lib/ingest/__tests__/*.test.ts` | New | Tests co-locados por módulo (ver spec `normalizacion-filas`) |
| `src/app/api/cargas/route.ts` | New | `POST` con `accion: 'preview' \| 'commit'`; autorización, revalidación, RPC |
| `src/app/dashboard/cargas/page.tsx` | New | Pestañas por tipo, dropzone, previsualización, reporte |
| `supabase/migrations/20260908_reconcile_ingest_schema.sql` | New | Reconciliación idempotente + redefinición de `trg_registro_sesion_after_insert` (ver spec `reconciliacion-esquema`) |
| `supabase/migrations/20260908_ingest_rpc.sql` | New | `ingest_bookings(jsonb)`, `ingest_sesiones(jsonb)` |
| `src/app/dashboard/DashboardShell.tsx` | Modified | `{ label: 'Cargas', href: '/dashboard/cargas', icon: 'upload_file', adminOnly: true }` |
| `src/types/index.ts` | Modified | `Consultoria`: quitar `booking_id` e `id_externo`. `RegistroSesion`: añadir `id_externo`, `duracion_sesion_minutos` |
| `src/app/api/booking/route.ts` | Modified | Solo `modalidad` normalizada a `Virtual`/`Presencial` — la columna `booking_id` que ya escribe resulta ser la correcta |
| `package.json` | Modified | `+ read-excel-file` |

## Testing Strategy

`environment: 'node'`, Vitest 4.1.7, `__tests__` co-locados — el patrón del repo. Estricto TDD
por `openspec/config.yaml`.

La normalización que hoy vive dentro de strings de JavaScript en JSON de n8n y no tiene un solo
test queda cubierta. Casos que importan:

- **`coerce`** — serial de Excel → fecha; fracción de día (`0.5` → `12:00`); `HH:MM` directo;
  basura → `null`; booleanos en español (`si`, `sí`, `yes`, `true`, `1`); `addMinutes` cruzando
  medianoche.
- **`columns`** — encabezado con acentos, con espacios dobles, con espacio final, con sufijo
  `(...)`, y `Categoría del caso (Potencia)1` (sufijo numérico pegado).
- **`bookings`** — día > 12 (válido en `DD/MM`, inválido en `MM/DD`); mes > 12 → error; correo
  sin `@` → error; `Custom Fields` presencial / virtual / ausente / JSON inválido; staff sin
  match → **aviso, no error**; `Booking Id` ausente → clave natural de fallback.
- **`sesiones`** — los 7 estados desde `Resultado de la sesión`; fila sin fecha → error;
  `Id` presente vs. ausente para la clave natural.
- **Independencia de zona horaria** — la misma fila normalizada con `TZ=UTC` y con
  `TZ=America/Bogota` debe producir `hora_fin` idéntica. Es la prueba que protege D6.

Los RPC de Postgres no tienen runner de tests en el proyecto (`integration: available: false`),
así que se verifican manualmente en la primera carga real, con n8n todavía disponible como
respaldo.
