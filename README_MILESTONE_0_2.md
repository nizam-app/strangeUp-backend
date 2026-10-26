# StrangeUp — Milestone 0.2 / Product Specification & Engineering Baseline

**Status:** DRAFT / FOR OWNER REVIEW — NOT AN APPROVAL OF PRODUCT BUSINESS RULES.  
**Source:** `Strange up.zip` supplied by the owner: 49 PDF exports, of which 39 are meaningful UI screens/variants and 10 auxiliary assets. Original Figma prototype connections and source hierarchy were not accessible.  
**Also consulted:** supplied StrangeUp Master Engineering Agent Prompt and Phase 0 discovery report.  
**Stack fixed by owner:** Node.js, TypeScript, Express.js, Prisma, PostgreSQL; Flutter client; Cursor IDE; Git.  
**Architecture recommendation:** modular monolith, proposed until recorded as approved.

## What this package establishes

- A complete **source-evidence boundary**: an observed UI action is not automatically an approved backend rule.
- A prioritized, explicit MVP recommendation with separately tracked unresolved choices.
- Preliminary domain boundaries, permission model, candidate data model, API conventions and security controls.
- Three deliberately separate state-machine proposals: activities, group membership and personal meetup invites.
- Safety and compliance review gates; critically, do not implement claims of 100% identity assurance or end-to-end encryption merely because they appear as marketing text.
- Safe, bounded Cursor Task 001, limited to the backend foundation; no guessed business schema or feature implementation.

## Evidence classification

- **CONFIRMED**: directly instructed by owner or formally approved.
- **OBSERVED**: visible in supplied PDF screens; not proof of backend behavior or approved scope.
- **PROPOSED**: engineering recommendation, reversible until accepted.
- **UNRESOLVED**: decision still needed before consequential implementation.
- **OUT_OF_SCOPE_FOR_MVP (PROPOSED)**: suggested sequencing, not a rejection of the feature.

## Recommended read order

1. `docs/product/PRD_DRAFT.md`
2. `docs/product/FEATURE_MATRIX.md` and `docs/product/SCREEN_TRACEABILITY.md`
3. `docs/product/BUSINESS_RULES.md`, `docs/product/USER_FLOWS.md`
4. `docs/product/OPEN_QUESTIONS.md`
5. `docs/architecture/SYSTEM.md`, `docs/architecture/MODULES.md`, `docs/database/DATA_MODEL.md`
6. `docs/security/SECURITY_MODEL.md`, `docs/security/PERMISSIONS_MATRIX.md`, `docs/operations/DATA_CLASSIFICATION_AND_RETENTION.md`
7. `docs/api/CONVENTIONS.md`, `docs/api/ENDPOINT_CANDIDATES.md`, `docs/testing/TEST_STRATEGY.md`
8. `docs/plans/ROADMAP.md` and `docs/plans/STATUS.md`
9. `cursor_tasks/TASK_001_BACKEND_FOUNDATION.md`

## Rules before code

- Do not convert examples in Figma into production data or pricing configuration.
- Do not choose a biometric KYC provider, messaging E2EE protocol, payments provider, launch region or verification standard without review.
- Do not implement a UI-only permission check. All authorization is server-side.
- Do not create hundreds of Prisma tables or unused modules in Task 001.
- Do not run production migrations, provision infrastructure, buy services or modify original Figma.
- Version-control this package; track approvals with ADRs / signed-off PRD decisions.

## Initial action

Share `cursor_tasks/TASK_001_BACKEND_FOUNDATION.md` with Cursor in an **empty local repo**, together with `AGENTS.md` and `.cursor/rules/engineering.mdc`. Have Cursor inspect the repo before modifying anything. Cursor must report actual command/test results. The foundation can proceed safely in parallel with product decision resolution because it doesn't invent business rules.
