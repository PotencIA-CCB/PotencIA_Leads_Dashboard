# Proposal: Insights from Registro Sesion — Fix Display, Enrich Prompt, Auto-Generate

## Intent

Registered session data (`pregunta`, `motivo_consulta`) is not reaching the AI prompt, the `insights` table schema is misaligned with the flat-column migration, and the frontend never regenerates insights if stale rows exist — producing empty "Sin datos" columns.

## Scope

### In Scope
- Apply `20260520_insights_flat.sql` migration (drain old rows first)
- Add `pregunta` and `motivo_consulta` to `buildImpactContext()` query and AI prompt
- Check insert error response in POST handler (defensive fix)
- Frontend: regenerate insights on every page load (skip GET-first pattern)
- Client-side cache (5-min `sessionStorage`) to avoid redundant API calls during navigation

### Out of Scope
- Cron-based or Edge Function insight generation
- Schema migration-in-place (keeping old rows)
- Adding `estimacion_impacto` or `metodologia_aplicada` to prompt (deferred)

## Capabilities

### New Capabilities
- `insights-schema-flat`: Flat-column `insights` table with `tipo`, `metrica`, `valor_texto`, `descripcion`, `fuente`, `periodo_inicio`, `periodo_fin`, `id_consultor`
- `insights-prompt-enriched`: AI prompt receives `pregunta` and `motivo_consulta` from `registro_sesion` alongside existing session fields
- `insights-auto-generate`: Frontend always calls POST `/api/insights` on dashboard mount, bypassing GET-first; falls back to stored insights on API failure
- `insights-defensive-insert`: POST handler checks `{ error }` from Supabase insert and returns 500 on failure

### Modified Capabilities
None — `session-data-insights` spec covers original fields only; enriched prompt is a new capability.

## Approach

Incremental fix in three independent work units: (1) database — drain old rows and apply flat migration; (2) API — add `pregunta`/`motivo_consulta` to prompt context and guard the insert; (3) frontend — replace GET-first with auto-generation on mount.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/20260520_insights_flat.sql` | Applied | Migration applied after draining old rows |
| `src/lib/insights-context.ts` | Modified | Add `pregunta`, `motivo_consulta` to query + prompt samples |
| `src/app/api/insights/route.ts` | Modified | Check insert error; enrich `buildImpactContext` call |
| `src/app/dashboard/metricas/page.tsx` | Modified | Skip GET-first; always POST; add sessionStorage cache |
| `src/lib/metricas.ts` | **No impact** | Pure functions — this change only affects AI prompt and API |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Old migration aborts with existing rows | Medium | Drain table via Supabase dashboard before applying |
| DeepSeek token budget exceeded with free-text fields | Low | Keep 30-sample cap; truncate long text to 200 chars |
| API cost increase from per-page-load generation | Medium | Client-side cache (5-min TTL) in `sessionStorage` |
| Insert errors silently swallowed | Low | Check `{ error }` and return 500 — captured by `defensive-insert` |

## Rollback Plan

1. **Database**: If migration fails or outputs wrong schema, restore from Supabase backup (point-in-time recovery). Old `contenido jsonb` table is compatible with old code.
2. **API**: Revert `route.ts` and `insights-context.ts` via `git revert`. No migration rollback needed — flat columns are additive.
3. **Frontend**: Revert `page.tsx` to GET-first pattern. Stored insights still work as fallback.

## Success Criteria

- [ ] `insights` table has flat columns (`tipo`, `metrica`, etc.) and accepts inserts without error
- [ ] AI prompt includes `pregunta` and `motivo_consulta` text for at least 5 session samples
- [ ] Dashboard renders insights/recommendations/alertas on first page load (no manual "Actualizar")
- [ ] Existing `metricas.ts` tests pass (88 tests, zero regressions)
- [ ] `npm run build` succeeds
