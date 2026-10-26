# Identity Domain Design Proposal (Task 002A)

**Status:** PROPOSAL — no Prisma models committed. Aligns with modular monolith (`docs/architecture/MODULES.md`, ADR-001, ADR-002).

## Separation of concerns (mandatory)

| Concept | Purpose | Must not collapse into |
|---|---|---|
| Authentication | Who is calling the API (session/credential) | KYC or subscription |
| Account status | `ACTIVE`, `PENDING_VERIFICATION`, `SUSPENDED`, `DELETED` | Verification verdict |
| Contact verification | Email/phone proof | Identity/KYC |
| Age eligibility | Jurisdiction + DOB rule outcome | Email verified |
| Identity/KYC | Provider decision on government ID + liveness | Email verified or “premium” |
| Subscription entitlement | Store/billing ledger | Any verification flag |
| Moderation | Block/suspend/report | Profile visibility defaults |

---

## Candidate aggregates

### 1. `User` (account root)

**Responsibilities:** Stable actor ID; account lifecycle; links to credentials and profile; suspension/deletion timestamps.

**PROPOSED fields (conceptual):**

- `id` UUID PK
- `accountStatus` enum
- `email` optional until OAuth-only path approved — if present: unique index on `lower(email)`
- `phoneE164` optional — unique partial index when non-null
- `emailVerifiedAt`, `phoneVerifiedAt` nullable instants
- `ageEligibilityStatus` enum (`UNKNOWN`, `ELIGIBLE`, `INELIGIBLE`, `NEEDS_REVIEW`) — gated by D-01
- `suspendedAt`, `deletedAt` nullable; soft-delete preferred for audit
- `createdAt`, `updatedAt` UTC

**Invariants:**

- `DELETED` users cannot authenticate; sessions revoked on transition to `SUSPENDED`/`DELETED`.
- No single `isVerified` column.

**Retention:** UNRESOLVED (D-01, legal); engineering default: minimize PII, support eventual erasure job.

---

### 2. `PasswordCredential`

- `userId` FK unique (one password per user in Phase 1)
- `passwordHash` string
- `passwordChangedAt`, optional `mustReauthAfter`
- Rotate hash on password change; invalidate refresh families (PROPOSED)

---

### 3. `ExternalIdentity`

- `id` UUID PK
- `userId` FK
- `provider` enum (`APPLE`, `GOOGLE`, …)
- `providerSubject` string (immutable issuer subject)
- **Unique** `(provider, providerSubject)`
- `emailFromProvider` optional, non-authoritative for linking
- `linkedAt`, `lastSignInAt`

**Linking rules (PROPOSED):**

- New OAuth sign-in creates user + identity OR attaches to authenticated session only after explicit “link account” with proof.
- Matching email between providers **does not** merge users without verified possession of both factors.

---

### 4. `Session` / refresh token family

**Option A (recommended):** `Session` row per device/login + `refreshTokenHash` + `familyId` for rotation detection.

| Field | Notes |
|---|---|
| `id` | UUID |
| `userId` | FK |
| `familyId` | UUID — all rotations share family |
| `refreshTokenHash` | hash of current refresh secret |
| `expiresAt` | absolute expiry |
| `revokedAt` | nullable — set on logout, reuse detection, password change |
| `userAgent`, `ipHash` | optional metadata; classify as sensitive |

**Invariants:**

- Refresh rotation: new token issued, old hash invalidated; reuse of old refresh revokes entire `familyId`.
- `logout-all` sets `revokedAt` on all active sessions for user.
- Access token: short TTL JWT or opaque ID referencing session — decision in 002B; not stored in plaintext in logs.

---

### 5. `AuthChallenge`

Unified expiring challenge for email verification, password reset, optional phone OTP.

- `id` UUID
- `userId` nullable (reset may reference email before user load in service layer — avoid enumerable userId leaks in API)
- `type` enum (`EMAIL_VERIFY`, `PASSWORD_RESET`, `PHONE_OTP`, …)
- `target` normalized email/phone
- `secretHash` — never store raw token
- `expiresAt`, `consumedAt`, `attemptCount`
- **Unique partial:** one active challenge per `(type, target)` or rate-limit in service

**Invariants:** Max attempts; constant-time compare; consume atomically in transaction.

---

### 6. `Profile`

- `userId` PK/FK 1:1
- `displayName`, `bio`, `avatarMediaId` (future), `birthDate` date-only or encrypted — D-02
- `profileVisibility` enum — D-03/D-04 interaction
- `scheduleTimeZone` IANA string
- Public projection excludes email, phone, raw DOB (may expose age band only if approved)

---

### 7. `ConsentRecord`

- `id`, `userId`, `consentType` (`TERMS`, `PRIVACY`, `AGE_ATTESTATION`, …)
- `documentVersion` string
- `recordedAt`, `ipHash` optional
- Append-only; no silent overwrite of historical consent

---

### 8. `IdentityVerificationSession` + `VerificationDecision`

**Session:**

- `id`, `userId`, `status` (`NOT_STARTED`, `PENDING_USER`, `PENDING_PROVIDER`, `REVIEW`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`)
- `provider` enum or `DEFERRED_STUB`
- `providerSessionRef` opaque string
- `startedAt`, `completedAt`
- No `rawDocumentUrl` in DB by default

**Decision (append-only audit):**

- `id`, `sessionId`, `decision` (`APPROVE`, `REJECT`, `MANUAL_REVIEW`)
- `reasonCode` internal enum
- `decidedAt`, `source` (`PROVIDER_WEBHOOK`, `ADMIN`, `STUB`)

**Webhooks:** idempotency key `(provider, eventId)`; tolerate out-of-order; stale session rejection.

---

### 9. `UserBlock`

- `id`, `blockerUserId`, `blockedUserId`
- **Unique** `(blockerUserId, blockedUserId)`; check `blocker != blocked`
- `createdAt`
- Used by future `canInteractWithUser`; 002B stores rows + policy deny for others' resources

---

## State machines (PROPOSED)

### Account status

```text
REGISTERED → PENDING_VERIFICATION (if D-02 option E)
PENDING_VERIFICATION → ACTIVE (email/phone gate cleared + age rule pass)
ACTIVE → SUSPENDED (moderation)
ACTIVE → DELETED (user request)
SUSPENDED → ACTIVE (appeal) | DELETED
Any → DELETED (terminal for login)
```

### Identity verification session

```text
NOT_STARTED → PENDING_USER → PENDING_PROVIDER → REVIEW → APPROVED | REJECTED
Any non-terminal → EXPIRED | CANCELLED
```

Approved KYC **does not** auto-activate subscription or override suspension.

---

## Index and FK summary

| Table | Unique indexes |
|---|---|
| User | `lower(email)` where not null; `phoneE164` where not null |
| ExternalIdentity | `(provider, providerSubject)` |
| PasswordCredential | `userId` |
| Session | lookup by `userId`, `familyId` |
| UserBlock | `(blockerUserId, blockedUserId)` |

**Delete behavior (PROPOSED):** restrict or soft-delete User; cascade revoke sessions; retain `VerificationDecision` audit per retention policy; no CASCADE delete of payment or moderation audit (future modules).

---

## Module placement

| Aggregate | Module |
|---|---|
| User, PasswordCredential, ExternalIdentity, Session, AuthChallenge | `auth` |
| Profile | `users` / `profiles` |
| ConsentRecord | `users` or `trust` |
| IdentityVerificationSession, VerificationDecision | `trust` |
| UserBlock | `moderation` (consulted by auth policy) |

**Policy entry points (002B stubs):** `canAccessAccount`, `canEditProfile`, `canStartVerification`, `canAccessOwnVerificationStatus`, `canInteractWithUser` → default false except own-account paths.

---

## Threat-oriented design notes

| Scenario | Mitigation (PROPOSED) |
|---|---|
| Duplicate concurrent registration | DB unique on email; transaction; idempotent register with idempotency-key |
| OAuth email collision | No auto-merge; explicit link flow |
| Password reset token reuse | Single `consumedAt`; invalidate sessions on reset |
| Refresh token replay | Family revocation |
| KYC webhook replay | Idempotency store + session version check |
| Suspended user API access | Policy on every route; session invalidation on suspend |
| BOLA on profile/KYC | Resource owner checks; 404 vs 403 per conventions |
| PII in logs | Existing `redactSensitive` extended in 002B for auth headers |

---

## Decision-conditioned options

| If owner chooses… | Design adjustment |
|---|---|
| D-02-AUTH includes Apple/Google only (no password) | `PasswordCredential` omitted; `ExternalIdentity` required |
| D-02 phone required | `phoneE164` NOT NULL + `PHONE_OTP` challenges |
| D-09 KYC deferred | `provider = STUB`; transitions without external HTTP |
| D-01 under-18 ineligible | Block `ACTIVE` if `ageEligibilityStatus = INELIGIBLE` |

---

## Related documents

- `docs/database/DATA_MODEL.md` — full product conceptual model
- `docs/api/IDENTITY_API_DRAFT.md` — REST contracts
- `docs/testing/IDENTITY_ACCEPTANCE_MATRIX.md` — verification tests
- `docs/product/IDENTITY_DECISION_REVIEW.md` — owner gates
