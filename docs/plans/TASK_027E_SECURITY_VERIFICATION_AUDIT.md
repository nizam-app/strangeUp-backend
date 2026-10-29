# Task 027E — Security verification audit (pre–027F)

**Date:** 2026-10-29  
**Scope:** Source review + bounded Neon `strangeup_test` integration. **No join-mode implementation changes.**

## Existing 027E tests (before this audit)

| ID | File | Assertions |
|---|---|---|
| T027E-01 | `activity-join-approval-027e.integration.test.ts` | AUTO draft `joinMode`; instant CONFIRMED; `participationStatus=AUTO_CONFIRMED` |
| T027E-02 | same | HOST_APPROVAL → PENDING; meeting **403** for pending guest |
| T027E-03 | same | Host lists 2 pending; `hostParticipationSummary`; approve/decline; approve after decline **409**; declined user not in `view=pending`; confirmed user **404** on join-requests; leave |

**Gaps identified:** concurrent dual approve, idempotent approve, DECLINED meeting gate, block/KYC at approve, HOST_APPROVAL waitlist FIFO promotion, explicit AUTO default, withdraw/approve race, `INTEGRATION_DATABASE_URL` harness alignment.

## Source-backed mechanisms (no defects found)

| Concern | Implementation |
|---|---|
| Overbooking | `ActivityHostJoinRequestsService.approve` runs in `$transaction` with `SELECT … FROM "Activity" … FOR UPDATE`, then counts `CONFIRMED` before seat assignment (`activity-host-join-requests.service.ts`). |
| Duplicate approve/decline | Approve idempotent when already CONFIRMED/WAITLISTED; decline idempotent when DECLINED; non-PENDING approve/decline → **409**. |
| Withdraw vs approve | Both paths lock activity row; terminal state is either CONFIRMED or CANCELLED (race test added). |
| Meeting privacy | `canAccessMeetingDetails` requires non-host `participationState === CONFIRMED` (+ KYC for real-world) (`activity-policy.ts`). PENDING/DECLINED/WAITLISTED → **403** on `GET …/meeting`. |
| Block at review | `isBlockedEitherDirection` on approve → **409**. RSVP create already **404** when blocked with published host (`activity-rsvp.service.ts`, T010-N02). |
| KYC at review | Re-check `hasTrustedKycForActivityAction` on approve → **409** (not guest-facing KYC error). |
| Approved waitlist FIFO | `isWaitlistFifoEligible` + `tryPromoteHead` scan (`activity-rsvp.service.ts`, `activity-join-policy.ts`). |
| AUTO default | Prisma `@default(AUTO)` + migration; create without `joinMode` returns AUTO in API. |
| Host suspension | T027E-SEC-08 — suspended host approve returns **401** (token/account gate before manage handler). |

## Added regression tests (audit pass)

File: `tests/integration/activity-join-approval-027e-security.integration.test.ts`

| ID | Coverage |
|---|---|
| T027E-SEC-01 | Concurrent dual approve, capacity 1 → exactly 1 CONFIRMED + 1 approved WAITLISTED |
| T027E-SEC-02 | Double approve idempotent; decline after confirm **409** |
| T027E-SEC-03 | DECLINED → meeting **403** |
| T027E-SEC-04 | Block + KYC revocation → approve **409** |
| T027E-SEC-05 | HOST_APPROVAL full → approved waitlist → leave promotes head |
| T027E-SEC-06 | Omit `joinMode` on create → DB/API **AUTO** |
| T027E-SEC-07 | Parallel approve + withdraw → ≤1 CONFIRMED seat |

Harness fix: both 027E integration files now use **`INTEGRATION_DATABASE_URL`** (matches `activities.integration.test.ts`).

## Neon results (2026-10-29)

Prerequisite: migration `20261029160000_activity_join_mode_host_approval` applied to **`strangeup_test`** via `npx tsx scripts/apply-migrations-neon.ts`.

```
RUN_INTEGRATION=1 npm run test:integration -- activity-join-approval-027e
→ 2 files, **11** tests passed (3 baseline + 8 security)
```

Unit: `activity-join-policy.test.ts` (FIFO eligibility, decline reapply policy, presentation labels) — included in suite **255** passed (unchanged count; no new unit file).

## Residual gaps (document only)

| Item | Notes |
|---|---|
| Host suspended mid-review | Policy via `hasFullAccountAccess`; no dedicated Neon case |
| Block created **after** PENDING request | Approve blocked (**409**); PENDING row remains until host decline or guest withdraw |
| Concurrent duplicate **decline** | Idempotent DECLINED return; not load-tested |
| Production KYC fail-closed | Covered in Task 010 unit/policy tests, not re-run here |
| Full activity integration regression | Deferred MDWQ-0099 |

**Confirmed defects:** none. **Implementation changes:** none (tests + harness only).
