# D-28 — Personal 1:1 Meetup Invitation

**Status:** **Accepted (owner, 2026-10-29)** — **Task 028C foundation scope only**  
**Supersedes:** `D-28-personal-meetup-invitation-PROPOSAL-2026-10-29.md` (historical draft)  
**Task:** 028C  
**Related:** D-03, D-09 (Activity join — separate), KYC-ENF-02, MDWQ-0720–0725  
**Contract:** `docs/product/MEETUP_INVITATION_API_CONTRACT_DRAFT.md`  
**Report:** `docs/plans/TASK_028C_PERSONAL_MEETUP_FOUNDATION_REPORT.md`

---

## Accepted foundation (owner 2026-10-29)

1. Sender and recipient require **Task 022** KYC + admin activation and **D-03** contact eligibility; **bidirectional block** enforced at service layer (028D+).
2. States: **`PENDING`, `ACCEPTED`, `DECLINED`, `WITHDRAWN`, `EXPIRED`**.
3. **Recipient:** accept/decline while effectively `PENDING`. **Sender:** withdraw while effectively `PENDING`.
4. **One** active `PENDING` invite per **ordered** `(senderId, recipientId)` pair; **idempotency key** column for create dedupe (028D).
5. **Lazy expiry:** when `scheduledStartsAt` passes, invite is treated as **`EXPIRED`** in policy reads; persistence of `EXPIRED` status on write paths is **028D** (no background worker in 028C).
6. **Venue privacy:** recipient sees **city/region** before acceptance; **label, address line, place notes** withheld until **`ACCEPTED`**. Sender always sees submitted values. List cards omit precise fields.
7. **Schedule:** future `scheduledStartsAt`, validated **IANA** `scheduleTimeZone`, optional **note ≤ 200** characters.
8. **No side effects:** no automatic DM, Activity RSVP/join approval, or group membership.
9. **Retention:** invitation rows **durable**; `User` FK **`ON DELETE RESTRICT`**; loss of eligibility **does not delete** rows (deny access/mutations instead).

**Implemented in 028C:** Prisma model `PersonalMeetupInvitation`, enums, indexes, partial unique, modules under `src/modules/meetup-invites/`, unit + bounded schema integration tests.

**Implemented in 028G:** Meetup lifecycle notifications via Task 023 `NotificationEmitter` (see `TASK_028G_PERSONAL_MEETUP_NOTIFICATIONS_REPORT.md`).

**028H verification (2026-10-29):** Bounded E2E/security/regression pass documented in `TASK_028H_FINAL_VERIFICATION_REPORT.md`. Backend labeled **READY_FOR_OWNER_REVIEW** in docs only. Settings `capabilities.meetupInvites` remains **DEFERRED** until owner explicitly sets **LIVE**.

---

## Explicitly not approved / deferred

| Topic | Status |
|---|---|
| Reschedule / counter-proposal | **Deferred** (MDWQ-0724) |
| HTTP `/v1/meetup-invites` | **028D** — not in 028C |
| Notifications / push | **028G implemented** — four in-app types + outbox; production FCM still deferred (MDWQ-0508) |
| Advanced anti-spam rate quotas | **Deferred** (028D env — not in owner 028C list) |
| Maps, presence, ratings, check-ins | **DO NOT SHIP** |
| Post-`ACCEPTED` cancellation | **OPEN** |
| Membership / marketplace | **Out of scope** (D-08) |
| Account deletion vs invite rows | **OPEN** (Restrict prevents silent cascade; anonymization TBD) |

---

## State machine (normative)

See `src/modules/meetup-invites/meetup-invite-state.ts` and `MEETUP_INVITE_STORED_TRANSITIONS`. Terminal states have no outbound transitions.

---

## KYC note

KYC-ENF-02 send/accept gates are **required at mutation time in 028D**; 028C validation covers schedule/venue/note fields only.
