# D-04 — Location in discovery MVP

**Status:** **APPROVED** (2026-10-27) — implemented Task **009** (people discovery slice)

## Rules

- Expose only self-reported `locationCity` and `locationRegion` (max 80 chars) on authorized public DTOs.
- No coordinates, geocoding, distance, radius, maps, ranking by proximity, or server “verified location” flag.
- Optional filters: exact case-insensitive `city` and `region` query params on `GET /v1/discover/people` only.
- Clearing location via own `PATCH /v1/me/profile` (`null`) removes values from future public exposure.

**Deferred:** geo search, meetup distance, activity location, verified-location badge semantics.
