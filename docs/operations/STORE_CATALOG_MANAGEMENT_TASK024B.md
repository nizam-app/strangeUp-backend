# Store catalog management (Task 024B)

## Activation gates

| Gate | Default | Production |
|---|---|---|
| `STORE_CATALOG_MANAGEMENT_ENABLED` | `false` | **Must stay false** until owner approves MKT-01/02 (`production-env-policy`) |
| Staff role | — | `PlatformStaffGrant.role = STORE_CATALOG_MANAGER` (separate from `IDENTITY_REVIEWER`) |

When the feature flag is off, all `/v1/admin/store-catalog/*` routes return **`403 FEATURE_DISABLED`** after auth + role checks.

## Staff provisioning

### Production

1. Use the staff member’s normal StrangeUp user account (Bearer session).
2. Grant catalog role via controlled ops (SQL / break-glass — no public bootstrap HTTP):

```sql
INSERT INTO "PlatformStaffGrant" ("id", "userId", "role", "grantedAt")
VALUES (gen_random_uuid(), '<staff-user-uuid>', 'STORE_CATALOG_MANAGER', NOW())
ON CONFLICT ("userId", "role") DO UPDATE SET "revokedAt" = NULL, "grantedAt" = NOW();
```

3. Revoke with `revokedAt`; do not rely on client claims.

`PLATFORM_STORE_CATALOG_MANAGER_USER_IDS` **must not** be set in production.

**Identity reviewers do not inherit catalog access.**

### Non-production / Neon `strangeup_test`

- Integration tests: `upsertStaffGrant(..., STORE_CATALOG_MANAGER, null)`.
- Optional: `PLATFORM_STORE_CATALOG_MANAGER_USER_IDS` + `syncPlatformStaffBootstrapGrants()` in local tooling.

## Admin API surface (backend)

Base: `/v1/admin/store-catalog` — Bearer + `STORE_CATALOG_MANAGER` + feature flag.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/categories` | Active taxonomy |
| `GET` | `/products` | Operator list (all statuses) |
| `POST` | `/products` | Create **DRAFT** |
| `GET/PATCH` | `/products/:productId` | Read / edit draft or published |
| `POST` | `/products/:productId/publish` | Publish (eligibility rules) |
| `POST` | `/products/:productId/archive` | Archive |
| `POST` | `/products/:productId/variants` | Add variant |
| `PATCH` | `/products/:productId/variants/:variantId` | Price/stock/options (optional `expectedUpdatedAt`) |
| `PATCH` | `/products/:productId/variants/:variantId/stock` | Stock-only with required `expectedUpdatedAt` |
| `POST` | `/products/:productId/images` | Multipart `image` ingest |
| `PATCH/DELETE` | `/products/:productId/images/:imageId` | Sort / delete + storage cleanup |

Public buyer routes (`/v1/store/*`, cart, favorites) unchanged; checkout remains **`UNAVAILABLE`**.

## Product media storage

- **Backend selection:** same as Task 020 — `MEDIA_STORAGE_BACKEND=local` uses `STORE_UPLOAD_DIR`; `s3` uses private bucket namespace **`store-product`** (`{productId}/{uuid}.ext` keys in DB).
- **Ingest:** Sharp re-encode; JPEG/PNG/WebP only; bounded dimensions/size (`store-product-image.constants.ts`).
- **Read (buyers):** `GET /v1/store/products/:productId/images/:imageId` — Task 022 home gate; published products only.
- **Migration:** Existing `storageKey` values are **not** rewritten automatically. When moving to S3, re-upload via admin API or copy objects to matching keys under the `store-product` namespace; S3-primary deployments **fall back to local disk read** for legacy keys until migrated.

## Publish eligibility (server-enforced)

- Active category
- ≥1 **active** variant with valid price/stock
- ≥1 product image
- No official/verified badges or reviews (out of scope)

## Deferred (owner decisions)

- MKT-01 curated vs P2P sellers
- MKT-02 badge/verification policy
- Seller onboarding, multi-tenant catalog ACL
- Automated merchandising CMS UI
