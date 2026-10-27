# StrangeUp — KYC Owner Decisions (Task 002B.3A2)

**Status:** OWNER-APPROVED POLICY HANDOFF — **NOT IMPLEMENTED**  
**Owner approval source:** Explicit StrangeUp product-owner confirmation in ChatGPT, **2026-10-26**.  
**Target launch market:** United States; engineering performed from Bangladesh.  
**Scope:** Decision documentation for future implementation only. This document does not authorize provider setup, KYC APIs, migrations, admin overrides, feature enablement, or production changes.

## A. Approved decisions — authoritative owner wording and interpretation

| ID | Status | Approved direction |
|---|---|---|
| **KYC-01** | **APPROVED (prior decision, 2026-10-26)** | Government ID verification is required **before real-world Meetup/Activity participation and hosting**. Signup, login, browsing and own-account/profile actions do not require KYC *solely under KYC-01*. Other independently approved restrictions still apply. |
| **KYC-03** | **APPROVED (2026-10-26)** | Only a **trusted verification provider's server-validated outcome** may establish government-identity `APPROVED`. No initial manual-approval path. A Flutter/client claim or self-reported DOB cannot set `APPROVED`. Email ownership, DOB-based age eligibility and KYC assurance remain independent trust dimensions. |
| **KYC-05** | **APPROVED (2026-10-26)** | The provider hosts **government ID images, selfies and biometric evidence**. StrangeUp stores only the necessary **non-document metadata**, opaque provider/session references, status, timestamps and minimal audit records; it must not store raw ID/selfie/biometric evidence in its application DB/object storage/logs by default. Precise retention/deletion terms and cross-border processing conditions remain open for provider + legal/privacy review. |

**Decision boundary:** KYC-03 approves the *initial authority model*, not a provider selection, webhook implementation, exact state enum, or a manual review mechanism. KYC-05 approves a *data minimization model*, not a retention duration or a legal-compliance claim.

## B. Approved KYC-01 enforcement details (5 product decisions)

| Policy ID | Action or situation | Approved enforcement meaning | Boundary / remaining design question |
|---|---|---|---|
| **KYC-ENF-01** | **Activity join** and **real-world personal Meetup RSVP acceptance** | Require **current valid KYC approval before confirming participation**; **recheck at check-in**. For real-world Activity/Meetup hosting, require valid KYC **before publish/activate**. | Exact API operation names and attendance/check-in contracts are not yet implemented or approved. |
| **KYC-ENF-02** | **Waitlist** | An unverified user **may enter a waitlist**, but may **not be promoted into confirmed participation** until KYC is approved. | Waitlist ordering, reserved-seat timers and automatic promotion remain open. |
| **KYC-ENF-02** | **Send a real-world Meetup invitation** | Invitation **sender** must have valid approved KYC before sending. Invitation **recipient** must pass their own applicable KYC gate before RSVP acceptance. | Exact invitation lifecycle and whether other invite types have gates remain open. |
| **KYC-ENF-03** | **Virtual-only vs in-person/hybrid** | **100% virtual-only activities are exempt from this KYC-01 gate**. **Hybrid and in-person** activities require KYC for applicable participation/hosting actions. | Classification ownership, venue changes and reclassification policy are not yet specified. This exemption does not override other access requirements. |
| **KYC-ENF-04** | **Verification expires / is revoked** | **Deny new real-world join/hosting actions** and **temporarily restrict upcoming confirmed participation and hosting**. Do **not silently delete or cancel bookings/events**; trigger notification and organizer/admin resolution workflow. | Existing booked-seat handling, deadlines, user appeals, currently running events and reassignment workflows are still open. |
| **KYC-ENF-05** | **Verification authority and data posture** | Owner **also confirms KYC-03 and KYC-05** as written above. | No live integration, retention policy or provider is thereby approved. |

For clarity: the five approvals above correspond to the previously recommended answers on (1) join/RSVP/check-in/host publish, (2) waitlist and invite sending, (3) virtual exemption, (4) expiry/revocation, and (5) KYC-03/KYC-05 confirmation. All were expressly approved by the owner on 2026-10-26.

## C. Planned authorization policy matrix — NOT CURRENT API BEHAVIOR

The matrix below captures **future policy requirements**, not existing live enforcement.

| Operation | KYC needed under these decisions? | When to check | Important note |
|---|---|---|---|
| Register, login, verify email, own profile read | **No, solely under KYC-01** | Existing auth/eligibility rules still apply | Do not infer unrestricted access. |
| Browse public people/activities/groups/meetups | **No, solely under KYC-01** | Existing visibility and privacy rules still apply | Discovery permissions remain distinct. |
| Join/confirm **in-person** activity | **Yes** | Before confirmed registration | No unverified confirmed participation. |
| Join/confirm **hybrid** activity | **Yes** | Before confirmed registration | Hybrid is KYC-gated. |
| Join a waitlist | **No** | At waitlist entry | Recheck on promotion; promotion may not confirm participation without valid KYC. |
| Accept an in-person Meetup RSVP/invitation | **Yes** | Before acceptance is confirmed | Recipient's verification, not sender's, authorizes RSVP acceptance. |
| Send an in-person Meetup invitation | **Yes** | Before invitation dispatch | Sender's verification required. |
| Publish/activate an in-person or hybrid activity/meetup as host | **Yes** | Before publish/activation | Draft-authoring permissions remain separately defined. |
| Attend/check in to in-person or hybrid activity/meetup | **Yes** | At actual check-in | Reevaluate live status; prior acceptance alone insufficient. |
| Join/host **100% virtual-only** activity | **No, solely under KYC-01** | Other access rules still apply | Must genuinely be virtual-only. |
| Existing upcoming booking or hosting after KYC expiry/revocation | **Temporary restriction** | On status change and next sensitive action | Keep records intact; notification and resolution; detailed remediation open. |
| Send ordinary DM, follow, join group, marketplace purchase | **Not automatically required by these KYC decisions** | Governed by separate product rules | Do not expand gate silently. |

**Conceptual auth preconditions for gated operations:** authenticated user, permitted account status, adult eligibility as applicable, verified email where required by existing policy, and current trusted KYC approval. This matrix does not rewrite previous `fullAccess` or change policy code.

## D. Trust, session state and enforcement principles

1. Do not collapse email verification, self-declared DOB-based age eligibility, and government-ID KYC into a single `isVerified` or `fullAccess` field.
2. Provider-authenticated, validated server-side results are the only initial `APPROVED` source. Manual approve toggles and client-driven verification are disallowed by approved KYC-03.
3. Provider credentials, signature validation, replay/idempotency handling, concurrent event ordering and canonical status transitions require separate design/implementation approval. No vendor is selected.
4. `PENDING`, `IN_REVIEW`, `REJECTED`, `EXPIRED`, `REVOKED`, `CANCELLED` (and any others) are **candidate** states to reconcile against actual schema; **do not assert the final enum is approved**. An unavailable provider or a mere started session never means `APPROVED`.
5. Decisions apply **server-side at each sensitive transition**; frontend gating is usability only, never a permission boundary.
6. New real-world actions must remain blocked until a trustworthy verification path exists. Do not insert a mock successful path or developer bypass into production behavior.

## E. KYC-05 metadata allowlist proposal and unresolved retention

Approved model: provider holds sensitive identity evidence; StrangeUp keeps **minimal purpose-specific metadata**. Candidate metadata fields for subsequent schema review: internal user ID, opaque verification session ID, opaque provider session/reference, normalized state, minimally required reason code, created/updated/completed/expiry timestamps, safe event-idempotency reference, and audited transition origin. This list is **proposed**, not a finalized Prisma schema or blanket approval to store all fields.

Do **not** persist by default: raw ID image or number, selfie, face template/embedding, liveness recording, biometric result payload, provider access secrets/tokens, unfiltered webhook request bodies, or sensitive hosted URLs in logs, error traces or analytics.

**Still OPEN:** retention duration, deletion and data-subject-request workflows, legitimate audit retention, processor/subprocessor arrangements, US state/privacy/biometric legal analysis, USA-to-Bangladesh engineering access, privacy notices and consent language. Provider selection must consider data locality and deletion APIs. Do not invent durations or claim legal compliance.

## F. Open items — NOT approved by this handoff

| ID | Status | Need |
|---|---|---|
| **KYC-02** | OPEN | Provider shortlist, cost/capabilities, sandbox, hosted-PII features, webhooks, DPA. |
| **KYC-04** | OPEN (partly bounded by approved enforcement) | Re-try policy, appeals, provider outage, re-verify cadence, exactly how existing bookings are managed after expiry/revocation, disputes. |
| **KYC-06** | OPEN | US/privacy/biometric legal review and Bangladesh engineering/cross-border access. |
| **KYC-07** | OPEN (approved behavior is input) | UX wording, badges, prompts, error/empty states, states displayed in Flutter. |
| **D-09-retention** | OPEN | Provider-specific and legally reviewed retention/deletion schedule. |
| **D-09-provider** | OPEN | Vendor selection / integration credentials / launch dependency. |
| **D-09-kyc-enforcement** | **CLOSE approved policy portion only** | Concrete operations and broad gates are approved in Section B. Detailed state repair, timers, virtual classification changes and exceptions remain tracked as separate implementation/UX questions. |

Do not automatically mark all of KYC-04/07 or global D-09 as fully resolved.

## G. Flutter / API documentation integrity

- `docs/api/CURRENT_APIS.md` is the authoritative list of actual LIVE/DEV_ONLY endpoints. At this handoff **no KYC endpoints are LIVE**.
- Proposed KYC routes in `docs/api/KYC_API_CANDIDATES.md` remain **PLANNED / NOT IMPLEMENTED**; no fabricated request/response bodies or active Swagger operations.
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` must distinguish **APPROVED POLICY** from **NOT IMPLEMENTED** verification screens and calls. No mock identity badge. UI may be designed around required verification prompts, but must not assert functional provider verification.
- This handoff does not authorize changing `src/`, Prisma schema/migrations, dependencies, `.env`, Figma, actual integrations, or production/staging infrastructure.

## H. Owner sign-off record

| Decision | Signed by | Date | Status | Evidence |
|---|---|---|---|---|
| KYC-01 Option A | StrangeUp product owner | 2026-10-26 | APPROVED | Explicit prior chat selection |
| KYC-03 | StrangeUp product owner | 2026-10-26 | APPROVED | Explicit current-chat approval of KYC-03 recommendation |
| KYC-05 | StrangeUp product owner | 2026-10-26 | APPROVED | Explicit current-chat approval of KYC-05 recommendation |
| Five enforcement policies | StrangeUp product owner | 2026-10-26 | APPROVED | Explicit current-chat approval of all five previously listed recommendations |

**Decision approval ≠ code implementation authorization.** This document is a record of owner-approved intended behavior only.

## Related synchronized documentation (Task 002B.3A2)

- `docs/product/KYC_REQUIREMENTS_DECISION_GATE.md` — decision register
- `docs/architecture/VERIFICATION_INTEGRATION_DESIGN.md` — integration and policy matrix
- `docs/security/KYC_DATA_HANDLING_AND_THREATS.md` — KYC-05 threat/data posture
- `docs/security/PERMISSIONS_MATRIX.md` — preliminary capability notes
- `docs/testing/KYC_ACCEPTANCE_MATRIX.md` — planned acceptance cases (not executed)
- `docs/api/KYC_API_CANDIDATES.md` — **NOT IMPLEMENTED** routes and proposed denial codes
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` §12
- `docs/product/OPEN_QUESTIONS.md` — `D-09-kyc-enforcement` resolved (policy); residuals under `D-09-kyc-enforcement-ops`
- Prior handoff: `docs/product/KYC_OWNER_DECISIONS_002B3A1.md` (KYC-01 initial recording)
- Task 002B.3A3 (vendor/lifecycle readiness, **no selection**): `KYC_VENDOR_EVALUATION.md`, `KYC_LIFECYCLE_DECISION_OPTIONS.md`, `KYC_PRIVACY_VENDOR_CHECKLIST.md`
