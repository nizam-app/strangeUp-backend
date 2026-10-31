# Auth flow Figma parity — Task 022 (2026-10-28)

**Evidence:** `cursor_tasks/StrangeUp_Task_022_Staged_Auth_Repair_Execution.md` screen inventory (11 PDFs from `Strange up(auth).zip`). Local `design-reference/` PDF bytes were **not** present in this workspace at audit time; classifications are grounded in the staged plan + **implemented backend routes/tests**, not re-opened PDF pixels.

**Owner flow (authoritative, amended 2026-10-30 Task 031B.2):** Splash → Onboarding → Login/Signup → Government ID (Veriff SDK) → Selfie (Veriff SDK) → Provider decision → StrangeUp admin review → Home/main app. Email verification is **optional** (not an onboarding gate).

**Legend:** MATCHED | PARTIAL | MISSING | DEFERRED | FLUTTER-ONLY

---

## End-to-end journey vs backend

| Journey step | Backend | Status | Notes |
|---|---|---|---|
| Create account + DOB + consent | `POST /v1/auth/register` | **MATCHED** | No tokens on register; consents persisted |
| Email verification (optional) | `POST /v1/auth/email-verification/*` | **MATCHED** | Not required for IDV/Home; production email **DEFERRED** (DEV_ONLY stub) |
| Login (pending) | `POST /v1/auth/login` → `user.fullAccess: false` | **MATCHED** | Flutter must call `GET /v1/me/onboarding/status` |
| Start IDV | `POST /v1/me/verification/sessions` | **MATCHED** | Mock/Veriff adapter; production Veriff **DEFERRED** (owner block) |
| Government ID capture | — | **FLUTTER-ONLY** | Veriff SDK; no backend ID image upload |
| Selfie / liveness | — | **FLUTTER-ONLY** | Veriff SDK |
| Provider decision | `POST /v1/webhooks/verification/:provider` | **MATCHED** (mock) | HMAC raw body; `veriff` live **DEFERRED** |
| Admin review queue | `GET/POST /v1/admin/identity-reviews/*` | **MATCHED** | Staff `IDENTITY_REVIEWER`; no Admin UI in repo |
| Home / main app | `GET /v1/home`, gated mounts | **MATCHED** | Requires provider + admin on same session (022C) |
| Admin rejected | `POST .../reject` + onboarding `ADMIN_REJECTED` | **MATCHED** | `403 ACCOUNT_NOT_ACTIVATED` on main app |
| KYC expiry/revocation after approval | Webhook + DB revocation fields | **MATCHED** | Home denied on next request (DB reload) |
| Password reset → login | `POST /v1/auth/password-reset/*` | **MATCHED** | Sessions revoked; user still onboarding until activated |
| Refresh while pending | `POST /v1/auth/refresh` | **MATCHED** | Does not grant Home |
| Legacy email-active users | Policy only | **PARTIAL** | No automatic admin backfill; ops playbook **DEFERRED** (doc) |

---

## PDF screen / control matrix

| Source PDF | Visible controls / claims | Classification | Backend / contract |
|---|---|---|---|
| Screen 1 — Splash | Start, marketing (E2EE, peer counts) | **FLUTTER-ONLY** | No splash API; do not echo unverified marketing as API state |
| Screen 2 — Meet People (map/radar) | Continue, Skip, location | **FLUTTER-ONLY** | No geolocation/radar APIs |
| Screen 3 — Safe & Verified | Continue, Skip | **FLUTTER-ONLY** | Skip target unverified in prototype |
| Screen 4 — Meet Through Activities | Get Started, Login, Skip | **FLUTTER-ONLY** | Route via onboarding status, not register tokens |
| Screen 05 — Login | Email/password, forgot, sign up | **MATCHED** / **DEFERRED** | Auth LIVE; Apple/Google **DEFERRED** (no routes) |
| Forgot password canvas | Send reset, back to login | **MATCHED** | Reset request/confirm LIVE; prod email **DEFERRED** |
| Screen 06 — Sign Up | Names, email, phone, password, Terms | **PARTIAL** | DOB + consent LIVE; phone field **DEFERRED** (no SMS OTP) |
| Screen 07 — ID Verification hub | Step list, Start Verification | **MATCHED** | `GET /v1/me/onboarding/status` + verification status APIs |
| Screen 1 — Government ID | ID type, upload, continue | **FLUTTER-ONLY** | Provider SDK only |
| Screen 2 — Selfie | Liveness, continue | **FLUTTER-ONLY** | Provider SDK only |
| Mask group | Flow label | **FLUTTER-ONLY** | Non-interactive |
| *(Not in ZIP)* Email verification UX | — | **PARTIAL** | API LIVE; Figma UX **MISSING** from supplied export |
| *(Not in ZIP)* Admin waiting / approved / rejected UI | — | **PARTIAL** | States via onboarding API; screens **MISSING** from ZIP |
| Main Flow Screen 08 (Home) | People/activities/featured, optional community update | **PARTIAL** | `/v1/home` LIVE; parity matrix `docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025A.md` (Task 025A) |

---

## `nextAction` routing (Flutter)

| `nextAction` | Typical `onboardingPhase` | Client route hint |
|---|---|---|
| `VERIFY_EMAIL` | `AWAITING_EMAIL_VERIFICATION` | Email verify / resend |
| `START_IDENTITY_VERIFICATION` | `READY_FOR_IDENTITY_VERIFICATION` | Screen 07 / Veriff start |
| `CONTINUE_IDENTITY_VERIFICATION` | `IDENTITY_VERIFICATION_IN_PROGRESS` | Resume SDK |
| `WAIT_FOR_PROVIDER_DECISION` | `AWAITING_PROVIDER_DECISION` | Waiting UI |
| `WAIT_FOR_ADMIN_REVIEW` | `AWAITING_ADMIN_REVIEW` | Post–Final Review waiting (no Figma in ZIP) |
| `ADMIN_REJECTED` | `ADMIN_REJECTED` | Blocked / support |
| `RETRY_IDENTITY_VERIFICATION` | `PROVIDER_DECLINED_OR_EXPIRED` / resubmit | Retry policy per status |
| `HOME_READY` | `FULLY_ACTIVATED` | Home (when `homeAccessAllowed`) |
| `ACCOUNT_SUSPENDED` | — | Support |
| `CONTACT_SUPPORT` | — | Ineligible age / terminal |

Full list implemented in `src/modules/policy/effective-access-policy.ts`.

---

## Production blockers (unchanged)

- Veriff live sessions/webhooks (`KYC-02`, `VERIFF_LIVE_CALLS_ENABLED`).
- Canonical consent version IDs (`CONSENT_ENFORCEMENT=strict` in production).
- Transactional email provider for verify/reset in production.
- OAuth (Apple/Google) — not implemented.
- Admin UI — separate; APIs only.
- Staff MFA / step-up — documented fail-closed until configured.

---

## Test evidence (022D)

Targeted integration file: `tests/integration/auth-flow-e2e.task022d.integration.test.ts` (journeys J01–J07). Full module regression: 022C (**117 passed**, 1 skipped) — not re-run in 022D per policy.
