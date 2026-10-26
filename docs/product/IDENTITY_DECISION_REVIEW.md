# Identity & Trust — Owner Decision Review

**Status:** Phase 1 decisions **APPROVED** (2026-10-26). Implementation not started until Task 002B.1.
**ADR:** `docs/decisions/ADR-004-identity-phase1-owner-decisions.md`
**Evidence basis:** `SCREEN_TRACEABILITY.md` (PRIOR-EXPORT-REPORTED).
**Context:** Launch market **USA**; engineering team **Bangladesh** (no impact on D-01 jurisdiction rule).

## Evidence mapping — identity-focused screens

| Export ID | UI feature | Label | Backend implication |
|---|---|---|---|
| 31 | Login — email/password, Apple, Google | DESIGN-OBSERVED | Email/password LIVE in 002B.1; OAuth UI deferred per D-02-AUTH |
| 33 | Sign up — name, email, phone, password | DESIGN-OBSERVED | Approved signup: email, password, DOB, consents — **phone not required** (OPEN) |
| 35 | Forgot password | DESIGN-OBSERVED | Planned 002B.2+ |
| 34, 48, 49 | ID / selfie verification | DESIGN-OBSERVED | Stub state machine later; no live provider per D-09 |
| 37 | Edit profile | DESIGN-OBSERVED | Profile module after auth core |
| 25 | Settings / account lifecycle | DESIGN-OBSERVED | logout-all, deletion later |

**Note:** Screen #33 shows phone; **mandatory phone collection remains UNRESOLVED** — not part of D-02 approval.

---

## Approved decisions (blocking identity implementation)

### D-01 — Launch jurisdictions, minimum age

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Answer** | Initial launch **United States (USA)**. **Adults only: 18+** minimum age. |
| **Approver** | Product owner |
| **Date** | 2026-10-26 |
| **Engineering** | Reject registration when DOB fails 18+ rule for USA launch config; store `ageEligibilityStatus` separately from KYC |

### D-02 — Signup data, consent, verification gates

| Field | Content |
|---|---|
| **Status** | **APPROVED** (partial — see open sub-items) |
| **Answer** | Registration requires **email**, **password**, **date of birth**, and **necessary legal acceptance** (versioned consent records). **Email verification required** before **full** account access. Account restricted until email verified and age eligible. |
| **Approver** | Product owner |
| **Date** | 2026-10-26 |
| **Open sub-items** | Mandatory **phone**; exact consent document versions; retention of consent evidence |

### D-02-AUTH — Authentication methods

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Answer** | **Email/password only** in Phase 1. **Defer** Google Sign-In, Apple Sign-In, and **phone OTP**. |
| **Approver** | Product owner |
| **Date** | 2026-10-26 |

### D-09 — Trust layers and KYC

| Field | Content |
|---|---|
| **Status** | **APPROVED** (partial — provider/retention open) |
| **Answer** | Keep **email verification**, **age eligibility**, and **government ID/KYC** as **separate** server-side dimensions. **No live KYC provider** in Phase 1. |
| **Approver** | Product owner |
| **Date** | 2026-10-26 |
| **Open sub-items** | KYC **vendor**; **retention**; **feature-specific** KYC requirements; appeals |

---

## Still open (not approved)

| ID | Topic |
|---|---|
| D-03 | Contact / follow / wave / message |
| D-04 | Location privacy |
| D-05–D-08 | Activities, groups, meetups, membership |
| D-10 | E2EE |
| D-11–D-19 | Commerce, jobs, admin, notifications, infra |
| — | Mandatory phone at signup |
| — | KYC provider, retention, per-feature KYC gates |

---

## Engineering requirements (unchanged)

Password hashing, hashed refresh/reset secrets, default-deny policies, no client-set verified flags, enumeration-resistant reset (when implemented), UTC timestamps.

---

## Owner sign-off checklist

| Item | Approver | Date | Approved answer |
|---|---|---|---|
| D-01 jurisdiction + minimum age | Product owner | 2026-10-26 | USA; 18+ |
| D-02 signup + email gate | Product owner | 2026-10-26 | Email, password, DOB, legal acceptance; verify email before full access |
| D-02-AUTH Phase 1 methods | Product owner | 2026-10-26 | Email/password only |
| D-09 trust + KYC | Product owner | 2026-10-26 | Separate dimensions; no live KYC yet |

---

## Task 002B.1 scope (next implementation)

See `cursor_tasks/TASK_002B_1_Identity_Schema_and_Email_Auth.md`.

**002A/002A1:** design + approvals only — **no auth code or migrations executed.**
