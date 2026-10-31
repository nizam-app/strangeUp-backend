# Manual KYC — Cloudinary authenticated evidence (Tasks 031I-M1 / 031I-M3)

**Status:** Backend implemented. Migration **`20261030180000_task031im1_manual_kyc_cloudinary_evidence` applied on Neon `strangeup_test`** (2026-10-30); **not** on `strangeup_dev` until owner migrates dev. Isolated sandbox runtime: `MANUAL_KYC_TEST_RUNTIME.md`. **Production fail-closed** via `production-env-policy.ts`.

## Evidence kinds and document types (031I-M3 / 031I-M4)

| `ManualIdDocumentType` | Rear-side rule | Required kinds |
|---|---|---|
| `PASSPORT`, `OTHER_ONE_SIDED` | Never | `ID_DOCUMENT`, `SELFIE` |
| `OTHER_TWO_SIDED` | Always | `ID_DOCUMENT`, `ID_DOCUMENT_BACK`, `SELFIE` |
| `DRIVERS_LICENSE`, `STATE_ID`, `NATIONAL_ID` | Applicant **`documentHasRearSide`** at session start (`true` → back required; `false` → front + selfie only). One-sided physical IDs should use `OTHER_ONE_SIDED` / `PASSPORT` instead of falsely declaring no rear on a two-sided card. | Derived from declaration |

`VerificationSession.manualIdDocumentHasRearSide` stores the declaration for variable types (null for fixed-policy types).

Session moves to `IN_REVIEW` only when `requiredEvidenceKinds` are satisfied. Staff identity **approve** is rejected while evidence is incomplete or session expired. Uploads bind to `User.identityVerificationSessionId` and reject stale/unbound sessions.

## Authority paths (explicit, not interchangeable)

| `KYC_IDENTITY_AUTHORITY` | Identity decision source | Evidence storage |
|---|---|---|
| `none` | Disabled | — |
| `provider` | Veriff/mock webhooks (`KYC_PROVIDER_ENABLED=true`) | Provider-hosted (Veriff) |
| `manual` | Staff `POST …/manual-identity-decision` (`source: MANUAL_REVIEW`) | Cloudinary **authenticated** assets |

`KYC_PROVIDER_ENABLED=true` **cannot** combine with `KYC_IDENTITY_AUTHORITY=manual`.

Provider session routes return **409** when authority is `manual`. Veriff adapter code remains for future re-enable.

## Cloudinary protection model

1. **Upload:** Server-side signed upload only (`type=authenticated`, `access_mode=authenticated`). Public IDs are server-generated under `CLOUDINARY_KYC_EVIDENCE_FOLDER/{userId}/{sessionId}/…`.
2. **No public delivery:** DTOs expose metadata only (`evidenceId`, `kind`, sizes) — never Cloudinary URLs or secrets.
3. **Staff read:** `GET /v1/admin/identity-reviews/:reviewId/manual-evidence/:evidenceId` proxies bytes through the API (`Cache-Control: private, no-store`) after `IDENTITY_REVIEWER` auth. Backend fetches via signed Cloudinary **download** API (`type=authenticated`).
4. **Delete:** Staff `DELETE …/manual-evidence/:evidenceId` calls Cloudinary destroy + soft-delete row (`deletedAt`). Retention default `KYC_MANUAL_EVIDENCE_RETENTION_DAYS` (operational job deferred).

## Home access

Unchanged two-step model: trusted identity (provider webhook **or** manual staff identity decision) then platform `adminReviewStatus=APPROVED`. Manual path does **not** spoof Veriff webhooks.
