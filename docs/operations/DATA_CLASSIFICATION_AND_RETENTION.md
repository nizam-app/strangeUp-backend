# Data Classification & Retention Decision Template

**Status:** Proposed control framework; no region-specific retention or user-consent policies approved. Do not treat this as legal advice or a finalized retention schedule.

| Data class | Example | Default protection (engineering proposal) | Deletion/retention policy |
|---|---|---|---|
| Public profile | display name, bio, interests | authorized/public DTO according to visibility | UNRESOLVED |
| Private account | email, phone, DOB | restricted own-account and trusted ops only; encrypted transport | UNRESOLVED |
| Credentials | password hashes, refresh token hashes, reset tokens | hashed secret with expiration and revocation | UNRESOLVED |
| Identity verification | KYC provider session, ID details, selfie/liveness | provider references/minimize originals; strictly audited | UNRESOLVED; do not ingest documents without decision |
| Precise location | home, meetup point, raw coordinates | never default-public; coarse geodiscovery outward | UNRESOLVED |
| Private messages | conversation text/media | participant-scoped access, privacy-aware logging | UNRESOLVED; E2EE not designed |
| User-generated content | posts, comments, Stories | visibility ACL and moderation reporting | UNRESOLVED; Story 24h UI is not full deletion policy |
| Billing | provider purchase event, subscription lifecycle, refunds | signed receipts and immutable event audit; no PAN/CVV | UNRESOLVED per regional finance laws |
| Merchandise order | address, receipt, fulfillment | order-role ACL, payment tokenization | UNRESOLVED |
| Abuse reports/audit | evidence, actions, appeals | moderator-scoped, tamper-resistant audit | UNRESOLVED |

## Open safeguards

- Define purpose/consent and allowed processing for each class, including third-party provider and cross-border transfer.
- Identity and biometric data should not be casually collected by StrangeUp servers. Determine a trusted provider and documented retention policy first.
- Implement account deletion, export, retention exceptions and backup deletion windows only after applicable jurisdictions are established.
- Prevent hidden leaks via logs, analytics, error handlers, push previews, support dashboards, backups and test fixtures.
