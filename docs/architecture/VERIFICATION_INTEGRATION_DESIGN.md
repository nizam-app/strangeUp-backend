# Verification Integration Design (Provider-Neutral Proposal)

**Status:** PROPOSAL — Tasks **002B.3A / 002B.3A1 / 002B.3A2**. **KYC-01, KYC-03, KYC-05** and **KYC-ENF-01..05** **APPROVED** (2026-10-26); **not enforced in code**. **No routes, migrations, or vendor code.**
**Aligns with:** ADR-004 D-09, `KYC_OWNER_DECISIONS_002B3A2.md`, `IDENTITY_DESIGN_PROPOSAL.md` §8, `account-policy.ts` stubs (read-only).

## 1. Domain boundary

```text
┌─────────────────────────────────────────────────────────────────┐
│                        User (account root)                       │
├──────────────┬──────────────┬──────────────────────────────────┤
│ Authentication│ Contact      │ Eligibility                       │
│ (sessions,   │ verification │ (ageEligibilityStatus from       │
│  password)    │ (email/phone)│  self-reported DOB + rules)      │
├──────────────┴──────────────┴──────────────────────────────────┤
│ Identity / KYC (government ID + liveness) — OPTIONAL vendor path │
│  - Session aggregate + append-only decisions                     │
│  - Summarized on User.identityVerificationStatus (coarse)        │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Must not conflate with |
|---|---|
| `emailVerifiedAt` / account `ACTIVE` | KYC approval |
| `ageEligibilityStatus = ELIGIBLE` | Government ID match |
| `identityVerificationStatus` | Subscription / `fullAccess` |
| `fullAccess` (today) | KYC — **CONFIRMED**: email + age + active, not KYC |
| Future `canParticipateOrHost` (computed) | Not a DB column; would combine account status, email, age, **identityVerification** when KYC-03 approved, plus activity/meetup rules — **PROPOSED** |

### Trust layers (**KYC-03 APPROVED**)

| Layer | Source | Independent of |
|---|---|---|
| Authentication | Session / JWT | KYC outcome |
| `emailVerified` | Email challenge | Gov ID |
| `ageEligibility` | Self-declared DOB + USA 18+ rule | Gov ID (**CONFIRMED** not identity proof) |
| `identityVerification` | **Only** trusted provider server-validated outcome → `APPROVED` | `fullAccess`, client UI, self-DOB |
| `canParticipateOrHost` | **Computed** server policy at sensitive transitions | Client-writable flags |
| Real-world participate/host | **APPROVED** KYC-ENF-01..04 | Signup, browse, 100% virtual-only |

**Session state vs user summary:** Provider session lifecycle (candidate: `CREATED`, `PENDING`, `IN_REVIEW`, …) is **not** the same as `User.identityVerificationStatus`. Mapping and enums are **OPEN** for 002B.3B design — do not assume Prisma fields exist.

**Module placement (PROPOSED):** new `trust` or `verification` module; webhooks isolated from `auth` bearer routes.

---

## 2. Provider adapter interface (no implementation)

```typescript
// PROPOSED — documentation only; not in src/

type ProviderSessionContext = {
  userId: string;
  locale?: string;
  idempotencyKey: string;
};

type ProviderSessionResult =
  | { kind: "SDK"; sdkToken: string; expiresAt: string }
  | { kind: "REDIRECT"; url: string; expiresAt: string };

type ProviderWebhookEvent = {
  provider: string;
  eventId: string;
  eventType: string;
  providerSessionRef: string;
  occurredAt: string;
  payload: unknown; // parsed only inside adapter
};

interface IdentityVerificationProvider {
  readonly providerId: string;

  createSession(ctx: ProviderSessionContext): Promise<ProviderSessionResult>;

  cancelSession(providerSessionRef: string): Promise<void>;

  parseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): ProviderWebhookEvent;

  mapEventToDecision(
    event: ProviderWebhookEvent,
  ): { decision: "APPROVE" | "REJECT" | "NEEDS_REVIEW"; reasonCode?: string };
}
```

**Failure contract (PROPOSED):**

| Failure | Caller behavior |
|---|---|
| Provider timeout | Return `503` / `VERIFICATION_PROVIDER_UNAVAILABLE` to client; session stays `PENDING_PROVIDER` or rolls back to cancellable state |
| Invalid webhook signature | `401`/`403` to provider; no state change |
| Unknown `providerSessionRef` | Log metric; `404` to provider (avoid oracle) |
| Adapter `mapEventToDecision` ambiguous | Transition to `IN_REVIEW`; alert ops |
| Provider outage mid-session | User may cancel; stale sessions expire via job |

Credentials (API keys, webhook secrets) live in **secret store only**; never in Flutter.

---

## 3. State machine (session + user summary)

### Session aggregate (`IdentityVerificationSession` — **NOT IN DB YET**)

```text
                    ┌──────────────┐
                    │ NOT_STARTED  │ (no row; user summary only)
                    └──────┬───────┘
                           │ POST session (policy ok)
                           ▼
                    ┌──────────────┐
         ┌─────────│ PENDING_USER │◄────────┐
         │         └──────┬───────┘         │ retry new session
         │ cancel       │ SDK submitted    │
         ▼                ▼                 │
    ┌──────────┐   ┌─────────────────┐     │
    │CANCELLED │   │ PENDING_PROVIDER│     │
    └──────────┘   └────────┬────────┘     │
                            │ webhook       │
              ┌─────────────┼─────────────┐ │
              ▼             ▼             ▼ │
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ APPROVED │ │ REJECTED │ │IN_REVIEW │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             │            │            ├──► manual decision
             ▼            ▼            ▼
        (terminal)   (terminal)   APPROVED / REJECTED

Any non-terminal ──timeout──► EXPIRED
APPROVED ──policy/time──► REVOKED (UNRESOLVED product rule)
```

**Transition authority (PROPOSED):**

| Transition | Authorized actor |
|---|---|
| → `PENDING_USER` | Authenticated user via `POST .../sessions` |
| → `PENDING_PROVIDER` | Provider SDK callback **or** server acknowledgment of upload complete (vendor-specific) |
| → `APPROVED` / `REJECTED` | Signed webhook or manual review service |
| → `CANCELLED` | User cancel endpoint or session TTL job |
| → `EXPIRED` | Scheduled job |
| → `REVOKED` | Admin/revocation webhook — **UNRESOLVED** |

**User-level `identityVerificationStatus` (existing enum):** updated **only** from terminal session outcomes or revocation job — never from client PATCH.

**Optimistic concurrency (PROPOSED):** `session.version` integer; webhook handler `UPDATE ... WHERE id = ? AND version = ?`; mismatch → reload and apply event to current state machine (idempotent).

**Out-of-order webhooks (PROPOSED):** Ignore regressions from lower precedence events once terminal; queue `NEEDS_REVIEW` on conflict; store raw event idempotency either way.

---

## 4. Client workflows (Flutter)

### Initiation

1. Client: `GET /v1/me/account` — check `canStartVerification` indirectly via `emailVerified`, `ageEligibilityStatus`, `identityVerificationStatus`.
2. Client: `POST /v1/me/verification/sessions` with optional `Idempotency-Key`.
3. Server: creates DB session, calls `provider.createSession`, returns **opaque** `sessionId`, `status`, `clientAction` (`SDK` | `REDIRECT`), `sdkToken` or `url`, `expiresAt`.
4. Flutter runs vendor SDK — **documents never POST to StrangeUp** in preferred model.

### Polling

- `GET /v1/me/verification/sessions/:sessionId` — owner only; returns status, timestamps, **no** images.

### Expiry / retry / cancel

- **PROPOSED** `POST /v1/me/verification/sessions/:sessionId/cancel` — user-initiated.
- Retry = new `POST` session if policy allows and no conflicting active session.
- On expiry, user summary may remain `NOT_STARTED` or `PENDING` until reconciler runs — exact rules **UNRESOLVED** (KYC-04).

### Trust boundaries for Flutter

| May receive | Must never receive |
|---|---|
| `sessionId`, public SDK token, redirect URL | Provider API secret, webhook signing key |
| Coarse `identityVerificationStatus` | Internal `reasonCode` for fraud cases (optional separate admin) |
| Generic rejection message | Other users’ verification state |

---

## 5. Webhooks (server-to-server)

**Route candidate:** `POST /v1/webhooks/verification/:provider` — see `KYC_API_CANDIDATES.md` (**NOT IMPLEMENTED**).

| Control | PROPOSED behavior |
|---|---|
| Authentication | HMAC signature or mTLS per vendor; constant-time compare |
| Replay | Persist `(provider, eventId)` unique; duplicate → `200` no-op |
| Ordering | Event handler idempotent per session + version check |
| Retries | Provider retries safe; respond fast after enqueue or sync process |
| Audit | Append `VerificationDecision` row per meaningful transition |
| Body size | Strict limit; reject unexpected binary |

**Never** accept mobile deep-link or client POST as proof of verification success.

---

## 6. Cross-module policy matrix (**APPROVED** — not LIVE)

**Source:** `KYC_OWNER_DECISIONS_002B3A2.md` §C. **No route enforces this today.**

| Operation | KYC required? | When to evaluate (server) | Notes |
|---|---|---|---|
| Register, login, email verify, own profile | **No** (KYC-01 alone) | Existing auth rules | Other gates may apply |
| Browse people/activities/meetups | **No** (KYC-01 alone) | D-03/D-04 visibility | |
| Confirm join **in-person** or **hybrid** activity | **Yes** | Before confirmed registration | KYC-ENF-01 |
| Activity **check-in** (in-person/hybrid) | **Yes** | At check-in | Recheck; prior accept insufficient |
| **Publish/activate** in-person/hybrid activity/meetup as host | **Yes** | Before publish/activation | Draft rules separate |
| Join **waitlist** | **No** | At waitlist entry | KYC-ENF-02 |
| Promote waitlist → **confirmed** participant | **Yes** | At promotion | |
| **Send** real-world meetup invitation | **Yes** (sender) | Before dispatch | |
| **Accept** real-world meetup RSVP | **Yes** (recipient) | Before acceptance confirmed | |
| **100% virtual-only** activity join/host | **No** (KYC-01 alone) | Other rules | Must be genuinely virtual-only |
| DM, follow, group join, marketplace | **Not** by these KYC decisions | Separate D-* | |
| After KYC **expiry/revocation** | Restrict new + upcoming | On status change + next sensitive action | No silent cancel — KYC-ENF-04 |

**Preconditions for gated ops (conceptual):** authenticated, permitted account status, age/email per existing policy, **`identityVerificationStatus` = current valid `APPROVED`** from provider path only (**KYC-03**).

**Implementation note:** Evaluate **`requiresGovernmentIdVerification(actor, operation, resource)`** (name TBD) at each **mutating** endpoint above. Flutter pre-checks are UX only.

Existing **`hasFullAccountAccess`** unchanged — **CONFIRMED** ADR-004.

---

## 7. Compliance, privacy, abuse

- **Data minimization:** **KYC-05 APPROVED** — provider-hosted evidence; minimal metadata on StrangeUp; retention/legal **OPEN**.
- **Redaction:** extend `redactSensitive` for webhook bodies and SDK tokens in logs.
- **Abuse:** rate-limit session creation; cap concurrent sessions; monitor repeated `REJECTED` (**PROPOSED**).
- **Account deletion:** **UNRESOLVED** — cancel active sessions, request provider deletion, retain audit per retention ADR.
- **No compliance claims** in code comments or API messages without counsel.

Operational failure modes: provider 5xx, webhook backlog, clock skew on signatures, stuck `PENDING_PROVIDER` — runbook **PROPOSED** for 002B.3B.

---

## 8. Provider selection checklist & phases

### Evaluation checklist (owner + engineering)

| Criterion | Notes |
|---|---|
| US ID document types | Match UI **PRIOR-EXPORT-REPORTED** #48 |
| Liveness / selfie | Match #49 |
| Flutter SDK quality | Maintenance, offline behavior |
| Webhook security model | HMAC version, IP allowlist optional |
| PII storage & subprocessors | DPA, deletion API |
| Sandbox / test mode | CI stub adapter |
| Pricing at MVP scale | **UNRESOLVED** |
| Manual review fallback | KYC-04 |

### Integration phases (PROPOSED)

| Phase | Deliverable |
|---|---|
| 3B | Schema + stub adapter (no external HTTP) **only if approved** |
| 3C | Sandbox vendor + webhook ingress |
| 3D | Production credentials, monitoring, runbooks |
| Rollback | Feature flag `VERIFICATION_PROVIDER=none`; stop creating sessions; keep read-only status |

If provider remains unselected, **recommendation:** keep verification APIs **unimplemented** rather than mock `APPROVED` (**CONFIRMED** D-09 spirit).

---

## 9. Adjacent work that can continue without KYC decisions

**CONFIRMED** per ADR-004 and current `STATUS.md`:

- Email/password auth, refresh, logout, password reset
- `/v1/me/account`, `/v1/me/profile` with existing gates
- Health checks, consent recording (version IDs still **release blocker**)
- Policy stubs for cross-user deny until D-03

---

## Related documents

- `docs/product/KYC_REQUIREMENTS_DECISION_GATE.md`
- `docs/security/KYC_DATA_HANDLING_AND_THREATS.md`
- `docs/api/KYC_API_CANDIDATES.md`
