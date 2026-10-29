# Main Flow Figma parity — Task 025D (Profile / Settings / Edit Details)

**Date:** 2026-10-28  
**Evidence:** `Screen 26_ Profile & Settings.pdf`, `Html → Body.pdf` (Edit Personal Details) in `design-reference/task025-main-flow/`.

## Onboarding-safe vs main-app routes (Task 022)

| Action | Route | Before Home activation |
|---|---|---|
| Read/update bio, username, visibility, location (non-legal) | `GET/PATCH /v1/me/profile` | **Allowed** (email-verified + age-eligible) |
| Legal first/last name | same PATCH | **Allowed** only until trusted KYC; then `legalNameLocked` |
| DOB | `GET /v1/me/profile` → `birthDate` | **Read-only** always (not in PATCH schema) |
| Email / phone display | `GET /v1/me/account`, settings overview | **Read** |
| Email change | `/v1/me/email-change/*` | **Gated** (main app + DEV_ONLY transport) |
| Password change, session list/revoke | `/v1/me/password-change`, `/v1/me/security/sessions*` | **Onboarding-safe** |
| Settings hub + counts | `GET /v1/me/settings/overview` | **403** `ONBOARDING_REQUIRED` |
| Interests, favorite activities, avatar (post-gate section) | `/v1/me/interests`, `/v1/me/favorite-activities`, avatar | **Main app gate** |
| Blocks, saved activities, notifications product routes | various `/v1/me/*` | **Main app gate** |

## Screen 26 — Settings hub

| Figma control | API | Status |
|---|---|---|
| Header / meetups / groups counts | `settings/overview` → `counts.*` | **PARTIAL** — real RSVP/group counts; **no** “meetup invite” or rating fields |
| ID Verified / Club Member badges | `identityVerificationStatus`, `adminReviewStatus`, `membership` | **PARTIAL** — status fields only; no Club badge truth |
| 4.98 Rating | — | **NOT IMPLEMENTED** (`capabilities.hostRatings: DEFERRED`) |
| Edit Profile | `PATCH /v1/me/profile`, avatar, interests, favorites | **MATCHED** (interests/favorites gated) |
| Personal Information | account + profile; phone read-only | **MATCHED** |
| Change Password & 2FA | password LIVE; 2FA | **PARTIAL** (`twoFactorAuth: DEFERRED`) |
| My Activities / Saved / Groups / Jobs | existing `/v1/me/*` + overview counts | **MATCHED** |
| Meetup invites row | — | **DEFERRED** (`meetupInvites`) |
| Subscription / payment history | — | **DEFERRED** (MKT-03) |
| Identity verification row | `identityVerificationStatus`, `adminReviewStatus` | **MATCHED** (025D) |
| Blocked users | `/v1/me/blocks` + count | **MATCHED** |
| Privacy & permissions | `profileVisibility` PATCH | **MATCHED** (meetup-location semantics **NEEDS DECISION** SET-PRIV) |
| Delete account | `account-deletion/impact` only | **UNAVAILABLE** |
| Log out | `/v1/auth/logout` | **MATCHED** |

## Html → Body — Edit Personal Details

| Control | API | Status |
|---|---|---|
| First / last name | PATCH when `legalNameLocked === false` | **MATCHED** (025D lock after KYC) |
| Username, bio, location | PATCH profile | **MATCHED** |
| DOB display | `birthDate` read-only | **MATCHED** |
| Interests / favorite activities | PUT interests / favorite-activities | **MATCHED** (main-app gate) |
| Profile visibility | PATCH `profileVisibility` | **MATCHED** |
| Location “Verified” label | — | **FLUTTER-ONLY** (no verified-location API) |

## Owner decisions (unchanged)

- **SET-NAME-025D / 025E (engineering default):** Legal name stays locked after staff-approved identity binding even when KYC expires or is revoked; correction → support/vendor flow only (not self-serve PATCH).
- **SET-PRIV:** Location sharing during meetups copy vs backend semantics.
- **MEETUP-INV**, **MKT-03**, **2FA**, phone OTP, destructive delete.
