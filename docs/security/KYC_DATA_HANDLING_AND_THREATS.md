# KYC Data Handling & Threat Model (Proposal)

**Status:** **KYC-05 APPROVED (2026-10-26)** — data minimization **model** only. Retention, DPA, legal review, and exact metadata schema **OPEN**. **Not** a compliance certification.
**Scope:** Government identity verification and liveness flows described in exports **#34, #48, #49** (**PRIOR-EXPORT-REPORTED**).
**Owner handoff:** `docs/product/KYC_OWNER_DECISIONS_002B3A1.md` §4.

---

## KYC-05 approved model (implementation not authorized)

Owner-approved minimization posture. **No PII collection in this repository** until 002B.3B+ with provider and schema approval.

### Provider-hosted sensitive evidence (PROPOSED)

Government ID captures, selfie images, liveness video, and biometric templates/embeddings should remain with the **selected KYC provider** by default. Flutter SDK talks to the provider; StrangeUp orchestrates session state via server APIs when implemented.

### Minimal backend metadata allowlist (PROPOSED)

Candidate fields StrangeUp **may** persist after legal/provider review:

- Internal `userId`, verification `sessionId`
- Provider name / adapter id
- Opaque `providerSessionRef`
- Session and user summary **state**
- Non-sensitive standardized `reasonCode` (internal)
- `verifiedAt` / `updatedAt` / decision timestamps
- Webhook **idempotency** key (anonymized or hashed event id)
- Audited `source` (`PROVIDER_WEBHOOK`, future `MANUAL_REVIEW` if approved)

### Default deny list (PROPOSED)

Do **not** collect or persist by default: raw ID images or document numbers, selfie binaries, face templates, raw liveness video, provider API secrets, full webhook payloads, SDK URLs containing secrets, or identity fields in application logs.

### Still OPEN (require counsel / owner)

Retention and deletion periods, DPA/subprocessors, US state privacy and biometrics rules, cross-border access from Bangladesh, incident/appeal procedures, controller vs processor role, export/delete exceptions, and audit retention after account deletion.

---

## 1. Data classification (verification-specific)

Extends `docs/operations/DATA_CLASSIFICATION_AND_RETENTION.md`.

| Data element | Sensitivity | Preferred location | Backend storage (PROPOSED default) | Retention |
|---|---|---|---|---|
| Government ID image | **Critical PII** | Provider vault | **Do not store** on StrangeUp — **APPROVED (KYC-05)** | **UNRESOLVED** duration |
| Selfie / liveness video frames | **Biometric-adjacent** | Provider | **Do not store** on StrangeUp — **APPROVED (KYC-05)** | **UNRESOLVED** duration |
| Provider session / applicant id | **Sensitive reference** | Provider + StrangeUp DB | Opaque string, indexed | **UNRESOLVED** |
| Session status & timestamps | **Internal operational** | StrangeUp DB | Yes | **UNRESOLVED** |
| Decision audit (`APPROVE`/`REJECT`, source) | **Compliance / abuse** | StrangeUp DB append-only | Yes, minimal fields | **UNRESOLVED** |
| Internal `reasonCode` (fraud) | **Restricted** | StrangeUp DB | Yes; not in public DTO | **UNRESOLVED** |
| User-facing rejection message | **Low** | API response | Generic template | N/A |
| Webhook raw payload | **Critical** | Ephemeral processing | Avoid long-term storage; log redacted summary | **UNRESOLVED** |
| SDK launch token | **Secret** | Client memory | Never log full value | Short TTL |

**CONFIRMED principle:** Client must not upload ID binaries to StrangeUp REST APIs in the **preferred** architecture (`VERIFICATION_INTEGRATION_DESIGN.md`).

---

## 2. Trust boundaries

```text
 [Flutter]  ──HTTPS Bearer──►  [StrangeUp API]  ──HTTPS mTLS/API key──►  [KYC Provider]
     │                              │                                      │
     │  SDK token only              │  webhook HMAC                        │  ID/selfie
     └──────── SDK direct ─────────────────────────────────────────────────►│
```

| Boundary | Trust level | Implication |
|---|---|---|
| Flutter app | **Untrusted** | No verification success claims in request bodies |
| StrangeUp API | **Trusted orchestrator** | Owns session state machine |
| KYC provider | **Trusted processor** (contractual) | Source of truth for ID/liveness outcome |
| Webhook ingress | **Semi-trusted** | Authenticate every request; idempotent processing |
| Support / admin | **Privileged** | **UNRESOLVED** — break-glass access policy |

---

## 3. Threat model (STRIDE-oriented)

| Threat | Description | PROPOSED mitigations | Decision dependency |
|---|---|---|---|
| **Spoofing** | Attacker fakes provider webhook | Signature verification, secret rotation, optional IP allowlist | KYC-02 vendor |
| **Tampering** | Client PATCH sets `identityVerificationStatus` | No writable field on profile; server-only transitions | **CONFIRMED** pattern |
| **Repudiation** | Dispute over verification outcome | Append-only `VerificationDecision`; store `eventId` | KYC-05 retention |
| **Information disclosure** | BOLA on session status | Owner-only routes; 404 for other users’ session ids | API design |
| **Information disclosure** | ID images in logs/Sentry | Redaction; no binary in error reports | Engineering |
| **Denial of service** | Flood session creation | Rate limits (3/hour/user **PROPOSED** in draft API) | — |
| **Elevation** | Verified user bypasses suspension | Re-check `accountStatus` on every gated action | **CONFIRMED** security model |
| **Replay** | Duplicate webhook approves twice | Idempotency table | — |
| **Out-of-order** | Late “pending” after “approved” | Versioned session state machine | — |
| **Fake SDK success** | Malicious client shows UI badge | Poll server; badge from `GET /v1/me/account` only | KYC-07 |
| **Account enumeration** | Webhook reveals user existence | Opaque refs; generic errors | — |
| **Insider abuse** | Staff downloads ID from provider console | Vendor RBAC + audit; StrangeUp policy **UNRESOLVED** | KYC-05 |
| **Supply chain** | Compromised provider SDK | Pin SDK versions; monitor advisories | KYC-02 |

---

## 4. Logging and observability

| Allowed in structured logs | Forbidden |
|---|---|
| `sessionId`, `userId` (hashed optional), `provider`, `eventId`, coarse status | Full webhook body, SDK tokens, document metadata |
| Latency and error class from provider adapter | Government ID numbers, MRZ, face templates |

Align with existing `redactSensitive` for `Authorization` headers (**CONFIRMED** direction in identity tests).

---

## 5. Deletion and account lifecycle

| Event | PROPOSED handling | Status |
|---|---|---|
| User requests account delete | Cancel open sessions; stop webhooks processing | **UNRESOLVED** workflow |
| Provider deletion API | Invoke if contract requires | **UNRESOLVED** |
| Retain audit for disputes | Legal hold exception | **UNRESOLVED** |
| Suspended user | Deny new sessions; ignore late approve webhooks or quarantine | **PROPOSED** |

---

## 6. Open items requiring counsel / owner

- Whether StrangeUp is controller vs processor for verification data
- State privacy notices and consent copy for biometric processing
- Cross-border transfer (Bangladesh engineering access to production logs/DB)
- Mandatory breach notification playbooks for verification vendor incidents

---

## Related documents

- `docs/security/KYC_PRIVACY_VENDOR_CHECKLIST.md` — counsel/vendor questions (Task 002B.3A3)
- `docs/security/SECURITY_MODEL.md`
- `docs/security/PERMISSIONS_MATRIX.md`
- `docs/product/KYC_REQUIREMENTS_DECISION_GATE.md`
- `docs/architecture/VERIFICATION_INTEGRATION_DESIGN.md`
