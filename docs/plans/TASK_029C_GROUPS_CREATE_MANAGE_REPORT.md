# Task 029C — Groups create & manage dashboard

**Date:** 2026-10-29  
**Scope:** Create/edit/manage audit + one integrity fix; **no 029D**

---

## 1. Audit summary

Existing Task **012** APIs cover Figma Create/Manage **behavior** (not marketing chrome). No new routes, categories, privacy rules, invitations, or statistics.

| Area | Result |
|---|---|
| Create + OWNER membership | Verified (T012-P01, T029C-P01) |
| Validation vs Figma fields | Matched within catalog/policy bounds |
| Manage dashboard counts | `memberCount`, `pendingRequestCount`, `visiblePostCount` truthful |
| Moderator vs owner edits | Mod core OK; privacy/capacity owner-only **403** |
| Join / approve / capacity | Row locks; concurrent join/approve tests pass |
| Task 022 gate | Non-activated **403** on create path (via group access) |
| Private cover | Non-member **404**; member after ACTIVE |
| Blocks | Unchanged (T012-P07) |
| Activity / meetup / Club | Unchanged separation (T012-P08) |
| `GROUP_COMMUNITY_INTERACTIVE_ENABLED` | **false** |

---

## 2. Defect fixed

**Archived groups:** `PATCH` and cover upload/delete were allowed while posts/chat already require `ACTIVE` status.

- Added `assertGroupActiveForMutation` in `group-access.ts`
- Applied in `GroupService.patch`, `uploadCover`, `deleteCover`
- **403** `"This group is archived"`

---

## 3. Files touched

| File | Change |
|---|---|
| `src/modules/groups/group-access.ts` | `assertGroupActiveForMutation` |
| `src/modules/groups/group.service.ts` | Guard mutations on ARCHIVED |
| `tests/integration/groups.integration.test.ts` | T029C-P01–P04 |
| Docs / OpenAPI / handoff | See below |

---

## 4. Tests

| Command | Result |
|---|---|
| typecheck / lint / build | Pass |
| Unit | **283/283** |
| `groups.integration.test.ts` on `strangeup_test` | **16/16** (incl. T029C-P01–P04) |

---

## 5. Unsupported / deferred (tracked, not built)

- Figma **10MB** cover → server **5MB**
- Figma category labels → **5 managed slugs** only
- Cover on same wizard step as create → **two-step** API
- Manage dashboard **growth**, **Live Synced**, **verified**, **recent activity feed** (MDWQ-0915, MDWQ-0605)
- Owner invitations (MDWQ-0505)
- Secret/unlisted groups (MDWQ-0914)

**MDWQ-0910**, **MDWQ-0911** remain **OPEN**.

---

## 6. STOP

**029D** (membership policy extensions) **not started**.
