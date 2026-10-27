# StrangeUp — KYC Owner Decision Handoff (002B.3A1)

**Document status:** Decision handoff; **one owner-approved decision**, two engineering recommendations requiring separate owner confirmation.  
**Product:** StrangeUp | **Launch market:** USA | **Development:** Bangladesh | **Eligibility:** adults 18+  
**Evidence:** Product-owner chat decision on KYC-01 (26 October 2026); preceding Cursor 002B.3A completion report; Figma evidence in the repository is marked `PRIOR-EXPORT-REPORTED` unless primary exports were independently re-reviewed.  
**Scope:** documentation only; no implementation, no live vendor, no new LIVE APIs.

## 1. Decision status (do not silently upgrade proposals)

| ID | Status | Direction |
|---|---|---|
| **KYC-01** | **OWNER-APPROVED** | **Option A:** Government ID verification is required **before real-world Meetup/Activity participation and hosting**. Signup, basic account access, and browsing do not require KYC solely by this rule. |
| **KYC-03** | **PROPOSED — AWAITING APPROVAL** | Only a trusted server-side verification outcome from a selected provider may establish verified identity. Do not enable manual approval initially; if an authorized manual review path is later approved, it needs authenticated reviewer permissions, evidence, audit logging and a dedicated decision. Never allow Flutter/client-provided success to approve identity. |
| **KYC-05** | **PROPOSED — AWAITING APPROVAL** | Provider-host ID/selfie/biometric materials. StrangeUp stores only minimal session/status/provider references and necessary redacted audit metadata. Never retain document images, biometric templates or raw provider webhook bodies by default. Retention periods, deletion workflow and data transfers require legal/privacy and provider review. |

**KYC-01 is authoritative now. KYC-03 and KYC-05 are recommendations, NOT owner-approved requirements.** This handoff does not authorize implementing any of the three in code.

## 2. KYC-01: practical policy interpretation to document and resolve

- **Allowed without KYC under this decision:** register, sign in, complete email verification and age eligibility, browse people/Activities/Meetups according to otherwise approved access rules, and manage one's own account/profile. This KYC decision does not itself authorize messaging, connections, or other separate unresolved features.
- **KYC-gated category:** actions that actually establish or carry out **real-world meetup/activity participation or hosting**.
- **Proposed concrete enforcement points — NEED owner/product interpretation before implementation:** activity join/registration, accepting a personal meetup invite/RSVP, hosting or publishing an activity/meetup, and attendance/check-in. Decide whether waitlist join, invitation *sending*, free/paid activities, group-hosted events, rescheduling and existing bookings fall under the gate.
- **Do not extend KYC automatically** to private messaging, ordinary group membership, browsing, remote-only activities, marketplace purchases or social connections: those need their own product decisions.
- **Failure behavior recommendation:** when the KYC requirement applies but approval is absent (including PENDING, IN_REVIEW, REJECTED, EXPIRED or REVOKED), deny that action with a stable domain error and an actionable verification state; never manufacture an APPROVED state.
- **Launch dependency:** if KYC is mandatory for joining/hosting but no real verification path exists, real-world joining/hosting cannot be safely released as enabled. A test-only stub or bypass must never masquerade as production KYC.
- **Downstream status changes:** decide what happens to existing confirmed participation and upcoming hosted events after an identity verification is revoked or expires. Do not automatically cancel bookings without approved policy.

## 3. KYC-03 — proposed assurance model (pending owner approval)

Recommended layers:
1. `emailVerified` — verified email ownership, independent of identity.
2. `ageEligibility` — currently self-declared DOB passes the 18+ rule; **not** government age verification.
3. `identityVerification` — government ID verification through a trusted assurance process; independent of `fullAccess`.
4. `canParticipateOrHost` — **computed backend policy**, requiring applicable gates and account status, not a client-writable boolean.

Suggested session states (not a final schema): `NOT_STARTED`, `CREATED`, `PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`, `REVOKED`. The user's summary status may map differently: define one canonical mapping and avoid mixing session state with user identity state. Exact nomenclature and transitions require approval.

- Provider event authentication, replay protection, idempotency and out-of-order event handling are prerequisites for approval transitions.
- `APPROVED` must be backed by a trustworthy, stored provenance record.
- No Flutter-driven `APPROVED`, no admin toggle without a separately approved review workflow, and no pretend verification when no provider is connected.
- Propose server-side re-evaluation of permission at the **actual sensitive action**, rather than trusting a Flutter badge or stale response.

## 4. KYC-05 — proposed data handling (pending owner approval)

**Candidate minimally necessary backend metadata** (subject to provider and legal review): internal user/session IDs, provider name/type, opaque provider session reference, state, non-sensitive standardized reason code, verification timestamps, last update, anonymized webhook event idempotency key, relevant audited transition actor/source. Use field allowlists and least privilege.

**Avoid collecting or persisting by default:** raw government ID scans or numbers, selfie images, face templates/embeddings, raw liveness video, provider secrets, unrestricted webhook payloads, live verification URLs containing secrets, identity documents in logs, and extraneous personal details returned by a provider.

**Still OPEN:** exact storage/retention/deletion periods, data processing agreement, applicable federal/state requirements, cross-border access from Bangladesh, vendor subprocessor chain, incident and appeal procedures, controller/processor responsibilities, export/deletion and audit retention exceptions. Do not assert compliance or invent a fixed retention number.

## 5. Flutter handoff rule (no implemented KYC endpoints)

Until provider integration and API contracts are implemented and tested:
- Document verification screens as **DESIGN/PLANNED — NOT CONNECTED**.
- No simulated success badge or auto-transition to verified after document upload / selfie screens.
- Distinguish `KYC_REQUIRED`, `PENDING`, `IN_REVIEW`, `REJECTED`, `EXPIRED`, `REVOKED`, and provider unavailable in **proposed** UI behavior, without claiming actual LIVE error codes.
- Do not tell Flutter to call a proposed `/v1/me/verification/sessions` endpoint as LIVE.
- Maintain `docs/api/CURRENT_APIS.md` as the source of truth for actual LIVE/DEV_ONLY APIs; updates to Flutter handoff must clearly mark future KYC work as `PLANNED / NOT IMPLEMENTED`.

## 6. Open questions (keep OPEN unless owner separately decides)

| Decision | Question |
|---|---|
| **KYC-01 detail** | Is verification required before joining/accepting an RSVP, only before attendance, or at both points? How about waitlist, invitation creation, online activities, existing bookings after revocation? |
| **KYC-02** | Which provider / evaluation criteria / sandbox contract? None selected. |
| **KYC-03** | Approve provider-based verified state as the only initial approval path? Is human review disallowed in first release? Confirm canonical enum + expiry. |
| **KYC-04** | Retry, rejection, appeal, expiration, cancellation, revocation, provider outages. |
| **KYC-05** | Approve provider-held biometric/documents plus minimal metadata? Define retention/deletion and security controls after legal review. |
| **KYC-06** | Counsel/privacy review for USA release, state laws, biometrics and Bangladesh engineering access. |
| **KYC-07** | Approved Flutter UX copy and blocked-action prompts per state. |

## 7. Approval table for Cursor to maintain

| Decision | Status | Evidence of approval | Approved wording / date |
|---|---|---|---|
| KYC-01 | **APPROVED** | User explicitly selected Option A in ChatGPT (2026-10-26) | Government ID verification required before real-world meetup/activity participation and hosting. |
| KYC-03 | **OPEN** | None yet | **Recommendation only**; requires owner confirmation. |
| KYC-05 | **OPEN** | None yet | **Recommendation only**; requires owner confirmation. |

**Gate to Task 002B.3B:** Owner must explicitly confirm KYC-03, KYC-05, the concrete action-gating semantics of KYC-01, and an implementation scope that does not fake a verified result. Other dependencies may still block provider/live feature activation. No migration or route is authorized by this document.
