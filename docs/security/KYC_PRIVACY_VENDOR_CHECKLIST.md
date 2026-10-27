# KYC-05 / KYC-06 — Privacy & vendor diligence checklist

**Status:** HANDOFF FOR COUNSEL + OWNER — Task **002B.3A3**. **Not legal advice.** **KYC-05 model APPROVED**; field-level retention and compliance **OPEN**.

**Approved posture (OWNER-APPROVED):** Provider hosts ID/selfie/biometrics; StrangeUp stores **minimal necessary non-document metadata** only.

---

## 1. Proposed metadata allowlist (schema review — NOT approved field-by-field)

Evaluate each field before Prisma migration:

| Field | Purpose | Store? (proposal) | Notes |
|---|---|---|---|
| `userId` (internal UUID) | Link session to account | **PROPOSED yes** | Required |
| `verificationSessionId` (internal) | StrangeUp session row | **PROPOSED yes** | Required |
| `provider` | Adapter id (`stripe`, `persona`, `veriff`) | **PROPOSED yes** | Required |
| `providerSessionRef` | Opaque vendor session/inquiry id | **PROPOSED yes** | No document content |
| `normalizedState` | Session or summary state enum | **PROPOSED yes** | Map vendor → canonical |
| `decisionCode` | Safe reason code (no PII) | **PROPOSED yes** | Map vendor codes |
| `createdAt` / `updatedAt` / `completedAt` | Audit | **PROPOSED yes** | UTC |
| `validUntil` | If using time-bound KYC | **PROPOSED optional** | Needs KYC-04 approval |
| `providerEventId` | Webhook idempotency | **PROPOSED yes** | Hash if needed |
| `transitionSource` | `WEBHOOK`, `SYSTEM_JOB` | **PROPOSED yes** | Audit |
| `verifiedOutputsDigest` | Hash of vendor decision | **PROPOSED optional** | Avoid raw PII |

**Default deny (KYC-05 APPROVED):** raw ID image/number, selfie, biometric template, liveness video, full webhook JSON, provider secrets, presigned URLs with secrets, document MRZ in logs.

---

## 2. Questions for identity vendor (per shortlist)

Use with `KYC_VENDOR_EVALUATION.md` — attach answers to KYC-02 decision.

| # | Question |
|---|---|
| V1 | Where is **USA end-user** PII processed and stored (regions)? |
| V2 | **Subprocessors** list and notification process? |
| V3 | **Deletion / redaction** API and SLA after account delete request? |
| V4 | What fields appear in **webhooks** by default; how to minimize `included` payloads? |
| V5 | **Retention** of verification media and decisions (defaults)? |
| V6 | **Biometric** processing notice requirements for US users? |
| V7 | **Dashboard access** controls — can BD staff be denied production PII view? |
| V8 | **Breach** notification timelines and contact? |
| V9 | **SOC 2** / ISO reports available under NDA? |
| V10 | Contracting entity requirements (US LLC vs foreign dev company)? |

---

## 3. Questions for counsel (KYC-06)

| # | Topic |
|---|---|
| C1 | USA **state privacy** (incl. biometrics) for gov ID + selfie verification |
| C2 | **Notice and consent** copy before launching verification UI |
| C3 | StrangeUp role as **controller vs processor** for metadata vs vendor-held evidence |
| C4 | **Cross-border** access: Bangladesh engineering to production DB/logs containing metadata |
| C5 | **DSAR** export/delete interplay: StrangeUp account delete + vendor redact |
| C6 | **Retention** maximum/minimum for audit logs without fixed engineering number |
| C7 | Marketing “verified community” vs **KYC-ENF** actual gates |

---

## 4. Engineering controls (when implemented — PROPOSED)

- Webhook signature verification mandatory before state change.
- Separate **sandbox** and **production** secrets; no PII in non-prod logs.
- Restrict production dashboard to named roles; prefer vendor APIs over dashboard for ops.
- `redactSensitive` coverage for verification routes.

---

## Related documents

- `docs/operations/DATA_CLASSIFICATION_AND_RETENTION.md`
- `docs/security/KYC_DATA_HANDLING_AND_THREATS.md`
- `docs/product/KYC_VENDOR_EVALUATION.md`
