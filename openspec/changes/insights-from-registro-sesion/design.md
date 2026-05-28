# Design: Insights from Registro Sesion — Fix Display, Enrich Prompt, Auto-Generate

## Technical Approach

Three independent work units addressing root causes: (1) drain old jsonb rows + apply flat-column migration to unblock inserts, (2) add `pregunta`/`motivo_consulta` to `buildImpactContext()` prompt, (3) replace GET-first frontend with POST-always + `sessionStorage` cache. Each unit is independently testable and reversible.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Schema alignment | Drain old rows → apply existing `20260520_insights_flat.sql` | Write data-migration script that converts jsonb → flat columns | Dev dashboard with no production dependency on old `insights`; drain is zero-risk, migration script adds complexity without value |
| Prompt enrichment | Add `pregunta` + `motivo_consulta` as new sections, capped at 30 samples × 200 chars each | Send raw text, add summarization step | Token budget is 700 max_tokens; capping prevents budget overrun while giving AI enough signal |
| Auto-generation strategy | POST on mount, `sessionStorage` cache with 5-min TTL | Always POST (no cache), cron/Edge Function | Prevents redundant API calls during SPA navigation; $0.002/call × frequent page visits adds up |
| Insert error guard | `const { error } = await supabase.from('insights').insert(rows)` → 500 if error | Retry logic, silent fallback | Blocking posture is correct for schema mismatches; silently swallowing hides bugs (as exploration proved) |

## Data Flow

```
Page mount → sessionStorage.get('insights_cache')
  → <5 min? → render cached, done
  → else:
    POST /api/insights { minNew: 0 }
      ├─ Stage A (Promise.all): lastInsight + consultorias + novedades + buildImpactContext
      │   └─ buildImpactContext → consultorias(30d) + picos(4w) + registro_sesion(pregunta, motivo_consulta, acciones, estado, resultado) → sections
      ├─ Threshold: minNew=0 always passes
      ├─ Stats: total, tasa%, service distrib, growth7d
      ├─ Prompt: DATA + IMPACTO (with pregunta/motivo sections) + NOVEDADES
      ├─ DeepSeek (temp=0.7, max_tokens=700, json_object)
      ├─ Parse (3 strategies: direct → extract → repair)
      ├─ Insert flat rows with error check → 500 if fail
      └─ Return { insights, recomendaciones, alertas }
    → setInsights(data), sessionStorage.set('insights_cache', data, ttl=5min)
    → render 3-column grid
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260520_insights_flat.sql` | Applied | Drain old rows via Supabase dashboard, then apply migration (no code change needed — migration already written) |
| `src/lib/insights-context.ts` | Modify | Add `pregunta`, `motivo_consulta` to `SesionRow` type, query, and build "PREGUNTAS DE LEADS" + "MOTIVOS DE CONSULTA" sections in output |
| `src/app/api/insights/route.ts` | Modify | Line 365: `const { error: insError } = await supabase.from('insights').insert(rows)`; if `insError`, return 500 |
| `src/app/dashboard/metricas/page.tsx` | Modify | Replace `cargarUltimoInsight()` GET-first with POST-always; add `sessionStorage` cache check before POST |
| `src/lib/__tests__/insights-context.test.ts` | Create | TDD tests: `pregunta`/`motivo_consulta` appear in output; text truncated at 200 chars |
| `src/app/api/insights/__tests__/route.test.ts` | Modify | Add: insert failure → 500 with `reason: 'insert_failed'` |

## Interfaces / Contracts

`buildImpactContext` return type unchanged (`Promise<string>`). New sections in output:

```
PREGUNTAS DE LEADS (muestra):
  - ¿Cómo automatizar mi proceso de ventas?
  - Necesito crear un agente de atención al cliente
MOTIVOS DE CONSULTA (muestra):
  - Optimización de procesos internos
  - Implementación de IA generativa
```

POST response gains error path: `{ error: string, reason: 'insert_failed', detail: string }` with status 500.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `buildImpactContext` includes `pregunta`/`motivo_consulta` | New `insights-context.test.ts`: mock Supabase returning `registro_sesion` rows with those fields; assert output contains "PREGUNTAS DE LEADS" |
| Unit | Text truncation at 200 chars | Same file: row with 300-char `pregunta` → output shows only first 200 |
| Unit | POST returns 500 on insert failure | Modify `route.test.ts`: mock `insert` to return `{ error: { message: 'column "tipo" does not exist' } }` → assert status 500 |
| Regression | 88 existing tests + 10 route tests unbroken | `npm test` — all must pass before and after |

## Migration / Rollout

- **DB drain**: Manual step — run `DELETE FROM public.insights` in Supabase SQL editor before migration applies. No downtime needed (dev environment).
- **Migration**: Already written — simply ensure it runs after drain. If it already ran but old rows re-accumulated, drain and re-run.
- **API**: Deploy code changes; no migration dependency. If insert still fails → error is now surfaced as 500, not swallowed.
- **Frontend**: Client-side only — cache in `sessionStorage` is transparent.
- **Rollback**: `git revert` on each file; re-insert old jsonb rows from backup if needed.

## Open Questions

- None — all three root causes have clear, independently verifiable fixes.
