# Figma parity — Task 028A (Discover & Direct Meetup Flow)

> **Superseded for implementation status by** `FIGMA_DISCOVER_MEETUP_PARITY_TASK028H_FINAL.md` **(028H).** This file retains the original 028A audit snapshot.

**Date:** 2026-10-29  
**Evidence:** `design-reference/task028-discover-meetup/` (SHA-256 verified — see `MANIFEST.md`)  
**Audit report:** `docs/plans/TASK_028A_DISCOVER_MEETUP_AUDIT_REPORT.md`  
**028C foundation (D-28 accepted):** Prisma + policy modules — **no HTTP**. Contract: `MEETUP_INVITATION_API_CONTRACT_DRAFT.md`, `D-28-personal-meetup-invitation-2026-10-29.md`  
**Status legend:** `MATCHED` | `PARTIAL` | `MISSING` | `DEFERRED` | `FLUTTER_ONLY` | `NEEDS_DECISION` | `DO_NOT_SHIP` | `CONTRACT_DRAFT`

---

## 028B — Proposed contract mapping (NOT LIVE)

**Status:** Design-only. **Do not** wire Flutter to these paths until D-28 is owner-accepted and phases 028C–D ship.

| Figma control | Proposed API (028B) | Parity after approval |
|---|---|---|
| Create Meetup → Send | `POST /v1/meetup-invites` | **MATCHED** (028D) |
| Meetup Invites inbox tabs | `GET /v1/meetup-invites?box=incoming&status=…` | **MATCHED** (028D) |
| View Details | `GET /v1/meetup-invites/:id` | **MATCHED** (028D) |
| Accept | `POST /v1/meetup-invites/:id/accept` | **MATCHED** (028E) |
| Decline | `POST /v1/meetup-invites/:id/decline` | **MATCHED** (028E) |
| (Sender withdraw — not in Figma) | `POST /v1/meetup-invites/:id/withdraw` | **MATCHED** (028E) |
| Mark read | `PATCH /v1/me/notifications/:id/read` (existing) | **MATCHED** (028G) — separate from invite status; meetup lifecycle **emitters implemented** |
| Reschedule | — | **DEFERRED** (MDWQ-0724) |
| Get Directions / map / trust banner | — | **DO_NOT_SHIP** (MVP) |
| Settings hub “Meetup invites” | `capabilities.meetupInvites` → `LIVE` | **DEFERRED** until owner sign-off (API 028E ready) |

**Venue redaction (proposed):** inbox/list never shows `addressLine`; detail hides precise fields from recipient until `ACCEPTED`.

---

## Screen 10 — User Profile (Discover target)

**PDF:** `Screen 10_ User Profile.pdf`

| Figma control / data | Backend capability | Status | Evidence |
|---|---|---|---|
| Navigate from Discover | `GET /v1/discover/people`, `GET /v1/users/{userId}` | **MATCHED** | `discovery.routes.ts`, `public-users.routes.ts`, `FIGMA_MAIN_FLOW_PARITY_TASK025B.md` |
| Task 022 main-app gate | `requireHomeAccess` on `/v1/discover`, `/v1/users` | **MATCHED** | `app.ts` `mountMainApp` |
| Discoverable target only | `isDiscoverablePublicProfileTarget` | **MATCHED** | `public-profile-policy.ts`, `TASK_025B_DISCOVER_REPORT.md` |
| Block hiding | `canViewPublicProfile` → 404 | **MATCHED** | `public-profile.service.ts`, blocks |
| Display name, bio, city/region | Public profile DTO | **MATCHED** | `public-profile.dto.ts` |
| Interests list | `userInterest` + catalog | **MATCHED** | `public-profile.service.ts` |
| Follow | `POST/DELETE /v1/users/{userId}/follow` | **MATCHED** | `social.routes.ts`, Task 011 |
| Message | `POST /v1/users/{userId}/message-requests` (+ accept flow) | **MATCHED** | `message-request.service.ts` |
| Wave | `POST /v1/users/{userId}/waves` | **MATCHED** | `wave.service.ts` |
| Follower / following counts | Included in profile detail | **MATCHED** | `public-profile.service.ts` |
| Entry to **Create Meetup** | No route, no capability beyond `DEFERRED` | **MISSING** | `settings-capabilities.ts`; no `/v1/meetup-invites` |
| `Active 10m ago` | No presence model | **DO_NOT_SHIP** | MDWQ-0502 |
| `0.8 miles away` | No geo distance | **DO_NOT_SHIP** | MDWQ-0401 (D-04) |
| `100% ID Verified` / biometric marketing | Only raw `identityVerificationStatus` on self paths; not trust marketing on public profile | **DO_NOT_SHIP** | MDWQ-0407, handoff §12 |
| `5.0 / 28 reviews`, `14 Meetups` stat | No ratings/meetup count APIs | **DO_NOT_SHIP** | `meetupInvites` DEFERRED; no review domain |
| `3 shared interests & 2 upcoming activities` banner | No server-computed mutual interest/activity summary on profile | **MISSING** | No endpoint |
| Upcoming Activities section | No public “user’s upcoming activities” feed on profile | **MISSING** | Activities APIs are discover/self inventory, not profile tile |
| Community Groups on profile | No `GET /v1/users/{id}/groups` public composition | **MISSING** | Groups are membership-scoped |
| Recent Activity timeline | No profile activity history API | **MISSING** | — |
| Member since | `memberSince` on profile DTO | **MATCHED** | `public-profile.dto.ts` |

---

## Create Meetup modal

**PDF:** `Html → Body → iPhone 15 frame simulation (393px width, 852px height).pdf`

| Figma control | Backend capability | Status | Evidence |
|---|---|---|---|
| Selected recipient | Target must be discoverable + block checks (pattern exists for social) | **PARTIAL** | Policy helpers only; **no invite create** |
| Meetup type Coffee/Activity/Sports/Other | No enum/model | **MISSING** | No Prisma type |
| Title | — | **MISSING** | — |
| Date / time | No invite schedule fields | **MISSING** | MEET-DATETIME open |
| Location (city-level in Figma) | Profile has city/region only; no invite venue store | **MISSING** | MEET-LOCATION open |
| Optional note + `38/200` counter | No field | **MISSING** | Max length **NEEDS_DECISION** |
| Send Meetup Invite | No `POST` endpoint | **MISSING** | `ENDPOINT_CANDIDATES.md` only |
| Sender KYC before real-world send | Documented KYC-ENF-02; no enforcing route | **DEFERRED** | Handoff §12 |
| Idempotency / anti-spam on send | — | **MISSING** | MEET-ELIGIBILITY open |
| Map search / geocoding | — | **DEFERRED** | D-04 |

---

## Meetup Invites inbox

**PDF:** `Html → Body.pdf`

| Figma control | Backend capability | Status | Evidence |
|---|---|---|---|
| Meetup Invites screen / hub link | `capabilities.meetupInvites: "DEFERRED"` | **DEFERRED** | `settings-capabilities.ts`, `main-flow-025d.integration.test.ts` |
| Tabs Pending / All / Accepted / Declined | No invite list API | **MISSING** | — |
| Pending count badge (`3`) | — | **MISSING** | — |
| Card preview (sender, title, time, venue snippet, note) | — | **MISSING** | List venue/note privacy **NEEDS_DECISION** |
| Accept (inline) | — | **MISSING** | Not Activity RSVP |
| View Details | — | **MISSING** | — |
| Mark read | Notification read exists (`UserNotification.readAt`) but **no meetup invite read model** | **MISSING** | `schema.prisma` `UserNotification` — no meetup types |
| Outgoing invites | Not shown in Figma | **NEEDS_DECISION** | — |

**Do not map to:** `GET /v1/me/activities?view=pending` (Task **027E** host/join **Activity** requests — MDWQ-0714).

---

## Direct Meetup Invitation details

**PDF:** `Html → Body-1.pdf`

| Figma control | Backend capability | Status | Evidence |
|---|---|---|---|
| Invitation detail by id | No resource | **MISSING** | — |
| Sender profile preview + link | Public profile exists | **PARTIAL** | Would compose in Flutter; no invite wrapper DTO |
| `3 Mutual` | No mutual-connection count API | **DO_NOT_SHIP** | — |
| Activity/type label + title | — | **MISSING** | — |
| Date/time + `~45 mins` | — | **MISSING** | Duration **NEEDS_DECISION** |
| Location block + street address | — | **MISSING** | MEET-LOCATION |
| Map thumbnail / Get Directions | — | **DEFERRED** | D-04 |
| `Public Spot` label | — | **NEEDS_DECISION** | — |
| Note from sender | — | **MISSING** | — |
| Trust & Safety / dual verified / 15-min check-in | — | **DO_NOT_SHIP** | MEET-TRUST, MEET-NOTIFY |
| Accept Meetup | — | **MISSING** | ≠ `POST …/join-requests/…/approve` |
| Decline | — | **MISSING** | — |
| Reschedule | No workflow screens in source | **DEFERRED** | MEET-RESCHEDULE / MDWQ-0724 |

---

## Mask group — flow title

**PDF:** `Mask group.pdf` — text “Discover And Meetup Flow” only. **N/A** for API parity.

---

## Cross-reference: Activity join (027E) vs personal meetup (028)

| Concept | Activity (027E) | Personal meetup (028) |
|---|---|---|
| Prisma | `ActivityParticipation`, `Activity.joinMode` | **None** |
| Pending semantics | Host approval to join **Activity** | Invite recipient accept **1:1 meetup** |
| List UI in Figma | Different PDF bundle (Task 027) | This Task 028 `Html → Body.pdf` |
| Notification types | `ACTIVITY_JOIN_REQUEST_*` | **None** |

Flutter must use **separate** routes and state when personal meetup APIs exist (028D+).
