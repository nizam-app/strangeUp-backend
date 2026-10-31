# Identity API Draft — Contracts & Authorization (Task 002A)

**Status:** PROPOSED — not implemented. Uses foundation envelope (`docs/api/FOUNDATION_ENVELOPE.md`, `docs/api/CONVENTIONS.md`).
**Version prefix:** `/v1`.
**Screen evidence:** 31, 33, 35, 25, 37, 34, 48, 49 (traceability).

## Global rules

- All JSON camelCase; instants ISO-8601 UTC in `meta`/`data` where applicable.
- Authenticated routes: `Authorization: Bearer <accessToken>` unless noted.
- Rate limits (PROPOSED): stricter on `auth/*` public routes (per IP + per identifier).
- Idempotency: `Idempotency-Key` header on `POST /v1/auth/register` (scoped to guest or device fingerprint + key).
- Errors: extend foundation codes with `AUTH_INVALID_CREDENTIALS`, `AUTH_UNAUTHORIZED`, `AUTH_FORBIDDEN`, `AUTH_CHALLENGE_EXPIRED`, `AUTH_RATE_LIMITED`, `CONFLICT`, `VALIDATION_ERROR`.
- **Never** return: password hash, refresh token in logs, raw reset token after creation, government ID, selfie URLs to non-owner.

---

## Policy matrix (central — ADR-002)

| Policy | Default (pre-approval) | Notes |
|---|---|---|
| `canAccessAccount(actor, userId)` | `actor.userId === userId` && account `ACTIVE` or `PENDING_VERIFICATION` (read-only subset) | Suspended/deleted → deny |
| `canEditProfile(actor, userId)` | same as access + not suspended | Field-level rules for DOB if locked post-verify |
| `canStartVerification(actor, userId)` | own account + D-09 allows + not already terminal APPROVED session | Provider may be stub |
| `canAccessOwnVerificationStatus(actor, userId)` | own account only | No admin read in 002B |
| `canInteractWithUser(actor, targetId)` | **deny** until D-03 | Returns false for all social actions |

---

## Endpoints — Phase 1 candidates

Legend: **002B-Core** = proposed for Task 002B if decisions approved; **Later** = documented only.

### Auth — guest

#### `POST /v1/auth/register` — **002B-Core** (screen 33)

**Auth:** none.

**Request (PROPOSED):**

```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string | optional",
  "password": "string",
  "consents": [{ "type": "TERMS", "version": "string" }]
}
```

**Validation:** email format; password policy TBD; phone E.164 if present; consents required if D-02 approves.

**Response 201:**

```json
{
  "data": {
    "userId": "uuid",
    "accountStatus": "ACTIVE",
    "emailVerificationRequired": false
  },
  "meta": { "requestId": "..." }
}
```

**Errors:** `VALIDATION_ERROR` 400; `CONFLICT` 409 duplicate email (message must not confirm which field if enumeration policy strict — owner choice); `AUTH_RATE_LIMITED` 429.

**Security:** idempotency key; no session until email verified if D-02 option E.

---

#### `POST /v1/auth/login` — **002B-Core** (screen 31)

**Request:** `{ "email", "password" }` or OAuth payload on separate routes (below).

**Response 200:**

```json
{
  "data": {
    "accessToken": "string",
    "accessTokenExpiresAt": "instant",
    "refreshToken": "string",
    "refreshTokenExpiresAt": "instant",
    "user": { "id", "accountStatus", "emailVerified": false }
  },
  "meta": { "requestId": "..." }
}
```

**Errors:** `AUTH_INVALID_CREDENTIALS` 401 (generic message); `AUTH_FORBIDDEN` 403 suspended/deleted; 429 rate limit.

**Negative tests:** wrong password; timing normalization; suspended user.

---

#### `POST /v1/auth/oauth/:provider` — **Later / 002B if D-02-AUTH approves** (Apple/Google, screen 31)

**Request:** `{ "idToken": "string", "nonce": "string?" }`

**Response:** same token shape as login; may include `linkingRequired: true` if email conflict.

**Rules:** verify issuer/audience; no merge on email alone.

---

#### `POST /v1/auth/refresh` — **002B-Core**

**Request:** `{ "refreshToken": "string" }`

**Response:** new access + refresh (rotation).

**Errors:** `AUTH_UNAUTHORIZED` 401 on reuse (family revoked).

---

#### `POST /v1/auth/logout` — **002B-Core**

**Auth:** bearer access token.

**Request:** `{ "refreshToken": "string" }` optional — revoke current session family.

**Response:** `{ "data": { "success": true }, "meta": {...} }`

---

#### `POST /v1/auth/logout-all` — **002B-Core**

**Auth:** bearer. Revokes all sessions for user.

---

#### `POST /v1/auth/password-reset/request` — **002B-Core** (screen 35)

**Request:** `{ "email": "string" }`

**Response 202:** always same body whether or not account exists (enumeration-resistant):

```json
{ "data": { "message": "If an account exists, instructions were sent." }, "meta": {...} }
```

---

#### `POST /v1/auth/password-reset/confirm` — **002B-Core**

**Request:** `{ "token": "string", "newPassword": "string" }`

**Errors:** `AUTH_CHALLENGE_EXPIRED` 400/401; invalidate other sessions on success.

---

#### `POST /v1/auth/email-verification/request` — **002B-Core** (if D-02 gate)

**Auth:** bearer (pending user).

**Response:** 202 generic success.

---

#### `POST /v1/auth/email-verification/confirm` — **002B-Core**

**Request:** `{ "token": "string" }` — may promote `accountStatus` to `ACTIVE`.

---

### Account & profile — owner

#### `GET /v1/me/account` — **002B-Core** (screen 25)

**Response:** private account DTO: statuses, verification dimensions (not combined badge), consents summary.

---

#### `GET /v1/me/profile` — **002B-Core** (screen 37)

**Response:** full profile including private fields for owner.

---

#### `PATCH /v1/me/profile` — **002B-Core**

**Request:** partial fields; reject unknown keys (anti mass-assignment).

**Policy:** `canEditProfile`.

**Public fields only in response if dual DTO returned; prefer separate `GET /v1/users/:id` later.

---

#### `DELETE /v1/me/account` — **Later** (screen 25)

Deletion workflow, cooling-off, retention — UNRESOLVED; document only.

---

### Verification — owner (screens 34, 48, 49)

#### `POST /v1/me/verification/sessions` — **002B-Core** (stub provider)

**Policy:** `canStartVerification`.

**Response 201:** `{ "sessionId", "status": "PENDING_USER", "clientAction": "STUB" | "REDIRECT", "providerUrl": null }`

---

#### `GET /v1/me/verification/sessions/:sessionId` — **002B-Core**

**Policy:** `canAccessOwnVerificationStatus`.

**Response:** status, timestamps, **no** document images.

---

#### `POST /v1/webhooks/verification/:provider` — **Later / stub in 002B**

Signature verification, idempotency, no auth bearer — mTLS or HMAC per vendor.

---

### Not in identity Phase 1

- `GET /v1/users/:id` — blocked until D-03/D-04 (BOLA risk).
- Social, discovery, messaging — see `ENDPOINT_CANDIDATES.md`.

---

## Authorization vs HTTP status

| Situation | HTTP | Code |
|---|---|---|
| Missing/invalid token | 401 | `AUTH_UNAUTHORIZED` |
| Valid token, wrong user resource | 404 or 403 | `AUTH_FORBIDDEN` (prefer 404 for existence hiding on user IDs) |
| Pending verification on gated action | 403 | `AUTH_FORBIDDEN` |

---

## Rate limiting (PROPOSED defaults)

| Route family | Limit |
|---|---|
| login, register, reset request | 10/min/IP + 5/min/email hash |
| refresh | 30/min/session |
| verification start | 3/hour/user |

---

## OpenAPI

Task 002B should add `openapi/identity.yaml` fragments; Task 002A does not add stubs to repo.

---

## Client contract warnings

- UI “verified” badges must map to explicit API fields (`identityVerificationStatus`, etc.).
- Do not infer premium or KYC success from HTTP 200 on register/login alone.
- Optimistic UI must reconcile with `GET /v1/me/account` after mutations.
