# Flutter Developer Handoff — StrangeUp Backend

**Last updated:** 2026-10-29 (Tasks **022D** activation gate through **029H** groups/jobs closure; **027I** activities; **028H** meetup invites **READY_FOR_OWNER_REVIEW**; doc sync after Task **030** backend audit)
**Audience:** Flutter mobile team in the **separate Flutter repository** (development based in Bangladesh; product launch market **USA**).

**Maintained by:** `strangeup-backend` only. Backend agents do not implement Flutter screens; they update this file whenever HTTP APIs change.

This document is the **primary integration guide** for calling the StrangeUp API. Pair it with:

- **`docs/api/CURRENT_APIS.md`** — authoritative list of **implemented** routes (update on every API change).
- **`docs/api/IDENTITY_API_DRAFT.md`** — broader identity contracts (some routes still PLANNED).
- **`openapi/*.yaml`** — machine-readable specs (**partial** coverage; **`CURRENT_APIS.md`** is complete for LIVE HTTP). Primary bundles: `foundation`, `identity`, `settings`, `activities`, `social`, `meetup-invites`, `groups`, `group-content`, `messaging-realtime`, `push-devices`, `home`, `notifications`, `store`, `jobs`, `membership`, `admin` (staff-only — not for mobile).

### Source of truth (avoid drift)

| Question | Read first |
|---|---|
| Does this route exist? Method, path, auth, request/response shape? | **`CURRENT_APIS.md`** |
| Product gating, DEFERRED features, screen mapping, client UX rules? | **This handoff** |
| Conflict between the two docs? | **`CURRENT_APIS.md` wins** for HTTP contracts; file an issue if handoff looks wrong |

### Server feature flags (Flutter expectations)

Backend ops control these via env (see backend `.env.example`). **Do not infer LIVE behavior from Figma alone.**

| Flag / setting | Typical dev/test | Production default | Flutter guidance |
|---|---|---|---|
| `KYC_PROVIDER_ENABLED` + `KYC_PROVIDER` | Often **off** (`FEATURE_DISABLED`) | **Off** until vendor approved | Hide full ID verification flow unless `GET /v1/me/verification/status` shows `canStartVerification: true` |
| `CONSENT_ENFORCEMENT` | `placeholder_allowed` in test | **`strict`** (when counsel IDs published) | Always **`GET /v1/consents/required`** before register/job apply; use `activeVersionId` from response |
| `GROUP_COMMUNITY_INTERACTIVE_ENABLED` | **false** | **false** (D-06) | Do not ship stories/polls/photo-post UI as LIVE; Home `stories.status` stays `DEFERRED` |
| Store checkout / membership billing | **Not implemented** | **Not implemented** | Catalog/cart/save only; no payment CTAs |
| Transactional email | `dev_stub` (token in server logs) | Provider TBD | Do not assume inbox delivery in local dev |

### Consent before signup (Task 021)

1. `GET /v1/consents/required` (no auth).
2. For each registration document with `availability` ≠ `UNAVAILABLE`, send register `consents[]` with matching `type` and **`version` = `activeVersionId`**.
3. Job applications: same registry via `jobApplication` block; field `applicationConsentVersion` must match `activeVersionId`.
4. **`503` / validation errors** when versions are stale or counsel IDs not published — show “try again later”, do not invent version strings.

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

**Implemented routes:** All **LIVE** REST endpoints (~178 routes) are listed in **`CURRENT_APIS.md`** (Tasks **001–029H** within approved scope). Mobile-relevant surface includes: health, auth, **`/v1/consents/*`**, **`/v1/me/onboarding/status`**, **`/v1/me/verification/*`** (provider usually disabled), self account/profile/settings, interests, discover/users, activities (027 hybrid join + roster), **`/v1/meetup-invites/*`** (product capability still **DEFERRED** until owner sign-off), social + **`/v1/me/messaging/summary`**, Socket.IO DM/group (**§14.5**), push device tokens + preferences, groups (029 create/manage/archive), home + community feed, in-app notifications (incl. meetup types), store (no checkout), jobs (no employer publish), membership (read-only plans). **Not for Flutter:** **`/v1/admin/*`** (Admin Panel / staff catalog). **PLANNED** routes (e.g. destructive account delete) are at the end of **`CURRENT_APIS.md`** only.

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
| KYC APIs | **Task 021:** session/status routes **exist**; default env keeps provider **disabled** (`FEATURE_DISABLED`). Activity **publish/confirm/meeting** enforcement is **LIVE** (Task 010) and **fails closed** in production until `KYC_PROVIDER_ENABLED=true` with a configured adapter. **Veriff live/SDK blocked by owner (KYC-02).** |
| Consent APIs | **`GET /v1/consents/required`** is LIVE; register/job apply must use server **`activeVersionId`** values (see consent section above) |

**Still open:** mandatory phone, **KYC-02** vendor selection, **KYC-04** retry/appeal/outage, **KYC-06** legal, **KYC-07** copy, retention (D-09-retention), ops detail (`D-09-kyc-enforcement-ops`), counsel **ACTIVE** consent version IDs for production `strict` mode.

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
| 403 | `ONBOARDING_REQUIRED` | Pending onboarding — use `error.nextAction`, `onboardingPhase`, `homeAccessAllowed: false`; call `GET /v1/me/onboarding/status` |
| 403 | `ACCOUNT_NOT_ACTIVATED` | Admin rejected or activation denied — do not route to Home; show remediation from `nextAction` |
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

**Consent versions:** Call **`GET /v1/consents/required`** and send each `activeVersionId` for the three registration types. Do not hard-code version strings in the app binary unless you also handle registry rollover. Production **`strict`** enforcement rejects unknown/stale versions.

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

**Important:** Reset endpoints are implemented and tested. Default local/dev uses an in-process stub (token in test capture). Production may use **Resend** when ops sets `TRANSACTIONAL_EMAIL_MODE=provider` with verified domain credentials — `handed_to_provider` still does not guarantee inbox delivery. Plan UX for “check your email” accordingly.

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

### `GET /v1/me/onboarding/status` (Task 022A — auth flow routing)

Call after **every login** and on Screen 07 / post-register navigation. This is the **authoritative** activation router for Flutter (not SDK `done`, not provider decision alone).

**Response highlights:** `homeAccessAllowed`, `onboardingPhase`, `effectiveApplicationAccess`, `nextAction`, `canStartVerification`, `canRetry`, `adminReviewStatus`, `identityVerificationStatus`, `emailVerificationStatus`, `verificationStepHint`, `limitations[]`.

**`onboardingPhase` (stable):** `AWAITING_EMAIL_VERIFICATION`, `READY_FOR_IDENTITY_VERIFICATION`, `IDENTITY_VERIFICATION_IN_PROGRESS`, `IDENTITY_RESUBMISSION_REQUIRED`, `AWAITING_PROVIDER_DECISION`, `PROVIDER_DECLINED_OR_EXPIRED`, `AWAITING_ADMIN_REVIEW`, `ADMIN_REJECTED`, `FULLY_ACTIVATED`.

**`nextAction` values:** `VERIFY_EMAIL`, `START_IDENTITY_VERIFICATION`, `CONTINUE_IDENTITY_VERIFICATION`, `WAIT_FOR_PROVIDER_DECISION`, `WAIT_FOR_ADMIN_REVIEW`, `ADMIN_REJECTED`, `RETRY_IDENTITY_VERIFICATION`, `HOME_READY`, `CONTACT_SUPPORT`, `ACCOUNT_SUSPENDED`.

**Register → IDV:** `POST /v1/auth/register` does **not** return tokens. After register, route to login (or email verify) then call this endpoint before any Home navigation. `user.fullAccess` on login remains `false` until provider KYC **and** StrangeUp admin approval (see ADR-005).

**Figma auth ZIP parity (Task 022D):** Screen-by-screen classification — `docs/product/FIGMA_AUTH_FLOW_PARITY_TASK022.md`. Government ID + selfie capture are **Veriff SDK only** (no backend upload). Apple/Google login buttons are **DEFERRED** (no OAuth routes). Email verification and admin-waiting UI were **not** in the auth ZIP; use onboarding API states.

**Main Flow ZIP parity (Task 025A):** Home/Discover/Activities/Marketplace/Profile screens — `docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025A.md` (nine PDFs in `design-reference/task025-main-flow/`). **All five main tabs** require `homeAccessAllowed: true` (Task 022 / ADR-005), not email verification alone. Home composition: `GET /v1/home`; messages header badge: `GET /v1/me/messaging/summary` (separate from `notificationsUnreadCount`).

```dart
final onboarding = await http.get(
  Uri.parse('$baseUrl/v1/me/onboarding/status'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
final data = jsonDecode(onboarding.body)['data'];
if (data['homeAccessAllowed'] != true) {
  // route by data['nextAction'] — never open Home/Dashboard
}
```

### `GET /v1/me/account`

Call after login (including **pending verification**) so settings/onboarding screens can show `accountStatus`, trust dimensions, and consent versions recorded at signup. Prefer **`/v1/me/onboarding/status`** for Screen 07 step UX; use account for settings/consent audit display.

```dart
final res = await http.get(
  Uri.parse('$baseUrl/v1/me/account'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
final account = jsonDecode(res.body)['data'];
final fullAccess = account['fullAccess'] as bool; // false until admin + provider KYC (ADR-005)
```

Pending users: **can** read account and onboarding status; **cannot** PATCH profile until `emailVerified` and age eligible (`403`). **`fullAccess` false** does not block IDV session start once email is verified.

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

**Gating for Save (Edit Personal Details — Task 025D / `Html → Body.pdf`):** After login, call `GET /v1/me/profile` and `GET /v1/me/account`. If `emailVerified` is false or `ageEligibilityStatus` is not `ELIGIBLE`, disable save (`403 AUTH_FORBIDDEN` on PATCH). When **`legalNameLocked === true`** (trusted KYC and/or prior staff identity approval — **sticky** after expiry/revocation; Task 025D/025E), disable first/last name fields — server rejects those PATCH keys. Corrections require owner-approved support flow (not self-serve PATCH). **`birthDate` is never PATCHable.** Main-app gate: `GET /v1/me/settings/overview`, interests, favorite-activities, avatar POST/DELETE (after gate), blocks, saved activities → `403 ONBOARDING_REQUIRED` until `homeAccessAllowed`. Main Flow parity: `docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025E.md` (Profile detail: `FIGMA_MAIN_FLOW_PARITY_TASK025D.md`).

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

**Prerequisites (Task 022C):** Main-app routes (discovery, `/v1/users/*`, activities, groups, home, store, jobs, membership, and gated `/v1/me/*` product routes) require **`homeAccessAllowed: true`** (trusted provider KYC + StrangeUp admin approval on the same session). Pending users receive **`403 ONBOARDING_REQUIRED`** with `nextAction` — not a generic crash. Onboarding-safe APIs remain available: auth, `GET /v1/me/onboarding/status`, `/v1/me/verification/*`, account/profile read, password change, session inventory/revoke, deletion impact, and interest **catalog** `GET /v1/interests`.

1. **People list (`Screen 09`):** `GET /v1/discover/people?limit=20&cursor=...` optional `q`, `city`, `region`, `interest` (catalog slug). Response `data.people[]` preview objects; paginate with `meta.nextCursor`. **Targets are main-app activated only** (Task 022/025B) — onboarding-pending users never appear. Do **not** render Figma miles, map, “nearest first”, last-active, age/today filters, or active-peer counts unless future APIs exist (`docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025B.md`).
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
4. **Production:** Server uses **`MEDIA_STORAGE_BACKEND=s3`** with a private bucket in production (Task 020); Flutter still uploads/downloads via the same multipart fields and authenticated GET routes — **no** direct S3 URLs in API responses. Local disk (`MEDIA_STORAGE_BACKEND=local`) remains dev/test default. Bucket activation and backfill are ops/owner-gated (`docs/operations/MEDIA_OBJECT_STORAGE.md`).

**Signup vs `Screen 06_ Sign Up.pdf`:** Backend register requires `dateOfBirth` and `consents` (D-02). Figma omits DOB and shows phone — add DOB + consent UX in Flutter; omit phone or collect locally only until owner approves phone collection. Map `firstName` / `lastName` to register body (also seeds initial `displayName`).

**Settings hub (`Screen 26_ Profile & Settings.pdf`) — Task 015:**

1. **Hub load:** `GET /v1/me/settings/overview` — requires **main-app activation**. Use `data.profile`, `data.account` (`adminReviewStatus`, `legalNameLocked`, `fullAccess`, `identityVerificationStatus`), `data.counts`, and **`data.capabilities`** (never treat DEFERRED/UNAVAILABLE as zero counts; **no** rating/meetup-invite fields). `relatedRoutes` lists existing endpoints for navigation.
2. **Saved Activities (Activity entities):** `GET /v1/me/saved-activities`, `PUT/DELETE /v1/me/saved-activities/{activityId}`. **Not** the same as Task 008 `favorite-activities` preference pins. **027D:** List/save apply Task 025C host discoverability (same as public discover); ineligible hosts **omitted** from list / **404** on save; underlying save rows preserved. Settings `counts.savedActivities` counts **all** DB saves and may exceed visible list length (**MDWQ-0718** — optional future visible count).
3. **Blocked users:** LIVE via `GET/POST/DELETE /v1/me/blocks*` (see §9).
4. **Password & security:** `POST /v1/me/password-change` (below) + `GET /v1/me/security/sessions`, `DELETE /v1/me/security/sessions/{sessionId}`, `POST /v1/auth/logout-all`.
5. **Email change:** `POST /v1/me/email-change/request` then `POST /v1/me/email-change/confirm` — **DEV_ONLY** email delivery until an approved transactional provider is configured. When **`transactionalEmail.canHandOff`** is false (typical production `TRANSACTIONAL_EMAIL_MODE=disabled`), both routes return **`403 FEATURE_DISABLED`**. After confirm, **all sessions revoked** — force re-login. Password account only (no password → do not show change-email).
6. **Delete account:** `GET /v1/me/account-deletion/impact` only — show `AWAITING_POLICY`; **no** destructive delete API. Do not show success/deletion complete UI.
7. **Still DEFERRED / placeholders:** subscription **billing**, payment history, 2FA, phone verify/edit, settings hub meetup row (`capabilities.meetupInvites` still **DEFERRED** until owner sign-off), host star ratings, “ID Verified” marketing badges beyond `identityVerificationStatus`, 24/7 support guarantees.
8. **Membership summary (Task 017 / Screen 18):** `data.membership` on settings overview; full detail via `GET /v1/me/membership`; catalog via `GET /v1/membership/plans`. **`capabilities.membershipPlanCatalog: LIVE`**; **`capabilities.subscription: DEFERRED`** (no live upgrade/checkout).

**Membership plans screen (`Screen 18_ Membership Plans.pdf`) — Task 017 / 026A:**

1. **Default selection:** Users without verified paid billing show **`planId: BASIC`**, **`tierKind: FREE`** from `GET /v1/me/membership`.
2. **Catalog:** `GET /v1/membership/plans` — Basic **`pricing.monthlyAmountCents: 0`**; Club **`purchasable: false`**, **`pricing: null`**. **Do not** show Figma Club prices, trial, or checkout tax math as live offers.
3. **Flow contract:** Read **`data.flow`** on both endpoints (`contractVersion`, `checkout`, `billingIntervalSelector`, `figmaEvidence.knownPricingContradictions`). Owner **2026-10-28:** all billing **DEFERRED**.
4. **Upgrade CTA:** `canUpgrade: false` — disable; optional dev-only `upgradeBlockedReasons`.
5. **Monthly/yearly toggle:** Use `flow.billingIntervalSelector` — Club intervals **NOT_CONFIGURED**; do not compute annual savings client-side.
6. **Perks list:** Honor feature **`status`**: **`NOT_CONFIGURED`**, **`DEFERRED`**, **`NOT_IMPLEMENTED`** → not active/enforced; only **`AVAILABLE`** may be shown as included (still subject to Task 022 gates).
7. **KYC badge:** Never infer from membership; use **`identityVerificationStatus`** + admin review (Task 022).
8. **Checkout / restore / Apple Pay:** `flow.checkout.status: DEFERRED` — no payment sheets, restore, trials, or invoices.
9. **Group membership:** Not subscription billing — see `notes.communityGroupMembershipIndependent` on self membership.
10. **Settings hub:** `GET /v1/me/settings/overview` → compact `membership`; full `flow` on `/v1/me/membership`.

```dart
final membership = await http.get(
  Uri.parse('$baseUrl/v1/me/membership'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
final planId = jsonDecode(membership.body)['data']['planId']; // BASIC
```

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

**Not yet LIVE:** destructive account deletion, KYC **sessions**, production email for change/reset/verify. Public profiles and activities are in `CURRENT_APIS.md`.

---

## 10. Testing against backend

| Check | Command (backend repo) |
|---|---|
| Unit tests | `npm test` |
| Integration (DB) | `RUN_INTEGRATION=1` + `INTEGRATION_DATABASE_URL` — see README |

Apply migrations before integration tests: `npx prisma migrate deploy` against the test database URL.

---

## 11. Documentation duty

When backend merges API changes, **`CURRENT_APIS.md` must change in that PR** and this handoff must reflect product gating / screen wiring. Flutter leads should subscribe to diffs on **`CURRENT_APIS.md`** first, then the relevant §§ here (auth §7–8, profile §9, activities §13, meetups §13A, messaging §14–14.7, groups §15, home §16, store/jobs §17, membership §19).

---

## 12. KYC — APPROVED PRODUCT POLICY vs API availability

### APPROVED PRODUCT POLICY (2026-10-26)

Authoritative: `docs/product/KYC_OWNER_DECISIONS_002B3A2.md`. **Task 021** added verification **session/status** HTTP routes; they are **not usable in typical dev/prod configs** until ops enables a provider. **Activity publish / confirmed RSVP / meeting access** enforce KYC gates regardless (Task 010).

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

### Verification UI — when to wire (Task 021)

| Capability | HTTP | Wire in Flutter when |
|---|---|---|
| Consent catalog | `GET /v1/consents/required` | **Now** — required for register and job apply |
| KYC self-service status | `GET /v1/me/verification/status` | **Now** — drive empty/disabled states from `providerRuntimeStatus` / `canStartVerification` |
| Start / poll / cancel session | `POST/GET …/verification/sessions*` | **Only when** backend confirms provider enabled (shared dev API or staging); never fake `APPROVED` locally |
| Provider SDK / Veriff | N/A | **BLOCKED BY OWNER (KYC-02)** until backend team announces activation |

**Production default:** provider **disabled** — show verification-needed messaging on gated activity actions using `IDENTITY_VERIFICATION_REQUIRED`, not a completed ID flow. Screens #34, #48, #49 — design against **`/v1/me/verification/status`**; full SDK flow waits on owner + ops.

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
| Consent versions | **`GET /v1/consents/required`** before register/job apply; send exact `activeVersionId` per document (or handle `503` when `UNAVAILABLE`) |
| Session APIs | **`CURRENT_APIS.md`** Task 021 table; **`KYC_API_CANDIDATES.md`** is superseded for implemented routes |
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
2. **Discovery (`Screen 11`):** `GET /v1/activities?limit=20&category=biking&q=&city=&region=` — paginate with `meta.nextCursor`. `q` matches activity **title** or host **displayName/username**. Only **main-app activated** hosts’ public activities appear (Task 025C). Hide map / Within 5 miles radius UI or mark unavailable (D-04). Parity: `docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025C.md`.
3. **Details (`Screen 12`):** `GET /v1/activities/{id}` for public fields only. If `meetingAvailable` is true, call `GET /v1/activities/{id}/meeting` for exact instructions. Never persist meeting text in analytics.
4. **Join:** `POST /v1/activities/{id}/rsvp`. **AUTO:** `state: CONFIRMED | WAITLISTED`. **HOST_APPROVAL:** `state: PENDING` until host acts. Handle `403 IDENTITY_VERIFICATION_REQUIRED`, `409` at capacity / duplicate / declined reapply, `404` hidden/blocked.
5. **Leave:** `DELETE /v1/activities/{id}/rsvp` (idempotent).
6. **Create (`Screen 13`):** `POST /v1/me/activities` creates a **draft**. `POST /v1/me/activities/{id}/publish` is required before it appears in discovery. Real-world publish needs server KYC — there is no production approval path yet, so expect `IDENTITY_VERIFICATION_REQUIRED` in production.
7. **Cover:** `POST /v1/me/activities/{id}/cover` multipart field name **`cover`**. Public fetch: `GET /v1/activities/{id}/cover` when `hasCover`.
8. **Followers Only:** You may send `audience: FOLLOWERS_ONLY` on a draft; publish will `400`. Do not present it as a working live audience.
9. **Verified-members toggle:** Do not send a client flag to weaken KYC. Server always gates real-world confirm/publish.
10. **My Activities (Task 027B/027E):** Prefer `GET /v1/me/activity-inventory?view=upcoming|hosting|joined|waitlisted|pending|past` with optional `includeCounts=true` (`pendingApproval` count when counts requested). **`view=pending`** lists activities where `myParticipation.state === PENDING` (`relationship=PENDING_APPROVAL`). **WAITLISTED is capacity waitlist, not host approval.** Use `myParticipation.participationStatus` (`AUTO_*` vs `APPROVAL_*`) for UI copy.
11. **Hybrid joining (Task 027E, D-09):** Activities expose `joinMode`. Draft create/patch may set `HOST_APPROVAL`; locked after publish. **AUTO:** `POST …/rsvp` unchanged. **HOST_APPROVAL:** RSVP → **PENDING** (no meeting access). Host: `GET …/join-requests`, `POST …/approve`, `POST …/decline`. Host manage DTO includes `hostParticipationSummary` (truthful counters — ignore Figma 6 vs 8 example). Reapply after **DECLINED** → **409** (policy TBD). Withdraw pending via `DELETE …/rsvp`.
12. **Activity privacy (Task 027C):** When a host loses activation (025C), public `GET /v1/activities/:id`, cover, meeting, and **new** RSVP return **404** for non-hosts; existing CONFIRMED/WAITLISTED rows stay in DB and inventory/leave still work; host preview on inventory may be redacted. Meeting requires current trusted KYC for real-world modes when participant still has app access (`meetingAvailable` + `GET …/meeting`).
13. **Attendee roster (Task 027F, ACT-ROSTER conservative):** Screen 12 face stack → `GET /v1/activities/{id}/participants?preview=true&limit=5`. **See All (N)** → same route with pagination; use `data.confirmedCount` for **N** (matches public detail `confirmedCount`). Authorized viewers: **host** (manage-eligible) or **CONFIRMED** participant only — **404** for PENDING/WAITLISTED/DECLINED/outsiders (not public). Rows are D-03 `PublicProfilePreview` only; fetch avatars via existing profile media routes when `hasAvatar`. **Do not** expect roster on public detail or join-requests.

### 13A. Personal meetup invitations (Task 028D–028H — **not** Activity RSVP)

**Backend readiness:** **READY_FOR_OWNER_REVIEW** (028H). Wire APIs when owner approves; keep settings `capabilities.meetupInvites` **DEFERRED** until owner explicitly enables LIVE.

**Separate domain from §13 Activity join / 027E host approval.** Do not call Activity RSVP for Figma “Meetup Invites” inbox.

1. **Create (Figma Create Meetup):** `POST /v1/meetup-invites` with `recipientUserId`, `meetupType`, `title`, `scheduledStartsAt`, `scheduleTimeZone`, `venue`, optional `note`. Optional header **`Idempotency-Key`**. Requires sender trusted KYC; recipient must be discoverable (Task 022 + D-03). `409` if a **PENDING** invite already exists for the same ordered pair.
2. **Inbox:** `GET /v1/meetup-invites?box=incoming|outgoing&status=pending|accepted|declined|withdrawn|expired|all&limit=&cursor=`. Use `data.counts.pending` (incoming only) for tab badge — **not** notification unread state.
3. **Detail:** `GET /v1/meetup-invites/{id}`. Recipient: **city/region only** until `status === ACCEPTED`; list cards never show address/label. Sender sees full submitted venue.
4. **Actions (028E):** `POST /v1/meetup-invites/{id}/accept` (recipient, KYC), `…/decline` (recipient), `…/withdraw` (sender). Empty body. **200** on success; repeat same terminal action **200**; wrong terminal **409**; wrong actor **403**; stranger/blocked **404**. After accept, detail/accept response includes full venue for recipient. Wire `data.actions.canAccept|canDecline|canWithdraw` from list/detail.
5. **Notifications (028G — LIVE in backend):** Four types (`MEETUP_INVITATION_RECEIVED|ACCEPTED|DECLINED|WITHDRAWN`) on create/accept/decline/withdraw. Pull `/v1/me/notifications`; tap → `GET /v1/meetup-invites/{sourceId}`. Generic copy only (no venue/note/names). Toggle `meetupInvitesEnabled` on notification preferences. Mark read ≠ accept. Push obeys `PUSH_ENABLED` + prefs (signal-only payload).
6. **Deferred (028F+):** Reschedule, post-accept cancel, maps, check-in copy. Do **not** treat `capabilities.meetupInvites` as LIVE until owner enables hub capability.
7. **Re-invite:** After terminal states (`DECLINED`, `WITHDRAWN`, `EXPIRED`), a **new** create is allowed when no active `PENDING` row exists (D-28).

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
7. **Header / Screen 16 badges (Task 023A):** `GET /v1/me/messaging/summary` — one poll-friendly call for message-tab badges. Use `displayBadgeCount` (or `totalUnreadMessages`) for the **Recent** messages aggregate; use `messageRequestsPending` for the **Requests** tab only. Do **not** add requests or `notificationsUnreadCount` into the messages badge. Requires the same Task 022 main-app gate as other `/v1/me` product routes.
8. **`FOLLOWERS_ONLY` activities** still cannot be published.

```dart
final summary = await http.get(
  Uri.parse('$baseUrl/v1/me/messaging/summary'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
final s = jsonDecode(summary.body)['data'] as Map<String, dynamic>;
final messagesBadge = s['displayBadgeCount'] as int;
final requestsBadge = s['messageRequestsPending'] as int;
```

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

## 14.5 Messaging realtime — Socket.IO (Task 023B)

**Status:** Implemented in source; bounded integration tests on Neon `strangeup_test`. **REST remains authoritative** for send/history/read/idempotency. Socket events are notifications of **already persisted** rows only.

**Connect:** Same host as REST, path `SOCKET_IO_PATH` (default `/socket.io`). Handshake auth:

```dart
IO.io(baseUrl, IO.OptionBuilder()
  .setTransports(['websocket'])
  .setAuth({'token': accessToken})
  .build());
```

**Gate:** Valid non-revoked access JWT + Task 022 main-app activation (pending onboarding → connection rejected). Re-validates session on subscribe/typing; logout/revocation → `messaging:error` + disconnect.

**Client → server**

| Event | Payload | Notes |
|-------|---------|--------|
| `messaging:subscribe_dm` | `{ "conversationId": "<uuid>" }` | Accepted participant only; blocks → error |
| `messaging:unsubscribe_dm` | `{ "conversationId": "<uuid>" }` | Leave room |
| `messaging:subscribe_group` | `{ "groupId": "<uuid>" }` | ACTIVE member only |
| `messaging:unsubscribe_group` | `{ "groupId": "<uuid>" }` | Leave room |
| `messaging:typing` | `{ "target": "dm"\|"group", "id": "<uuid>", "active": true\|false }` | Ephemeral; throttled; **not** presence/online |

**Server → client**

| Event | Payload | Notes |
|-------|---------|--------|
| `messaging:connected` | `{ userId, serverTime, syncHint }` | Auto-joins private `user:{userId}` room for summary pushes |
| `messaging:subscribed` / `messaging:unsubscribed` | `{ kind, id }` | Ack |
| `messaging:error` | `{ code, message }` | Includes `NOT_FOUND`, `VALIDATION_ERROR`, `AUTH_UNAUTHORIZED` |
| `messaging:dm_message` | `{ eventId, message, clientMessageId? }` | After REST `POST .../conversations/.../messages` commit; dedupe by `eventId`/`messageId` |
| `messaging:group_message` | `{ eventId, message, clientMessageId? }` | After REST group chat send |
| `messaging:dm_read` | `{ eventId, conversationId, readerUserId, unreadCount }` | After REST read watermark |
| `messaging:group_read` | `{ eventId, groupId, readerUserId, unreadCount }` | After REST group read |
| `messaging:summary` | `{ eventId, summary }` | Same fields as `GET /v1/me/messaging/summary` |
| `messaging:typing` | `{ eventId, target, id, userId, active }` | Other participants in subscribed room only |

**Reconnect:** On reconnect, resubscribe to open threads, refetch REST message pages + `GET /v1/me/messaging/summary`. Do not infer delivery/read receipts beyond REST watermarks.

**Delivery security (post-023B hardening):** Message/read/summary events are emitted to **per-user rooms** after live ACL checks. Block, group leave, and session revocation evict affected sockets/rooms so passive listeners do not receive new events.

**Do not ship:** online/active circles, E2EE claims, typing as “user is online”. Multi-instance horizontal scale requires a **dedicated** Redis adapter config (`SOCKET_IO_REDIS_ADAPTER_ENABLED` is **false** by default; enabling it without adapter wiring **fails server startup**; rate-limit Redis is **not** reused automatically).

OpenAPI reference: `openapi/messaging-realtime.yaml`.

---

## 14.6 Push device registration & preferences (Task 023C)

**Status:** Registration/preferences **LIVE**; server-side delivery infrastructure (Task 023D) is implemented with **`PUSH_ENABLED=false` by default** — production still performs **no live FCM** until owner authorization.

**Gate:** Task 022 main-app activation (same as other gated `/v1/me/*` routes).

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/me/device-tokens` | Register/rotate FCM token for **current user** |
| `GET` | `/v1/me/device-tokens` | List active devices (metadata only — **never** returns `registrationToken`) |
| `DELETE` | `/v1/me/device-tokens/{deviceTokenId}` | Revoke own device |
| `GET` | `/v1/me/notification-preferences` | Read toggles + `deliveryStatus` (`PUSH_DISABLED` \| `PUSH_ENABLED`) |
| `PATCH` | `/v1/me/notification-preferences` | Partial update (at least one field) |

**Register body:** `{ "platform": "android"|"ios", "registrationToken": "<fcm token>", "deviceBindingId": "<stable device id>" }`  
**Response:** `{ deviceTokenId, platform, deviceBindingId, lastSeenAt, registeredAt }`

**Preference defaults (server):** `pushEnabled`, `directMessagesEnabled`, `messageRequestsEnabled`, `groupMembershipEnabled`, `activityUpdatesEnabled` → **true**; `groupChatEnabled` → **false** (avoid group-chat push spam until product opts in); `marketingEnabled` → **false**.

**Lifecycle:** `POST /v1/auth/logout` revokes tokens bound to the current session; `POST /v1/auth/logout-all` revokes all user tokens and disconnects sockets. Re-register after login on each device.

```dart
await http.post(
  Uri.parse('$baseUrl/v1/me/device-tokens'),
  headers: {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'platform': 'android',
    'registrationToken': fcmToken,
    'deviceBindingId': stableDeviceId,
  }),
);
```

OpenAPI: `openapi/push-devices.yaml`.

---

## 14.7 Push delivery contract (Task 023D)

**Backend behavior (Flutter responsibilities marked):**

| Topic | Contract |
|--------|----------|
| Master switch | `PUSH_ENABLED=false` → outbox rows are marked **`SKIPPED`** (`PUSH_DISABLED`); **no FCM HTTP** from this API process. |
| Source of truth | Only **persisted** `UserNotification` rows enqueue outbox work (no synthetic billing/meetup/identity-complete pushes). |
| Payload | FCM **data** keys: `notificationId`, `type`, optional opaque `sourceId`. Display title/body are **generic** per type — **never** DM text, KYC, or tokens. Resolve details via authenticated `GET /v1/me/notifications` (and existing domain APIs). |
| Preferences | Honored at send time (`pushEnabled` + per-category toggles). `groupChatEnabled` default **false**. Meetup types use **`meetupInvitesEnabled`** (default **true**). |
| Gates | Task 022 home access, non-suspended account, active session for session-bound device tokens. |
| Invalid token | Server revokes `UserDeviceToken`; client should re-register after login. |
| Worker | In-process interval (`PUSH_WORKER_*` env). Multi-instance safe via Postgres `FOR UPDATE SKIP LOCKED`. |
| Firebase setup | **Flutter** configures Firebase SDK on device; backend uses `firebase-admin` + `FIREBASE_CREDENTIALS_FILE` (never embed JSON in app or commit secrets). |

**Client handling:**

```dart
// On FCM data message (foreground/background handler):
final notificationId = message.data['notificationId'];
final type = message.data['type'];
// Fetch authoritative notification + navigation target via REST with current session.
await notificationsRepository.syncAndOpen(notificationId: notificationId, type: type);
```

Do **not** parse private message previews from push payloads. Treat push as a **wake/signal** only.

Operational notes: `docs/operations/PUSH_DELIVERY_TASK023D.md`.

---

## 15. Groups & communities (Task 012)

**Status:** LIVE and verified on isolated Neon `strangeup_test`. Decisions in `docs/decisions/D-GROUPS-TASK012.md` are **provisional** (D-06 still open).

**Do not ship Figma claims:** Verified Community / wristband, miles away, Active Daily presence, sample 428 members, Live Synced stats, E2EE, typing, or 24h stories.

1. **Catalog:** `GET /v1/group-categories` — use these slugs. Do **not** reuse profile Interests or activity categories.
2. **Discovery (`Screen 14`):** `GET /v1/groups?q=&category=sports&city=&privacy=` — both PUBLIC and PRIVATE_APPROVAL appear as summaries. Paginate with `meta.nextCursor`. Hide map/nearby UI.
2b. **My Groups inventory (Task 029B — Figma My Groups screen UNVERIFIED until MDWQ-0910 re-export):** `GET /v1/me/groups` with **`view`**: `all` (default: ACTIVE + PENDING), `joined` (ACTIVE + role `MEMBER`), `managed` (ACTIVE + OWNER or MODERATOR), `pending` (PENDING only). Do **not** combine `view` with `status`/`role` (400). Optional `q` filters by group name. Tab badge counts are **not** returned — compute client-side from paginated lists or defer (MDWQ-0912). Cancel pending: `DELETE /v1/groups/{id}/join`.
3. **Create (`Screen 1`, Task 029C):** `POST /v1/me/groups` with name **max 60**. Optional `description`, `locationCity`/`locationRegion`, `tags` (max 5), `meetupFrequency`, `memberCapacity` (min **2**). Categories from `GET /v1/group-categories` only — do not send Figma free-text category names. Cover is **after** create: `POST /v1/me/groups/{id}/cover` field **`cover`**, **5MB** (not Figma 10MB). **`PATCH`/cover return 403** once owner archives the group.
4. **Join (Task 029D):** `POST /v1/groups/{id}/join`. PUBLIC → `ACTIVE`. PRIVATE_APPROVAL → `PENDING`. After `DECLINED` or `REMOVED`, rejoin is `PENDING`. **`ARCHIVED` groups return `403` on join/approve/decline/remove/role/transfer.** Voluntary `DELETE .../join` (leave/cancel) still works for non-owner members. Last owner cannot leave (`403`) — transfer first. Duplicate join while `PENDING` is idempotent. Repeat approve on already-ACTIVE request returns `200`. Use `membershipId` from join-requests list, not userId.
5. **Manage (`Screen 2`, Task 029C):** `GET /v1/me/groups/{id}/manage` → `memberCount`, `pendingRequestCount`, `visiblePostCount` (truthful only — no weekly deltas or “Live Synced”). Moderators may `PATCH` non-restricted fields; **privacy** and **memberCapacity** are **owner-only** (403 for mods). Approve/decline join requests with `membershipId` from join-requests list. Do not render verified badges, growth stats, or manage-timeline items without backend fields (`FIGMA_GROUPS_JOBS_PARITY_TASK029C.md`).
6. **Details (`Screen 15`):** `GET /v1/groups/{id}` is a summary. Posts, members, comments, likes, and chat require `canAccessContent: true`. Use generic `404` for unauthorized content — do not infer that the group is missing.
7. **Posts:** text `{ "body" }`. Optional `activityId` after attach. Task 016 photo/poll fields exist on post DTOs but stay **`photo: null`, `poll: null`** until server enables interactive media (see §18).
8. **Chat:** `GET /v1/me/group-chats` for Screen 16 group-thread previews. Send via `POST /v1/groups/{id}/chat/messages`. This is **not** `/v1/me/conversations`. Optional ephemeral typing via Socket.IO §14.5. No E2EE or online/presence counts.
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

## 16. Home dashboard, community feed & notifications (Task 013 / 025A)

**Status:** LIVE and verified on isolated Neon `strangeup_test`. **Stories remain DEFERRED** (D-06 provisional). Screen 08 has two Figma variants (original vs Community & Stories Update); backend returns a **superset** — treat `stories.status === "DEFERRED"` and empty arrays as hide rules until HOME-08 is decided (`docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025A.md`).

**Do not ship Figma claims:** 24h disappearing stories row, push badges, “142 Active Peers”, “Membership Active” / “Identity Verification Completed” unless backed by real APIs, geo “near you” miles/map, online/active-now indicators, verified badge fields on previews, or ML “Recommended For You”.

1. **Home (`Screen 08`):** `GET /v1/home` — single composition call. Use `myGroups`, `communityFeedPreview`, `upcomingGroupActivities`, `people`, `activities`, `featured`, `notificationsUnreadCount`. Render `stories.status === "DEFERRED"` as hidden/disabled (no client-side fake story data).
2. **Community feed:** `GET /v1/me/community-feed?cursor=&limit=&groupId=` — cross-group text posts only; optional `linkedActivity` public card (no meeting fields). Paginate with `meta.nextCursor`. Pins are **not** globally prioritized across groups.
3. **Notifications (`Html → Notification.pdf`):** `GET /v1/me/notifications` returns `{ notifications, unreadCount }`. Group Today/Earlier in Flutter by `createdAt`. `POST .../read` idempotent; `POST /v1/me/notifications/read-all` before “Mark all as read”.
4. **Navigation targets (IDs only — routes still enforce ACL):**

| `type` | Suggested screen |
|---|---|
| `MESSAGE_REQUEST_RECEIVED` | Message requests inbox |
| `MESSAGE_REQUEST_ACCEPTED` | `/v1/me/conversations` list |
| `DIRECT_MESSAGE_RECEIVED` | Conversation for `sourceId` |
| `GROUP_MEMBERSHIP_APPROVED` / `DECLINED` | Group detail `sourceId` |
| `ACTIVITY_RSVP_*` / `ACTIVITY_WAITLIST_PROMOTED` | Activity detail `sourceId` |
| `MEETUP_INVITATION_*` | Meetup detail `/v1/meetup-invites/{sourceId}` |

5. **Pull-only:** no WebSocket, FCM, or email from these endpoints.

```dart
final home = await http.get(
  Uri.parse('$baseUrl/v1/home'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
final unread = jsonDecode(home.body)['data']['notificationsUnreadCount'];
```

---

## 17. Store & jobs (Task 014)

**Status:** LIVE on isolated Neon `strangeup_test`. **Checkout, payment, tax, shipping, membership discounts, and employer delivery are NOT LIVE.**

**Screens:** 20 (marketplace grid), 21 (product detail), 22 (cart — subtotal only), 23 (jobs).

**Task 029 closure (029H):** Groups + Jobs backend is **complete within approved scope** — see `FIGMA_GROUPS_JOBS_PARITY_TASK029H_FINAL.md`. My Groups PDF is **UNVERIFIED** (**MDWQ-0910**). Group Details has two Figma variants — **MDWQ-0911**. Jobs **publish**, **employer delivery**, and extended application lifecycle (**029G**) are **not** implemented; queue IDs **0901**, **0902**, **0905** stay open.

**Do not ship Figma claims:** star ratings, member/club prices, “verified” merchant badges, saved payment cards, place order, shipping/pickup ETAs, miles/nearest jobs, official partner badges, applicant counts, or “application sent to employer” unless backend adds real delivery status.

1. **Store catalog:** `GET /v1/store/categories` then `GET /v1/store/products?category=cycling&q=&size=&color=&cursor=`. Empty product list is valid on fresh DBs. Product cards use `priceFromCents` + `currency` only — no ratings or member price fields.
2. **Product detail:** `GET /v1/store/products/{productId}` — variants include `stockQuantity` and `inStock`; images via `GET /v1/store/products/{productId}/images/{imageId}` when `primaryImageId` set.
3. **Favorites:** `PUT/DELETE /v1/me/store/favorites/{productId}`; list `GET /v1/me/store/favorites`.
4. **Cart (Task 024A):** `PUT /v1/me/store/cart/items/{variantId}` body `{ "quantity": n }` (0 removes). `GET /v1/me/store/cart` returns:
   - **`subtotalCents`** — fulfillable catalog value only (AVAILABLE lines at full qty; `INSUFFICIENT_STOCK` capped at on-hand stock; `UNAVAILABLE` excluded). **Not** tax/shipping/discount/checkout total.
   - **`linesSubtotalCents`** — display sum at requested quantities (`lineSubtotalCents` per line).
   - Per line: `availability` (`AVAILABLE` \| `INSUFFICIENT_STOCK` \| `UNAVAILABLE`), `availabilityReason`, `eligibleLineSubtotalCents`, `maxPurchasableQuantity`, server `unitPriceCents`.
   - **`summary`:** `allLinesPurchasable`, `hasInsufficientStock`, `hasUnavailableLines`, line counts.
   - **`pricingQuote` (024C):** `catalogSubtotalCents` mirrors fulfillable `subtotalCents`; membership/shipping/tax **`NOT_CONFIGURED`**; `totalDueCents` **null** — see §17.2.
   - **`fulfillment` / `orderReadiness` (024D):** methods **`NOT_CONFIGURED`**; `cartLinesOrderEligible` false when any line is not fully `AVAILABLE` — see §17.3.
   - **`checkout`:** `{ status: "UNAVAILABLE", reasonCode: "PAYMENT_AND_FULFILLMENT_NOT_CONFIGURED", ... }` — **disable Place Order** always in this release.
   - Read `subtotalDisclaimer` for user-facing copy. Matrix: `docs/product/FIGMA_MARKETPLACE_PARITY_TASK024A.md`.
5. **Jobs discovery (029F):** `GET /v1/jobs` — query params `q`, `employmentType`, `workMode`, `city`, `region`, `cursor`, `limit` (1–50). **`q` and `cursor` may be used together** (keyset pages stay within the active search). Invalid filter enums return **400**. Detail: `GET /v1/jobs/{jobId}`. Pay block includes `disclaimer` (self-reported). Saved: `GET /v1/me/saved-jobs`; `PUT/DELETE /v1/me/saved-jobs/{jobId}` (closed listings drop from saved list). Applications tab: `GET /v1/me/job-applications` (read-only; no new lifecycle in 029F). Parity: `FIGMA_GROUPS_JOBS_PARITY_TASK029F.md`.

### 17.3 Fulfillment & order readiness (Task 024D — no orders)

| Endpoint / field | Guidance |
|---|---|
| `GET /v1/store/fulfillment-policy` | `PHYSICAL_MERCHANDISE_ORDER` domain; methods `NOT_CONFIGURED`; activity pickup **spec** only |
| Cart `fulfillment` | No method selection; `selectedMethod` always **null** |
| Cart `orderReadiness` | Use `cartLinesOrderEligible` before any future Place Order; if **false**, show blocked lines — **do not** cap qty silently |
| Checkout | Still **`UNAVAILABLE`** — no order POST, no reservation |

Doc: `docs/product/STORE_FULFILLMENT_ORDER_ARCHITECTURE_TASK024D.md`.

### 17.2 Store pricing & Club merchandise contract (Task 024C — no live discounts)

**Canonical model:** `LIST_PRICE_PLUS_SINGLE_CART_DISCOUNT` — catalog `priceCents` is list price; future Club benefit is **one** cart-level adjustment, never line member prices **plus** a second discount row.

| Endpoint | Use |
|---|---|
| `GET /v1/store/pricing-policy` | Machine-readable policy; all components `NOT_CONFIGURED` except checkout `UNAVAILABLE` |
| `GET /v1/store/products` | `pricingHint.membershipPriceStatus` — always `NOT_CONFIGURED` today |
| `GET /v1/store/products/{id}` | `variants[].pricing` (`listUnitPriceCents`, `memberUnitPriceCents: null`); `merchandisePricingPolicy` |
| `GET /v1/me/store/cart` | `pricingQuote` alongside 024A `subtotalCents`; `totalDueCents` always **null** |

**Do not render:** Figma Club jersey/flask prices, extra “Club discount” line, free-shipping progress, tax/shipping/total due until backend returns `APPLIED` / non-null amounts with owner-approved D-08/MKT-03.

Contract doc: `docs/product/STORE_PRICING_CLUB_CONTRACT_TASK024C.md`.

### 17.1 Store catalog management (Task 024B — staff / future Admin Panel only)

**Not a mobile consumer feature.** Flutter **buyer** app continues to use §17 catalog/cart/favorites only.

| Item | Guidance |
|---|---|
| Activation | Backend `STORE_CATALOG_MANAGEMENT_ENABLED` (default **false**); production stays off until owner MKT-01/02 |
| Auth | Separate staff role **`STORE_CATALOG_MANAGER`** — identity reviewers **cannot** manage catalog |
| API prefix | `/v1/admin/store-catalog/*` (Bearer staff session) |
| Media | Ingest via staff `POST .../images`; buyers still load `GET /v1/store/products/{id}/images/{imageId}` when published |
| Checkout | Still **`UNAVAILABLE`** — no operator “place order” |
| Badges/reviews | Not in API — do not fabricate Official/Verified or star ratings |

Operator contract detail: `docs/operations/STORE_CATALOG_MANAGEMENT_TASK024B.md`, `openapi/admin.yaml`.
6. **Apply:** `POST /v1/jobs/{jobId}/applications` with `coverMessage` + `applicationConsentVersion` (non-empty string until counsel publishes IDs). Response includes `employerDelivery.status === "NOT_CONFIGURED"` — show in-app tracking only.
7. **My applications:** `GET /v1/me/job-applications` and `GET /v1/me/job-applications/{applicationId}`.
8. **Job drafts (optional employer prep):** `POST/PATCH/GET /v1/me/job-listings` — **DRAFT only**; never appears in `GET /v1/jobs` until a future trusted publisher exists.

```dart
final cart = await http.get(
  Uri.parse('$baseUrl/v1/me/store/cart'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
final checkout = jsonDecode(cart.body)['data']['checkout'];
assert(checkout['status'] == 'UNAVAILABLE');
```

---

## 18. Group stories, photo posts & polls (Task 016)

**Status:** **IMPLEMENTED BUT DISABLED** by default (`GROUP_COMMUNITY_INTERACTIVE_ENABLED=false`, D-06 provisional). **Not LIVE** for production UI until owner approves `docs/decisions/D-06-COMMUNITY-MEDIA-TASK016.md`. Home **`GET /v1/home` → `stories.status: DEFERRED`** unchanged.

1. **Gate handling:** Interactive routes return `403` with `error.code === "FEATURE_DISABLED"`. Hide Photo/Poll/Story composer actions unless a future capabilities endpoint or owner flag says otherwise — do **not** treat HTTP 403 as a crash.
2. **Photo post (when enabled):** `POST /v1/groups/{groupId}/posts/{postId}/media` multipart field **`image`**. Display via authenticated `GET .../media/{mediaId}` (private cache). Post list includes `photo: { mediaId, contentPath }` when enabled.
3. **Poll (when enabled):** `POST .../poll` with ISO `closesAt` and 2–6 distinct options. Vote `PUT .../poll/vote` `{ optionId }` once. Render counts from server; never show other voters’ identities.
4. **Group stories (when enabled):** `POST /v1/groups/{groupId}/stories` with **`image`**. List `GET .../stories`. Media `GET .../stories/{storyId}/media` — treat `404` after 24h as expired. **Do not** build personal “Your Story” until D06-04 is approved.
5. **Reports:** `POST /v1/groups/{groupId}/content-reports` with bounded `reason` enum. Moderators list OPEN reports at `GET` same path prefix.
6. **Still deferred:** push fanout, view receipts, public story discovery on Home, production object storage, automated expiry cron, platform trust badges.

---

## 19. Membership plans & entitlements (Task 017 / 026A, Screen 18)

**Status:** **LIVE** read-only catalog + **`flow`** contract. **All payment/subscription billing DEFERRED** (owner 2026-10-28). Physical store checkout remains **UNAVAILABLE** (MKT-03).

1. **Load plans:** `GET /v1/membership/plans` — `plans[]` + `flow` (billing/checkout **DEFERRED**, interval selector honest states).
2. **Current tier:** `GET /v1/me/membership` — server default **`BASIC`/`FREE`**; duplicate `flow` for screen-local use.
3. **Settings hub:** `membership` summary; `capabilities.membershipPlanCatalog: LIVE`; `capabilities.subscription: DEFERRED`.
4. **Do not bind:** Figma `$6.49` vs `$9.99` contradiction, trials, tax lines, Club badge, or marketplace member pricing.
5. **KYC unchanged:** Task 022 home access + `identityVerificationStatus` — independent of plan tier.

**Parity matrix:** `docs/product/FIGMA_MEMBERSHIP_PARITY_TASK026A.md`

See Screen 18 binding bullets under §9 settings hub (item 8).

---

## 14.8 Task 023 Header Flow — release blockers (023E)

**Parity matrix:** `docs/product/FIGMA_HEADER_FLOW_PARITY_TASK023.md`.

Do **not** ship production Header messaging/notifications push claims until:

1. Owner enables **`PUSH_ENABLED`** and Firebase credentials (backend still fail-closed in production until authorized).  
2. **Full Neon regression** and security review complete (023E ran **focused** integration only).  
3. **Socket.IO Redis adapter** if you need multi-instance realtime (default single-node).  
4. **Staff suspend/deactivate API** is product-approved and calls backend side effects (hook: `applyAccountRestrictionSideEffects`; periodic socket recheck covers DB-only suspension in tests).  
5. Deferred Figma items stay hidden: meetup invitation cards, owner group invites, verified group badge, miles/GPS, E2EE, chat photos, presence, billing/membership push cards.

---

## Change log

| Date | Summary |
|---|---|
| 2026-10-29 | Task **030** — backend completion audit: header/§2/§11 reconciled with **`CURRENT_APIS.md`** (178 LIVE REST routes; no undocumented mobile routes); release blockers unchanged — see `docs/plans/TASK_030_BACKEND_COMPLETION_AUDIT_REPORT.md` |
| 2026-10-29 | Task **027I** closure — §10 activities inventory/hybrid join/roster/privacy; §13A meetup separation; MDWQ-0718 saved-count note; parity `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027I_FINAL.md` |
| 2026-10-27 | Handoff sync — source-of-truth table, feature flags, consent flow; KYC §3/§12 aligned with Task 021 + `CURRENT_APIS.md` |
| 2026-10-27 | Task 021 — canonical consent + verification routes (provider usually disabled); see §12 table |
| 2026-10-27 | Task 017 — membership catalog + self entitlements; §19; D-08 billing deferred |
| 2026-10-27 | Task 016 — group photo/poll/story/report APIs behind D-06 flag; §18; Home stories still DEFERRED |
| 2026-10-27 | Task 015 — settings overview, saved activities, sessions, email change (DEV_ONLY), deletion impact; §9 Screen 26 |
| 2026-10-28 | Task 024D — fulfillment policy + cart `orderReadiness` / `fulfillment`; no order tables or placement |
| 2026-10-28 | Task 024C — merchandise pricing policy + cart `pricingQuote`; list+single-discount model; discounts NOT_CONFIGURED |
| 2026-10-28 | Task 024B — staff store catalog admin APIs + S3/local product media; §17.1; buyer routes unchanged |
| 2026-10-28 | Task 024A — cart subtotal integrity (`linesSubtotalCents`, line availability reasons, fulfillable `subtotalCents`); §17; checkout still UNAVAILABLE |
| 2026-10-29 | Task **029H** — Task 029 Groups & Jobs **complete within approved scope**; consolidated parity `FIGMA_GROUPS_JOBS_PARITY_TASK029H_FINAL.md`; My Groups Figma **UNVERIFIED** (**MDWQ-0910**); Jobs publish/employer delivery **not LIVE** |
| 2026-10-29 | Task **029F** — Jobs `GET /v1/jobs` documents `q`+`cursor` composition; Screen 23 parity `FIGMA_GROUPS_JOBS_PARITY_TASK029F.md`; no new routes |
| 2026-10-27 | Task 014 — store catalog/cart/favorites + jobs discovery/applications/drafts; §17; checkout & employer delivery deferred |
| 2026-10-27 | Task 013 — home dashboard, community feed, in-app notifications; §16; stories deferred |
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
