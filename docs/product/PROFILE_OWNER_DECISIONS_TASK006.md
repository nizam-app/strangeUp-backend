# Profile owner decisions — Task 006 (username & bio)

**Status:** APPROVED for immediate implementation (2026-10-27).

## D-USERNAME (Task 006)

| Rule | Decision |
|---|---|
| Required? | **Optional** — `null` when unset |
| Length | **3–30** characters |
| Charset | Lowercase English letters (`a-z`), digits (`0-9`), underscore (`_`) only |
| Uniqueness | **Global**, case-insensitive at database (`LOWER(username)` unique partial index) |
| Update path | Authenticated `PATCH /v1/me/profile`; omitted field = no change; `username: null` clears handle |
| Authorization | Same as existing profile edit (`canEditProfile`: verified email + age eligible + active account) |
| Trust / access | Username does **not** grant KYC approval, membership, or social/discovery access |
| Public lookup | **Out of scope** — no public profile or username resolution APIs in Task 006 |

## D-BIO-MAX (Task 006)

| Rule | Decision |
|---|---|
| API max on write | **300** characters (matches Figma `154/300` counter on Edit profile) |
| Database column | `TEXT` without length constraint — **no migration truncates existing rows** |
| Legacy rows | Bios **longer than 300** may remain stored; `GET /v1/me/profile` returns them unchanged |
| Partial PATCH | Updating other profile fields does **not** validate or shorten an existing long bio |
| New bio writes | `PATCH` with `bio` longer than 300 → `VALIDATION_ERROR` 400 |

### Legacy data review (pre-change)

- Greenfield identity slice: no production dataset in this repository.
- Integration/dev databases may contain test bios; none are auto-truncated by this migration.
- Flutter should use a **300** character counter for new edits; display of legacy bios >300 is a client UX choice until the user saves a shorter bio.

## Evidence

- Figma: `Html → Body-1.pdf` / Edit profile (`design-reference/`)
- Implementation: migration `20261027103000_profile_username`, `src/modules/me/me.validation.ts`
