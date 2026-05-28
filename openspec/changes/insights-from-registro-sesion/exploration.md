## Exploration: Insights from registro_sesion + Fix Display + Auto-Generate

### Current State

The insights pipeline works in two phases:

**Phase 1 — Storage (POST `/api/insights`)**:
1. `buildImpactContext(supabase)` fetches consultorias (30d), weekly aggregates, and `registro_sesion` fields (`acciones_realizadas`, `estado_inicial`, `resultado_final`).
2. Stats computed: total consultorias, tasa conversion, service distribution, 7d growth.
3. Prompt built with stats + impact context + novedades.
4. DeepSeek API called with `response_format: { type: "json_object" }`.
5. Response parsed (3-layer fallback: raw parse → balanced-brace extraction → repair trailing commas/newlines).
6. Results inserted into `insights` table (flat schema: `tipo`, `metrica`, `valor_texto`, etc.).

**Phase 2 — Display (GET `/api/insights` + frontend)**:
1. GET selects all from `insights`, ordered by `created_at` desc, limit 50.
2. Frontend `cargarUltimoInsight()` filters by `tipo` → maps to `{ insights, recomendaciones, alertas }`.
3. Three-column grid renders via `InsightColumn` component.
4. If DB is empty on first visit → triggers `generarInsights()` (POST) with `minNew: 0`.

### Affected Areas

- `supabase/migrations/20260520_insights_flat.sql` — schema migration that drops old jsonb table, recreates with flat columns. Pre-flight guard blocks if rows exist.
- `src/app/api/insights/route.ts` — POST handler (lines 82-395): data fetching, prompt construction, AI call, parsing, insert. GET handler (lines 20-30).
- `src/lib/insights-context.ts` — `buildImpactContext()`: queries `registro_sesion` columns sent to AI prompt (lines 32-88).
- `src/app/dashboard/metricas/page.tsx` — `cargarUltimoInsight()` (lines 34-55) and `generarInsights()` (lines 73-106). Rendering at lines 247-272.
- `src/types/index.ts` — `Insight` interface (lines 82-94) matches flat schema; `RegistroSesion` interface (lines 96-113) defines all available columns.

### Root Cause of "No Display" Bug

**Schema mismatch between code and database.** The `insights` table was originally created with `contenido jsonb` schema (migration `20260519_insights.sql`). Migration `20260520_insights_flat.sql` drops and recreates the table with flat columns (`tipo`, `metrica`, `valor_texto`, `descripcion`, `fuente`, `periodo_inicio`, `periodo_fin`, `id_consultor`). However, the migration has a pre-flight guard:

```sql
if (select count(*) from public.insights) > 0 then
  raise exception '...Drain or archive data before applying.';
end if;
```

If the original `contenido jsonb` table has any rows, the migration aborts. This means:

1. **POST silently fails**: `supabase.from('insights').insert(rows)` at line 365 does not check the return error. Supabase JS client returns `{ error }` instead of throwing on insert failures. If columns don't match (e.g., `tipo` doesn't exist), the insert silently fails.
2. **GET returns old-format rows**: The old schema has `contenido jsonb`, `contexto_kpis jsonb`, `generado_por`, `id_consultor` — no `tipo` column. GET returns these rows as-is.
3. **Frontend filtering yields empty arrays**: `data.filter(r => r.tipo === 'insight')` where `r.tipo` is `undefined` → all three arrays are empty.
4. **"Sin datos" rendered**: `InsightColumn` receives empty arrays → displays "Sin datos" in each column (line 283-284 in page.tsx).

**Evidence chain**: The POST response at line 368 returns `{...parsed, _meta: {...}}` with valid insight strings. But the insert at line 365 never persisted them. The GET at line 22-28 returns stale old-format rows (or nothing). Frontend receives truthy `insights` object (non-null) with empty arrays → renders empty columns.

### Additional Issues

#### 1. Missing `registro_sesion` fields in AI prompt

`buildImpactContext()` currently queries: `id_consultoria, cantidad_productos, acciones_realizadas, estado_inicial, resultado_final`.

But the user's requirement specifies these fields from `registro_sesion` should feed analysis:
- `pregunta` — what the lead asked (currently ONLY used for the word cloud, line 63 of page.tsx)
- `motivo_consulta` — why they came in
- `acciones_realizadas` — ✅ already included
- `estado_inicial` — ✅ already included
- `resultado_final` — ✅ already included

The `pregunta` and `motivo_consulta` fields are the richest for understanding lead intent. They are entirely absent from the AI prompt. The existing `RegistroSesion` type (types/index.ts lines 96-113) and migration (`20260519_registro_sesion.sql`) confirm these columns exist.

Also missing from the TypeScript fetch type but available in the DB:
- `estimacion_impacto` — business impact estimation
- `metodologia_aplicada` — methodology used

#### 2. Auto-generation on every page load

Current behavior (`cargarUltimoInsight`, line 34-55):
1. GET `/api/insights`
2. If array non-empty → parse stored insights → render (NO regeneration)
3. If array empty → POST to generate

Desired behavior: Always generate fresh insights on every page load, bypassing the GET-first approach. The POST handler already supports this via `minNew: 0` bypassing the threshold check. The change is purely in the frontend `useEffect` logic.

#### 3. Missing error check on insert (defensive gap)

Line 364-366 in route.ts:
```typescript
if (rows.length > 0) {
  await supabase.from('insights').insert(rows)
}
```

The returned `{ error }` is not checked. If the insert fails (schema mismatch, RLS, constraint violation), the API responds with 200 and generated content, but nothing is persisted. This masks schema issues.

### Approaches

#### 1. **Incremental fix (recommended)** — Fix schema, enrich prompt, auto-generate

- **Database**: Apply `20260520_insights_flat.sql` migration. If old rows exist, either: (a) drain the table first, or (b) write a new migration that adds flat columns alongside the existing jsonb columns and migrates data. Since this is a dev/early-stage dashboard, draining is simpler and recommended.
- **API**: Add `pregunta` and `motivo_consulta` to `buildImpactContext()` query and session samples. Check insert error response.
- **Frontend**: Change `cargarUltimoInsight` to always call `generarInsights()` directly (skip GET-first). Keep the manual "Actualizar" button for on-demand refresh. Optionally still render stored insights as loading fallback.
- **Pros**: Minimal blast radius, addresses all 3 user requirements, each fix is independently verifiable.
- **Cons**: None significant.
- **Effort**: Low

#### 2. **Rewrite POST handler to use old JSONB schema**

- Keep the `contenido jsonb` column but change the frontend parsing to extract from JSONB.
- **Pros**: No migration needed.
- **Cons**: Adds complexity to frontend parsing, goes against the already-written flat migration, diverges from the `Insight` type definition, ignores the migration intent.
- **Effort**: Medium
- **Risks**: Tech debt accumulation, inconsistency with types.

#### 3. **Edge Function approach**

- Move insight generation to a Supabase Edge Function that runs on a cron.
- **Pros**: Decouples from page load, can run periodically.
- **Cons**: Overkill for current needs, adds deployment complexity, user wants page-load generation not cron.
- **Effort**: High

### Recommendation

**Approach 1: Incremental fix.** Three independent work units:

1. **Schema alignment**: Apply (or re-apply) the flat migration. If the table has old rows, drain first.
2. **Enrich AI prompt**: Add `pregunta` and `motivo_consulta` to `buildImpactContext()`.
3. **Auto-generate**: Modify frontend to always generate on page load (skip GET-first), with stored insights as fallback.

Each can be implemented, tested, and verified independently.

### Risks

- **Migration might need manual intervention**: If the cloud DB has old rows, the `insights_flat` migration will abort. Need to either drain the table first or write a new migration that handles migration-in-place.
- **Token budget**: Adding `pregunta` and `motivo_consulta` text fields to the prompt increases token usage. The current cap of 30 session samples in `buildImpactContext` helps. Consider summarizing/categorizing free-text rather than sending raw.
- **API cost**: Auto-generating on every page load means more DeepSeek API calls. Consider a short client-side cache (e.g., `sessionStorage` with 5-minute TTL) to avoid redundant calls during navigation.
- **Empty state UX**: If the API call fails or times out (25s timeout), the user sees an error message instead of insights. The current error handling is adequate but could benefit from showing stale insights as fallback.

### Ready for Proposal

Yes — the root cause is clear, the fixes are well-scoped, and each work unit is independently deliverable.
