# Task 027F — Attendee roster (ACT-ROSTER) implementation report

**Date:** 2026-10-29  
**Policy:** Conservative — host or CONFIRMED participant; CONFIRMED attendees only; D-03 previews.  
**Status:** COMPLETE (backend). Task 027 closed in **027I** (027G/H skipped).

## API

`GET /v1/activities/:activityId/participants`

| Query | Purpose |
|---|---|
| `limit` | Page size (default 20, max 50) |
| `cursor` | `joinedAt` + `userId` opaque cursor |
| `preview=true` | Caps `limit` at **5** for Screen 12 avatar stack |

**Response:** `{ activityId, confirmedCount, attendees[{ userId, profile, confirmedAt }] }` + `meta.nextCursor`.

## Source

- `activity-roster-policy.ts` — access gate
- `activity-roster.service.ts` — list + D-03 redaction + blocks
- `activities.routes.ts` / `activities.controller.ts`

## Verification

| Gate | Result |
|------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run build` | pass |
| Unit tests | **258/258** passed (+4 policy cases) |
| Integration `activity-roster-027f` | **4/4** passed (Neon `strangeup_test`) |
| Integration 027E (incl. SEC-08) | **11/11** passed |

## Unresolved risks

- Roster does not include **host** in attendee list (CONFIRMED participations only — host typically does not RSVP). Flutter should compose host separately if Figma requires host in the stack.
- Suspended/deleted attendees remain CONFIRMED rows until leave/cancel; profile may redact per D-03.
- No server-side avatar bytes on roster ( `hasAvatar` only).

## MDWQ

- **MDWQ-0704** → **COMPLETED**
- **MDWQ-0717** → **COMPLETED** (conservative policy implemented)
