# Push delivery operations (Task 023D)

## Overview

Persisted in-app notifications (`UserNotification`) enqueue one row in `PushNotificationOutbox`. An in-process worker claims pending rows, evaluates recipient eligibility, and sends privacy-safe FCM messages through `firebase-admin` when `PUSH_ENABLED=true`.

**Default:** `PUSH_ENABLED=false` — worker runs but marks deliveries **`SKIPPED`** with reason `PUSH_DISABLED` (fail-closed, no external sends).

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PUSH_ENABLED` | `false` | Master delivery switch |
| `PUSH_WORKER_ENABLED` | `true` | Toggle worker interval |
| `PUSH_WORKER_INTERVAL_MS` | `5000` | Poll interval |
| `PUSH_WORKER_BATCH_SIZE` | `20` | Max rows per batch |
| `PUSH_MAX_ATTEMPTS` | `5` | Retry cap for transient FCM errors |
| `PUSH_RETRY_BASE_MS` | `2000` | Exponential backoff base |
| `PUSH_OUTBOX_LOCK_TTL_MS` | `120000` | Reclaim stale `PROCESSING` locks |
| `PUSH_MAX_NOTIFICATION_AGE_SECONDS` | `86400` | Skip push for older notifications (0 = no limit; prevents backlog flood on activation) |
| `FIREBASE_CREDENTIALS_FILE` | — | Path to service account JSON (secret mount) |
| `FIREBASE_PROJECT_ID` | — | Optional explicit project id |

Production startup **rejects** `PUSH_ENABLED=true` until owner authorization (`production-env-policy.ts`).

## Failure handling

| Outcome | Meaning |
|---------|---------|
| `SENT` | At least one device accepted the message |
| `SKIPPED` | Push disabled, opt-out, ineligible account, category off, or no valid devices |
| `FAILED` | Retries exhausted or permanent FCM error |
| `PENDING` | Waiting or scheduled retry (`nextAttemptAt`) |

Invalid registration tokens revoke the corresponding `UserDeviceToken` row.

## Security

- Never log `registrationToken`, service account JSON, or notification bodies in push payloads.
- Pino redacts `FIREBASE_CREDENTIALS_FILE` path values in server logs (path only in config, not file contents).
- Tests use `MockFcmSender` (`NODE_ENV=test`) — no live Firebase network calls.

## Migrations

`prisma/migrations/20261028190000_task023d_push_outbox/` — `PushNotificationOutbox` + `PushOutboxStatus` enum.
