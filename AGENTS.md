# StrangeUp Repository Agent Instructions

- This repository is the backend for StrangeUp, Flutter mobile client, confirmed TypeScript/Node.js/Express/Prisma/PostgreSQL.
- Product spec is draft until owner explicitly accepts the decision register. PDF UI screens are **evidence of visual intent**, not permission to invent backend policy.
- Architecture proposal: modular monolith with limited module coupling and centrally enforced auth/privacy/blocks/entitlements.
- Read `docs/plans/STATUS.md`, `docs/product/OPEN_QUESTIONS.md`, `docs/product/PRD_DRAFT.md`, `docs/decisions/ADR-004-identity-phase1-owner-decisions.md`, and relevant ADR before significant work.
- **API documentation (mandatory):** On every change that implements, modifies, or removes an HTTP API, update `docs/api/CURRENT_APIS.md` (implemented routes) and `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` (integration impact) in the same change. Flutter consumes `CURRENT_APIS.md` as the live contract; drafts stay in `IDENTITY_API_DRAFT.md` / OpenAPI until promoted.
- **Inspect before modifying.** No code overwrite, wholesale refactor, destructive migrations, prod service calls or secret commits.
- Prefer small, reviewable changes; don't scaffold unused business modules or schemas.
- Controllers only handle transport/validation; business rules belong in services, auth/policy layer and domain.
- Validate and type all external input, redact private data, normalize errors and ensure resource-level ACL including sockets.
- Keep UTC instants + IANA schedule zones, idempotency and transaction-safety in critical operations.
- Tests and typechecks actually run before claiming success. Report commands, outputs, affected files, blockers and next step.
- Record significant decisions via ADR, implementation status separately from test status.
- No Figma modifications unless owner separately authorizes; current project instruction is read-only Figma.
