# Figma parity — Task 029D (Group membership & manage approvals)

**Evidence:** Manage Group Dashboard PDF (join requests); Group Details join states  
**Backend:** Task 012 membership service (029D hardening)

| Figma / flow | Backend | Status |
|---|---|---|
| Public join | `POST .../join` → ACTIVE | **IMPLEMENTED** |
| Private request | → PENDING | **IMPLEMENTED** |
| Pending list / Review | `GET .../join-requests`, `pendingRequestCount` | **IMPLEMENTED** |
| Approve / decline | Manager routes | **IMPLEMENTED** |
| Member counts | ACTIVE rows only | **IMPLEMENTED** |
| Leave / cancel request | `DELETE .../join` | **IMPLEMENTED** |
| Owner cannot leave without transfer | 403 | **IMPLEMENTED** |
| Invite friends / owner invitations | — | **DEFERRED** MDWQ-0505 |
| Live Synced / verified / growth stats | — | **DEFERRED** |
| Archived group | Join/approve/decline/remove/role/transfer blocked; manage read OK | **IMPLEMENTED** (029D) |

**MDWQ-0910**, **MDWQ-0911** remain **OPEN**.
