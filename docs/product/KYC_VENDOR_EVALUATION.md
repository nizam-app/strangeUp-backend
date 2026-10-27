# KYC-02 — Vendor evaluation (Stripe Identity, Persona, Veriff)

**Status:** DUE DILIGENCE — **no provider selected** (Task 002B.3A3, 2026-10-26).
**Owner policy (unchanged):** KYC-01, KYC-03, KYC-05, KYC-ENF-01..05 **APPROVED** — see `KYC_OWNER_DECISIONS_002B3A2.md`.
**Launch context:** USA-first consumer mobile; engineering in Bangladesh; legal entity / contracting **NOT VERIFIED** for any vendor.

## Evidence legend

| Tag | Meaning |
|---|---|
| **VENDOR-DOCUMENTED** | Stated in vendor official docs (URL + access date) |
| **OWNER-APPROVED** | StrangeUp product policy |
| **NOT VERIFIED** | Not confirmed from primary sources in this review |
| **PROPOSED** | Engineering recommendation only |

**Access date for vendor docs cited below:** 2026-10-26.

---

## Comparison matrix (compact)

| Criterion | Stripe Identity | Persona | Veriff |
|---|---|---|---|
| **Gov ID + selfie / liveness** | **VENDOR-DOCUMENTED** — `type: document` includes document authenticity + optional selfie ([Verification Sessions API](https://docs.stripe.com/identity/verification-sessions)) | **VENDOR-DOCUMENTED** — inquiry templates with gov ID + selfie verifications ([integration methods](https://docs.withpersona.com/2025-10-27/choosing-an-integration-method.md)) | **VENDOR-DOCUMENTED** — Document + Selfie IDV ([devdocs](https://devdocs.veriff.com/docs/document-selfie-idv)) |
| **US documents** | **VENDOR-DOCUMENTED** — marketing cites US DL example + global IDs ([stripe.com/identity](https://stripe.com/identity)); restrict accepted ID types supported per docs | **VENDOR-DOCUMENTED** — US templates common; exact ID list per inquiry template — **NOT VERIFIED** for StrangeUp template | **VENDOR-DOCUMENTED** — US supported; hybrid/full-auto engines ([document-selfie-idv](https://devdocs.veriff.com/docs/document-selfie-idv)) |
| **Server-created session** | **VENDOR-DOCUMENTED** — `POST /v1/identity/verification_sessions` | **VENDOR-DOCUMENTED** — create inquiry via API ([hosted flow tutorial](https://docs.withpersona.com/2025-10-27/tutorial-hosted-flow-unique-api.md)) | **VENDOR-DOCUMENTED** — `POST /sessions` → `verification.url` ([document-selfie-idv](https://devdocs.veriff.com/docs/document-selfie-idv)) |
| **Flutter / mobile UX** | **VENDOR-DOCUMENTED** — native Identity Verification Sheet; server returns session id + ephemeral key ([iOS integration](https://docs.stripe.com/identity/verify-identity-documents?platform=ios&type=new-integration)). Community `flutter_stripe` identity PR merged 2026-01 — **NOT VERIFIED** against StrangeUp’s pinned Stripe SDK version | **VENDOR-DOCUMENTED** — Mobile SDK + third-party `persona_flutter` on pub.dev wrapping native v2 SDKs ([persona_flutter](https://pub.dev/packages/persona_flutter)); Hosted Flow leaves app ([choosing integration](https://docs.withpersona.com/2025-10-27/choosing-an-integration-method.md)) | **VENDOR-DOCUMENTED** — official `veriff_flutter` plugin; `Veriff.start(Configuration(sessionUrl))` ([Flutter plugin](https://devdocs.veriff.com/docs/flutter-plugin)) |
| **Webhook / decision authority** | **VENDOR-DOCUMENTED** — `identity.verification_session.verified` / `requires_input`; Stripe recommends webhooks ([verification sessions](https://docs.stripe.com/identity/verification-sessions)) | **VENDOR-DOCUMENTED** — `inquiry.approved` / `declined` / `failed`; **webhooks required** for reliable status ([accessing inquiry status](https://docs.withpersona.com/accessing-inquiry-status.md)) | **VENDOR-DOCUMENTED** — **decision webhook** for doc+selfie IDV ([webhooks guide](https://devdocs.veriff.com/docs/webhooks-guide)) |
| **Webhook signature** | **VENDOR-DOCUMENTED** — `Stripe-Signature` + `constructEvent` ([signatures](https://docs.stripe.com/webhooks/signatures)) | **NOT VERIFIED** — dashboard webhooks + IP lists documented ([security](https://docs.withpersona.com/security.md), [webhooks](https://docs.withpersona.com/webhooks)); confirm signing scheme in Persona webhook quickstart before build | **VENDOR-DOCUMENTED** — `X-HMAC-SIGNATURE` HMAC-SHA256 on raw body ([webhooks guide](https://devdocs.veriff.com/docs/webhooks-guide)) |
| **Out-of-order / replay** | **VENDOR-DOCUMENTED** — event id + idempotent handler pattern; Stripe retries webhooks (general Stripe behavior) | **VENDOR-DOCUMENTED** — delivery order not guaranteed; exponential retry up to 7 times ([webhooks](https://docs.withpersona.com/webhooks)) | **VENDOR-DOCUMENTED** — implement idempotency on decision webhook; retries documented in guide |
| **Sandbox / test** | **VENDOR-DOCUMENTED** — test mode + Dashboard ([Stripe Identity](https://stripe.com/identity)) | **VENDOR-DOCUMENTED** — sandbox environment in Mobile SDK / Hosted Flow | **VENDOR-DOCUMENTED** — sandbox integrations in Customer Portal — **NOT VERIFIED** for BD entity signup |
| **Session lifecycle** | **VENDOR-DOCUMENTED** — `verified`, `requires_input`, `processing`, `canceled`; redact API ([verification sessions](https://docs.stripe.com/identity/verification-sessions)) | **VENDOR-DOCUMENTED** — inquiry statuses incl. `approved`, `declined`; post-inquiry workflows may delay final status ([accessing inquiry status](https://docs.withpersona.com/accessing-inquiry-status.md)) | **VENDOR-DOCUMENTED** — SDK returns flow status; **authoritative decision via webhook** ([Flutter plugin](https://devdocs.veriff.com/docs/flutter-plugin)) |
| **Provider manual review** | **VENDOR-DOCUMENTED** — ML + manual review mentioned on marketing page | **VENDOR-DOCUMENTED** — workflows / manual review possible; aligns with **no StrangeUp manual approve** (KYC-03) | **VENDOR-DOCUMENTED** — Hybrid engine uses specialists ([document-selfie-idv](https://devdocs.veriff.com/docs/document-selfie-idv)) |
| **Data minimization / redaction** | **VENDOR-DOCUMENTED** — VerificationSession redact; PII not in metadata; sensitive data isolated from merchant systems ([stripe.com/identity](https://stripe.com/identity), redact API) | **VENDOR-DOCUMENTED** — webhook attribute blocklists; default can omit sensitive `included` objects ([webhook allowlists](https://docs.withpersona.com/webhook-allowlists.md)) | **VENDOR-DOCUMENTED** — decision webhook can include extracted fields — **minimize parsed fields** per KYC-05 |
| **Retention / deletion** | **VENDOR-DOCUMENTED** — programmatic redact/delete via API; redaction async up to ~4 days | **VENDOR-DOCUMENTED** — webhook events 30-day retention ([webhooks](https://docs.withpersona.com/webhooks)); account/data retention — **NOT VERIFIED** contractually | **NOT VERIFIED** — deletion APIs / retention periods require DPA review |
| **Pricing (public)** | **VENDOR-DOCUMENTED** — **$1.50** per completed ID+selfie verification; first **50** free; volume/custom pricing ([stripe.com/identity](https://stripe.com/identity)) | **NOT VERIFIED** — no public list price reviewed | **NOT VERIFIED** — no public list price reviewed |
| **Bangladesh engineering access** | **NOT VERIFIED** — Stripe Dashboard/API access from BD; no geo block cited | **NOT VERIFIED** — Persona dashboard from BD | **NOT VERIFIED** — Veriff portal from BD |
| **StrangeUp legal entity onboarding** | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |

---

## Fit vs owner-approved policy

| Requirement | Notes |
|---|---|
| **KYC-03** (provider-only `APPROVED`) | All three support server-side decision via webhooks; **must not** trust mobile SDK completion alone (Persona explicitly; Veriff; Stripe async processing). |
| **KYC-05** (provider-hosted evidence) | All three market hosted capture; StrangeUp must configure webhooks/API parsing to **avoid persisting** document images and biometrics. |
| **KYC-ENF** (recheck at check-in) | Requires StrangeUp to store **current validity** of provider decision + optional re-verification triggers — **product/engineering**, not vendor-specific. |
| **No StrangeUp manual approval** | Provider hybrid/manual review is acceptable; internal admin toggle is **not** (KYC-03). |

---

## Proposed shortlist (not a selection)

| Tier | Vendor | Rationale (PROPOSED) |
|---|---|---|
| **A** | **Stripe Identity** | Single vendor if payments later; documented Flutter path via Stripe SDK; clear session + redact APIs; public US pricing. |
| **A** | **Veriff** | Strong IDV-focused docs; official Flutter plugin; explicit HMAC webhooks; hybrid review without StrangeUp ops. |
| **B** | **Persona** | Flexible inquiries/workflows; excellent webhook payload controls for minimization; confirm webhook signing + Flutter package ownership/maintenance. |

**Conditional recommendation (PROPOSED — owner must select):**

- Prefer **Stripe Identity** if StrangeUp will use Stripe for payments/payouts soon and wants one compliance relationship.
- Prefer **Veriff** if identity is the primary integration surface and team wants IDV-specialist docs + Flutter plugin from vendor.
- Prefer **Persona** if product needs configurable inquiry workflows and hosted flow for rapid pilot — accept leaving app for Hosted Flow or invest in Mobile SDK.

---

## Owner selection questions (KYC-02)

1. Which **legal entity** signs the agreement (USA entity? Bangladesh dev company?) — affects vendor KYB.
2. **In-app only** vs acceptable **hosted redirect** for MVP?
3. Required **US ID types** (driver license, state ID, passport only?) — validate per vendor template/integration.
4. Accept **provider hybrid manual review** latency for `IN_REVIEW` states?
5. **Pricing model** at expected monthly volume; minimum commits (**NOT VERIFIED** for Persona/Veriff).
6. **Data residency / subprocessors** and deletion SLAs for USA users.
7. Can engineering staff in **Bangladesh** access sandbox PII in dashboards (role-based deny)?
8. Need **SSN/id_number** lookup or **document-only** sufficient?

---

## Integration risks (all vendors)

- **SDK callback vs webhook:** Implement KYC-03 only on webhook + server poll fallback with idempotency.
- **Duplicate inquiries/sessions:** User taps “verify” twice — enforce one active session (KYC-04 proposal).
- **No vendor selected:** 002B.3B must not emit `APPROVED` in production.

---

## Related documents

- `docs/product/KYC_LIFECYCLE_DECISION_OPTIONS.md`
- `docs/security/KYC_PRIVACY_VENDOR_CHECKLIST.md`
- `docs/product/KYC_REQUIREMENTS_DECISION_GATE.md`
- `docs/architecture/VERIFICATION_INTEGRATION_DESIGN.md`
