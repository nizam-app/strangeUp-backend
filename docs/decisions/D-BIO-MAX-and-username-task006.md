# D-BIO-MAX & profile username — Task 006

**Status:** APPROVED (2026-10-27)  
**Canonical detail:** `docs/product/PROFILE_OWNER_DECISIONS_TASK006.md`

| ID | Summary |
|---|---|
| **D-BIO-MAX** | Bio **300** characters max on `PATCH`; legacy stored values **>300** preserved on `GET` and partial updates until user edits bio |
| **D-USERNAME (Task 006)** | Optional `username` on self profile; 3–30 `[a-z0-9_]`; DB case-insensitive uniqueness; no public lookup or trust elevation |
