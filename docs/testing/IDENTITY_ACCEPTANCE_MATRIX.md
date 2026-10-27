# Identity Acceptance & Test Matrix (Task 002A)

**Status:** Partial verification through Task **002B.1A** (see § Task 002B.1A results). Task 002A had no auth tests.
**Layers:** unit → API (supertest) → PostgreSQL integration → security/BOLA.
**Environment note:** Task 001.1 verified connectivity via Prisma Dev (PGlite-backed). **Advanced locking/concurrency claims require native PostgreSQL** before production confidence.

---

## Prerequisites (Task 002B onward)

| Prerequisite | Purpose |
|---|---|
| `INTEGRATION_DATABASE_URL` isolated test DB | Constraint and transaction tests |
| Native PostgreSQL instance (optional CI job) | Session rotation races, unique constraint under load |
| No real KYC credentials or government IDs | Stub provider only |
| `RUN_INTEGRATION=1` gate | Same pattern as health integration test |

---

## Positive cases

| ID | Scenario | Layer | Acceptance criteria |
|---|---|---|---|
| I-P01 | Register with valid payload | API + DB | User row + password hash; no plaintext password in DB |
| I-P02 | Login valid credentials | API | Access + refresh returned; session row created |
| I-P03 | Refresh rotation | API + unit | New refresh works; old refresh fails afterward |
| I-P04 | Logout revokes session | API | Subsequent refresh 401; family revoked if configured |
| I-P05 | Email verify confirm | API | `emailVerifiedAt` set; status transition per D-02 |
| I-P06 | Password reset full flow | API | Challenge consumed; can login with new password |
| I-P07 | PATCH own profile allowed fields | API | Persisted; public DTO omits private fields |
| I-P08 | Start KYC stub session | API | Session `PENDING_USER`; no binary stored in DB |
| I-P09 | Webhook stub approve | Integration | Idempotent; `VerificationDecision` append-only |

---

## Negative & abuse cases

| ID | Scenario | Layer | Acceptance criteria |
|---|---|---|---|
| I-N01 | Duplicate signup same email | API + DB | 409 or generic 400 per enumeration policy; one user row |
| I-N02 | Malformed email/password | API | 400 `VALIDATION_ERROR`; no user created |
| I-N03 | Login wrong password | API | 401 generic; no user id leak |
| I-N04 | Login suspended/deleted | API | 401/403; no token |
| I-N05 | Reset request unknown email | API | 202 identical body to known email |
| I-N06 | Expired reset token | API | `AUTH_CHALLENGE_EXPIRED`; not consumed |
| I-N07 | Reused reset token | API | Second attempt fails; sessions still valid policy per product |
| I-N08 | Brute force login | API | 429 after threshold |
| I-N09 | Refresh replay after rotation | API | Family revoked; all sessions dead |
| I-N10 | Access token after logout | API | 401 |
| I-N11 | PATCH another user's profile | API/BOLA | 404/403; no mutation |
| I-N12 | GET another user's verification | API/BOLA | 404/403 |
| I-N13 | Unverified user gated action | Policy unit | `canInteractWithUser` false; future routes 403 |
| I-N14 | OAuth token invalid signature | API | 401; no user created |
| I-N15 | OAuth email collision | API | No merge; `linkingRequired` or error per spec |
| I-N16 | Mass assignment `isAdmin` on PATCH | API | Field stripped/rejected |
| I-N17 | KYC webhook replay same eventId | Integration | Single decision row |
| I-N18 | KYC webhook out-of-order | Integration | Terminal state not regressed |
| I-N19 | Register idempotency key replay | API | Same response; no duplicate user |
| I-N20 | Register idempotency key new payload | API | 409 conflict on key misuse |

---

## Concurrency & integration (native PG recommended)

| ID | Scenario | Acceptance criteria |
|---|---|---|
| I-C01 | Two parallel registers same email | Exactly one succeeds |
| I-C02 | Two parallel refresh with same token | At most one wins; family revocation safe |
| I-C03 | Password reset consume race | One consumption |
| T005-P01 | Authenticated password change | Sessions revoked; re-login required |
| T005-N01–T005-N03 | Password change auth/validation negatives | Wrong current, weak/same new, unauthenticated |
| T005-C01 | Concurrent password change | One 200, one 409 |
| I-C04 | Concurrent session `logout-all` + refresh | Eventual deny |

**Gate:** mark I-C* as `NOT VERIFIED` until run against native PostgreSQL with evidence in CI logs.

---

## Security & observability

| ID | Scenario | Acceptance criteria |
|---|---|---|
| I-S01 | Authorization header in logs | Redacted by `redactSensitive` |
| I-S02 | Error responses in production | No stack traces (`FOUNDATION_ENVELOPE`) |
| I-S03 | Reset/verify tokens in response body | Never returned except single-use delivery channel mock in tests |
| I-S04 | Timing attack on login | Bounded variance (best effort) |
| I-S05 | BOLA enumeration on user UUID | Consistent 404 policy |

---

## Deployment gates (identity milestone)

Before calling identity “ready for staging” (future task):

1. All I-P01–I-P09 and I-N01–I-N20 implemented and passing in CI unit/API suite.
2. Integration subset green on `INTEGRATION_DATABASE_URL`.
3. Native PG concurrency subset I-C01–I-C04 executed at least once with recorded results.
4. Owner sign-off on D-01, D-02, D-02-AUTH, D-09 documented in `IDENTITY_DECISION_REVIEW.md`.
5. No claim of live KYC without vendor DPA and D-09 approval.

---

## Traceability to product stories

| Matrix IDs | PRD / screen |
|---|---|
| I-P01–I-N04 | AUTH-01, AUTH-02, screens 33, 31 |
| I-P06, I-N05–I-N07 | screen 35 |
| I-P07–I-N11 | PROF-01, screen 37 |
| I-P08–I-N18 | KYC-01, screens 34, 48, 49 |
| I-N13, I-S05 | SAFE-01, D-03 deny |

---

## Task 002A verification performed

- Documentation consistency review against codebase baseline (no auth routes in `src/app.ts`).
- **No auth unit/integration tests added or run in Task 002A.**

---

## Task 002B.1A verification results (2026-10-26)

Environment: Prisma Dev **PGlite-backed** PostgreSQL TCP (`INTEGRATION_DATABASE_URL`); **not** native PostgreSQL. Concurrency suite remains **NOT VERIFIED**.

| ID | Result | Evidence |
|---|---|---|
| I-P01 | **PASS** | `integration: auth flows > I-P01 register...` |
| I-P02 | **PASS** | Covered in I-P02/I-P03 test |
| I-P03 | **PASS** | Refresh rotation + replay revokes family |
| I-P04 | **PASS** | `logout revokes refresh` + I-N10 access after logout |
| I-P05 | **PASS** | Email verify confirm |
| I-P06 | **PASS** | `me.integration.test.ts` — reset + session revoke + re-login |
| I-P07 | **PASS** | Profile PATCH allowlist + mass-assignment rejection |
| I-P08–I-P09 | **NOT RUN** | KYC out of scope |
| I-N01 | **PASS** | Duplicate email |
| I-N02 | **PASS** | Underage + future DOB (integration); malformed via Zod (unit) |
| I-N03 | **PASS** | Wrong password |
| I-N04 | **PASS** | Suspended login/refresh/access |
| I-N05 | **PASS** | Unknown vs known email same 202 body |
| I-N06–I-N07 | **PASS** | Expired/reused/wrong-purpose reset tokens |
| I-N08 | **UNVERIFIED** | In-memory rate limits; no automated brute-force integration test |
| I-N09 | **PASS** | Refresh replay after rotation |
| I-N10 | **PASS** | Access token after logout |
| I-N13 | **PASS** | `tests/policy.test.ts` |
| I-N19–I-N20 | **PARTIAL** | Idempotency same key + conflict; parallel race **NOT VERIFIED** |
| I-C03 | **PASS (PGlite-backed)** | Concurrent reset confirm — one 200, one 400 |
| I-C01–I-C02, I-C04 | **NOT VERIFIED** | Requires native PostgreSQL concurrency gate |
| I-S01 | **VERIFIED** | `redactSensitive` + pino redact paths (manual code review) |
| I-S03 | **VERIFIED** | Raw verify token only in dev email stub body (not HTTP API) |

**Release blockers (unchanged):** counsel-approved consent version enforcement; production email; KYC; phone OTP.

---

## Task 002B.2 verification results (2026-10-26)

Environment: Prisma Dev **PGlite-backed** TCP on port **51214** with database `strangeup_integration` (separate from dev `template1` on same host). Owner `.env` `strangeup_test` instance on port 51218 was **not reachable** during this run; integration executed with an alternate isolated DB on the running dev server.

| Command | Result |
|---|---|
| `npm run prisma:validate` | PASS |
| `npm run prisma:generate` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run format:check` | PASS |
| `npm test` | PASS (24 tests) |
| `npm run build` | PASS |
| `RUN_INTEGRATION=1 npm run test:integration` | PASS — 20 tests, 1 skipped (`health-ready` negative path) |

New integration file: `tests/integration/me.integration.test.ts` (password reset + `/v1/me`).

---

## Task 002B.2A verification results (2026-10-26)

| Item | Result |
|---|---|
| `strangeup_test` Prisma Dev instance | **RESTORED** (`npx prisma dev start strangeup_test`; TCP port **51218**) |
| Dev vs integration targets | **DISTINCT** — dev `localhost:51214`, integration `localhost:51218` (both `template1` on separate instances) |
| Same-URL guard | **VERIFIED** — setup throws before any test runs |
| scrypt upgrade | **APPLIED** — preferred **p=5**; legacy **p=1** verified; rehash-on-login integration test |
| Full quality gate | **PASS** — 26 unit, 21 integration (+1 skipped health doc test) |

Benchmark (local Node 22, single-threaded): p=1 ~68ms, p=5 ~224ms, N=2^17 ~416ms — **p=5** chosen per OWASP scrypt example without breaking stored-parameter compatibility.
