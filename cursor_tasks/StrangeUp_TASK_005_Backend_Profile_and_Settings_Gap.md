# StrangeUp — Task 005 (proposed): Backend Profile & Settings Gap (Figma-evidenced)

**Prerequisites:** Task 003A complete; safe `/v1/me/profile` PATCH allowlist LIVE and documented.

**Scope:** **Backend only** in this repository. No Flutter implementation.

## Goal

Close **verified Figma-backed gaps** in profile, account, and settings-hub flows using owner-approved rules only. Do not implement username, location, interests, favorites, visibility, avatar, or public profile until the corresponding owner decisions are recorded.

## Evidence sources

- `design-reference/` — `Html → Body-1.pdf`, `Screen 26_ Profile & Settings.pdf`, `Screen 06_ Sign Up.pdf`
- `docs/product/FIGMA_PROFILE_PARITY_MATRIX_2026-10-26.md`
- `docs/product/FIGMA_PROFILE_API_GAP_2026-10-26.md`

## In scope (backend engineering)

1. **Re-audit** Screen 26 rows that imply server state (personal information, password/security, delete account, blocked users, identity status display) vs LIVE routes — produce a short gap list with **owner authorization required** per row.
2. **Implement only authorized slices**, for example (each requires explicit owner go-ahead before coding):
   - Authenticated **password change** (distinct from password-reset email flow) if product approves.
   - **Account deletion** request/confirm with session revocation and data-handling per retention policy.
   - **Email change** or verified contact update if approved.
   - Register/signup DTO alignment with D-02 (DOB, consents, optional first/last at register) if product changes the contract.
3. After any approved field group from parity matrix (**D-03**, **D-04**, interests, favorites, **D-BIO-MAX**, media): schema → policy → routes → tests → docs.

## Out of scope (remain deferred / Flutter / other teams)

- Flutter Edit Personal Details UI (formerly Task 004).
- Stripe, subscriptions, KYC vendor, OAuth, phone OTP, production email ESP.
- Mock `APPROVED` KYC, fake badges, or stub saves for BLOCKED Figma controls.
- Public profile (`Screen 10`) until D-03/D-04 approved.

## Owner decisions blocking implementation (do not guess)

| ID | Figma surface | Backend blocked until |
|---|---|---|
| D-03 | Username, visibility radios, public profile | Handle rules, access matrix, public read APIs |
| D-04 | Location + “Verified” badge | City vs geo, verification semantics, retention |
| — | Interests / Add Interest | Taxonomy, limits, moderation |
| — | Favorite Activities | Preferences vs activity record links |
| — | Avatar / Change Photo | Storage, moderation, privacy pipeline |
| D-BIO-MAX | Bio `300` vs API `500` | Owner picks limit; migration if tightening |
| — | Signup phone field | Mandatory vs optional phone |

## Acceptance (when authorized work lands)

- Figma trace updated in parity matrix or gap doc.
- Unit + integration + authorization + negative-path tests for new routes.
- `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, OpenAPI, `STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md` updated.
- Quality gate executed and reported; no commit/push without owner authorization.

## First action (no code until owner picks slice)

Deliver an **owner decision brief** (or use existing OPEN_QUESTIONS / parity checklist) ranking which Screen 26 / Body-1 backend capabilities to authorize next. Default: **no schema change** until at least one row in the table above is approved.
