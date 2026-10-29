# Task 028C — Personal meetup invitation foundation

**Date:** 2026-10-29  
**Phase:** **028C COMPLETE** — schema + policy/state modules + unit tests. **STOP before 028D.**  
**Decision:** [D-28](../decisions/D-28-personal-meetup-invitation-2026-10-29.md) **Accepted (owner, 2026-10-29)** — **foundation scope only**.

---

## 1. Owner approval reconciliation (P0)

| Owner rule (028C brief) | Implementation |
|---|---|
| Task 022 + contact eligibility + blocks | Policy module documents 028D enforcement via existing discovery/social helpers; `canSenderCreateMeetupInviteWhenBlocked` |
| Five states | `PersonalMeetupInviteStatus` enum |
| Recipient accept/decline; sender withdraw | `meetup-invite-state.ts` transition table |
| One PENDING per ordered pair + idempotency key column | Partial unique index + `createIdempotencyKey @unique` |
| Lazy expiry at `scheduledStartsAt` (no worker) | `resolveEffectiveMeetupInviteStatus` |
| Venue redaction | `meetup-invite-venue-redaction.ts` |
| Future start + IANA TZ + 200-char note | `meetup-invite-validation.ts` |
| No DM/Activity/group side effects | No FKs to those domains |
| Durable history; Restrict on user FK | Migration `ON DELETE RESTRICT`; integration test |

**Still open (not approved in owner message):** HTTP routes, notifications, rate-limit env quotas, reschedule, maps, post-ACCEPTED cancel, title max (implemented as 80 from contract — owner silent), re-invite cooldown, account-deletion anonymization playbook.

**No material conflicts** between owner rules and 028B proposal for foundation scope.

---

## 2. Schema changes

**Migration:** `prisma/migrations/20261029170000_task028c_personal_meetup_invitation/migration.sql`

| Artifact | Detail |
|---|---|
| Enums | `PersonalMeetupInviteStatus`, `PersonalMeetupInviteType` |
| Model | `PersonalMeetupInvitation` |
| User relations | `meetupInvitesSent`, `meetupInvitesReceived` |
| Partial unique | `(senderId, recipientId) WHERE status = 'PENDING'` |
| Indexes | recipient/sender inbox `(status, createdAt, id)`; `scheduledStartsAt` |
| FK delete | `RESTRICT` on sender and recipient |

**Unchanged:** `Activity`, `ActivityParticipation`, `ActivityJoinMode`, notification enums.

---

## 3. TypeScript modules (no HTTP)

| File | Role |
|---|---|
| `src/modules/meetup-invites/meetup-invite.constants.ts` | Field bounds, min future skew |
| `src/modules/meetup-invites/meetup-invite.types.ts` | Shared types |
| `src/modules/meetup-invites/meetup-invite-state.ts` | Transitions, lazy expiry, terminal invariants |
| `src/modules/meetup-invites/meetup-invite-validation.ts` | Create-field validation (pure) |
| `src/modules/meetup-invites/meetup-invite-venue-redaction.ts` | D-28 venue DTO redaction |
| `src/modules/meetup-invites/meetup-invite-policy.ts` | ACL helpers, retention constants |

---

## 4. Tests

| Suite | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run build` | pass |
| `npm run test` (unit) | **276** passed (incl. 4 new meetup-invite unit files) |
| `RUN_INTEGRATION=1` `meetup-invite-schema-028c.integration.test.ts` | **2/2** on **strangeup_test** |

**Migration applied:** integration catalog only via `scripts/migrate-integration-only.ts` (not `strangeup_dev` in this phase).

Full Neon regression: still **MDWQ-0099** deferred.

---

## 5. Next phase (028D — not started)

REST create/list/detail/accept/decline/withdraw, wire Task 022 middleware, block/KYC at service layer, persist lazy expiry writes, idempotency store, capability flag — **requires separate authorization**.

---

## 6. STOP

**028C complete.** Do not begin **028D** without explicit owner go-ahead.
