# StrangeUp — Figma-Verified Profile & Onboarding Gap (2026-10-26)

## Evidence & source precedence

1. **Approved product decisions** (ADR-004; D-01, D-02, D-02-AUTH, D-09, approved KYC-01/KYC-03/KYC-05/KYC-ENF rules) set behavioral/policy limits.
2. **Directly reviewed PDFs** from `Strange up(1).zip` prove what controls and wording are visibly drawn. They do **not** authorize unapproved behavior.
3. **Cursor-reported live implementation** comes from Task 002B.2A and subsequent parity report; Cursor must check current source, tests and `CURRENT_APIS.md` before making claims or code changes.
4. Older Phase-0 `SCREEN_TRACEABILITY.md` numbers are a historical cross-reference, not substitute for reopened source.

## Visible onboarding flow (actual filenames)

| Exact source | Visible behavior | Existing backend or decision | Outstanding need |
|---|---|---|---|
| `Screen 1_ Splash Screen.pdf` | Splash/branding | Client-only, no API assumed | No backend milestone |
| `Screen 2_ Onboarding - Meet People Around You.pdf` | `Skip`, `Continue`, nearby/location and precision-location privacy marketing | No progress persistence approved | Do **not** collect precise location based on marketing claim; check US privacy statement |
| `Screen 3_ Onboarding - Safe & Verified Community.pdf` | `Skip`, `Continue`, `100% ID checked & reviewed` / `Every member is verified` | Conflicts with approved KYC-01: KYC not required for signup/login/browsing | **COPY RELEASE RISK:** remove or change misleading universal-verification text before shipping |
| `Screen 4_ Onboarding - Meet Through Activities.pdf` | `Skip`, `Get Started`, `Already have account? Login` | Client navigation; no persisted onboarding flag approved | Confirm navigation wiring in Flutter, not automatic backend API |
| `Screen 05_ Login.pdf` | Email/password, forgot password, Apple, Google | Email/password LIVE; password reset LIVE but ESP dev-only; OAuth deferred | Disabled/deferred OAuth must not misleadingly promise functionality; E2EE copy unverified |
| `Screen 06_ Sign Up.pdf` | First/Last Name, Email, **Phone**, Password/Confirm, Terms/Privacy; **no DOB visible** | Approved D-02 requires DOB, versioned consent, 18+; mandatory phone unresolved | **UI/API conflict:** add required DOB + consent state in Flutter design spec, avoid mandatory phone without owner decision. Confirm whether register stores first/last in its current contract. |
| `Screen 07_ ID Verification.pdf` | Government ID/selfie/review illustration | KYC provider deferred; status `NOT_STARTED` and approved real-world gates | Do not fake KYC progression/approval; policy-copy as needed |

## `Html → Body-1.pdf` — Edit Personal Details (visually inspected)

| UI element | Visible detail | Cursor-reported backend | Decision needed / safe action |
|---|---|---|---|
| Avatar and `Change Photo` | Profile photo with camera button | No photo API reported | Storage, moderation, privacy, upload pipeline unresolved. Avoid fake success. |
| First Name / Last Name | Direct editable text | `PATCH /v1/me/profile` allowlist includes `firstName`, `lastName` | **Already supported**; verify exact client mapping. |
| Username | Prefixed `@`, example `alexmilo` | No username reported | Unique handle, case-folding, changes, length, public exposure, reserved words unapproved. |
| Date of Birth | Displayed with calendar icon | `birthDate` write-once at register, profile read-only | **D-02 wins**: display read-only; defer DOB change to secure identity/legal workflow. |
| Location | `Miami, FL`, badge `Verified` | No location field reported | **D-04 open**: city vs exact coords, verification meaning, privacy; never treat badge as government-ID KYC proof. |
| About Me | Bio textarea with `154/300` counter | `bio` supported | Validate whether live `bio` max is 300. Implement/test 300-char limit only if compatible with documented policy/current data; report migration/data impact first. |
| Your Interests | Selected Biking, Fitness, Outdoor, Social, Sports; suggestions Swimming, Hiking, Travel, Music, Food; `Add Interest` | No interests model/API reported | Fixed vs free-form catalog, maximum selection, normalization, filtering exposure, moderation unresolved. |
| Favorite Activities | Two examples with title, skill, weekly/casual label, time/location; add another | No feature reported | **CRITICAL DOMAIN QUESTION:** user-pinned preferences vs linked real activity records? Do not choose a schema without owner decision. |
| Profile Visibility | `Everyone` and `Verified Users Only` radio; latter selected in screenshot | No exposure policy API; D-03 open | Never publish full profile; need access matrix including KYC `APPROVED`, pending/expired, blocked/suspended. Do not assume screenshot-selected option is default. |
| Save Changes | Save button; cancel/back | PATCH existing allowed fields only | Reuse current endpoint for approved fields. Reject unknown/sensitive keys; no stub successful saves for missing fields. |

**Text-layer nuance:** This PDF's extractable text includes strings suggesting `Take Photo`, `Choose from Gallery`, `Remove Photo`, `Discard Edits` and `Keep Editing`. They were not simultaneously visible in the default rendered page; treat as **design hints requiring app or interactive-state confirmation**, not fully verified flows.

## `Screen 26_ Profile & Settings.pdf`

Settings shows edit profile, personal information (email/phone/DOB), password/security (a 2FA-active example), my activities, saved activities, my groups, meetup, jobs, subscription, payment history, identity verification (APPROVED example), blocked users, privacy/permissions, support/legal, logout, and delete account. **These are screen navigation intentions, not proven live endpoints.** The badges `ID Verified`, `Club Member`, `Approved`, subscription renewal, 2FA active, and 24/7 support are mock/example presentation until backend evidence exists.

## `Screen 10_ User Profile.pdf` (public profile; future milestone)

Visible: username-like identity, `ID Verified & Biometric Matched` badge, follower count, Follow / Message / Wave, interests, upcoming activities, groups, recent activity, approximate distance, online status. **D-03 social/public visibility remains open; no public profile API should be implemented yet.** Location privacy and KYC visibility need approved cross-feature rules.

## Implementation baseline (Cursor-reported; must inspect)

LIVE: `GET /v1/me/account`, `GET /v1/me/profile` and `PATCH /v1/me/profile` allowlisted only for `firstName`, `lastName`, `displayName`, `bio`, `scheduleTimeZone`; `birthDate` read-only. Pending accounts may read own records; full access is not equal to KYC approval. Authentication, registration, email verification and password reset are implemented, but email provider is dev-only.

## Decisions to escalate, in order of impact

1. **D-03-username-and-visibility:** username presence and global uniqueness/change behavior; `Everyone` vs `Verified Users Only` access and default; public profile and blockers.
2. **D-04-location:** city/state text vs approximate city from geo; whether/how it is verified; precision, retention, display, edit semantics.
3. **Interest taxonomy:** managed options and custom `Add Interest`, limits, presentation and moderation.
4. **Favorite Activities:** favorites as text preferences vs saved real activity references; schedule/level meaning.
5. **Avatar/media:** storage implementation, resize/EXIF removal, access policy, deletion/replacement, upload limits.
6. **Signup design reconciliation:** DOB field and 18+ display, first/last mapping, phone optional/deferred, terms version/acceptance UX.

## Marketing/safety language needing product correction before release

- `100% ID checked`, `Every member is verified`: contradicted by approved signup/browsing without KYC.
- `End-to-End Encrypted` on splash/login/signup/chat: not yet proved by backend E2EE architecture and implementation; cannot be asserted on marketing screens without evidence.
- `Precise location is only shared during confirmed meetups`: cannot be guaranteed without D-04 and implemented privacy enforcement.
- `Instant automated approval in seconds`: vendor not selected, decision timing unsupported.
- `ID Verified` / `Club Member` badges: never display for a real account without corresponding trustworthy state.

These are product copy and UX integration risks; **do not change source PDFs**. Coordinate correction proposals with Flutter/design owner.

## Deferred vs active

- **ACTIVE (this backend repo):** Task 005 — settings-hub and profile **backend** gaps per Figma evidence; owner-authorized implementation only. Safe PATCH fields and contract docs are complete (Tasks 003/003A).
- **FLUTTER (separate repository):** Client wiring for Edit Personal Details and onboarding UX — use `FLUTTER_DEVELOPER_HANDOFF.md`; not a backend-repo milestone (Task 004 cancelled here).
- **BLOCKED BY OWNER POLICY:** username, public visibility, interest catalog, favorite activities, and location.
- **DEFERRED THIRD PARTIES:** real email ESP, OAuth, Stripe/subscriptions, KYC provider, cloud photo storage selection. Any dependent flow should show honest not-available/pending states.
- **HARD GATE:** approved KYC-01/03/05/ENF restrictions remain enforceable requirements when real-world activity features launch; no fake `APPROVED`.
