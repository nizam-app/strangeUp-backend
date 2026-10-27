# Media object storage (Task 020)

Private S3-compatible object storage for profile avatars, activity covers, group covers, and gated group content (stories/photo attachments when D-06 is enabled). Store catalog images remain local read-only references until a seller ingestion workflow is approved.

## Modes

| `MEDIA_STORAGE_BACKEND` | Behavior |
| --- | --- |
| `local` (default) | Files under `PROFILE_UPLOAD_DIR`, `ACTIVITY_UPLOAD_DIR`, `GROUP_UPLOAD_DIR`. |
| `s3` | Objects in a **private** bucket; DB `storageKey` values unchanged (`{ownerId}/…` layouts). Server streams bytes after auth — no public URLs or presigned GET in API DTOs. |

## S3 / Cloudflare R2 setup (operator)

1. Create a **private** bucket (block all public access).
2. Issue scoped access keys (read/write/delete on that bucket only).
3. Set env (placeholders in `.env.example`):
   - `MEDIA_STORAGE_BACKEND=s3`
   - `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION` (`auto` for R2)
   - `MEDIA_S3_ENDPOINT` for R2; omit for AWS S3
   - `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY`
   - Optional `MEDIA_S3_KEY_PREFIX` (e.g. `strangeup`)
   - `MEDIA_S3_FORCE_PATH_STYLE=true` is common for R2
4. Production startup **fails closed** on missing/placeholder bucket or credentials.
5. **Do not** run live write smoke tests without owner approval.

Object key layout: `{prefix}/{namespace}/{storageKey}` where namespace is one of `profile`, `activity-cover`, `group-cover`, `group-content`.

## Migration and backward compatibility

- Existing DB rows keep the same logical `storageKey` strings.
- Switching to `s3` does **not** migrate local files automatically. Plan a one-time backfill copy into the bucket preserving keys, or accept 404 until users re-upload.
- No schema migration required for Task 020.

## Cleanup and orphans

- Upload flow: write object → DB update → delete previous key (same as local). Failed DB update deletes the new object.
- Prefix-wide purge (account deletion, bulk orphan reconciliation) is **not** automated in application code; use ops tooling with dry-run first (`scripts/cleanup-group-expired-content.ts` handles expired **story metadata** only).
- Expired stories remain inaccessible at read time before physical delete.

## Security

- Sharp re-encode before upload (008A); no SVG.
- Storage keys are server-generated only.
- Logs must not include object bodies, credentials, or presigned URLs.
