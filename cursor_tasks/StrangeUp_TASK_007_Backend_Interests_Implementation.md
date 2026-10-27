# StrangeUp — Task 007: Backend Profile Interests (IMPLEMENTATION)

**Status:** OWNER-APPROVED — IMPLEMENT NOW  
**Workstream:** Backend only (Node.js, TypeScript, Express, Prisma, PostgreSQL)  
**Design basis:** Original StrangeUp Figma export, **Edit Personal Details** (`Html → Body-1.pdf`), already reviewed in Tasks 003/003A  
**Previous milestone:** Task 006, username and 300-character bio limit; do not rebuild existing functionality.

## 1. Owner-approved product decisions — binding

The owner has explicitly approved all the following for the first Interests release:

1. Interest choices are **exactly** the following 10 labels, based on the verified Figma profile screen, with the proposed stable API slugs shown here:

   | Slug | UI label |
   | --- | --- |
   | `biking` | Biking |
   | `fitness` | Fitness |
   | `outdoor` | Outdoor |
   | `social` | Social |
   | `sports` | Sports |
   | `swimming` | Swimming |
   | `hiking` | Hiking |
   | `travel` | Travel |
   | `music` | Music |
   | `food` | Food |

2. Interests are **optional**. A member may select **0 to 10** distinct catalog interests.
3. **Catalog-only**: free-text/custom interests and the Figma **“Add Interest”** creation behavior are **deferred**; do not add a user-generated-interest endpoint.
4. The member's selected interests are **private to their own account APIs**. Do **not** expose selections on public profiles, discovery APIs, search results, other-user endpoints, or social feeds. D-03 remains unresolved.
5. Interest selection does **not** grant KYC approval, age proof, messaging privilege, plan entitlement, or permission to attend/host meetups.
6. The Flutter app lives in another repository. Our responsibility is backend APIs, persistence, tests, OpenAPI, and integration documentation — **never Flutter implementation**.

These approvals authorize immediate implementation. Do not request a new decision or create a separate planning-only task for them.

## 2. First inspect the repository — then implement

Read, before editing:

- `AGENTS.md` and `.cursor/rules/engineering.mdc`
- `docs/plans/STATUS.md` and `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`
- `docs/api/CURRENT_APIS.md` and `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`
- Relevant OpenAPI (`openapi/identity.yaml` and other existing files)
- `docs/product/FIGMA_PROFILE_PARITY_MATRIX_2026-10-26.md` and original Edit Personal Details PDF if present
- `src/modules/me/`, policy/auth middleware, Prisma schema, migrations, test helpers
- Current `git status` and existing uncommitted edits

Preserve all approved identity/KYC policies, security boundaries, and uncommitted work. Do not invent conventions that conflict with the actual repository.

## 3. Database design and durable catalog

Implement the smallest coherent relational model compatible with existing Prisma conventions:

- An `Interest` reference catalog (stable `slug`, human-readable `label`, and stable `sortOrder` or equivalent), with **unique slug**.
- A `UserInterest` join relation between the owning account and catalog interest, with a **unique composite constraint** to prevent duplicates.
- Catalog options must be **persisted deterministically** with a version-controlled, idempotent provisioning strategy. A fresh local/test database after migrations/bootstrap must have the same 10 options; do not depend on somebody manually entering rows or an undocumented production console action.
- Prefer reusing existing `User` ownership and authorization patterns. Do not add unrelated profile fields or preemptively build activity/favorites models.
- Inspect the current migration history and add **one safe forward-only migration** where schema changes require it; do not rewrite applied migrations, reset databases, or alter existing production data.
- Follow existing database deletion/relation conventions; **do not invent broad new account-deletion policies**.
- All user-interest changes must be atomic; if validation, ownership, or a database operation fails, existing selections must remain unchanged.

## 4. Backend API contract — implement using current project conventions

Preferred routes, unless a verified existing route naming convention provides a materially better consistent shape:

| Method | Route | Access | Behavior |
| --- | --- | --- | --- |
| `GET` | `/v1/interests` | Authenticated; non-terminal users can browse catalog | Returns ordered list of the 10 canonical slug/label choices. This is catalog metadata, **not** other users' selections. |
| `GET` | `/v1/me/interests` | Authenticated self read, consistent with current `/v1/me/profile` read eligibility | Returns the current user's ordered selected interests; empty array if none. |
| `PUT` | `/v1/me/interests` | Authenticated self write, **same eligibility as `canEditProfile`** | Atomically replaces the current user's selected set. Empty array clears it. Repeated identical PUT has the same result. |

Request shape proposal for PUT:

```json
{ "interests": ["biking", "music", "travel"] }
```

Response-shape illustration (align wrapper, status code, casing, and error envelope to existing LIVE conventions):

```json
{
  "interests": [
    { "slug": "biking", "label": "Biking" },
    { "slug": "music", "label": "Music" },
    { "slug": "travel", "label": "Travel" }
  ]
}
```

Contract requirements:

- Receive **slugs**, not arbitrary label text or user-defined tags.
- Reject malformed payloads, missing/incorrect `interests` array, unknown slugs, duplicate slugs, more than 10 entries, wrong types, and extraneous fields using existing validation/error conventions. Treat rejection as **no write**.
- Mutations must use user identity from validated session/JWT middleware; never trust a `userId` in the request body.
- An omitted selection is never silently converted to a new option. GET should use deterministic catalog ordering.
- Follow existing `401` / `403` conventions for unauthenticated, expired/revoked sessions, pending-verification, suspended/deleted users; do **not** change auth rules to satisfy the new module.
- Protect against racing replacement requests causing partially merged or over-limit selection states. Use a sound transactional/concurrency strategy appropriate to the existing DB; report any assumptions/native-Postgres tests remaining.
- No unauthenticated read of other members' interests, public listing, matching, recommendation ranking, or member search.
- Do not modify existing `GET/PATCH /v1/me/profile` semantics unless a carefully assessed *additive* field is warranted; if adding one, document consistency/ownership rules and thoroughly test backward compatibility. The above dedicated APIs are a sufficient initial solution.

## 5. Mandatory verification

Add focused tests for at least:

**Unit / validation**
- All ten approved catalog slugs and labels, deterministic ordering
- Accept zero, one and ten distinct options
- Reject eleven, unknown/duplicate/uppercase/free-text slug, wrong/missing payload and unrelated fields
- `PUT` is replacement, not append; repeated identical request is idempotent

**Integration / security**
- Catalog persisted on fresh test DB and available via authenticated GET
- Self selection round-trip; replacing set; clearing set
- Selections belong to authenticated user only; user A cannot view or overwrite B's private selections
- Pending email/unapproved eligibility: self GET consistent with existing policy; PUT denied
- Suspended/deleted or revoked session follows existing current security semantics
- Invalid write has no partial effect; unique constraint prevents duplicate associations
- Concurrent writes do not leak users' data or produce partial/interleaved membership sets
- Existing auth, `/v1/me/profile`, username, 300-character bio and password-change regression tests still pass

Run and report **actual** results of:

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
RUN_INTEGRATION=1 npm run test:integration
```

Use **only** the verified isolated local integration database. Previous working topology: one `strangeup_dev` Prisma Dev TCP instance on `localhost:51214`, development database `template1`, separate integration database `strangeup_test` on the same server; verify live configuration before migrating. Do not create a second Prisma Dev instance, interfere with port 3000, destroy/reset dev data, or endlessly retry unhealthy database connections. If DB unavailable, diagnose once, stop repeated tests, and report a precise blocker. Run the full integration suite (Task 006 reported only focused `me.integration.test.ts` tests).

## 6. Documentation must ship with implementation

Update in the **same implementation milestone**:

- `docs/api/CURRENT_APIS.md`: only actually implemented and verified endpoints tagged LIVE; request/response/error/auth details and evidence
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`: exact catalog retrieval, self-read, replacement/clear flow, DTOs, loading/empty/401/403/400/error states; example HTTP and Dart-facing payloads only, **no Flutter source edits**
- Appropriate existing or new `openapi/*.yaml`: exact schemas/responses, validation, access constraints
- `docs/plans/STATUS.md`: task outcome and real test counts
- `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`: implemented interests, deferred custom Add Interest and public visibility
- Appropriate product decision record / Figma parity matrix: show owner approval and source reference; preserve distinct CONFIRMED vs DESIGN-EVIDENCED vs DEFERRED status

No separate documentation gate should delay implementation.

## 7. Explicit exclusions

Do **not** implement:

- Free-text interest creation, moderation of custom interests, or admin interest editor
- Public profiles/discovery or anyone else's selected interests; D-03 stays open
- Favorite activities as actual Activity entities, activity catalog/hosting/joining
- Avatar/media, location or profile visibility; D-04 and associated decisions stay open
- Stripe, payments, KYC provider, fake verification success, social auth or Flutter app integration
- Account deletion, unnecessary refactors, production changes

**Do not commit or push.** Keep previous uncommitted changes intact.

## 8. Completion report — short but evidenced

Report:
1. Exact implemented endpoints and stable contract examples
2. Prisma models/migration/catalog provisioning; how fresh DBs get 10 options
3. File changes and security/transactional design
4. Unit tests and **full** integration tests actually run (passed, failed, skipped)
5. API/OpenAPI/Flutter documentation updates
6. Status of deferred interests, favorite activities, avatar, privacy/location, provider integrations
7. Next smallest Figma-driven **backend** slice, emphasizing shipping actual features

**Definition of done:** backed-by-real-DB, permission-safe selection and read APIs are implemented, tests are executed, and independent Flutter developers can integrate using published contracts. No mock-success claims.
