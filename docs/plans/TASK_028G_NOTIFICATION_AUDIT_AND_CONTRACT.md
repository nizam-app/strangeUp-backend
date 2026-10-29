# Task 028G — Personal meetup notifications (audit & contract only)

**Date:** 2026-10-29  
**Phase:** Audit + proposal (2026-10-29). **Implementation completed** — see `TASK_028G_PERSONAL_MEETUP_NOTIFICATIONS_REPORT.md`.  
**Policy:** D-28 (accepted foundation); MEET-NOTIFY (this document supersedes draft §9 in D-28 PROPOSAL for MVP scope).  
**Related:** Task 023 (`NotificationEmitter`, push outbox), Task 028E mutations, MDWQ-0506, MDWQ-0724 (028F reschedule stays deferred).

---

## 1. Executive summary

Personal meetup invitations **do not emit any notifications today**. Task 023 provides a **production-ready pattern**: persist `UserNotification`, optional unique `dedupeKey`, enqueue `PushNotificationOutbox` in the **same DB transaction** as the domain write, privacy-safe FCM data via `buildPrivacySafePushPayload`, and preference gating via `push-eligibility.ts`.

This phase defines a **minimal four-event contract** aligned with owner-requested triggers, D-28 venue privacy, and existing Task 023 boundaries. **Implementation is gated on owner approval** of enum names, in-app copy rules, and notification preference category (new field vs reuse).

---

## 2. Infrastructure audit (Task 023)

### 2.1 Event creation

| Component | Role |
|-----------|------|
| `NotificationEmitter` (`notification-emitter.service.ts`) | Creates `UserNotification`; skips self-notify except activity self-scoped types; **dedupeKey** unique → no-op on duplicate (DM aggregate exception only). |
| `emitInTransaction(tx, input)` | Used by Activity RSVP/join, group membership, message-request accept — **preferred for meetup**. |
| `enqueuePushOutboxForNotification` | One outbox row per notification; P2002 on duplicate → swallowed (safe retry). |

**Meetup gap:** `MeetupInviteService.create` and `mutateInvite` have **zero** notification calls.

### 2.2 Transaction boundaries

| Pattern | Example | Meetup recommendation |
|---------|---------|------------------------|
| Domain + notify in one `$transaction` | `activity-host-join-requests.service.ts`, `message-request.service.ts` (accept) | **Required** for 028G impl: invite row change and `emitInTransaction` in same tx. |
| Domain then notify **outside** tx | `message-request.service.ts` (create) | **Avoid** for meetup — risk invite exists without notification if emit fails. |
| Idempotent domain, no re-notify | 028E `noop` on terminal repeat | Emit **only** when `updateMany.count === 1` (apply path), never on idempotent **200** replay. |

If the transaction rolls back, neither invite state nor notification/outbox rows commit. If outbox worker fails later, **notification row remains**; worker retries with backoff (`push-outbox.worker.ts`, `FOR UPDATE SKIP LOCKED`).

### 2.3 Idempotency layers

1. **HTTP:** Create idempotency key → same invite row (028D) — must not emit second `RECEIVED` (dedupeKey on invite id).
2. **Domain:** 028E terminal repeat → **200** without state change — must not emit.
3. **Notification:** `UserNotification.dedupeKey` `@unique` — emitter no-op if key exists.
4. **Outbox:** `userNotificationId` `@unique` — enqueue no-op on P2002.

### 2.4 Preferences & push flags

- `UserNotificationPreference`: `pushEnabled`, category toggles (`directMessagesEnabled`, `messageRequestsEnabled`, `groupMembershipEnabled`, `activityUpdatesEnabled`, …). **No meetup category today.**
- `notificationTypeAllowedByPreference`: unknown types → **`false`** (push skipped as `CATEGORY_DISABLED`).
- `PUSH_ENABLED=false` (typical dev/test): outbox processed as **`SKIPPED`** / no FCM HTTP — **still creates in-app rows** when emitter runs (unless impl explicitly skips — not required for MVP).

**Owner decision required:** add `meetupInvitesEnabled` (default `true`) **or** temporarily map meetup types to `activityUpdatesEnabled` (not recommended — misleading UX).

### 2.5 Push payload privacy

- `push-payload.ts`: per-type **generic** title/body; data keys: `notificationId`, `type`, optional `sourceId` only.
- **No** venue, address, note, coordinates, or invite `title` field in FCM data (meetup types must follow same rule).

### 2.6 In-app notification API

- `GET /v1/me/notifications`, `POST …/read`, `read-all` — **`readAt` independent** of `PersonalMeetupInvitation.status` (D-28 / Figma “mark read” ≠ accept).
- `sourceId` = **`PersonalMeetupInvitation.id`** (opaque to client; ACL on `GET /v1/meetup-invites/:id`).
- Actor preview: loaded in `notification.service.ts`; **hidden if blocked** (actor `null`, title/body still shown).

---

## 3. Meetup domain audit (028D–028E)

### 3.1 Transition hooks (proposed emit points)

| Event | When (code hook) | Recipient | Actor |
|-------|------------------|-----------|-------|
| Invitation created | After successful **new** `personalMeetupInvitation.create` (not idempotent replay) | `recipientId` | `senderId` |
| Accepted | After `updateMany` applies `ACCEPTED` | `senderId` | `recipientId` |
| Declined | After `updateMany` applies `DECLINED` | `senderId` | `recipientId` |
| Withdrawn | After `updateMany` applies `WITHDRAWN` | `recipientId` | `senderId` |

**Out of MVP (explicit):** `EXPIRED`, lazy-expiry worker, reminders, check-in, “15 min before”, maps, safety guarantees.

### 3.2 Recipient eligibility at emit time

Before `emitInTransaction`, verify (mirror meetup read/mutation policy):

- Recipient `hasHomeAccess` (Task 022).
- **Not** blocked with actor (`isBlockedEitherDirection`).
- For **RECEIVED** only: recipient was eligible at create (already enforced by `loadMeetupInviteRecipientForCreate`).

If checks fail at emit time: **skip notification** (log at debug); do not fail the invite HTTP request (consistent with “historical row retained, deny access” — optional owner tweak: fail closed only for notify skip is default for social patterns).

### 3.3 Security — content rules (normative)

**Must never appear** in `title`, `body`, push display copy, or FCM `data` (beyond opaque ids):

- `venueLabel`, `venueAddressLine`, `venuePlaceNotes`
- City/region (even though pre-accept detail allows city/region — **notifications are stricter**)
- `note`, coordinates, map links
- Invite **`title`** field (user-generated; could embed address — treat as sensitive)

**Allowed in-app copy (proposal):**

| Type | Title | Body |
|------|-------|------|
| `MEETUP_INVITATION_RECEIVED` | Meetup invitation | Someone invited you to a meetup. Open StrangeUp to respond. |
| `MEETUP_INVITATION_ACCEPTED` | Meetup invitation accepted | Your invitation was accepted. Open StrangeUp for details. |
| `MEETUP_INVITATION_DECLINED` | Meetup invitation declined | Your invitation was declined. Open StrangeUp for details. |
| `MEETUP_INVITATION_WITHDRAWN` | Meetup invitation withdrawn | An invitation was withdrawn. Open StrangeUp for details. |

Push display: mirror existing pattern — **generic** per type in `GENERIC_COPY` (same strings or shorter “Open StrangeUp for details”).

Actor display name in title (e.g. “Alex sent…”) is **optional** — if used, only **public displayName** from actor preview, never venue/note.

---

## 4. Proposed schema changes (implementation phase — not applied in 028G)

### 4.1 Prisma

Extend `UserNotificationType` enum with:

```text
MEETUP_INVITATION_RECEIVED
MEETUP_INVITATION_ACCEPTED
MEETUP_INVITATION_DECLINED
MEETUP_INVITATION_WITHDRAWN
```

**Optional later:** `MEETUP_INVITATION_EXPIRED` — **not** in owner MVP list; keep deferred.

**Recommended:** `UserNotificationPreference.meetupInvitesEnabled Boolean @default(true)` + migration.

No change to `PersonalMeetupInvitation` model required for notifications.

### 4.2 Code touch list (implementation scope estimate)

| File | Change |
|------|--------|
| `prisma/schema.prisma` + migration | Enum + optional preference column |
| `meetup-invite.service.ts` | Inject `NotificationEmitter`; emit in tx on create/apply only |
| New `meetup-invite-notifications.ts` | Dedupe keys, copy builders, `shouldNotifyMeetupRecipient()` |
| `push-payload.ts` | Four `GENERIC_COPY` entries |
| `push-eligibility.ts` | Map types → `meetupInvitesEnabled` (or approved fallback) |
| `notification-preference.service.ts` + validation + OpenAPI | Expose new toggle |
| `docs/api/*`, `openapi/notifications.yaml`, `push-devices.yaml` | Types + navigation table |
| Tests | See §7 |

**No** new HTTP routes for meetup notifications (pull existing `/v1/me/notifications`).

---

## 5. Event contract (exact)

### 5.1 Dedupe keys (stable, one notification per lifecycle event)

| Event | `dedupeKey` |
|-------|-------------|
| Created | `meetup-invite:{inviteId}:received` |
| Accepted | `meetup-invite:{inviteId}:accepted` |
| Declined | `meetup-invite:{inviteId}:declined` |
| Withdrawn | `meetup-invite:{inviteId}:withdrawn` |

Concurrent accept/decline: only one transition wins → only one dedupe key ever written.

### 5.2 Payload fields

| Field | Value |
|-------|--------|
| `recipientId` | Counterparty of actor per table §3.1 |
| `actorUserId` | Sender or recipient who performed the action |
| `sourceId` | `inviteId` |
| `type` | Enum per event |
| `dedupeKey` | As §5.1 |

### 5.3 Flutter deeplink / navigation (handoff)

| `type` | Navigate to |
|--------|-------------|
| `MEETUP_INVITATION_*` | `GET /v1/meetup-invites/{sourceId}` (detail); fallback incoming list if 404 (blocked/revoked) |

Use `data.counts.pending` on meetup list for **invite** badge — **not** `notificationsUnreadCount` for accept/decline workflow.

---

## 6. Reviews requested by phase

### 6.1 028E integration coverage (Neon)

| Area | Covered in `meetup-invite-028e.integration.test.ts` | Notification-relevant |
|------|------------------------------------------------------|------------------------|
| Accept + venue reveal | Yes | After accept, detail API shows venue — **must not** leak via notification copy |
| Decline / withdraw roles | Yes | Emit only on successful apply |
| Stranger 404 | Yes | No emit (no access) |
| Terminal conflict 409 | Yes | Loser must not emit |
| Lazy expiry 409 | Yes | No accept notification |
| Recipient KYC revoked 403 | Yes | No accept transition → no accepted notify |
| Concurrent accept/decline, accept/withdraw | Yes | Single winner → single notify when impl |
| 028D + follow/wave regression | Yes (single test) | Social-access regression partial |
| **Blocked participant mutation** | **No** | Impl should assert skip/404 before emit |
| **Sender KYC revoked at accept time** | **No** | `assertMeetupInviteParticipantsEligible` → 403; no emit |
| **Idempotent accept 200 twice** | Yes | Must emit **once** when impl |

### 6.2 Social-access (028D) regression

- `social-access.ts` `targetSelect` includes Task 022 fields for discoverability.
- **Verified:** follow + wave in 028E regression test.
- **Gap:** message-request create/accept not re-run in meetup suite — recommend **028G impl** or **028H** run `tests/integration/social.integration.test.ts` (bounded) on same branch.

---

## 7. Minimal test matrix (implementation phase)

| # | Test | Expect |
|---|------|--------|
| T1 | Create invite | One `RECEIVED` row; dedupeKey set; outbox row |
| T2 | Create idempotent replay | No second notification |
| T3 | Accept | One `ACCEPTED` row to sender; push payload has no venue fields |
| T4 | Accept idempotent replay | No second notification |
| T5 | Decline / withdraw | Correct recipient + dedupe |
| T6 | Concurrent accept vs decline | Exactly one transition notification |
| T7 | Block recipient→sender after create | List/read may 404; optional: skip notify on create if block added mid-flight (edge) |
| T8 | `meetupInvitesEnabled=false` | In-app row exists; push **SKIPPED** / category disabled |
| T9 | `PUSH_ENABLED=false` | In-app row exists; outbox **SKIPPED** |
| T10 | Transaction rollback | Force emit failure → invite row rolled back (integration with fault injection or unit mock) |

Unit tests: dedupe key helpers + copy builder asserts no forbidden substrings from fixture invite row.

---

## 8. Owner approval requirements (gate before implementation)

1. **Accept four event types** (no expiry/reminder/check-in in MVP).
2. **In-app copy** — generic vs displayName in title (§3.3).
3. **Preference category** — new `meetupInvitesEnabled` vs reuse `activityUpdatesEnabled`.
4. **MDWQ-0506** — Figma “Accept/Decline notification journey” may overlap; confirm inbox UX uses `/v1/me/notifications` + meetup detail, not inline accept via notification row alone.
5. **Skip vs fail** when recipient ineligible at notify time (recommend **skip**, HTTP succeeds).
6. Confirm **`capabilities.meetupInvites`** remains **DEFERRED** until 028H / owner sign-off (notifications can ship before capability LIVE).

---

## 9. Explicit non-goals (028G implementation when approved)

- 028F reschedule notifications
- Production FCM enablement / credential deployment
- Email notifications
- Fabricated reminders, check-ins, location tracking, trust badges
- Activity RSVP, DM, or group side effects
- Notification-driven accept/decline (HTTP meetup mutations remain source of truth)

---

## 10. Reusable infrastructure summary

| Reuse | Notes |
|-------|--------|
| `NotificationEmitter.emitInTransaction` | Primary integration point |
| `UserNotification.dedupeKey` | HTTP + terminal idempotency |
| `PushNotificationOutbox` + worker | Retries; no duplicate FCM for same notification id |
| `buildPrivacySafePushPayload` | Extend enum map |
| `loadEligiblePushDevices` | Add preference mapping |
| `/v1/me/notifications` | No new read API |

---

**STOP:** 028G implementation and 028H not started. 028F reschedule remains **OWNER_DEFERRED** (MDWQ-0724).
