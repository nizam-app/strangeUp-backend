# StrangeUp — TASK 002B.3A1: KYC Owner Decision Handoff

**Type:** Documentation-only update after completed Task 002B.3A.  
**Owner decision to record:** KYC-01 Option A is **APPROVED**: government ID verification before real-world Meetup/Activity **participation and hosting**. Initial signup, browsing and basic account access do not require KYC solely under this rule.  
**Recommendations only, not approved:** KYC-03 trusted verification authority; KYC-05 provider-hosted sensitive evidence/minimal backend metadata.  
**Do not implement KYC, add Prisma models or migrations, install packages, create APIs, select a vendor, change Figma, modify production, commit, or push.**

## Preflight — inspect actual repository

1. `git status --short`, `git log -1 --oneline`; preserve all unrelated/uncommitted docs and source.
2. Read `AGENTS.md`, `.cursor/rules/`, `docs/plans/STATUS.md`, `docs/decisions/ADR-004-identity-phase1-owner-decisions.md`, `docs/product/OPEN_QUESTIONS.md`, `docs/product/KYC_REQUIREMENTS_DECISION_GATE.md`, `docs/architecture/VERIFICATION_INTEGRATION_DESIGN.md`, `docs/security/KYC_DATA_HANDLING_AND_THREATS.md`, `docs/testing/KYC_ACCEPTANCE_MATRIX.md`, `docs/api/KYC_API_CANDIDATES.md`, `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` and the existing policy code. If filenames vary, discover matching files and report actual paths.
3. Read the supplied `docs/product/KYC_OWNER_DECISIONS_002B3A1.md`. This is the owner handoff, not a replacement for repository-specific source-of-truth decisions.
4. Verify no KYC API is LIVE and no external provider is configured. If contrary evidence exists, report rather than silently overwrite.

## Required doc-only changes

1. **KYC-01:** Mark `APPROVED` in `docs/product/KYC_REQUIREMENTS_DECISION_GATE.md`, with exact scope and source/date (2026-10-26). In `OPEN_QUESTIONS.md`, close the **high-level KYC-01 choice only**. Leave enforcement timing/edge cases open explicitly (join/RSVP vs check-in; invites; waitlist; virtual meetups; hosting, expiry/revocation and existing participation). Do not convert these examples into approved requirements.
2. **KYC-03 and KYC-05:** Record the supplied recommendations as `PROPOSED — AWAITING OWNER APPROVAL`, not `APPROVED`. If current draft differs, show differences and avoid erasing existing decisions.
3. **Policy architecture:** Update `VERIFICATION_INTEGRATION_DESIGN.md` and related permissions model to distinguish email verified, declared-age eligible and government-ID-verified state. Describe how a future backend policy could gate only approved real-world actions, without changing code or asserting any active permissions. Keep session vs user status models separate.
4. **Security/data handling:** Make the proposed provider-hosted documents/selfie/biometric + minimal backend metadata model explicit in `KYC_DATA_HANDLING_AND_THREATS.md`, alongside open retention, legal/state scope, cross-border access and deletion decisions. No actual PII collection.
5. **Flutter docs:** Update `FLUTTER_DEVELOPER_HANDOFF.md` with *approved high-level KYC-01 policy* and a visually distinct `PLANNED / NOT LIVE` section for user-facing verification UI states. Include warning against displaying successful verification from self-reporting or mock screens. Do not claim proposed API request/response payloads exist.
6. **API registry:** Preserve `CURRENT_APIS.md` LIVE list unchanged. Leave KYC candidates **PLANNED / NOT IMPLEMENTED**. Only add an explanatory proposed-policy note if useful; no new OpenAPI endpoints promoted to active.
7. **Tracking:** Update `docs/plans/STATUS.md` to state `TASK 002B.3A1 — KYC-01 owner decision recorded; KYC-03/05 awaiting sign-off; no implementation.` Add a reference to this handoff and list precise approval blockers for 002B.3B.
8. **Traceability:** Preserve `PRIOR-EXPORT-REPORTED` designation for Figma references not independently re-read. Resolve document inconsistency only if source evidence supports it.

## Acceptance criteria

- Exact KYC-01 owner decision recorded, WITHOUT claiming KYC is already enforced.
- KYC-03 and KYC-05 visibly remain proposals; no implied owner approval.
- Approved broad gate distinguished from unresolved action-level rules.
- No provider-selected assertion and no fake `APPROVED` state.
- API docs unambiguous: no KYC LIVE/DEV_ONLY endpoints.
- No `src/`, Prisma schema/migration, package or production changes.
- `git diff --check` run; report doc paths modified; preserve preexisting edits; no commit/push.
- If docs differ or actual code contradicts reports, identify the contradiction and do not fabricate resolution.

## Completion report

Report exact files inspected and modified, KYC-01 wording/date and which specifics remain OPEN, KYC-03/05 recommendations and approval status, Flutter/API documentation integrity, tests/checks actually executed, Git status, and minimal decision questions for owner before Task 002B.3B.

**Do not execute Task 002B.3B as part of this handoff.**
