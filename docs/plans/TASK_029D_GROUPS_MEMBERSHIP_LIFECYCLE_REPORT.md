# Task 029D — Group membership lifecycle, authorization & concurrency

**Date:** 2026-10-29  
**Scope:** Audit + targeted fixes; **029E not started**  
**Prior:** 029A–C reports; Task 012/022/023; 029B `view` inventory; 029C archived settings guard

---

## 1. Audit findings (source-backed)

### Lifecycle (verified)

| Step | Route / policy | Evidence |
|---|---|---|
| Public join → ACTIVE | `POST /v1/groups/:id/join`, `decideGroupJoin` | T012-P02, T029D-P04 |
| Private join → PENDING | `PRIVATE_APPROVAL` | T012-P02 |
| Approve / decline | Manager + `FOR UPDATE` on approve | T012-P02, T029C-P02, T029D-P01 |
| Leave / cancel pending | `DELETE .../join` | T012-P02 |
| REMOVED / DECLINED reapply | → PENDING (even PUBLIC) | T029D-P03, `group-policy` |
| Owner leave blocked | Until transfer | T012-P02 |
| Role change | Owner-only | T029D-P02 |
| Transfer ownership | Owner-only; updates `ownerId` | Task 012 |
| Capacity races | Join + approve concurrency | T012-C01, T029C-P02, T029D-P04 |

### Authorization (verified)

| Risk | Mitigation | Test |
|---|---|---|
| Stranger approve | `requireManager` → 404 | T012-P02 |
| Mod approve other group | `target.groupId` check → 404 | T029D-P02 |
| Mod change owner role | Owner-only → 404 | T029D-P02 |
| Task 022 gate | `assertGroupAccess` | T029B-P03 |
| Cross-group membership IDs | UUID scoped to group | T029D-P02 |

### Post-membership access (verified)

| After | Posts / chat | Test |
|---|---|---|
| REMOVED | 404 (not active member) | T029D-P03 |
| LEFT | Same (existing behavior) | — |
| Block | Content hidden; membership retained | T012-P07 |

### Domain separation (unchanged)

- **CommunityMembership** ≠ ActivityParticipation (027E) ≠ MeetupInvite (028) ≠ paid Club (D-08).

### Archived groups (029C + 029D)

| Action | Before 029D | After 029D |
|---|---|---|
| Join / approve | 403 via `decideGroupJoin` / `decideApproveRequest` | Unchanged |
| PATCH / cover | 403 (029C) | Unchanged |
| Decline / remove / role / transfer | **Allowed** | **403** archived |
| Re-archive | 200 noop | **403** |
| `GET .../manage` | 200 read | **200** (preserved) |
| Owner leave | 403 (still owner) | Unchanged |
| Member leave (ACTIVE) | Allowed | Unchanged |

---

## 2. Defects fixed

1. **Archived bypass:** `decline`, `remove`, `changeRole`, `transferOwnership`, and repeat `archive` could mutate membership or ownership while group `ARCHIVED`.
   - **Fix:** `assertGroupActiveForMutation` on those paths; `decline` also uses row lock `FOR UPDATE`.

2. **Socket lifecycle on remove:** `onUserLeftGroup` ran only for voluntary leave, not moderator removal.
   - **Fix:** invoke `onUserLeftGroup(removedUserId, groupId)` after successful `remove` (Task 023 alignment).

---

## 3. Files changed

| File | Change |
|---|---|
| `src/modules/groups/group-membership.service.ts` | Archived guards; decline lock; remove socket hook |
| `tests/integration/groups.integration.test.ts` | T029D-P01–P04 |

---

## 4. Tests

| Command | Result |
|---|---|
| typecheck / lint / build | Pass |
| Unit | **283/283** |
| `groups.integration.test.ts` (`strangeup_test`) | **20/20** |

---

## 5. Outstanding risks (accepted / deferred)

| Item | Class | Notes |
|---|---|---|
| Block does not revoke membership | Policy (GRP-BLOCK) | By design; content redaction only |
| Manager can approve blocked applicant | Policy | Documented in D-GROUPS |
| Owner invitations | MDWQ-0505 | Not implemented |
| Secret / unlisted groups | MDWQ-0914 | Not implemented |
| My Groups Figma | MDWQ-0910 | OPEN |
| Group Details authority | MDWQ-0911 | OPEN |
| Full Neon regression | MDWQ-0099 | Release gate |

---

## 6. STOP

**029E not started.**
