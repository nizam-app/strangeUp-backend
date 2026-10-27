# KYC / Verification Acceptance Matrix (Planned — Not Executed)

**Status:** Task **002B.3A2** — cases derived from **APPROVED** KYC-01/03/05 and **KYC-ENF-01..05**. **No tests executed**; nothing marked PASS.
**Execution gate:** Task **002B.3B+** with KYC-02 provider path (or explicit non-fake stub policy), schema approval, and activity/meetup APIs.

**Layers (when implemented):** policy unit → API (supertest) → provider sandbox → PostgreSQL integration (native PG for races).

---

## Legend

| Column | Meaning |
|---|---|
| **Decision dep.** | Owner decision ID |
| **Status** | `PLANNED` — not run in CI |

---

## Session & authority (KYC-03)

| ID | Scenario | Layer | Acceptance criteria | Decision dep. | Status |
|---|---|---|---|---|---|
| K-P01 | Eligible user starts session | API | `201`, session non-terminal; user may → `PENDING` | KYC-02 | PLANNED |
| K-P02 | Provider webhook approve | Integration | User `APPROVED` only via validated webhook; decision audit row | KYC-03, KYC-02 | PLANNED |
| K-N05 | Client PATCH `identityVerificationStatus` | API | Rejected / ignored | KYC-03 | PLANNED |
| K-N06 | Client POST fake verified | API | No route; no state change | KYC-03 | PLANNED |
| K-N18 | Client-only UI shows verified | E2E/manual | Server still `NOT_STARTED`/`PENDING` | KYC-03, KYC-07 | PLANNED |

---

## KYC-ENF-01 — Join, RSVP, check-in, host publish

| ID | Scenario | Layer | Acceptance criteria | Status |
|---|---|---|---|---|
| K-E01-P01 | Confirm join in-person activity with valid KYC | API | `201`/success | PLANNED |
| K-E01-N01 | Confirm join in-person without KYC | API | Deny stable code (e.g. `IDENTITY_VERIFICATION_REQUIRED` **PROPOSED**); no confirmed seat | PLANNED |
| K-E01-P02 | Accept real-world meetup RSVP with valid KYC | API | Success | PLANNED |
| K-E01-N02 | Accept RSVP without KYC | API | Deny | PLANNED |
| K-E01-N03 | Check-in without current valid KYC (was approved at join) | API | Deny at check-in recheck | PLANNED |
| K-E01-P03 | Publish/activate in-person/hybrid activity with host KYC | API | Success | PLANNED |
| K-E01-N04 | Publish/activate without host KYC | API | Deny | PLANNED |

---

## KYC-ENF-02 — Waitlist & invitations

| ID | Scenario | Layer | Acceptance criteria | Status |
|---|---|---|---|---|
| K-E02-P01 | Join waitlist without KYC | API | Allowed | PLANNED |
| K-E02-N01 | Promote waitlist → confirmed without KYC | API | Deny | PLANNED |
| K-E02-P02 | Send real-world meetup invite with sender KYC | API | Success | PLANNED |
| K-E02-N02 | Send invite without sender KYC | API | Deny | PLANNED |
| K-E02-N03 | Recipient accepts without own KYC | API | Deny | PLANNED |

---

## KYC-ENF-03 — Virtual exemption

| ID | Scenario | Layer | Acceptance criteria | Status |
|---|---|---|---|---|
| K-E03-P01 | Join **100% virtual-only** activity without KYC | API | Success if other rules pass | PLANNED |
| K-E03-N01 | Join hybrid without KYC | API | Deny on confirm | PLANNED |
| K-E03-N02 | Mislabeled virtual (has in-person component) | API | Deny when modality = hybrid/in-person | PLANNED |

---

## KYC-ENF-04 — Expiry / revocation (no silent cancel)

| ID | Scenario | Layer | Acceptance criteria | Status |
|---|---|---|---|---|
| K-E04-N01 | New join after revocation | API | Deny | PLANNED |
| K-E04-N02 | New host publish after expiry | API | Deny | PLANNED |
| K-E04-N03 | Existing confirmed booking after revocation | API/DB | Record **still exists**; participation **restricted**; notification path triggered (stub OK in test) | PLANNED |
| K-E04-N04 | Silent delete of event on revocation | API/DB | **Must not** occur | PLANNED |

---

## KYC-05 — Data handling

| ID | Scenario | Layer | Acceptance criteria | Status |
|---|---|---|---|---|
| K-N16 | ID/selfie binary in REST body | API | Rejected / no route | PLANNED |
| K-N17 | Webhook/raw token in logs | Observability | Redacted | PLANNED |
| K-S05-01 | DB scan for document blobs | DB audit | None in StrangeUp tables | PLANNED |

---

## Webhook & concurrency

| ID | Scenario | Acceptance criteria | Status |
|---|---|---|---|
| K-N07 | Unsigned webhook | No `APPROVED` transition | PLANNED |
| K-N08 | Replay same `eventId` | Idempotent single decision | PLANNED |
| K-C01 | Parallel session starts | ≤1 active session policy | PLANNED |
| K-C05 | Race: promote waitlist vs KYC expiry | No confirmed participant without valid KYC | PLANNED |
| K-C06 | Race: check-in vs revocation webhook | Deny check-in if not valid at instant | PLANNED |

---

## Flutter-oriented (KYC-07 copy OPEN)

| ID | Scenario | Acceptance criteria | Status |
|---|---|---|---|
| K-F01 | Protected action without KYC | Prompt verification; no local badge | PLANNED |
| K-F02 | Waitlist UX | Allowed entry; blocked promotion messaging | PLANNED |
| K-F03 | Virtual-only path | No KYC prompt solely for KYC-01 | PLANNED |
| K-F04 | Expired/revoked | Block/guide; no fake success | PLANNED |

---

## Related documents

- `docs/product/KYC_OWNER_DECISIONS_002B3A2.md`
- `docs/product/KYC_REQUIREMENTS_DECISION_GATE.md`
- `docs/api/KYC_API_CANDIDATES.md`
