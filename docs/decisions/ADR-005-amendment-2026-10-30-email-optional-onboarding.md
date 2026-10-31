# ADR-005 Amendment: Email verification optional for onboarding (2026-10-30)

## Status

**Accepted** — amends ADR-005 (2026-10-28) per owner Task **031B.2**.

## Context

Owner approved removal of **mandatory** email verification from customer onboarding and Home access. Email remains a registration/contact field. Activation flow:

`Register → Trusted government ID + selfie/liveness (provider) → Provider approval → StrangeUp admin approval → Main App access`.

Historical ADR-005 listed verified email as a Home prerequisite alongside trusted KYC and admin approval.

## Decision

1. **`hasHomeAccess` / `hasFullAccountAccess`** no longer requires `emailVerifiedAt`. Requirements unchanged otherwise: `ACTIVE` + age eligible + not suspended/deleted + trusted provider KYC on current session + admin `APPROVED` on the **same** `identityVerificationSessionId`.
2. **Registration** creates an age-eligible **`ACTIVE`** account without sending a mandatory verification email; `emailVerifiedAt` stays **null** until optional `POST /v1/auth/email-verification/*` succeeds.
3. **`emailVerifiedAt` / `emailVerificationStatus`** remain truthful metadata for clients and admin review; unverified email must **not** be treated as ownership proof.
4. **Sensitive email ownership flows** (email change) retain verification-based restrictions where already implemented.
5. **Admin activation approve** no longer requires verified email; age, consents, trusted KYC, and session binding remain mandatory.

## Consequences

- Flutter must route post-register using `GET /v1/me/onboarding/status` (`START_IDENTITY_VERIFICATION`, not `VERIFY_EMAIL`).
- D-02 product register decision is superseded for the email-gate portion only (see `OPEN_QUESTIONS.md`).
- Staging admin demos no longer require an email-confirm step before IDV.

## References

- Task 031B.1 audit; Task 031B.2 implementation
- `docs/decisions/ADR-005-auth-flow-admin-activation-2026-10-28.md` (historical baseline)
