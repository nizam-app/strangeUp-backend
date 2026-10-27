# Task 012 — Groups & Communities decision table

**Status:** Implemented conservative defaults in source (2026-10-27). Rows are **provisional MVP rules**, not new owner-approved product policy, except where they restate D-03/D-04, blocks, KYC-01/03, and KYC-ENF. **D-06 remains OPEN.**  
**Database verification:** additive migration applied to isolated Neon `strangeup_dev` + `strangeup_test`; T012 integration cases passed on `strangeup_test` (2026-10-27).

| ID | Topic | Implemented now | Still unresolved |
|---|---|---|---|
| GRP-DISC | Public / private discoverability | Both `PUBLIC` and `PRIVATE_APPROVAL` appear in `GET /v1/groups` as summaries. Private is **not** unlisted. | Secret / unlisted groups. |
| GRP-JOIN-KYC | Group join KYC | Email-verified 18+ (`hasFullAccountAccess`) only. Government-ID KYC is **not** required to browse, create, join, post, or chat in a group. | Owner confirmation of D-06. |
| GRP-ROLES | Roles | Creator is `OWNER` + `ACTIVE`. Roles: `OWNER`, `MODERATOR`, `MEMBER`. Moderators may approve/decline, remove `MEMBER`s, pin/remove content, and edit non-restricted fields. Owner-only: privacy, capacity, archive, transfer, role changes. | Organization-level RBAC; multi-owner. |
| GRP-CAP | Capacity | Optional; counts **ACTIVE** members only (not pending). `FOR UPDATE` on join/approve. Decrease cannot go below current ACTIVE count. | Group waitlist. |
| GRP-REJOIN | Decline / removal rejoin | `LEFT` may rejoin as a fresh join. `DECLINED` / `REMOVED` must go through `PENDING` even on PUBLIC groups. | Cooldown duration. |
| GRP-OWNER | Owner leave | Denied until `POST .../transfer-ownership` to an ACTIVE member. Previous owner becomes `MEMBER`. | Multi-owner; orphan recovery if the owner account is deleted. |
| GRP-POST | Post audience | Active members only. Plain text. Optional `activityId` only if the activity is already group-linked. | Photo posts, polls, stories. |
| GRP-CHAT | Chat | Separate `CommunityGroupMessage` / read watermarks. Current ACTIVE membership required. No `DirectConversation`. TLS only; no E2EE/presence/typing. Historical rows are retained after leave/removal. | Retention policy; WebSockets; photo messages. |
| GRP-BLOCK | Block vs membership | A Task 009 block does **not** grant or remove membership. Blocked-user previews are redacted; blocked-authored posts/comments/messages are omitted. Managers may still approve/remove. | Auto-kick on block. |
| GRP-ACT | Linked activities | Attach/detach requires group manager **and** activity host. Listing uses Task 010 public DTOs. Membership is **not** RSVP, KYC, or meeting-instruction access. | Auto-created meetups; group-hosted publish shortcuts. |
| GRP-COVER | Cover media | Task 008A Sharp decode/re-encode; **5MB** input ceiling (Figma example is 10MB). Local `GROUP_UPLOAD_DIR` only. Filesystem+DB is not atomic; failed writes clean staged files. | Production object storage, moderation, retention. |
| GRP-VERIFY | Verified community | Never stored or returned. Email verification / membership / host assertion does not create a badge. | Trusted community verification source. |
| GRP-STORY | Stories | **Deferred.** No story table or LIVE routes. | 24h group stories. |
| GRP-ARCHIVE | Archive | Owner-only, non-destructive. Archived groups leave discovery and reject new joins/posts/chat. Existing members keep historical reads. | Hard delete / legal retention. |
| GRP-CATALOG | Categories vs tags | Separate `CommunityGroupCategory` catalog: sports, fitness, outdoor, social, hobbies. Tags are bounded lowercase tokens, max 5, **not** Task 007/010 slugs. | Owner-approved launch catalog. |
