# Task 028H — Final Discover & personal meetup verification

**Date:** 2026-10-29  
**Outcome:** Approved backend scope **READY_FOR_OWNER_REVIEW** (see capability rule below).  
**Figma parity:** `docs/product/FIGMA_DISCOVER_MEETUP_PARITY_TASK028H_FINAL.md`  
**Owner checklist:** `docs/plans/TASK_028H_OWNER_SIGNOFF_CHECKLIST.md`

---

## 1. Lifecycle verification (source + tests)

| State | Mechanism | Evidence |
|-------|-----------|----------|
| `PENDING` | Create | 028D/028H E2E |
| `ACCEPTED` | Recipient accept | 028E, 028H |
| `DECLINED` | Recipient decline | 028E, 028G |
| `WITHDRAWN` | Sender withdraw | 028E, 028G |
| `EXPIRED` | Lazy reconcile on read/list/mutate | 028D/E/H |

APIs: `POST/GET /v1/meetup-invites`, `GET/POST …/:id/(accept|decline|withdraw)`.

Idempotency: create header replay; terminal mutation **200**; conflicting terminal **409**.  
Pagination: cursor on list; `counts.pending` incoming only.

---

## 2. Security (verified)

- Task 022 activation on router + participant checks on mutations.
- Discoverable recipient on create; bidirectional block → **404** on read/mutate.
- KYC revocation → **403** on accept; no erroneous transition notifications (028G tests).
- Venue redaction pre-accept; full venue for recipient only after **ACCEPTED** (028E/H).
- No cross-user invite access (028E stranger **404**).
- No Activity RSVP, DM thread, or group side effects on invite create (028H isolation test).

---

## 3. Notifications (028G + 028H)

- One deduped row per successful create/transition.
- Generic copy; no `actorUserId`; push payload type + `sourceId` only.
- `meetupInvitesEnabled` gates push at send time.
- Retained notification after block: generic body, no venue leak; invite detail **404** (028H).
- **Rollback:** simulated emit failure rolls back invite create (028H-ROLLBACK).
- Production push remains off (`PUSH_ENABLED` default false).

---

## 4. Regressions (028H bounded Neon)

- Discover people + public profile **200**
- Follow, wave, message-request **200/201**
- `capabilities.meetupInvites` **DEFERRED** on settings overview
- Activity participation / conversation counts unchanged on meetup create

**Not re-run in 028H:** full `social.integration.test.ts`, full 027E security suite (release deferral).

---

## 5. Design source integrity

PDF SHA-256 on disk matches `design-reference/task028-discover-meetup/MANIFEST.md` (028H re-check).

---

## 6. Migration state (report only — no dev/prod apply)

| Catalog | Pending migrations (as of 028H audit) |
|---------|----------------------------------------|
| **strangeup_test** | **Applied** through `20261029180000_task028g_meetup_notifications` (via `scripts/migrate-integration-only.ts` during 028G) |
| **strangeup_dev** | **Pending:** `20261029170000_task028c_personal_meetup_invitation`, `20261029180000_task028g_meetup_notifications` |

Owner action for dev: `npm run db:neon:migrate` (or deploy pipeline) when ready — **not executed in 028H**.

---

## 7. Capability rule

`buildSettingsCapabilities().meetupInvites` remains **`DEFERRED`**.  
Documentation may state **READY_FOR_OWNER_REVIEW**; **LIVE** requires separate owner authorization.

---

## 8. Test evidence (this phase)

| Suite | Count | Notes |
|-------|------:|-------|
| Unit (`npm test -- --run`) | **279** | Includes `meetup-invite-notifications.test.ts` |
| Integration meetup bundle (`RUN_INTEGRATION=1`) | **30/30** (028c schema 2 + 028d 5 + 028e 8 + 028g 9 + 028h 6) | See command below |

**Command (bounded meetup + 028H):**

```bash
RUN_INTEGRATION=1 npm run test:integration -- tests/integration/meetup-invite-schema-028c.integration.test.ts tests/integration/meetup-invite-028d.integration.test.ts tests/integration/meetup-invite-028e.integration.test.ts tests/integration/meetup-invite-028g-notifications.integration.test.ts tests/integration/meetup-invite-028h-final.integration.test.ts
```

---

## 9. Release blockers vs deferrals

| Release blockers (owner/product) | Optional deferred |
|----------------------------------|-------------------|
| Hub capability LIVE sign-off (MDWQ-0506) | Reschedule MDWQ-0724 |
| Apply 028C/028G migrations to **strangeup_dev** | Post-accept cancel |
| Flutter wiring to REST + notifications | Maps, check-in, ratings |
| | Full Neon regression at release |

---

**STOP:** Task 028 backend phases complete through **028H**. No Task 029 started.
