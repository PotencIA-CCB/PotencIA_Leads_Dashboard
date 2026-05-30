# Insights Auto-Generate

## Purpose

Dashboard always generates fresh insights on mount via POST `/api/insights`, bypassing the current GET-first pattern. Uses client-side cache (5-min `sessionStorage` TTL) to avoid redundant API calls during navigation.

## Requirements

| # | Requirement | Strength |
|---|-------------|----------|
| R1 | Dashboard mount MUST call POST `/api/insights` (not GET-first) to trigger AI generation | MUST |
| R2 | Successful response SHALL be cached in `sessionStorage` keyed by `insights_cache` with a 5-minute TTL | SHALL |
| R3 | On cache hit within TTL, page MUST skip the POST API call and render from cache | MUST |
| R4 | On API failure (POST error), page SHALL fall back to GET `/api/insights` to display stored insights | SHALL |
| R5 | Cached data MUST clear on tab close (sessionStorage lifetime) | MUST |

### Scenario: First page load triggers generation

- GIVEN no `insights_cache` in sessionStorage
- WHEN dashboard page mounts
- THEN POST `/api/insights` is called
- AND response is rendered and cached with `expiresAt = now + 5min`

### Scenario: Tab navigation within TTL

- GIVEN `insights_cache` exists and `expiresAt > now`
- WHEN user navigates back to dashboard (same tab, within 5 min)
- THEN no API call is made
- AND cached insights are rendered immediately

### Scenario: Cache expired, regeneration

- GIVEN `insights_cache.expiresAt < now`
- WHEN dashboard mounts
- THEN POST `/api/insights` is called again
- AND new response replaces stale cache

### Scenario: API failure, stored fallback

- GIVEN POST `/api/insights` returns an error or 5xx
- WHEN dashboard handles the failure
- THEN GET `/api/insights` fetches most recent stored rows
- AND stored insights render in place of generated ones
