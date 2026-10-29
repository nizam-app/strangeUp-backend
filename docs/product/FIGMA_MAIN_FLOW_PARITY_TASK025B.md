# Main Flow Figma parity — Task 025B (Discover / Screen 09)

**Date:** 2026-10-28  
**Evidence:** `Screen 09_ Discover/Nearby People.pdf` in `design-reference/task025-main-flow/`  
**Scope:** Discover people list + public profile target policy; **025C not started**.

## Privacy / activation fix (025B)

Discovery **targets** now require the same **Task 022 / ADR-005** activation as viewers (`isDiscoverablePublicProfileTarget` → trusted KYC + admin `APPROVED` tied to current `identityVerificationSessionId`). Email-verified-only or provider-approved/admin-pending users **no longer appear** in `GET /v1/discover/people`, `GET /v1/home` → `people`, or public profile detail/avatar.

## Screen 09 action matrix

| Figma control | API | Status |
|---|---|---|
| Discover tab / screen | `GET /v1/discover/people` | **MATCHED** |
| List / Map toggle | — | **FLUTTER-ONLY** (map); no map API (**DEFERRED** D-04) |
| Search people or activities | `q` on discover (people); activities → `/v1/activities` (025C) | **PARTIAL** |
| Within 5 mi | — | **NEEDS DECISION** / **DEFERRED** (D-04) — use `city`/`region` only |
| Today | — | **NEEDS DECISION** (activity context; no approved rule) |
| Activity chip filter | `interest={catalogSlug}` | **MATCHED** (e.g. padel → slug from `GET /v1/interests`) |
| Age 22–35 | — | **NEEDS DECISION** (DOB privacy; no approved filter) |
| Verified filter | All discoverable targets are activation-verified | **IMPLICIT** — no separate query param (UI redundant post-025B) |
| Nearest first | Order remains `createdAt` asc, `id` asc | **DEFERRED** (D-04) |
| Distance / last-active labels | — | **NOT IMPLEMENTED** (COPY-TRUST / D-04) |
| Nearby People (N active) | — | **FLUTTER-ONLY** — no server active count |
| View Profile | `GET /v1/users/{userId}` | **MATCHED** |
| Say Hi / Wave | `POST /v1/users/{userId}/waves` | **MATCHED** |
| Follow / Message | Social routes (Task 011) | **MATCHED** (from profile) |

## Supported query params (unchanged contract)

`limit`, `cursor`, `q`, `city`, `region`, `interest` — strict schema; unknown `interest` slug → `400`.

## Open decisions

- **D-04** — radius, map pins, nearest-first, miles, last-active  
- **DISC-FILTERS** — Today, age band, combined people+activities search  
- **COPY-TRUST** — “48 active”, verification badges on cards  
