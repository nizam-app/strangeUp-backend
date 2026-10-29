# Task 027E — Hybrid join mode (ACT-APPROVAL)

**Date:** 2026-10-29  
**Decision:** [D-09](../decisions/D-09-activity-hybrid-join-mode-2026-10-29.md)  
**Status:** COMPLETE (backend only). **027F not started.**

## Delivered

- Schema: `Activity.joinMode` (`AUTO` default), `ActivityParticipationState` + `PENDING`/`DECLINED`, `hostApprovedAt` for approved waitlist FIFO.
- Migration: `20261029160000_activity_join_mode_host_approval`.
- RSVP branches on `joinMode`; AUTO regression preserved.
- Host join-request list/approve/decline with row locks and idempotent review.
- Inventory `view=pending`, `counts.pendingApproval`, `participationStatus` on `myParticipation`.
- Host counters via `hostParticipationSummary`.

## Verification

| Gate | Result |
|------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run build` | pass |
| Unit tests | **255** passed |
| Integration `activity-join-approval-027e` (Neon) | **10/10** passed (incl. security audit — `TASK_027E_SECURITY_VERIFICATION_AUDIT.md`) |
| Full Neon regression | deferred (MDWQ-0099) |

## Privacy / integrity notes

- PENDING/DECLINED cannot access meeting instructions (existing `canAccessMeetingDetails` gate).
- Join-request applicant profiles respect D-03 visibility; no fabricated trust metrics.
- Host review returns **404** for non-owners (no activity leak).
- **Remaining:** public attendee roster (027F), activity chat, reapply-after-decline product rule.

## MDWQ

- **MDWQ-0701** → COMPLETED  
- **MDWQ-0714** → COMPLETED  
- **MDWQ-0712** → DOCUMENTED (use server counters, not Figma fiction)
