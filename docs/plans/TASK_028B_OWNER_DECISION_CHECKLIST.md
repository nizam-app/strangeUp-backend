# Task 028B — Owner decision checklist (personal meetup invitations)

**Status:** **P0 FOUNDATION ACCEPTED (owner, 2026-10-29)** — see `D-28-personal-meetup-invitation-2026-10-29.md`. P1/P2 rows may remain open.  
**Date:** 2026-10-29  
**Policy:** `docs/decisions/D-28-personal-meetup-invitation-2026-10-29.md`  
**API draft:** `docs/product/MEETUP_INVITATION_API_CONTRACT_DRAFT.md`

**Instructions:** For each row, mark **Accept proposal**, **Revise** (note new rule), or **Defer**. Implementation (**028C+**) starts only after all **P0** rows are resolved.

---

## P0 — Required before 028C

| ID | Question | 028B proposal | Owner decision |
|---|---|---|---|
| D28-P0-01 | **MEET-ELIGIBILITY:** May any activation-qualified user invite any discoverable profile (D-03), with no follow/DM requirement? | Yes — same as social contact initiation | ☐ Accept ☐ Revise ☐ Defer |
| D28-P0-02 | **States:** `PENDING`, `ACCEPTED`, `DECLINED`, `WITHDRAWN`, `EXPIRED` only for MVP? | Yes | ☐ Accept ☐ Revise ☐ Defer |
| D28-P0-03 | **Actors:** Recipient-only accept/decline; sender-only withdraw on `PENDING`? | Yes | ☐ Accept ☐ Revise ☐ Defer |
| D28-P0-04 | **Side effects:** No Activity RSVP, DM thread, or group join on any transition? | Yes | ☐ Accept ☐ Revise ☐ Defer |
| D28-P0-05 | **Venue:** City/region + optional label before accept; address line hidden from recipient until `ACCEPTED`? | Yes | ☐ Accept ☐ Revise ☐ Defer |
| D28-P0-06 | **KYC:** Sender KYC at create; recipient KYC at accept (KYC-ENF-02)? | Yes | ☐ Accept ☐ Revise ☐ Defer |
| D28-P0-07 | **Task 022:** Both parties must pass `hasHomeAccess` at create, read, mutate? | Yes | ☐ Accept ☐ Revise ☐ Defer |
| D28-P0-08 | **One pending invite per pair:** DB-enforced single `PENDING` per `(senderId, recipientId)`? | Yes | ☐ Accept ☐ Revise ☐ Defer |
| D28-P0-09 | **Expiry:** Auto-`EXPIRED` when `scheduledStartsAt` passes while `PENDING`? | Recommended | ☐ Accept ☐ Revise ☐ Defer |
| D28-P0-10 | **Block after send:** Hide invite from both parties (`404` reads)? | Yes | ☐ Accept ☐ Revise ☐ Defer |

---

## P1 — Should decide before 028D (REST)

| ID | Question | 028B proposal | Owner decision |
|---|---|---|---|
| D28-P1-01 | **Note max length:** 200 characters? | Yes (Figma) | ☐ Accept ☐ Revise ☐ Defer |
| D28-P1-02 | **Title max length:** 80 characters? | Proposed | ☐ Accept ☐ Revise ☐ Defer |
| D28-P1-03 | **Re-invite** after `DECLINED` / `WITHDRAWN` / `EXPIRED`: allowed immediately? | Yes (new row) | ☐ Accept ☐ Revise ☐ Defer |
| D28-P1-04 | **Declined cooldown** (hours env): default off? | Yes | ☐ Accept ☐ Revise ☐ Defer |
| D28-P1-05 | **Inbox list:** Omit `addressLine` and full note; optional truncated preview? | Yes | ☐ Accept ☐ Revise ☐ Defer |
| D28-P1-06 | **Outgoing box:** Implement `box=outgoing` in MVP? | Yes (API) | ☐ Accept ☐ Revise ☐ Defer |
| D28-P1-07 | **Send rate limit:** 10 creates / hour / user (env)? | Proposed default | ☐ Accept ☐ Revise ☐ Defer |
| D28-P1-08 | **Cancel after ACCEPTED:** defer entirely? | Yes — not in MVP | ☐ Accept ☐ Revise ☐ Defer |

---

## P2 — Can defer (documented)

| ID | Question | 028B stance | Owner decision |
|---|---|---|---|
| D28-P2-01 | **MEET-RESCHEDULE** / counter-proposal | **OWNER_DEFERRED** (MDWQ-0724) | ☐ Defer confirmed |
| D28-P2-02 | Maps / directions / geocode | **DO NOT SHIP** | ☐ Defer confirmed |
| D28-P2-03 | Trust banner / mutual count / check-in copy | **DO NOT SHIP** | ☐ Defer confirmed |
| D28-P2-04 | Screen 10 profile tiles (activities, groups) | MDWQ-0726 separate | ☐ Defer confirmed |
| D28-P2-05 | Push notification copy / prefs detail | 028G | ☐ Defer confirmed |
| D28-P2-06 | Account deletion vs invite retention | Restrict FK until policy | ☐ Accept ☐ Revise ☐ Defer |

---

## Sign-off

| Field | Value |
|---|---|
| Owner name | |
| Date | |
| D-28 status change | ☐ Promote PROPOSAL → **Accepted** (new dated ADR or edit D-28 header) |
| Authorized next phase | ☐ **028C** schema only ☐ Revise docs ☐ Hold |

**Record revisions in:** `docs/decisions/D-28-*.md`, `OPEN_QUESTIONS.md` (D-07), `MASTER_DEFERRED_WORK_QUEUE.md`.
