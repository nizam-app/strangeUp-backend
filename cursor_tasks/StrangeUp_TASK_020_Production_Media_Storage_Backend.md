# StrangeUp — Task 020: Production Media Storage Foundation (BACKEND ONLY)

**Status:** Implementation authorized for safe, independently supportable functionality. Production provider activation, external writes, destructive object migration, and account-specific credentials are NOT authorized.

## Baseline and intent
- Tasks 006–019B preserved. Last reported: 187 unit tests pass; 97 integration tests pass and one intentional documentation placeholder skipped on isolated Neon `strangeup_test`.
- Live Upstash atomic fixed-window test passed; Resend API reachable but sender domain is a placeholder and `PUBLIC_APP_BASE_URL` absent. Live email smoke was **not** authorized and must not be sent.
- Existing media handling is local-disk for profile avatars (008A), group covers (012), activity covers (010), group Stories/photo attachments (016, **feature gated off**). Store product images may have read-only local references; inspect source, do not infer any store upload workflow.
- Goal: implement and thoroughly test an S3-compatible **private object storage adapter** and safe selection/wiring for these existing media paths, making a future deployment to AWS S3 or Cloudflare R2 possible without exposing files or modifying client-facing APIs.

## 1. Inspect real code before editing
Read `AGENTS.md`, `.cursor/rules/*`, Prisma schema and migrations, `src/config/env.ts`, `src/config/production-env-policy.ts`, each actual media storage/service/controller, media security tests, `docs/api/CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, and current task/status docs. Inspect current `.env.example` (never print `.env` secrets).
Document actual media inventory and current object-key/db references; identify public vs self/membership access paths, and current behavior when media file is missing. Preserve all routing and response contracts.

## 2. Implement a shared typed storage boundary and S3 adapter
- Add a minimal well-defined `MediaObjectStore` for **put/get/delete** (and metadata/exists only if required). Reuse local implementations where possible without destabilizing them.
- Use `@aws-sdk/client-s3` AWS SDK v3, compatible with AWS S3 and R2 endpoint configuration. Keep credentials server-only and avoid assuming provider-specific features such as ACLs, bucket lifecycle rules, or versioning.
- Implement bounded network timeouts, request stream handling, clear error classes, and safe limited retries for idempotent operations; do not issue unbounded retries on writes. Never log objects, API keys, signed URLs or sensitive paths.
- Keep all buckets private. **Do not** return S3 keys, bucket names, or presigned GET URLs in existing public DTOs. Existing protected media GET endpoints should retain authorization and stream bytes server-side after authorization, with correct `Content-Type`, restrictive cache policy, size limits and safe error handling.
- Store only sanitized, Sharp-re-encoded JPEG/PNG/WebP (reuse 008A); enforce size, pixels, dimensions, no SVG and metadata removal before upload, not after.
- Key generation must be unpredictable and scoped per type and owner; prevent traversal/cross-tenant reads. Storage key from untrusted request body must never be accepted.

## 3. Configuration and safe rollout
- Introduce/align environment selection (e.g. `MEDIA_STORAGE_BACKEND=local|s3` plus appropriate bucket/region/endpoint/credentials), adapting to existing conventions rather than creating duplicate flags.
- Local remains default for dev/test; S3 mode is opt-in. In production, local paths must remain rejected by the existing production environment policy.
- On production S3 mode, **fail startup** on missing/placeholder/inconsistent bucket, endpoint, TLS, or credentials. Do not issue external test writes without owner permission.
- No real provider/bucket selected yet. Support AWS S3 and R2 via one transport, leave production activation unauthorized until owner picks provider and creates private bucket/keys.
- Include env documentation using placeholders only.

## 4. Integrate without rewriting existing product functionality
- Avatar: self media GET/POST/DELETE; future public-avatar endpoint must recheck D-03 + blocks before fetching object.
- Activity covers: preserve public and host-specific access guards, and private meeting-information separation.
- Group covers and gated group-content media: retain membership, active status, author/block rules, expiry at read time, and **`GROUP_COMMUNITY_INTERACTIVE_ENABLED=false`** default. Do not activate Stories, photo posts or polls.
- Product images: only move to common storage if existing source clearly supports it; do not add seller, catalog ingestion, or product publishing permissions.
- Never expose permanent public URLs or broaden any DTO/data visibility. Keep existing upload interfaces and multipart field names for Flutter.
- Existing local objects in databases must remain readable in local mode; DO NOT silently reinterpret old local keys as cloud keys or move/delete old objects. If mixed-source support needs schema updates, use additive migration with safe backward compatibility and clearly identify required migration/backfill before production switch.

## 5. Failure safety, consistency and cleanup
- Explicitly design upload -> DB reference -> old-object cleanup so a failed DB update does not destroy the prior object. Avoid claiming filesystem/object store + SQL transactions are atomic.
- Handle concurrent replacement and orphan scenarios. Prefer a durable cleanup/reconciliation mechanism with safe owner-scoped keys and dry-run mode; if implementation is deferred, identify exact remaining safety limitation and add tests.
- Deleting a DB row/user does not automatically delete storage objects. Address orphan cleanup for avatar, covers and gated stories within approved retention constraints. Do not implement user-data destruction beyond approved flows.
- Expired Stories must be inaccessible at read time even before physical cleanup. Object purge scheduling and legal retention remain owner/ops-gated.

## 6. Tests and release behavior
- Unit tests using a fake/mock S3 transport: upload, get, delete, missing objects, sanitized bytes, TLS/credential validation, safe retries/timeouts, key ownership, error classification, cleanup/orphan handling.
- Integration tests on isolated Neon `strangeup_test` for existing media HTTP access control and no regressions. No real AWS/R2 requests in CI. Simulate cloud adapter with in-memory/controlled test double if useful.
- Confirm prior public-avatar and group-content 404s on blocked/hidden/expired media. Confirm feature flag remains off by default, and production refuses local media.
- Run `prisma validate/generate`, `typecheck`, `lint`, `npm test`, `build`, full `RUN_INTEGRATION=1 npm run test:integration`. Report `format:check` honestly; no mass rewrite of 245 existing drifting files.
- If a migration is necessary, use additive migration only and run existing safe Neon migration workflow after confirming dev/test identity. Never reset/truncate development or production.

## 7. Docs and reporting
Update `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, applicable OpenAPI schemas ONLY if responses/errors change; update `STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, `.env.example`, and an operator guide for S3-compatible storage setup, privacy and cleanup.
Report:
- Paths changed and which media surfaces use the new abstraction
- Exact behavior in `local` and `s3` modes
- Auth/privacy proof and storage migration/backward compatibility
- Unit/integration/format results with numbers
- External provider verification (if not run, say NOT RUN)
- Blockers to safe production activation
- Next recommended milestone: provider-selected KYC integration and canonical consent IDs/release gates.

## Global constraints
BACKEND ONLY; no Flutter repo/code, unrelated feature expansion, public storage buckets, S3 credentials in source/logs, payment/KYC provider activation, mass reformat, commits/pushes, production operations, unapproved real external calls, destructive DB migration or file deletion. Keep `TRANSACTIONAL_EMAIL_MODE=dev_stub`, `RATE_LIMIT_STORE=memory` local defaults and avoid sending live Resend email. Do not use the verified domain belonging to another business as StrangeUp's sender without owner authorization.

**Priority:** Complete substantial working code and tests, not another planning-only deliverable. Preserve existing 006–019B behavior and report actual verification evidence.
