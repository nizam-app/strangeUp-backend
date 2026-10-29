# Figma parity — Task 029F (Screen 23 — Jobs discovery & saved)

**Evidence:** `design-reference/task029-groups-jobs/Screen 23_ Jobs.pdf`  
**Backend:** Task 014 jobs module + 029F query fix  
**Baseline matrix:** `FIGMA_GROUPS_JOBS_PARITY_TASK029A.md` §F (updated status below)

| Control / navigation | Backend | Status (post-029F) |
|---|---|---|
| Explore listings | `GET /v1/jobs` | **IMPLEMENTED** |
| Search while paginating | `q` + `cursor` together | **IMPLEMENTED** (029F — AND composition) |
| Work type filters | `employmentType`, `workMode` | **IMPLEMENTED** |
| City / region (not radius) | `city`, `region` | **IMPLEMENTED** |
| Sort “nearest” / miles | — | **DEFERRED** — **MDWQ-0903**, D-04 |
| Category (e.g. Sports & Fitness) | — | **MISSING** — no schema |
| “28 nearby” / featured / Official Partner | — | **DEFERRED** — do not fabricate |
| Salary on card | `pay` + disclaimer | **IMPLEMENTED** (self-reported) |
| Applicant count | — | **DEFERRED** |
| Saved tab | `GET /v1/me/saved-jobs` | **IMPLEMENTED** |
| Save / unsave | `PUT/DELETE /v1/me/saved-jobs/{jobId}` | **IMPLEMENTED** (idempotent; drops closed jobs from list) |
| Saved tab badge count | — | **DEFERRED** — **MDWQ-0906** |
| Applications tab | `GET /v1/me/job-applications` | **IMPLEMENTED** (read-only; 029G reserved) |
| Applications tab badge count | — | **DEFERRED** — **MDWQ-0906** |
| Apply Now | `POST /v1/jobs/{jobId}/applications` | **IMPLEMENTED** (in-platform; consent required) |
| Application sent / employer status | `employerDelivery.status=NOT_CONFIGURED` | **DEFERRED** — **MDWQ-0902** |
| Post job to explore | Draft author APIs only | **PARTIAL** — **MDWQ-0901** |
| Task 022 activation | Home-access gate on `/v1/jobs` | **IMPLEMENTED** |

**029E:** Group Stories/polls/photo — **SKIPPED/DEFERRED** (not in 029F scope).

**OPEN queue (unchanged):** **MDWQ-0910**, **MDWQ-0911**.

**Closure:** Task 029H final matrix — `FIGMA_GROUPS_JOBS_PARITY_TASK029H_FINAL.md`. **029G SKIPPED** for Task 029 closure; **MDWQ-0901**, **0902**, **0905** remain open.
