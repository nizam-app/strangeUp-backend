# KYC / Verification API Candidates (NOT IMPLEMENTED)

**Status:** PROPOSED contract sketches — Tasks **002B.3A / 002B.3A1 / 002B.3A2**. **KYC-01, KYC-03, KYC-05** and **KYC-ENF-01..05** **APPROVED** (policy); all routes **NOT IMPLEMENTED**.
**Authoritative implemented routes:** `docs/api/CURRENT_APIS.md` (no verification session routes are LIVE).
**Enforcement:** Future activity/meetup mutating APIs must apply `KYC_OWNER_DECISIONS_002B3A2.md` §C at server; operation names **OPEN** (`D-09-kyc-enforcement-ops`).

| Symbol | Meaning |
|---|---|
| **NOT IMPLEMENTED** | No route in `src/`; do not call in production |
| **PROPOSED** | Draft for owner review before 002B.3B |

Existing LIVE surfaces expose **coarse** `identityVerificationStatus` on login and `GET /v1/me/account` only — values remain at default `NOT_STARTED` unless manually changed in DB during dev; **no KYC workflow exists**.

---

## Trust summary

| Actor | Can trust |
|---|---|
| Flutter client | Nothing about verification outcome — display server fields only |
| Bearer access token | Identifies user for **own** session APIs |
| Webhook caller | Must prove provider authenticity — **not** bearer auth |

---

## Candidate: Start verification session

| Field | Value |
|---|---|
| Method / path | `POST /v1/me/verification/sessions` |
| Status | **NOT IMPLEMENTED** (listed PLANNED in `CURRENT_APIS.md`) |
| Actor | Authenticated user (self) |
| Policy | `canStartVerification` — email verified + age eligible (**CONFIRMED** stub) |

**Preconditions (PROPOSED):**

- `accountStatus` ∈ `PENDING_VERIFICATION`, `ACTIVE` (and not suspended/deleted)
- No conflicting active session (exact rule **UNRESOLVED** — KYC-04)
- Provider configured (if none → `503` `VERIFICATION_UNAVAILABLE` **PROPOSED**)

**Headers:** `Authorization: Bearer`, optional `Idempotency-Key`

**Request (PROPOSED):**

```json
{
  "locale": "en-US",
  "documentTypeHint": "DRIVERS_LICENSE"
}
```

`documentTypeHint` optional; vendor-specific mapping **UNRESOLVED**.

**Response 201 (PROPOSED):**

```json
{
  "data": {
    "sessionId": "uuid",
    "status": "PENDING_USER",
    "clientAction": "SDK",
    "sdkToken": "opaque-short-lived",
    "redirectUrl": null,
    "expiresAt": "ISO-8601"
  },
  "meta": { "requestId": "..." }
}
```

**Errors (PROPOSED):**

| HTTP | code | When |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Missing/invalid token |
| 403 | `AUTH_FORBIDDEN` | Policy fail (unverified email, ineligible age, suspended) |
| 409 | `CONFLICT` | Active session exists / idempotency mismatch |
| 429 | `AUTH_RATE_LIMITED` | >3 starts/hour/user (**PROPOSED**) |
| 503 | `VERIFICATION_UNAVAILABLE` | No provider or provider outage |

**Trust boundary:** Response never includes provider API secret. `sdkToken` is end-user scoped per vendor docs.

---

## Candidate: Get session status

| Field | Value |
|---|---|
| Method / path | `GET /v1/me/verification/sessions/:sessionId` |
| Status | **NOT IMPLEMENTED** |
| Actor | Session owner only |
| Policy | `canAccessOwnVerificationStatus` |

**Response 200 (PROPOSED):**

```json
{
  "data": {
    "sessionId": "uuid",
    "status": "PENDING_PROVIDER",
    "identityVerificationStatus": "PENDING",
    "startedAt": "ISO-8601",
    "updatedAt": "ISO-8601",
    "completedAt": null,
    "userFacingMessage": null
  },
  "meta": { "requestId": "..." }
}
```

No `documentUrl`, `selfieUrl`, or government ID fields.

**Errors:** `404` if session not found or not owned (avoid leaking other users’ ids).

---

## Candidate: Cancel session

| Field | Value |
|---|---|
| Method / path | `POST /v1/me/verification/sessions/:sessionId/cancel` |
| Status | **NOT IMPLEMENTED** |
| Actor | Session owner |
| Policy | `canAccessOwnVerificationStatus` + session in cancellable state |

**Response 200 (PROPOSED):** `{ "data": { "status": "CANCELLED" }, "meta": { ... } }`

---

## Candidate: List sessions (optional)

| Field | Value |
|---|---|
| Method / path | `GET /v1/me/verification/sessions` |
| Status | **NOT IMPLEMENTED** — **PROPOSED** for support/history UX |
| Actor | Self only |
| Notes | Paginated; no PII payloads |

Defer until product confirms need vs single active session model.

---

## Candidate: Provider webhook

| Field | Value |
|---|---|
| Method / path | `POST /v1/webhooks/verification/:provider` |
| Status | **NOT IMPLEMENTED** |
| Actor | KYC provider (server-to-server) |
| Auth | **PROPOSED:** HMAC header or mTLS — **depends on KYC-02 vendor** |
| Bearer token | **Not used** |

**Preconditions:**

- Raw body preserved for signature verification
- `provider` path segment matches configured adapter

**Response (PROPOSED):**

- `200` when event accepted (including duplicate idempotent replay)
- `401`/`403` invalid signature
- `400` malformed payload

**Processing (PROPOSED):**

1. Verify signature
2. Upsert idempotency key `(provider, eventId)`
3. Load session by `providerSessionRef`
4. Apply state transition + append decision + update `User.identityVerificationStatus` when terminal

**Trust boundary:** Mobile apps **must not** call this route.

---

## Alignment with existing LIVE DTOs

`GET /v1/me/account` and login `user` object already include:

```json
"identityVerificationStatus": "NOT_STARTED | PENDING | APPROVED | REJECTED"
```

**CONFIRMED** enum in Prisma. Session-level states (`IN_REVIEW`, `EXPIRED`, `REVOKED`) may require enum extension or separate field — **UNRESOLVED** (see `KYC_REQUIREMENTS_DECISION_GATE.md`).

---

## Candidate denial responses (future activity/meetup APIs — **NOT LIVE**)

**PROPOSED** stable `error.code` values for **KYC-ENF** violations. Not registered in `CURRENT_APIS.md` until implemented and tested.

| Code | HTTP | When (approved policy) |
|---|---|---|
| `IDENTITY_VERIFICATION_REQUIRED` | 403 | Gated action; user not `APPROVED` (incl. not started / pending) |
| `IDENTITY_VERIFICATION_PENDING` | 403 | In-flight review; action blocked |
| `IDENTITY_VERIFICATION_REJECTED` | 403 | Rejected; retry per future KYC-04 |
| `IDENTITY_VERIFICATION_EXPIRED` | 403 | Was approved; no longer valid |
| `IDENTITY_VERIFICATION_REVOKED` | 403 | Revoked; ENF-04 restrictions apply |
| `IDENTITY_VERIFICATION_RESTRICTED` | 403 | ENF-04: upcoming participation temporarily restricted |
| `VERIFICATION_UNAVAILABLE` | 503 | No provider configured / outage (no fake success) |

Response body should include **actionable** non-sensitive hints for Flutter (e.g. `verificationStatus`, `canStartVerification` when session APIs exist) — shape **PROPOSED**.

---

## NOT LIVE inventory (this document)

| Method | Path | Status |
|---|---|---|
| `POST` | `/v1/me/verification/sessions` | **NOT IMPLEMENTED** |
| `GET` | `/v1/me/verification/sessions/:sessionId` | **NOT IMPLEMENTED** |
| `POST` | `/v1/me/verification/sessions/:sessionId/cancel` | **NOT IMPLEMENTED** |
| `GET` | `/v1/me/verification/sessions` | **NOT IMPLEMENTED** (optional) |
| `POST` | `/v1/webhooks/verification/:provider` | **NOT IMPLEMENTED** |

---

## Related documents

- `docs/api/CURRENT_APIS.md` — LIVE registry
- `docs/api/IDENTITY_API_DRAFT.md` — earlier draft (some routes still unbuilt)
- `docs/architecture/VERIFICATION_INTEGRATION_DESIGN.md`
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` §12 (planned KYC)
