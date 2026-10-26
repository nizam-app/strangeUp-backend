# Trust, Privacy and Security — Proposed Security Baseline

**Pending owner inputs:** launch countries, eligibility/age policy, identity provider, messaging confidentiality objective, location precision, user retention/deletion, safety escalation rules.

## Trust boundaries

- Flutter client is untrusted: any premium badge, verified badge, profile visibility, chat permission, ID status or checkout success must be server-verified.
- REST and sockets are authenticated; every resource mutation checks current resource-level eligibility.
- Passwords: strong modern hashing, configurable cost; refresh credentials server-side hashed and revocable as appropriate; rate-limit high-risk routes.
- External social auth verifies issuer/audience/nonce and safe account linking; do not merge accounts solely because email matches without trusted proof.
- Moderation/audit actions require least privilege and explicit role assignment.
- Hard credential/secret boundaries: `.env.example` contains placeholders only; no secrets in Git, logs, screenshots or prompts.

## Central policy proposal

`mayViewProfile(actor,target)`, `mayDiscover(actor,target)`, `mayContact(actor,target,channel)`, `mayJoinActivity(actor,activity)`, `mayAccessGroup(actor,group)`, `mayReadConversation(actor,conversation)`, `maySendMessage(actor,conversation)`, `mayViewMeetup(actor,invite)`.

Every policy evaluates actor session status, block relationships, trust state, resource visibility, membership/roles and feature entitlement as applicable. The exact allowed/denied matrix is unresolved; default to deny when business rule unavailable.

## Sensitive data handling

- Keep government ID and selfie records separate from public profiles; prefer trusted KYC provider with narrowly scoped references over raw storage.
- Do not implement facial matching/liveness internally merely based on UI artwork; agree on provider, retention, deletion, regional compliance.
- Store coarse discovery location separately from private address and precise meeting venue. Avoid exposing coordinates, visit patterns or active presence by default.
- Protect user reports and blocked relationships from abusive enumeration; moderate user-generated content before operational launch.
- Apply secure logging redaction for auth tokens, phone/email, ID metadata, payment and location secrets.

## App-store-specific safety considerations

- Apple App Review Guideline 1.2 describes UGC moderation, reporting and blocking obligations; implementation needs appropriate operational response process.
- Digital dating/social app subscriptions generally fall under Apple IAP / Google Play Billing requirements subject to policy exceptions and local storefront rules; physical merchandise uses distinct permitted external/physical-goods payments. Verify launch-country requirements before release.
- Reference policies checked 2026-10-26: https://developer.apple.com/app-store/review/guidelines/ and https://support.google.com/googleplay/android-developer/answer/10281818?hl=en .
- No unsupported '100% verified' or 'End-to-End Encrypted' copy is considered validated by this architecture.

## Mandatory test classes

Broken object-level authorization (BOLA), mass assignment, account enumeration, rate limit bypass, webhook replay, block/suspension bypass, media permission bypass, duplicate invite, concurrent activity seats, subscription refund/expiration, location precision leakage, account deletion and recovery.
