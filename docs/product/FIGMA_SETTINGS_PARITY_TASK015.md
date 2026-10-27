# Screen 26 — Profile & Settings (Task 015 backend parity)

**Source:** `design-reference/Screen 26_ Profile & Settings.pdf` (hub)

| Figma control (observed) | Backend | Status |
|---|---|---|
| Profile header / avatar / edit profile | `GET /v1/me/settings/overview`, `GET/PATCH /v1/me/profile`, avatar routes | **LIVE** |
| Personal info (email, phone, DOB) | `GET /v1/me/account` + overview; DOB read-only on profile; phone read-only | **LIVE read**; phone verify **DEFERRED** |
| Change password & security | `POST /v1/me/password-change`, sessions routes | **LIVE** |
| My Activities / RSVPs | Existing `/v1/me/activities`, `/v1/me/activity-rsvps` | **LIVE** (counts in overview) |
| Saved Activities | `GET/PUT/DELETE /v1/me/saved-activities` | **LIVE** (distinct from favorite-activity pins) |
| My Groups | Existing `/v1/me/groups` | **LIVE** |
| Jobs / saved jobs | Task 014 routes | **LIVE** |
| Blocked users | `/v1/me/blocks` | **LIVE** |
| Log out | `/v1/auth/logout`, `/v1/auth/logout-all` | **LIVE** |
| Email change | Two-phase `/v1/me/email-change/*` | **DEV_ONLY** transport |
| Delete account | Impact only `/v1/me/account-deletion/impact` | **UNAVAILABLE** (policy gate) |
| Subscription / payment history | — | **DEFERRED** (MKT-03) |
| Identity verification badge / club member | `identityVerificationStatus` only | **LIVE status field**; marketing badges **DEFERRED** |
| 2FA | — | **DEFERRED** |
| Help / support / guidelines | — | **DEFERRED** (content URLs SET-05) |
| Meetup invites / ratings / counts in mock copy | — | **DEFERRED** — do not render mock numbers |
