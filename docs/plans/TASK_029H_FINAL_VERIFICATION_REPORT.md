# Task 029H — Final Groups & Jobs verification & closure

**Date:** 2026-10-29  
**Outcome:** Task **029 COMPLETE WITHIN APPROVED SCOPE** (focused verification **PASS**).  
**Parity (closure):** `docs/product/FIGMA_GROUPS_JOBS_PARITY_TASK029H_FINAL.md`  
**Prior phase reports:** 029A, 029B, 029C, 029D, 029F

**Not claimed:** full Figma parity, Jobs publishing/employer delivery, production readiness, or Task 030 authorization.

---

## 1. Scope closure decisions

| Phase | Closure status | Notes |
|---|---|---|
| 029A | **COMPLETE** | Read-only audit + MANIFEST |
| 029B | **COMPLETE** | My Groups `view` + `q` |
| 029C | **COMPLETE** | Archived mutation guards |
| 029D | **COMPLETE** | Membership lifecycle hardening |
| 029E | **SKIPPED** (this closure) | Interactive Stories/polls/photo — **MDWQ-0602**, D-06; flag stays **false** |
| 029F | **COMPLETE** | Jobs discovery/saved; `q`+`cursor` fix |
| 029G | **SKIPPED** (this closure) | Publish, employer delivery, application lifecycle — **MDWQ-0901**, **0902**, **0905** **remain open** (not cancelled) |
| 029H | **COMPLETE** | This report |

---

## 2. Verification matrix (executed)

### Groups (029B–D + Task 012 baseline)

| Area | Evidence |
|---|---|
| Discovery + private summaries | T012-P03, T029B-P02 |
| My Groups views / search | T029B-P01 |
| Create + manage fields | T029C-P01 |
| Capacity concurrency | T012-C01, T029C-P02, T029D-P04 |
| Archived guards | T029C-P03, T029D-P01 |
| Roles / cross-group auth | T029D-P02 |
| Remove/leave content loss | T029D-P03 |
| Posts / chat / cover privacy | T012-P04–P07 |
| Task 022 gate | T029B-P03 |
| Activity / meetup / membership separation | T012-P08 |

### Jobs (029F + Task 014)

| Area | Evidence |
|---|---|
| Published-only list/detail | store-jobs integration + unit `job-query` |
| Filters + `q`+`cursor` | T029F-P01 |
| Saved privacy / closed listings | T029F-P02 |
| Apply + self application read | T029F-P03 |
| Task 022 gate | T029F-P04 |
| DRAFT isolation | Task 014 drafts + integration patterns |

### Task 023 (spot check — not full socket suite)

- Group chat membership gate: **T012-P06** (bounded groups file).
- Remove/leave invokes **`onUserLeftGroup`** → **`evictUserFromGroupChat`** (`group-membership.service.ts`, `messaging-realtime.lifecycle.ts`).
- **Gap:** no dedicated Neon test asserting socket disconnect on moderator remove (report only; out of 029H implementation scope).

---

## 3. Test execution (strangeup_test)

| Suite | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **PASS** |
| Lint | `npm run lint` | **PASS** |
| Build | `npm run build` | **PASS** |
| Unit | `npm test` | **76 files, 285/285** |
| Groups integration | `RUN_INTEGRATION=1 npm run test:integration -- tests/integration/groups.integration.test.ts` | **20/20** |
| Jobs integration | `RUN_INTEGRATION=1 npm run test:integration -- tests/integration/store-jobs.integration.test.ts` | **8/8** |

Full Neon regression remains **MDWQ-0099** (release gate).

---

## 4. Harness fix (029H — not an application defect)

**T029F-P01** failed intermittently on shared Neon catalog: generic `q=Padel` matched unrelated published rows from other runs.

**Fix:** use per-run unique `q` tokens in `store-jobs.integration.test.ts` for filter and pagination assertions.

---

## 5. Feature flags & publish boundaries (re-checked)

| Guard | Finding |
|---|---|
| `GROUP_COMMUNITY_INTERACTIVE_ENABLED` | Default **false**; production policy fail-closed if enabled without D-06 |
| Job HTTP publish | **None** — public catalog requires `PUBLISHED` rows from seed/ops until **MDWQ-0901** |
| Employer delivery | **`NOT_CONFIGURED`** on application DTOs |

---

## 6. Open owner / release items (unchanged)

| Class | Items |
|---|---|
| **Release blocker** | **MDWQ-0910** |
| **Owner decisions** | **MDWQ-0911**, **0901**, **0905**, **0914**, **0505** |
| **Deferred product** | **MDWQ-0902**, **0903**, **029E** interactive (D-06), billing/checkout (other tasks) |
| **Optional** | **MDWQ-0912**, **0913**, **0915**, **0906** |

---

## 7. Documentation updated (029H)

- `FIGMA_GROUPS_JOBS_PARITY_TASK029H_FINAL.md` (this closure matrix)
- `TASK_029H_FINAL_VERIFICATION_REPORT.md`
- `STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, `MASTER_DEFERRED_WORK_QUEUE.md`
- `CURRENT_APIS.md` / `FLUTTER_DEVELOPER_HANDOFF.md` — closure cross-reference only (no new routes)

---

**STOP:** Task 029 closed within approved scope. Do **not** start Task 030 or implement 029E/029G without separate owner authorization.
