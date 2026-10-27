# Task 011 — Social connections decision table

**Status:** Implemented conservative defaults in source (2026-10-27). Rows are **provisional MVP rules**, not new owner-approved product policy, except where they restate D-03/D-04, blocks, and KYC-03.  
**Native PostgreSQL verification:** pending credentials (same gate as Tasks 006–010).

| ID | Topic | Implemented now | Still unresolved |
|---|---|---|---|
| SOC-DM | DM consent | New chat requires an accepted `DirectMessageRequest`. No first-message text on the request. Mutual follow does **not** skip the request. | Whether mutual follow ever auto-authorizes chat. |
| SOC-FOLLOW-VIS | Who can be followed | Same as public profile read (D-03 + blocks). `VERIFIED_USERS_ONLY` needs trusted KYC `APPROVED`. | Public follower identity lists on other profiles. |
| SOC-COUNTS | Follower counts | Accurate DB counts on authorized `GET /v1/users/:id` only. Self lists are private. | Whether counts appear on discovery cards. |
| SOC-WAVE | Wave repeat | One persisted wave per `(sender, recipient)`. Duplicate POST is idempotent and does not refresh `createdAt`. No DM, push, expiry, or accept step. | Cooldown, wave-back, expiry. |
| SOC-VIS-CHANGE | Visibility after accept | Accepted conversations remain if both accounts stay eligible and unblocked. Profile-only fields still follow D-03. | Owner confirmation of this provisional rule. |
| SOC-UNBLOCK | Unblock | Does not recreate follow, wave, or request. Declined requests stay declined (`409` on retry). | Cooldown/retry after decline. |
| SOC-E2EE | Encryption claims | TLS only. No ciphertext, keys, or “verified E2EE” fields. Read receipts are watermarks, not device delivery. | Real E2EE design if ever approved. |
| SOC-ACT | `FOLLOWERS_ONLY` activities | Follow graph exists; Task 010 publish rules **unchanged** (still rejected). | Separate activity audience policy. |
| SOC-MOD | Abuse / reports | Uniqueness + in-memory per-user rate limits. No report/moderation dashboard. | Shared limiter, reports, retention. |
