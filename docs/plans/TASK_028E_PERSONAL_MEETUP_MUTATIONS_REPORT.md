# Task 028E — Personal meetup invitation mutations

**Date:** 2026-10-29  
**Scope:** Backend only — accept / decline / withdraw (D-28 foundation; no 028F+).

## Delivered HTTP

| Method | Path | Actor | Transition |
|--------|------|-------|------------|
| `POST` | `/v1/meetup-invites/:inviteId/accept` | Recipient | `PENDING` → `ACCEPTED` |
| `POST` | `/v1/meetup-invites/:inviteId/decline` | Recipient | `PENDING` → `DECLINED` |
| `POST` | `/v1/meetup-invites/:inviteId/withdraw` | Sender | `PENDING` → `WITHDRAWN` |

## Source changes

- `meetup-invite.service.ts` — `accept` / `decline` / `withdraw`, transactional `mutateInvite` with `FOR UPDATE`, conditional `updateMany`, lazy expiry reconcile.
- `meetup-invite-access.ts` — `assertMeetupInviteParticipantsEligible` (Task 022 both parties).
- `meetup-invite-transition-errors.ts` — HTTP mapping for 028C transition reject reasons.
- `meetup-invite.controller.ts`, `meetup-invite.routes.ts` — three POST handlers.

## State integrity

- Reuses `evaluateMeetupInviteMutation` / `decideMeetupInviteTransition` (028C).
- Idempotent repeat on same terminal status → **200** with current DTO.
- Conflicting terminal action → **409** `CONFLICT`.
- Lazy expiry before read and inside transaction.
- Timestamps: `acceptedAt`, `declinedAt`, `withdrawnAt` set on apply only; payload fields unchanged.

## Security

- Non-participant / block → **404** (existing `assertMeetupInviteReadable`).
- Wrong role → **403**.
- Recipient KYC on accept; both parties `hasHomeAccess` at mutation.
- Venue redaction unchanged (028D mapper); full venue for recipient only after `ACCEPTED`.

## Concurrency (Neon integration)

- `accept` vs `decline` on same invite: observed **200** + **409** (winner deterministic by lock order).
- `accept` vs `withdraw`: same pattern.

## Tests

- Unit: existing `meetup-invite-state` / policy tests (unchanged).
- Integration: `tests/integration/meetup-invite-028e.integration.test.ts` (8 cases + 028D/social regression snippet).

## Documentation

- `docs/api/CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md` §13A, `openapi/meetup-invites.yaml`, `STATUS.md`, `MASTER_DEFERRED_WORK_QUEUE.md` (MDWQ-0721 **COMPLETED**).

## Not done (by design)

- `capabilities.meetupInvites` still **DEFERRED** in settings overview.
- 028F reschedule, 028G notifications, post-accept cancel, new migrations, Flutter.

**STOP:** 028F not started.
