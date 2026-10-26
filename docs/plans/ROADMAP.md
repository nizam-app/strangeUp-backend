# StrangeUp Recommended Roadmap — Proposal

**M0.1 (completed for exported source):** 49 PDF inspection; 39 meaningful UI screens/variants inventory; initial gaps & backend module mapping. Live Figma prototype not reviewed.

**M0.2 (draft assembled; awaiting owner approval):** evidence traceability, PRD, roadmap and conceptual domain rules; decide launch regions, gating, contact, social, meetup, group and activity state flows; revenue/marketplace scope.

**M1.0 (safe to begin independently):** local backend foundation, typed Express bootstrap, env config, Prisma/Postgres local setup, basic health/error/request ID/logging, test setup and CI. NO product schema.

**M1.1 (after decisions):** domain-level system/API/ERD sign-off; actor-policy and data-retention acceptance matrix; first migrations for User/Auth/Profile, not entire app.

**M2:** identity + profile + privacy + basic trust status + blocking/reporting and minimal moderation operations. Review actual ID provider; never treat email verification as age/ID verification.

**M3:** activity booking/join approvals/waitlist/host controls + groups membership/admin + discovery scoped by privacy.

**M4:** direct messaging + message requests + personal meetups + notification center; conditional group chat.

**M5 (explicit scope decision):** digital subscription entitlement/purchase integration, physical merch store payment/fulfillment; Jobs, Stories, poll/feed enhancements by product priority.

**M6:** extensive security, failure/reliability testing, monitoring, backups, data deletion, restore, deployment, store submission readiness.

## Dependencies and gates

- No production-facing discovery/contact endpoints until block/privacy/verification gates are enforced.
- No paid launch until product/store billing rules, SKU/tax/pricing and provider lifecycle are formally decided/tested.
- No user-generated-content release without report/block/moderation operations, abuse-handling and safe privacy defaults.
- Hosting decision deferred until scale/cost/data residency known.
- Never label a milestone complete without recorded evidence and signed-off rules.
