# ADR-004 — Identity Phase 1 Owner Decisions (USA Launch)

**Status:** ACCEPTED (owner sign-off 2026-10-26).
**Context:** Task 002A design gate; Task 002A1 records approvals for implementation planning. Development team based in Bangladesh; **initial launch market: USA**. This ADR is not legal advice.

## Decisions

| ID | Approved answer |
|---|---|
| **D-01** | Adults-only (**18+**). Initial launch jurisdiction: **United States (USA)**. |
| **D-02** | Registration requires **email**, **password**, **date of birth**, and **recorded legal acceptance** (terms/privacy/age as product defines). **Email verification required** before full account access. Account remains in a restricted state until email is verified and age eligibility passes server rules. |
| **D-02-AUTH** | **Email/password only** in Phase 1. **Defer** Google Sign-In, Apple Sign-In, and phone OTP. |
| **D-09** | **Separate** dimensions: email verification, age eligibility, and government ID/KYC. **No live KYC provider** integration in Phase 1; stub/state-machine contract only until vendor and retention are approved. |

## Explicitly still open (not resolved by this ADR)

- Mandatory **phone** collection and verification at signup.
- **KYC vendor** selection, contracts, and regional compliance detail.
- **Retention/deletion** schedules for credentials, challenges, and verification audit data.
- **Feature-specific KYC gates** (e.g. which actions require KYC vs email+age only).
- Consent document **version IDs** and counsel-approved copy (engineering records version strings once supplied).

## Consequences

- Task **002B.1** may implement schema and email/password auth aligned with `docs/api/IDENTITY_API_DRAFT.md` subset.
- Flutter must treat trust badges as separate API fields; see `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`.
- `docs/api/CURRENT_APIS.md` remains health-only until 002B.1 ships routes.

## Evidence

- Figma exports 31, 33, 34–35, 37, 48–49 (`SCREEN_TRACEABILITY.md`) — design observed; policy per this ADR.
