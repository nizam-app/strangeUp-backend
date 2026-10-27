# StrangeUp — Task 008A: Own Profile Owner-Decision Reconciliation & Section Verification

**Mode:** backend-only implementation/hardening of existing Task 008, followed by a single Tasks 006–008 section verification gate. **Not** a new product module or architecture study.

**Owner approval:** Confirmed in chat (2026-10-27). The following five decisions supersede the proposed defaults in `docs/decisions/D-OWN-PROFILE-REMAINING-REQUEST-task008.md`. Preserve Tasks 006/007 and all earlier approved decisions.

## Permanent boundaries

- Backend Node.js / TypeScript / Express / Prisma / PostgreSQL only. Flutter is maintained in a separate repository; update only the API handoff, never Flutter code.
- Never implement or expose public profiles/discovery, cross-user interests/favorites/avatars/location, KYC approvals, Stripe, account deletion, subscription privileges or unrelated work in this task.
- No production operations, database resets, migration rewrites, Git commits or pushes; do not reveal `.env` secrets.
- Document each claim as `IMPLEMENTED`, `APPROVED`, `TESTED`, `BLOCKED`, or `DEFERRED`, with evidence. Existing code is not yet section-level verified.

## A. Owner-approved product decisions (authoritative)

**OWN-PROFILE-01 — Favorite activity preferences: APPROVED as proposed**

- These are **ordered personal preference pins**, not links to the future Activity domain.
- `GET` / `PUT /v1/me/favorite-activities`; a PUT replaces an ordered collection of **0–5 distinct** items.
- Item fields: `title`, `skillLevel` (`BEGINNER | INTERMEDIATE | ADVANCED`), `cadence` (`WEEKLY | CASUAL`), optional `scheduleNote`, optional `placeLabel`.
- Self-only under `/v1/me/*`; selecting a favorite never creates, joins, hosts, RSVPs to, or books an Activity.
- Favorite pins must be deleted when the user record is actually deleted (FK cascade as applicable). Account deletion endpoint remains out of scope.

**OWN-PROFILE-02 — Profile visibility: APPROVED WITH REVISION**

- Allowed stored enum: `EVERYONE | VERIFIED_USERS_ONLY`.
- **New Profile rows default to `VERIFIED_USERS_ONLY`**, replacing the previously proposed `EVERYONE` default.
- Current API may return/edit the authenticated user's own setting; **no public/profile/discovery enforcement routes are to be introduced yet**. D-03 remains open for cross-user visibility rules and authorization matrix.
- A future `VERIFIED_USERS_ONLY` viewer must have **genuine, trusted-provider government-ID KYC approval**. Email verification, DOB self-report, `fullAccess`, or badges do not equal KYC approval.
- Audit schema default, creation paths, service defaults, tests, Prisma migration and existing rows. Do **not** silently overwrite known explicit preferences. If default-generated vs explicitly chosen `EVERYONE` records are indistinguishable, report a privacy-safe migration/backfill strategy and its impact; do not perform unapproved mass data rewriting. Until public visibility policy is built, remain default-deny for all cross-user reads.

**OWN-PROFILE-03 — Location: APPROVED as proposed**

- Optional self-reported `locationCity` and `locationRegion` text, **maximum 80 characters each**.
- No precise coordinates, street address, geocoding, region/geographic blocking, verified-location flag or misleading verification badge.
- PATCH with field `null` clears that field; omitted field leaves prior value unchanged.
- Read/write **self-only**; no public display, distance computation or discovery exposure until D-04 is decided. No automatic expiration specified; do not invent one.

**OWN-PROFILE-04 — Avatar: APPROVED WITH REVISION**

- Existing `POST` / `GET` / `DELETE /v1/me/profile/avatar` are **private self-only** endpoints; do not create public media routes.
- Development storage may use local disk under `PROFILE_UPLOAD_DIR` only. **Not approved for staging/production release** until object storage, access, moderation and operations are reviewed.
- Accept multipart field `avatar`, JPEG/PNG/WebP only, **maximum uploaded file size 5 MiB**. Check actual file format from bytes and decode it; do not trust filename or declared MIME alone. Reject SVG and unrecognized/corrupt files.
- Safe processing must prevent arbitrary-file/path access and decompression abuse, control dimensions, and remove sensitive EXIF/GPS metadata via sanitization/re-encoding before storage/serving; avoid serving raw untrusted uploads. Use server-generated opaque paths under configured root, with strict read/delete path ownership.
- For create/replace/delete, use staging/temp files, cleanup on validation/DB/file errors, and a recoverable strategy for DB/filesystem consistency. **PostgreSQL transactions do not make disk writes/deletions atomic.** Avoid destroying the previous avatar before a successful replacement is persisted. Handle concurrent replacement safely or document tested serialization/CAS strategy; no orphaned files left silently if a recoverable cleanup process is needed.
- Auth, error responses, safe response headers, file MIME, and missing-avatar cases must match documented contracts. Rate limits and upload-size middleware boundaries must be inspected.
- Production object storage, moderation/malware controls and operational retention remain explicitly **DEFERRED / release blockers**.

**OWN-PROFILE-05 — Retention: APPROVED WITH REVISION**

- Favorite pins cascade when their owning user is actually deleted.
- `locationCity` and `locationRegion` clear only on explicit PATCH `null` (or future owner-approved account lifecycle action); no invented geo TTL.
- Avatar replace/delete and any future account-removal cleanup require explicit, tested filesystem/object deletion logic. FK cascade **does not** delete files. Record behavior on failures and possible orphan cleanup.
- Final legal retention schedules (including backups/logs), account-deletion procedures, moderation retention and storage policies remain **OPEN**; do not claim full deletion/legal compliance.

## B. Reconcile existing implementation — minimal diff

1. Read `AGENTS.md`, `.cursor/rules/engineering.mdc`, `docs/decisions/D-OWN-PROFILE-REMAINING-REQUEST-task008.md`, all approved task decisions, Figma `Html → Body-1.pdf` and the current implementations/tests.
2. Inspect the exact current Prisma models/migrations (`20261027103000_profile_username`, `20261027120000_profile_interests`, `20261027140000_own_profile_extensions`), routes, validation, policies, DTOs and avatar disk logic. Report proposed-versus-approved differences before edits in a concise table, then **proceed with safe authorized edits** without creating another decision task.
3. Make the smallest additive Prisma migration (if needed) to change the `Profile.profileVisibility` **default** for new rows. Never rewrite an applied migration. Inspect legacy rows before backfilling; don't overwrite explicit selections by guesswork. Check service create defaults too.
4. Retain favorites domain separation, ordering, uniqueness and 0–5 validation, preserving the existing API contract when compliant.
5. Confirm city/region validation, clearing, self-only permissions and no verified-location claim.
6. Harden avatar endpoints against spoofed images, malformed files, oversized uploads, EXIF/GPS leakage, path traversal, unauthorized reads, replacement/delete failures and concurrent requests. Do not make security claims without tests or source evidence.
7. Keep upstream auth/profile/KYC decisions intact. Do not relax pending/suspended-user guards. `VERIFIED_USERS_ONLY` is NOT a shortcut to require KYC to edit one's own profile.

## C. Testing strategy — one Profile section verification gate

**While native PostgreSQL credentials are unavailable:**

- Implement approved changes, run `npm run prisma:validate`, `npm run prisma:generate`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, and relevant focused test suites that do not depend on a live DB.
- Write or update targeted integration tests but mark them **NOT EXECUTED** until an isolated native DB is available. Never report section green prematurely or run integration against dev/prod/unknown DB.

**Once the owner configures valid LOCAL native PostgreSQL credentials in `.env` (never request/show the secret):**

1. Inspect setup and migration scripts for potentially destructive operations before running them.
2. Connect to local PG 18; verify `SELECT 1` and check `current_database()`/host for `strangeup_dev` and `strangeup_test`. Guard MUST reject dev/test identity collision and unauthorized targets.
3. Apply the existing forward migrations in order against both databases (no reset/drop/truncate of development DB). Include Task 008A new migration if created.
4. Run Profile integration tests covering Tasks **006, 007, 008 and 008A**, including username uniqueness, legacy bio, interest seed/replace/atomicity/T007-C01, favorite preference ordering/validation, location clear/private access, visibility default and self-only authorization, image upload validation and sanitization, avatar replacement/deletion/cleanup/concurrency, pending/suspended-user denials.
5. Run the **full** integration/regression suite covering auth, password change, profile and interests; report actual test counts/failures/skips. Investigate genuine app errors; don't map arbitrary DB outages to `409` or alter expectations just to pass.
6. Rerun Prisma/typecheck/lint/format/unit/build checks. Mark Own Profile `COMPLETE & VERIFIED` **only after** quality AND native PG section/full integration checks pass and the approved feature requirements are satisfied.
7. If native PG remains inaccessible due to the `YOUR_PASSWORD` placeholder / P1000, **do not spend time in restart loops**. Report `CODE IMPLEMENTED — SECTION VERIFICATION BLOCKED ON LOCAL POSTGRES CREDENTIALS`, give exact safe owner action and stop DB retries. Do not force a fallback to PGlite or Neon without owner approval.

## D. Documentation and Flutter backend contract

Maintain the actual implemented behavior in:

- `docs/decisions/D-OWN-PROFILE-REMAINING-REQUEST-task008.md` — record 5 final APPROVED/REVISED decisions and superseded defaults (do not leave OPEN).
- Any canonical product decision/ADR records, D-03/D-04 open-question entries and Figma profile parity matrix.
- `docs/api/CURRENT_APIS.md` — exact LIVE routes, auth, body, validation, errors, response examples, development-only avatar caveat.
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` — DTOs, null clearing, ordering, MIME/upload limits, location self-report, visibility enum semantics and current absence of public reads. For the separate Flutter developer **only**; no Flutter code.
- `openapi/identity.yaml` and other relevant OpenAPI fragments, including accurate error responses.
- `docs/plans/STATUS.md`, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md` — reflect Task 006/007/008 verified/unverified distinctions, policy approvals, pending native PG evidence and release blockers.

## E. Deliverable report

Provide one concise but evidence-backed completion report:

- Five approved decisions reconciled; actual default and existing-row handling.
- Modified files and any new migration(s).
- Favorite/location/avatar security behavior with real test evidence, including known risks.
- Exact API changes and Flutter-facing contracts.
- Tests **executed** with counts, DB/host used, and tests **not executed**.
- Native PostgreSQL setup status and remaining owner actions (if any).
- Git status (no commit or push).
- Own Profile section classification: `COMPLETE & VERIFIED` vs `IMPLEMENTED — VERIFICATION BLOCKED`, and the recommended next Figma-driven BACKEND section (Discovery & Public Profiles only after D-03/D-04 decisions).
