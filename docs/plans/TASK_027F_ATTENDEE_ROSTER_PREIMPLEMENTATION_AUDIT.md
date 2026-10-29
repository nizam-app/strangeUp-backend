# Task 027F — Attendee roster pre-implementation audit (ACT-ROSTER)

**Date:** 2026-10-29  
**Status:** AUDIT ONLY — **no roster routes implemented**  
**Gate:** Owner privacy decision **MDWQ-0704 / ACT-ROSTER** (unchanged)  
**Preserves:** D-09 hybrid joining, Task 010 meeting privacy, D-03 public profile rules

## Figma evidence (Screen 12)

Source: `design-reference/task027-activities-post-membership/Screen 12_ Activity Details.pdf` (manifest in `MANIFEST.md`).

| UI | Backend today | Audit |
|---|---|---|
| Row of attendee **faces** (stacked avatars) | No participant list on `GET /v1/activities/:id` | **MISSING** — needs roster API + visibility policy |
| **See All (N)** | No paginated roster | **MISSING** — same |
| “100% ID Verified Attendees” | No aggregate KYC % API | **DO NOT SHIP** (invented metric) |
| Host stats (reviews, Superhost, meetup counts) | Not in activity modules | **DO NOT SHIP** |
| Public `confirmedCount` / spots | Count of `CONFIRMED` participations only | **MATCHED** — safe aggregate, no identities |

Parity reference: `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027A.md` § Screen 12.

## Current source surfaces (identity exposure)

| Surface | Exposes other users? | Notes |
|---|---|---|
| `GET /v1/activities/:id` | Host preview only (D-03) | `myParticipation` is **viewer-only** |
| `GET /v1/activities/:id/meeting` | No identities | CONFIRMED (+ KYC) only |
| `GET /v1/me/activities/:id/join-requests` | **Host-only** applicants (PENDING/DECLINED/approved WAITLISTED) | Minimal `PublicProfilePreview`; not a roster |
| `GET /v1/me/activity-inventory` | Host preview per card | No co-attendee list |
| `GET /v1/me/activity-rsvps` | Self participation + public activity card | No co-attendee list |
| Discovery / home people | Unrelated to activity membership | Must not substitute for roster |

**Leak risk if roster added carelessly:** reusing join-request list as “See All” would expose PENDING/DECLINED applicants to wrong audiences; exposing WAITLISTED as “attending”; returning email/KYC fields; bypassing blocks.

## Participation states → recommended visibility (proposal — owner approval required)

| State | Host manage / join-requests | Proposed roster (if ACT-ROSTER approved) | Public detail faces | Meeting |
|---|---|---|---|---|
| **CONFIRMED** | Count + join-requests N/A | **Include** in confirmed roster (subject to D-03 + blocks) | **Optional** face strip if policy allows confirmed-only public preview | Eligible when KYC OK |
| **WAITLISTED** (capacity queue) | Approved waitlist tab (HOST_APPROVAL) | **Exclude** from “going” roster; optional separate host-only queue (already have join-requests `status=waitlisted`) | **Exclude** | **Deny** |
| **PENDING** (host approval) | Host join-requests `status=pending` | **Exclude** from attendee roster; host moderation only | **Exclude** | **Deny** |
| **DECLINED** | Host `status=declined` | **Exclude**; historical row not shown in roster | **Exclude** | **Deny** |
| **CANCELLED** | Hidden from active counts | **Exclude** | **Exclude** | **Deny** |
| Revoked/suspended applicant | Approve **409**; may still hold PENDING until decline/withdraw | **Exclude** while ineligible; do not delete row silently | N/A | **Deny** |
| Blocked viewer ↔ participant | Block policy | **Omit** participant from viewer’s roster (or 404 entire roster — prefer **omit** to avoid size oracle) | Redact/hide per D-03 | **Deny** |

## Minimal read-only roster proposal (DO NOT IMPLEMENT until owner signs ACT-ROSTER)

**Option A (conservative — aligns with D-ACTIVITIES-TASK010 ACT-ROSTER row):**

- `GET /v1/me/activities/:activityId/participants` — **host only**, paginated CONFIRMED (+ optionally approved WAITLISTED as “waitlist queue”, labeled separately).
- `GET /v1/activities/:activityId/participants` — **confirmed participants only**, each row `PublicProfilePreview` + `userId`, cursor pagination; viewer must be **CONFIRMED** on same activity (or host). No PENDING/DECLINED.

**Option B (Figma-forward — higher privacy risk):**

- Public detail includes capped face strip (first K CONFIRMED) for any authenticated browser — requires explicit owner sign-off on public attendee discoverability.

**DTO sketch (confirmed roster row):**

```json
{
  "userId": "uuid",
  "profile": { "userId", "displayName", "username", "hasAvatar", "locationCity", "locationRegion" },
  "participationStatus": "AUTO_CONFIRMED | APPROVAL_CONFIRMED",
  "joinedAt": "ISO-8601"
}
```

**Never include:** email, KYC status, verification badges, ratings, mutual connections, waitlist position in public roster (waitlist is not attendance).

**Avatar delivery:** reuse existing profile avatar bytes route with block + visibility checks; roster returns `hasAvatar` only unless viewer may fetch avatar.

## D-09 / meeting privacy preservation

- Roster must **not** embed `meetingInstructions` / `virtualMeetingDetails`.
- Roster membership must **not** imply meeting access; meeting remains `GET …/meeting` with CONFIRMED gate.
- HOST_APPROVAL: until approve, users stay off confirmed roster even if Figma shows “request pending” UI.

## ACT-CAPACITY / MDWQ-0712

Still **decision-gated for product copy**, not backend math:

- Server truth: `hostParticipationSummary.confirmedSeatCount`, `pendingRequestCount`, `approvedWaitlistedCount`, `declinedRequestCount`.
- Do **not** label “Approved (N)” as occupied seats without owner defining N.

## Recommended owner decision (ACT-ROSTER)

1. Who may call roster read: **host only** vs **confirmed participants** vs **any authenticated viewer**?
2. Public face strip on Screen 12: **yes/no**?
3. Include **waitlist queue** in “See All” or separate host UI only?
4. Pagination default/max (suggest 20/50, same as activity lists).

## MDWQ / next steps

| ID | Action |
|---|---|
| **MDWQ-0704** | Remains **DECISION_REQUIRED**; this audit attaches implementation proposal — **NOT_STARTED** code |
| **MDWQ-0712** | Remains **DOCUMENTED** (counter semantics); not resolved by roster |
| **MDWQ-0716** (new) | **027E security regression suite** — VERIFIED_NEON (bounded) — see `TASK_027E_SECURITY_VERIFICATION_AUDIT.md` |
| **MDWQ-0717** (new) | **027F roster policy sign-off** — PRE_AUDIT_COMPLETE; blocks implementation |

**STOP:** No 027F implementation, no 027G. Flutter unchanged.
