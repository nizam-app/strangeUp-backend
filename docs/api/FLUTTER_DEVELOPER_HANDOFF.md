# Flutter Developer Handoff — StrangeUp Backend

**Last updated:** 2026-10-26 (Task 002B.2A)
**Audience:** Flutter mobile team (development based in Bangladesh; product launch market **USA**).

This document is the **primary integration guide** for calling the StrangeUp API. Pair it with:

- **`docs/api/CURRENT_APIS.md`** — authoritative list of **implemented** routes (update on every API change).
- **`docs/api/IDENTITY_API_DRAFT.md`** — broader identity contracts (some routes still PLANNED).
- **`openapi/foundation.yaml`**, **`openapi/identity.yaml`** — machine-readable specs.

---

## 1. Environment and transport

| Item | Value |
|---|---|
| Local base URL | `http://localhost:3000` (or host machine IP for device/emulator) |
| API version prefix | `/v1` |
| Content-Type | `application/json; charset=utf-8` |
| Correlation | Send `x-request-id` (UUID) on every request; echo in logs |

Use HTTPS in staging/production; certificate pinning is a client decision (not specified here).

**CORS:** configured via server `CORS_ORIGINS`; mobile native clients typically bypass CORS but must still send correct `Content-Type`.

---

## 2. Response envelope (required client parsing)

Always parse the top-level shape before reading nested fields.

**Success:** `response.data` + `response.meta.requestId`
**Failure:** `response.error.code`, `response.error.message`, `response.error.requestId`

**Implemented today:** `/health/*`, `/v1/auth/*`, and `/v1/me/account` + `/v1/me/profile` (see `CURRENT_APIS.md`).

---

## 3. Approved product rules (owner 2026-10-26)

These are **server-enforced**; **do not** simulate them only in UI.

| Topic | Rule |
|---|---|
| Launch | USA, **18+** only |
| Signup | Email, password, date of birth, legal acceptances |
| Email | Must be verified before **full** account access (`fullAccess` on login user object) |
| Auth methods | Email/password **only** for now — no Google/Apple/phone OTP yet |
| Trust | **Separate** fields: `emailVerified`, `ageEligibilityStatus`, `identityVerificationStatus` — never one `isVerified` |
| KYC | No live KYC APIs yet |

**Still open:** mandatory phone, KYC vendor, retention, counsel-approved consent version IDs (use placeholder versions only with product approval).

---

## 4. Client state model (recommended)

```text
Session: accessToken + refreshToken + expiry
Account: accountStatus (PENDING_VERIFICATION vs ACTIVE)
Trust (read-only from server):
  - emailVerified
  - ageEligibilityStatus
  - identityVerificationStatus
  - fullAccess (derived gate for discovery/social — still deny until future APIs)
```

**Gating UX:**

- After register: no tokens — call login after verify, or login immediately with limited `fullAccess: false`.
- After email confirm: expect `accountStatus: ACTIVE` when age eligible.
- Hide or disable Apple/Google until OAuth routes appear in `CURRENT_APIS.md`.

---

## 5. Error handling

| HTTP | Typical `error.code` | Client action |
|---|---|---|
| 400 | `VALIDATION_ERROR` / `AUTH_CHALLENGE_EXPIRED` | Show safe message |
| 401 | `AUTH_UNAUTHORIZED` / `AUTH_INVALID_CREDENTIALS` | Refresh or re-login |
| 403 | `AUTH_FORBIDDEN` | Restricted / suspended account |
| 404 | `NOT_FOUND` | Generic message |
| 409 | `CONFLICT` | Email taken / idempotency misuse |
| 429 | `AUTH_RATE_LIMITED` | Backoff |
| 503 | `SERVICE_UNAVAILABLE` | Retry |

Never log passwords, tokens, reset links, or government ID images.

**Password hashing (server-side):** New accounts use stronger scrypt work factors; existing users are upgraded on next successful login. No client action required.

---

## 6. Health checks (LIVE)

```http
GET /health/live
GET /health/ready
```

---

## 7. Identity integration (LIVE — Task 002B.1)

### Recommended flow

1. `POST /v1/auth/register` with `Idempotency-Key` header (UUID).
2. User completes email verification via deep link → `POST /v1/auth/email-verification/confirm` with `{ "token": "..." }`.
3. `POST /v1/auth/login` → store tokens securely.
4. On 401 from protected routes, `POST /v1/auth/refresh` then retry once (**serialize** refresh — see below).
5. Settings: `POST /v1/auth/logout` or `POST /v1/auth/logout-all` with bearer access token.

### Token storage and refresh (security)

- Store `accessToken` and `refreshToken` in **platform secure storage** (Keychain / EncryptedSharedPreferences / flutter_secure_storage). Never log tokens or verification links.
- **Serialize refresh:** use a single in-flight refresh mutex per app instance. Parallel refresh calls can rotate the same refresh token twice; the server treats reuse of an old refresh as replay and **revokes the whole session family** (user must log in again).
- `fullAccess` on login is **informational**; always reconcile with `GET /v1/me/account` after login, verify, or profile changes.
- **Suspended** accounts: login returns **403** `AUTH_FORBIDDEN`; existing tokens stop working on next API call (401).
- **Email verification:** production delivery is **not** live — local/dev backend uses an in-process stub (token appears in server logs only, not in register/login JSON). Do not treat stub behavior as production contract.

### Social / discovery

`canInteractWithUser` is hard-denied server-side until D-03 is approved — no cross-user actions in Phase 1 APIs.

### Register example (Dart `http`)

```dart
final response = await http.post(
  Uri.parse('$baseUrl/v1/auth/register'),
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyUuid,
    'x-request-id': requestId,
  },
  body: jsonEncode({
    'firstName': 'Ada',
    'lastName': 'Lovelace',
    'email': 'ada@example.com',
    'password': 'Str0ngPass1',
    'dateOfBirth': '1995-01-01',
    'consents': [
      {'type': 'TERMS', 'version': 'pending-legal-review'},
      {'type': 'PRIVACY', 'version': 'pending-legal-review'},
      {'type': 'AGE_ATTESTATION', 'version': 'pending-legal-review'},
    ],
  }),
);
```

**Release blocker:** replace consent `version` values when legal publishes canonical document IDs.

### Login + refresh example

```dart
// Login
final login = await http.post(
  Uri.parse('$baseUrl/v1/auth/login'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'email': 'ada@example.com', 'password': 'Str0ngPass1'}),
);
final data = jsonDecode(login.body)['data'];
final accessToken = data['accessToken'];
final refreshToken = data['refreshToken'];
final fullAccess = data['user']['fullAccess'] as bool;

// Refresh
final refreshed = await http.post(
  Uri.parse('$baseUrl/v1/auth/refresh'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'refreshToken': refreshToken}),
);
```

### Authenticated request

```dart
await http.post(
  Uri.parse('$baseUrl/v1/auth/logout-all'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
```

---

## 8. Password recovery (LIVE API, **DEV_ONLY email delivery**)

**Important:** Reset endpoints are implemented and tested, but **email is not sent by a production provider**. Local/dev backends use an in-process stub (token appears only in server-side stub output / test capture). Plan UX for “check your email” but do not ship production forgot-password until `CURRENT_APIS.md` marks delivery as production-ready.

### Forgot password UX

1. `POST /v1/auth/password-reset/request` with `{ "email": "user@example.com" }`.
2. Always show the same success copy on **202** (whether or not the account exists).
3. User opens link or enters token from email → `POST /v1/auth/password-reset/confirm` with `{ "token": "...", "newPassword": "..." }`.
4. On **200**, **clear all local tokens** (server revokes every session). Navigate to login — **no auto-login** after reset.

### Dart examples (synthetic data)

```dart
// Request reset
await http.post(
  Uri.parse('$baseUrl/v1/auth/password-reset/request'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'email': 'ada@example.com'}),
);

// Confirm reset (after user receives token via production email — not returned in HTTP)
await http.post(
  Uri.parse('$baseUrl/v1/auth/password-reset/confirm'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'token': 'synthetic-reset-token-from-email',
    'newPassword': 'NewStr0ngPass2',
  }),
);
// Then login again with new password
```

**Errors:** `AUTH_CHALLENGE_EXPIRED` (invalid/expired/reused token), `AUTH_RATE_LIMITED` (429), `VALIDATION_ERROR` (weak password).

**Token revocation:** After confirm, treat any stored `accessToken` / `refreshToken` as invalid; call login fresh.

---

## 9. Self account & profile (LIVE)

### `GET /v1/me/account`

Call after login (including **pending verification**) so settings/onboarding screens can show `accountStatus`, trust dimensions, and consent versions recorded at signup.

```dart
final res = await http.get(
  Uri.parse('$baseUrl/v1/me/account'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
final account = jsonDecode(res.body)['data'];
final fullAccess = account['fullAccess'] as bool;
```

Pending users: **can** read account; **cannot** PATCH profile until `emailVerified` and age eligible (`403`).

### `GET` / `PATCH /v1/me/profile`

**PATCH allowlist only:** `firstName`, `lastName`, `displayName`, `bio`, `scheduleTimeZone` (IANA).
**Not writable via PATCH:** `birthDate`, `dateOfBirth`, `accountStatus`, `emailVerified`, KYC fields, `role`, `userId`, etc.

```dart
await http.patch(
  Uri.parse('$baseUrl/v1/me/profile'),
  headers: {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'displayName': 'Ada L.',
    'bio': 'Synthetic bio for integration tests.',
    'scheduleTimeZone': 'America/New_York',
  }),
);
```

`birthDate` is returned on GET for the owner but cannot be changed through this API (registration-time field).

**Not yet LIVE:** account deletion, KYC sessions, public `GET /v1/users/:id` — watch `CURRENT_APIS.md`.

---

## 10. Testing against backend

| Check | Command (backend repo) |
|---|---|
| Unit tests | `npm test` |
| Integration (DB) | `RUN_INTEGRATION=1` + `INTEGRATION_DATABASE_URL` — see README |

Apply migrations before integration tests: `npx prisma migrate deploy` against the test database URL.

---

## 11. Documentation duty

When backend merges API changes, **`CURRENT_APIS.md` must change in that PR**. Flutter leads should subscribe to diffs on that file and section 7 here.

---

## Change log

| Date | Summary |
|---|---|
| 2026-10-26 | Task 002B.2 — password reset, `/v1/me/*` account/profile; dev-only email caveat |
| 2026-10-26 | Task 002B.1 — `/v1/auth/*` LIVE; Flutter examples for register/login/refresh |
| 2026-10-26 | Initial handoff; owner approvals D-01, D-02, D-02-AUTH, D-09; health LIVE only |
