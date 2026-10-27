# Cursor Task 003 — Figma-Verified Onboarding/Profile Parity & Safe Backend Slice

**Mode:** bounded implementation + evidence reconciliation, NOT open-ended architecture study.  
**Primary outcome:** connect already implemented safe profile fields to actual Figma UI, close low-risk contract gaps, report specific owner decisions required before new profile schema/visibility/media work.

## Required inputs

1. `AGENTS.md`, `.cursor/rules/*`, all identity/KYC-approved ADRs, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`, `STATUS.md`, `OPEN_QUESTIONS.md`.
2. `docs/api/CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, `openapi/identity.yaml`, `src/modules/me/*`, `src/modules/auth/*`, `prisma/schema.prisma`, existing migrations and tests.
3. Actual PDFs under `design-reference/`: `Html → Body-1.pdf`, `Screen 06_ Sign Up.pdf`, `Screen 26_ Profile & Settings.pdf`, `Screen 10_ User Profile.pdf`, onboarding screens 2–4, and other included context.
4. `docs/product/FIGMA_PROFILE_API_GAP_2026-10-26.md` and `docs/source/FIGMA_EXPORT_VERIFICATION_2026-10-26.md`.

## Step 1 — Prove design-to-API parity

- View/read each actual PDF; do not rely on old numbered references alone.
- Produce a matrix per UI control: screenshot filename, rendered-visible control, existing backend field/API, allowed auth/account state, missing product rule, implementation status.
- Verify existing `GET /v1/me/account`, `GET /v1/me/profile`, `PATCH /v1/me/profile` schemas and tests, including suspended users, pending account restrictions, unknown key rejection and no DOB/KYC/status/entitlement writes.
- Review registration discrepancy: Figma shows first/last, phone and no DOB while approved D-02 requires DOB and versioned terms acceptance. Do not silently change registration requirements. Define Flutter UI reconciliation, mark pending design update.

## Step 2 — Implement only safe, already-approved work

- Reuse existing profile fields (`firstName`, `lastName`, `displayName`, `bio`, `scheduleTimeZone`) and no extra public exposure.
- If current `bio` maximum differs from the visibly rendered `154/300` counter, identify downstream data/compatibility effects. Align input length and test **only if** doing so is consistent with documented contracts and does not truncate existing values. Otherwise record explicit decision needed.
- Add/strengthen request DTO or validation/test/documentation parity and negative cases **where a real difference exists**. Avoid fabricated code churn if already correct.
- Ensure Flutter handoff provides exact GET/PATCH examples, self-profile loading/saving/error UX, pending-verification gating, successful-save rendering and session handling.
- For welcome/onboarding `Skip`/`Continue`, keep navigation client-side unless existing approved product rules require persisted progress. Do not invent a 'completed onboarding' DB field.
- Audit shipping strings implying all accounts KYC-verified, E2EE implemented, or precise-location guarantee; record release copy issues to Flutter/design owners. Do not modify original PDF exports.

## Step 3 — Explicitly exclude all policy-dependent features

No username uniqueness/change endpoints, no location persistence, no interest/favorite-activity tables, no photo upload storage or mock URLs, no visibility/other-user public profile API, no Follow/Wave/Chat, no KYC or payments, no new OAuth or billing. These require D-03, D-04 and follow-on owner decisions. Do not infer rules solely from examples in the PDFs.

## Step 4 — Required engineering discipline

- Maintain approved policy: US-focused, 18+, DOB at registration, email verify, KYC separate; government ID required before real-world meetup/activity join/RSVP/host/check-in as previously approved; never fake `APPROVED`.
- If code changes, add targeted unit/integration tests and execute `prisma:validate`, `prisma:generate`, `typecheck`, `lint`, `format:check`, `npm test`, `build`, and isolated DB integration tests. Make migrations only for approved changes. Do not rewrite existing applied migrations.
- Every changed API must synchronize `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, and appropriate OpenAPI specs. Always update `docs/plans/STATUS.md` and `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`. Update traceability with original verified filenames/controls.
- Distinguish **already implemented**, **newly changed/tested**, **deferred**, **blocked**, **proposal**, and **not verified**. No implementation credit for mere Figma visibility.
- Do not commit, push, modify production, or expose secrets.

## Completion criteria

A. Figma verified references are available locally and mapped, no longer 'PDF missing'.
B. Existing live profile contract checked against visual design, negative path tests checked or added.
C. Any objectively approved low-risk validation/docs gap corrected with executed evidence, or clearly explained why no code change was justified.
D. Flutter developer can wire currently available safe profile fields without inventing backend endpoints.
E. Decision questions for **username/visibility**, **location**, **interest vocabulary**, **favorites**, **avatar/media** and **signup DOB/phone** reduced to a concise owner checklist.
F. Deferred integration and misleading safety copy risks remain visible and tracked.

Deliver a final engineering report with reviewed filenames, changes, actual tests, updated docs, pending decisions, and recommendation for the next **feature implementation slice**, not another unlimited planning cycle.
