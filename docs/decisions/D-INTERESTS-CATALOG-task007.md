# D-INTERESTS-CATALOG — Task 007 owner approval

**Date:** 2026-10-27  
**Source:** `Html → Body-1.pdf` (Edit Personal Details), Task 007 implementation brief  
**Status:** CONFIRMED for first release

| Decision | Approval |
|---|---|
| Catalog | Exactly 10 slugs/labels (biking … food) persisted in `Interest` table |
| Selection | Optional 0–10 distinct catalog slugs per user via `PUT /v1/me/interests` |
| Custom interests | **Deferred** — no free-text or user-created tags |
| Visibility | **Private** to `/v1/me/interests` only; no public profile or discovery exposure (D-03 open) |
| Entitlements | Selection does not affect KYC, messaging, plans, or meetup access |
