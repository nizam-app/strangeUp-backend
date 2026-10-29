# Task 027I — Final verification & closure report

**Date:** 2026-10-29  
**Status:** **COMPLETE WITHIN APPROVED SCOPE** (backend)  
**Plan:** `cursor_tasks/StrangeUp_TASK_027_After_Membership_Activities_Source_Audited_Staged_Execution.md` §027I  
**Parity:** `docs/product/FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027I_FINAL.md`

**Not claimed:** Full Figma parity, production deploy readiness, 027G/H product features, MDWQ-0099 full Neon regression.

---

## 1. Source audit (implementation)

Verified in repository (not report-only):

| Area | Key modules / routes |
|---|---|
| AUTO / FIFO RSVP | `activity-rsvp.service.ts`, `activity-join-policy.ts` |
| HOST_APPROVAL | `ActivityJoinMode`, PENDING/DECLINED states; `activity-host-join-requests.service.ts`; `/v1/me/activities/:id/join-requests/*` |
| Inventory + pending view | `activity-my-inventory.service.ts`; `view=pending`, `PENDING_APPROVAL` |
| Roster | `activity-roster-policy.ts`, `activity-roster.service.ts`; `GET /v1/activities/:id/participants` |
| Privacy / 025C | `activity-public-visibility.ts`; meeting + new RSVP guards |
| Saved activities | `saved-activity-visibility.ts`, `saved-activity.service.ts` |
| Host manage | `activity-host.service.ts` (schedule/capacity locks) |
| Task 022 gate | `requireHomeAccess` on gated routers |
| Meetup separation | `src/modules/meetup-invites/*` — distinct Prisma model and `/v1/meetup-invites` (Task 028) |

**Activity lifecycle notifications:** No emitter for join-request/approve/cancel events (027H intentionally skipped; MDWQ-0706).

---

## 2. Static verification

| Command | Result |
|---|---|
| `npm run typecheck` | **Pass** |
| `npm run lint` | **Pass** |
| `npm run build` | **Pass** |
| `npm test` (unit, no Neon) | **279/279** passed (75 files) |

---

## 3. Bounded Neon integration (`strangeup_test`)

**Guard:** `RUN_INTEGRATION=1`, `INTEGRATION_DATABASE_URL` → catalog `strangeup_test` (via `.env` + integration global setup).

| Suite | File | Tests executed | Result |
|---|---|---:|---|
| 027B inventory | `activity-inventory-027b.integration.test.ts` | 2 | **Pass** |
| 027C privacy | `activity-privacy-027c.integration.test.ts` | 3 | **Pass** |
| 027D manage | `activity-manage-027d.integration.test.ts` | 2 | **Pass** |
| 027D saved | `saved-activities-privacy-027d.integration.test.ts` | 1 | **Pass** |
| 027E hybrid join | `activity-join-approval-027e.integration.test.ts` | 3 | **Pass** |
| 027E security | `activity-join-approval-027e-security.integration.test.ts` | 8 | **Pass** |
| 027F roster | `activity-roster-027f.integration.test.ts` | 4 | **Pass** |
| 025C regression | `activities.integration.test.ts` (`-t T025C`) | 2 | **Pass** (6 other tests skipped by filter) |
| **Total focused** | | **25** | **25/25 Pass** |

**Duration (027 suites batch):** ~201s (7 files, 23 tests in single vitest invocation matching 027* patterns).

### Test harness note (not an application defect)

Initial run: **T027F-04** failed on `Profile_username_lower_key` when updating profile to hardcoded username `blockeduser` (leftover data on Neon). **Fix:** unique username derived from `u3.userId` in `activity-roster-027f.integration.test.ts`. Re-run: **4/4** pass.

---

## 4. Security checklist (evidence mapping)

| Requirement | Evidence |
|---|---|
| Task 022 activation on main-app activity surfaces | Integration users via activated paths; T027E-SEC-08 suspended host **401** on approve |
| KYC revocation / meeting gate | T027C-P02; T027E-SEC-03 DECLINED → meeting **403** |
| Bidirectional block | T027E-SEC-04 approve **409**; roster block redaction T027F-04 |
| PENDING / waitlisted / declined meeting & roster denial | T027E-02, T027F-02 |
| 404 concealment vs 403 eligibility | 027c host deactivation; join hidden activity **404** |
| 409 capacity / idempotency / declined reapply | T027E-03, SEC-01/02/07; unit `activity-join-policy.test.ts` |
| Participation rows preserved on visibility denial | T027C-P01 inventory + leave after host deactivation |
| No sensitive keys on public/roster DTOs | T027F-04 `publicActivityDtoContainsSensitiveKeys` |

---

## 5. Task 028 compatibility

- **Activity join approval (027E):** `Activity` + `ActivityParticipation` on `/v1/activities` and `/v1/me/activities/.../join-requests`.
- **Personal meetup (028):** `PersonalMeetupInvitation` on `/v1/meetup-invites`; notifications types MEETUP_* (028G).
- Handoff §13 vs §13A explicitly separates domains; no schema overlap.

---

## 6. Documentation updates (027I)

| Artifact | Change |
|---|---|
| `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027I_FINAL.md` | **Added** — authoritative four-screen matrix |
| `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027A.md` | Preserved baseline table updated (D-09) |
| `MASTER_DEFERRED_WORK_QUEUE.md` | MDWQ-0718, 0719; Task 027 closure notes; 027G/H SKIPPED |
| `STATUS.md` | Task 027I closure header |
| `ACTIVE_SCOPE_AND_DEFERRALS.md` | Task 027 complete within scope |
| `FLUTTER_DEVELOPER_HANDOFF.md` | MDWQ-0718 cross-ref on saved count |
| `design-reference/.../MANIFEST.md` | ACT-APPROVAL status → Accepted (D-09) |
| `cursor_tasks/StrangeUp_TASK_027_*.md` | Phase 027I complete |
| `tests/integration/activity-roster-027f.integration.test.ts` | Username isolation fix (harness) |

---

## 7. Phases explicitly skipped for Task 027 closure

| Phase | Reason | Open queue |
|---|---|---|
| **027G** | Owner decision per subfeature | MDWQ-0711, 0702, 0703, 0713 |
| **027H** | ACT-NOTIFY not authorized | MDWQ-0706 |

---

## 8. Remaining owner decisions & release blockers

**Optional / product (not blocking 027 backend closure):**

- MDWQ-0718 — settings `counts.savedActivities` vs visible list length  
- MDWQ-0719 — reapply after DECLINED host decision  
- MDWQ-0712 — Figma counter copy vs `hostParticipationSummary`  
- MDWQ-0702–0703, 0711, 0713 — 027G items  
- MDWQ-0706 — 027H notifications  
- MDWQ-0401, 0407 — geo and trust marketing  

**Release blockers (cross-cutting, unchanged):**

- MDWQ-0099 — full isolated Neon regression at release gate  
- MDWQ-0100–0105 — production topology, consent IDs, email, media, rate limits, format drift  

---

## 9. Closure verdict

**Task 027 backend: COMPLETE WITHIN APPROVED SCOPE** — Phases **027A–027F** delivered and verified; **027G** and **027H** skipped with queue entries retained; **027I** focused verification **25/25** Neon tests pass plus **279** unit tests.

**STOP** — No further Task 027 phases authorized without new owner scope.
