# Figma → API parity matrix (Task 003)

**Inspection date:** 2026-10-26  
**Local PDFs:** `design-reference/` (13 focus exports; full 49-file manifest in `docs/source/FIGMA_EXPORT_VERIFICATION_2026-10-26.md`)  
**Policy precedence:** ADR-004, `KYC_OWNER_DECISIONS_002B3A2.md`, `account-policy.ts` over screenshot examples.

Legend: **LIVE** = implemented and tested in repo; **READ** = owner can read via GET; **DEFER** = no backend; **BLOCKED** = owner decision required; **CLIENT** = Flutter-only navigation/copy.

## Onboarding (Screens 1–4)

| Source PDF | Visible control | Backend / policy | Auth state | Status |
|---|---|---|---|---|
| `Screen 1_ Splash Screen.pdf` | Branding | None | — | **CLIENT** |
| `Screen 2_ Onboarding - Meet People Around You.pdf` | Skip, Continue, location privacy marketing | No location API; no onboarding persistence approved | Any | **CLIENT**; do not collect precise location from marketing alone |
| `Screen 3_ Onboarding - Safe & Verified Community.pdf` | “100% ID checked”, universal verification copy | KYC-01: not required for signup/browse | Any | **COPY RISK** — contradicts policy |
| `Screen 4_ Onboarding - Meet Through Activities.pdf` | Skip, Get Started, Login link | Auth routes LIVE | — | **CLIENT** navigation |

## Auth (Screens 05–07)

| Source PDF | Visible control | Backend / policy | Auth state | Status |
|---|---|---|---|---|
| `Screen 05_ Login.pdf` | Email/password, forgot password, Apple/Google, E2EE tagline | Login + reset LIVE; OAuth deferred (D-02-AUTH) | — | **LIVE** (email); OAuth **DEFER**; E2EE **COPY RISK** |
| `Screen 06_ Sign Up.pdf` | First/last, email, **phone**, password, terms; **no DOB** | Register requires `dateOfBirth`, consents, 18+ (D-02); no phone field | Creates `PENDING_VERIFICATION` | **LIVE** with **design conflict** — Flutter must add DOB + consent; phone **BLOCKED** without owner decision |
| `Screen 07_ ID Verification.pdf` | Gov ID / selfie illustration | No KYC routes; status stays `NOT_STARTED` | Verified email + age for future start | **DEFER** (KYC-02); honest pending UX only |

## Edit Personal Details (`Html → Body-1.pdf`) — DIRECT-EXPORT-VERIFIED

| Control | Figma detail | API field | Allowed to edit | Status |
|---|---|---|---|---|
| Avatar / Change Photo | Photo + picker hints in text layer | `POST/GET/DELETE /v1/me/profile/avatar` | Self only; edit gated | **IMPLEMENTED** (Task 008A); byte validation + re-encode; local disk dev only; production CDN **DEFER** |
| First Name | Alex | `firstName` | Verified + age eligible + not suspended | **LIVE** `PATCH` |
| Last Name | Milo | `lastName` | Same | **LIVE** `PATCH` |
| Username | `@alexmilo` | `username` on `GET/PATCH /v1/me/profile` | Self only; no public lookup | **LIVE** (Task 006); visibility/public profile still D-03 |
| Date of Birth | October 14, 1996 | `birthDate` on GET only | Read-only (D-02) | **READ** only |
| Location + Verified badge | Miami, FL | `locationCity`, `locationRegion` on PATCH/GET | Edit gated | **IMPLEMENTED** city/region text (Task 008); geo + “Verified” badge **NOT** server-backed (D-04 open) |
| About Me | `154/300` counter | `bio` (max **300** on PATCH) | Same as names | **LIVE** (D-BIO-MAX approved Task 006); legacy >300 on GET until edited |
| Your Interests | Chips (10 labels) + Add Interest | `GET /v1/interests`, `GET/PUT /v1/me/interests` | Verified + age eligible to write; self-read while pending | **LIVE** catalog selection (Task 007); **DEFER** custom Add Interest + public visibility (D-03) |
| Favorite Activities | Pinned cards + add | `GET/PUT /v1/me/favorite-activities` | Edit gated; self-read while pending | **IMPLEMENTED** preference pins (Task 008); not Activity entity links; public exposure **DEFER** (D-03) |
| Profile Visibility | Everyone / Verified Users Only | `profileVisibility` on PATCH/GET | Edit gated | **IMPLEMENTED** (Task 008A); default **VERIFIED_USERS_ONLY** for new rows; cross-user enforcement **BLOCKED** (D-03) |
| Save Changes | Save | `PATCH /v1/me/profile` allowlist | Gated | **LIVE** |
| Discard dialogs | Text-layer hints | None | — | **CLIENT** UX |

## Settings hub (`Screen 26_ Profile & Settings.pdf`)

| Password & Security (change password) | Settings navigation row | `POST /v1/me/password-change` | Pending + active users | **LIVE** (Task 005) |

Navigation rows (subscription, 2FA, blocked users, delete account, etc.) are **design intentions**. **LIVE** today: login/session, password reset (unauthenticated), `GET /v1/me/account`, `GET/PATCH /v1/me/profile` (PATCH gated), authenticated password change. Example badges (`ID Verified`, `Club Member`, `Approved`, renewal dates, 2FA active) are **mock** until backed by server state.

## Public profile (`Screen 10_ User Profile.pdf`)

| Control | API (Task 009) | Status |
|---------|----------------|--------|
| Identity, bio, interests, city | `GET /v1/users/:userId` | **IMPLEMENTED** (authenticated; DTO allowlist) |
| Avatar | `GET /v1/users/:userId/avatar` when `hasAvatar` | **IMPLEMENTED** |
| Follow / Message / Wave | Task 011 social APIs | **IMPLEMENTED** in source; see `FIGMA_SOCIAL_PARITY_MATRIX_2026-10-27.md` |
| Distance / map / online | — | **DEFERRED** (D-04 geo) |
| ID Verified badge | — | **Do not infer** from public DTO; KYC not exposed |

## Nearby people (`Screen 09_ Discover/Nearby People.pdf`)

| Control | API | Status |
|---------|-----|--------|
| People list / search | `GET /v1/discover/people` | **IMPLEMENTED** (no geo/radius) |
| View profile | Navigate to `userId` + `GET /v1/users/:userId` | **IMPLEMENTED** |
| Map / Within X miles | — | **DEFERRED** |

## Activities (Screens 11–13) — Task 010

See `FIGMA_ACTIVITIES_PARITY_MATRIX_2026-10-27.md`. Discovery/detail/create, RSVP, and host publish are **IMPLEMENTED** in source; native PG verify **pending**. Maps, distances, attendee rosters, Followers-only publish, and “100% verified” claims remain **DEFERRED** / **DO NOT SHIP**.

## Owner checklist (concise)

1. **D-03 / username & visibility** — handle rules, `Everyone` vs `Verified Users Only`, public profile API.
2. **D-04 / location** — city text vs geo, “Verified” meaning, retention/display.
3. **Interest catalog** — fixed 10-option catalog **CONFIRMED** (Task 007); custom Add Interest and public display still **DEFER** (D-03).
4. **Favorite activities** — preferences vs linked activity records.
5. **Avatar/media** — storage, moderation, deletion.
6. **Signup reconciliation** — add DOB + consent to Figma flow; phone optional vs required.
7. **D-BIO-MAX** — **APPROVED** (Task 006): API write max **300**; legacy read preserved.
