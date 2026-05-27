# Insights JSON Response

## Purpose

Ensure the DeepSeek API returns structured JSON by adding `response_format: json_object` and improve error diagnostics.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | The DeepSeek API call in `insights/route.ts` MUST include `response_format: { type: "json_object" }` | MUST |
| R2 | On non-JSON response, error logging SHALL capture the raw response shape (type + first 200 chars) for debugging | SHALL |
| R3 | The existing markdown-stripping fallback parser SHOULD remain as a safety net | SHOULD |

### Scenario: Structured response returned

- GIVEN a valid prompt is sent to DeepSeek
- WHEN the model returns a JSON-compliant response
- THEN `JSON.parse()` succeeds without "forma inesperada" error
- AND insights are parsed correctly

### Scenario: Non-JSON response handled gracefully

- GIVEN DeepSeek returns non-JSON despite `json_object` mode
- WHEN the route processes the response
- THEN error log records `{ responseType, responsePreview }`
- AND a 500 response is returned with a descriptive message
