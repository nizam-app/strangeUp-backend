# Task 022D — Auth flow acceptance report (backend)

**Date:** 2026-10-28  
**Scope:** Backend only; Phases 022A–022C preserved.  
**AUTH FLOW FULLY VERIFIED:** **Yes on sandbox harness** (mock KYC + staff grant + Neon integration). **No** for production launch (Veriff live, strict consent, prod email, OAuth).

---

## Executive summary

The owner-mandated activation pipeline is implemented and covered by policy, HTTP gates, admin APIs, and targeted E2E integration tests. Figma auth ZIP screens are mapped with honest **FLUTTER-ONLY** / **DEFERRED** labels where the backend does not own UI or unapproved integrations. No new migrations in 022D.

---

## Changes in 022D

| Item | Path |
|---|---|
| Auth-flow E2E integration (7 cases) | `tests/integration/auth-flow-e2e.task022d.integration.test.ts` |
| Figma parity matrix | `docs/product/FIGMA_AUTH_FLOW_PARITY_TASK022.md` |
| This report | `docs/plans/TASK_022D_AUTH_FLOW_ACCEPTANCE_REPORT.md` |
| Doc updates | `docs/plans/STATUS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, `docs/api/CURRENT_APIS.md`, `docs/decisions/ADR-005-auth-flow-admin-activation-2026-10-28.md` |

No production code refactors (022A–022C enforcement unchanged).

---

## Verified journeys (integration)

| ID | Journey | Result |
|---|---|---|
| T022D-J01 | Register → verify → IDV session → webhook → admin approve → Home | Pass |
| T022D-J02 | Pending login; Home `ONBOARDING_REQUIRED` | Pass |
| T022D-J03 | Admin reject; Home `ACCOUNT_NOT_ACTIVATED` | Pass |
| T022D-J04 | Legacy-style active user without admin; main app denied | Pass |
| T022D-J05 | Post-activation revocation; JWT cannot bypass DB | Pass |
| T022D-J06 | Password reset; re-login still not Home | Pass |
| T022D-J07 | Refresh while pending; Home still blocked | Pass |

Prior 022B/C coverage retained: admin queue, idempotency, webhook→queue, cross-module gates (`access-enforcement`, `admin-identity-review`, `onboarding`, `auth`, `kyc-verification`).

---

## Quality gates (022D run)

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm test` (unit) | **203 passed** (51 files) |
| `RUN_INTEGRATION=1 npx vitest run --config vitest.integration.config.ts tests/integration/auth-flow-e2e.task022d.integration.test.ts` | **7 passed** (~34s) |
| Full Neon integration suite | **Not re-run** (022C: 117 passed) |

---

## Remaining gaps (post–Task 022)

1. **Production Veriff** and paid vendor calls (owner authorization).
2. **Strict consent** registry versions for release.
3. **Production email** for verify/reset links.
4. **OAuth** Apple/Google (Login PDF controls).
5. **Phone** on signup (optional/deferred; no backend SMS).
6. **Admin request-more-info** API (022B deferral).
7. **Legacy production migration playbook** (staff review of pre-022 accounts — no fake approvals).
8. **Home journey Figma** from owner (post-approval UI).
9. **Promotional copy** (E2EE, instant verify, peer counts) — Flutter/design only; backend must not assert.

---

## Sign-off statement

Task **022A–022D backend auth repair** is **complete** for sandbox/integration evidence. Production **launch remains blocked** until owner clears deferrals above.

**STOP — no further auth-flow phases in this task line.**
