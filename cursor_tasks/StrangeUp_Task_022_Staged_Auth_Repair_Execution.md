# StrangeUp — Task 022 Staged Auth Flow Repair & Full Auth-Screen Parity

**Owner policy confirmed 2026-10-28:** Create Account → government document check → selfie/liveness check → trustworthy Veriff provider decision → StrangeUp admin review → Home and main-app access only after admin approval, valid identity, required email verification, age eligibility, and approved canonical consent. Production Veriff activation / paid calls are NOT authorized. Backend only. No Flutter implementation or admin UI. **This document is an addendum to and execution plan for** `StrangeUp_TASK_022_Auth_Onboarding_Admin_Approval_Flow_Repair.md` (the master specification), not a replacement for it.

## Evidence precedence

1. Explicit owner decisions and confirmed flow above.
2. Exact visual contents from `Strange up(auth).zip` (11 PDFs, including one nonfunctional flow-label page).
3. Current backend source and tests inspected inside Cursor; earlier engineering reports are secondary and not proof of route behavior.
4. The PDF montage establishes screen proximity/order, **not** verified clickable prototype connectors or unseen UI state transitions.

## Full ZIP screen-by-screen coverage and disposition

| PDF | Controls / outcome to verify | Backend disposition / required evidence |
|---|---|---|
| `Screen 1_ Splash Screen.pdf` | Start/session routing; ID secured / 4,820 peers / E2EE promotional text | No required backend Splash route. Document startup decision contract, pending/rejected/approved states. Marketing claims must not be echoed as verified backend states. |
| `Screen 3_ Onboarding - Safe & Verified Community.pdf` | Continue / Skip; ID checked marketing | Navigation is Flutter-owned; backend must not fake verified users; identity is mandatory before Home under new owner rule. Exact Skip target requires prototype proof. |
| `Screen 2_ Onboarding - Meet People Around You.pdf` | Continue / Skip; radar/map/distance/location promises | Flutter navigation; unsupported radar/precision claims not authorized. No backend geolocation additions. |
| `Screen 4_ Onboarding - Meet Through Activities.pdf` | Get Started / Login; Skip | Flutter routing only; Home remains gated. Do not assume Get Started target without prototype evidence. |
| `Screen 05_ Login.pdf` | Email/password, forgot password, Apple, Google, sign up; pending-user branch | Reuse existing login/refresh/logout; after login return/read onboarding state to prevent false Home navigation. Apple/Google remain unavailable until separate OAuth approval and actual implementation. |
| `Html → Body → Main - Native Mobile App Canvas (393px iPhone 15 base).pdf` | Forgot password email and send-reset-link, back to login | Reuse password reset request and confirm APIs; document reset-link handling. Production email remains gated on verified sender/base URL. |
| `Screen 06_ Sign Up.pdf` | First/last, email, phone, password + confirmation, Terms/Privacy, Create Account | Persist required DOB (18+) and canonical consent; Flutter must add DOB UI; phone optional/deferred, no SMS claim. Determine whether existing register returns auth session; never silently add full-access tokens to registration. Establish a safe post-register way to start IDV with restricted auth, aligned to existing auth policy. |
| `Screen 07_ ID Verification.pdf` | Personal Information Completed; Government ID Ready; Selfie Pending; Verification Review Pending; Start Verification | Expose truthful API step/status machine and `nextAction`; do not infer completion from SDK client state. |
| `Screen 1 — Government ID Verification.pdf` | ID type, ID upload/retake, continue selfie | The trusted Veriff SDK/provider owns sensitive ID capture and storage; backend only creates/binds sessions and receives signed provider decisions. Do not build standalone ID image-upload endpoints or store ID number. |
| `Screen 2 — Selfie Verification.pdf` | Liveness, selfie capture, continue to Final Review | Flutter/Veriff SDK owns capture; backend treats SDK completed as submitted/pending, not approved. |
| `Mask group.pdf` | Auth Flow header | Not an additional interactive product screen. |
| **Missing from supplied ZIP** | Email verification UX, Final Review/Admin Waiting/Approved/Rejected/Retry screens, Home transition after approval | Implement backend states, safe next actions, denial codes, and Flutter handoff; do not claim these UI designs are Figma-verified. Owner will share Home journey later. |

**Promotional-copy conflicts:** Splash/onboarding/login/signup claim E2EE, universal ID verification, precise-location guarantees, instant automated verification or numerical real-user counts. Backend must not assert what is not technically demonstrated. Report copy corrections to Flutter/design, do not modify original PDF exports.

## Cross-cutting invariants for all phases

- New owner policy supersedes browse-before-IDV and provider-only full-account approval. Record this in decision docs.
- Independent statuses: account/email/age/consent, Veriff identity verification, StrangeUp admin review, computed effective Home/app access.
- Provider APPROVED alone must NOT activate account. Admin APPROVED must NOT override provider decline/revocation/expiry or missing legal/age/email conditions.
- Pending users can authenticate **only for onboarding-safe APIs**, including identity initiation/status, email verification, password reset, consent and permitted security operations. No bypass through refresh tokens, Home, direct API calls or media byte routes.
- Admin rights must come from secure server-side assignment; no public admin signup or self-promotion, no reviewer override of a failed provider decision; audit every decision, race and replay.
- Keep existing content and data; use forward-only/additive migration. No production changes, external paid KYC requests, destructive DB actions, commits/pushes, Flutter edits or repo-wide formatting.
- Use isolated Neon `strangeup_test` for integration. During phased implementation DO NOT deploy/run production until the full final acceptance gate is green.
- Each phase is **implementation plus tests**, not docs-only. The next phase reads the prior phase's actual report and source, not assumptions.

## PHASE 022A — Map every screen, implement pending-account lifecycle and onboarding-safe auth

1. Inspect current auth, signup registration/session behavior, identity schemas (Task 021), consent registry, account gates and all exact API names. Build screen-by-screen parity map using above inventory; explicitly mark any unverified prototype connector.
2. Add forward-only lifecycle columns/tables/constraints as needed, separate provider and admin status, version/linkage to current verification attempt, derived access decision, pending-account transitions. Avoid duplicated Task 021 states.
3. Implement/reconcile `GET /v1/me/onboarding/status` (or existing same-purpose route) including `homeAccessAllowed`, verified requirements, honest step and `nextAction` without sensitive data.
4. Ensure newly registered accounts do not become active; route them into restricted authentication/IDV initiation. Preserve existing no-full-access-on-register semantics. Investigate token/refresh flow and document how Flutter enters IDV immediately; if no safe restricted session exists, implement it without allowing app access and report any change to register response contract.
5. Retain 18+ DOB and validated canonical consent; missing canonical legal IDs must fail closed for release, without invented versions. Phone optional until approved.
6. Test register, login, refresh, password reset, email verification, consent checks, all new onboarding statuses; ensure no accidental full access. Compare the supplied screens including onboarding and Login/Forgot controls.
7. Run Prisma validate/generate, typecheck, lint, focused and relevant tests. Return A report: models/route contracts/migration evidence, exact gaps and code results. Stop before phase B; do not falsely claim full Task 022 verification.

**Phase A acceptance:** a new applicant has a reliable restricted path to the IDV step, but no Home/full-app authority; every provided ZIP screen is accounted for in the parity table.

## PHASE 022B — Veriff trusted outcomes + StrangeUp admin-review backend

1. Reuse Task 021 sandbox Veriff adapter/session IDs and signed webhook pipeline. Verify exact raw-body HMAC and client authentication with official contract; strict current-session binding, replay/out-of-order guard, no client-faked APPROVED.
2. Build provider-result-to-review queue transition; only provider-approved CURRENT attempt can be reviewed. Retain minimum metadata; no ID/selfie storage; avoid conflating Veriff `review` state with StrangeUp admin review.
3. Implement admin-only paginated queue, minimal detail, approve, reject, and supported request-more-info/retry actions. Strong server-assigned roles, authenticated staff sessions, permission check at middleware AND service layer, self-review forbidden, audit events, safe reason codes, concurrency protection. Prepare APIs for future Admin UI; do not implement UI.
4. Explicitly define admin bootstrap/provisioning process and fail-closed behavior if staff identity/MFA/step-up not yet configured. Do NOT grant approval authority to ordinary users and do NOT expose test-only setters in production.
5. Test provider approved without admin (denied), admin approved with invalid provider (denied), rejected/expired/revoked (denied), signature tampering, old attempts, replay, concurrent approve/reject, staff auth and cross-user access.
6. Run phase quality checks and isolated Neon integration tests; deliver B report. Do not activate production Veriff or send paid requests.

**Phase B acceptance:** only a trusted current provider APPROVED plus authorized admin decision can produce an activation-eligible account; ordinary users cannot approve themselves.

## PHASE 022C — Whole-application access enforcement + legacy compatibility

1. Centralize reliable current DB-backed effective authorization: age/email/canonical-consent, valid current Veriff approval, admin approval tied to same current attempt, account not suspended/deleted.
2. Audit EVERY mounted router AND sensitive service, explicitly including Home, Discovery, Public User/Avatar, Activities/RSVP/Meeting, Groups/Posts/Chat/Media, Social/DMs, Notifications, Jobs/Applications, Store/Cart, Membership, Settings, own-avatar bytes and any newly added routes. Pending account only gets onboarding-safe allowlist; avoid blanket auth middleware blocking webhooks or health endpoints.
3. Return consistent safe 403 state/nextAction for pending and uniform 404 for other users' hidden/blocked resources; preserve existing D-03/04/block and activity KYC defense-in-depth.
4. Forward-only legacy migration: no fake admin approvals, data loss or silent grandfathering. Ensure existing sessions cannot bypass after policy flip and revoked/expired KYC immediately denies access. Inventory migration blast radius and staff operations.
5. Test direct API bypass for each module under pending/provider-only/admin-approved/rejected/expired/revoked, existing refresh JWT, legacy records and media endpoints. Run full Neon regression and repair test fixtures that previously assumed verification was optional, without weakening production policy.
6. Deliver C report including exact route coverage, tests and unresolved operational gating.

**Phase C acceptance:** no API route to main app bypasses the admin + verified KYC gate, and legacy users are restricted without data loss.

## PHASE 022D — Final flow end-to-end acceptance, Flutter/API handoff and security gate

1. Execute complete user journeys: (a) register → limited onboarding → email/consent/age → Veriff session → trusted result → admin queue → admin approval → Home; (b) rejected → remediation/blocked; (c) expiry/revocation after approval; (d) login returning pending/rejected state; (e) forgot password returning to login; (f) refresh/session revocation; (g) legacy-account restrictions.
2. Check each Figma PDF and every visible action against backend contract. Clearly label Flutter-only navigation vs supported server action, and list missing UI states, OAuth, phone and promotional claims; do not invent clickable connectors. Admin Review and Home transition are owner-specified, not Figma-supplied.
3. Verify secure staff setup, audit logs, webhook integrity, cross-module 403 bypass matrix; verify migration history/dev-test isolation; full unit + `RUN_INTEGRATION=1 npm run test:integration`, typecheck, lint, build, Prisma. Report the existing unrelated format drift rather than mass-reformat.
4. Update CURRENT_APIS.md LIVE/DEV_ONLY/PLANNED, FLUTTER_DEVELOPER_HANDOFF.md, identity/admin OpenAPI and Figma parity matrix; explicitly describe `nextAction` values, retry policy, token and email ordering, disabled OAuth/phone features, production Veriff limitations. Ensure test counts and statuses are evidence-based.
5. Return a single final owner-facing report identifying every change, migration, security test, blockers, and whether AUTH FLOW FULLY VERIFIED on sandbox harness or still has policy/integration gaps. Keep production launch blocked until real vendor activation and legal consent versions are approved.

**Phase D acceptance:** complete auth policy and screen-to-API parity is demonstrable in code/tests. Never claim perfect/missing-nothing based on PDFs alone; Home destination UI still to be supplied by owner.

## Copy-paste Cursor commands (run sequentially, separately)

### Command A
Execute Phase 022A only from `cursor_tasks/StrangeUp_Task_022_Staged_Auth_Repair_Execution.md`, with the original `cursor_tasks/StrangeUp_TASK_022_Auth_Onboarding_Admin_Approval_Flow_Repair.md` as master requirements. Read current source and the 11 auth PDFs, implement lifecycle schema + pending onboarding auth/status contracts, test, and report. Do not begin Phase B or deploy, commit, push, modify Flutter, or perform destructive DB operations.

### Command B
Phase 022A is complete. Read its actual code/report and execute Phase 022B only from `cursor_tasks/StrangeUp_Task_022_Staged_Auth_Repair_Execution.md`. Implement trusted Veriff sandbox outcomes and secure StrangeUp admin-review APIs, tests and audit. Do not begin Phase C, make paid/live Veriff requests, deploy, commit or push.

### Command C
Phase 022B is complete. Read implemented code/reports and execute Phase 022C only from `cursor_tasks/StrangeUp_Task_022_Staged_Auth_Repair_Execution.md`. Enforce effective access across every main-app route and service; preserve legacy data; full direct-route negative/security coverage on isolated Neon. Do not begin Phase D, deploy, commit, push or reset databases.

### Command D
Phase 022C is complete. Execute Phase 022D only from `cursor_tasks/StrangeUp_Task_022_Staged_Auth_Repair_Execution.md`. Run complete auth E2E and cross-module regressions; verify all 11 PDF screen contracts, document exact Flutter handoff and unverified prototype transitions. Produce final Task 022 acceptance report. Do not modify Flutter, deploy, commit, push or mass-format.
