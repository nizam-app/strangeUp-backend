# KYC / Government Identity Verification — Decision Gate

**Status:** **KYC-01, KYC-03, KYC-05 APPROVED** (2026-10-26). **KYC-ENF-01..05** action policies **APPROVED** (Task 002B.3A2). **Not implemented** — no live KYC APIs or backend enforcement.
**Owner handoff:** `docs/product/KYC_OWNER_DECISIONS_002B3A2.md` (authoritative for 002B.3A2); prior `KYC_OWNER_DECISIONS_002B3A1.md`
**Evidence basis:** ADR-004 (D-01, D-02, D-02-AUTH, D-09), `SCREEN_TRACEABILITY.md` exports **#34, #48, #49** (**PRIOR-EXPORT-REPORTED**), implemented identity slice (`prisma/schema.prisma`, `account-policy.ts`).
**Not legal advice.** USA launch context does **not** imply a specific federal/state ID-verification mandate for all users.

## Tag legend

| Tag | Meaning |
|---|---|
| **APPROVED** | Owner sign-off recorded (e.g. KYC-01, ADR-004) |
| **CONFIRMED** | Owner-approved per ADR-004 or engineering fact in repo |
| **PRIOR-EXPORT-REPORTED** | Described from PDF export traceability; not independently re-verified in this task |
| **DESIGN-INFERRED** | Engineering proposal derived from architecture; not product-approved |
| **PROPOSED** | Candidate rule awaiting owner decision |
| **UNRESOLVED** | No approved answer; blocks or conditions implementation |

---

## Confirmed baseline (do not re-litigate without new ADR)

| Topic | Statement | Tag |
|---|---|---|
| Launch market | Initial launch **United States (USA)**; **adults 18+** only | **CONFIRMED** (D-01) |
| Signup | Email, password, DOB, versioned legal acceptances; **email verification** before **full** account access | **CONFIRMED** (D-02) |
| Auth Phase 1 | **Email/password only**; defer Apple, Google, phone OTP | **CONFIRMED** (D-02-AUTH) |
| Trust dimensions | **Separate** `emailVerified`, `ageEligibilityStatus`, `identityVerificationStatus`; **no live KYC provider** in Phase 1 | **CONFIRMED** (D-09) |
| Self-reported DOB | Eligibility gate only; **not** government identity proof | **CONFIRMED** (D-02 + D-09) |
| Client trust | Flutter is **untrusted**; no client-set “verified” flags | **CONFIRMED** (security baseline) |
| UI evidence | Screens show ID upload, selfie, “Start Verification” | **PRIOR-EXPORT-REPORTED** (#34, #48, #49) |
| Onboarding safety copy | “Safe & Verified Community” onboarding (#28) | **PRIOR-EXPORT-REPORTED** — **does not** define KYC gate timing |

**CONFIRMED engineering today:** `User.identityVerificationStatus` defaults `NOT_STARTED` with enum `NOT_STARTED | PENDING | APPROVED | REJECTED`; no `IdentityVerificationSession` table; `canStartVerification` requires verified email + `ageEligibilityStatus = ELIGIBLE` (**DESIGN-INFERRED** from `account-policy.ts`).

---

## Owner decision register

### KYC-01 — When is government ID verification required?

#### Owner-approved answer (2026-10-26, Task 002B.3A1)

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Label** | Owner **Option A** (per `KYC_OWNER_DECISIONS_002B3A1.md`) |
| **Approver** | Product owner |
| **Date** | 2026-10-26 |
| **Approved rule** | **Government ID verification is required before real-world Meetup/Activity participation and hosting.** Registration, sign-in, email verification, age eligibility, browsing (per otherwise-approved access rules), and own account/profile management do **not** require KYC **solely under this decision**. |
| **Not in scope of this approval** | Private messaging, ordinary group membership, discovery/social connection rules, marketplace, or remote-only activities — each needs separate product decisions (D-03–D-08, D-11). |
| **Enforcement today** | **None** — no activity/meetup APIs; `identityVerificationStatus` is not consulted for any LIVE route. |

**Historical brainstorm (Task 002B.3A — superseded for gating choice):** Early option labels (signup vs all social vs hosting-only) were exploratory; the **authoritative** gate is the approved wording above, not signup-at-registration.

#### Allowed without KYC under KYC-01 alone

Register, authenticate, complete email verification, pass declared-age eligibility, browse people/activities/meetups **when other open decisions permit**, and manage own account/profile.

#### KYC-gated category (approved)

Actions that establish or carry out **real-world meetup/activity participation or hosting**.

#### Action-level enforcement — **APPROVED** (2026-10-26, Task 002B.3A2)

See `KYC_OWNER_DECISIONS_002B3A2.md` §B. Summary:

| Policy ID | **APPROVED** rule |
|---|---|
| **KYC-ENF-01** | **Current valid KYC** before **confirming** in-person/hybrid activity join and before **confirming** real-world meetup RSVP acceptance; **recheck at check-in**. Host requires valid KYC before **publish/activate** real-world activity/meetup. |
| **KYC-ENF-02** | Waitlist: unverified **may join waitlist**; **may not be promoted** to confirmed participant without KYC. **Sender** of real-world meetup invitation must be KYC-approved before send; **recipient** must pass own gate before RSVP accept is confirmed. |
| **KYC-ENF-03** | **100% virtual-only** activities **exempt** from KYC-01 gate. **Hybrid and in-person** remain gated. Does not override other entitlements. |
| **KYC-ENF-04** | On expiry/revocation: **deny new** real-world join/host; **temporarily restrict** upcoming confirmed participation/hosting; **do not silently delete/cancel** bookings/events — notification + organizer/admin resolution (remediation timing/exceptions **OPEN**). |
| **KYC-ENF-05** | Confirms **KYC-03** and **KYC-05** as approved (see below). |

**Approved failure behavior:** When a gated action applies and government-ID status is not current valid `APPROVED` (including pending, in-review, rejected, expired, revoked), **deny** with stable domain error and actionable verification guidance; **never** fabricate `APPROVED`.

#### Residual design questions (still **OPEN** — not extra requirements)

| Topic | Status |
|---|---|
| Exact HTTP route names and check-in contract | **OPEN** (modules not built) |
| Waitlist ordering, timers, auto-promotion rules | **OPEN** |
| Activity modality classification ownership / reclassification | **OPEN** |
| Draft save vs publish permissions | **OPEN** (publish/activate gated) |
| Post-revocation remediation deadlines, appeals, running events | **OPEN** (KYC-04) |
| Group-hosted vs user-hosted nuance | **OPEN** unless covered by same real-world rules |
| Free vs paid activity | **OPEN** (not differentiated in approval) |

**Launch note:** If join/host is product-required before a real verification path exists, real-world join/host cannot ship as enabled; test stubs must not masquerade as production KYC (**CONFIRMED** D-09 direction).

---

### KYC-02 — Provider model

**Due diligence:** `docs/product/KYC_VENDOR_EVALUATION.md` (Task 002B.3A3, 2026-10-26). **No vendor selected.**

| Topic | Statement | Tag |
|---|---|---|
| Selection | **No vendor selected** | **UNRESOLVED** (D-09-provider) |
| Preferred pattern | Managed **government ID + liveness** SaaS with mobile SDK and server webhooks | **PROPOSED** |
| Alternatives | Manual review queue; age-assurance-only vendor; in-house document storage | **PROPOSED** — high risk / not recommended without legal review |
| USA support | Provider must support **US-issued ID** types shown in UI (**PRIOR-EXPORT-REPORTED** #48) | **PROPOSED** requirement for shortlist |
| Data residency | US processing / storage expectations for USA users | **UNRESOLVED** — legal + vendor DPA |
| Cost / SDK | Flutter-compatible SDK; server-side session creation | **PROPOSED** evaluation criteria |
| Webhooks | Reliable signed callbacks; documented retry semantics | **PROPOSED** engineering requirement |

**Do not** select or integrate a vendor in Task 002B.3A.

---

### KYC-03 — What does “verified” mean?

**Status: APPROVED (2026-10-26)** — authority model only; **does not** approve provider selection, webhook implementation, final enums, or manual review.

| Topic | Statement | Tag |
|---|---|---|
| Trusted approval path | Only a **trusted verification provider's server-validated outcome** may set government-identity `APPROVED` | **APPROVED** |
| Manual approval | **No initial manual-approval path** | **APPROVED** |
| Client / DOB | Flutter claims and self-reported DOB **cannot** set `APPROVED` | **APPROVED** |
| User summary field | `identityVerificationStatus` on `User` (today: `APPROVED` not `VERIFIED`) | **CONFIRMED** (schema) |
| Authority to transition | Provider-authenticated server processing (webhook design **OPEN** until KYC-02) — never client payloads | **APPROVED** principle; implementation **OPEN** |
| Provenance | `APPROVED` should be backed by auditable provider decision metadata when built | **APPROVED** principle; field list **OPEN** |
| Policy layers | `emailVerified`, `ageEligibility`, `identityVerification`, future `canParticipateOrHost` — separate; not `fullAccess` | **APPROVED** |
| Session vs user state | Session lifecycle separate from user summary; **canonical mapping not approved** | **OPEN** |
| Relation to age / email | Independent dimensions | **CONFIRMED** (D-09) |
| Public badge | Other users see KYC on profile? | **UNRESOLVED** (KYC-07 / D-03) |
| Re-check at action | Server evaluates at each **sensitive transition** (join, RSVP, check-in, publish, promotion, invite send) | **APPROVED** (KYC-ENF-01..04) |

**Impact:** Implementation may design toward provider-only `APPROVED`, but **no fake verified path** until KYC-02 and real provider contract exist.

---

### KYC-04 — Failure, retry, review, expiry, revocation

**Options doc:** `docs/product/KYC_LIFECYCLE_DECISION_OPTIONS.md` (Task 002B.3A3). **KYC-04 as a whole is not approved.** **KYC-ENF-04** approves **high-level** impact on new joins/hosting and existing upcoming participation when status expires/revokes — not retry/appeal cadence or full remediation playbooks.

| Topic | Statement | Tag |
|---|---|---|
| Revocation/expiry impact on bookings | Deny new real-world actions; temporary restriction on upcoming confirmed participation/hosting; no silent cancel | **APPROVED** (KYC-ENF-04) |
| Notification / organizer resolution | Required workflow; exact steps/timing | **OPEN** |
| Document quality failure | User may retry with new session | **PROPOSED** |
| Fraud / policy rejection | `REJECTED` with internal `reasonCode`; user-facing message generic | **PROPOSED** |
| Appeals | Human review queue after auto-reject | **UNRESOLVED** |
| Session expiry | Incomplete SDK flows expire; user starts new session | **PROPOSED** |
| Verification expiry | Approved status expires after N months | **UNRESOLVED** |
| Revocation mechanics | Ops or provider revokes prior approval | **UNRESOLVED** (impact bounded by KYC-ENF-04) |
| Duplicate concurrent sessions | At most one **active** session per user | **PROPOSED** |
| Suspended/deleted user | No new sessions; webhooks for deleted user ignored or audited | **PROPOSED** |
| Support intervention | Support can reset stuck `PENDING` — audit required | **UNRESOLVED** |

Candidate session states (pending owner vocabulary): `NOT_STARTED`, `PENDING_USER`, `PENDING_PROVIDER`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`, `REVOKED` — **PROPOSED** (align with `VERIFICATION_INTEGRATION_DESIGN.md`).

---

### KYC-05 — Privacy and data handling

**Status: APPROVED (2026-10-26)** — data **minimization model** only; **not** retention durations, DPA, or compliance claims.

| Topic | Statement | Tag |
|---|---|---|
| ID / selfie / biometric evidence | **Provider-hosted**; StrangeUp must **not** store raw ID/selfie/biometric evidence in app DB/object storage/logs **by default** | **APPROVED** |
| Backend metadata (model) | Opaque session/provider references, status, timestamps, minimal audit — **candidate field list** in `KYC_OWNER_DECISIONS_002B3A2.md` §E | **APPROVED** model; **exact allowlist OPEN** for schema |
| Avoid by default | Raw ID, selfie, templates, liveness payloads, provider secrets, full webhook bodies in persistent stores/logs | **APPROVED** |
| Retention / deletion periods | | **UNRESOLVED** (D-09-retention, KYC-06) |
| Cross-border / DPA | | **UNRESOLVED** (KYC-06) |
| Access control | Staff access to provider-held artifacts | **UNRESOLVED** |

See `docs/security/KYC_DATA_HANDLING_AND_THREATS.md` and `docs/operations/DATA_CLASSIFICATION_AND_RETENTION.md`.

---

### KYC-06 — USA rollout (legal/product)

| Topic | Statement | Tag |
|---|---|---|
| Universal ID law | **No** engineering assumption that all US states require app-wide government ID | **CONFIRMED** (task constraint) |
| State privacy laws | CCPA/CPRA and other state rules may affect retention and notices | **UNRESOLVED** — counsel |
| Geofencing | Automatic block outside USA | **UNRESOLVED** |
| Minors | Product is 18+; underage registration rejected at signup | **CONFIRMED** (D-01) |

---

### KYC-07 — Flutter UX by state

**KYC-07 as a whole is not approved.** Owner approved **behavioral inputs**: no fake verification, block/guide on protected actions, waitlist allowed pending KYC, virtual-only paths free of KYC-01 gate. **Copy, badges, and error strings** remain **PROPOSED**. Server fields remain source of truth when APIs exist.

| Server/session state | Suggested UX (not approved) | Tag |
|---|---|---|
| `NOT_STARTED` | CTA “Start verification” if policy allows (`canStartVerification`) | **PROPOSED** |
| `PENDING` / in-progress session | SDK or embedded flow; poll session status | **PROPOSED** |
| `IN_REVIEW` | “Under review” — no success badge | **PROPOSED** |
| `APPROVED` | Trust badge only if product approves public display | **PROPOSED** |
| `REJECTED` | Generic failure + retry CTA if policy allows | **PROPOSED** |
| `EXPIRED` / `REVOKED` | Re-verify CTA; downgrade badges | **PROPOSED** |
| Provider unavailable | Maintenance message; no fake success | **PROPOSED** |
| Ineligible account | Underage, unverified email, suspended — hide or disable start | **CONFIRMED** policy direction |

**PRIOR-EXPORT-REPORTED:** Screen #34 “Start Verification”; #48 ID type/upload; #49 selfie — exact error copy not specified in traceability.

---

## Reconciliation with `OPEN_QUESTIONS.md`

| Open question ID | This document |
|---|---|
| D-09-provider | KYC-02 |
| D-09-retention | KYC-05 |
| D-09-features | KYC-01 **APPROVED** |
| D-09-kyc-enforcement | Policy portion **RESOLVED** (KYC-ENF-01..05); residual ops/UX **OPEN** |
| D-03–D-08 | Cross-module gates depend on KYC-01 outcomes |

---

## Owner sign-off checklist

| ID | Decision | Approver | Date | Approved answer |
|---|---|---|---|---|
| KYC-01 | Minimum KYC gates for MVP | Product owner | 2026-10-26 | Gov ID required before **real-world** meetup/activity **participation and hosting**; not required for signup/browse/account solely under this rule |
| KYC-01-detail | Action-level enforcement (KYC-ENF-01..04) | Product owner | 2026-10-26 | Join/RSVP/check-in/host publish; waitlist/invites; virtual exempt; expiry/revocation impact |
| KYC-02 | Provider shortlist / selection criteria | | | |
| KYC-03 | Trusted provider-only `APPROVED`; no initial manual | Product owner | 2026-10-26 | See §KYC-03 |
| KYC-04 | Retry, appeals, provider outage, remediation detail | | | **OPEN** (ENF-04 bounds impact only) |
| KYC-05 | Provider-hosted evidence; minimal metadata | Product owner | 2026-10-26 | See §KYC-05; retention **OPEN** |
| KYC-06 | USA legal/privacy sign-off scope | | | |
| KYC-07 | User-visible states and copy | | | |

**Gate for Task 002B.3B (updated 002B.3A2):** Policy decisions **KYC-01/03/05** and **KYC-ENF-01..05** are documented; **002B.3A2 does not authorize implementation.** Before coding: **KYC-02** vendor path (or explicit no-fake-APPROVED stub scope), session vs user enum mapping, KYC-04 operational detail, KYC-05 field-level schema + retention after legal review, webhook/auth design, and acceptance test plan. **No migrations or LIVE routes** from documentation tasks alone.

---

## Related documents

- `docs/architecture/VERIFICATION_INTEGRATION_DESIGN.md` — technical integration proposal
- `docs/api/KYC_API_CANDIDATES.md` — **NOT IMPLEMENTED** API sketches
- `docs/testing/KYC_ACCEPTANCE_MATRIX.md` — acceptance tests (not executed in 002B.3A)
- `docs/product/KYC_OWNER_DECISIONS_002B3A2.md`
- `docs/decisions/ADR-004-identity-phase1-owner-decisions.md`
