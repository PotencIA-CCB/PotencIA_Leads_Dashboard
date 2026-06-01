# Word Cloud — AI Filter and Landing-Form Data Source

## Purpose

Switch the word cloud data source from `registro_sesion.pregunta` to
`formularios_landing.descripcion`, and introduce a pure function `filterByAiTerms()` that
narrows the token set to AI/automation vocabulary only, so the cloud surfaces prospect intent
rather than generic session text. `filterByAiTerms()` is unit-tested under Strict TDD (Vitest,
test-first, co-located in `src/lib/__tests__/wordcloud-filter.test.ts`).

## Out of Scope

- `/dashboard/bi` page — untouched.
- `src/lib/metricas.ts` — no changes to pure aggregation logic.
- Any canvas-based or DOM-measuring word-cloud library (forbidden by Cloudflare Workers runtime).
- CSS-flex tag-cloud rendering logic — preserved unchanged.
- Spatial/true-cloud layout algorithm — CSS flex linear layout is accepted.
- Stopword list and accent-stripping logic inside `processText()` — reused as-is, not redefined here.

## Function Contract: `filterByAiTerms()`

```ts
// Pure function — no side effects, no I/O
function filterByAiTerms(
  tokenFrequencies: Array<{ text: string; value: number }>
): Array<{ text: string; value: number }>
```

- **Input**: array of `{ text, value }` objects produced by `processText()`, where `text` is an
  already accent-stripped, lowercased token and `value` is its frequency count.
- **Output**: subset of the input where `text` exactly matches at least one term in the
  AI/automation allowlist (see R5). Order of output entries is not specified.
- **Pure**: same input always yields same output; no mutation of the input array.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | `filterByAiTerms` MUST be a pure function exported from `WordCloud.tsx` (or a co-located module) | MUST |
| R2 | The word cloud data source MUST be `formularios_landing.descripcion`; the `registro_sesion.pregunta` query for the cloud MUST be removed from `metricas/page.tsx` | MUST |
| R3 | The rendering pipeline SHALL be: raw `descripcion` text → `processText()` → `filterByAiTerms()` → CSS-flex cloud | SHALL |
| R4 | `filterByAiTerms` MUST accept tokens already processed by `processText()` (accent-stripped, lowercased, stopwords removed) | MUST |
| R5 | The allowlist MUST contain at minimum the following accent-stripped lowercase terms: `automatizacion`, `inteligencia`, `artificial`, `agentes`, `bots`, `chatbot`, `machine`, `learning`, `nlp`, `gpt`, `rpa`, `digitalizacion`, `automatizar`, `ia`, `llm`, `modelo`, `datos`, `procesos` | MUST |
| R6 | Allowlist matching MUST be case-insensitive (input tokens are pre-lowercased by `processText()`, so exact string equality on lowercased strings is sufficient) | MUST |
| R7 | Allowlist matching MUST be accent-insensitive: an accented input token (e.g. `"automatización"`) MUST match the allowlist entry `"automatizacion"` after accent-stripping | MUST |
| R8 | Tokens that do not appear in the allowlist MUST be excluded from the output | MUST |
| R9 | `filterByAiTerms` MUST NOT mutate the input array | MUST |
| R10 | When `formularios_landing.descripcion` rows yield no AI-matching tokens after `processText()` + `filterByAiTerms()`, the word cloud SHALL render an explicit empty-state (e.g. "Sin términos AI encontrados") | SHALL |
| R11 | When `formularios_landing.descripcion` has zero rows (table empty or all NULL), the empty-state MUST be displayed without a runtime error | MUST |
| R12 | Duplicate tokens across multiple `descripcion` rows MUST be aggregated (summed `value`) before filtering — this is handled by `processText()` and MUST be preserved in the pipeline | MUST |
| R13 | Unit tests for `filterByAiTerms()` MUST be written BEFORE the implementation (TDD: red → green) and MUST live in `src/lib/__tests__/wordcloud-filter.test.ts` | MUST |
| R14 | No canvas or DOM-measuring word-cloud library MAY be introduced | MUST NOT |
| R15 | `npm run build` MUST succeed with the new data source wired | MUST |

### Scenario: Matched AI term passes through

- GIVEN `filterByAiTerms` receives `[{text:"automatizacion",value:5}]`
- WHEN called
- THEN the output is `[{text:"automatizacion",value:5}]`

### Scenario: Non-AI word is excluded

- GIVEN `filterByAiTerms` receives `[{text:"empresa",value:3},{text:"chatbot",value:7}]`
- WHEN called
- THEN the output is `[{text:"chatbot",value:7}]`
- AND `{text:"empresa",value:3}` is NOT present in the output

### Scenario: Accented input matches allowlist entry

- GIVEN a raw `descripcion` containing "automatización de procesos"
- WHEN `processText()` is applied (accent-strip + lowercase)
- THEN the token list contains `"automatizacion"` and `"procesos"`
- WHEN `filterByAiTerms()` is then applied
- THEN `"automatizacion"` is in the output (matches allowlist)
- AND `"procesos"` is also in the output (matches allowlist entry `"procesos"`)

### Scenario: Accented allowlist term — direct input test

- GIVEN `filterByAiTerms` receives `[{text:"automatizacion",value:2}]`
  (token has already been accent-stripped by `processText()`)
- WHEN called
- THEN the output contains `{text:"automatizacion",value:2}`

### Scenario: Empty input array

- GIVEN `filterByAiTerms` receives `[]`
- WHEN called
- THEN the output is `[]`
- AND no error is thrown

### Scenario: No tokens match allowlist

- GIVEN `filterByAiTerms` receives `[{text:"empresa",value:1},{text:"reunion",value:2}]`
- WHEN called
- THEN the output is `[]`

### Scenario: Empty-state rendered when no AI terms found

- GIVEN `formularios_landing.descripcion` rows exist but contain no AI vocabulary
- WHEN the word cloud component renders
- THEN no word tags are displayed
- AND an empty-state message is visible (e.g. "Sin términos AI encontrados")
- AND no runtime error is thrown

### Scenario: Empty-state rendered when table has zero rows

- GIVEN the Supabase query for `formularios_landing.descripcion` returns an empty array
- WHEN the word cloud component renders
- THEN the empty-state message is displayed
- AND no runtime error is thrown

### Scenario: Data source is formularios_landing.descripcion

- GIVEN the page component source (`metricas/page.tsx`)
- WHEN inspected
- THEN the Supabase query for the word cloud targets `formularios_landing` table, `descripcion` column
- AND there is no active query fetching `registro_sesion.pregunta` for word cloud input

### Scenario: Input array is not mutated

- GIVEN `filterByAiTerms` receives an input array `original`
- WHEN called
- THEN `original` reference and its elements are unchanged after the call
