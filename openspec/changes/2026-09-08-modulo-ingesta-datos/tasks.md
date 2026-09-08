# Módulo de ingesta de datos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los workflows de n8n de carga de bookings (`.tsv`) y registro de sesión (`.xlsx`) por un módulo en la aplicación con previsualización exacta antes de escribir.

**Architecture:** El navegador parsea el archivo y manda las filas **crudas** como JSON; el servidor las normaliza él mismo con módulos puros (misma normalización que corrió el cliente, pero el servidor es la autoridad) e invoca un único RPC de Postgres por carga. El RPC recorre el lote con un savepoint por fila; `p_dry_run` hace que revierta las escrituras y devuelva de todos modos la acción que habría aplicado, lo que convierte la previsualización en un dry-run del camino real.

**Tech Stack:** Next.js 16.2.6 (App Router, `--webpack`), React 19.2.4, TypeScript 5 strict, Tailwind v4, Supabase (PostgreSQL + Auth), Vitest 4.1.7, despliegue en Cloudflare Workers vía `@opennextjs/cloudflare`. Nueva dependencia: `read-excel-file`.

**Spec:** `openspec/changes/2026-09-08-modulo-ingesta-datos/` — `proposal.md`, `design.md`, `exploration.md`, y `specs/{ingesta-archivos,normalizacion-filas,reconciliacion-esquema}/spec.md`

**Change**: modulo-ingesta-datos
**Delivery strategy**: ask-on-risk (migraciones se aplican a mano)

## Global Constraints

- **TDD estricto** (`openspec/config.yaml: strict_tdd: true`). Test rojo antes de implementación, siempre.
- **Tests co-locados** en `__tests__/`, patrón `src/**/*.test.{ts,tsx}`, `environment: 'node'`.
- Comandos: `npm test` · `npm run lint` · `npx tsc --noEmit` · `npm run build`
- **`src/lib/metricas.ts` NO se modifica en este cambio** (alta blast radius por `openspec/config.yaml`).
- **`n8n/` NO se toca.** Convivencia deliberada.
- Los módulos de `src/lib/ingest/` **no usan DOM, red, ni `Date` dependiente de zona horaria local**. Corren idénticos en navegador y Worker.
- Los logs del servidor llevan **número de fila y motivo, nunca contenido de la fila** (datos personales de clientes reales).
- Las migraciones se aplican **a mano en el editor SQL de Supabase**, en orden cronológico (`README.md:222`). No hay CLI enlazada.
- Estados válidos de `consultorias.status` tras la Work Unit A: `Pendiente`, `Agendado`, `En seguimiento`, `Resuelto`, `Cancelado`, `No asistió`, `Escalar`.
- Identidad del Booking Id: **`consultorias.booking_id`**. `id_reserva` es vestigial y solo se lee para el backfill.

---

## Work Unit A — Reconciliación de esquema, tipos y `modalidad`

Files: `supabase/migrations/20260908_reconcile_ingest_schema.sql` (CREATE), `src/types/index.ts` (MODIFY), `src/app/api/booking/route.ts` (MODIFY)
Spec: `reconciliacion-esquema` — R1–R22
Sequential: A1 → A2 → A3 → A4 → A5

**Interfaces:**
- Consumes: nada (primera unidad).
- Produces: esquema con `consultorias.booking_id` formalizada e indexada, `registro_sesion.duracion_sesion_minutos`, CHECK de 7 estados, y `trg_registro_sesion_after_insert` sin mutación de `status` ni `nivel_potencia`. `ConsultoriaStatus` de `src/types/index.ts` con 7 valores (ya los tiene).

### A1 — Escribir la migración de reconciliación

- [ ] Crear `supabase/migrations/20260908_reconcile_ingest_schema.sql` con este contenido exacto:

```sql
-- PotencIA Leads Dashboard
-- Reconciliación de esquema para el módulo de ingesta.
--
-- Resuelve cuatro drifts documentados en
-- openspec/changes/2026-09-08-modulo-ingesta-datos/exploration.md §2:
--   D-1  consultorias tenía tres nombres para el Booking Id → se consolida en booking_id
--   D-2  registro_sesion.duracion_sesion_minutos se leía sin existir en migraciones
--   D-3  el CHECK de status rechazaba 'No asistió' y 'Escalar'
--   D-4  trg_registro_sesion_after_insert colapsaba estados y contaminaba nivel_potencia
--
-- Idempotente: correrla dos veces no produce error ni cambia el resultado.
-- No ejecuta ningún DROP COLUMN.

begin;

-- ============================================================================
-- D-1 · booking_id como identidad única del Booking Id
-- ============================================================================

alter table public.consultorias add column if not exists booking_id text;

-- Backfill desde id_reserva solo si esa columna existe (es vestigial: la
-- escribía trg_bookings_after_insert, que depende de bookings_entrante, tabla
-- en la que nada inserta).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'consultorias'
      and column_name = 'id_reserva'
  ) then
    execute $q$
      update public.consultorias
         set booking_id = id_reserva
       where id_reserva is not null
         and booking_id is null
    $q$;
  end if;
end $$;

create index if not exists consultorias_booking_id_idx
  on public.consultorias (booking_id);

-- ============================================================================
-- D-2 · duracion_sesion_minutos en registro_sesion
-- ============================================================================

alter table public.registro_sesion
  add column if not exists duracion_sesion_minutos int;

alter table public.registro_sesion
  add column if not exists id_externo text;

create index if not exists registro_sesion_id_externo_idx
  on public.registro_sesion (id_externo);

-- ============================================================================
-- D-3 · CHECK de status ampliado a 7 estados
-- ============================================================================

-- El CHECK original se declaró inline y sin nombre en
-- 20260519_consultorias.sql:42, así que Postgres lo autonombró. Se localiza por
-- catálogo en vez de asumir el nombre.
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.consultorias'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.consultorias drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.consultorias
  add constraint consultorias_status_check
  check (status in (
    'Pendiente', 'Agendado', 'En seguimiento', 'Resuelto',
    'Cancelado', 'No asistió', 'Escalar'
  ));

-- ============================================================================
-- D-4 · El trigger deja de ser dueño del status
-- ============================================================================
--
-- La versión original colapsaba a 'Resuelto' todo resultado que no dijera
-- "resuelto" ni "seguimiento" (incluidos cancelado, no asistió y escalar), y
-- escribía el texto de resultado en consultorias.nivel_potencia — dimensión que
-- metricas.ts:1033 e insights-context.ts:117 agrupan esperando niveles.
--
-- Los dos escritores de registro_sesion (n8n WF-3 hoy, el módulo de ingesta
-- mañana) fijan el status explícitamente, así que la lógica era redundante
-- además de incorrecta. Se conserva solo la actualización de leads.origen.

create or replace function public.trg_registro_sesion_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orig text;
begin
  select origen into v_orig from public.leads where id = NEW.id_lead;

  if v_orig in ('landing', 'booking') then
    update public.leads set
      origen = 'ambos',
      updated_at = now()
    where id = NEW.id_lead;
  end if;

  return NEW;
end;
$$;

commit;
```

- [ ] Verificar que el archivo no contiene ningún `drop column`:

Run: `grep -in "drop column" supabase/migrations/20260908_reconcile_ingest_schema.sql`
Expected: sin resultados (exit 1)

### A2 — Aplicar la migración en Supabase (paso humano)

- [ ] **PASO HUMANO.** Pegar el contenido completo de `supabase/migrations/20260908_reconcile_ingest_schema.sql` en el editor SQL de Supabase y ejecutarlo. No hay CLI enlazada en este proyecto (`README.md:222`).
- [ ] Confirmar que terminó sin error.
- [ ] Verificar el resultado con esta consulta en el mismo editor:

```sql
select column_name
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'consultorias'    and column_name in ('booking_id', 'id_reserva'))
     or (table_name = 'registro_sesion' and column_name in ('duracion_sesion_minutos', 'id_externo')))
 order by column_name;

select pg_get_constraintdef(oid) as def
  from pg_constraint
 where conrelid = 'public.consultorias'::regclass
   and contype = 'c'
   and pg_get_constraintdef(oid) ilike '%status%';
```

Expected: la primera consulta lista `booking_id` y `duracion_sesion_minutos` (más `id_reserva` e `id_externo` si existían); la segunda muestra un CHECK con los 7 estados incluidos `'No asistió'` y `'Escalar'`.

- [ ] Verificar que el KPI de reservas únicas no cambió de valor (spec `reconciliacion-esquema` R7c). Antes de la migración ese KPI cuenta `booking_id` distintos; después debe contar lo mismo o más (nunca menos), porque el backfill solo llena nulos:

```sql
select count(distinct booking_id) as reservas_unicas
  from public.consultorias
 where booking_id is not null;
```

Expected: el mismo valor que antes de la migración, o mayor si el backfill desde `id_reserva` encontró filas. **Nunca menor.**

- [ ] Ejecutar la migración **una segunda vez** para comprobar la idempotencia (spec `reconciliacion-esquema`, escenario "Migración corrida dos veces").
- [ ] Confirmar que la segunda ejecución tampoco produce error.

### A3 — Alinear `src/types/index.ts` con el esquema real

- [ ] En `src/types/index.ts`, dentro de la interfaz `Consultoria`, reemplazar estas dos líneas:

```ts
  booking_id: string | null
  id_externo: string | null
```

por:

```ts
  /** Booking Id de Microsoft Bookings. Identidad natural de la consultoría. */
  booking_id: string | null
  /** Vestigial: solo la escribía trg_bookings_after_insert vía bookings_entrante, tabla sin inserts. */
  id_reserva?: string | null
```

- [ ] En la interfaz `RegistroSesion`, añadir estas dos propiedades después de `id_consultoria`:

```ts
  /** Columna `Id` del Excel de registro de sesión. Identidad natural del registro. */
  id_externo: string | null
  /** Duración reportada en el Excel. La lee metricas.ts en 6 puntos. */
  duracion_sesion_minutos: number | null
```

- [ ] Arreglar los dos literales de `RegistroSesion` que quedarán incompletos. Las dos propiedades nuevas son **requeridas**, y estos dos archivos construyen el tipo completo:

  - `src/hooks/__tests__/useBusinessIntelligence.test.ts:269` — en la fábrica `makeSessionRow`
  - `src/components/dashboard/__tests__/SessionInsightsSection.test.tsx:19` — en la fábrica `makeSession`

  En cada una, añadir al objeto base las dos propiedades con valor `null`:

```ts
  id_externo: null,
  duracion_sesion_minutos: null,
```

- [ ] Verificar que el typecheck pasa:

Run: `npx tsc --noEmit`
Expected: sin errores. Si `tsc` reporta otro literal de `RegistroSesion` incompleto que no sea uno de esos dos, aplicarle el mismo arreglo.

### A4 — Normalizar `modalidad` en `/api/booking/route.ts`

- [ ] Escribir el test rojo. Crear `src/app/api/booking/__tests__/normalizeModalidad.test.ts`:

```ts
/**
 * La columna consultorias.modalidad tiene un CHECK que solo admite
 * 'Virtual' y 'Presencial'. La versión anterior del route devolvía el texto
 * crudo cuando no reconocía el valor, violando el constraint.
 */
import { describe, it, expect } from 'vitest'
import { normalizeModalidad } from '../bookingUtils'

describe('normalizeModalidad', () => {
  it('reconoce virtual sin distinguir mayúsculas ni espacios', () => {
    expect(normalizeModalidad(' VIRTUAL ')).toBe('Virtual')
  })

  it('reconoce presencial sin distinguir mayúsculas ni espacios', () => {
    expect(normalizeModalidad('Presencial')).toBe('Presencial')
  })

  it('resuelve a Virtual cuando el texto no corresponde a ninguno', () => {
    expect(normalizeModalidad('Sesión híbrida en la sede norte')).toBe('Virtual')
  })

  it('resuelve a Virtual con cadena vacía', () => {
    expect(normalizeModalidad('')).toBe('Virtual')
  })

  it('resuelve a Virtual con undefined', () => {
    expect(normalizeModalidad(undefined)).toBe('Virtual')
  })
})
```

- [ ] Ejecutar el test para verificar que falla:

Run: `npm test -- normalizeModalidad`
Expected: FAIL con `normalizeModalidad is not a function` o error de importación (la función no existe todavía).

- [ ] Implementar. Añadir al final de `src/app/api/booking/bookingUtils.ts`:

```ts
/**
 * Normaliza la modalidad al único par de valores que admite el CHECK de
 * consultorias.modalidad. Cualquier texto no reconocido resuelve a 'Virtual'.
 */
export function normalizeModalidad(raw: unknown): 'Virtual' | 'Presencial' {
  if (typeof raw !== 'string') return 'Virtual'
  return /presencial/i.test(raw.trim()) ? 'Presencial' : 'Virtual'
}
```

- [ ] Ejecutar el test para verificar que pasa:

Run: `npm test -- normalizeModalidad`
Expected: PASS, 5 tests.

- [ ] En `src/app/api/booking/route.ts`, añadir `normalizeModalidad` a la importación existente:

```ts
import { extractNombreCompleto, normalizeModalidad } from './bookingUtils'
```

- [ ] En el mismo archivo, reemplazar el bloque IIFE completo que calcula `modalidad`:

```ts
    const modalidadRaw = body.modalidad
    const modalidad = (() => {
      if (typeof modalidadRaw !== 'string') return 'Virtual'
      const cleaned = modalidadRaw.trim()
      if (!cleaned) return 'Virtual'
      const key = cleaned.toLowerCase()
      if (key === 'virtual') return 'Virtual'
      if (key === 'presencial') return 'Presencial'
      return cleaned
    })()
```

por una sola línea:

```ts
    const modalidad = normalizeModalidad(body.modalidad)
```

- [ ] Verificar que la suite completa sigue verde y el typecheck pasa:

Run: `npm test && npx tsc --noEmit`
Expected: PASS sin regresiones sobre los tests existentes de `/api/booking`.

### A5 — Commit de la Work Unit A

- [ ] Commit:

```bash
git add supabase/migrations/20260908_reconcile_ingest_schema.sql \
        src/types/index.ts \
        src/app/api/booking/bookingUtils.ts \
        src/app/api/booking/__tests__/normalizeModalidad.test.ts \
        src/app/api/booking/route.ts \
        src/hooks/__tests__/useBusinessIntelligence.test.ts \
        src/components/dashboard/__tests__/SessionInsightsSection.test.tsx
git commit -m "fix(esquema): reconcilia identidad de consultoria, duracion de sesion y CHECK de status

Resuelve los cuatro drifts documentados en exploration.md §2:
- booking_id formalizada como identidad del Booking Id, con backfill
  desde id_reserva y su indice
- registro_sesion.duracion_sesion_minutos, que metricas.ts leia en 6
  puntos sin que ninguna migracion la creara
- CHECK de consultorias.status ampliado a los 7 estados que
  ConsultoriaStatus ya declaraba
- trg_registro_sesion_after_insert deja de colapsar estados a Resuelto
  y de escribir resultado en nivel_potencia

Tambien normaliza modalidad en /api/booking, que podia devolver texto
arbitrario y violar el CHECK de consultorias.modalidad."
```

---

## Work Unit B — Contratos y coerción de tipos

Files: `src/lib/ingest/types.ts` (CREATE), `src/lib/ingest/coerce.ts` (CREATE), `src/lib/ingest/__tests__/coerce.test.ts` (CREATE)
Spec: `normalizacion-filas` — R1–R5, R6–R10
Sequential: B1 → B2 → B3 → B4
Dependency: A3 (los tipos de `@/types` deben estar alineados)

**Interfaces:**
- Consumes: `ConsultoriaStatus` de `@/types`.
- Produces:
  - `src/lib/ingest/types.ts`: `Severidad`, `RowIssue`, `LeadInput`, `ConsultoriaInput`, `RegistroInput`, `NormalizedBookingRow`, `NormalizedSesionRow`, `NormalizeResult<T>`, `TipoCarga`, `RawRow`, `CargaRequest`, `CargaResponse`, `FilaResultado`.
  - `src/lib/ingest/coerce.ts`: `toDate(v: unknown): string | null`, `toTime(v: unknown): string | null`, `toInt(v: unknown): number | null`, `toBool(v: unknown): boolean`, `addMinutes(hhmm: string | null, minutes: number | null): string | null`, `trimOrNull(v: unknown): string | null`.

### B1 — Definir los contratos compartidos

- [ ] Crear `src/lib/ingest/types.ts`:

```ts
import type { ConsultoriaStatus } from '@/types'

/** Una fila cruda parseada del archivo: pares encabezado → valor. */
export type RawRow = Record<string, unknown>

export type TipoCarga = 'bookings' | 'sesiones'

/** Un error bloquea la fila; un aviso la deja pasar y se reporta. */
export type Severidad = 'error' | 'aviso'

export interface RowIssue {
  /** 1-indexado respecto al archivo, contando el encabezado como fila 1. */
  fila: number
  severidad: Severidad
  /** Legible en español. NUNCA incluye datos personales de la fila. */
  motivo: string
}

/** Parámetros del RPC match_or_create_lead. */
export interface LeadInput {
  p_email: string
  p_nombre_completo: string
  p_phone: string | null
  p_id_num: string | null
  p_nit: string | null
  p_city: string | null
  p_cargo: string | null
  p_company_role_level: string | null
  p_company_role_area: string | null
  p_sector: string | null
  p_empresa: string | null
  p_sexo: string | null
  p_booking_email: string | null
  p_booking_customer_id: string | null
  p_origen: 'booking' | 'sesion'
}

export interface ConsultoriaInput {
  booking_id: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  duracion_minutos: number | null
  modalidad: 'Virtual' | 'Presencial'
  servicio: string | null
  staff_name: string | null
  staff_email: string | null
  nivel_potencia: string | null
  categoria_caso: string | null
  categoria_caso_uso: string | null
  /** null = no modificar el status existente (resultado de sesión vacío). */
  status: ConsultoriaStatus | null
}

export interface RegistroInput {
  id_externo: string | null
  pregunta: string | null
  motivo_consulta: string | null
  estado_inicial: string | null
  acciones_realizadas: string | null
  resultado_final: string | null
  estimacion_impacto: string | null
  entregables: string | null
  cantidad_productos: number
  sesion_grabada: boolean
  enlace_grabacion: string | null
  adjuntar_evidencia: string | null
  confirmo_no_automatizacion: boolean | null
  resultado: string | null
  duracion_sesion_minutos: number | null
}

export interface NormalizedBookingRow {
  fila: number
  /** Booking Id, o `email|fecha|hora` como fallback. Solo para trazabilidad. */
  clave: string
  lead: LeadInput
  consultoria: ConsultoriaInput
}

export interface NormalizedSesionRow {
  fila: number
  /** Columna `Id` del Excel, o `email|fecha` como fallback. */
  clave: string
  lead: LeadInput
  consultoria: ConsultoriaInput
  registro: RegistroInput
}

export type NormalizeResult<T> =
  | { ok: true; row: T; avisos: RowIssue[] }
  | { ok: false; fila: number; errores: RowIssue[] }

/** Lo que devuelve el RPC por cada fila del lote. */
export interface FilaResultado {
  fila: number
  accion: 'creada' | 'actualizada' | null
  aviso: string | null
  error: string | null
}

export interface CargaRequest {
  accion: 'preview' | 'commit'
  tipo: TipoCarga
  /** Filas CRUDAS. El servidor las normaliza él mismo: es la autoridad. */
  filas: RawRow[]
}

export interface CargaResponse {
  creadas: number
  actualizadas: number
  fallidas: Array<{ fila: number; motivo: string }>
  avisos: Array<{ fila: number; motivo: string }>
}
```

- [ ] Verificar que el typecheck pasa:

Run: `npx tsc --noEmit`
Expected: sin errores.

### B2 — Escribir el test rojo de `coerce`

- [ ] Crear `src/lib/ingest/__tests__/coerce.test.ts`:

```ts
/**
 * Coerciones de tipos para la ingesta.
 *
 * Rescatadas de n8n/WF-3 (nodo `Normalize Rows`), donde vivían minificadas en
 * una línea dentro del JSON del workflow y sin un solo test.
 *
 * addMinutes existe para reemplazar el cálculo de hora_fin de WF-2, que usaba
 * `new Date` + `getHours()` y por tanto dependía de la zona horaria del
 * proceso: el navegador corre en America/Bogota y el Worker en UTC, así que la
 * misma fila daba resultados distintos en la previsualización y en la escritura.
 */
import { describe, it, expect } from 'vitest'
import { toDate, toTime, toInt, toBool, addMinutes, trimOrNull } from '../coerce'

describe('toDate', () => {
  it('devuelve tal cual una fecha ISO', () => {
    expect(toDate('2026-09-15')).toBe('2026-09-15')
  })

  it('recorta la parte de hora de un timestamp ISO', () => {
    expect(toDate('2026-09-15T14:30:00Z')).toBe('2026-09-15')
  })

  it('convierte un serial de Excel contando desde 1899-12-30', () => {
    // 1 = 1899-12-31, así que 46280 cae en 2026-09-15
    expect(toDate(46280)).toBe('2026-09-15')
  })

  it('acepta el serial de Excel como cadena', () => {
    expect(toDate('46280')).toBe('2026-09-15')
  })

  it('interpreta DD/MM/YYYY con el día primero', () => {
    expect(toDate('15/09/2026')).toBe('2026-09-15')
  })

  it('acepta un día mayor a 12, que en formato MM/DD sería inválido', () => {
    expect(toDate('25/09/2026')).toBe('2026-09-25')
  })

  it('rechaza un mes mayor a 12', () => {
    expect(toDate('31/13/2026')).toBeNull()
  })

  it('rechaza un día mayor a 31', () => {
    expect(toDate('32/01/2026')).toBeNull()
  })

  it('devuelve null con cadena vacía, guion y basura', () => {
    expect(toDate('')).toBeNull()
    expect(toDate('-')).toBeNull()
    expect(toDate('no es una fecha')).toBeNull()
  })

  it('devuelve null con null y undefined', () => {
    expect(toDate(null)).toBeNull()
    expect(toDate(undefined)).toBeNull()
  })

  it('usa componentes UTC de un objeto Date, sin desplazar por zona horaria', () => {
    expect(toDate(new Date(Date.UTC(2026, 8, 15)))).toBe('2026-09-15')
  })
})

describe('toTime', () => {
  it('normaliza HH:MM', () => {
    expect(toTime('14:30')).toBe('14:30')
  })

  it('rellena la hora de un solo dígito', () => {
    expect(toTime('9:05')).toBe('09:05')
  })

  it('recorta los segundos', () => {
    expect(toTime('14:30:45')).toBe('14:30')
  })

  it('convierte una fracción de día de Excel', () => {
    expect(toTime(0.5)).toBe('12:00')
    expect(toTime('0.5')).toBe('12:00')
    expect(toTime('.75')).toBe('18:00')
  })

  it('rechaza horas y minutos fuera de rango', () => {
    expect(toTime('25:00')).toBeNull()
    expect(toTime('12:60')).toBeNull()
  })

  it('devuelve null con vacío y basura', () => {
    expect(toTime('')).toBeNull()
    expect(toTime('a las tres')).toBeNull()
    expect(toTime(null)).toBeNull()
  })
})

describe('toInt', () => {
  it('convierte enteros en cadena', () => {
    expect(toInt('45')).toBe(45)
  })

  it('acepta números', () => {
    expect(toInt(45)).toBe(45)
  })

  it('trunca decimales', () => {
    expect(toInt('45.7')).toBe(45)
  })

  it('devuelve null con vacío y basura', () => {
    expect(toInt('')).toBeNull()
    expect(toInt('cuarenta')).toBeNull()
    expect(toInt(null)).toBeNull()
  })
})

describe('toBool', () => {
  it('reconoce los afirmativos en español e inglés', () => {
    for (const v of ['si', 'sí', 'SI', 'Sí', 'yes', 'true', '1', 'TRUE']) {
      expect(toBool(v)).toBe(true)
    }
  })

  it('devuelve false para negativos, vacío y nulos', () => {
    for (const v of ['no', 'No', 'false', '0', '', null, undefined]) {
      expect(toBool(v)).toBe(false)
    }
  })

  it('acepta booleanos nativos', () => {
    expect(toBool(true)).toBe(true)
    expect(toBool(false)).toBe(false)
  })
})

describe('addMinutes', () => {
  it('suma dentro del mismo día', () => {
    expect(addMinutes('14:30', 45)).toBe('15:15')
  })

  it('cruza la medianoche envolviendo a las 24 horas', () => {
    expect(addMinutes('23:45', 30)).toBe('00:15')
  })

  it('devuelve la misma hora al sumar cero', () => {
    expect(addMinutes('09:00', 0)).toBe('09:00')
  })

  it('devuelve null si falta la hora o la duración', () => {
    expect(addMinutes(null, 30)).toBeNull()
    expect(addMinutes('14:30', null)).toBeNull()
  })

  it('devuelve null con una hora mal formada', () => {
    expect(addMinutes('14h30', 30)).toBeNull()
  })

  it('no depende de la zona horaria del proceso', () => {
    // Protege contra el bug de WF-2. Este test recalcula con el TZ del proceso
    // ya fijado; la verificación cruzada real la hace el paso B4 corriendo la
    // suite con TZ=UTC y con TZ=America/Bogota.
    expect(addMinutes('23:45', 30)).toBe('00:15')
    expect(addMinutes('00:10', 1430)).toBe('00:00')
  })
})

describe('trimOrNull', () => {
  it('recorta espacios', () => {
    expect(trimOrNull('  hola  ')).toBe('hola')
  })

  it('devuelve null con vacío, solo espacios, null y undefined', () => {
    expect(trimOrNull('')).toBeNull()
    expect(trimOrNull('   ')).toBeNull()
    expect(trimOrNull(null)).toBeNull()
    expect(trimOrNull(undefined)).toBeNull()
  })
})
```

- [ ] Ejecutar el test para verificar que falla:

Run: `npm test -- coerce`
Expected: FAIL — no se puede resolver `../coerce` (el módulo no existe).

### B3 — Implementar `coerce.ts`

- [ ] Crear `src/lib/ingest/coerce.ts`:

```ts
/**
 * Coerciones de tipos para la ingesta de archivos.
 *
 * Reglas de este módulo (spec `normalizacion-filas` R1, R9, R10):
 *   - sin DOM, sin red
 *   - ningún cálculo depende de la zona horaria del proceso: los componentes de
 *     fecha se leen en UTC y las horas se manipulan como minutos enteros
 */

/** Excel cuenta los días desde este instante (con el bug del año 1900 incluido). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const probe = new Date(Date.UTC(year, month - 1, day))
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
}

function utcYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/**
 * Acepta ISO (`YYYY-MM-DD` o timestamp), serial de Excel, `DD/MM/YYYY` y
 * objetos Date. Devuelve `YYYY-MM-DD` o null.
 *
 * No usa `new Date(string)` como último recurso: para cadenas ambiguas el
 * resultado dependería de la zona horaria del proceso.
 */
export function toDate(v: unknown): string | null {
  if (v === null || v === undefined) return null

  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : utcYmd(v)
  }

  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return null
    return utcYmd(new Date(EXCEL_EPOCH_MS + Math.floor(v) * 86400000))
  }

  const s = String(v).trim()
  if (s === '') return null

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const [, y, m, d] = iso
    return isValidYmd(Number(y), Number(m), Number(d)) ? `${y}-${m}-${d}` : null
  }

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (!Number.isFinite(n) || n <= 0) return null
    return utcYmd(new Date(EXCEL_EPOCH_MS + Math.floor(n) * 86400000))
  }

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3])
    if (!isValidYmd(year, month, day)) return null
    return `${year}-${pad2(month)}-${pad2(day)}`
  }

  return null
}

/** Acepta `HH:MM[:SS]` y fracción de día de Excel. Devuelve `HH:MM` o null. */
export function toTime(v: unknown): string | null {
  if (v === null || v === undefined) return null

  if (typeof v === 'number') {
    if (!(v >= 0 && v < 1)) return null
    const total = Math.round(v * 1440)
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
  }

  const s = String(v).trim()
  if (s === '') return null

  const hm = s.match(/^(\d{1,2}):(\d{2})/)
  if (hm) {
    const h = Number(hm[1])
    const m = Number(hm[2])
    if (h > 23 || m > 59) return null
    return `${pad2(h)}:${pad2(m)}`
  }

  if (/^\d?\.\d+$/.test(s)) {
    const f = Number(s)
    if (!(f >= 0 && f < 1)) return null
    const total = Math.round(f * 1440)
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
  }

  return null
}

export function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null
  const s = String(v).trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

const AFIRMATIVOS = new Set(['si', 'sí', 'yes', 'true', '1'])

export function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (v === null || v === undefined) return false
  return AFIRMATIVOS.has(String(v).trim().toLowerCase())
}

/**
 * Suma minutos a `HH:MM` con aritmética entera, envolviendo a las 24 horas.
 * Reemplaza el cálculo de hora_fin de WF-2, que dependía de la zona horaria.
 */
export function addMinutes(hhmm: string | null, minutes: number | null): string | null {
  if (hhmm === null || minutes === null) return null
  if (!Number.isFinite(minutes)) return null

  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null

  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null

  const raw = (h * 60 + mi + Math.trunc(minutes)) % 1440
  const total = raw < 0 ? raw + 1440 : raw
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
}
```

- [ ] Ejecutar el test para verificar que pasa:

Run: `npm test -- coerce`
Expected: PASS, todos los casos.

### B4 — Verificar independencia de zona horaria

- [ ] Correr la suite de `coerce` bajo las dos zonas horarias relevantes (navegador en Colombia, Worker en UTC):

Run: `TZ=UTC npm test -- coerce && TZ=America/Bogota npm test -- coerce`
Expected: PASS en ambas, con el mismo número de tests. Si alguna difiere, hay un `Date` local escondido en la implementación.

- [ ] Verificar lint y typecheck:

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores.

### B5 — Commit de la Work Unit B

- [ ] Commit:

```bash
git add src/lib/ingest/types.ts src/lib/ingest/coerce.ts src/lib/ingest/__tests__/coerce.test.ts
git commit -m "feat(ingest): contratos compartidos y coerciones de tipos

Rescata de n8n/WF-3 las coerciones que vivian minificadas dentro del
JSON del workflow, ahora con tests: seriales de Excel, fracciones de
dia, booleanos en espanol.

addMinutes reemplaza el calculo de hora_fin de WF-2, que usaba new Date
y getHours y por tanto daba resultados distintos en el navegador
(America/Bogota) y en el Worker (UTC). La suite corre bajo ambas TZ."
```

---

## Work Unit C — Match tolerante de encabezados

Files: `src/lib/ingest/columns.ts` (CREATE), `src/lib/ingest/__tests__/columns.test.ts` (CREATE)
Spec: `normalizacion-filas` — R11–R14
Sequential: C1 → C2 → C3
Dependency: ninguna (independiente de B; puede ir en paralelo)

**Interfaces:**
- Consumes: `RawRow` de `src/lib/ingest/types.ts`.
- Produces: `col(row: RawRow, ...candidatos: string[]): string | null` y `normKey(s: string): string`.

### C1 — Escribir el test rojo de `columns`

- [ ] Crear `src/lib/ingest/__tests__/columns.test.ts`:

```ts
/**
 * Match tolerante de encabezados.
 *
 * El .xlsx de registro de sesión tiene encabezados largos e inestables: con
 * acentos, espacios dobles, espacio final, sufijos entre paréntesis y a veces
 * un dígito pegado (`Categoría del caso (Potencia)1`). Este helper viene del
 * nodo `Normalize Rows` de n8n/WF-3, donde estaba minificado y sin tests.
 */
import { describe, it, expect } from 'vitest'
import { col, normKey } from '../columns'

describe('normKey', () => {
  it('quita acentos, baja a minúsculas y recorta', () => {
    expect(normKey('  Fecha de la Sesión  ')).toBe('fecha de la sesion')
  })

  it('colapsa espacios repetidos y no separables', () => {
    expect(normKey('Motivo  de la   Consulta')).toBe('motivo de la consulta')
  })

  it('unifica guiones tipográficos con el guion simple', () => {
    expect(normKey('Estado Inicial – Antes')).toBe('estado inicial - antes')
    expect(normKey('Estado Inicial — Antes')).toBe('estado inicial - antes')
  })
})

describe('col', () => {
  it('encuentra la columna por nombre exacto', () => {
    expect(col({ Pregunta: 'hola' }, 'Pregunta')).toBe('hola')
  })

  it('encuentra la columna ignorando acentos y mayúsculas', () => {
    expect(col({ 'FECHA DE LA SESION': '2026-09-15' }, 'Fecha de la Sesión')).toBe('2026-09-15')
  })

  it('encuentra la columna con espacio final en el encabezado real', () => {
    expect(col({ 'Entregables Producidos ': 'un informe' }, 'Entregables Producidos')).toBe('un informe')
  })

  it('encuentra la columna con espacios dobles en el encabezado real', () => {
    expect(col({ 'Motivo  de la  Consulta': 'flujo de caja' }, 'Motivo de la Consulta')).toBe('flujo de caja')
  })

  it('encuentra la columna cuando el encabezado real trae un sufijo entre paréntesis', () => {
    const row = { 'Acciones Realizadas Durante la Sesión (Describir paso a paso)': 'se hizo X' }
    expect(col(row, 'Acciones Realizadas Durante la Sesión')).toBe('se hizo X')
  })

  it('encuentra la columna con paréntesis pegado y dígito al final', () => {
    const row = { 'Categoría del caso (Potencia)1': 'Alto' }
    expect(col(row, 'Categoría del caso')).toBe('Alto')
  })

  it('encuentra la columna cuando el encabezado real trae un sufijo tras un guion', () => {
    const row = { 'Estado Inicial – Situación Antes de la Intervención': 'sin proceso' }
    expect(col(row, 'Estado Inicial')).toBe('sin proceso')
  })

  it('prueba los candidatos en orden y devuelve el primero con valor', () => {
    const row = { 'Correo electrónico': 'b@x.com' }
    expect(col(row, 'Correo del Usuario Atendido', 'Correo electrónico', 'email')).toBe('b@x.com')
  })

  it('salta un candidato cuya columna existe pero está vacía', () => {
    const row = { 'Correo del Usuario Atendido': '   ', 'Correo electrónico': 'b@x.com' }
    expect(col(row, 'Correo del Usuario Atendido', 'Correo electrónico')).toBe('b@x.com')
  })

  it('recorta el valor devuelto', () => {
    expect(col({ Pregunta: '  hola  ' }, 'Pregunta')).toBe('hola')
  })

  it('devuelve null cuando ningún candidato coincide', () => {
    expect(col({ Otra: 'x' }, 'Pregunta', 'pregunta')).toBeNull()
  })

  it('devuelve null con una fila vacía', () => {
    expect(col({}, 'Pregunta')).toBeNull()
  })

  it('no confunde un prefijo con una columna distinta que solo lo contiene', () => {
    // 'Duración' no debe resolver a 'Duración de la Sesión' por contención
    // arbitraria: solo por sufijo delimitado (paréntesis o guion).
    expect(col({ 'Duración total acumulada': '90' }, 'Duración')).toBeNull()
  })

  it('convierte números a cadena', () => {
    expect(col({ 'Cantidad de nuevos productos creados': 3 }, 'Cantidad de nuevos productos creados')).toBe('3')
  })
})
```

- [ ] Ejecutar el test para verificar que falla:

Run: `npm test -- columns`
Expected: FAIL — no se puede resolver `../columns`.

### C2 — Implementar `columns.ts`

- [ ] Crear `src/lib/ingest/columns.ts`:

```ts
import type { RawRow } from './types'

/**
 * Normaliza un encabezado para comparar: sin acentos, minúsculas, espacios
 * colapsados, guiones tipográficos unificados.
 */
export function normKey(s: string): string {
  return String(s)
    .replace(/[–—]/g, '-')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function valorUtil(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * Busca el valor de la primera columna que coincida con alguno de los
 * candidatos, en orden. Una columna presente pero vacía no cuenta como
 * encontrada: se sigue con el siguiente candidato.
 *
 * El match por prefijo solo acepta sufijos delimitados — `nombre (`, `nombre(`
 * o `nombre -` — para no resolver `Duración` a `Duración total acumulada`.
 */
export function col(row: RawRow, ...candidatos: string[]): string | null {
  const porClaveNormalizada = new Map<string, unknown>()
  for (const clave of Object.keys(row)) {
    if (valorUtil(row[clave]) !== null) {
      porClaveNormalizada.set(normKey(clave), row[clave])
    }
  }

  for (const candidato of candidatos) {
    const directo = valorUtil(row[candidato])
    if (directo !== null) return directo

    const nk = normKey(candidato)

    const exacto = porClaveNormalizada.get(nk)
    if (exacto !== undefined) {
      const v = valorUtil(exacto)
      if (v !== null) return v
    }

    for (const [clave, valor] of porClaveNormalizada) {
      if (clave.startsWith(`${nk} (`) || clave.startsWith(`${nk}(`) || clave.startsWith(`${nk} -`)) {
        const v = valorUtil(valor)
        if (v !== null) return v
      }
    }
  }

  return null
}
```

- [ ] Ejecutar el test para verificar que pasa:

Run: `npm test -- columns`
Expected: PASS, todos los casos.

- [ ] Verificar lint y typecheck:

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores.

### C3 — Commit de la Work Unit C

- [ ] Commit:

```bash
git add src/lib/ingest/columns.ts src/lib/ingest/__tests__/columns.test.ts
git commit -m "feat(ingest): match tolerante de encabezados

Rescata el helper col() del nodo Normalize Rows de n8n/WF-3, donde
estaba minificado en una linea y sin tests. Tolera acentos, espacios
dobles, espacio final, guiones tipograficos y sufijos delimitados como
'Categoria del caso (Potencia)1'.

El match por prefijo exige sufijo delimitado para no resolver
'Duracion' a 'Duracion total acumulada'."
```

---

## Work Unit D — Normalizador de bookings `.tsv`

Files: `src/lib/ingest/bookings.ts` (CREATE), `src/lib/ingest/__tests__/bookings.test.ts` (CREATE)
Spec: `normalizacion-filas` — R15–R27
Sequential: D1 → D2 → D3 → D4
Dependency: B3 (`coerce`) y C2 (`columns`)

**Interfaces:**
- Consumes: `toDate`, `toTime`, `toInt`, `addMinutes` de `./coerce`; `col`, `normKey` de `./columns`; tipos de `./types`.

**Ojo con R24 y R25:** el spec los lista bajo `bookings.ts`, pero la búsqueda del consultor contra la tabla `consultores` **no** ocurre acá — el normalizador es puro y no toca la base. Vive en el RPC (Work Unit F), que resuelve `email_institucional` → `email` → `nombre` y emite el aviso cuando no hay match. Lo que sí produce este módulo es un aviso distinto: cuando el archivo **no trae staff en absoluto**.
- Produces:
  - `parseTsv(text: string): RawRow[]`
  - `headersLookLikeBookings(headers: string[]): boolean`
  - `normalizeBookingRow(raw: RawRow, fila: number): NormalizeResult<NormalizedBookingRow>`
  - `EXPECTED_BOOKING_HEADERS: readonly string[]`

### D1 — Escribir el test rojo de `bookings`

- [ ] Crear `src/lib/ingest/__tests__/bookings.test.ts`:

```ts
/**
 * Normalizador del .tsv de Microsoft Bookings.
 *
 * Reemplaza los nodos `Parse TSV Direct` y `Transform Bookings Row` de
 * n8n/WF-2. Correcciones deliberadas respecto a WF-2:
 *   - WF-2 solo filtraba por correo presente: una fecha ilegible producía
 *     fecha: null, que viola el NOT NULL de consultorias.fecha sin reporte
 *   - WF-2 aceptaba mes > 12 sin validar
 *   - WF-2 calculaba hora_fin con new Date + getHours (dependiente de TZ)
 */
import { describe, it, expect } from 'vitest'
import {
  parseTsv,
  headersLookLikeBookings,
  normalizeBookingRow,
} from '../bookings'

const HEADERS = [
  'Date Time',
  'Customer Name',
  'Customer Email',
  'Customer Phone',
  'Staff Name',
  'Staff Email',
  'Service',
  'Duration (mins.)',
  'Booking Id',
  'Custom Fields',
].join('\t')

function fila(valores: Partial<Record<string, string>> = {}): Record<string, unknown> {
  return {
    'Date Time': '15/09/2026 14:30',
    'Customer Name': 'Ana Pérez',
    'Customer Email': 'ana@empresa.com',
    'Customer Phone': '+57 300 1234567',
    'Staff Name': 'Carlos Consultor',
    'Staff Email': 'carlos@camarabaq.org.co',
    'Service': 'Consultoría PotencIA',
    'Duration (mins.)': '60',
    'Booking Id': 'BK-001',
    'Custom Fields': '',
    ...valores,
  }
}

describe('parseTsv', () => {
  it('usa la fila 0 como encabezados y devuelve un objeto por fila de datos', () => {
    const texto = `${HEADERS}\n15/09/2026 14:30\tAna Pérez\tana@empresa.com\t3001234567\tCarlos\tcarlos@x.co\tConsultoría\t60\tBK-001\t`
    const filas = parseTsv(texto)
    expect(filas).toHaveLength(1)
    expect(filas[0]!['Customer Email']).toBe('ana@empresa.com')
    expect(filas[0]!['Booking Id']).toBe('BK-001')
  })

  it('descarta líneas vacías', () => {
    const texto = `${HEADERS}\n\n15/09/2026 14:30\tAna\ta@x.com\t\t\t\t\t\t\t\n\n`
    expect(parseTsv(texto)).toHaveLength(1)
  })

  it('tolera líneas con menos columnas que encabezados', () => {
    const texto = `${HEADERS}\n15/09/2026 14:30\tAna\ta@x.com`
    const filas = parseTsv(texto)
    expect(filas[0]!['Customer Email']).toBe('a@x.com')
    expect(filas[0]!['Booking Id']).toBe('')
  })

  it('devuelve vacío si no hay filas de datos', () => {
    expect(parseTsv(HEADERS)).toEqual([])
    expect(parseTsv('')).toEqual([])
  })

  it('acepta terminaciones de línea CRLF', () => {
    const texto = `${HEADERS}\r\n15/09/2026 14:30\tAna\ta@x.com\r\n`
    expect(parseTsv(texto)).toHaveLength(1)
  })
})

describe('headersLookLikeBookings', () => {
  it('reconoce los encabezados del export de Bookings', () => {
    expect(headersLookLikeBookings(HEADERS.split('\t'))).toBe(true)
  })

  it('rechaza los encabezados del Excel de registro de sesión', () => {
    const sesion = ['Id', 'Fecha de la Sesión', 'Correo del Usuario Atendido', 'Pregunta']
    expect(headersLookLikeBookings(sesion)).toBe(false)
  })

  it('rechaza una lista vacía', () => {
    expect(headersLookLikeBookings([])).toBe(false)
  })
})

describe('normalizeBookingRow', () => {
  it('normaliza una fila completa', () => {
    const r = normalizeBookingRow(fila(), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.fila).toBe(2)
    expect(r.row.clave).toBe('BK-001')
    expect(r.row.lead.p_email).toBe('ana@empresa.com')
    expect(r.row.lead.p_booking_email).toBe('ana@empresa.com')
    expect(r.row.lead.p_booking_customer_id).toBe('BK-001')
    expect(r.row.lead.p_nombre_completo).toBe('Ana Pérez')
    expect(r.row.lead.p_origen).toBe('booking')
    expect(r.row.consultoria.fecha).toBe('2026-09-15')
    expect(r.row.consultoria.hora_inicio).toBe('14:30')
    expect(r.row.consultoria.hora_fin).toBe('15:30')
    expect(r.row.consultoria.duracion_minutos).toBe(60)
    expect(r.row.consultoria.booking_id).toBe('BK-001')
    expect(r.row.consultoria.servicio).toBe('Consultoría PotencIA')
    expect(r.row.consultoria.status).toBe('Agendado')
    expect(r.avisos).toEqual([])
  })

  it('baja el correo a minúsculas', () => {
    const r = normalizeBookingRow(fila({ 'Customer Email': 'ANA@Empresa.COM' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.lead.p_email).toBe('ana@empresa.com')
  })

  it('acepta un día mayor a 12 (formato colombiano)', () => {
    const r = normalizeBookingRow(fila({ 'Date Time': '25/09/2026 09:00' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.fecha).toBe('2026-09-25')
  })

  it('rechaza la fila con mes mayor a 12', () => {
    const r = normalizeBookingRow(fila({ 'Date Time': '31/13/2026 10:00' }), 51)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.fila).toBe(51)
    expect(r.errores.some((e) => /ilegible/i.test(e.motivo))).toBe(true)
  })

  it('rechaza la fila sin correo', () => {
    const r = normalizeBookingRow(fila({ 'Customer Email': '' }), 34)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errores.some((e) => /correo/i.test(e.motivo))).toBe(true)
  })

  it('rechaza la fila con correo sin arroba', () => {
    const r = normalizeBookingRow(fila({ 'Customer Email': 'ana.empresa.com' }), 34)
    expect(r.ok).toBe(false)
  })

  it('nunca incluye datos personales en el motivo del error', () => {
    const r = normalizeBookingRow(fila({ 'Customer Email': 'ana.perez@empresa.com' , 'Date Time': 'xx' }), 34)
    expect(r.ok).toBe(false)
    if (r.ok) return
    for (const e of r.errores) {
      expect(e.motivo).not.toContain('ana.perez@empresa.com')
      expect(e.motivo).not.toContain('Ana Pérez')
    }
  })

  it('extrae modalidad Presencial de Custom Fields', () => {
    const cf = JSON.stringify({ 'Selecciona la Modalidad de tu sesión': 'Presencial en sede' })
    const r = normalizeBookingRow(fila({ 'Custom Fields': cf }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Presencial')
  })

  it('extrae modalidad Virtual de Custom Fields', () => {
    const cf = JSON.stringify({ 'Selecciona la Modalidad de tu sesión': 'Virtual por Teams' })
    const r = normalizeBookingRow(fila({ 'Custom Fields': cf }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Virtual')
  })

  it('resuelve a Virtual con Custom Fields ausente', () => {
    const r = normalizeBookingRow(fila({ 'Custom Fields': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Virtual')
  })

  it('resuelve a Virtual con Custom Fields que no es JSON válido', () => {
    const r = normalizeBookingRow(fila({ 'Custom Fields': '{no json' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Virtual')
  })

  it('calcula hora_fin cruzando la medianoche', () => {
    const r = normalizeBookingRow(fila({ 'Date Time': '15/09/2026 23:45', 'Duration (mins.)': '30' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.hora_fin).toBe('00:15')
  })

  it('deja hora_fin en null y avisa cuando falta la duración', () => {
    const r = normalizeBookingRow(fila({ 'Duration (mins.)': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.hora_fin).toBeNull()
    expect(r.row.consultoria.duracion_minutos).toBeNull()
    expect(r.avisos.some((a) => /duraci/i.test(a.motivo))).toBe(true)
  })

  it('avisa cuando la reserva no trae staff, sin bloquear la fila', () => {
    const r = normalizeBookingRow(fila({ 'Staff Name': '', 'Staff Email': '' }), 97)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.staff_email).toBeNull()
    expect(r.row.consultoria.staff_name).toBeNull()
    expect(r.avisos.some((a) => a.severidad === 'aviso' && /staff/i.test(a.motivo))).toBe(true)
  })

  it('usa la clave de fallback cuando falta el Booking Id', () => {
    const r = normalizeBookingRow(fila({ 'Booking Id': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.clave).toBe('ana@empresa.com|2026-09-15|14:30')
    expect(r.row.consultoria.booking_id).toBeNull()
  })

  it('copia Service en servicio y en categoria_caso_uso', () => {
    const r = normalizeBookingRow(fila(), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.servicio).toBe('Consultoría PotencIA')
    expect(r.row.consultoria.categoria_caso_uso).toBe('Consultoría PotencIA')
  })

  it('baja el staff_email a minúsculas', () => {
    const r = normalizeBookingRow(fila({ 'Staff Email': 'Carlos@CamaraBAQ.ORG.CO' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.staff_email).toBe('carlos@camarabaq.org.co')
  })
})
```

- [ ] Ejecutar el test para verificar que falla:

Run: `npm test -- bookings`
Expected: FAIL — no se puede resolver `../bookings`.

### D2 — Implementar `bookings.ts`

- [ ] Crear `src/lib/ingest/bookings.ts`:

```ts
import { addMinutes, toDate, toInt, toTime } from './coerce'
import { col, normKey } from './columns'
import type {
  NormalizeResult,
  NormalizedBookingRow,
  RawRow,
  RowIssue,
} from './types'

/**
 * Encabezados mínimos que identifican el export de Microsoft Bookings.
 * Se usan para rechazar el archivo completo cuando corresponde al otro tipo
 * de carga, en vez de dejar que fallen 142 filas una por una.
 */
export const EXPECTED_BOOKING_HEADERS: readonly string[] = [
  'Customer Email',
  'Date Time',
]

export function headersLookLikeBookings(headers: string[]): boolean {
  const presentes = new Set(headers.map((h) => normKey(h)))
  return EXPECTED_BOOKING_HEADERS.every((h) => presentes.has(normKey(h)))
}

/** Parsea el .tsv crudo: tabs, sin quotes, fila 0 = encabezados. */
export function parseTsv(text: string): RawRow[] {
  const lineas = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lineas.length < 2) return []

  const encabezados = lineas[0]!.split('\t').map((h) => h.trim())

  return lineas.slice(1).map((linea) => {
    const valores = linea.split('\t')
    const fila: RawRow = {}
    encabezados.forEach((h, i) => {
      fila[h] = (valores[i] ?? '').trim()
    })
    return fila
  })
}

/**
 * `Date Time` del export colombiano viene como `DD/MM/YYYY H:MM` — día
 * primero. Delega la validación de rangos a toDate/toTime.
 */
function parseBookingDateTime(s: string): { fecha: string; hora: string } | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/)
  if (!m) return null

  const fecha = toDate(`${m[1]}/${m[2]}/${m[3]}`)
  if (fecha === null) return null

  const hora = toTime(`${m[4]}:${m[5]}`)
  if (hora === null) return null

  return { fecha, hora }
}

/** `Custom Fields` es un JSON con la modalidad elegida en el formulario. */
function extraerModalidad(customFields: string | null): 'Virtual' | 'Presencial' {
  if (customFields === null) return 'Virtual'
  try {
    const obj = JSON.parse(customFields) as Record<string, unknown>
    const valor = obj['Selecciona la Modalidad de tu sesión']
    return typeof valor === 'string' && /presencial/i.test(valor) ? 'Presencial' : 'Virtual'
  } catch {
    return 'Virtual'
  }
}

export function normalizeBookingRow(
  raw: RawRow,
  fila: number,
): NormalizeResult<NormalizedBookingRow> {
  const errores: RowIssue[] = []
  const avisos: RowIssue[] = []

  const emailRaw = col(raw, 'Customer Email')
  const email = emailRaw === null ? null : emailRaw.toLowerCase()
  if (email === null || !email.includes('@')) {
    errores.push({ fila, severidad: 'error', motivo: 'Correo del cliente ausente o inválido' })
  }

  const dtRaw = col(raw, 'Date Time')
  const dt = dtRaw === null ? null : parseBookingDateTime(dtRaw)
  if (dt === null) {
    errores.push({
      fila,
      severidad: 'error',
      motivo: dtRaw === null
        ? 'Falta la fecha y hora de la reserva'
        : 'Fecha y hora de la reserva ilegible',
    })
  }

  if (errores.length > 0 || email === null || dt === null) {
    return { ok: false, fila, errores }
  }

  const duracion = toInt(col(raw, 'Duration (mins.)', 'Duration'))
  if (duracion === null) {
    avisos.push({
      fila,
      severidad: 'aviso',
      motivo: 'Sin duración en el archivo: no se pudo calcular la hora de fin',
    })
  }

  const staffEmailRaw = col(raw, 'Staff Email')
  const staffEmail = staffEmailRaw === null ? null : staffEmailRaw.toLowerCase()
  const staffName = col(raw, 'Staff Name', 'Staff')
  if (staffEmail === null && staffName === null) {
    avisos.push({
      fila,
      severidad: 'aviso',
      motivo: 'La reserva no trae staff: la consultoría quedará sin consultor asignado',
    })
  }

  const bookingId = col(raw, 'Booking Id')
  const servicio = col(raw, 'Service')

  return {
    ok: true,
    avisos,
    row: {
      fila,
      clave: bookingId ?? `${email}|${dt.fecha}|${dt.hora}`,
      lead: {
        p_email: email,
        p_nombre_completo: col(raw, 'Customer Name') ?? 'Sin nombre',
        p_phone: col(raw, 'Customer Phone'),
        p_id_num: null,
        p_nit: null,
        p_city: null,
        p_cargo: null,
        p_company_role_level: null,
        p_company_role_area: null,
        p_sector: null,
        p_empresa: null,
        p_sexo: null,
        p_booking_email: email,
        p_booking_customer_id: bookingId,
        p_origen: 'booking',
      },
      consultoria: {
        booking_id: bookingId,
        fecha: dt.fecha,
        hora_inicio: dt.hora,
        hora_fin: addMinutes(dt.hora, duracion),
        duracion_minutos: duracion,
        modalidad: extraerModalidad(col(raw, 'Custom Fields')),
        servicio,
        staff_name: staffName,
        staff_email: staffEmail,
        nivel_potencia: null,
        categoria_caso: null,
        categoria_caso_uso: servicio,
        status: 'Agendado',
      },
    },
  }
}
```

- [ ] Ejecutar el test para verificar que pasa:

Run: `npm test -- bookings`
Expected: PASS, todos los casos.

### D3 — Verificar independencia de zona horaria y calidad

- [ ] Correr bajo las dos zonas horarias:

Run: `TZ=UTC npm test -- bookings && TZ=America/Bogota npm test -- bookings`
Expected: PASS en ambas, con el mismo número de tests.

- [ ] Verificar que el módulo no usa APIs prohibidas:

Run: `grep -nE "document|window|fetch|getHours|getMinutes|getFullYear|toLocale" src/lib/ingest/bookings.ts src/lib/ingest/coerce.ts src/lib/ingest/columns.ts`
Expected: sin resultados (exit 1). Solo se permiten los getters UTC dentro de `coerce.ts`.

- [ ] Verificar lint y typecheck:

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores.

### D4 — Commit de la Work Unit D

- [ ] Commit:

```bash
git add src/lib/ingest/bookings.ts src/lib/ingest/__tests__/bookings.test.ts
git commit -m "feat(ingest): normalizador del .tsv de bookings

Reemplaza los nodos Parse TSV Direct y Transform Bookings Row de
n8n/WF-2, con tres correcciones deliberadas:
- una fecha ilegible ahora bloquea la fila con motivo, en vez de
  producir fecha null que viola el NOT NULL de consultorias.fecha
- valida que el mes sea 1-12 (WF-2 aceptaba cualquier numero)
- hora_fin se calcula con aritmetica entera, no con new Date +
  getHours, que daba resultados distintos en navegador y Worker

El staff ausente produce aviso, no error: la fila entra y se reporta."
```

---

## Work Unit E — Normalizador de registro de sesión `.xlsx`

Files: `src/lib/ingest/sesiones.ts` (CREATE), `src/lib/ingest/__tests__/sesiones.test.ts` (CREATE)
Spec: `normalizacion-filas` — R28–R36, R31b
Sequential: E1 → E2 → E3 → E4
Dependency: B3 (`coerce`) y C2 (`columns`)

**Interfaces:**
- Consumes: `toDate`, `toTime`, `toInt`, `toBool` de `./coerce`; `col`, `normKey` de `./columns`; tipos de `./types`.
- Produces:
  - `mapResultadoAStatus(resultado: string | null): ConsultoriaStatus | null`
  - `headersLookLikeSesiones(headers: string[]): boolean`
  - `normalizeSesionRow(raw: RawRow, fila: number): NormalizeResult<NormalizedSesionRow>`
  - `EXPECTED_SESION_HEADERS: readonly string[]`

### E1 — Escribir el test rojo de `sesiones`

- [ ] Crear `src/lib/ingest/__tests__/sesiones.test.ts`:

```ts
/**
 * Normalizador del .xlsx de registro de sesión.
 *
 * Reemplaza el nodo `Normalize Rows` de n8n/WF-3 y unifica su mapeo de estados
 * con el del nodo `Map Session Status`, que producían resultados distintos
 * entre sí (exploration.md §2 D-3).
 */
import { describe, it, expect } from 'vitest'
import {
  mapResultadoAStatus,
  headersLookLikeSesiones,
  normalizeSesionRow,
} from '../sesiones'

function fila(valores: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    'Id': 'SES-001',
    'Fecha de la Sesión': '2026-09-15',
    'Nombre del Usuario Atendido': 'Ana Pérez',
    'Correo del Usuario Atendido': 'ana@empresa.com',
    'Celular del usuario atendido': '3001234567',
    'Cedula del Usuario Atendido': '1234567890',
    'Nit de la Empresa': '900123456',
    'Municipio': 'Barranquilla',
    'Cargo del Usuario Atendido': 'Gerente',
    'Nivel del Cargo': 'Directivo',
    'Área del Usuario Atendido': 'Operaciones',
    'Nombre de la empresa': 'Empresa SAS',
    'Sexo Usuario Atendido': 'F',
    'Hora de inicio': '14:00',
    'Hora de finalización': '15:00',
    'Duración de la Sesión / Minutos': '60',
    'Modalidad de la Sesión': 'Virtual',
    'Consultor / Coder': 'Carlos Consultor',
    'Correo Institucional / Consultor': 'carlos@camarabaq.org.co',
    'Nivel de potencia': 'Alto',
    'Categoría del caso (Potencia)1': 'Automatización',
    'Categoria del Caso de Uso': 'Agentes',
    'Pregunta': '¿Cómo automatizo mi facturación?',
    'Motivo de la Consulta': 'Proceso manual',
    'Estado Inicial – Situación Antes de la Intervención': 'Todo en Excel',
    'Acciones Realizadas Durante la Sesión (Describir paso a paso lo trabajado)': 'Se construyó un flujo',
    'Resultado Final – Situación Después de la Intervención': 'Flujo funcionando',
    'Estimación del Impacto Generado': '10 horas al mes',
    'Entregables Producidos': 'Plantilla y guía',
    'Cantidad de nuevos productos creados': '2',
    '¿La sesión fue grabada?': 'Si',
    'Enlace de Grabación': 'https://ejemplo.co/video',
    'Adjuntar Evidencia': 'https://ejemplo.co/evidencia',
    'Confirmo que este caso NO corresponde a automatización o integración de sistemas complejos.': 'Si',
    'Resultado de la sesión': 'Caso resuelto en la sesión',
    ...valores,
  }
}

describe('mapResultadoAStatus', () => {
  it('mapea los siete estados desde el texto del resultado', () => {
    expect(mapResultadoAStatus('Caso resuelto en la sesión')).toBe('Resuelto')
    expect(mapResultadoAStatus('Queda en seguimiento')).toBe('En seguimiento')
    expect(mapResultadoAStatus('La sesión fue cancelada, cancelado por el cliente')).toBe('Cancelado')
    expect(mapResultadoAStatus('El usuario no asistió a la sesión')).toBe('No asistió')
    expect(mapResultadoAStatus('Hay que escalar el caso')).toBe('Escalar')
  })

  it('no distingue mayúsculas', () => {
    expect(mapResultadoAStatus('RESUELTO')).toBe('Resuelto')
    expect(mapResultadoAStatus('NO ASISTIÓ')).toBe('No asistió')
  })

  it('reconoce no asistió con y sin tilde', () => {
    expect(mapResultadoAStatus('no asistio')).toBe('No asistió')
    expect(mapResultadoAStatus('no asistió')).toBe('No asistió')
  })

  it('prefiere el patrón más específico cuando hay varios', () => {
    // 'no asistió' gana sobre 'seguimiento'
    expect(mapResultadoAStatus('No asistió, queda en seguimiento')).toBe('No asistió')
    // 'cancelado' gana sobre 'resuelto'
    expect(mapResultadoAStatus('Cancelado, no se resuelto nada')).toBe('Cancelado')
  })

  it('usa Resuelto como valor por defecto cuando hay texto no reconocido', () => {
    expect(mapResultadoAStatus('Se hizo la sesión completa')).toBe('Resuelto')
  })

  it('devuelve null con resultado vacío, en blanco o nulo (R31b)', () => {
    expect(mapResultadoAStatus('')).toBeNull()
    expect(mapResultadoAStatus('   ')).toBeNull()
    expect(mapResultadoAStatus(null)).toBeNull()
  })
})

describe('headersLookLikeSesiones', () => {
  it('reconoce los encabezados del Excel de sesión', () => {
    expect(headersLookLikeSesiones(['Fecha de la Sesión', 'Correo del Usuario Atendido'])).toBe(true)
  })

  it('reconoce la variante con Correo electrónico', () => {
    expect(headersLookLikeSesiones(['Fecha', 'Correo electrónico'])).toBe(true)
  })

  it('rechaza los encabezados del .tsv de bookings', () => {
    const bookings = ['Date Time', 'Customer Name', 'Customer Email', 'Booking Id']
    expect(headersLookLikeSesiones(bookings)).toBe(false)
  })
})

describe('normalizeSesionRow', () => {
  it('normaliza una fila completa', () => {
    const r = normalizeSesionRow(fila(), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(r.row.clave).toBe('SES-001')
    expect(r.row.lead.p_email).toBe('ana@empresa.com')
    expect(r.row.lead.p_nombre_completo).toBe('Ana Pérez')
    expect(r.row.lead.p_id_num).toBe('1234567890')
    expect(r.row.lead.p_nit).toBe('900123456')
    expect(r.row.lead.p_city).toBe('Barranquilla')
    expect(r.row.lead.p_cargo).toBe('Gerente')
    expect(r.row.lead.p_company_role_level).toBe('Directivo')
    expect(r.row.lead.p_company_role_area).toBe('Operaciones')
    expect(r.row.lead.p_empresa).toBe('Empresa SAS')
    expect(r.row.lead.p_sexo).toBe('F')
    expect(r.row.lead.p_origen).toBe('sesion')

    expect(r.row.consultoria.fecha).toBe('2026-09-15')
    expect(r.row.consultoria.hora_inicio).toBe('14:00')
    expect(r.row.consultoria.hora_fin).toBe('15:00')
    expect(r.row.consultoria.duracion_minutos).toBe(60)
    expect(r.row.consultoria.modalidad).toBe('Virtual')
    expect(r.row.consultoria.staff_name).toBe('Carlos Consultor')
    expect(r.row.consultoria.staff_email).toBe('carlos@camarabaq.org.co')
    expect(r.row.consultoria.nivel_potencia).toBe('Alto')
    expect(r.row.consultoria.categoria_caso).toBe('Automatización')
    expect(r.row.consultoria.categoria_caso_uso).toBe('Agentes')
    expect(r.row.consultoria.status).toBe('Resuelto')

    expect(r.row.registro.id_externo).toBe('SES-001')
    expect(r.row.registro.pregunta).toBe('¿Cómo automatizo mi facturación?')
    expect(r.row.registro.motivo_consulta).toBe('Proceso manual')
    expect(r.row.registro.estado_inicial).toBe('Todo en Excel')
    expect(r.row.registro.acciones_realizadas).toBe('Se construyó un flujo')
    expect(r.row.registro.resultado_final).toBe('Flujo funcionando')
    expect(r.row.registro.estimacion_impacto).toBe('10 horas al mes')
    expect(r.row.registro.entregables).toBe('Plantilla y guía')
    expect(r.row.registro.cantidad_productos).toBe(2)
    expect(r.row.registro.sesion_grabada).toBe(true)
    expect(r.row.registro.enlace_grabacion).toBe('https://ejemplo.co/video')
    expect(r.row.registro.confirmo_no_automatizacion).toBe(true)
    expect(r.row.registro.duracion_sesion_minutos).toBe(60)
  })

  it('rechaza la fila sin correo', () => {
    const r = normalizeSesionRow(fila({ 'Correo del Usuario Atendido': '' }), 34)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.fila).toBe(34)
    expect(r.errores.some((e) => /correo/i.test(e.motivo))).toBe(true)
  })

  it('rechaza la fila con correo sin arroba', () => {
    const r = normalizeSesionRow(fila({ 'Correo del Usuario Atendido': 'ana.empresa.com' }), 34)
    expect(r.ok).toBe(false)
  })

  it('acepta la variante de encabezado Correo electrónico', () => {
    const base = fila()
    delete base['Correo del Usuario Atendido']
    base['Correo electrónico'] = 'otra@empresa.com'
    const r = normalizeSesionRow(base, 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.lead.p_email).toBe('otra@empresa.com')
  })

  it('rechaza la fila con fecha ilegible', () => {
    const r = normalizeSesionRow(fila({ 'Fecha de la Sesión': '-' }), 130)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errores.some((e) => /fecha/i.test(e.motivo))).toBe(true)
  })

  it('acepta un serial de Excel en la fecha', () => {
    const r = normalizeSesionRow(fila({ 'Fecha de la Sesión': 46280 }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.fecha).toBe('2026-09-15')
  })

  it('acepta una fracción de día en la hora de inicio', () => {
    const r = normalizeSesionRow(fila({ 'Hora de inicio': 0.5 }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.hora_inicio).toBe('12:00')
  })

  it('deja el status en null cuando el resultado viene vacío (R31b)', () => {
    const r = normalizeSesionRow(fila({ 'Resultado de la sesión': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.status).toBeNull()
    expect(r.row.registro.resultado).toBeNull()
  })

  it('usa la clave de fallback cuando falta la columna Id', () => {
    const r = normalizeSesionRow(fila({ 'Id': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.clave).toBe('ana@empresa.com|2026-09-15')
    expect(r.row.registro.id_externo).toBeNull()
  })

  it('resuelve a Virtual cuando falta la modalidad', () => {
    const r = normalizeSesionRow(fila({ 'Modalidad de la Sesión': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Virtual')
  })

  it('normaliza Presencial en la modalidad', () => {
    const r = normalizeSesionRow(fila({ 'Modalidad de la Sesión': 'presencial' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Presencial')
  })

  it('usa cero cuando falta la cantidad de productos', () => {
    const r = normalizeSesionRow(fila({ 'Cantidad de nuevos productos creados': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.registro.cantidad_productos).toBe(0)
  })

  it('encuentra las columnas con encabezados variantes y acentos', () => {
    const base = fila()
    delete base['Estado Inicial – Situación Antes de la Intervención']
    base['ESTADO INICIAL'] = 'sin proceso'
    const r = normalizeSesionRow(base, 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.registro.estado_inicial).toBe('sin proceso')
  })

  it('nunca incluye datos personales en el motivo del error', () => {
    const r = normalizeSesionRow(fila({ 'Correo del Usuario Atendido': 'ana.perez@empresa.com', 'Fecha de la Sesión': '-' }), 34)
    expect(r.ok).toBe(false)
    if (r.ok) return
    for (const e of r.errores) {
      expect(e.motivo).not.toContain('ana.perez@empresa.com')
    }
  })
})
```

- [ ] Ejecutar el test para verificar que falla:

Run: `npm test -- sesiones`
Expected: FAIL — no se puede resolver `../sesiones`.

### E2 — Implementar `sesiones.ts`

- [ ] Crear `src/lib/ingest/sesiones.ts`:

```ts
import type { ConsultoriaStatus } from '@/types'
import { toBool, toDate, toInt, toTime } from './coerce'
import { col, normKey } from './columns'
import type {
  NormalizeResult,
  NormalizedSesionRow,
  RawRow,
  RowIssue,
} from './types'

/**
 * Encabezados mínimos que identifican el Excel de registro de sesión.
 * Cada entrada es un grupo de variantes: basta con que una esté presente.
 */
const GRUPOS_SESION: readonly (readonly string[])[] = [
  ['Fecha de la Sesión', 'Fecha', 'fecha_sesion'],
  ['Correo del Usuario Atendido', 'Correo electrónico', 'email'],
]

export const EXPECTED_SESION_HEADERS: readonly string[] = GRUPOS_SESION.map((g) => g[0]!)

export function headersLookLikeSesiones(headers: string[]): boolean {
  const presentes = new Set(headers.map((h) => normKey(h)))
  return GRUPOS_SESION.every((grupo) => grupo.some((v) => presentes.has(normKey(v))))
}

/**
 * Mapea el texto libre de `Resultado de la sesión` a uno de los 7 estados.
 *
 * El orden importa: los patrones más específicos van primero, para que
 * "No asistió, queda en seguimiento" resuelva a 'No asistió'.
 *
 * Unifica los dos mapeos incompatibles de n8n/WF-3 (`Normalize Rows` producía
 * 3 estados, `Map Session Status` producía 5 y devolvía null al no coincidir).
 */
const PATRONES_STATUS: readonly (readonly [string, ConsultoriaStatus])[] = [
  ['cancelad', 'Cancelado'],
  ['no asisti', 'No asistió'],
  ['escalar', 'Escalar'],
  ['seguimiento', 'En seguimiento'],
  ['resuelto', 'Resuelto'],
]

export function mapResultadoAStatus(resultado: string | null): ConsultoriaStatus | null {
  const texto = (resultado ?? '').trim().toLowerCase()
  if (texto === '') return null

  for (const [patron, status] of PATRONES_STATUS) {
    if (texto.includes(patron)) return status
  }

  // Hay texto pero no coincide con ningún patrón: la sesión ocurrió.
  return 'Resuelto'
}

function normalizarModalidad(raw: string | null): 'Virtual' | 'Presencial' {
  if (raw === null) return 'Virtual'
  return /presencial/i.test(raw) ? 'Presencial' : 'Virtual'
}

export function normalizeSesionRow(
  raw: RawRow,
  fila: number,
): NormalizeResult<NormalizedSesionRow> {
  const errores: RowIssue[] = []
  const avisos: RowIssue[] = []

  const emailRaw = col(raw, 'Correo del Usuario Atendido', 'Correo electrónico', 'email')
  const email = emailRaw === null ? null : emailRaw.toLowerCase()
  if (email === null || !email.includes('@')) {
    errores.push({ fila, severidad: 'error', motivo: 'Correo del usuario atendido ausente o inválido' })
  }

  const fechaRaw = col(raw, 'Fecha de la Sesión', 'Fecha', 'fecha_sesion')
  const fecha = toDate(fechaRaw)
  if (fecha === null) {
    errores.push({
      fila,
      severidad: 'error',
      motivo: fechaRaw === null
        ? 'Falta la fecha de la sesión'
        : 'Fecha de la sesión ilegible',
    })
  }

  if (errores.length > 0 || email === null || fecha === null) {
    return { ok: false, fila, errores }
  }

  const duracion = toInt(col(raw, 'Duración de la Sesión / Minutos', 'Duración de la sesión', 'duracion'))
  const resultado = col(raw, 'Resultado de la sesión', 'resultado')
  const status = mapResultadoAStatus(resultado)

  if (status === null) {
    avisos.push({
      fila,
      severidad: 'aviso',
      motivo: 'Sin resultado de la sesión: el estado de la consultoría no se modifica',
    })
  }

  const staffEmailRaw = col(raw, 'Correo Institucional / Consultor', 'staff_email')
  const staffEmail = staffEmailRaw === null ? null : staffEmailRaw.toLowerCase()
  const staffName = col(raw, 'Consultor / Coder', 'staff_name')
  if (staffEmail === null && staffName === null) {
    avisos.push({
      fila,
      severidad: 'aviso',
      motivo: 'La sesión no trae consultor: la consultoría quedará sin consultor asignado',
    })
  }

  const idExterno = col(raw, 'Id', 'id')

  return {
    ok: true,
    avisos,
    row: {
      fila,
      clave: idExterno ?? `${email}|${fecha}`,
      lead: {
        p_email: email,
        p_nombre_completo: col(raw, 'Nombre del Usuario Atendido', 'Nombre', 'full_name') ?? 'Sin nombre',
        p_phone: col(raw, 'Celular del usuario atendido', 'Celular', 'phone'),
        p_id_num: col(raw, 'Cedula del Usuario Atendido', 'Documento de identidad'),
        p_nit: col(raw, 'Nit de la Empresa', 'NIT'),
        p_city: col(raw, 'Municipio', 'city'),
        p_cargo: col(raw, 'Cargo del Usuario Atendido', 'cargo'),
        p_company_role_level: col(raw, 'Nivel del Cargo', 'company_role_level'),
        p_company_role_area: col(raw, 'Área del Usuario Atendido', 'company_role_area'),
        p_sector: null,
        p_empresa: col(raw, 'Nombre de la empresa', 'empresa'),
        p_sexo: col(raw, 'Sexo Usuario Atendido', 'Sexo'),
        p_booking_email: null,
        p_booking_customer_id: null,
        p_origen: 'sesion',
      },
      consultoria: {
        booking_id: null,
        fecha,
        hora_inicio: toTime(col(raw, 'Hora de inicio', 'hora_inicio')),
        hora_fin: toTime(col(raw, 'Hora de finalización', 'hora_fin')),
        duracion_minutos: duracion,
        modalidad: normalizarModalidad(col(raw, 'Modalidad de la Sesión', 'modalidad')),
        servicio: null,
        staff_name: staffName,
        staff_email: staffEmail,
        nivel_potencia: col(raw, 'Nivel de potencia', 'Nivel de Potencia'),
        categoria_caso: col(raw, 'Categoría del caso', 'Categoría del Caso (Potencia)'),
        categoria_caso_uso: col(raw, 'Categoria del Caso de Uso', 'categoria_caso_uso'),
        status,
      },
      registro: {
        id_externo: idExterno,
        pregunta: col(raw, 'Pregunta', 'pregunta'),
        motivo_consulta: col(raw, 'Motivo de la Consulta', 'Motivo Consulta', 'motivo_consulta'),
        estado_inicial: col(raw, 'Estado Inicial', 'estado_inicial'),
        acciones_realizadas: col(raw, 'Acciones Realizadas Durante la Sesión', 'acciones_realizadas'),
        resultado_final: col(raw, 'Resultado Final', 'resultado_final'),
        estimacion_impacto: col(raw, 'Estimación del Impacto Generado', 'Estimacion del Impacto Generado', 'estimacion_impacto'),
        entregables: col(raw, 'Entregables Producidos', 'entregables'),
        cantidad_productos: toInt(col(raw, 'Cantidad de nuevos productos creados', 'cantidad_productos')) ?? 0,
        sesion_grabada: toBool(col(raw, '¿La sesión fue grabada?', 'sesion_grabada')),
        enlace_grabacion: col(raw, 'Enlace de Grabación', 'enlace_grabacion'),
        adjuntar_evidencia: col(raw, 'Adjuntar Evidencia', 'adjuntar_evidencia'),
        confirmo_no_automatizacion: toBool(
          col(
            raw,
            'Confirmo que este caso NO corresponde a automatización o integración de sistemas complejos.',
            'Confirmo que este caso NO corresponde a automatización',
            'confirmo_no_automatizacion',
          ),
        ),
        resultado,
        duracion_sesion_minutos: duracion,
      },
    },
  }
}
```

- [ ] Ejecutar el test para verificar que pasa:

Run: `npm test -- sesiones`
Expected: PASS, todos los casos.

**Nota para el implementador:** el test `'encuentra las columnas con encabezados variantes y acentos'` depende de que `col` haga match por prefijo delimitado. `Estado Inicial – Situación Antes de la Intervención` se encuentra buscando `'Estado Inicial'` porque `normKey` convierte el guion tipográfico en `-` y `col` acepta el sufijo ` -`. Si ese test falla, el bug está en `columns.ts`, no acá.

### E3 — Verificar independencia de zona horaria y calidad

- [ ] Correr bajo las dos zonas horarias:

Run: `TZ=UTC npm test -- sesiones && TZ=America/Bogota npm test -- sesiones`
Expected: PASS en ambas, con el mismo número de tests.

- [ ] Verificar que el módulo no usa APIs prohibidas:

Run: `grep -nE "document|window|fetch|getHours|getMinutes|toLocale" src/lib/ingest/sesiones.ts`
Expected: sin resultados (exit 1).

- [ ] Correr la suite completa y verificar lint y typecheck:

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: PASS sin regresiones.

### E4 — Commit de la Work Unit E

- [ ] Commit:

```bash
git add src/lib/ingest/sesiones.ts src/lib/ingest/__tests__/sesiones.test.ts
git commit -m "feat(ingest): normalizador del .xlsx de registro de sesion

Reemplaza el nodo Normalize Rows de n8n/WF-3 y unifica su mapeo de
estados con el de Map Session Status, que producian resultados
distintos entre si: uno daba 3 estados, el otro 5 y devolvia null al
no coincidir.

mapResultadoAStatus ordena los patrones de mas a menos especifico, y
devuelve null cuando el resultado viene vacio para que el status de la
consultoria no se modifique (R31b)."
```

---

## Work Unit F — RPC de ingesta por lote

Files: `supabase/migrations/20260908_ingest_rpc.sql` (CREATE)
Spec: `ingesta-archivos` — R7, R7b, R7c, R8, R9, R10, R10b, R10c
Sequential: F1 → F2 → F3
Dependency: A2 (el esquema reconciliado debe estar aplicado)

**Interfaces:**
- Consumes: `public.match_or_create_lead(...)` con la firma de `20260603_f6_nombre_completo.sql` (parámetro `p_nombre_completo`).
- Produces:
  - `public.ingest_bookings(p_filas jsonb, p_dry_run boolean default false) returns table (fila int, accion text, aviso text, error text)`
  - `public.ingest_sesiones(p_filas jsonb, p_dry_run boolean default false) returns table (fila int, accion text, aviso text, error text)`
  - Cada elemento de `p_filas` tiene la forma que produce el normalizador: `{ fila, clave, lead, consultoria }` para bookings y `{ fila, clave, lead, consultoria, registro }` para sesiones.

### F1 — Escribir la migración con los dos RPC

- [ ] Crear `supabase/migrations/20260908_ingest_rpc.sql` con este contenido exacto:

```sql
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
```

- [ ] Verificar que ambos RPC revocan permisos de `public`:

Run: `grep -c "revoke all on function" supabase/migrations/20260908_ingest_rpc.sql`
Expected: `2`

### F2 — Aplicar y verificar los RPC en Supabase (paso humano)

- [ ] **PASO HUMANO.** Pegar `supabase/migrations/20260908_ingest_rpc.sql` en el editor SQL de Supabase y ejecutarlo.
- [ ] Confirmar que terminó sin error.
- [ ] Verificar el **dry-run** con esta prueba, que usa un correo inventado y no debe dejar rastro:

```sql
-- Contar antes
select count(*) as leads_antes from public.leads;
select count(*) as cons_antes  from public.consultorias;

-- Dry run con una fila sintética
select * from public.ingest_bookings(
  '[{
     "fila": 2,
     "clave": "BK-PRUEBA-DRYRUN",
     "lead": {
       "p_email": "prueba.dryrun@ejemplo.invalid",
       "p_nombre_completo": "Prueba Dry Run",
       "p_phone": null, "p_id_num": null, "p_nit": null, "p_city": null,
       "p_cargo": null, "p_company_role_level": null, "p_company_role_area": null,
       "p_sector": null, "p_empresa": null, "p_sexo": null,
       "p_booking_email": "prueba.dryrun@ejemplo.invalid",
       "p_booking_customer_id": "BK-PRUEBA-DRYRUN",
       "p_origen": "booking"
     },
     "consultoria": {
       "booking_id": "BK-PRUEBA-DRYRUN",
       "fecha": "2026-09-15", "hora_inicio": "14:30", "hora_fin": "15:30",
       "duracion_minutos": 60, "modalidad": "Virtual",
       "servicio": "Prueba", "staff_name": null, "staff_email": null,
       "nivel_potencia": null, "categoria_caso": null,
       "categoria_caso_uso": "Prueba", "status": "Agendado"
     }
   }]'::jsonb,
  true
);

-- Contar después: deben ser IDÉNTICOS a los de antes
select count(*) as leads_despues from public.leads;
select count(*) as cons_despues  from public.consultorias;

select count(*) as rastro
  from public.leads
 where email = 'prueba.dryrun@ejemplo.invalid';
```

Expected: la llamada devuelve una fila con `accion = 'creada'`, `error = null` y un `aviso` sobre el staff sin consultor. Los conteos de después son **iguales** a los de antes y `rastro` es `0`. Eso demuestra R7b y R7c.

- [ ] Verificar que una fila mala no aborta el lote. Ejecutar un dry-run con dos filas donde la segunda tenga `"fecha": "no-es-fecha"`:

Expected: la primera fila devuelve `accion = 'creada'` con `error = null`; la segunda devuelve `accion = null` y un `error` con el mensaje de Postgres. La llamada **no** falla completa. Eso demuestra R8.

### F3 — Commit de la Work Unit F

- [ ] Commit:

```bash
git add supabase/migrations/20260908_ingest_rpc.sql
git commit -m "feat(ingest): RPC de ingesta por lote con savepoint por fila

Un solo RPC por carga en vez de una llamada por fila: el patron de n8n
hace ~5 requests HTTP por fila (~700 para 142 filas) y supera el techo
de subrequests de un Cloudflare Worker.

Cada fila corre dentro de begin/exception, lo que crea un savepoint:
sus escrituras en leads, consultorias y registro_sesion son atomicas
entre si, y una fila que falla no aborta el lote.

p_dry_run recorre el mismo camino y revierte lanzando ZZ001, que su
propio manejador atrapa. Las variables plpgsql sobreviven a la
excepcion, asi que devuelve la accion que se habria aplicado: la
previsualizacion es exacta, incluso para las claves de fallback.

Ambas funciones son security definer con execute revocado de public y
concedido solo a service_role."
```

---

## Work Unit G — Ruta `/api/cargas`

Files: `src/app/api/cargas/route.ts` (CREATE), `src/app/api/cargas/__tests__/route.test.ts` (CREATE)
Spec: `ingesta-archivos` — R2–R7, R10, R15, R16
Sequential: G1 → G2 → G3 → G4
Dependency: D2, E2 (los normalizadores) y F2 (los RPC aplicados)

**Interfaces:**
- Consumes: `normalizeBookingRow` de `@/lib/ingest/bookings`, `normalizeSesionRow` de `@/lib/ingest/sesiones`, tipos de `@/lib/ingest/types`, `createClient` de `@/lib/supabase-server`, `createClient` de `@supabase/supabase-js`, y los RPC `ingest_bookings` / `ingest_sesiones`.
- Produces: `POST /api/cargas` que acepta `CargaRequest` y responde `CargaResponse` (200), `{ error }` con 400 (cuerpo o parámetros inválidos), 403 (no admin) o 500 (fallo del RPC).

**Nota de simplificación:** el cliente **no** normaliza filas. Parsea el archivo y valida los encabezados localmente (para rechazar de inmediato un archivo del tipo equivocado), y toda la clasificación por fila viene del dry-run del servidor. Normalizar también en el cliente sería redundante: la previsualización ya es un round trip.

### G1 — Escribir el test rojo de la ruta

- [ ] Crear `src/app/api/cargas/__tests__/route.test.ts`:

```ts
/**
 * TDD tests para POST /api/cargas.
 *
 * Cubre:
 *  A1. Sin sesión → 403
 *  A2. Consultor no admin → 403
 *  A3. No se instancia el cliente de servicio antes de autorizar (R3)
 *  V1. Cuerpo que no es JSON → 400
 *  V2. Acción inválida → 400
 *  V3. Tipo inválido → 400
 *  V4. filas que no es arreglo → 400
 *  N1. El servidor normaliza él mismo y descarta filas inválidas (R5)
 *  N2. Numeración de filas: la primera de datos es la fila 2 (encabezado = 1)
 *  R1. preview invoca el RPC con p_dry_run true
 *  R2. commit invoca el RPC con p_dry_run false
 *  R3. Una sola invocación de RPC sin importar el número de filas (R7)
 *  R4. Los resultados del RPC se agregan en creadas / actualizadas / fallidas
 *  R5. Los avisos del RPC llegan a la respuesta
 *  R6. Error del RPC → 500
 *  L1. Los logs no contienen datos personales de las filas (R15)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock del cliente de servicio ────────────────────────────────────────────

const mockRpc = vi.fn()
const mockServiceInstance = { rpc: mockRpc }
const mockCreateServiceClient = vi.fn(() => mockServiceInstance)

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateServiceClient(...(args as [])),
}))

// ─── Mock del cliente de sesión ──────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockSingle = vi.fn()

const mockSessionInstance = {
  auth: { getUser: mockGetUser },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ single: mockSingle })),
    })),
  })),
}

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(async () => mockSessionInstance),
}))

// ─── Importar el handler DESPUÉS de los mocks ────────────────────────────────

import { POST } from '../route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pedir(body: unknown): Request {
  return new Request('http://localhost/api/cargas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function filaBooking(valores: Record<string, string> = {}): Record<string, string> {
  return {
    'Date Time': '15/09/2026 14:30',
    'Customer Name': 'Ana Pérez',
    'Customer Email': 'ana@empresa.com',
    'Customer Phone': '3001234567',
    'Staff Name': 'Carlos',
    'Staff Email': 'carlos@camarabaq.org.co',
    'Service': 'Consultoría',
    'Duration (mins.)': '60',
    'Booking Id': 'BK-001',
    'Custom Fields': '',
    ...valores,
  }
}

function comoAdmin() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
  mockSingle.mockResolvedValue({ data: { rol: 'admin' }, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ejemplo.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba'
  mockRpc.mockResolvedValue({ data: [], error: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Autorización ────────────────────────────────────────────────────────────

describe('POST /api/cargas — autorización', () => {
  it('A1: responde 403 sin sesión', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(pedir({ accion: 'preview', tipo: 'bookings', filas: [] }) as never)
    expect(res.status).toBe(403)
  })

  it('A2: responde 403 para un consultor que no es admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
    mockSingle.mockResolvedValue({ data: { rol: 'consultor' }, error: null })
    const res = await POST(pedir({ accion: 'preview', tipo: 'bookings', filas: [] }) as never)
    expect(res.status).toBe(403)
  })

  it('A3: no instancia el cliente de servicio si la autorización falla', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    await POST(pedir({ accion: 'commit', tipo: 'bookings', filas: [filaBooking()] }) as never)
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

// ─── Validación del cuerpo ───────────────────────────────────────────────────

describe('POST /api/cargas — validación', () => {
  beforeEach(comoAdmin)

  it('V1: responde 400 con un cuerpo que no es JSON', async () => {
    const req = new Request('http://localhost/api/cargas', { method: 'POST', body: 'no json' })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('V2: responde 400 con una acción inválida', async () => {
    const res = await POST(pedir({ accion: 'borrar', tipo: 'bookings', filas: [] }) as never)
    expect(res.status).toBe(400)
  })

  it('V3: responde 400 con un tipo inválido', async () => {
    const res = await POST(pedir({ accion: 'preview', tipo: 'facturas', filas: [] }) as never)
    expect(res.status).toBe(400)
  })

  it('V4: responde 400 si filas no es un arreglo', async () => {
    const res = await POST(pedir({ accion: 'preview', tipo: 'bookings', filas: 'nope' }) as never)
    expect(res.status).toBe(400)
  })
})

// ─── Normalización del lado servidor ─────────────────────────────────────────

describe('POST /api/cargas — normalización autoritativa', () => {
  beforeEach(comoAdmin)

  it('N1: descarta una fila cruda inválida antes de invocar el RPC', async () => {
    const res = await POST(pedir({
      accion: 'commit',
      tipo: 'bookings',
      filas: [filaBooking({ 'Customer Email': 'sin-arroba' })],
    }) as never)

    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.fallidas).toHaveLength(1)
    expect(body.fallidas[0].fila).toBe(2)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('N2: numera la primera fila de datos como fila 2', async () => {
    const res = await POST(pedir({
      accion: 'commit',
      tipo: 'bookings',
      filas: [
        filaBooking({ 'Customer Email': 'sin-arroba' }),
        filaBooking({ 'Customer Email': 'tampoco' }),
      ],
    }) as never)

    const body = await res.json()
    expect(body.fallidas.map((f: { fila: number }) => f.fila)).toEqual([2, 3])
  })
})

// ─── Invocación del RPC ──────────────────────────────────────────────────────

describe('POST /api/cargas — RPC', () => {
  beforeEach(comoAdmin)

  it('R1: preview invoca el RPC con p_dry_run true', async () => {
    await POST(pedir({ accion: 'preview', tipo: 'bookings', filas: [filaBooking()] }) as never)
    expect(mockRpc).toHaveBeenCalledWith('ingest_bookings', expect.objectContaining({ p_dry_run: true }))
  })

  it('R2: commit invoca el RPC con p_dry_run false', async () => {
    await POST(pedir({ accion: 'commit', tipo: 'bookings', filas: [filaBooking()] }) as never)
    expect(mockRpc).toHaveBeenCalledWith('ingest_bookings', expect.objectContaining({ p_dry_run: false }))
  })

  it('R3: hace una sola invocación de RPC con 50 filas', async () => {
    const filas = Array.from({ length: 50 }, (_, i) => filaBooking({ 'Booking Id': `BK-${i}` }))
    await POST(pedir({ accion: 'commit', tipo: 'bookings', filas }) as never)
    expect(mockRpc).toHaveBeenCalledTimes(1)
    const args = mockRpc.mock.calls[0]![1] as { p_filas: unknown[] }
    expect(args.p_filas).toHaveLength(50)
  })

  it('R4: agrega los resultados en creadas, actualizadas y fallidas', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { fila: 2, accion: 'creada', aviso: null, error: null },
        { fila: 3, accion: 'actualizada', aviso: null, error: null },
        { fila: 4, accion: null, aviso: null, error: 'violates check constraint' },
      ],
      error: null,
    })

    const filas = [filaBooking(), filaBooking({ 'Booking Id': 'BK-2' }), filaBooking({ 'Booking Id': 'BK-3' })]
    const res = await POST(pedir({ accion: 'commit', tipo: 'bookings', filas }) as never)
    const body = await res.json()

    expect(body.creadas).toBe(1)
    expect(body.actualizadas).toBe(1)
    expect(body.fallidas).toEqual([{ fila: 4, motivo: 'violates check constraint' }])
  })

  it('R5: propaga los avisos del RPC a la respuesta', async () => {
    mockRpc.mockResolvedValue({
      data: [{ fila: 2, accion: 'creada', aviso: 'staff sin consultor', error: null }],
      error: null,
    })

    const res = await POST(pedir({ accion: 'preview', tipo: 'bookings', filas: [filaBooking()] }) as never)
    const body = await res.json()

    expect(body.avisos).toContainEqual({ fila: 2, motivo: 'staff sin consultor' })
  })

  it('R6: responde 500 cuando el RPC devuelve error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await POST(pedir({ accion: 'commit', tipo: 'bookings', filas: [filaBooking()] }) as never)
    expect(res.status).toBe(500)
  })

  it('usa ingest_sesiones para el tipo sesiones', async () => {
    const filaSesion = {
      'Id': 'SES-1',
      'Fecha de la Sesión': '2026-09-15',
      'Correo del Usuario Atendido': 'ana@empresa.com',
      'Nombre del Usuario Atendido': 'Ana Pérez',
      'Resultado de la sesión': 'Resuelto',
    }
    await POST(pedir({ accion: 'commit', tipo: 'sesiones', filas: [filaSesion] }) as never)
    expect(mockRpc).toHaveBeenCalledWith('ingest_sesiones', expect.objectContaining({ p_dry_run: false }))
  })
})

// ─── Logs sin datos personales ───────────────────────────────────────────────

describe('POST /api/cargas — logs', () => {
  beforeEach(comoAdmin)

  it('L1: no escribe datos personales en los logs', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    await POST(pedir({
      accion: 'commit',
      tipo: 'bookings',
      filas: [filaBooking({ 'Customer Email': 'ana.perez@empresa.com', 'Customer Name': 'Ana Pérez' })],
    }) as never)

    const registrado = spy.mock.calls.flat().map(String).join(' ')
    expect(registrado).not.toContain('ana.perez@empresa.com')
    expect(registrado).not.toContain('Ana Pérez')
    expect(registrado).not.toContain('3001234567')
  })
})
```

- [ ] Ejecutar el test para verificar que falla:

Run: `npm test -- cargas`
Expected: FAIL — no se puede resolver `../route`.

### G2 — Implementar la ruta

- [ ] Crear `src/app/api/cargas/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase-server'
import { normalizeBookingRow } from '@/lib/ingest/bookings'
import { normalizeSesionRow } from '@/lib/ingest/sesiones'
import type {
  CargaRequest,
  CargaResponse,
  FilaResultado,
  NormalizedBookingRow,
  NormalizedSesionRow,
  RawRow,
} from '@/lib/ingest/types'

export const dynamic = 'force-dynamic'

const RPC_POR_TIPO = {
  bookings: 'ingest_bookings',
  sesiones: 'ingest_sesiones',
} as const

/**
 * La única autoridad de acceso. El filtro `adminOnly` del menú es cosmético:
 * oculta el enlace, no protege nada.
 *
 * Se resuelve con la llave anónima y la cookie de sesión. El cliente de
 * servicio no se instancia hasta después de pasar por acá, porque su llave
 * salta RLS y el trigger trg_guard_consultoria_consultor de la migración f5.
 */
async function esAdmin(): Promise<boolean> {
  const sesion = await createSessionClient()

  const { data: auth, error: authError } = await sesion.auth.getUser()
  if (authError || !auth?.user) return false

  const { data, error } = await sesion
    .from('consultores')
    .select('rol')
    .eq('auth_id', auth.user.id)
    .single()

  if (error || !data) return false
  return data.rol === 'admin'
}

export async function POST(req: NextRequest) {
  if (!(await esAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: CargaRequest
  try {
    body = (await req.json()) as CargaRequest
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const { accion, tipo, filas } = body

  if (accion !== 'preview' && accion !== 'commit') {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }
  if (tipo !== 'bookings' && tipo !== 'sesiones') {
    return NextResponse.json({ error: 'Tipo de carga inválido' }, { status: 400 })
  }
  if (!Array.isArray(filas)) {
    return NextResponse.json({ error: 'Se esperaba un arreglo de filas' }, { status: 400 })
  }

  // El servidor normaliza las filas CRUDAS él mismo: es la autoridad. Lo que
  // el cliente haya calculado para pintar su pantalla no influye acá.
  const validas: Array<NormalizedBookingRow | NormalizedSesionRow> = []
  const fallidas: Array<{ fila: number; motivo: string }> = []
  const avisos: Array<{ fila: number; motivo: string }> = []

  filas.forEach((raw, i) => {
    // La fila 1 del archivo es el encabezado, así que la primera de datos es 2.
    const numero = i + 2

    const resultado = tipo === 'bookings'
      ? normalizeBookingRow(raw as RawRow, numero)
      : normalizeSesionRow(raw as RawRow, numero)

    if (resultado.ok) {
      validas.push(resultado.row)
      for (const a of resultado.avisos) avisos.push({ fila: a.fila, motivo: a.motivo })
    } else {
      for (const e of resultado.errores) fallidas.push({ fila: e.fila, motivo: e.motivo })
    }
  })

  let creadas = 0
  let actualizadas = 0

  if (validas.length > 0) {
    const servicio = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data, error } = await servicio.rpc(RPC_POR_TIPO[tipo], {
      p_filas: validas,
      p_dry_run: accion === 'preview',
    })

    if (error) {
      // Solo conteo y mensaje del motor: nunca el contenido de las filas,
      // que trae nombres, correos, teléfonos y cédulas de clientes reales.
      console.error(`[cargas] ${tipo}/${accion}: el RPC falló con ${validas.length} filas — ${error.message}`)
      return NextResponse.json({ error: 'Error procesando el lote' }, { status: 500 })
    }

    for (const r of (data ?? []) as FilaResultado[]) {
      if (r.error !== null) {
        fallidas.push({ fila: r.fila, motivo: r.error })
      } else if (r.accion === 'creada') {
        creadas += 1
      } else if (r.accion === 'actualizada') {
        actualizadas += 1
      }
      if (r.aviso !== null) avisos.push({ fila: r.fila, motivo: r.aviso })
    }
  }

  if (fallidas.length > 0) {
    const numeros = fallidas.map((f) => f.fila).join(', ')
    console.error(`[cargas] ${tipo}/${accion}: ${fallidas.length} filas fallidas (filas ${numeros})`)
  }

  const respuesta: CargaResponse = {
    creadas,
    actualizadas,
    fallidas: fallidas.sort((a, b) => a.fila - b.fila),
    avisos: avisos.sort((a, b) => a.fila - b.fila),
  }

  return NextResponse.json(respuesta)
}
```

- [ ] Ejecutar el test para verificar que pasa:

Run: `npm test -- cargas`
Expected: PASS, todos los casos.

### G3 — Verificar calidad

- [ ] Correr la suite completa, lint y typecheck:

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: PASS sin regresiones.

- [ ] Verificar que la ruta no registra contenido de filas. Buscar cualquier `console` que interpole una fila completa:

Run: `grep -nE "console\.(log|error|warn).*(raw|filas\[|JSON\.stringify)" src/app/api/cargas/route.ts`
Expected: sin resultados (exit 1).

### G4 — Commit de la Work Unit G

- [ ] Commit:

```bash
git add src/app/api/cargas/route.ts src/app/api/cargas/__tests__/route.test.ts
git commit -m "feat(ingest): ruta /api/cargas con autorizacion admin

El cliente manda las filas CRUDAS y el servidor las normaliza el mismo
con los modulos puros: es la autoridad, asi que un POST fabricado no
puede colar filas invalidas.

La autorizacion se resuelve con la llave anonima y la cookie de sesion,
y exige rol admin. El cliente de servicio no se instancia hasta despues
de ese chequeo, porque su llave salta RLS y el trigger
trg_guard_consultoria_consultor de la migracion f5.

preview y commit comparten cuerpo y difieren solo en p_dry_run.
Los logs llevan numero de fila y motivo, nunca contenido: los archivos
traen datos personales de clientes reales."
```

---

## Work Unit H — Lectura de archivo: módulo puro

Files: `src/lib/ingest/archivo.ts` (CREATE), `src/lib/ingest/__tests__/archivo.test.ts` (CREATE)
Spec: `ingesta-archivos` — R14
Sequential: H1 → H2 → H3 → H4
Dependency: D2 y E2 (`headersLookLike*`)

**Interfaces:**
- Consumes: `headersLookLikeBookings` de `./bookings`, `headersLookLikeSesiones` de `./sesiones`, tipos de `./types`.
- Produces:
  - `matrizARawRows(matriz: unknown[][]): RawRow[]`
  - `encabezadosCorresponden(tipo: TipoCarga, encabezados: string[]): boolean`

**Por qué existe esta unidad:** el proyecto no tiene `jsdom` ni `testing-library`; testea componentes con `renderToStaticMarkup` y extrae la lógica pura a módulos aparte (`src/app/dashboard/searchHelpers.ts`, `sessionHistoryUtils.ts`, `src/lib/capturaStats.ts`). Sacar la conversión de matriz y la detección de tipo acá deja la página como puro armado de UI y hace testeable lo que de verdad puede fallar.

### H1 — Instalar la dependencia de Excel

- [ ] Instalar `read-excel-file`:

Run: `npm install read-excel-file`

- [ ] Verificar que la auditoría queda limpia para esa dependencia:

Run: `npm audit --omit=dev`
Expected: sin avisos atribuidos a `read-excel-file`. **No** instalar `xlsx` (SheetJS): su versión en npm está congelada en 0.18.5 con dos avisos de severidad alta y `npm audit` reporta "No fix available", porque SheetJS dejó de publicar en npm (`exploration.md` §3).

- [ ] Confirmar que quedó en `dependencies`, no en `devDependencies`:

Run: `node -e "const p=require('./package.json'); console.log('dep:', !!p.dependencies['read-excel-file'], 'dev:', !!(p.devDependencies||{})['read-excel-file'])"`
Expected: `dep: true dev: false`

### H2 — Escribir el test rojo de `archivo`

- [ ] Crear `src/lib/ingest/__tests__/archivo.test.ts`:

```ts
/**
 * Lectura de archivo: conversión de matriz a filas crudas y detección del tipo.
 *
 * read-excel-file devuelve una matriz de celdas (arreglo de arreglos), no
 * objetos, así que la fila 0 hay que convertirla en encabezados a mano.
 *
 * encabezadosCorresponden existe para rechazar el archivo completo cuando se
 * subió en la pestaña equivocada, en vez de dejar que fallen 142 filas una
 * por una (spec ingesta-archivos R14).
 */
import { describe, it, expect } from 'vitest'
import { matrizARawRows, encabezadosCorresponden } from '../archivo'

describe('matrizARawRows', () => {
  it('usa la fila 0 como encabezados', () => {
    const matriz = [
      ['Id', 'Fecha de la Sesión'],
      ['SES-1', '2026-09-15'],
    ]
    expect(matrizARawRows(matriz)).toEqual([
      { 'Id': 'SES-1', 'Fecha de la Sesión': '2026-09-15' },
    ])
  })

  it('recorta espacios de los encabezados pero conserva el valor tal cual', () => {
    const matriz = [
      ['  Entregables Producidos  '],
      ['  una plantilla  '],
    ]
    const filas = matrizARawRows(matriz)
    expect(Object.keys(filas[0]!)).toEqual(['Entregables Producidos'])
    expect(filas[0]!['Entregables Producidos']).toBe('  una plantilla  ')
  })

  it('conserva números y objetos Date sin convertirlos a texto', () => {
    const fecha = new Date(Date.UTC(2026, 8, 15))
    const matriz = [
      ['Fecha de la Sesión', 'Duración de la Sesión / Minutos'],
      [fecha, 60],
    ]
    const filas = matrizARawRows(matriz)
    expect(filas[0]!['Fecha de la Sesión']).toBe(fecha)
    expect(filas[0]!['Duración de la Sesión / Minutos']).toBe(60)
  })

  it('rellena con null las celdas ausentes al final de una fila corta', () => {
    const matriz = [
      ['a', 'b', 'c'],
      ['1'],
    ]
    expect(matrizARawRows(matriz)).toEqual([{ a: '1', b: null, c: null }])
  })

  it('devuelve vacío sin filas de datos', () => {
    expect(matrizARawRows([['a', 'b']])).toEqual([])
    expect(matrizARawRows([])).toEqual([])
  })

  it('ignora columnas cuyo encabezado viene vacío', () => {
    const matriz = [
      ['Id', '', null],
      ['SES-1', 'huérfano', 'otro'],
    ]
    expect(Object.keys(matrizARawRows(matriz)[0]!)).toEqual(['Id'])
  })
})

describe('encabezadosCorresponden', () => {
  const bookings = ['Date Time', 'Customer Name', 'Customer Email', 'Booking Id']
  const sesiones = ['Id', 'Fecha de la Sesión', 'Correo del Usuario Atendido']

  it('acepta los encabezados de bookings en el tipo bookings', () => {
    expect(encabezadosCorresponden('bookings', bookings)).toBe(true)
  })

  it('acepta los encabezados de sesión en el tipo sesiones', () => {
    expect(encabezadosCorresponden('sesiones', sesiones)).toBe(true)
  })

  it('rechaza el archivo de sesión subido en el tipo bookings', () => {
    expect(encabezadosCorresponden('bookings', sesiones)).toBe(false)
  })

  it('rechaza el archivo de bookings subido en el tipo sesiones', () => {
    expect(encabezadosCorresponden('sesiones', bookings)).toBe(false)
  })

  it('rechaza una lista vacía en ambos tipos', () => {
    expect(encabezadosCorresponden('bookings', [])).toBe(false)
    expect(encabezadosCorresponden('sesiones', [])).toBe(false)
  })
})
```

- [ ] Ejecutar el test para verificar que falla:

Run: `npm test -- archivo`
Expected: FAIL — no se puede resolver `../archivo`.

### H3 — Implementar `archivo.ts`

- [ ] Crear `src/lib/ingest/archivo.ts`:

```ts
import { headersLookLikeBookings } from './bookings'
import { headersLookLikeSesiones } from './sesiones'
import type { RawRow, TipoCarga } from './types'

/**
 * Convierte la matriz de celdas que devuelve read-excel-file en filas crudas.
 *
 * Los valores se conservan tal cual llegan — números y Date incluidos — porque
 * `coerce.ts` ya sabe interpretarlos y convertirlos a texto acá perdería
 * información. Las columnas con encabezado vacío se descartan.
 */
export function matrizARawRows(matriz: unknown[][]): RawRow[] {
  if (matriz.length < 2) return []

  const encabezados = (matriz[0] ?? []).map((h) => String(h ?? '').trim())

  return matriz.slice(1).map((linea) => {
    const fila: RawRow = {}
    encabezados.forEach((h, i) => {
      if (h !== '') fila[h] = linea[i] ?? null
    })
    return fila
  })
}

/**
 * ¿Los encabezados corresponden al tipo de carga elegido? Permite rechazar el
 * archivo completo de una vez, en vez de dejar que fallen todas las filas.
 */
export function encabezadosCorresponden(tipo: TipoCarga, encabezados: string[]): boolean {
  return tipo === 'bookings'
    ? headersLookLikeBookings(encabezados)
    : headersLookLikeSesiones(encabezados)
}
```

- [ ] Ejecutar el test para verificar que pasa:

Run: `npm test -- archivo`
Expected: PASS, todos los casos.

- [ ] Verificar lint y typecheck:

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores.

### H4 — Commit de la Work Unit H

- [ ] Commit:

```bash
git add package.json package-lock.json \
        src/lib/ingest/archivo.ts \
        src/lib/ingest/__tests__/archivo.test.ts
git commit -m "feat(ingest): lectura de archivo como modulo puro

read-excel-file devuelve una matriz de celdas, no objetos, asi que la
fila 0 se convierte en encabezados a mano. Los valores se conservan tal
cual (numeros y Date incluidos) porque coerce.ts ya sabe interpretarlos.

encabezadosCorresponden permite rechazar el archivo completo cuando se
subio en la pestana equivocada, en vez de dejar que fallen 142 filas
una por una.

Se eligio read-excel-file y no xlsx (SheetJS): la version de xlsx en
npm esta congelada en 0.18.5 con dos avisos de severidad alta y npm
audit reporta 'No fix available'."
```

---

## Work Unit I — Página `/dashboard/cargas`

Files: `src/app/dashboard/cargas/page.tsx` (CREATE), `src/app/dashboard/DashboardShell.tsx` (MODIFY)
Spec: `ingesta-archivos` — R1, R11, R12, R13, R14, R16
Sequential: I1 → I2 → I3 → I4 → I5
Dependency: G2 (la ruta) y H3 (`archivo.ts`)

**Interfaces:**
- Consumes: `parseTsv` de `@/lib/ingest/bookings`; `matrizARawRows`, `encabezadosCorresponden` de `@/lib/ingest/archivo`; tipos de `@/lib/ingest/types`; `getCurrentConsultor` de `@/lib/supabase-browser`; `POST /api/cargas`.
- Produces: la página. No exporta nada que consuman otras unidades.

**Nota de diseño:** el cliente **no** normaliza filas. Parsea, valida encabezados (feedback inmediato ante el archivo equivocado) y manda las filas crudas; toda la clasificación por fila viene del dry-run del servidor. Normalizar también acá sería redundante, porque la previsualización ya es un round trip.

### I1 — Añadir el ítem al menú

- [ ] En `src/app/dashboard/DashboardShell.tsx`, añadir una entrada a `navItems` (línea 16) después de la de *Consultores*:

```ts
  { label: 'Cargas', href: '/dashboard/cargas', icon: 'upload_file', adminOnly: true },
```

- [ ] Verificar que el filtro existente ya lo restringe. El `navItems.filter((item) => !item.adminOnly || rol === 'admin')` de la misma componente hace el trabajo; no hay que tocarlo.

Run: `grep -c "adminOnly: true" src/app/dashboard/DashboardShell.tsx`
Expected: `2` (Consultores y Cargas)

### I2 — Implementar la página

- [ ] Crear `src/app/dashboard/cargas/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { getCurrentConsultor } from '@/lib/supabase-browser'
import { parseTsv } from '@/lib/ingest/bookings'
import { matrizARawRows, encabezadosCorresponden } from '@/lib/ingest/archivo'
import type { CargaResponse, RawRow, TipoCarga } from '@/lib/ingest/types'

type Estado = 'inicial' | 'parseando' | 'previsualizado' | 'cargando' | 'cargado'

const TIPOS: Array<{
  id: TipoCarga
  label: string
  extension: string
  accept: string
  nota: string
}> = [
  {
    id: 'bookings',
    label: 'Microsoft Bookings',
    extension: '.tsv',
    accept: '.tsv,text/tab-separated-values,text/plain',
    nota: 'Export crudo de Microsoft Bookings, separado por tabuladores.',
  },
  {
    id: 'sesiones',
    label: 'Registro de sesión',
    extension: '.xlsx',
    accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    nota: 'Excel de evidencias de consultoría.',
  },
]

/**
 * Lee el .xlsx en el navegador. La importación es dinámica para que
 * read-excel-file no entre en el bundle inicial ni en el del Worker.
 */
async function leerXlsx(file: File): Promise<RawRow[]> {
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  return matrizARawRows((await readXlsxFile(file)) as unknown[][])
}

export default function CargasPage() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [tipo, setTipo] = useState<TipoCarga>('bookings')
  const [estado, setEstado] = useState<Estado>('inicial')
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [filas, setFilas] = useState<RawRow[]>([])
  const [previsualizacion, setPrevisualizacion] = useState<CargaResponse | null>(null)
  const [resultado, setResultado] = useState<CargaResponse | null>(null)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    getCurrentConsultor().then((c) => {
      if (vigente) setAutorizado(c?.rol === 'admin')
    })
    return () => {
      vigente = false
    }
  }, [])

  function reiniciar() {
    setEstado('inicial')
    setNombreArchivo(null)
    setFilas([])
    setPrevisualizacion(null)
    setResultado(null)
    setErrorGlobal(null)
  }

  function cambiarTipo(nuevo: TipoCarga) {
    setTipo(nuevo)
    reiniciar()
  }

  async function llamarApi(accion: 'preview' | 'commit', crudas: RawRow[]): Promise<CargaResponse> {
    const res = await fetch('/api/cargas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, tipo, filas: crudas }),
    })
    if (!res.ok) {
      const cuerpo = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(cuerpo.error ?? 'Error inesperado del servidor.')
    }
    return (await res.json()) as CargaResponse
  }

  async function manejarArchivo(file: File) {
    reiniciar()
    setNombreArchivo(file.name)
    setEstado('parseando')

    try {
      const crudas = tipo === 'bookings' ? parseTsv(await file.text()) : await leerXlsx(file)

      if (crudas.length === 0) {
        setErrorGlobal('El archivo no tiene filas de datos.')
        setEstado('inicial')
        return
      }

      if (!encabezadosCorresponden(tipo, Object.keys(crudas[0]!))) {
        const esperado = TIPOS.find((t) => t.id === tipo)!
        setErrorGlobal(
          `Los encabezados no corresponden a ${esperado.label}. ¿Elegiste la pestaña correcta?`,
        )
        setEstado('inicial')
        return
      }

      setFilas(crudas)
      setPrevisualizacion(await llamarApi('preview', crudas))
      setEstado('previsualizado')
    } catch (e) {
      setErrorGlobal(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
      setEstado('inicial')
    }
  }

  async function confirmar() {
    setEstado('cargando')
    try {
      setResultado(await llamarApi('commit', filas))
      setEstado('cargado')
    } catch (e) {
      setErrorGlobal(e instanceof Error ? e.message : 'No se pudo completar la carga.')
      setEstado('previsualizado')
    }
  }

  if (autorizado === null) {
    return <p className="text-sm text-slate-500">Verificando permisos…</p>
  }

  if (!autorizado) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h1
          className="text-lg font-bold text-slate-900"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Cargas
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta sección está disponible solo para administradores.
        </p>
      </div>
    )
  }

  const tipoActual = TIPOS.find((t) => t.id === tipo)!
  const informe = resultado ?? previsualizacion
  const aEscribir = informe ? informe.creadas + informe.actualizadas : 0

  return (
    <div className="space-y-5">
      <header>
        <h1
          className="text-xl font-bold text-slate-900"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Cargas
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          El archivo se lee en tu navegador y se revisa antes de escribir nada.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de carga">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tipo === t.id}
            onClick={() => cambiarTipo(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border cursor-pointer ${
              tipo === t.id
                ? 'bg-[#003087] text-white border-[#003087]'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {t.label}
            <span className="ml-2 text-[11px] font-normal opacity-80">{t.extension}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <p className="text-xs text-slate-500 mb-3">{tipoActual.nota}</p>

        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 cursor-pointer">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            upload_file
          </span>
          Elegir archivo {tipoActual.extension}
          <input
            type="file"
            accept={tipoActual.accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void manejarArchivo(file)
              e.target.value = ''
            }}
          />
        </label>

        {nombreArchivo && (
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-medium">{nombreArchivo}</span>
            {filas.length > 0 && <span className="text-slate-500"> · {filas.length} filas</span>}
          </p>
        )}

        {estado === 'parseando' && (
          <p className="mt-3 text-sm text-slate-500" aria-live="polite">
            Leyendo y revisando el archivo…
          </p>
        )}

        {errorGlobal && (
          <p
            className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
            role="alert"
          >
            {errorGlobal}
          </p>
        )}
      </div>

      {informe && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">
            {resultado ? 'Resultado de la carga' : 'Previsualización'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Contador
              tono="emerald"
              valor={informe.creadas}
              etiqueta={resultado ? 'creadas' : 'se van a crear'}
            />
            <Contador
              tono="sky"
              valor={informe.actualizadas}
              etiqueta={resultado ? 'actualizadas' : 'se van a actualizar'}
            />
            <Contador
              tono="rose"
              valor={informe.fallidas.length}
              etiqueta={resultado ? 'fallaron' : 'con error'}
            />
          </div>

          <ListaIncidencias
            titulo="Errores por fila"
            tono="rose"
            items={informe.fallidas}
            vacio="Ninguna fila con error."
          />

          <ListaIncidencias
            titulo="Avisos"
            tono="amber"
            items={informe.avisos}
            vacio="Ningún aviso."
          />

          {!resultado ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={reiniciar}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => void confirmar()}
                disabled={estado === 'cargando' || aEscribir === 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#003087] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {estado === 'cargando' ? 'Cargando…' : `Cargar ${aEscribir} filas`}
              </button>
              <span className="text-xs text-slate-500">Nada se ha escrito todavía.</span>
            </div>
          ) : (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                onClick={reiniciar}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#003087] cursor-pointer"
              >
                Cargar otro archivo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const TONOS: Record<string, string> = {
  emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  sky: 'text-sky-700 bg-sky-50 border-sky-200',
  rose: 'text-rose-700 bg-rose-50 border-rose-200',
  amber: 'text-amber-800 bg-amber-50 border-amber-200',
}

function Contador({ tono, valor, etiqueta }: { tono: string; valor: number; etiqueta: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${TONOS[tono]}`}>
      <p
        className="text-2xl font-bold leading-none"
        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs font-medium">{etiqueta}</p>
    </div>
  )
}

function ListaIncidencias({
  titulo,
  tono,
  items,
  vacio,
}: {
  titulo: string
  tono: string
  items: Array<{ fila: number; motivo: string }>
  vacio: string
}) {
  return (
    <div className="mt-5">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
        {titulo}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{vacio}</p>
      ) : (
        <ul className={`rounded-xl border divide-y divide-white/60 ${TONOS[tono]}`}>
          {items.map((item, i) => (
            <li key={`${item.fila}-${i}`} className="px-3 py-2 text-xs">
              <span className="font-semibold">Fila {item.fila}</span>
              <span className="mx-1.5 opacity-50" aria-hidden="true">
                ·
              </span>
              <span>{item.motivo}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] Verificar que la importación de `read-excel-file` es dinámica (R11):

Run: `grep -nE "^import .*read-excel-file" src/app/dashboard/cargas/page.tsx`
Expected: sin resultados (exit 1) — solo debe aparecer dentro de un `await import(...)`.

Run: `grep -c "await import('read-excel-file/browser')" src/app/dashboard/cargas/page.tsx`
Expected: `1`

### I3 — Verificar el build y la calidad

- [ ] Correr la suite completa, lint y typecheck:

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: PASS sin regresiones.

- [ ] Verificar que el build pasa. Es el paso que confirma que la importación dinámica no arrastra `read-excel-file` al bundle del Worker:

Run: `npm run build`
Expected: build exitoso, con `/dashboard/cargas` listada como ruta.

### I4 — Verificación manual del flujo completo (paso humano)

- [ ] **PASO HUMANO.** Levantar la app:

Run: `npm run dev`

- [ ] Entrando con una cuenta de rol `admin`, verificar en orden:
  1. El ítem *Cargas* aparece en el menú lateral.
  2. Subir el `.tsv` de bookings en la pestaña **Registro de sesión** → el archivo se rechaza completo por encabezados, sin previsualización de filas (R14).
  3. Subir el `.tsv` en su pestaña correcta → aparece la previsualización con los conteos y, si aplica, los avisos de staff sin consultor.
  4. **Antes de confirmar**, consultar en Supabase `select count(*) from leads` y `select count(*) from consultorias` → los conteos deben ser los mismos que antes de subir el archivo (R7c: el dry-run no escribe).
  5. Confirmar la carga → aparece el reporte final con `creadas` / `actualizadas` / `fallaron`.
  6. Verificar en Supabase que los datos entraron y que `consultorias.booking_id` quedó poblada en las filas nuevas.
  7. Volver a subir **el mismo archivo** → la previsualización debe mostrar todo como *se van a actualizar*, con `creadas` en 0. Eso confirma la idempotencia (D10).
  8. Repetir 3–7 con el `.xlsx` de registro de sesión.
  9. Cargar un `.xlsx` cuyo `Resultado de la sesión` diga "no asistió" y verificar en Supabase que la consultoría quedó con `status = 'No asistió'` y que `nivel_potencia` **no** recibió el texto del resultado. Eso confirma D-3 y D-4 juntos.

- [ ] Entrar con una cuenta de rol `consultor` y confirmar que el ítem *Cargas* no aparece en el menú y que `/dashboard/cargas` muestra el mensaje de solo administradores.

### I5 — Commit de la Work Unit I

- [ ] Commit:

```bash
git add src/app/dashboard/cargas/page.tsx src/app/dashboard/DashboardShell.tsx
git commit -m "feat(ingest): pagina /dashboard/cargas con previsualizacion

El archivo se lee en el navegador y nunca sube en binario: solo viajan
las filas crudas parseadas. read-excel-file entra por import dinamico,
asi que su parser no toca el bundle inicial ni el del Worker.

El cliente no normaliza: parsea, valida encabezados para dar feedback
inmediato ante el archivo equivocado, y toda la clasificacion por fila
viene del dry-run del servidor.

El item del menu usa el patron adminOnly que ya existia para
Consultores. La autorizacion real vive en /api/cargas: el filtro del
menu solo oculta el enlace."
```

---

## Cierre

### Verificación final

- [ ] Suite completa, lint, typecheck y build:

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build`
Expected: todo PASS.

- [ ] Confirmar que `src/lib/metricas.ts` no fue modificado en toda la rama:

Run: `git diff --stat main -- src/lib/metricas.ts`
Expected: sin salida.

- [ ] Confirmar que `n8n/` no fue modificado:

Run: `git diff --stat main -- n8n/`
Expected: sin salida.

- [ ] Confirmar que los módulos de ingesta no usan APIs de entorno:

Run: `grep -rnE "document|window\.|fetch\(|toLocale|getHours|getMinutes" src/lib/ingest/`
Expected: sin resultados (exit 1).

### Qué queda fuera, deliberadamente

Anotado acá para que no se pierda al archivar el cambio:

1. **Retirar n8n.** `n8n/WF-2-corregido.json` y `n8n/WF-3-corregido.json` siguen en el repo y los workflows siguen encendidos. Apagarlos y borrarlos es un cambio aparte, después de validar el módulo con cargas reales.
2. **Deduplicar consultorías.** WF-2 siempre insertó, así que la base tiene duplicados. Por eso este cambio no crea un índice único sobre `booking_id`. Limpiarlos es destructivo y va en su propio cambio.
3. **Limpiar `nivel_potencia` contaminado.** El trigger viejo escribió texto de `resultado` en esa columna. Este cambio detiene la contaminación pero no limpia lo ya escrito, que sigue apareciendo como buckets falsos en la distribución de nivel de potencia (`metricas.ts:1033`, `insights-context.ts:117`).
4. **`bookings_entrante` y `trg_bookings_after_insert`.** La exploración confirmó que nada inserta en esa tabla: es código muerto. No se toca acá.
5. **Columnas vestigiales.** `consultorias.id_reserva` (y `id_externo`, si existe en la base) se conservan. Eliminarlas es destructivo.
6. **Autenticación de `/api/insights/route.ts`.** Usa `service_role` sin verificar sesión. Gap preexistente, sin relación con este cambio.
7. **Los cambios de LEADS** — estado no dinámico en la card, quitar sector, regla del agendamiento mostrado, arreglo del filtro de consultor. Es el cambio B, que se especifica aparte una vez este esté validado.
