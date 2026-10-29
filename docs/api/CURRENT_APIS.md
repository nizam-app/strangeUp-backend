# StrangeUp Backend — Currently Implemented APIs

**Last updated:** 2026-10-29 (Task **027I** activities closure; Task **028H** meetup **READY_FOR_OWNER_REVIEW**; Task **030** source audit — **178 LIVE REST routes** in `src/` match this doc; admin + webhook included)
**Maintainers:** Update this file in the **same change** as any API implementation, modification, or removal. See `AGENTS.md`.

**Flutter integration:** Pair with `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`. **This file wins** on route existence and HTTP shapes; handoff wins on product gating and DEFERRED UX.

| Status | Meaning |
|---|---|
| **LIVE** | Routed in `src/` and covered by tests or OpenAPI where noted |
| **DEV_ONLY** | Implemented but relies on dev email stub / not production-ready delivery |
| **PLANNED** | Contract draft only — not implemented |

**Base URL (local):** `http://localhost:3000` (default `PORT` from env)
**Product API prefix:** `/v1`

**OpenAPI:** `openapi/foundation.yaml` (health), `openapi/identity.yaml` (auth + self account/profile), `openapi/settings.yaml` (Task 015), `openapi/activities.yaml` (Task 010), `openapi/social.yaml` (Task 011), `openapi/meetup-invites.yaml` (Task 028D), `openapi/groups.yaml` (Task 012), `openapi/group-content.yaml` (Task 016), `openapi/messaging-realtime.yaml` (Task 023B Socket.IO), `openapi/push-devices.yaml` (Task 023C), `openapi/home.yaml` (Task 013), `openapi/notifications.yaml` (Task 013), `openapi/store.yaml` (Task 014), `openapi/jobs.yaml` (Task 014), `openapi/membership.yaml` (Task 017), `openapi/admin.yaml` (Task 022B identity review + 024B store catalog staff)

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

## Flutter quick index (LIVE routes by app area)

| App area | Primary prefixes / paths | Section below |
|---|---|---|
| Health / ops | `/health/live`, `/health/ready` | Health |
| Auth & session | `/v1/auth/*` | Auth |
| Account, profile, settings, saved | `/v1/me/*` | Self account & profile; Settings hub |
| Legal consent | `/v1/consents/required` | Consent registry |
| KYC (ops-gated) | `/v1/me/verification/*`, webhook N/A for mobile | Identity verification |
| Interests | `/v1/interests`, `/v1/me/interests` | Profile interests |
| Discover & profiles | `/v1/discover/*`, `/v1/users/*` | Discovery & public profiles |
| Activities | `/v1/activities/*`, `/v1/me/activities/*`, categories | Activities & meetups |
| Social & DM | `/v1/users/*` (follow, wave, messages) | Social connections |
| Personal meetup invites | `/v1/meetup-invites` | Personal meetup invitations (028D–028G) |
| Groups | `/v1/groups/*`, `/v1/me/groups/*`, categories | Groups & communities |
| Home & feed | `/v1/home`, `/v1/me/community-feed` | Home dashboard |
| Notifications | `/v1/me/notifications/*` | In-app notifications |
| Store | `/v1/store/*`, `/v1/me/store/*` | Store |
| Jobs | `/v1/jobs/*`, `/v1/me/jobs/*`, applications | Jobs |
| Membership | `/v1/membership/plans`, `/v1/me/membership` | Membership plans |

**Not in table:** routes under **PLANNED** at end of doc; Task 016 group media routes require `GROUP_COMMUNITY_INTERACTIVE_ENABLED=true` (default off).

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

**Validation:** email format; password ≥8 with letter + number; `dateOfBirth` as `YYYY-MM-DD` (UTC calendar, leap-day safe); **not in the future**; **USA launch 18+**; all three consent types required. Each consent `version` must match the server canonical registry (`GET /v1/consents/required`). **`CONSENT_ENFORCEMENT=strict`** (production default) rejects registration until counsel publishes **ACTIVE** version IDs; dev/test may use **`placeholder_allowed`** for engineering placeholders only.

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

**Delivery:** `dev_stub` logs/captures only. `disabled` fail-closes with challenge rollback. `provider` hands off to **Resend** (`handed_to_provider` ≠ inbox delivery). Requires `RESEND_API_KEY`, `TRANSACTIONAL_EMAIL_FROM`, and `PUBLIC_APP_BASE_URL` in production.

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

**Delivery:** dev stub only in non-production — link from `PUBLIC_APP_BASE_URL` when set; raw token only when dev stub fallback is allowed. Production without provider: enumeration-safe `202` but no challenge persisted if transport fails closed.

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
| `GET` | `/v1/me/onboarding/status` | `canAccessAccount` | Onboarding / activation summary (`onboardingPhase`, `homeAccessAllowed`, `nextAction`, admin + IDV dimensions) — Task 022A/022B |
| `GET` | `/v1/me/account` | `canAccessAccount` (pending or active; not suspended/deleted) | Private account status DTO |
| `GET` | `/v1/me/profile` | `canAccessAccount` | Own profile (read-only birthDate) |
| `PATCH` | `/v1/me/profile` | `canEditProfile` (verified email + age eligible + not suspended) | Narrow field allowlist |
| `POST` | `/v1/me/password-change` | `canChangePassword` (same as account read) | Verify current password; set new hash; revoke all sessions |
| `GET` | `/v1/interests` | `canAccessAccount` | Canonical 10-option catalog (metadata; not user selections) |
| `GET` | `/v1/me/interests` | `canAccessAccount` | Own selected interests (private; catalog sort order) |
| `PUT` | `/v1/me/interests` | `canEditProfile` | Atomically replace own selection (0–10 catalog slugs) |
| `GET` | `/v1/me/favorite-activities` | `canAccessAccount` | Own favorite-activity **preference** pins (private) |
| `PUT` | `/v1/me/favorite-activities` | `canEditProfile` | Replace 0–5 preference pins (Task 008 — semantics pending owner sign-off) |
| `POST` | `/v1/me/profile/avatar` | `canEditProfile` | Multipart upload (`avatar` field); local disk in dev |
| `GET` | `/v1/me/profile/avatar` | `canAccessAccount` | Own avatar bytes (`Content-Type` from stored metadata) |
| `DELETE` | `/v1/me/profile/avatar` | `canEditProfile` | Remove avatar file + metadata |

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
    "username": "string | null",
    "bio": "string | null",
    "scheduleTimeZone": "string | null",
    "profileVisibility": "EVERYONE | VERIFIED_USERS_ONLY",
    "locationCity": "string | null",
    "locationRegion": "string | null",
    "hasAvatar": false,
    "avatarUpdatedAt": "ISO-8601 | null",
    "birthDate": "YYYY-MM-DD"
  },
  "meta": { "requestId": "..." }
}
```

**Tests:** `tests/integration/me.integration.test.ts`; Task 008 fields in `tests/integration/own-profile.integration.test.ts` (native DB gate).

---

#### `PATCH /v1/me/profile`

**Request:** partial JSON, **strict** allowlist only:

- `firstName`, `lastName`, `displayName` (max 80 / 80 / 120)
- `username` — optional; **3–30** chars; `[a-z0-9_]` only; `null` clears; omitted = no change; global case-insensitive uniqueness (`409 CONFLICT` if taken)
- `bio` (max **300** characters on write — **D-BIO-MAX**); legacy stored bios **>300** may still appear on `GET` until the user submits a shorter bio
- `scheduleTimeZone` (valid IANA zone, max 64)
- `profileVisibility` — `EVERYONE` or `VERIFIED_USERS_ONLY` (stored; **new profiles default `VERIFIED_USERS_ONLY`** per OWN-PROFILE-02; **not** enforced on public APIs until D-03)
- `locationCity`, `locationRegion` — optional text (max **80** each); `null` clears; **no** geo coordinates or location-verification flag

Unknown keys → `VALIDATION_ERROR` 400. Cannot set `birthDate`, `accountStatus`, `emailVerified`, roles, or ids via body. **`firstName` / `lastName` rejected with `403 AUTH_FORBIDDEN` when `legalNameLocked` is true** (sticky after trusted KYC and/or staff identity approval audit — Tasks 025D/025E). Response includes `legalNameLocked` on `GET`/`PATCH`. Username does not affect KYC, membership, or social access.

Suspended accounts: existing access tokens are rejected at auth (`401`, see I-N04); login returns `403 AUTH_FORBIDDEN`.

**Response 200:** same shape as `GET /v1/me/profile`.

**Errors:** `AUTH_FORBIDDEN` 403 when pending/unverified; `VALIDATION_ERROR` 400; `CONFLICT` 409 when username is taken.

**Tests:** `tests/integration/me.integration.test.ts` (I-P07, mass-assignment rejection).

---

### Profile interests (`/v1/interests`, `/v1/me/interests`)

**Source:** `src/modules/interests/*`, migration `20261027120000_profile_interests`  
**Policy:** Catalog browse and self-read use `canAccessAccount`; writes use `canEditProfile` (same gate as `PATCH /v1/me/profile`). Selections are **never** exposed on public or cross-user APIs (D-03 unchanged).

**Catalog slugs (owner-approved Task 007):** `biking`, `fitness`, `outdoor`, `social`, `sports`, `swimming`, `hiking`, `travel`, `music`, `food`.

#### `GET /v1/interests`

**Response 200:**

```json
{
  "data": {
    "interests": [
      { "slug": "biking", "label": "Biking" },
      { "slug": "fitness", "label": "Fitness" }
    ]
  },
  "meta": { "requestId": "..." }
}
```

Returns all **10** options ordered by `sortOrder`. Custom/free-text interests are **not** supported.

**Tests:** `tests/integration/interests.integration.test.ts` (T007-P01).

---

#### `GET /v1/me/interests`

**Response 200:** same `data.interests` shape; empty array when none selected. Order follows catalog `sortOrder`.

**Tests:** `tests/integration/interests.integration.test.ts` (T007-P02, T007-P03).

---

#### `PUT /v1/me/interests`

**Request:**

```json
{ "interests": ["biking", "music", "travel"] }
```

**Rules:** strict body; `interests` required array of catalog slugs; max **10**; no duplicates; unknown/uppercase/extra keys → `VALIDATION_ERROR` **400** with **no** partial write. Empty array clears selection. Replacement semantics (not append). Response lists selections in **request order**.

**Response 200:**

```json
{
  "data": {
    "interests": [
      { "slug": "biking", "label": "Biking" },
      { "slug": "music", "label": "Music" },
      { "slug": "travel", "label": "Travel" }
    ]
  },
  "meta": { "requestId": "..." }
}
```

**Errors:** `AUTH_FORBIDDEN` 403 when pending/unverified (same as profile PATCH); `VALIDATION_ERROR` 400 for malformed payloads. Concurrent PUTs for the same user serialize on the user row (`FOR UPDATE`); **last completed write wins** (both may return 200).

**Tests:** `tests/interests.validation.test.ts`; `tests/integration/interests.integration.test.ts` (T007-P02, T007-N01, T007-S01, T007-C01).

---

### Own profile extensions (Task 008)

**Policy:** Owner decisions **APPROVED** in `docs/decisions/D-OWN-PROFILE-REMAINING-REQUEST-task008.md` (Task **008A** reconciliation). Native integration verification status in `docs/plans/STATUS.md`.

**Source:** migrations `20261027140000_own_profile_extensions`, `20261027153000_profile_visibility_default_verified`; `src/modules/favorite-activities/*`, `src/modules/profile-media/*`; profile fields on `PATCH/GET /v1/me/profile`.

#### `GET` / `PUT /v1/me/favorite-activities`

**PUT request:**

```json
{
  "favoriteActivities": [
    {
      "title": "Pickleball",
      "skillLevel": "INTERMEDIATE",
      "cadence": "WEEKLY",
      "scheduleNote": "Sat 10am",
      "placeLabel": "Rec center"
    }
  ]
}
```

**Rules:** strict body; 0–**5** items; `skillLevel` ∈ `BEGINNER` | `INTERMEDIATE` | `ADVANCED`; `cadence` ∈ `WEEKLY` | `CASUAL`; optional `scheduleNote` / `placeLabel` (max 120). Replacement semantics; empty array clears. **Private** to self APIs (not discovery/public profile).

**Tests:** `tests/favorite-activities.validation.test.ts`; `tests/integration/own-profile.integration.test.ts` (T008-P02, T008-S01).

#### Profile avatar (`/v1/me/profile/avatar`)

**POST:** `multipart/form-data` with field name **`avatar`**; JPEG/PNG/WebP; max **5 MiB** upload. Server **decodes from bytes** (does not trust filename/declared MIME), rejects SVG/corrupt payloads, re-encodes to strip EXIF/GPS, and bounds dimensions/pixel count before write. Storage: **`MEDIA_STORAGE_BACKEND=local`** (default, `PROFILE_UPLOAD_DIR`) or **`s3`** (private bucket; server-side GET after auth — no public object URLs in DTOs). Production requires `s3` or non-`.data` local paths; live bucket activation is owner-gated (`docs/operations/MEDIA_OBJECT_STORAGE.md`).

**GET:** re-encoded image bytes (`Cache-Control: private, no-store`); `404` when no avatar.

**DELETE:** clears DB metadata then removes file (best-effort); `200` with `{ hasAvatar: false, ... }`.

**Tests:** `tests/avatar-image-processor.test.ts`, `tests/local-avatar-storage.test.ts`; `tests/integration/own-profile.integration.test.ts` (T008-P03, T008A-P02).

---

### Discovery & public profiles (Task 009 — D-03/D-04 MVP)

**Policy:** `docs/decisions/D-03-public-profile-discovery-mvp.md`, `docs/decisions/D-04-location-discovery-mvp.md`  
**Status:** **LIVE in source**; DB integration verification **pending** native PostgreSQL (same gate as Tasks 006–008A).

**Viewer gate (all routes below):** Bearer token; viewer must satisfy `hasFullAccountAccess` → else `403 AUTH_FORBIDDEN`. Unauthenticated → `401`.

**Target gate (Task 025B):** Main-app **activated** users only (`isDiscoverablePublicProfileTarget` — same bar as Task 022 Home); then `profileVisibility` + viewer KYC for `VERIFIED_USERS_ONLY`; bidirectional blocks → generic `404` on detail/avatar. Hidden/blocked/non-activated users omitted from lists.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/discover/people` | Paginated discoverable people (preview DTO) |
| `GET` | `/v1/users/:userId` | Public profile detail |
| `GET` | `/v1/users/:userId/avatar` | Authorized avatar bytes |
| `POST` | `/v1/me/blocks` | Block user `{ "targetUserId": "uuid" }` |
| `DELETE` | `/v1/me/blocks/:targetUserId` | Unblock (idempotent) |
| `GET` | `/v1/me/blocks` | Self block list (IDs + timestamps) |

#### `GET /v1/discover/people`

**Query (strict):** `limit` (default **20**, max **50**), `cursor` (opaque), optional `q` (displayName/username contains, max 80), `city`, `region` (exact case-insensitive match), `interest` (catalog slug — unknown slug → `400`).

**Response 200:**

```json
{
  "data": {
    "people": [
      {
        "userId": "uuid",
        "displayName": "string | null",
        "username": "string | null",
        "hasAvatar": true,
        "locationCity": "string | null",
        "locationRegion": "string | null"
      }
    ]
  },
  "meta": { "requestId": "...", "nextCursor": "string | null" }
}
```

No total counts. Order: `createdAt` asc, `id` asc.

#### `GET /v1/users/:userId`

**Public allowlist:** `userId`, `displayName`, `username`, `bio`, `hasAvatar`, `memberSince`, `locationCity`, `locationRegion`, `interests[]` (`slug`, `label` catalog order), plus Task 011 `followerCount`, `followingCount`, `viewerFollows`, `conversationId`.

**Never returned:** email, phone, `birthDate`, account/KYC fields, `profileVisibility`, timezone, favorite activities, storage keys.

#### `GET /v1/users/:userId/avatar`

Same authorization as profile GET; sanitized bytes; `Cache-Control: private, no-store`.

**Tests:** `tests/public-profile-policy.test.ts`, `tests/discover-query.test.ts`, `tests/discover-target-policy.test.ts`; `tests/integration/discovery.integration.test.ts` (T009 + T025B-P01/P02).

**Deferred (Figma but not Task 009):** map, distance/radius, online presence. Follow/Wave/Message and DB-backed counts are Task 011.

---

### Activities & meetups (Task 010 — Screens 11–13)

**Policy:** KYC-01/03/05, KYC-ENF-01..05, D-03/D-04 host preview, `docs/decisions/D-ACTIVITIES-TASK010.md`  
**Status:** **LIVE in source**; DB integration verification **pending** native PostgreSQL (same credential gate as Tasks 006–009).  
**OpenAPI:** `openapi/activities.yaml`

**Viewer/host gate:** Bearer token; `hasFullAccountAccess` or `403 AUTH_FORBIDDEN`. Unauthenticated → `401`.

**KYC:** Browse/list/detail do **not** require KYC. Real-world (`IN_PERSON`/`HYBRID`) **publish** and **confirmed RSVP** require current trusted `identityVerificationStatus === APPROVED`. Production **fails closed** unless `KYC_PROVIDER_ENABLED=true` (no provider is integrated). Virtual-only publish/join is KYC-exempt. Waitlist entry at full capacity does not require KYC; promotion rechecks KYC and will **hold the queue** (no skip) if the head is ineligible.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/activity-categories` | Managed activity catalog (not profile Interests) |
| `GET` | `/v1/activities` | Published public upcoming list; hosts must be main-app activated (025C); cursor pagination; `q` on title or host name; category/city/region/date/mode filters; **no geodistance** |
| `GET` | `/v1/activities/:activityId` | Public-safe detail (no meeting instructions) |
| `GET` | `/v1/activities/:activityId/cover` | Authorized cover bytes when `hasCover` |
| `GET` | `/v1/activities/:activityId/participants` | Task 027F — **CONFIRMED-only** attendee roster; **host** (manage-eligible) or **CONFIRMED** participant; D-03 previews; `preview=true` caps page size for avatar stack; cursor pagination; **404** if unauthorized (no IDOR) |
| `GET` | `/v1/activities/:activityId/meeting` | Host or eligible confirmed participant; non-host **404** if host not discoverable (027C) |
| `POST` | `/v1/activities/:activityId/rsvp` | **AUTO:** instant CONFIRMED or FIFO WAITLISTED (010). **HOST_APPROVAL:** creates **PENDING** (no meeting access); **404** when host not discoverable (025C); idempotent for CONFIRMED/WAITLISTED/PENDING |
| `DELETE` | `/v1/activities/:activityId/rsvp` | Leave or withdraw PENDING (idempotent); confirmed leave may promote FIFO-eligible waitlist head |
| `GET` | `/v1/me/activities/:activityId/join-requests` | Host-only pending/declined/approved-waitlist applicants (`status=pending\|declined\|waitlisted`); minimal D-03 profile |
| `POST` | `/v1/me/activities/:activityId/join-requests/:userId/approve` | Host approve PENDING → CONFIRMED or approved WAITLISTED; **409** if full and waitlist off |
| `POST` | `/v1/me/activities/:activityId/join-requests/:userId/decline` | Host decline PENDING → DECLINED (idempotent) |
| `POST` | `/v1/me/activities` | Create **DRAFT** |
| `GET` | `/v1/me/activity-inventory` | Task 027B/027E — tabbed My Activities (`view=upcoming\|hosting\|joined\|waitlisted\|pending\|past`, optional `includeCounts`); **public cards only** |
| `GET` | `/v1/me/activities` | Host list (drafts/published/cancelled); optional `when=upcoming\|past\|all` |
| `GET` | `/v1/me/activities/:activityId` | Host detail including private meeting fields |
| `PATCH` | `/v1/me/activities/:activityId` | Host-only allowlisted edits |
| `POST` | `/v1/me/activities/:activityId/publish` | Host publish |
| `POST` | `/v1/me/activities/:activityId/cancel` | Host cancel; remaining RSVPs marked cancelled |
| `POST` | `/v1/me/activities/:activityId/cover` | Multipart field **`cover`** (same image hardening as avatars) |
| `GET` | `/v1/me/activities/:activityId/cover` | Host cover bytes (including drafts) |
| `DELETE` | `/v1/me/activities/:activityId/cover` | Clear cover |
| `GET` | `/v1/me/activity-rsvps` | Self confirmed/waitlisted summaries; optional `when`, `participation=confirmed\|waitlisted\|active` |

#### Public activity card / detail

**Card allowlist:** `activityId`, `title`, `category{slug,label}`, `hasCover`, `startsAt`, `endsAt`, `timeZone`, `mode`, `status`, `venueName`, `locationCity`, `locationRegion`, `capacity`, `confirmedCount`, `spotsLeft`, `waitlistEnabled`, `joinMode` (`AUTO` \| `HOST_APPROVAL`), `host` (Task 009 preview; hidden/nulled when D-03 denies).

**Detail adds:** `description` (max 500 on write), `skillNotes`, `gearNotes`, `audience`, `myParticipation` (`state`, `waitlistPosition`, `joinMode`, `participationStatus`, `requestedAt`, `hostApprovedAt`), `meetingAvailable`.

**Host detail adds:** `hostParticipationSummary` — `pendingRequestCount`, `confirmedSeatCount`, `approvedWaitlistedCount`, `declinedRequestCount` (Task 027E; do not mirror contradictory Figma Join Requests numbers — MDWQ-0712).

**Draft create/patch:** optional `joinMode` (`AUTO` default); **locked after publish** (**409** if changed).

**Never on public list/detail:** `meetingInstructions`, `virtualMeetingDetails`, storage keys, attendee identities, coordinates, ratings, “verified” counts.

**List query (strict):** `limit` (default **20**, max **50**), `cursor`, optional `q` (title contains, max 80), `category` (catalog slug), `city`, `region`, `mode`, `startsAfter`, `startsBefore` (ISO-8601). Default `startsAt >= now`. Order: `startsAt` asc, `id` asc. Bidirectional host blocks omit the activity (`404` on detail).

#### Create draft (`POST /v1/me/activities`) → `201`

```json
{
  "title": "Morning ride",
  "description": "optional, max 500",
  "category": "biking",
  "startsAt": "2030-06-15T14:00:00.000Z",
  "endsAt": "2030-06-15T16:00:00.000Z",
  "timeZone": "America/New_York",
  "mode": "IN_PERSON",
  "audience": "PUBLIC",
  "venueName": "Bayfront Park",
  "locationCity": "Miami",
  "locationRegion": "FL",
  "meetingInstructions": "private until join",
  "virtualMeetingDetails": "required to publish VIRTUAL/HYBRID",
  "skillNotes": "optional",
  "gearNotes": "optional",
  "capacity": 8,
  "waitlistEnabled": true
}
```

`endsAt` must be after `startsAt`. `audience=FOLLOWERS_ONLY` may be stored on a draft but **cannot be published**. In-person/hybrid publish requires venue name + city and host KYC. Virtual/hybrid publish requires `virtualMeetingDetails`.

**Publish errors:** `IDENTITY_VERIFICATION_REQUIRED` 403 (real-world, no current trusted KYC); `VALIDATION_ERROR` 400 (missing venue/virtual details, past start, followers-only).

**RSVP errors:** `IDENTITY_VERIFICATION_REQUIRED` 403 when a real-world seat is open and the caller is not KYC-approved; `CONFLICT` 409 when full and waitlist is off; `404` when hidden/blocked/not published; idempotent `200` if already confirmed or waitlisted.

**Tests:** `tests/activity.validation.test.ts`, `tests/activity-policy.test.ts`, `tests/activity.dto.test.ts`, `tests/activity-query.test.ts`, `tests/activity-cover-storage.test.ts`; `tests/integration/activities.integration.test.ts` (native DB gate).

**Deferred:** maps/distance, Followers-only publish, attendee roster, check-in, invitations, payments, two-hour edit lock, production cover storage.

---

### Personal meetup invitations (Task 028D–028H)

**Policy:** D-28 (accepted foundation); independent of Activity RSVP / Task 027E.  
**Product gate:** Backend **READY_FOR_OWNER_REVIEW** (`TASK_028H_FINAL_VERIFICATION_REPORT.md`); settings `capabilities.meetupInvites` remains **DEFERRED** until owner LIVE sign-off.  
**OpenAPI:** `openapi/meetup-invites.yaml`  
**Gate:** Bearer + **Task 022** `hasHomeAccess` on router. Sender **KYC** required on create; recipient **KYC** required on **accept**. Recipient must be discoverable + D-03 visible; blocks → generic `404`.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/meetup-invites` | Create `PENDING` invite; optional `Idempotency-Key` header |
| `GET` | `/v1/meetup-invites` | Inbox/outgoing list; `box`, `status`, cursor pagination |
| `GET` | `/v1/meetup-invites/:inviteId` | Detail for sender or recipient only |
| `POST` | `/v1/meetup-invites/:inviteId/accept` | Recipient: `PENDING` → `ACCEPTED` (idempotent **200**) |
| `POST` | `/v1/meetup-invites/:inviteId/decline` | Recipient: `PENDING` → `DECLINED` |
| `POST` | `/v1/meetup-invites/:inviteId/withdraw` | Sender: `PENDING` → `WITHDRAWN` |

**Create body:** `recipientUserId`, `meetupType` (`COFFEE` \| `ACTIVITY` \| `SPORTS` \| `OTHER`), `title`, `scheduledStartsAt` (ISO UTC), `scheduleTimeZone` (IANA), `venue` `{ city, region, label?, addressLine?, placeNotes? }`, optional `note` (max 200).

**Mutations:** Empty body. Lazy expiry applied before transition. Both participants re-checked for Task 022 activation at mutation time. Repeat same terminal action → **200**; conflicting terminal action → **409** `CONFLICT`. Row lock + conditional `updateMany` on `PENDING` for concurrency. Sets `acceptedAt` / `declinedAt` / `withdrawnAt`. No Activity RSVP, DM, or group side effects.

**List:** `counts.pending` for **incoming** box only (actionable PENDING). No notification read/unread on invite rows (use `/v1/me/notifications` when 028G ships). List cards **never** include `addressLine` / precise venue fields.

**Detail venue:** Recipient sees city/region until `ACCEPTED` (including on accept response); sender always sees submitted venue. Lazy **EXPIRED** persisted on list/detail/mutations when `scheduledStartsAt` passed.

**Errors:** `409` pending duplicate per ordered pair; `409` idempotency payload mismatch; `409` not actionable; `403` wrong actor / KYC / participant ineligible.

**Notifications (028G):** On create / accept / decline / withdraw, persists `UserNotification` (+ push outbox when enabled). Types: `MEETUP_INVITATION_RECEIVED|ACCEPTED|DECLINED|WITHDRAWN`. Generic copy only; `sourceId` = invite id. Preference: `meetupInvitesEnabled` (default true) on `GET/PATCH /v1/me/notification-preferences`. Mark read via `/v1/me/notifications` — independent of invite status.

**Deferred (028F+):** Reschedule; post-accept cancellation; rate-limit env quotas; settings `capabilities.meetupInvites` remains **DEFERRED** until 028H owner sign-off.

**Tests:** `tests/meetup-invite-*.test.ts`; integration bundle through **028H** (`meetup-invite-schema-028c`, `028d`, `028e`, `028g-notifications`, `028h-final`).

---

### Social connections & 1:1 messaging (Task 011)

**Policy:** D-03/D-04 target visibility, bidirectional blocks, `docs/decisions/D-SOCIAL-TASK011.md`  
**Status:** **LIVE in source**; DB integration verification **pending** native PostgreSQL.  
**OpenAPI:** `openapi/social.yaml`

**Gate:** Bearer token; `hasFullAccountAccess` or `403`. Hidden/blocked/ineligible targets → generic `404`. Self-target → `400`. No KYC required for ordinary chat. `VERIFIED_USERS_ONLY` targets still require trusted KYC `APPROVED` to start a **new** follow/wave/request.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/users/:userId/follow` | Follow; idempotent `200` `{ following, targetUserId }` |
| `DELETE` | `/v1/users/:userId/follow` | Unfollow; idempotent |
| `GET` | `/v1/me/following` | Self following list (public-safe previews) |
| `GET` | `/v1/me/followers` | Self followers list |
| `POST` | `/v1/users/:userId/wave` | Idempotent greeting; does **not** open a DM |
| `GET` | `/v1/me/waves` | Incoming waves only |
| `POST` | `/v1/me/message-requests` | `{ "targetUserId" }` pending request; no body text; `201` or `200` if already pending/accepted |
| `GET` | `/v1/me/message-requests` | `box=inbox\|sent`, optional `status` |
| `POST` | `/v1/me/message-requests/:requestId/accept` | Recipient-only; creates/returns one canonical conversation |
| `POST` | `/v1/me/message-requests/:requestId/decline` | Recipient-only; retry create → `409` |
| `GET` | `/v1/me/messaging/summary` | **Task 023A** — DM + group unread totals, pending inbox requests, badge fields (see below) |
| `GET` | `/v1/me/conversations` | Self 1:1 list, last-message preview, `unreadCount`, optional `q` |
| `GET` | `/v1/me/conversations/:conversationId/messages` | Participant-only; latest-first page reversed to chronological |
| `POST` | `/v1/me/conversations/:conversationId/messages` | `{ "body", "clientMessageId?" }` after accept; `201` |
| `POST` | `/v1/me/conversations/:conversationId/read` | Monotonic watermark `{ "messageId?" }` → `{ unreadCount }` |

#### `GET /v1/me/messaging/summary` (Task 023A)

**Gate:** Bearer + Task 022 `requireHomeAccess` (same as other `/v1/me/*` main-app routes after onboarding split). Pending applicants → `403 ONBOARDING_REQUIRED`.

**Response `data`:**

| Field | Meaning |
|-------|---------|
| `directUnread` | Count of unread **messages** in accepted 1:1 threads (others’ messages after read watermark; blocked threads excluded) |
| `groupUnread` | Count of unread **messages** in ACTIVE group chats (blocked authors excluded; same rules as `/v1/me/group-chats`) |
| `messageRequestsPending` | Count of **PENDING** inbox requests (`GET /v1/me/message-requests?box=inbox&status=PENDING` semantics; blocked senders excluded) |
| `totalUnreadMessages` | `directUnread + groupUnread` |
| `displayBadgeCount` | Alias of `totalUnreadMessages` for header Messages icon |
| `directConversationsWithUnread` | Number of 1:1 threads with `directUnread > 0` per thread |
| `groupChatsWithUnread` | Number of group chats with `groupUnread > 0` per group |

**Not included:** notification bell count (`GET /v1/home` → `notificationsUnreadCount` or `/v1/me/notifications`), typing/presence, delivery receipts. **Do not add** `messageRequestsPending` into `displayBadgeCount` (Requests tab uses its own badge).

**Tests:** `tests/integration/messaging-summary.integration.test.ts` (native DB gate).

#### Socket.IO messaging realtime (Task 023B)

**Transport:** WebSocket via Socket.IO on the same HTTP server (`SOCKET_IO_PATH`, default `/socket.io`). Disable with `SOCKET_IO_ENABLED=false` (REST unchanged).

**Auth:** Access JWT in handshake `auth.token` (or `Authorization: Bearer`). Requires Task 022 main-app activation. Session re-checked on subscribe/typing; revoked sessions disconnected.

**Contract:** See `openapi/messaging-realtime.yaml` and `FLUTTER_DEVELOPER_HANDOFF.md` §14.5. Events notify committed REST state only (`messaging:dm_message`, `messaging:group_message`, read events, `messaging:summary`, ephemeral `messaging:typing`). **No** second write path. Dedupe client-side by `eventId` / `messageId`. Multi-instance Redis adapter **not enabled** (`SOCKET_IO_REDIS_ADAPTER_ENABLED` must stay false until dedicated ops verification).

**Tests:** `tests/integration/messaging-socket.integration.test.ts` (native DB gate; includes passive leak cases after block/leave).

**023B hardening:** Emits target authorized **user rooms** only; evicts DM/group rooms on block/leave; disconnects sockets on session revocation; **`SOCKET_IO_REDIS_ADAPTER_ENABLED=true` fails startup** until adapter is implemented.

#### Push device registration & preferences (Task 023C — FCM delivery OFF)

**Gate:** Task 022 main-app activation. **`PUSH_ENABLED` default false** (production fail-closed if true without 023D).

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/me/device-tokens` | Register/rotate own FCM token (stored server-side; never returned in list) |
| `GET` | `/v1/me/device-tokens` | Active device metadata for caller |
| `DELETE` | `/v1/me/device-tokens/:deviceTokenId` | Revoke own device |
| `GET` | `/v1/me/notification-preferences` | Read toggles; `deliveryStatus: PUSH_DISABLED` |
| `PATCH` | `/v1/me/notification-preferences` | Partial update (`meetupInvitesEnabled`, DM, groups, activity, …) |

**Tests:** `tests/integration/push-devices.integration.test.ts`.

**Not in REST DTOs:** E2EE flags, device delivery receipts, presence/online, meeting instructions, email/DOB/KYC. Ephemeral typing is Socket-only (§14.5). Group chats remain Task 012 REST (`/v1/me/group-chats`).

**Block:** Either direction hides follow/wave/request/conversation/message content (`404`). Unblock does not recreate consent. Declined requests stay declined.

**Tests:** `tests/social-policy.test.ts`, `tests/social.validation.test.ts`, `tests/social.dto.test.ts`; `tests/integration/social.integration.test.ts` (native DB gate).

---

### Groups & communities (Task 012)

**Policy:** D-03/D-04 previews, bidirectional blocks, Task 010 KYC/RSVP unchanged, `docs/decisions/D-GROUPS-TASK012.md` (**provisional**; D-06 open)  
**Status:** **LIVE**; verified on isolated Neon `strangeup_test` (T012-P01..P08, T012-C01).  
**OpenAPI:** `openapi/groups.yaml`

**Gate:** Bearer token; `hasFullAccountAccess` or `403`. Hidden/non-member private content → generic `404`. Government-ID KYC is **not** required to browse, join, post, or chat in a group. Group membership is **not** RSVP, meeting-location access, DM consent, or follow.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/group-categories` | Managed catalog: `sports`, `fitness`, `outdoor`, `social`, `hobbies` |
| `GET` | `/v1/groups` | Discover ACTIVE summaries: `q`, `category`, `city`, `region`, `privacy`, `tag`, cursor |
| `GET` | `/v1/groups/:groupId` | Public-safe header/About, `memberCount` from ACTIVE rows, `myMembership`, `canAccessContent` |
| `GET` | `/v1/groups/:groupId/cover` | Cover bytes; PUBLIC+ACTIVE for any eligible viewer; otherwise members only |
| `GET` | `/v1/me/groups` | Own memberships; query `view` (`all` \| `joined` \| `managed` \| `pending`), or legacy `status`/`role`, optional `q` on group name, cursor pagination |
| `POST` | `/v1/me/groups` | Create + OWNER membership atomically (`201`) |
| `GET` | `/v1/me/groups/:groupId/manage` | Owner/moderator summary (`pendingRequestCount`, `visiblePostCount`) |
| `PATCH` | `/v1/me/groups/:groupId` | Allowlisted edits; privacy/capacity owner-only; **403** when group `ARCHIVED` (029C) |
| `POST` | `/v1/me/groups/:groupId/cover` | Multipart field `cover`; Sharp 008A pipeline; **5MB** (Figma example 10MB); **403** if `ARCHIVED` |
| `DELETE` | `/v1/me/groups/:groupId/cover` | Remove cover; **403** if `ARCHIVED` |
| `POST` | `/v1/groups/:groupId/join` | PUBLIC → ACTIVE; PRIVATE_APPROVAL → PENDING; `DECLINED`/`REMOVED` reapply as PENDING; **403** if group `ARCHIVED` |
| `DELETE` | `/v1/groups/:groupId/join` | Leave / cancel request; last owner → `403`; allowed on archived groups |
| `GET` | `/v1/groups/:groupId/members` | Active members; D-03-safe previews; member-only |
| `GET` | `/v1/me/groups/:groupId/join-requests` | Pending approvals |
| `POST` | `/v1/me/groups/:groupId/join-requests/:memberId/approve` | Capacity-safe; idempotent if already ACTIVE; **403** if group `ARCHIVED` |
| `POST` | `/v1/me/groups/:groupId/join-requests/:memberId/decline` | Decline pending; **403** if group `ARCHIVED` (029D) |
| `POST` | `/v1/me/groups/:groupId/members/:userId/remove` | Cannot remove OWNER; mods cannot remove mods; **403** if `ARCHIVED`; evicts group socket (023) |
| `POST` | `/v1/me/groups/:groupId/members/:userId/role` | Owner-only `{ "role": "MODERATOR" \| "MEMBER" }`; **403** if `ARCHIVED` |
| `POST` | `/v1/me/groups/:groupId/transfer-ownership` | `{ "userId" }`; previous owner becomes MEMBER; **403** if `ARCHIVED` |
| `POST` | `/v1/me/groups/:groupId/archive` | Owner-only; **403** if already `ARCHIVED` (029D) |
| `GET` | `/v1/groups/:groupId/posts` | Member-only; pinned first |
| `POST` | `/v1/groups/:groupId/posts` | `{ "body", "activityId?" }` text only |
| `PATCH` | `/v1/groups/:groupId/posts/:postId` | Author body edit |
| `DELETE` | `/v1/groups/:groupId/posts/:postId` | Author/moderator soft-remove |
| `POST` | `/v1/groups/:groupId/posts/:postId/pin` | `{ "pinned": true\|false }` |
| `GET`/`POST` | `/v1/groups/:groupId/posts/:postId/comments` | Member comments |
| `DELETE` | `/v1/groups/:groupId/posts/:postId/comments/:commentId` | Author or moderator |
| `PUT`/`DELETE` | `/v1/groups/:groupId/posts/:postId/like` | Idempotent like/unlike |
| `GET` | `/v1/me/group-chats` | Current-member chat previews + `unreadCount` |
| `GET`/`POST` | `/v1/groups/:groupId/chat/messages` | Member text; optional `clientMessageId` |
| `POST` | `/v1/groups/:groupId/chat/read` | Monotonic watermark → `{ unreadCount }` |
| `GET` | `/v1/groups/:groupId/activities` | Real linked Task 010 public cards (no meeting instructions) |
| `POST` | `/v1/me/groups/:groupId/activities` | Attach hosted activity `{ "activityId" }` |
| `DELETE` | `/v1/me/groups/:groupId/activities/:activityId` | Detach (host + manager) |

**Create body example:**

```json
{
  "name": "Sunrise Riders",
  "description": "Weekend group rides",
  "category": "sports",
  "locationCity": "Miami",
  "locationRegion": "FL",
  "privacy": "PUBLIC",
  "meetupFrequency": "WEEKLY",
  "memberCapacity": 40,
  "tags": ["miami", "sunrise"]
}
```

**Not returned:** `verified`, `verifiedCommunity`, distance/nearby, E2EE, typing, presence, meeting instructions, email/DOB/KYC, cover storage keys.

**Tests:** `tests/group-policy.test.ts`, `tests/group.validation.test.ts`, `tests/group.dto.test.ts`, `tests/group-query.test.ts`, `tests/group-cover-storage.test.ts`; `tests/integration/groups.integration.test.ts`.

---

### Group stories, photo posts & polls (Task 016)

**Policy:** `docs/decisions/D-06-COMMUNITY-MEDIA-TASK016.md` (**PROVISIONAL**; D-06 **not** owner-approved).  
**Activation:** `GROUP_COMMUNITY_INTERACTIVE_ENABLED` defaults **`false`**. When false, all routes below return **`403 FEATURE_DISABLED`**. When true (staging/tests only until owner sign-off), member-only ACL + blocks apply.  
**Storage:** local disk under `GROUP_UPLOAD_DIR` (**DEV_ONLY**); Sharp re-encode (Task 008A limits).  
**OpenAPI:** `openapi/group-content.yaml`

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/groups/:groupId/posts/:postId/media` | Multipart field **`image`**; one photo per post; author only |
| `GET` | `/v1/groups/:groupId/posts/:postId/media/:mediaId` | Stream bytes; active member; blocked author → `404` |
| `DELETE` | `/v1/groups/:groupId/posts/:postId/media/:mediaId` | Author or moderator remove |
| `GET` | `/v1/groups/:groupId/stories` | Non-expired visible stories (member) |
| `POST` | `/v1/groups/:groupId/stories` | Multipart **`image`**; `expiresAt = createdAt + 24h` (server) |
| `GET` | `/v1/groups/:groupId/stories/:storyId/media` | Read-time expiry deny → `404` |
| `DELETE` | `/v1/groups/:groupId/stories/:storyId` | Author or moderator remove |
| `POST` | `/v1/groups/:groupId/posts/:postId/poll` | `{ closesAt, options[2..6] }` on own post |
| `GET` | `/v1/groups/:groupId/posts/:postId/poll` | Aggregated counts; `myVoteOptionId` for caller only |
| `PUT` | `/v1/groups/:groupId/posts/:postId/poll/vote` | `{ optionId }`; one vote; closed poll → `409` |
| `POST` | `/v1/groups/:groupId/content-reports` | `{ targetType, targetId, reason, detail? }` |
| `GET` | `/v1/groups/:groupId/content-reports` | OPEN reports; owner/moderator only |

**Post/feed DTOs:** `photo` and `poll` on `GroupPostDto` are **`null`** unless interactive flag is **on**. Home **`stories.status` stays `DEFERRED`** (no fabricated Home story list).

**Ops:** manual expiry cleanup `npx tsx scripts/cleanup-group-expired-content.ts [--apply]` (non-production; dry-run default).

**Schema:** migration `20261027240000_community_stories_media_polls`.

**Tests:** `tests/group-content.policy.test.ts`; `tests/integration/group-content.integration.test.ts` (T016-G01, T016-P01, T016-S01, T016-V01, T016-H01).

---

### Home dashboard & community feed (Task 013)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/home` | Bearer | Bounded dashboard composition (groups, feed preview, upcoming linked activities, people, activities, featured, unread count; stories deferred) |
| `GET` | `/v1/me/community-feed` | Bearer | Cross-group feed from ACTIVE memberships; cursor pagination; optional `groupId` filter |

**Privacy:** No coordinates, distances, online status, or meeting instructions in dashboard/feed DTOs. Blocked authors omitted; revoked membership excludes posts on read. Linked activities use Task 010 public cards only.

**Stories:** `data.stories.status = "DEFERRED"` — no fake 24h story list.

**Tests:** `tests/notification-cursor.test.ts`; `tests/integration/home.integration.test.ts` (T013-H01–H04); `tests/integration/main-flow-025a.integration.test.ts` (T025A-H01–H03 main-shell gate, blocks, truthful DTO).

**Figma (Task 025A):** Shared vs updated-only Home actions — `docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025A.md`; source manifest `design-reference/task025-main-flow/MANIFEST.md`.

---

### In-app notifications (Task 013)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/me/notifications` | Bearer | Inbox with `unreadCount`; query `cursor`, `limit`, `unreadOnly=true` |
| `POST` | `/v1/me/notifications/{notificationId}/read` | Bearer | Idempotent mark read (recipient-only) |
| `POST` | `/v1/me/notifications/read-all` | Bearer | Mark all unread for caller |

**Emitted types (real hooks only):** `MESSAGE_REQUEST_RECEIVED`, `MESSAGE_REQUEST_ACCEPTED`, `DIRECT_MESSAGE_RECEIVED` (aggregated per conversation), `GROUP_MEMBERSHIP_APPROVED`, `GROUP_MEMBERSHIP_DECLINED`, `ACTIVITY_RSVP_CONFIRMED`, `ACTIVITY_RSVP_WAITLISTED`, `ACTIVITY_WAITLIST_PROMOTED`.

**Not emitted:** KYC success, Stripe, scheduled reminders, push, fabricated invitations.

**Schema:** migration `20261027210000_user_notifications` → `UserNotification` + dedupe key.

**Retention:** provisional 365-day default documented in `OPEN_QUESTIONS.md` — owner policy OPEN.

---

#### `POST /v1/me/password-change`

**Figma:** `Screen 26_ Profile & Settings.pdf` — Password & Security row (authenticated change, distinct from forgot-password flow on Screen 05 / Body reset canvas).

**Request:**

```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

**Validation:** `newPassword` uses the same rules as register (`passwordFieldSchema`); must differ from `currentPassword`. Strict body — unknown keys → `VALIDATION_ERROR` 400.

**Response 200:**

```json
{
  "data": {
    "success": true,
    "sessionsRevoked": true
  },
  "meta": { "requestId": "..." }
}
```

**Side effects (atomic transaction):** updates `PasswordCredential` only if stored hash unchanged (optimistic concurrency); sets `passwordChangedAt` and `mustReauthAfter`; deletes unconsumed `PASSWORD_RESET` challenges; **revokes all sessions** — client must log in again (no tokens in response).

**Rate limit:** per IP and per user (`AUTH_RATE_LIMIT_PASSWORD_CHANGE_*` / minute).

**Errors:** `AUTH_INVALID_CREDENTIALS` 401 wrong current password; `AUTH_FORBIDDEN` 403 suspended/deleted; `AUTH_UNAUTHORIZED` 401 missing/invalid access token; `VALIDATION_ERROR` 400; `CONFLICT` 409 concurrent credential update; `AUTH_RATE_LIMITED` 429.

**Tests:** `tests/integration/me.integration.test.ts` (T005-P01, T005-N01–T005-N03, T005-C01, rate limit); `tests/auth.validation.test.ts`; `tests/policy.test.ts` (`canChangePassword`).

---

### Error codes (auth + me)

`AUTH_INVALID_CREDENTIALS`, `AUTH_UNAUTHORIZED`, `AUTH_FORBIDDEN`, `AUTH_CHALLENGE_EXPIRED`, `AUTH_RATE_LIMITED`, `CONFLICT`, `VALIDATION_ERROR`, `NOT_FOUND`, `IDENTITY_VERIFICATION_REQUIRED`, plus foundation codes.

---

### Store — official merchandise (Task 014, Screens 20–22)

**Auth:** Bearer access token; **full account** required (`AUTH_FORBIDDEN` 403 otherwise). **No checkout/payment/order routes.**

**Schema:** migration `20261027220000_store_and_jobs` — categories (taxonomy seed only), products, variants, images, favorites, cart lines.

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/store/categories` | Active category taxonomy |
| `GET` | `/v1/store/pricing-policy` | Merchandise pricing contract (024C): canonical model, `NOT_CONFIGURED` membership/shipping/tax, checkout `UNAVAILABLE` |
| `GET` | `/v1/store/fulfillment-policy` | Physical fulfillment & order architecture (024D): `SHIPPING` / `ACTIVITY_PICKUP` capabilities, lifecycle spec, ADR-003 boundary |
| `GET` | `/v1/store/products` | **PUBLISHED** products only; filters `q`, `category`, `size`, `color`; cursor pagination; `pricingHint` |
| `GET` | `/v1/store/products/:productId` | Published detail + active variants + `variants[].pricing` + `merchandisePricingPolicy` (024C) |
| `GET` | `/v1/store/products/:productId/images/:imageId` | Sanitized catalog bytes when file exists locally |
| `GET` | `/v1/me/store/favorites` | Self favorites (published only) |
| `PUT` | `/v1/me/store/favorites/:productId` | Idempotent favorite |
| `DELETE` | `/v1/me/store/favorites/:productId` | Idempotent unfavorite |
| `GET` | `/v1/me/store/cart` | Self cart: 024A subtotals + 024C `pricingQuote` + 024D `fulfillment` + `orderReadiness`; `checkout.status=UNAVAILABLE` |
| `PUT` | `/v1/me/store/cart/items/:variantId` | Set quantity (`0` removes); server catalog price only |
| `DELETE` | `/v1/me/store/cart/items/:variantId` | Remove line |
| `DELETE` | `/v1/me/store/cart` | Clear cart (no orders) |

**Not LIVE:** place order, payment intents, tax/shipping quotes, membership discounts, product reviews/ratings, verified seller badges, inventory reservation on cart mutation.

**Empty state:** Fresh databases may return `products: []` until trusted catalog ingestion publishes SKUs.

---

### Jobs (Task 014, Screen 23)

**Auth:** Bearer + full account. **No employer review APIs.** Applications stored in-platform only.

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/jobs` | **PUBLISHED** open listings; `q`, `employmentType`, `workMode`, `city`, `region`, `cursor`, `limit`; `q` composes with `cursor` (029F); invalid enums → **400**; no distance/partner badges |
| `GET` | `/v1/jobs/:jobId` | Published detail |
| `POST` | `/v1/jobs/:jobId/applications` | Applicant submit; `employerDelivery.status=NOT_CONFIGURED` |
| `GET` | `/v1/me/saved-jobs` | Saved published jobs |
| `PUT` | `/v1/me/saved-jobs/:jobId` | Idempotent save |
| `DELETE` | `/v1/me/saved-jobs/:jobId` | Idempotent unsave |
| `GET` | `/v1/me/job-applications` | Self applications (cursor) |
| `GET` | `/v1/me/job-applications/:applicationId` | Self detail; others → `404` |
| `POST` | `/v1/me/job-listings` | Create **DRAFT** (author-only; not public) |
| `GET` | `/v1/me/job-listings` | List own drafts |
| `GET` | `/v1/me/job-listings/:jobId` | Own draft detail |
| `PATCH` | `/v1/me/job-listings/:jobId` | Edit own draft |

**Not LIVE:** employer verification, applicant counts, external ATS/email delivery, paid boosts, resume upload.

---

### Settings hub & account lifecycle (Task 015, Screen 26)

| Method | Path | Auth | Status | Description |
|---|---|---|---|---|
| `GET` | `/v1/me/settings/overview` | Bearer + **main app** | **LIVE** | Settings hub (Screen 26): profile header, `account` (`adminReviewStatus`, `legalNameLocked`, `fullAccess`, `identityVerificationStatus`), honest `capabilities`, DB-backed `counts`, `relatedRoutes` (Task 015/025D) |
| `GET` | `/v1/me/account-deletion/impact` | Bearer | **LIVE** | Self-scoped dependency counts; `deletion.status` = `AWAITING_POLICY`; **no destructive delete** |
| `GET` | `/v1/me/security/sessions` | Bearer | **LIVE** | Up to 50 active sessions (non-secret metadata; `isCurrent` when derivable) |
| `DELETE` | `/v1/me/security/sessions/:sessionId` | Bearer | **LIVE** | Revoke own session (idempotent; cross-user → no-op) |
| `POST` | `/v1/me/email-change/request` | Bearer | **DEV_ONLY** | Password reauth + pending challenge to **new** email; old email stays login until confirm; enumeration-safe `202`; **`403 FEATURE_DISABLED` when transactional email cannot hand off** (production `disabled` or missing provider) |
| `POST` | `/v1/me/email-change/confirm` | Bearer | **DEV_ONLY** | Consume token; swap verified email; **revoke all sessions**; dev stub notifies prior email; **`403 FEATURE_DISABLED` when transactional email cannot hand off** |
| `GET` | `/v1/me/saved-activities` | Bearer | **LIVE** | Saved Activity public cards; omits blocked/unpublished/cancelled/**non-discoverable hosts** (027D); save rows preserved |
| `PUT` | `/v1/me/saved-activities/:activityId` | Bearer | **LIVE** | Idempotent save when activity is publicly discoverable (025C host rule); **404** otherwise |
| `DELETE` | `/v1/me/saved-activities/:activityId` | Bearer | **LIVE** | Idempotent unsave |

**Reuse (unchanged):** `GET /v1/me/account`, `GET/PATCH /v1/me/profile`, `POST /v1/me/password-change`, `GET /v1/me/blocks`, `POST /v1/auth/logout`, `POST /v1/auth/logout-all`, activity/group/job routes referenced in overview `relatedRoutes`.

**Gates:** `GET /v1/me/settings/overview` requires **Task 022 main-app access** (`403 ONBOARDING_REQUIRED` when pending). Account deletion impact and security sessions remain onboarding-safe. Saved activities, email-change **request**, and product counts require main-app access. Email-change **request** additionally requires password credential.

**Figma (Task 025D):** `docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025D.md`; tests `tests/integration/main-flow-025d.integration.test.ts`.

**Not LIVE / honest DEFERRED in `capabilities`:** 2FA, subscription **billing/upgrade**, payment history, meetup invites hub, host ratings, 24/7 support, phone edit/verify, destructive account deletion. **`membershipPlanCatalog` is LIVE** (Task 017); overview also returns compact `membership` summary.

---

### Membership plans & entitlements (Task 017 / 026A, Screen 18)

| Method | Path | Auth | Status | Description |
|---|---|---|---|---|
| `GET` | `/v1/membership/plans` | Bearer + **Task 022 home access** | **LIVE** | Plan catalog (`BASIC` **AVAILABLE** USD **0**; `CLUB` **NOT_CONFIGURED**, not purchasable) + per-feature **`AVAILABLE` / `NOT_CONFIGURED` / `DEFERRED` / `NOT_IMPLEMENTED`** + versioned **`flow`** contract (billing/checkout **DEFERRED**, Figma pricing contradictions documented); **`billingConfigured: false`** |
| `GET` | `/v1/me/membership` | Bearer + **Task 022 home access** | **LIVE** | Self membership: **`BASIC`/`FREE`**, `canUpgrade: false`, `entitlements` + same **`flow`**; trial/subscription/payment fields remain **null** |

**Gates:** `canAccessAccount`; `/v1/me/membership` self-only; both routes behind main-app activation like other gated product APIs.

**Owner (2026-10-28):** All payment/subscription billing **DEFERRED** — no subscribe/upgrade/cancel, webhooks, receipts, ledger, or paid Club activation.

**Settings integration:** `GET /v1/me/settings/overview` → `membership` summary; `capabilities.membershipPlanCatalog: LIVE`; `capabilities.subscription: DEFERRED`.

**Source:** `src/modules/membership/*` (**no DB migration**)

**OpenAPI:** `openapi/membership.yaml` · Parity: `docs/product/FIGMA_MEMBERSHIP_PARITY_TASK026A.md` (supersedes Task 017 matrix for flow/checkout)

**Distinct from Task 008:** `GET/PUT /v1/me/favorite-activities` remains **preference pins** (plain text), not Activity entity bookmarks.

**Source:** `src/modules/settings/*`, `src/modules/saved-activities/*`, `src/modules/auth/auth.service.ts` (email change challenges)

---

### Consent registry (`/v1/consents`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/consents/required` | None | Server-owned registration + job-application consent availability (document IDs, active version IDs, `UNAVAILABLE`/`PLACEHOLDER` states — **no legal copy**) |

**Source:** `src/modules/consent/*`

---

### Identity verification (Task 021)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/me/verification/status` | Bearer | Self-service KYC summary + provider runtime status |
| `POST` | `/v1/me/verification/sessions` | Bearer | Start provider session (requires `KYC_PROVIDER_ENABLED=true` and configured adapter) |
| `GET` | `/v1/me/verification/sessions/:sessionId` | Bearer | Session owner read (no PII payloads) |
| `POST` | `/v1/me/verification/sessions/:sessionId/cancel` | Bearer | Cancel active session |
| `POST` | `/v1/webhooks/verification/:provider` | HMAC (`x-hmac-signature`, raw body) | Provider decision webhook (`mock` for integration; `veriff` **BLOCKED BY OWNER**) |

**Runtime:** Default `KYC_PROVIDER_ENABLED=false` → `FEATURE_DISABLED`. **`KYC_PROVIDER=mock`** + secret enables integration-style sessions; **`veriff`** session creation and webhooks remain blocked until **KYC-02** owner approval and `VERIFF_LIVE_CALLS_ENABLED=true` (forbidden in production startup). **`User.identityVerificationStatus`** changes only via validated webhooks — never client-writable. Trusted KYC for activities also requires non-revoked, non-expired approval metadata (`identityVerificationValidUntil`, `identityVerificationRevokedAt`).

**Source:** `src/modules/verification/*`, migration `20261027250000_kyc_verification_consent`

**Task 022A onboarding router:** `GET /v1/me/onboarding/status` — activation summary (`onboardingPhase`, `nextAction`, `homeAccessAllowed`). See self `/v1/me` table above.

---

### Admin identity review (Task 022B — backend only, no Admin UI)

**Auth:** Bearer session + active `PlatformStaffGrant` role `IDENTITY_REVIEWER` (see `docs/operations/PLATFORM_STAFF_PROVISIONING.md`). Never assign via register/login/client flags.

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/admin/identity-reviews` | Paginated queue (`status=PENDING\|APPROVED\|REJECTED`, `limit`, `cursor`) — minimal DTO, masked email |
| `GET` | `/v1/admin/identity-reviews/:reviewId` | Detail (`reviewId` = applicant `userId`); session metadata + recent audit decisions — no ID/selfie payloads |
| `POST` | `/v1/admin/identity-reviews/:reviewId/approve` | Approve activation when provider session APPROVED and eligibility gates pass; optional `Idempotency-Key` |
| `POST` | `/v1/admin/identity-reviews/:reviewId/reject` | Reject with bounded `reasonCode`; optional `Idempotency-Key` |

**Rules:** Admin approve **never** overrides provider decline/expiry/revocation; self-review forbidden; production rejects mock-provider approvals. Provider `APPROVED` webhook sets admin `PENDING` only.

**Source:** `src/modules/admin/*`, migrations `20261028120000_task022a_admin_review_lifecycle`, `20261028140000_task022b_platform_staff_admin_review`

### Store catalog management (Task 024B — staff only)

**Auth:** Bearer + active `PlatformStaffGrant` role **`STORE_CATALOG_MANAGER`** (not `IDENTITY_REVIEWER`). **Feature flag:** `STORE_CATALOG_MANAGEMENT_ENABLED=true` required (default **false**; production fail-closed until MKT-01/02). Does **not** use main-app Home gate.

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/admin/store-catalog/categories` | Active taxonomy for operators |
| `GET` | `/v1/admin/store-catalog/products` | List products (all statuses; cursor) |
| `POST` | `/v1/admin/store-catalog/products` | Create **DRAFT** product |
| `GET` | `/v1/admin/store-catalog/products/:productId` | Operator detail (any status) |
| `PATCH` | `/v1/admin/store-catalog/products/:productId` | Edit draft/published metadata |
| `POST` | `/v1/admin/store-catalog/products/:productId/publish` | Publish when eligibility passes |
| `POST` | `/v1/admin/store-catalog/products/:productId/archive` | Archive product |
| `POST` | `/v1/admin/store-catalog/products/:productId/variants` | Create variant (unique SKU; size/color uniqueness among active) |
| `PATCH` | `/v1/admin/store-catalog/products/:productId/variants/:variantId` | Update variant; optional `expectedUpdatedAt` for optimistic concurrency |
| `PATCH` | `/v1/admin/store-catalog/products/:productId/variants/:variantId/stock` | Stock update (`expectedUpdatedAt` required) |
| `POST` | `/v1/admin/store-catalog/products/:productId/images` | Multipart **`image`** ingest (processed JPEG/PNG/WebP) |
| `PATCH` | `/v1/admin/store-catalog/products/:productId/images/:imageId` | Update `sortOrder` |
| `DELETE` | `/v1/admin/store-catalog/products/:productId/images/:imageId` | Remove image + storage object |

**Buyer routes unchanged:** `/v1/store/*`, cart (024A), favorites; `checkout.status=UNAVAILABLE`. Product images served only for **PUBLISHED** products via existing GET image route (private cache).

**Ops:** `docs/operations/STORE_CATALOG_MANAGEMENT_TASK024B.md`

**OpenAPI:** `openapi/admin.yaml`

---

### Main-app access enforcement (Task 022C)

**Policy:** `hasHomeAccess` = email verified + age eligible + ACTIVE + trusted provider KYC + admin `APPROVED` tied to the same `identityVerificationSessionId`. Enforced at HTTP layer via DB reload (`createRequireHomeAccessMiddleware`) so JWT/session snapshots cannot bypass revoked or pending DB state.

**Gated mounts (`app.ts`):** `/v1/discover`, `/v1/users`, `/v1/activity-categories`, `/v1/activities`, `/v1/group-categories`, `/v1/groups`, `/v1/home`, `/v1/store`, `/v1/jobs`, `/v1/membership`.

**`/v1/me` split:** Before gate — `GET /v1/me/onboarding/status`, `/v1/me/verification/*`, account/profile read + patch (eligibility rules), password change, session list/revoke, account-deletion impact. After gate — settings overview, saved activities, interests/favorites/avatar, blocks, notifications, nested me routers (activities, social, groups, home feed, store, jobs, membership, email change).

**Not gated:** `/v1/auth/*`, `/v1/consents/*`, `/v1/webhooks/*`, `/health/*`, `/v1/admin/*`, `GET /v1/interests` (catalog; requires bearer + account access only).

**403 body (main-app denial):** `error.code` = `ONBOARDING_REQUIRED` (pending pipeline) or `ACCOUNT_NOT_ACTIVATED` (admin rejected / denied); includes `nextAction`, `onboardingPhase`, `effectiveApplicationAccess`, `homeAccessAllowed: false`.

**Source:** `src/modules/policy/home-access-enforcement.ts`, `src/common/middleware/require-home-access.ts`, `src/app.ts`, `src/modules/me/me.routes.ts`

**Task 022D acceptance:** Figma auth flow parity matrix `docs/product/FIGMA_AUTH_FLOW_PARITY_TASK022.md`; E2E evidence `tests/integration/auth-flow-e2e.task022d.integration.test.ts`; report `docs/plans/TASK_022D_AUTH_FLOW_ACCEPTANCE_REPORT.md`.

---

## PLANNED (not implemented)

**Product note (2026-10-27):** Veriff live sessions/webhooks **BLOCKED BY OWNER** (KYC-02). Activity **enforcement** for real-world publish/confirm uses trusted KYC and fails closed in production until `KYC_PROVIDER_ENABLED=true` with a configured adapter.

**Store checkout / orders:** deferred until MKT-03 payment + fulfillment policies and processor selection.

| Method | Path | Target task |
|---|---|---|
| `DELETE` | `/v1/me/account` | Later (deletion workflow UNRESOLVED) |
| Veriff production activation | Owner + counsel | KYC-02 vendor selection; `VERIFF_*` secrets; legal ACTIVE consent IDs |

---

## Change log

| Date | Change |
|---|---|
| 2026-10-29 | Task **030** — read-only route inventory vs `src/**/*.routes.ts` + `app.ts` mount table; no API gaps found; Flutter handoff header synced |
| 2026-10-29 | Task **029H** — Task 029 closure documentation only (no route changes); final parity `FIGMA_GROUPS_JOBS_PARITY_TASK029H_FINAL.md` |
| 2026-10-29 | Task **029F** — `GET /v1/jobs` search + cursor pagination fix (no new routes); Screen 23 parity doc `FIGMA_GROUPS_JOBS_PARITY_TASK029F.md` |
| 2026-10-29 | Task **027I** — documentation reconciliation (no new routes): hybrid join, inventory `view=pending`, roster, 025C/saved-activity privacy; see `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027I_FINAL.md` |
| 2026-10-27 | Task 021 — canonical consent registry + validation; KYC verification sessions, mock webhook HMAC, trust metadata; Veriff blocked |
| 2026-10-27 | Task 017 — membership plan catalog, self membership/entitlements, settings overview `membership` summary (D-08 billing deferred) |
| 2026-10-27 | Task 015 — settings overview, saved activities, email change (DEV_ONLY), session inventory, deletion impact (non-destructive) |
| 2026-10-27 | Task 014 — `/v1/store/*`, `/v1/me/store/*`, `/v1/jobs/*`, `/v1/me/saved-jobs`, job applications, job drafts |
| 2026-10-27 | Task 013 — `/v1/home`, `/v1/me/community-feed`, in-app notifications inbox + event hooks |
| 2026-10-28 | Task 023C — device tokens + notification preferences (`PUSH_ENABLED` off); 023B socket ACL hardening |
| 2026-10-28 | Task 023B — Socket.IO messaging realtime (REST-triggered events; single-instance default) |
| 2026-10-28 | Task 023A — `GET /v1/me/messaging/summary` header/message badge aggregates |
| 2026-10-27 | Task 011 — follow/unfollow, wave, message requests, 1:1 text conversations, unread/read watermarks |
| 2026-10-27 | Task 010 — activities catalog, host draft/publish/cancel, discovery, RSVP/waitlist, meeting details, KYC enforcement |
| 2026-10-27 | Task 009 — discovery list, public profile/avatar, user blocks (D-03/D-04 MVP) |
| 2026-10-27 | Task 008 — favorite-activity preferences, profile visibility/location PATCH fields, avatar upload/GET/DELETE (policy sign-off pending) |
| 2026-10-27 | Task 007 — `GET /v1/interests`, `GET/PUT /v1/me/interests` (10-option catalog; private selections) |
| 2026-10-27 | Task 006 — `username` on profile GET/PATCH; bio write max 300 (D-BIO-MAX); `409` username conflict |
| 2026-10-26 | Task 005 slice — `POST /v1/me/password-change` (settings/security) |
| 2026-10-26 | Task 003 — Figma profile parity audit; bio max documented; expanded `/v1/me` negative tests |
| 2026-10-26 | Task 002B.2A — scrypt preferred cost + rehash-on-login (behavior only) |
| 2026-10-26 | Task 002B.2 — password reset, `/v1/me/account`, `/v1/me/profile` GET/PATCH |
| 2026-10-26 | Task 002B.1 — identity migration + `/v1/auth/*` email/password core |
| 2026-10-26 | Initial permanent doc; LIVE = health only (Task 001). |
