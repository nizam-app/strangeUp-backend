# Figma parity — Task 028H final (Discover & personal meetup)

**Date:** 2026-10-29  
**Evidence:** `design-reference/task028-discover-meetup/MANIFEST.md` (SHA-256 verified on disk 028H)  
**Policy:** D-28 accepted foundation  
**Backend readiness:** **READY_FOR_OWNER_REVIEW** (documentation label only — `capabilities.meetupInvites` remains **DEFERRED** until owner sets LIVE)

**Legend:** `MATCHED` | `PARTIAL` | `MISSING` | `DEFERRED` | `NEEDS_DECISION` | `DO_NOT_SHIP`

---

## 1. Public User Profile (Screen 10)

| Figma element | Backend | Status | Notes |
|---------------|---------|--------|-------|
| Discover → profile | `GET /v1/discover/people`, `GET /v1/users/{id}` | **MATCHED** | Task 022 gate |
| Follow / Wave / Message | Social routes | **MATCHED** | 028H regression tested |
| City/region, interests, member since | Public profile DTO | **MATCHED** | |
| Create Meetup entry (from profile) | `POST /v1/meetup-invites` (recipient id) | **MATCHED** | Flutter navigation only |
| Presence / miles / verified marketing | — | **DO_NOT_SHIP** | MDWQ-0502, D-04, COPY-TRUST |
| Ratings / meetup count stats | — | **DO_NOT_SHIP** | No review domain |
| Mutual interests / upcoming banner | — | **MISSING** | MDWQ-0726 |
| Public upcoming activities / groups on profile | — **MISSING** | MDWQ-0726 |

---

## 2. Create Meetup modal

| Figma element | Backend | Status | Notes |
|---------------|---------|--------|-------|
| Recipient (discoverable + block) | `loadVisibleSocialTarget` | **MATCHED** | 404 concealment |
| Types COFFEE/ACTIVITY/SPORTS/OTHER | `PersonalMeetupInviteType` | **MATCHED** | |
| Title, schedule, IANA TZ, note ≤200 | Create validation | **MATCHED** | No duration/end field |
| Venue city/region + optional precise fields | Create body | **MATCHED** | Stored server-side |
| Send / idempotency | `POST /v1/meetup-invites` + header | **MATCHED** | |
| Sender KYC | `assertSenderKyc` | **MATCHED** | |
| Map/geocode search | — | **DEFERRED** | D-04 |
| Anti-spam rate quotas | — | **DEFERRED** | Env/policy |

---

## 3. Meetup Invites inbox

| Figma element | Backend | Status | Notes |
|---------------|---------|--------|-------|
| Settings hub “Meetup invites” capability | `capabilities.meetupInvites` | **DEFERRED** | API exists; owner sign-off for LIVE |
| Tabs Pending/Accepted/Declined/All/Expired | `GET /v1/meetup-invites?status=` | **MATCHED** | + `withdrawn`, `expired` |
| Pending badge count | `counts.pending` (incoming) | **MATCHED** | Not notification unread |
| Outgoing box | `box=outgoing` | **MATCHED** | Not in Figma; approved in D-28 |
| List card venue/note privacy | List mapper redaction | **MATCHED** | No address/label on cards |
| Inline Accept | `POST …/accept` | **MATCHED** | |
| View Details | `GET …/:id` | **MATCHED** | |
| Mark read on invite row | — | **PARTIAL** | Use `/v1/me/notifications` read (028G) |
| Withdraw (sender) | `POST …/withdraw` | **MATCHED** | Not shown in Figma |

**Not Activity join:** `GET /v1/me/activities` join-requests (027E) — separate domain.

---

## 4. Invitation details

| Figma element | Backend | Status | Notes |
|---------------|---------|--------|-------|
| Detail by id | `GET /v1/meetup-invites/:id` | **MATCHED** | |
| Sender/recipient preview | `counterparty` in DTO | **MATCHED** | |
| Type, title, schedule, note | Detail DTO | **MATCHED** | |
| Venue pre-accept (recipient) | City/region only | **MATCHED** | D-28 |
| Venue post-accept (recipient) | Full stored venue | **MATCHED** | |
| Sender sees full venue always | Redaction policy | **MATCHED** | |
| Accept / Decline | 028E mutations | **MATCHED** | |
| Reschedule | — | **DEFERRED** | MDWQ-0724 |
| Map / directions / check-in copy | — | **DO_NOT_SHIP** | |
| Mutual count / trust banner | — | **DO_NOT_SHIP** | |
| Duration `~45 mins` | — | **NEEDS_DECISION** | Not in schema |

---

## 5. Notification navigation

| Figma element | Backend | Status | Notes |
|---------------|---------|--------|-------|
| Meetup lifecycle notifications | 4 `UserNotificationType` values | **MATCHED** | 028G |
| Generic copy (no PII/venue) | `meetup-invite-notifications.ts` | **MATCHED** | `actorUserId` null |
| Deeplink `sourceId` → invite detail | Handoff §16 | **MATCHED** | Flutter composes |
| `meetupInvitesEnabled` preference | PATCH notification-preferences | **MATCHED** | Default true |
| Production FCM | `PUSH_ENABLED=false` default | **DEFERRED** | MDWQ-0508 |
| Accept/Decline via notification row | — | **NEEDS_DECISION** | MDWQ-0506 UX |

---

## Release blockers vs optional deferrals

| Category | Items |
|----------|--------|
| **Owner review (not code blockers)** | Flip `meetupInvites` capability LIVE; Figma hub wiring (MDWQ-0506); apply migrations to **strangeup_dev** |
| **Optional / deferred product** | Reschedule (0724), maps, reminders, check-in, ratings, profile enrichments (0726), anti-spam quotas |
| **Backend approved scope** | Full lifecycle REST + notifications + security gates — **verified 028H** |
