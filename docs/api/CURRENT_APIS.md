# StrangeUp Backend — Currently Implemented APIs

**Last updated:** 2026-10-26 (Task 002B.2A)
**Maintainers:** Update this file in the **same change** as any API implementation, modification, or removal. See `AGENTS.md`.

| Status | Meaning |
|---|---|
| **LIVE** | Routed in `src/` and covered by tests or OpenAPI where noted |
| **DEV_ONLY** | Implemented but relies on dev email stub / not production-ready delivery |
| **PLANNED** | Contract draft only — not implemented |

**Base URL (local):** `http://localhost:3000` (default `PORT` from env)
**Product API prefix:** `/v1`

**OpenAPI:** `openapi/foundation.yaml` (health), `openapi/identity.yaml` (auth + self account/profile Phase 1)

---

## Envelope (all LIVE JSON APIs)

Success:

```json
{ "data": { }, "meta": { "requestId": "string" } }
```

Error:

```json
{ "error": { "code": "string", "message": "string", "requestId": "string" } }
```

- Request correlation: optional header `x-request-id` (generated if omitted).
- Details: `docs/api/FOUNDATION_ENVELOPE.md`, `docs/api/CONVENTIONS.md`.

---

## LIVE endpoints

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health/live` | None | Process liveness; does not check database |
| `GET` | `/health/ready` | None | Readiness; runs bounded DB connectivity check when `DATABASE_URL` configured |

#### `GET /health/live`

- **200** — `{ "data": { "status": "ok" }, "meta": { "requestId" } }`

#### `GET /health/ready`

- **200** — `{ "data": { "status": "ok", "checks": { "database": "up" } }, "meta": { "requestId" } }`
- **503** — `error.code` = `SERVICE_UNAVAILABLE` when database missing or unreachable

---

### Auth (`/v1/auth`)

Requires `DATABASE_URL` and auth env (`JWT_ACCESS_SECRET`, etc.). Routes are **not mounted** if the app starts without a database client.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/auth/register` | None | Create account (email/password, DOB, consents); no tokens in response |
| `POST` | `/v1/auth/login` | None | Issue access + refresh tokens |
| `POST` | `/v1/auth/refresh` | None | Rotate refresh token (family replay detection) |
| `POST` | `/v1/auth/logout` | Bearer access | Revoke current session (optional `refreshToken` in body) |
| `POST` | `/v1/auth/logout-all` | Bearer access | Revoke all sessions for user |
| `POST` | `/v1/auth/email-verification/request` | Bearer access | Resend verification (dev email stub) |
| `POST` | `/v1/auth/email-verification/confirm` | None | Consume verification token |
| `POST` | `/v1/auth/password-reset/request` | None | Request password reset email (enumeration-safe) |
| `POST` | `/v1/auth/password-reset/confirm` | None | Consume reset token and set new password |

**Source:** `src/modules/auth/auth.routes.ts`, `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.service.ts`

#### `POST /v1/auth/register`

**Headers:** optional `Idempotency-Key` (replay same body → same `201` response; different body → `409`).

**Request:**

```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "password": "string",
  "dateOfBirth": "YYYY-MM-DD",
  "consents": [
    { "type": "TERMS", "version": "string" },
    { "type": "PRIVACY", "version": "string" },
    { "type": "AGE_ATTESTATION", "version": "string" }
  ]
}
```

**Validation:** email format; password ≥8 with letter + number; `dateOfBirth` as `YYYY-MM-DD` (UTC calendar, leap-day safe); **not in the future**; **USA launch 18+**; all three consent types required. Consent `version` strings are **client-supplied** until counsel publishes canonical IDs (**release blocker**).

**Password storage:** scrypt with per-hash stored `N/r/p`; new credentials use **N=16384, r=8, p=5**. Older **p=1** hashes remain valid; successful **login** transparently rehashes to the preferred cost (no API shape change).

**Response 201:**

```json
{
  "data": {
    "userId": "uuid",
    "accountStatus": "PENDING_VERIFICATION",
    "emailVerificationRequired": true
  },
  "meta": { "requestId": "..." }
}
```

**Errors:** `VALIDATION_ERROR` 400 (including under-18); `CONFLICT` 409 duplicate email; `AUTH_RATE_LIMITED` 429.

**Tests:** `tests/integration/auth.integration.test.ts` (I-P01, I-N01, I-N02, idempotency).

---

#### `POST /v1/auth/login`

**Request:** `{ "email": "string", "password": "string" }`

**Response 200:**

```json
{
  "data": {
    "accessToken": "string",
    "accessTokenExpiresAt": "ISO-8601",
    "refreshToken": "string",
    "refreshTokenExpiresAt": "ISO-8601",
    "user": {
      "id": "uuid",
      "accountStatus": "PENDING_VERIFICATION | ACTIVE | ...",
      "emailVerified": false,
      "ageEligibilityStatus": "ELIGIBLE | ...",
      "identityVerificationStatus": "NOT_STARTED | ...",
      "fullAccess": false
    }
  },
  "meta": { "requestId": "..." }
}
```

**Errors:** `AUTH_INVALID_CREDENTIALS` 401; `AUTH_FORBIDDEN` 403 suspended/deleted; `AUTH_RATE_LIMITED` 429.

**Tests:** `tests/integration/auth.integration.test.ts` (I-P02, I-N03, I-N04).

---

#### `POST /v1/auth/refresh`

**Request:** `{ "refreshToken": "string" }`

**Response 200:** new `accessToken`, `refreshToken`, and expiry fields (rotation).

**Errors:** `AUTH_UNAUTHORIZED` 401 (includes reuse of rotated refresh → family revoked; concurrent refresh races lose with 401 — clients must serialize refresh).

**Tests:** `tests/integration/auth.integration.test.ts` (I-P03, I-N09).

---

#### `POST /v1/auth/logout`

**Auth:** `Authorization: Bearer <accessToken>`

**Request:** `{ "refreshToken": "string" }` optional.

**Response 200:** `{ "data": { "success": true }, "meta": { ... } }`

**Tests:** `tests/integration/auth.integration.test.ts` (I-P04, I-N10).

---

#### `POST /v1/auth/logout-all`

**Auth:** Bearer access token.

**Response 200:** `{ "data": { "success": true }, "meta": { ... } }`

**Tests:** `tests/integration/auth.integration.test.ts`.

---

#### `POST /v1/auth/email-verification/request`

**Auth:** Bearer access token (pending or active account).

**Rate limit:** per-user (`AUTH_RATE_LIMIT_EMAIL_VERIFY_PER_USER` / minute).

**Response 202:** `{ "data": { "message": "If verification is required, instructions were sent." }, "meta": { ... } }`

**Delivery:** development uses in-process email **stub** (logged/captured in tests, not vendor delivery).

---

#### `POST /v1/auth/email-verification/confirm`

**Request:** `{ "token": "string" }`

**Response 200:**

```json
{
  "data": {
    "accountStatus": "ACTIVE",
    "emailVerified": true
  },
  "meta": { "requestId": "..." }
}
```

**Errors:** `AUTH_CHALLENGE_EXPIRED` 400 when token invalid/expired/consumed.

**Tests:** `tests/integration/auth.integration.test.ts` (I-P05).

---

#### `POST /v1/auth/password-reset/request` — **DEV_ONLY delivery**

**Request:** `{ "email": "string" }`

**Response 202:** always the same body (enumeration-resistant):

```json
{
  "data": { "message": "If an account exists, instructions were sent." },
  "meta": { "requestId": "..." }
}
```

**Rate limit:** per IP and per normalized email (`AUTH_RATE_LIMIT_PASSWORD_RESET_*`).

**Behavior:** issues `PASSWORD_RESET` `AuthChallenge` (hashed token, expiry, one-time use). Suspended/deleted/unknown emails receive the same HTTP response; no email sent when not eligible.

**Delivery:** dev stub only — token in stub email body or link built from `PUBLIC_APP_BASE_URL` (never from `Host` header). **Not production-ready** until a real email provider is integrated.

**Tests:** `tests/integration/me.integration.test.ts` (I-N05, I-P06).

**Source:** `src/modules/auth/auth.service.ts` (`requestPasswordReset`).

---

#### `POST /v1/auth/password-reset/confirm`

**Request:** `{ "token": "string", "newPassword": "string" }` (same password rules as register).

**Response 200:** `{ "data": { "success": true }, "meta": { ... } }` — **no** session/tokens issued (user must log in).

**Side effects:** consumes challenge atomically; updates password hash; **revokes all sessions** (access tokens fail on next request).

**Errors:** `AUTH_CHALLENGE_EXPIRED` 400 invalid/expired/consumed/wrong-purpose token; `VALIDATION_ERROR` 400 weak password.

**Tests:** `tests/integration/me.integration.test.ts` (I-P06, I-N06, I-N07, I-C03).

---

### Self account & profile (`/v1/me`)

**Auth:** Bearer access token on all routes. **Self only** — no user id in path; policy uses authenticated user.

**Source:** `src/modules/me/me.routes.ts`, `src/modules/me/me.service.ts`, `src/modules/policy/account-policy.ts`

| Method | Path | Eligibility | Description |
|---|---|---|---|
| `GET` | `/v1/me/account` | `canAccessAccount` (pending or active; not suspended/deleted) | Private account status DTO |
| `GET` | `/v1/me/profile` | `canAccessAccount` | Own profile (read-only birthDate) |
| `PATCH` | `/v1/me/profile` | `canEditProfile` (verified email + age eligible + not suspended) | Narrow field allowlist |

#### `GET /v1/me/account`

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "email": "string",
    "accountStatus": "PENDING_VERIFICATION | ACTIVE | ...",
    "emailVerified": false,
    "ageEligibilityStatus": "ELIGIBLE | ...",
    "identityVerificationStatus": "NOT_STARTED | ...",
    "fullAccess": false,
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601",
    "consents": [
      { "type": "TERMS", "version": "string", "recordedAt": "ISO-8601" }
    ]
  },
  "meta": { "requestId": "..." }
}
```

**Notes:** `identityVerificationStatus` remains stub dimensions (no live KYC). No password hashes, tokens, or challenge secrets.

**Tests:** `tests/integration/me.integration.test.ts` (pending user account read).

---

#### `GET /v1/me/profile`

**Response 200:**

```json
{
  "data": {
    "firstName": "string | null",
    "lastName": "string | null",
    "displayName": "string | null",
    "bio": "string | null",
    "scheduleTimeZone": "string | null",
    "birthDate": "YYYY-MM-DD"
  },
  "meta": { "requestId": "..." }
}
```

**Tests:** `tests/integration/me.integration.test.ts`.

---

#### `PATCH /v1/me/profile`

**Request:** partial JSON, **strict** allowlist only:

- `firstName`, `lastName`, `displayName`, `bio`, `scheduleTimeZone` (valid IANA zone)

Unknown keys → `VALIDATION_ERROR` 400. Cannot set `birthDate`, `accountStatus`, `emailVerified`, roles, or ids via body.

**Response 200:** same shape as `GET /v1/me/profile`.

**Errors:** `AUTH_FORBIDDEN` 403 when pending/unverified; `VALIDATION_ERROR` 400.

**Tests:** `tests/integration/me.integration.test.ts` (I-P07, mass-assignment rejection).

---

### Error codes (auth + me)

`AUTH_INVALID_CREDENTIALS`, `AUTH_UNAUTHORIZED`, `AUTH_FORBIDDEN`, `AUTH_CHALLENGE_EXPIRED`, `AUTH_RATE_LIMITED`, `CONFLICT`, `VALIDATION_ERROR`, `NOT_FOUND`, plus foundation codes.

---

## PLANNED (not implemented)

| Method | Path | Target task |
|---|---|---|
| `DELETE` | `/v1/me/account` | Later (deletion workflow UNRESOLVED) |
| `POST` | `/v1/me/verification/sessions` | Later (stub KYC) |
| `GET` | `/v1/users/:id` | Blocked until D-03/D-04 |

---

## Change log

| Date | Change |
|---|---|
| 2026-10-26 | Task 002B.2A — scrypt preferred cost + rehash-on-login (behavior only) |
| 2026-10-26 | Task 002B.2 — password reset, `/v1/me/account`, `/v1/me/profile` GET/PATCH |
| 2026-10-26 | Task 002B.1 — identity migration + `/v1/auth/*` email/password core |
| 2026-10-26 | Initial permanent doc; LIVE = health only (Task 001). |
