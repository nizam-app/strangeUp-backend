# Task 028 — Owner sign-off checklist (post-028H)

Backend status: **READY_FOR_OWNER_REVIEW** (documentation only).  
`capabilities.meetupInvites` stays **DEFERRED** until owner explicitly authorizes **LIVE**.

## Required owner decisions

- [ ] Accept D-28 implemented scope (create, inbox, detail, accept/decline/withdraw, lazy expiry, four notifications).
- [ ] Authorize Flutter to integrate `/v1/meetup-invites*` and notification navigation (`sourceId` → detail).
- [ ] Authorize changing `meetupInvites` from **DEFERRED** to **LIVE** in settings capabilities (separate code change).
- [ ] Confirm Figma “Mark read” uses notification APIs, not invite status (MDWQ-0506).
- [ ] Apply pending migrations to **strangeup_dev** when staging meetup features (`20261029170000`, `20261029180000`).

## Explicitly out of scope until new approval

- [ ] Reschedule / counter-proposal (MDWQ-0724)
- [ ] Post-acceptance cancellation
- [ ] Reminders, check-in workers, maps/directions
- [ ] Profile mutual/upcoming enrichments (MDWQ-0726)
- [ ] Production FCM (MDWQ-0508)

## Verification artifacts

- `TASK_028H_FINAL_VERIFICATION_REPORT.md`
- `FIGMA_DISCOVER_MEETUP_PARITY_TASK028H_FINAL.md`
- `FLUTTER_DEVELOPER_HANDOFF.md` §13A, §16
- `openapi/meetup-invites.yaml`, `openapi/push-devices.yaml`
