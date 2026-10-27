# Flutter Developer Handoff — StrangeUp Backend

**Last updated:** 2026-10-27 (Task 012 — groups & communities)
**Audience:** Flutter mobile team in the **separate Flutter repository** (development based in Bangladesh; product launch market **USA**).

**Maintained by:** `strangeup-backend` only. Backend agents do not implement Flutter screens; they update this file whenever HTTP APIs change.

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

**Implemented today:** `/health/*`, `/v1/auth/*`, `/v1/me/*`, discovery, and activities (see `CURRENT_APIS.md`).

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
| KYC policy | **APPROVED** (2026-10-26): KYC-01, KYC-03, KYC-05 + five enforcement policies — see §12 and `KYC_OWNER_DECISIONS_002B3A2.md` |
| KYC APIs | **No live** verification-session endpoints. Activity **publish/confirm** enforcement is LIVE (Task 010) and fails closed in production until a provider exists |

**Still open:** mandatory phone, **KYC-02** vendor, **KYC-04** retry/appeal/outage, **KYC-06** legal, **KYC-07** copy, retention (D-09-retention), ops detail (`D-09-kyc-enforcement-ops`), counsel consent version IDs.

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

**PATCH allowlist only:** `firstName`, `lastName`, `displayName`, `username`, `bio`, `scheduleTimeZone` (IANA), `profileVisibility` (`EVERYONE` | `VERIFIED_USERS_ONLY`), `locationCity`, `locationRegion` (text only; `null` clears).

**Visibility default (OWN-PROFILE-02):** New accounts return `profileVisibility: VERIFIED_USERS_ONLY` on first `GET /v1/me/profile` until the user chooses `EVERYONE`. This does **not** affect who can edit the profile (still email-verified + age eligible). Cross-user visibility enforcement waits D-03; `VERIFIED_USERS_ONLY` viewers in the future require **government-ID KYC approved** — not email verification alone.
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
    'username': 'ada_lovelace',
    'bio': 'Synthetic bio for integration tests.',
    'scheduleTimeZone': 'America/New_York',
  }),
);
```

`birthDate` is returned on GET for the owner but cannot be changed through this API (registration-time field).

**Gating for Save (Edit Personal Details):** After login, call `GET /v1/me/account`. If `emailVerified` is false or `ageEligibilityStatus` is not `ELIGIBLE`, show read-only fields and disable save — `PATCH`, `PUT /v1/me/interests`, `PUT /v1/me/favorite-activities`, and avatar `POST/DELETE` return `403 AUTH_FORBIDDEN`. Pending users may still **read** profile, interests, favorites, and avatar for display.

`GET /v1/me/profile` also returns `profileVisibility`, `locationCity`, `locationRegion`, `hasAvatar`, and `avatarUpdatedAt`. Use `hasAvatar` before calling `GET /v1/me/profile/avatar`. Do **not** show a government-ID or “verified location” badge from these fields alone.

### 9.1 Profile interests (Task 007 — catalog only)

1. **Load catalog (authenticated):** `GET /v1/interests` → `data.interests` is ten `{ slug, label }` objects in stable order (Biking … Food). Use slugs as chip keys; show `label` in UI.
2. **Load current selection:** `GET /v1/me/interests` → same shape; may be `[]`. Order is catalog order, not selection order.
3. **Save:** `PUT /v1/me/interests` with body `{ "interests": ["biking", "music"] }` — sends **slugs only**; 0–10 distinct catalog entries; replaces entire selection (send `[]` to clear). Same edit gate as profile PATCH.
4. **Errors:** `401` missing/invalid token; `403` when not allowed to edit; `400` + `VALIDATION_ERROR` for unknown slug, duplicates, >10, wrong types, or extra JSON keys — treat as no save.
5. **Privacy:** Do not show another member’s interests — no public profile API; selections are private to `/v1/me/interests`.

```dart
// Catalog
final catalog = await http.get(
  Uri.parse('$baseUrl/v1/interests'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
// Selection replace
await http.put(
  Uri.parse('$baseUrl/v1/me/interests'),
  headers: {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({'interests': selectedSlugs}),
);
```

**Figma `Html → Body-1.pdf` → API (safe subset only):**

| Figma control | Wire today? | API |
|---|---|---|
| First / Last Name | Yes | `PATCH` `firstName`, `lastName` |
| About Me | Yes | `PATCH` `bio` (max **300** on write; legacy rows may return longer until user edits) |
| Username (`@handle`) | Yes | `PATCH` `username` — 3–30 chars, `[a-z0-9_]`, optional; `409` if taken; no public lookup API yet |
| Display name (not on all mocks) | Yes | `PATCH` `displayName` |
| Schedule time zone (settings/scheduling) | Yes | `PATCH` `scheduleTimeZone` (IANA) |
| Date of Birth | Read-only | `GET` `birthDate` only |
| Your Interests (catalog chips) | Yes | `GET /v1/interests` + `GET/PUT /v1/me/interests` — see §9.1; custom “Add Interest” **not** supported |
| Location (city/region text) | Yes (Task 008) | `PATCH` `locationCity`, `locationRegion`; no geo coords; location “Verified” badge is **not** server-backed |
| Profile visibility radios | Yes (Task 008) | `PATCH` `profileVisibility`; enforcement on **other users** waits D-03 |
| Favorite Activities | Yes (Task 008) | `GET/PUT /v1/me/favorite-activities` — preference pins, not Activity entities; see §9.2 |
| Profile photo | Yes (Task 008) | `POST` multipart `avatar`, `GET` bytes, `DELETE`; see §9.3 |

### 9.2 Favorite activity preferences (Task 008)

1. **Load:** `GET /v1/me/favorite-activities` → `data.favoriteActivities` (0–5 items).
2. **Save:** `PUT` with full replacement list `{ "favoriteActivities": [ { "title", "skillLevel", "cadence", "scheduleNote?", "placeLabel?" } ] }`.
3. **Enums:** `skillLevel`: `BEGINNER` | `INTERMEDIATE` | `ADVANCED`; `cadence`: `WEEKLY` | `CASUAL`.
4. **Privacy:** Favorite pins remain **self-only** (`/v1/me/favorite-activities`); never shown on `GET /v1/users/:userId`.

**Policy note:** Owner decisions **APPROVED** — `docs/decisions/D-OWN-PROFILE-REMAINING-REQUEST-task008.md` (Task 008A).

### 10. Discovery & public profiles (Task 009 — D-03/D-04 MVP)

**Prerequisites:** User must be logged in with `fullAccess` (`GET /v1/me/account`). Pending/unverified users get `403` on discovery routes.

1. **People list (`Screen 09`):** `GET /v1/discover/people?limit=20&cursor=...` optional `q`, `city`, `region`, `interest` (catalog slug). Response `data.people[]` preview objects; paginate with `meta.nextCursor`.
2. **Public profile (`Screen 10`):** `GET /v1/users/{userId}` — use only returned fields; **no** email, DOB, KYC, or visibility enum.
3. **Avatar:** If `hasAvatar`, `GET /v1/users/{userId}/avatar` with bearer token (not a public CDN URL).
4. **Visibility:** Targets default `VERIFIED_USERS_ONLY`; viewer needs server `identityVerificationStatus === APPROVED` to see them (not email verification alone). `EVERYONE` targets visible to all eligible viewers. **No anonymous access.**
5. **Blocks (`Screen 26` blocked users):** `POST /v1/me/blocks` `{ "targetUserId" }`, `DELETE /v1/me/blocks/{targetUserId}`, `GET /v1/me/blocks` for settings list.
6. **404 handling:** Hidden/blocked/missing profiles return generic `404` — show a neutral “profile unavailable” state; do not infer block vs privacy.
7. **Hide in UI (not in API):** map, distance/radius, “nearest”, online/active dots, review counts. Follow / Wave / Message are §14. Activity discovery is §13.

```dart
final list = await http.get(
  Uri.parse('$baseUrl/v1/discover/people?limit=20'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
final people = jsonDecode(list.body)['data']['people'] as List;
```

### 9.3 Profile avatar (Task 008 / 008A)

1. **Upload:** `POST /v1/me/profile/avatar` with `multipart/form-data`, field name **`avatar`** (JPEG/PNG/WebP, max **5 MiB**). Server validates **file content**, not extension or client MIME; SVG and corrupt files return `400 VALIDATION_ERROR`.
2. **Display:** If `hasAvatar` on profile GET, fetch `GET /v1/me/profile/avatar` with bearer token (`Cache-Control: private, no-store`).
3. **Remove:** `DELETE /v1/me/profile/avatar`.
4. **Production:** Local disk (`PROFILE_UPLOAD_DIR`) is **development only** — object storage, moderation, and ops review are release blockers.

**Signup vs `Screen 06_ Sign Up.pdf`:** Backend register requires `dateOfBirth` and `consents` (D-02). Figma omits DOB and shows phone — add DOB + consent UX in Flutter; omit phone or collect locally only until owner approves phone collection. Map `firstName` / `lastName` to register body (also seeds initial `displayName`).

**Settings hub (`Screen 26_ Profile & Settings.pdf`):** Account/profile flows above are LIVE, plus **authenticated password change** (below). Rows for subscription, 2FA, blocked users, delete account, identity approval badges, etc. are **not** connected — use honest placeholders.

### Change password (logged in)

Distinct from forgot-password (`POST /v1/auth/password-reset/*`). Wire the Password & Security screen to:

1. `POST /v1/me/password-change` with bearer token and body `{ "currentPassword": "...", "newPassword": "..." }` (same strength rules as signup).
2. On **200**, clear stored tokens locally and navigate to login — **all sessions are revoked** (`sessionsRevoked: true`); the response does not issue new tokens.
3. Handle `401` + `AUTH_INVALID_CREDENTIALS` for wrong current password; `400` for weak/same-as-current password; `429` for rate limits.

```dart
final res = await http.post(
  Uri.parse('$baseUrl/v1/me/password-change'),
  headers: {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'currentPassword': current,
    'newPassword': newPassword,
  }),
);
// 200 → wipe tokens, show login
```

**Not yet LIVE:** account deletion, KYC **sessions**. Public profiles and activities are in `CURRENT_APIS.md`.

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

## 12. KYC — APPROVED PRODUCT POLICY vs API / UI NOT LIVE

### APPROVED PRODUCT POLICY (2026-10-26)

Authoritative: `docs/product/KYC_OWNER_DECISIONS_002B3A2.md`. Verification **sessions** are still not implemented. **Activity publish / confirmed RSVP / meeting access** now enforce these gates in Task 010.

| Topic | Rule |
|---|---|
| **KYC-01** | Gov ID before **real-world** meetup/activity **participation and hosting**; not required for signup/login/browse/own profile **alone** |
| **KYC-03** | Only **provider server-validated** outcome may set `APPROVED`; **no** manual approval initially; **no** client/self-DOB approval |
| **KYC-05** | ID/selfie/biometrics **provider-hosted**; StrangeUp stores **minimal metadata** only |
| **Join / RSVP / host** | KYC before **confirming** in-person/hybrid join and meetup RSVP; **recheck at check-in**; host KYC before **publish/activate** |
| **Waitlist** | May join waitlist **without** KYC; **cannot** be promoted to confirmed without KYC |
| **Invitations** | **Sender** KYC required to send real-world meetup invite; **recipient** KYC before RSVP accept |
| **Virtual** | **100% virtual-only** activities **exempt** from KYC-01 gate |
| **Expiry/revocation** | Block new join/host; restrict upcoming confirmed participation/hosting; **do not** silently cancel bookings/events |
| **Out of scope** | DM, follow, groups, marketplace — not gated by these KYC decisions alone |

**UX expectations after implementation (behavior approved; copy OPEN — KYC-07):** show verification-needed prompts on protected actions; allow waitlist entry; do not block virtual-only paths solely for KYC-01; guide on expired/revoked — **never** trust upload/selfie screens alone.

### PLANNED / NOT LIVE — APIs and verification UI

> **Not connected:** No verification session API and no vendor token. **Activity enforcement is connected** (Task 010). **KYC-02 vendor not selected** (`KYC_VENDOR_EVALUATION.md`). Screens #34, #48, #49 — **DESIGN / PLANNED — NOT CONNECTED**.

**Pending Flutter responsibilities (after backend + vendor exist — PROPOSED):**

| Area | Responsibility |
|---|---|
| Entry | Call StrangeUp to start session; receive **opaque** session URL / SDK params — never provider secret |
| Flow | Hosted redirect **or** in-app SDK (Stripe / Persona / Veriff — vendor-dependent) |
| Completion | **Do not** set `APPROVED` locally; poll `GET /v1/me/account` or session status when LIVE |
| Denial UX | Map future `IDENTITY_VERIFICATION_*` codes at join/RSVP/publish/check-in — codes **PROPOSED**, not LIVE |
| Waitlist | Allow waitlist UI; block promotion UX until server allows |
| Virtual | Skip KYC-01 prompts only when server marks activity **100% virtual-only** |
| Cancel/errors | Handle user cancel and provider unavailable without fake success |
| Copy | KYC-07 **OPEN** — no final strings in this doc |

| Topic | Guidance |
|---|---|
| `identityVerificationStatus` | From login / `GET /v1/me/account` only — expect `NOT_STARTED`; **not** updated by local upload UI |
| Proposed endpoints | `KYC_API_CANDIDATES.md` — **NOT IMPLEMENTED**; do not call in production |
| Fake success | No verified badge, no join/host enablement from document/selfie screens alone |
| `fullAccess` | Email + age + active — **not** gov ID (**CONFIRMED**) |
| Future denial codes | `IDENTITY_VERIFICATION_REQUIRED` is **LIVE** on real-world activity publish/confirm/meeting when KYC is missing |

### Proposed UI states (KYC-07 copy not approved)

Design-only until server contracts exist:

| State | PLANNED UX direction |
|---|---|
| Verification required | Block confirm join/RSVP/publish using `IDENTITY_VERIFICATION_REQUIRED`; waitlist at full capacity is allowed without KYC |
| Pending / in review | No success badge |
| Rejected / expired / revoked | Block gated actions; no silent access |
| Provider unavailable | No bypass; no mock APPROVED |

---

## 13. Activities & meetups (Task 010 — Screens 11–13)

**Status:** Implemented in source; native PostgreSQL verification **pending**. Treat responses as the contract; do not invent demo data.

**Do not treat Figma demo claims as live:** `100% verified attendees`, maps, miles-away chips, host star ratings, member counts, or a two-hour edit lock. Favorite-activity profile pins (`/v1/me/favorite-activities`) are **not** Activity records.

1. **Catalog:** `GET /v1/activity-categories` — use these slugs for create/filter. Do **not** reuse profile Interests as activity categories.
2. **Discovery (`Screen 11`):** `GET /v1/activities?limit=20&category=biking&q=&city=&region=` — paginate with `meta.nextCursor`. Hide map / Nearby radius UI or mark it unavailable.
3. **Details (`Screen 12`):** `GET /v1/activities/{id}` for public fields only. If `meetingAvailable` is true, call `GET /v1/activities/{id}/meeting` for exact instructions. Never persist meeting text in analytics.
4. **Join:** `POST /v1/activities/{id}/rsvp`. Handle `200` with `state: CONFIRMED | WAITLISTED`, `403 IDENTITY_VERIFICATION_REQUIRED`, `409` at capacity, `404` hidden/blocked.
5. **Leave:** `DELETE /v1/activities/{id}/rsvp` (idempotent).
6. **Create (`Screen 13`):** `POST /v1/me/activities` creates a **draft**. `POST /v1/me/activities/{id}/publish` is required before it appears in discovery. Real-world publish needs server KYC — there is no production approval path yet, so expect `IDENTITY_VERIFICATION_REQUIRED` in production.
7. **Cover:** `POST /v1/me/activities/{id}/cover` multipart field name **`cover`**. Public fetch: `GET /v1/activities/{id}/cover` when `hasCover`.
8. **Followers Only:** You may send `audience: FOLLOWERS_ONLY` on a draft; publish will `400`. Do not present it as a working live audience.
9. **Verified-members toggle:** Do not send a client flag to weaken KYC. Server always gates real-world confirm/publish.
10. **My Activities:** `GET /v1/me/activities` (hosted) and `GET /v1/me/activity-rsvps` (joined/waitlisted). No attendee roster API.

```dart
final list = await http.get(
  Uri.parse('$baseUrl/v1/activities?limit=20'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
final activities = jsonDecode(list.body)['data']['activities'] as List;
```

---

## 14. Social connections & 1:1 messaging (Task 011)

**Status:** Implemented in source; native PostgreSQL verification **pending**.

**Do not ship Figma claims:** “Verified & End-to-End Encrypted Chat”, online/ACTIVE CIRCLES, device-delivered ticks, or fake follower counts. Group chat is a **separate** Task 012 API (`/v1/me/group-chats`), not a 1:1 conversation.

1. **Follow:** `POST /v1/users/{userId}/follow` and `DELETE` to unfollow. Both are idempotent. Use `viewerFollows` + `followerCount` from `GET /v1/users/{userId}`.
2. **Wave / Say Hi:** `POST /v1/users/{userId}/wave`. Inbox: `GET /v1/me/waves`. A wave is **not** a chat and does not send push.
3. **Message:** `POST /v1/me/message-requests` `{ "targetUserId" }` with **no text**. Recipient `POST .../accept` or `.../decline`. Only after accept call `POST /v1/me/conversations/{id}/messages` `{ "body" }`.
4. **Chat list:** `GET /v1/me/conversations` — `unreadCount`, last-message preview, optional `q`.
5. **Read:** `POST /v1/me/conversations/{id}/read` — server watermark only, not delivery.
6. **Errors:** hidden/blocked → generic `404`. Declined request retry → `409`. Mutual follow does **not** skip the request.
7. **`FOLLOWERS_ONLY` activities** still cannot be published.

```dart
final req = await http.post(
  Uri.parse('$baseUrl/v1/me/message-requests'),
  headers: {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({'targetUserId': otherUserId}),
);
```

---

## 15. Groups & communities (Task 012)

**Status:** LIVE and verified on isolated Neon `strangeup_test`. Decisions in `docs/decisions/D-GROUPS-TASK012.md` are **provisional** (D-06 still open).

**Do not ship Figma claims:** Verified Community / wristband, miles away, Active Daily presence, sample 428 members, Live Synced stats, E2EE, typing, or 24h stories.

1. **Catalog:** `GET /v1/group-categories` — use these slugs. Do **not** reuse profile Interests or activity categories.
2. **Discovery (`Screen 14`):** `GET /v1/groups?q=&category=sports&city=&privacy=` — both PUBLIC and PRIVATE_APPROVAL appear as summaries. Paginate with `meta.nextCursor`. Hide map/nearby UI.
3. **Create (`Screen 1`):** `POST /v1/me/groups` with name **max 60**. Optional `tags` (max 5, `[a-z0-9-]`, 2–24 chars), `meetupFrequency` (`WEEKLY` \| `ACTIVE_DAILY` \| `BIWEEKLY`) is display-only, `memberCapacity` min 2. Cover: `POST /v1/me/groups/{id}/cover` field name **`cover`**, **5MB** (not the Figma 10MB example).
4. **Join:** `POST /v1/groups/{id}/join`. PUBLIC → `ACTIVE`. PRIVATE_APPROVAL → `PENDING`. After `DECLINED` or `REMOVED`, the next join is always `PENDING` (even on PUBLIC). Last owner cannot leave (`403`) — call `POST /v1/me/groups/{id}/transfer-ownership` first.
5. **Manage (`Screen 2`):** `GET /v1/me/groups/{id}/manage`, approve/decline `.../join-requests/{membershipId}/...`. `memberCount` is ACTIVE rows only.
6. **Details (`Screen 15`):** `GET /v1/groups/{id}` is a summary. Posts, members, comments, likes, and chat require `canAccessContent: true`. Use generic `404` for unauthorized content — do not infer that the group is missing.
7. **Posts:** text only `{ "body" }`. Optional `activityId` only after the activity is attached. No Photo/Poll/Story endpoints.
8. **Chat:** `GET /v1/me/group-chats` for Screen 16 group-thread previews. Send via `POST /v1/groups/{id}/chat/messages`. This is **not** `/v1/me/conversations`. No E2EE, typing, or online count.
9. **Meetups:** `GET /v1/groups/{id}/activities` lists real Task 010 cards. Joining a group does **not** RSVP. Real-world activity publish/confirm still needs Task 010 KYC.
10. **Never render:** `verified`, `verifiedCommunity`, distance, or invented member counts.

```dart
final created = await http.post(
  Uri.parse('$baseUrl/v1/me/groups'),
  headers: {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'name': 'Sunrise Riders',
    'category': 'sports',
    'privacy': 'PUBLIC',
  }),
);
final groupId = jsonDecode(created.body)['data']['groupId'];
```

---

## Change log

| Date | Summary |
|---|---|
| 2026-10-27 | Task 012 — groups/membership/posts/group chat/activity links; §15; no stories/polls/verified badge |
| 2026-10-27 | Task 011 — follow/wave/message requests/1:1 chat; §14; no E2EE or presence |
| 2026-10-27 | Task 010 — activities discovery/detail/create, RSVP/waitlist, meeting privacy, KYC enforcement; §13 |
| 2026-10-26 | Task 005 — authenticated password change (`/v1/me/password-change`); §9 settings hub |
| 2026-10-26 | Task 002B.3A3 — §12 Flutter integration dependencies; vendor not selected |
| 2026-10-26 | Task 002B.3A2 — KYC-01/03/05 + ENF policies in §3/§12; still no LIVE KYC routes |
| 2026-10-26 | Task 002B.3A1 — KYC-01 approved policy in §3/§12; PLANNED UI states; still no LIVE KYC routes |
| 2026-10-26 | Task 002B.3A — §12 planned KYC warning; no LIVE verification routes |
| 2026-10-26 | Task 002B.2 — password reset, `/v1/me/*` account/profile; dev-only email caveat |
| 2026-10-26 | Task 002B.1 — `/v1/auth/*` LIVE; Flutter examples for register/login/refresh |
| 2026-10-26 | Initial handoff; owner approvals D-01, D-02, D-02-AUTH, D-09; health LIVE only |
