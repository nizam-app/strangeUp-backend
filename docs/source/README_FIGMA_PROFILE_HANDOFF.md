# StrangeUp — Figma-Verified Profile Flow Handoff

Source: the user-supplied original ZIP `Strange up(1).zip`, inspected 2026-10-26. This is **directly verified export evidence**, not an assumption from earlier Phase-0 notes.

## Contents

- `design-reference/`: **13 original PDFs** with source filenames preserved, including the complete onboarding/auth flow and relevant profile/discovery context.
- `docs/source/FIGMA_EXPORT_VERIFICATION_2026-10-26.md`: complete 49-file manifest with SHA-256 hashes.
- `docs/product/FIGMA_PROFILE_API_GAP_2026-10-26.md`: screenshot-grounded fields, API gap, constraints, and conflicts.
- `cursor_tasks/TASK_003_FIGMA_PROFILE_PARITY_AND_SAFE_SLICE.md`: Cursor implementation instructions, limited to approved/unblocked behavior.

## How to use

1. Extract this package **into the StrangeUp backend repository root**, preserving the included folder structure. Existing repo files are not supplied by this package and must not be overwritten.
2. Cursor can now open the real exported PDFs under `design-reference/`; it must treat those as authoritative UI evidence while approved ADRs remain authoritative for policy.
3. Start the task file with Cursor. Import/merge accompanying docs as project references, and synchronize the project's trackers and API docs.
4. For comprehensive design context, additionally copy the complete original `Strange up(1).zip` into the repository's source/reference area (or unzip all originals). This handoff intentionally includes **only 13 focus PDFs**.

**Do not** interpret screenshots' example badges, fake addresses, '100% verified' text, Club subscriptions, or E2EE marketing copy as implemented backend capabilities.
**Do not** implement unapproved KYC, payments, OAuth, public discovery, or profile disclosure policies.
