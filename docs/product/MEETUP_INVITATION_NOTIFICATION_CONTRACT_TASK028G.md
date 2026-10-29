# Personal meetup invitation — notification contract (Task 028G)

**Status:** **IMPLEMENTED** (2026-10-29) — in-app + outbox; production FCM still off  
**Full audit:** `docs/plans/TASK_028G_NOTIFICATION_AUDIT_AND_CONTRACT.md`  
**Domain API:** `docs/product/MEETUP_INVITATION_API_CONTRACT_DRAFT.md`, D-28

## Triggers (MVP)

| # | Domain event | Notification type | Notify | Actor |
|---|--------------|-------------------|--------|-------|
| 1 | Invite created (`PENDING`) | `MEETUP_INVITATION_RECEIVED` | Recipient | Sender |
| 2 | Invite accepted | `MEETUP_INVITATION_ACCEPTED` | Sender | Recipient |
| 3 | Invite declined | `MEETUP_INVITATION_DECLINED` | Sender | Recipient |
| 4 | Invite withdrawn | `MEETUP_INVITATION_WITHDRAWN` | Recipient | Sender |

## Dedupe keys

- `meetup-invite:{inviteId}:received`
- `meetup-invite:{inviteId}:accepted`
- `meetup-invite:{inviteId}:declined`
- `meetup-invite:{inviteId}:withdrawn`

## Privacy

No venue, address, note, coordinates, or invite title in notification or push fields. `sourceId` = invite UUID only.

## Read state

`UserNotification.readAt` ≠ invitation accept. Mark read via `/v1/me/notifications/{id}/read`.

## Navigation

Flutter opens `GET /v1/meetup-invites/{sourceId}` after auth check.

## Deferred

Expiry/reminder/check-in notifications (028G+ / MEET-NOTIFY extended scope).
