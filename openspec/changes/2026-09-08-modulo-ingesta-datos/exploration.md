# Exploration: Módulo de ingesta de datos

Date: 2026-09-08
Explored by: brainstorming session (Claude Opus 5)

---

## 1. Estado actual de la ingesta

La carga de datos no vive en la aplicación. Depende de dos workflows de n8n versionados
en `n8n/`, que se disparan con un `formTrigger` (subida manual de archivo) y escriben
directo a Supabase vía PostgREST con `SUPABASE_SERVICE_ROLE_KEY`.

### WF-2 — `n8n/WF-2-corregido.json`

`Upload TSV Form` → `Parse TSV Direct` → `Transform Bookings Row` → `RPC match_or_create_lead`
→ `Merge Session Data` → `Loop One by One` → `Lookup Consultor` → `Insert consultoria`

- Entrada: `.tsv` crudo del export de Microsoft Bookings (tabs, sin quotes, fila 0 = encabezados).
- Columnas: `Date Time` (`DD/MM/YYYY H:MM`), `Customer Name`, `Customer Email`, `Customer Phone`,
  `Staff Name`, `Staff Email`, `Service`, `Duration (mins.)`, `Booking Id`, `Custom Fields`.
- `Custom Fields` es un JSON del que se extrae la modalidad por la clave
  `Selecciona la Modalidad de tu sesión`.
- **`Insert consultoria` siempre inserta.** No hay lookup previo, así que resubir el mismo
  TSV duplica consultorías.
- `hora_fin` se calcula con `new Date(...)` + `getHours()` → depende de la zona horaria del proceso.
- La única validación de fila es `filter(i => i.json['Customer Email'])`. Una fecha ilegible
  produce `fecha: null`, que viola el `NOT NULL` de `consultorias.fecha` sin reporte visible.

### WF-3 — `n8n/WF-3-corregido.json`

`Upload Excel Sesiones` → `Parse Excel` (`spreadsheetFile`) → `Normalize Rows`
→ `RPC match_or_create_lead` → `Merge Lead + Session` → `Loop One by One`
→ `Upsert consultorias` → `Prep registro_sesion` → `Insert registro_sesion`
→ `Map Session Status` → `Has Status?` → `Update consultoria status`

- Entrada: `.xlsx` con encabezados en español, largos e inestables. `Normalize Rows` incluye
  un helper `col()` minificado que normaliza acentos, colapsa espacios, unifica guiones
  (`–—` → `-`) y hace match por prefijo (`nk + ' ('`, `nk + ' -'`).
- Coerciones propias: `toDate` acepta serial de Excel (base `Date.UTC(1899,11,30)`),
  `toTime` acepta fracción de día (`0.5` → `12:00`), `toBool` acepta `si|sí|yes|true|1`.
- `Upsert consultorias` sí es idempotente: busca por `id_externo`, luego por
  `id_lead + fecha` con `booking_id=not.is.null`.
- Hace ~5 llamadas HTTP por fila dentro de `splitInBatches`.

### Costo de red

Para un archivo de 142 filas, WF-3 hace del orden de **700 requests HTTP**. Aceptable en n8n
(servidor sin límite de subrequests), incompatible con Cloudflare Workers (ver §4).

---

## 2. Drift de esquema — tres hallazgos

Ninguno documentado en `CHANGELOG.md`, `sdd/` ni `openspec/`.

### D-1 · Identidad de la consultoría: tres nombres para lo mismo

Inventario completo de escritores y lectores:

| Componente | Columna | Rol |
|---|---|---|
| `n8n/WF-2` (`Insert consultoria`) | **`booking_id`** | escribe |
| `n8n/WF-3` (`Upsert consultorias`) | `id_externo`, filtra por `booking_id` | escribe / lee |
| `src/app/api/booking/route.ts` | **`booking_id`** | escribe |
| `src/hooks/useMetricas.ts:25` | **`booking_id`** | lee |
| `src/lib/metricas.ts:110, 1077-1079` | **`booking_id`** | lee — KPI de reservas únicas (`booking_id` distintos) |
| `supabase/migrations/20260519_consultorias.sql:20` | `id_reserva` | declara |
| `trg_bookings_after_insert` (migración) | `id_reserva` | escribe |
| `src/types/index.ts` (`Consultoria`) | declara `booking_id` **e** `id_externo` | — |

Conclusiones:

1. **`booking_id` es el estándar de facto.** Lo escriben los tres escritores vivos y lo lee el
   pipeline de métricas. `grep -rn "booking_id" src/` da 4 resultados; `grep -rn "id_reserva" src/`
   da **cero**.
2. **La base viva tiene `consultorias.booking_id`.** `useMetricas.ts:25` la incluye en el `select`;
   si no existiera, PostgREST devolvería error y la página de métricas estaría caída por completo.
3. **`id_reserva` es vestigial.** Solo la escribe `trg_bookings_after_insert`, que se dispara al
   insertar en `bookings_entrante` — y `grep -rn "bookings_entrante" src/ n8n/` no da ningún
   resultado, así que **nada inserta ahí**. Ese trigger y esa tabla de staging son código muerto,
   y `id_reserva` está con toda probabilidad vacía en producción.

Consecuencia para el diseño: consolidar en `id_reserva` habría exigido modificar
`src/lib/metricas.ts` (alta blast radius según `openspec/config.yaml`) y habría dejado huérfanos
todos los Booking Id ya cargados. La identidad correcta es **`booking_id`**.

### D-2 · `registro_sesion.duracion_sesion_minutos` no existe en ninguna migración

- La **lee** `src/hooks/useMetricas.ts:30`.
- La **usa** `src/lib/metricas.ts` en 6 puntos (líneas 8, 526, 699, 821, 866, 1014).
- La **escribe** `n8n/WF-3` (`Prep registro_sesion`).
- **No la crea** `supabase/migrations/20260519_registro_sesion.sql` ni ninguna otra migración.

El comentario en `metricas.ts:1013` ("Zero until WF-3 loads duration data") sugiere que se
asumió vacía en vez de ausente.

### D-3 · `consultorias.status`: el CHECK rechaza dos estados que el código produce

| Fuente | Estados |
|---|---|
| `Normalize Rows` (WF-3) | `Cancelado`, `En seguimiento`, `Resuelto` |
| `Map Session Status` (WF-3) | los tres + `No asistió` + `Escalar` |
| `consultorias.status` CHECK | solo `Pendiente`, `Agendado`, `En seguimiento`, `Resuelto`, `Cancelado` |
| `src/types/index.ts` (`ConsultoriaStatus`) | los cinco + `Escalar` + `No asistió` |

Los dos nodos de WF-3 no coinciden **entre sí**, y `Map Session Status` produce valores que el
`CHECK` rechaza. El commit `c918054` ("noShows = leads con landing+consultoria sin
registro_sesion, no por status 'No asistio'") documenta el rodeo sin nombrar la causa.

### D-4 · Un trigger pisa el status que escriba cualquier otro camino

`trg_registro_sesion_after_insert` (`supabase/migrations/20260519_rpc_triggers.sql`, nunca
redefinido por ninguna migración posterior) se dispara al insertar en `registro_sesion` y hace:

```sql
if NEW.resultado is not null and trim(NEW.resultado) <> '' then
  v_status := case
    when lower(NEW.resultado) like '%resuelto%'    then 'Resuelto'
    when lower(NEW.resultado) like '%seguimiento%' then 'En seguimiento'
    else 'Resuelto'                                -- ← todo lo demás
  end;
  update public.consultorias set
    status = v_status,
    nivel_potencia = coalesce(consultorias.nivel_potencia, nullif(trim(NEW.resultado), ''))
  where id = NEW.id_consultoria;
end if;
```

Dos problemas:

1. **Colapsa los estados.** El `else` manda cualquier resultado que no diga "resuelto" ni
   "seguimiento" a `Resuelto` — incluidos `cancelado`, `no asistió` y `escalar`. Es la **segunda**
   causa del síntoma de D-3: aunque el CHECK admitiera `No asistió`, el trigger lo revertiría a
   `Resuelto`. En WF-3 el orden es `Insert registro_sesion` (trigger → `Resuelto`) y solo después
   `Update consultoria status` (que intenta `No asistió` y el CHECK rechaza). El valor que queda
   es `Resuelto`.
2. **Contamina una dimensión de métricas.** Escribe el texto de `resultado` en
   `consultorias.nivel_potencia`, que es un campo distinto: `src/lib/metricas.ts:1033` e
   `src/lib/insights-context.ts:117` agrupan por ese valor esperando niveles (`Alto`, `Medio`,
   `Bajo`). En su lugar pueden encontrar `"Resuelto"` o `"En seguimiento"` como si fueran niveles
   de potencia.

Ambos escritores de `registro_sesion` (WF-3 hoy, el módulo nuevo mañana) ya fijan el status
explícitamente, así que la lógica del trigger es redundante además de incorrecta.

---

## 3. Dependencias — no hay librería para leer `.xlsx`

`package.json` solo trae Next 16.2.6, React 19.2.4, `@supabase/*`, `recharts`,
`react-simple-maps`. Auditoría de candidatos (`npm audit --package-lock-only`, 2026-09-08):

| Paquete | Versión npm | Auditoría | Tamaño desempaquetado |
|---|---|---|---|
| `xlsx` (SheetJS) | 0.18.5 | **2 avisos altos, "No fix available"** — GHSA-4r6h-8v6p-xvw6 (prototype pollution), GHSA-5pgg-2g8v-p4x9 (ReDoS) | 7.5 MB |
| `read-excel-file` | 9.3.10 | limpia | 2.4 MB |
| `exceljs` | 4.4.0 | limpia, sin publicar desde 2024-12 | 21.8 MB |

SheetJS dejó de publicar en npm; las versiones parcheadas se distribuyen solo por su CDN.
`read-excel-file` expone un entry point `./browser` dedicado y depende de `saxen`, `fflate`,
`worker-f`, `unzipper-esm` — todo moderno y liviano.

---

## 4. Restricciones de plataforma

- **Cloudflare Workers** (deploy vía `@opennextjs/cloudflare` + `wrangler`). Cada invocación
  tiene techo de subrequests (orden de 50 en plan gratuito, 1000 en pago). El patrón de n8n
  (~5 requests/fila) es incompatible.
- **Sin estado entre requests.** Un flujo preview→confirmar del lado servidor exigiría KV/R2
  o resubir el archivo.
- **Zona horaria divergente.** El navegador corre en `America/Bogota`, el Worker en UTC.
  Cualquier cálculo de hora que use `Date` local diverge entre la validación del cliente y la
  del servidor.

---

## 5. Filtro de consultor — causa raíz

1. `src/app/dashboard/page.tsx:132` — `consultor_nombre` se llena **solo** si
   `consultorias.id_consultor` tiene valor.
2. `src/components/LeadCard.tsx:112` — pero la card, cuando `origen === 'booking'`, muestra
   `con.staff_name` de Bookings aunque `id_consultor` sea nulo.
3. `src/app/dashboard/page.tsx:169` — el desplegable del filtro se arma solo con
   `consultor_nombre`.
4. `src/app/dashboard/page.tsx:193` — el predicado compara contra `consultor_nombre`.

Resultado: un lead muestra un consultor en la card que el filtro no conoce. El nombre falta en
el desplegable y el lead desaparece al filtrar. El `id_consultor` queda nulo cuando
`Staff Email` no coincide con ningún `consultores.email_institucional` / `email` / `nombre`, y
eso hoy ocurre **sin ningún aviso**.

---

## 6. Otros hallazgos

- **`ErrorLog` es un tipo huérfano.** `src/types/index.ts` lo declara (`workflow`, `severity`,
  `raw_row`, `metadata`) pero no existe tabla `error_logs` en migraciones ni un solo uso en `src/`.
- **`/api/insights/route.ts` usa `service_role` sin verificar sesión.** Cualquiera que alcance
  la ruta la dispara. Fuera de alcance de este cambio, pero significa que no hay patrón de
  autenticación de rutas que copiar.
- **`modalidad` sin normalizar en `/api/booking/route.ts`.** Devuelve `cleaned` (texto
  arbitrario) cuando no es `virtual`/`presencial`, violando el CHECK de `consultorias.modalidad`.
- **`src/lib/supabase-server.ts`** ya provee el cliente con cookies necesario para autenticar
  la ruta nueva.
- **`DashboardShell.tsx:16`** ya tiene el patrón `adminOnly: true` (ítem *Consultores*).

---

## 7. Decisiones tomadas en el brainstorming

| # | Pregunta | Decisión |
|---|---|---|
| 1 | Alcance | Módulo de ingesta (A) primero; cambios de LEADS (B) en un cambio posterior |
| 2 | Formatos | Siguen siendo `.tsv` (bookings) y `.xlsx` (registro de sesión) |
| 3 | Flujo de carga | Previsualizar y confirmar |
| 4 | Fila ya existente | El archivo manda: actualizar |
| 5 | Match sesión → consultoría | Solo por fecha exacta, como hoy |
| 6 | Acceso | Página propia `/dashboard/cargas`, solo rol admin |
| 7 | n8n | Convivencia primero; retirar en un cambio aparte |
| 8 | Historial de cargas | No, sin tabla de auditoría |
| 9 | Parseo | En el navegador; el servidor revalida y escribe |
| 10 | Drift de esquema | Reconciliar con migración idempotente, consolidando en **`booking_id`** (ver D-1) |
| 11 | Estados | Ampliar el CHECK a los 7 estados |
| 12 | Trigger de status (D-4) | Redefinir `trg_registro_sesion_after_insert` para que no toque `status` ni `nivel_potencia`; el escritor es el dueño del status |
