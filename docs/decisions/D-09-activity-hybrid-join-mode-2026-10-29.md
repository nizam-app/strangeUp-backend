# D-09 — Activity hybrid join mode (ACT-APPROVAL)

**Status:** Accepted (owner, 2026-10-29)  
**Task:** 027E  
**Related:** MDWQ-0701, MDWQ-0714

## Decision

Each activity has a server-owned join mode:

- **`AUTO`** — default for all existing and new activities unless the host chooses otherwise in **draft**. Instant **CONFIRMED** when eligible and capacity allows; otherwise FIFO **WAITLISTED** when waitlisting is enabled (Task 010 behavior preserved).
- **`HOST_APPROVAL`** — joining creates a **PENDING** request. No confirmed seat, meeting instructions, or private participant access until the host approves.

Hosts set join mode only while the activity is a **draft**. Join mode is **locked after publish**; existing participants and waitlists are not silently converted.

Host review:

- Approve → **CONFIRMED** when capacity permits.
- When full and waitlisting enabled → **WAITLISTED** with `hostApprovedAt` set (approved waitlist).
- When full and waitlisting disabled → **409**, request stays **PENDING**.
- Decline → **DECLINED** (historical row retained).
- FIFO promotion considers only **WAITLISTED** rows that are FIFO-eligible (`AUTO` waitlist or `HOST_APPROVAL` with `hostApprovedAt`).

Applicants may **withdraw** **PENDING** requests via existing leave/RSVP delete. **Reapplication after DECLINED** is **not** enabled pending product policy (409).

## Out of scope (027E)

Public attendee roster, activity group chat, followers-only publishing, Figma capacity counter fiction (MDWQ-0712 remains product clarification only).
