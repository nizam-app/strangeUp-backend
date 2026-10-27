# D-OWN-PROFILE — consolidated owner decisions (Task 008 / 008A)

**Status:** **APPROVED** (2026-10-27) — reconciled in Task **008A**  
**Figma:** `Html → Body-1.pdf` (Edit Personal Details); `Screen 26_ Profile & Settings.pdf` (hub only)  
**Supersedes:** recommended-default column in the 2026-10-27 request table (visibility default revised).

Task 006 (username, bio), Task 007 (interests), and safe `PATCH /v1/me/profile` fields remain **owner-approved and implemented**. Cross-user visibility, discovery, and public profile reads stay **BLOCKED** until D-03/D-04.

| # | Topic | Decision | Implementation notes (008A) |
|---|--------|----------|-----------------------------|
| **OWN-PROFILE-01** | Favorite activity preferences | **APPROVED** | Ordered **0–5** preference pins on `GET/PUT /v1/me/favorite-activities`; not Activity entities; FK cascade on user delete. |
| **OWN-PROFILE-02** | Profile visibility | **APPROVED WITH REVISION** | Enum `EVERYONE` \| `VERIFIED_USERS_ONLY`. **New rows default `VERIFIED_USERS_ONLY`** (migration `20261027153000_profile_visibility_default_verified` + Prisma `@default`). **Existing rows unchanged** (still `EVERYONE` where set by migration `20261027140000` default). No backfill — indistinguishable explicit vs default `EVERYONE` on legacy rows; privacy-safe strategy: leave as-is until user PATCH or future account lifecycle. Self `GET/PATCH` only; future `VERIFIED_USERS_ONLY` viewers require **government-ID KYC APPROVED** (not email/fullAccess). |
| **OWN-PROFILE-03** | Location | **APPROVED** | Optional `locationCity` / `locationRegion`, max **80** chars; `null` clears; self-only; no coords, geocoding, or verified-location flag. |
| **OWN-PROFILE-04** | Avatar | **APPROVED WITH REVISION** | Self-only `POST/GET/DELETE /v1/me/profile/avatar`; JPEG/PNG/WebP max **5 MiB** upload; **byte decode + re-encode** (`sharp`) strips EXIF/GPS, bounds pixels/dimensions; rejects SVG/spoofed types. Dev disk under `PROFILE_UPLOAD_DIR` only — **not** staging/production release without object storage + moderation. Opaque per-upload filenames; path ownership checks; replace deletes prior file only after DB commit. |
| **OWN-PROFILE-05** | Retention | **APPROVED WITH REVISION** | Favorite pins cascade on user delete; location clears on PATCH `null` only; avatar files deleted on replace/delete (best-effort on disk errors — possible orphans documented). Full legal/account-deletion retention **OPEN**. |

**Out of scope (unchanged):** public `GET /v1/users/:id`, discovery distance, cross-user interests/favorites/avatar/location, KYC approvals, Stripe, account deletion, OAuth/phone.

**Verification:** Native PostgreSQL integration gate — see Task 008A completion report (`STATUS.md`).
