# Task 029B — Groups discovery, detail & My Groups read inventory

**Date:** 2026-10-29  
**Phase:** **029B ONLY** (read-contract repair; no 029C+)  
**Prior audit:** `TASK_029A_GROUPS_JOBS_SOURCE_AUDIT_REPORT.md`

---

## 1. Source verification (re-checked)

| Check | Result |
|---|---|
| Task 029 PDF count on disk | 8 files (6 screens + 2 assets) |
| `Html → Body.pdf` vs updated Group Details | **Still duplicate** (SHA-256 `475f9255…`) |
| My Groups Figma screen | **UNVERIFIED** — **MDWQ-0910 OPEN** |
| Group Details authority | **MDWQ-0911 OPEN** (original vs updated tabs) |

No Figma match claimed for My Groups layout, tab chrome, or badge counts.

---

## 2. Verified existing behavior (unchanged policy)

| Area | Evidence | Status |
|---|---|---|
| Discovery `GET /v1/groups` | ACTIVE groups; eligible owner; filters `q`, category, city, region, privacy, tag; cursor | **Verified** (T012 + T029B-P02) |
| `PRIVATE_APPROVAL` in discovery | Listed as summaries per D-GROUPS GRP-DISC | **Verified** (T029B-P02) |
| Detail `GET /v1/groups/:id` | Summary + `canAccessContent`; archived hidden unless member | **Verified** (existing T012) |
| Content gating | Posts/members/chat 404 when `canAccessContent` false | **Verified** (T029B-P02) |
| Join / leave / approve | Unchanged Task 012 semantics | **Verified** (existing tests) |
| Task 022 gate | `hasFullAccountAccess` → 403 on discover + mine | **Verified** (T029B-P03) |
| Blocks / activity / meetup / billing | No changes; boundaries preserved | **Verified** |
| `GROUP_COMMUNITY_INTERACTIVE_ENABLED` | Remains **false** | **Preserved** |

---

## 3. Read-contract change (029B)

**Gap:** `GET /v1/me/groups` allowed only single `role` filter. **Managed** inventory (OWNER **or** MODERATOR) required two client requests or incorrect merging across pagination.

**Fix (same route, no new endpoint):**

| Query | Behavior |
|---|---|
| `view=all` | ACTIVE + PENDING memberships (explicit alias for default) |
| `view=joined` | ACTIVE + role `MEMBER` |
| `view=managed` | ACTIVE + role ∈ {`OWNER`, `MODERATOR`} |
| `view=pending` | `PENDING` only |
| `status` / `role` | Legacy filters when `view` omitted; **400** if combined with `view` |
| `q` | Case-insensitive filter on related **group name** |

**Files:** `group.validation.ts`, `group-query.ts` (`buildMyMembershipWhere`), `group.service.ts` (`listMine`).

---

## 4. Tests executed

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm test` (unit) | **283/283** pass (+4 vs 029A baseline) |
| `RUN_INTEGRATION=1 npm run test:integration -- tests/integration/groups.integration.test.ts` | **12/12** pass on `strangeup_test` |

**New cases:** T029B-P01 (inventory views + search), T029B-P02 (private discover + content gate), T029B-P03 (non-activated 403).

---

## 5. Documentation updates

- `docs/api/CURRENT_APIS.md` — `/v1/me/groups` query params  
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` — §15 My Groups inventory + UNVERIFIED Figma note  
- `openapi/groups.yaml` — GET `/v1/me/groups` parameters  
- `docs/product/FIGMA_GROUPS_JOBS_PARITY_TASK029A.md` — 029B inventory row  
- `docs/plans/MASTER_DEFERRED_WORK_QUEUE.md` — MDWQ-0912 note  
- `docs/plans/STATUS.md` — 029B entry  

---

## 6. Still open (not 029B scope)

| ID | Item |
|---|---|
| **MDWQ-0910** | Re-export true My Groups PDF |
| **MDWQ-0911** | Group Details design authority |
| **MDWQ-0912** | Tab **badge counts** (no server aggregate; client-side only) |
| **MDWQ-0913** | Group Details tab badge counts |
| **MDWQ-0914** | Secret/unlisted private groups |
| **MDWQ-0505** | Owner → member invitations |
| Jobs, 029C+ create/manage, interactive media | Not started |

---

## 7. STOP

**029C not started.** Owner may review 029B before authorizing group create/manage parity work.
