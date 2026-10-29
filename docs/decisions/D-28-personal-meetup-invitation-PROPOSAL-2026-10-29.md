# D-28 — Personal 1:1 Meetup Invitation (PROPOSAL)

**Status:** **SUPERSEDED** — see **`D-28-personal-meetup-invitation-2026-10-29.md`** (Accepted foundation, 2026-10-29).  
**Date:** 2026-10-29  
**Task:** 028B (policy + contract design only)  
**Supersedes:** nothing (greenfield domain)  
**Related:** D-03, D-07 (open), D-09 (Activity join — **separate**), KYC-01 / KYC-ENF-02, MDWQ-0720–0725  
**Implementation contract:** `docs/product/MEETUP_INVITATION_API_CONTRACT_DRAFT.md`  
**Engineering report:** `docs/plans/TASK_028B_DISCOVER_MEETUP_POLICY_AND_CONTRACT.md`

---

## 1. Purpose

Define a **minimal, secure** backend domain for **direct person-to-person meetup invitations** (Task 028 Figma), independent of:

- Task **010/027E** Activity RSVP, `HOST_APPROVAL`, and `ActivityParticipation`
- Task **011** DM request acceptance (no automatic thread)
- Task **012** group membership
- Task **026** membership billing (remains deferred)

This document records **proposed defaults** from the owner’s 028B brief. **No API or schema work is authorized** until the owner records acceptance (or revisions) in a follow-up ADR revision or signed decision register entry.

---

## 2. Proposed policy defaults (028B brief)

| # | Rule | Proposal status |
|---|---|---|
| 1 | Sender and recipient both require **Task 022 main-app activation** (`hasHomeAccess`) at send, read, and mutation time | **PROPOSED** |
| 2 | Enforce recipient **D-03 visibility**, **bidirectional block**, **suspension**, and **KYC revocation** on every operation | **PROPOSED** |
| 3 | States: `PENDING`, `ACCEPTED`, `DECLINED`, `WITHDRAWN`, `EXPIRED` | **PROPOSED** |
| 4 | **Recipient** only: accept / decline. **Sender** only: withdraw while `PENDING` | **PROPOSED** |
| 5 | **No** automatic Activity RSVP, DM creation, or group membership | **PROPOSED** |
| 6 | **General** venue (city/region + optional public label) visible pre-accept; **precise** meeting fields only after `ACCEPTED` (recipient) | **PROPOSED** — see §6 |
| 7 | **Future-only** `scheduledStartsAt` with **IANA** `scheduleTimeZone`; optional note **max 200** chars | **PROPOSED** |
| 8 | **Reschedule** deferred until counter-proposal lifecycle approved (`MEET-RESCHEDULE` / MDWQ-0724) | **PROPOSED DEFERRED** |
| 9 | **In-app** notification events proposed; push obeys `PUSH_ENABLED` and existing prefs | **PROPOSED** (028G) |
| 10 | **No** maps, presence, ratings, mutual counts, or safety check-in automation | **PROPOSED DO_NOT_SHIP** |

---

## 3. Eligibility to send (MEET-ELIGIBILITY — proposed)

**Proposal:** Mirror Task **011** contact initiation — `canInitiateSocialContact` / `loadVisibleSocialTarget` semantics:

- Viewer (sender) and target (recipient) are distinct users.
- Target is **discoverable** (`isDiscoverablePublicProfileTarget`) at send time.
- Target passes **D-03** visibility for sender (`canViewPublicProfile`).
- **No block** either direction at send time.
- **No** requirement for follow, wave, or accepted DM unless owner overrides in checklist §8.

**Anti-spam (proposed, tunable in 028D):**

- Per-sender rate limit (new env, pattern like `SOCIAL_RATE_LIMIT_*`).
- At most **one** `PENDING` invite per `(senderId, recipientId)` pair (partial unique index).
- Re-invite after `DECLINED` / `WITHDRAWN` / `EXPIRED`: **NEEDS DECISION** (default: allow new row after terminal state; optional cooldown).

---

## 4. KYC (KYC-ENF-02 alignment — proposed)

- **Send:** sender must satisfy **trusted KYC for real-world action** (same enforcement family as Activity host/join — implement via shared `hasTrustedKycForEnforcement` / activity KYC context at mutation time).
- **Accept:** recipient must satisfy trusted KYC **at accept time** (recheck; revocation between invite and accept → **403** with stable code, invite remains `PENDING` until expired/withdrawn).
- **Browse/read:** Task 022 activation sufficient for inbox/detail; do not expose precise venue without accept.

---

## 5. State machine (authoritative transition table — proposed)

Terminal states: `ACCEPTED`, `DECLINED`, `WITHDRAWN`, `EXPIRED`. No transitions out of terminal states in MVP.

| From | Event / actor | To | Conditions |
|---|---|---|---|
| — | `create` (sender) | `PENDING` | Eligibility §3–4; future schedule §7; idempotency OK |
| `PENDING` | `accept` (recipient) | `ACCEPTED` | Not expired; block/KYC/activation recheck; row lock |
| `PENDING` | `decline` (recipient) | `DECLINED` | Same rechecks except KYC accept gate |
| `PENDING` | `withdraw` (sender) | `WITHDRAWN` | Sender identity; recheck activation |
| `PENDING` | `expire` (system/lazy) | `EXPIRED` | Expiry rule satisfied (§7) |
| `ACCEPTED` | — | — | **No** withdraw/decline in MVP (cancellation **NEEDS DECISION**) |
| `DECLINED` | `create` (sender) | `PENDING` | Only if owner approves re-invite policy |
| `WITHDRAWN` | `create` (sender) | `PENDING` | Same |
| `EXPIRED` | `create` (sender) | `PENDING` | Same |

**Idempotent mutations:**

- Repeat `accept` when already `ACCEPTED` → **200** same body (no-op).
- Repeat `decline` when `DECLINED` → **200** no-op.
- Repeat `withdraw` when `WITHDRAWN` → **200** no-op.
- `accept`/`decline`/`withdraw` on wrong terminal state → **409** `CONFLICT` with stable code (e.g. `MEETUP_INVITE_NOT_ACTIONABLE`).

**Concurrency:** single-row `SELECT … FOR UPDATE` (or equivalent) inside transaction for accept/decline/withdraw/expire.

---

## 6. Venue privacy (MEET-LOCATION — proposed)

Stored fields (see contract doc):

| Field | Pre-accept (recipient) | Pre-accept (sender) | Post-accept (recipient) |
|---|---|---|---|
| `venueCity`, `venueRegion` | visible | visible | visible |
| `venueLabel` (e.g. café name) | visible | visible | visible |
| `venueAddressLine` | **redacted** (`null` in DTO) | visible (they entered it) | visible |
| `venuePlaceNotes` (optional, bounded) | **redacted** | visible | visible |
| Coordinates / map URLs | **never** in MVP | **never** | **never** |

**Inbox list cards:** city/region + label + title + time; **no** address line; note truncated (e.g. 120 chars) **PROPOSED**.

**Push payloads:** no address or note body (Task 023 privacy pattern).

---

## 7. Time, expiry, note (MEET-DATETIME — proposed)

- `scheduledStartsAt`: UTC instant, must be **strictly after** server `now()` at create (grace skew **NEEDS DECISION**, propose 1 minute).
- `scheduleTimeZone`: valid IANA identifier; used for display hints only in MVP.
- `note`: optional, trim, max **200** UTF-16 code units (align Figma counter).
- **Duration / end time:** not stored in MVP (**NEEDS DECISION**; Figma “~45 mins” is copy-only).
- **Expiry (NEEDS DECISION — propose for owner):**
  - **Option A (recommended default):** auto-`EXPIRED` when `scheduledStartsAt` passes while still `PENDING`.
  - **Option B:** additional `expiresAt` instant (e.g. 14 days after create) even if meetup is far future.
  - **Option C:** manual only (no auto-expire) — **not recommended** (inbox clutter).

Lazy expiry: evaluate on list/detail read and before accept/decline.

---

## 8. Post-create safety (block, suspend, revocation)

| Scenario | Proposed behavior |
|---|---|
| Block after `PENDING` | Detail/list → **404** for both parties (hide existence). Optional: retain row for audit, no mutations. |
| Sender/recipient loses `hasHomeAccess` | Read → **403** or **404** (prefer **404** on detail for non-actionable). Mutations → **403** `AUTH_FORBIDDEN`. |
| KYC revoked before accept | Accept → **403**; invite stays `PENDING` until withdraw/expire. |
| Suspended/deleted user | Treat as ineligible; **404** on cross-user reads. |

Historical rows **retained** (no hard delete on block). **Retention/deletion** long-term: cross-ref KYC/data retention (**NEEDS DECISION**).

---

## 9. Notifications (MEET-NOTIFY — proposed, 028G)

**Separate concerns:**

- `PersonalMeetupInvitation.status` — domain lifecycle.
- `UserNotification.readAt` — inbox **notification** read state (Figma “Mark read” on meetup screen maps to notification APIs, **not** accept).

**Proposed `UserNotificationType` additions (not implemented until 028G):**

- `MEETUP_INVITATION_RECEIVED` (recipient, on create)
- `MEETUP_INVITATION_ACCEPTED` (sender)
- `MEETUP_INVITATION_DECLINED` (sender)
- `MEETUP_INVITATION_WITHDRAWN` (recipient)
- `MEETUP_INVITATION_EXPIRED` (both) — optional if product wants

Dedupe keys e.g. `meetup-invite:{id}:received`. Push only if `PUSH_ENABLED` and user prefs allow.

---

## 10. Explicit non-goals (028B–E unless owner expands)

- Reschedule / counter-proposal (`MEET-RESCHEDULE`)
- Map, geocode, directions, distance
- Linked Activity id, calendar ICS, check-in workers
- Mutual counts, trust banners, ratings
- Club / membership gates (D-08)
- Admin moderation UI (report flow → MDWQ-0607)

---

## 11. Smallest safe **028C** scope (after owner approval)

**Authorized only after this proposal (or revision) is accepted:**

1. Additive Prisma: `PersonalMeetupInvitation` + enums + indexes + partial unique `(senderId, recipientId)` where `status = PENDING`.
2. Pure TypeScript: `meetup-invite-policy.ts`, `meetup-invite-state.ts` with transition table unit tests.
3. **No** HTTP routes, **no** notification enum migration, **no** capability flag flip to `LIVE`.

**028D** adds REST + integration tests; **028E** accept/decline/withdraw wiring if split from 028D per task plan.

---

## 12. Owner acceptance checklist

See `docs/plans/TASK_028B_OWNER_DECISION_CHECKLIST.md`. Owner must confirm or revise each row before implementation.

**To approve:** record `Status: Accepted (owner, YYYY-MM-DD)` on this file or a new `D-28-personal-meetup-invitation-YYYY-MM-DD.md` accepted copy; update `OPEN_QUESTIONS.md` D-07; reconcile MDWQ-0720–0723.
