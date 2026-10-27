# StrangeUp — Pending KYC owner sign-off checklist (NOT APPROVED)

**Updated after Task 002B.3A3.** Vendor comparison: `KYC_VENDOR_EVALUATION.md`. Lifecycle: `KYC_LIFECYCLE_DECISION_OPTIONS.md`. Privacy: `KYC_PRIVACY_VENDOR_CHECKLIST.md`. These rows remain **not approved** until owner signs.

| Decision | Owner choice needed | Proposed direction (not approved) |
|---|---|---|
| KYC-02 | Provider + sandbox access + identity flow | Evaluate Stripe Identity, Persona, Veriff; choose based on actual Flutter flow, hosted evidence, privacy terms, pricing and US coverage. |
| KYC-04A | Session/attempt lifecycle, parallel attempts and retries | One active session per user; bounded retry/cooldown; webhook-safe state transitions. |
| KYC-04B | Appeal and outage | Provider-managed recheck/support referral; no StrangeUp local manual approval; keep restricted actions blocked. |
| KYC-04C | KYC expiry/revocation response | Block new gated operations; restrict existing upcoming bookings/hosts without silent cancellation; require resolution workflow, timing still open. |
| KYC-05 detail | Exactly which metadata and reason codes to retain | Minimal approved-purpose fields only; keep ID/selfie/biometric evidence vendor-hosted. |
| KYC-06 | US privacy/cross-border review | Formal counsel/vendor review of biometric notices, access from Bangladesh, retention/deletion, agreements. |
| KYC-07 | Flutter UX and consent copy | Design state-specific pending/rejected/expired/retry UX; no fake verified badge. |
| D-09-ops | Virtual→hybrid changes, waitlist timing, notification/remediation | Keep as decisions until Activity/Meetup contracts are defined. |

**Already APPROVED:** KYC-01, KYC-03, KYC-05 overarching data posture, KYC-ENF-01..05 (2026-10-26). Do not re-open or replace them silently.

**Current implementation status:** no KYC session APIs, KYC vendor/webhooks, or production KYC enforcement exist based on the last reported repository state. Confirm against actual source before modifying this statement.
