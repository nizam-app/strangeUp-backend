# Task 010 — Activities decision table

**Status:** Implemented conservative defaults in source (2026-10-27). Rows below are **not** new owner-approved product policy except where they restate KYC-01/03/05/ENF and D-03/D-04.  
**Native PostgreSQL verification:** pending credentials (same gate as Tasks 006–009).

| ID | Topic | Implemented now | Still unresolved |
|---|---|---|---|
| ACT-CATALOG | Activity category vs profile Interests | Separate `ActivityCategory` catalog seeded from explicit Figma labels: Biking, Padel & Tennis, Running, Swimming, Fitness. Interests catalog is unchanged. | Which extra Screen 11 chips are launch options; any later merge with Interests. |
| ACT-CUTOFF | Edit / cancel cutoff | No two-hour lock. Hosts may edit safe fields and cancel until the activity is `CANCELLED`/`COMPLETED`. Published schedule/mode cannot change while anyone is confirmed or waitlisted. | Figma “edit/cancel until two hours prior” is **not** approved. |
| ACT-WAITLIST | Promotion when the next queued user lacks KYC | FIFO by `waitlistPosition`. If the head is not currently eligible (KYC/account/block), the seat stays open and the queue is **not** skipped. | Skip/bypass, reserved-seat timers, and priority rules remain open (`D-09-kyc-enforcement-ops`). |
| ACT-ROSTER | Attendee identities | No public or host attendee roster. Self responses expose only the caller’s state and waitlist position. | Public vs confirmed-only face list. |
| ACT-FOLLOW | `FOLLOWERS_ONLY` | Stored on drafts only. Publish and discovery reject it until a Follow graph exists. | Follow graph + audience enforcement. |
| ACT-COVER | Cover media | Optional; Task 008A byte validation/re-encode; local `ACTIVITY_UPLOAD_DIR` is **development only**. | Production object storage, moderation, retention. |
| ACT-VENUE | Venue vs meeting instructions | Public DTOs expose `venueName` / city / region only. Exact instructions and virtual details are host + confirmed-eligible only (`GET /meeting`). No coordinates or maps. | Map pins, directions, geocoding. |
| ACT-KYC-PROD | Production KYC authority | Real-world publish/confirm/meeting **fail closed** when `NODE_ENV=production` and `KYC_PROVIDER_ENABLED` is not true. Email verification is never KYC. | Provider selection (KYC-02) and live approval path. |
| ACT-COMPLETED | Completed status | Enum exists. No automatic transition and no host complete endpoint. Past published activities are not joinable and are omitted from the default upcoming list. | Owner completion / archival policy. |
| ACT-NOTIFY | Host/guest notices after cancel or block | Records are updated; no notification, refund, or host-swap workflow. | Notifications, refunds, block-after-join remediation. |
