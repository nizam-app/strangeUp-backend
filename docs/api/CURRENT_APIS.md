# StrangeUp Backend — Currently Implemented APIs

**Last updated:** 2026-10-27 (Task 012 — groups & communities; Neon `strangeup_test` integration **72 passed**, 1 skipped)
**Maintainers:** Update this file in the **same change** as any API implementation, modification, or removal. See `AGENTS.md`.

| Status | Meaning |
|---|---|
| **LIVE** | Routed in `src/` and covered by tests or OpenAPI where noted |
| **DEV_ONLY** | Implemented but relies on dev email stub / not production-ready delivery |
| **PLANNED** | Contract draft only — not implemented |

**Base URL (local):** `http://localhost:3000` (default `PORT` from env)
**Product API prefix:** `/v1`

**OpenAPI:** `openapi/foundation.yaml` (health), `openapi/identity.yaml` (auth + self account/profile), `openapi/activities.yaml` (Task 010), `openapi/social.yaml` (Task 011), `openapi/groups.yaml` (Task 012)

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

Unknown keys → `VALIDATION_ERROR` 400. Cannot set `birthDate`, `accountStatus`, `emailVerified`, roles, or ids via body. Username does not affect KYC, membership, or social access.

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

**POST:** `multipart/form-data` with field name **`avatar`**; JPEG/PNG/WebP; max **5 MiB** upload. Server **decodes from bytes** (does not trust filename/declared MIME), rejects SVG/corrupt payloads, re-encodes to strip EXIF/GPS, and bounds dimensions/pixel count before write. **Development only:** local disk (`PROFILE_UPLOAD_DIR`, default `.data/profile-media`) — not approved for staging/production without object storage and moderation.

**GET:** re-encoded image bytes (`Cache-Control: private, no-store`); `404` when no avatar.

**DELETE:** clears DB metadata then removes file (best-effort); `200` with `{ hasAvatar: false, ... }`.

**Tests:** `tests/avatar-image-processor.test.ts`, `tests/local-avatar-storage.test.ts`; `tests/integration/own-profile.integration.test.ts` (T008-P03, T008A-P02).

---

### Discovery & public profiles (Task 009 — D-03/D-04 MVP)

**Policy:** `docs/decisions/D-03-public-profile-discovery-mvp.md`, `docs/decisions/D-04-location-discovery-mvp.md`  
**Status:** **LIVE in source**; DB integration verification **pending** native PostgreSQL (same gate as Tasks 006–008A).

**Viewer gate (all routes below):** Bearer token; viewer must satisfy `hasFullAccountAccess` → else `403 AUTH_FORBIDDEN`. Unauthenticated → `401`.

**Target gate:** Eligible active users only; visibility + KYC rules; bidirectional blocks → generic `404 Not found` on detail/avatar (no existence leak). Hidden/blocked users omitted from discovery lists.

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

**Tests:** `tests/public-profile-policy.test.ts`, `tests/discover-query.test.ts`; `tests/integration/discovery.integration.test.ts` (native DB gate).

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
| `GET` | `/v1/activities` | Published public upcoming list; cursor pagination; text/category/city/region/date/mode filters; **no geodistance** |
| `GET` | `/v1/activities/:activityId` | Public-safe detail (no meeting instructions) |
| `GET` | `/v1/activities/:activityId/cover` | Authorized cover bytes when `hasCover` |
| `GET` | `/v1/activities/:activityId/meeting` | Host or currently eligible confirmed participant only |
| `POST` | `/v1/activities/:activityId/rsvp` | Join or waitlist |
| `DELETE` | `/v1/activities/:activityId/rsvp` | Leave (idempotent); may promote waitlist head |
| `POST` | `/v1/me/activities` | Create **DRAFT** |
| `GET` | `/v1/me/activities` | Host list (drafts/published/cancelled) |
| `GET` | `/v1/me/activities/:activityId` | Host detail including private meeting fields |
| `PATCH` | `/v1/me/activities/:activityId` | Host-only allowlisted edits |
| `POST` | `/v1/me/activities/:activityId/publish` | Host publish |
| `POST` | `/v1/me/activities/:activityId/cancel` | Host cancel; remaining RSVPs marked cancelled |
| `POST` | `/v1/me/activities/:activityId/cover` | Multipart field **`cover`** (same image hardening as avatars) |
| `GET` | `/v1/me/activities/:activityId/cover` | Host cover bytes (including drafts) |
| `DELETE` | `/v1/me/activities/:activityId/cover` | Clear cover |
| `GET` | `/v1/me/activity-rsvps` | Self confirmed/waitlisted summaries |

#### Public activity card / detail

**Card allowlist:** `activityId`, `title`, `category{slug,label}`, `hasCover`, `startsAt`, `endsAt`, `timeZone`, `mode`, `status`, `venueName`, `locationCity`, `locationRegion`, `capacity`, `confirmedCount`, `spotsLeft`, `waitlistEnabled`, `host` (Task 009 preview; hidden/nulled when D-03 denies).

**Detail adds:** `description` (max 500 on write), `skillNotes`, `gearNotes`, `audience`, `myParticipation` (`state`, `waitlistPosition` or `null`), `meetingAvailable`.

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
| `GET` | `/v1/me/conversations` | Self 1:1 list, last-message preview, `unreadCount`, optional `q` |
| `GET` | `/v1/me/conversations/:conversationId/messages` | Participant-only; latest-first page reversed to chronological |
| `POST` | `/v1/me/conversations/:conversationId/messages` | `{ "body", "clientMessageId?" }` after accept; `201` |
| `POST` | `/v1/me/conversations/:conversationId/read` | Monotonic watermark `{ "messageId?" }` → `{ unreadCount }` |

**Not returned:** E2EE flags, delivered/device status, typing, presence, meeting instructions, email/DOB/KYC. Group chats are a separate Task 012 contract (`/v1/me/group-chats`).

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
| `GET` | `/v1/me/groups` | Own ACTIVE/PENDING memberships |
| `POST` | `/v1/me/groups` | Create + OWNER membership atomically (`201`) |
| `GET` | `/v1/me/groups/:groupId/manage` | Owner/moderator summary (`pendingRequestCount`, `visiblePostCount`) |
| `PATCH` | `/v1/me/groups/:groupId` | Allowlisted edits; privacy/capacity are owner-only |
| `POST` | `/v1/me/groups/:groupId/cover` | Multipart field `cover`; Sharp 008A pipeline; **5MB** (Figma example 10MB) |
| `DELETE` | `/v1/me/groups/:groupId/cover` | Remove cover |
| `POST` | `/v1/groups/:groupId/join` | PUBLIC → ACTIVE; PRIVATE_APPROVAL → PENDING; `DECLINED`/`REMOVED` reapply as PENDING |
| `DELETE` | `/v1/groups/:groupId/join` | Leave / cancel request; last owner → `403` |
| `GET` | `/v1/groups/:groupId/members` | Active members; D-03-safe previews; member-only |
| `GET` | `/v1/me/groups/:groupId/join-requests` | Pending approvals |
| `POST` | `/v1/me/groups/:groupId/join-requests/:memberId/approve` | Capacity-safe; idempotent if already ACTIVE |
| `POST` | `/v1/me/groups/:groupId/join-requests/:memberId/decline` | Decline pending |
| `POST` | `/v1/me/groups/:groupId/members/:userId/remove` | Cannot remove OWNER; mods cannot remove mods |
| `POST` | `/v1/me/groups/:groupId/members/:userId/role` | Owner-only `{ "role": "MODERATOR" \| "MEMBER" }` |
| `POST` | `/v1/me/groups/:groupId/transfer-ownership` | `{ "userId" }`; previous owner becomes MEMBER |
| `POST` | `/v1/me/groups/:groupId/archive` | Owner-only; non-destructive |
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

**Deferred LIVE routes:** group stories, photo posts, polls, Home Dashboard aggregate.

**Tests:** `tests/group-policy.test.ts`, `tests/group.validation.test.ts`, `tests/group.dto.test.ts`, `tests/group-query.test.ts`, `tests/group-cover-storage.test.ts`; `tests/integration/groups.integration.test.ts`.

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

## PLANNED (not implemented)

**Product note (2026-10-27):** KYC **session** APIs remain unimplemented (no vendor). Activity **enforcement** for real-world publish/confirm is implemented in Task 010 and fails closed in production until a provider exists.

| Method | Path | Target task |
|---|---|---|
| `DELETE` | `/v1/me/account` | Later (deletion workflow UNRESOLVED) |
| `POST` | `/v1/me/verification/sessions` | Later (KYC — **NOT IMPLEMENTED**; see `KYC_API_CANDIDATES.md`) |
| `POST` | `/v1/me/verification/sessions` | KYC vendor TBD |

---

## Change log

| Date | Change |
|---|---|
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
