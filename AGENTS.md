# StrangeUp Repository Agent Instructions

## Responsibility boundary (permanent)

- **This repository is backend development only** for StrangeUp: TypeScript / Node.js / Express / Prisma / PostgreSQL.
- The **Flutter mobile application lives in a separate repository** and is owned by a separate Flutter developer.
- **Do not** request Flutter repository access, implement Flutter screens, modify Flutter source, or wire APIs into the mobile app.
- **Do** build the complete backend required by actual Figma user flows, and publish integration contracts via `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, and relevant OpenAPI specs for the Flutter developer.

## Backend feature workflow

For every backend feature:

1. Inspect the corresponding **Figma** screens (read-only; use `design-reference/` and verified export manifests).
2. Identify required **business behavior** and **owner-approved** rules (ADRs, decision registers — do not invent policy).
3. Design **database models**, relationships, validations, and permissions.
4. Implement **production-oriented** APIs and services.
5. Add **unit, integration, authorization, and negative-path** tests.
6. Update **`CURRENT_APIS.md`**, **`FLUTTER_DEVELOPER_HANDOFF.md`**, relevant OpenAPI, **`docs/plans/STATUS.md`**, **`docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`**, and **`docs/plans/MASTER_DEFERRED_WORK_QUEUE.md`** in the same change set as route work (or any change that adds, removes, or reclassifies deferred, partial, owner-blocked, or release-blocking scope).
7. Provide a complete **API integration contract** for the separate Flutter developer (no Flutter implementation in this repo).

## Product and architecture

- Product spec is draft until the owner explicitly accepts the decision register. PDF/Figma UI screens are **evidence of visual intent**, not permission to invent backend policy.
- Architecture: modular monolith with limited module coupling and centrally enforced auth/privacy/blocks/entitlements.
- Read `docs/plans/STATUS.md`, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`, **`docs/plans/MASTER_DEFERRED_WORK_QUEUE.md`**, `docs/product/OPEN_QUESTIONS.md`, `docs/product/PRD_DRAFT.md`, `docs/decisions/ADR-004-identity-phase1-owner-decisions.md`, and relevant ADRs before significant work.
- Preserve approved requirements and security gates (KYC-01/03/05, KYC-ENF-01..05, D-01, D-02, D-02-AUTH, D-09). Keep **Stripe**, **KYC vendor integration**, and other explicitly deferred integrations documented — do not implement them without authorization.

## API documentation (mandatory)

On every change that implements, modifies, or removes an HTTP API, update `docs/api/CURRENT_APIS.md` (implemented routes) and `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` (integration impact for the external Flutter repo). Drafts stay in `IDENTITY_API_DRAFT.md` / OpenAPI until promoted.

## Engineering discipline

- **Inspect before modifying.** No code overwrite, wholesale refactor, destructive migrations, prod service calls, or secret commits.
- Prefer small, reviewable changes; don't scaffold unused business modules or schemas.
- Controllers only handle transport/validation; business rules belong in services, auth/policy layer, and domain.
- Validate and type all external input, redact private data, normalize errors, and ensure resource-level ACL including sockets.
- Keep UTC instants + IANA schedule zones, idempotency, and transaction-safety in critical operations.
- Tests and typechecks must actually run before claiming success. Report commands, outputs, affected files, blockers, and next step.
- Record significant decisions via ADR; separate implementation status from test status.
- **Do not** commit, push, deploy, change production, or implement **unapproved** behavior without explicit owner authorization.
- No Figma modifications unless the owner separately authorizes; current project instruction is read-only Figma.
