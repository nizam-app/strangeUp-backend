# KYC-04 — Verification lifecycle decision options

**Status:** OPTIONS FOR OWNER REVIEW — Task **002B.3A3**. **KYC-04 not fully approved.** Partial bounds from **KYC-ENF-04** (expiry/revocation impact) are **OWNER-APPROVED**.
**Preserves:** KYC-03 (provider-only `APPROVED`), KYC-05 (minimal metadata), KYC-ENF-01..05.

---

## 1. Two layers (do not collapse)

### A. Provider session / attempt (workflow)

**Purpose:** One user-initiated verification try with a vendor.

**Candidate states (examples — vendor-dependent, NOT schema-approved):**

| State | Meaning |
|---|---|
| `CREATED` | StrangeUp row + vendor session created |
| `STARTED` / `PENDING_USER` | User in SDK/hosted flow |
| `SUBMITTED` / `PENDING_PROVIDER` | Media submitted; awaiting decision |
| `IN_REVIEW` | Provider or hybrid review queue |
| `APPROVED` | Terminal success for this session |
| `REJECTED` | Terminal failure |
| `EXPIRED` | Abandoned or TTL |
| `CANCELLED` | User or system cancelled |

### B. User identity trust summary (eligibility)

**Current Prisma (`OWNER-APPROVED engineering fact`):**

```text
IdentityVerificationStatus: NOT_STARTED | PENDING | APPROVED | REJECTED
```

**Gap vs policy:** Approved product language includes **EXPIRED** and **REVOKED** for gating ([KYC-ENF-04](KYC_OWNER_DECISIONS_002B3A2.md)). Adding enum values requires **owner + migration approval** in 002B.3B — not assumed here.

**PROPOSED mapping (options — pick one in 002B.3B planning):**

| Option | Approach |
|---|---|
| **M1** | Extend Prisma enum with `EXPIRED`, `REVOKED` |
| **M2** | Keep enum; add `identityVerificationValidUntil` + `revokedAt` instants |
| **M3** | Derive “valid for gate” from latest session terminal state + policy job |

---

## 2. Authority rules (**KYC-03 APPROVED**)

- Only **validated provider webhook** (or signed server-to-server equivalent) may transition user summary to `APPROVED`.
- SDK “completed” / Persona client callback / Veriff `Result.status` → **may update session only**, not final `APPROVED`.
- **No** StrangeUp manual approve in v1; provider manual review is OK.
- **No** test bypass in production builds.

---

## 3. Session concurrency & retries (**OPEN — proposals**)

| Topic | Option A (PROPOSED default) | Option B | Consequence |
|---|---|---|---|
| Active sessions | **One** non-terminal session per user | Allow N | Simpler idempotency vs UX for parallel devices |
| After `REJECTED` | Cooldown (e.g. 24h) before new session | Immediate retry | Abuse vs support load |
| Abandoned `STARTED` | Expire after TTL (e.g. 24–72h) | Keep open | Vendor session cost |
| Provider outage | Block new sessions; `VERIFICATION_UNAVAILABLE` | Queue requests | ENF gates stay blocked |
| Webhook delay | Poll vendor API with backoff; never auto-APPROVE | User-only retry | Stuck `PENDING` UX (KYC-07) |
| Duplicate webhook | Idempotent `(provider, eventId)` | — | Required for all vendors |
| Out-of-order events | Version / terminal-state precedence | — | See `VERIFICATION_INTEGRATION_DESIGN.md` |

---

## 4. Expiry & revocation (**partially APPROVED**)

**APPROVED (KYC-ENF-04):** On expiry/revocation → deny **new** real-world join/host; **temporarily restrict** upcoming confirmed participation/hosting; **no silent** delete/cancel of bookings/events; notification + organizer/admin resolution.

**Still OPEN (owner):**

| Question | PROPOSED handling |
|---|---|
| Grace period after expiry before restriction | 0 / 24h / until next action — **decide** |
| Seat on confirmed activity | Hold seat but block check-in vs release seat — **decide** |
| Host replacement | Organizer workflow — **decide** |
| Running in-progress event | Block check-in only vs broader — **decide** |
| Source of revocation | Provider webhook vs periodic re-verify job — **decide** |

---

## 5. Enforcement touchpoints (**KYC-ENF APPROVED**)

Re-evaluate **server-side** at:

1. Activity join **confirmation** (in-person/hybrid)
2. Waitlist **promotion**
3. Meetup invite **send** (sender KYC)
4. Meetup RSVP **accept** (recipient KYC)
5. Activity/meetup **publish/activate** (host)
6. **Check-in** (recheck)

**100% virtual-only:** exempt from KYC-01 gate.

**OPEN:** Virtual → hybrid reclassification; who owns modality flag; retroactive KYC requirement.

---

## 6. Appeals & support (**OPEN**)

| Option | Description |
|---|---|
| **P1** | User restarts new provider session only (no StrangeUp appeal queue) |
| **P2** | Support escalates to provider portal; no local `APPROVED` toggle |
| **P3** | Future manual review ADR (explicitly **out of scope** for KYC-03 v1) |

---

## 7. Owner sign-off checklist (KYC-04)

| ID | Decision | Status |
|---|---|---|
| L-01 | Session vs user state model (M1/M2/M3) | **OPEN** |
| L-02 | One vs many active sessions | **OPEN** |
| L-03 | Retry/cooldown after reject | **OPEN** |
| L-04 | Session TTL | **OPEN** |
| L-05 | Webhook-only vs poll fallback | **OPEN** |
| L-06 | Revocation source & re-verify cadence | **OPEN** |
| L-07 | ENF-04 remediation (seats, grace, host swap) | **OPEN** |
| L-08 | Virtual↔hybrid reclassification | **OPEN** |
| L-09 | Appeal path (P1/P2) | **OPEN** |

**Approved elsewhere:** provider-only `APPROVED` (KYC-03); non-destructive revocation impact (KYC-ENF-04).

---

## Related documents

- `docs/product/KYC_VENDOR_EVALUATION.md`
- `docs/testing/KYC_ACCEPTANCE_MATRIX.md`
- `docs/product/KYC_OWNER_DECISIONS_002B3A2.md`
