# D-03 — Public profile & people discovery MVP

**Status:** **APPROVED** (2026-10-27) — implemented Task **009**  
**Supersedes:** prior “OPEN / deny all cross-user” stub for **read** paths only.

## Rules (authoritative)

- **Authentication required** for discovery and public profile reads — no anonymous/web-public access.
- **Viewer eligibility:** active, non-suspended/non-deleted, email-verified, age-eligible (`hasFullAccountAccess`).
- **Target eligibility:** same trust dimensions; pending/suspended/deleted never discoverable.
- **`profileVisibility`:** `EVERYONE` → eligible viewers; `VERIFIED_USERS_ONLY` → viewers with server `identityVerificationStatus === APPROVED` only (no client claims, no email/badge substitute).
- **Blocking:** bidirectional `UserBlock` hides targets from lists and detail/avatar (generic `404`).
- **Out of scope (Task 009):** Follow, Wave, Message, presence, counts, activity discovery, public unauthenticated APIs.

**Implementation:** `src/modules/policy/public-profile-policy.ts`, `src/modules/discovery/*`, `GET /v1/discover/people`, `GET /v1/users/:userId`, `GET /v1/users/:userId/avatar`.
