# StrangeUp — Task 002B.2A: Auth Stabilization, Test Isolation & Git Checkpoint

**Type:** Verification and targeted hardening; not a new feature task.
**Precondition:** Task 002B.2 reported complete (24 unit tests; 20 integration tests passed, 1 skipped).
**Authority:** Current approved StrangeUp product decisions and existing repository files.
**Production changes:** Prohibited. **Figma changes:** Prohibited. **Git push:** Prohibited. **Git commit:** Do not commit unless the product owner explicitly authorizes local commits.

## Objective
Close outstanding development-environment correctness risks before starting Task 002B.3: restore a reproducible isolated integration database, audit current password hash cost, rerun a representative full quality gate, and prepare a reviewable Git checkpoint.

## 1 — Inspect before changing
- Read `AGENTS.md`, `.cursor/rules/`, ADR-004, `docs/plans/STATUS.md`, `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, `docs/testing/IDENTITY_ACCEPTANCE_MATRIX.md`, and the real auth code and tests.
- Capture `git status --short`, `git diff --check`, `npx prisma dev ls`, versions, and relevant redacted environment setup. Never print complete DATABASE_URLs, secrets, reset tokens, personal data, or password hashes.
- Preserve unrelated user files and current repository layout. Do not rewrite applied migrations.

## 2 — Repair and prove test database isolation
- Check whether named instance `strangeup_test` exists and start it using the supported Prisma CLI for the installed Prisma version (for example `npx prisma dev start strangeup_test`), or create it only if absent. Do not wipe/recreate existing instances without approval.
- Update local `.env` only when needed: `DATABASE_URL` must target the development DB and `INTEGRATION_DATABASE_URL` must target a physically distinct testing target, preferably the dedicated named test instance; use TCP `postgres://` URLs appropriate for `@prisma/adapter-pg`.
- Inspect `prisma7.config.ts`, test setup and scripts to establish how migrations are applied specifically to the test target; explicitly verify the target before any migration or test data cleanup. Never run reset/drop/truncate on a target that might be development, hosted or production.
- Validate **actual targets** (host, port, database, if queryable) and test guard behavior. Separate database names on the same server can be isolated, but do not assume isolation from connection-string differences alone.
- Run real integration tests using the configured test URL; confirm they are not skipped. In PowerShell, set `RUN_INTEGRATION=1` in the current process only and remove it afterward.
- Prove a deliberately incorrect same-database configuration fails closed **without running destructive tests**.
- Record a restart/recovery workflow in README if not already present.

## 3 — Password hashing configuration audit
- Review `src/modules/auth/crypto.ts` for the actual `scrypt` implementation, its versioned/storage format, per-hash N/r/p verification, salt generation, async behavior, timing-safe comparison, and Node `maxmem` setting.
- Current report indicates `N=16384`, `r=8`, `p=1`. This is below the currently listed OWASP scrypt example configurations (e.g. N=2^14/r=8/p=5, or N=2^17/r=8/p=1). Verify the latest official OWASP guidance before choosing a new cost.
- Benchmark cost options in a **non-production** environment with realistic concurrency/memory constraints. Higher N values may require an explicitly sufficient `maxmem` in Node.js.
- Do not invalidate existing hashes. If upgrading, keep old hashes verifiable through stored parameters and write newly generated hashes with the new parameters; consider rehash-on-login after successful old-hash verification and test the transition. Avoid blanket password resets or destructive migration.
- Add correctness tests for old-hash verification, new-hash generation/verification, malformed stored hash rejection and login/reset flows after any change.
- If benchmark or source evidence is insufficient, document proposed changes and blocker without making a speculative crypto edit.

## 4 — Security regression and release blocker review
- Verify reset and email-verification request throttles including 429 behavior and duplicate requests where practical; report any untested protections explicitly.
- Confirm password reset invalidates all sessions, consumes token once and never returns verification secrets via HTTP.
- Review JWT validation (`alg`, optional `iss`/`aud`) and propose a safe compatibility plan; do not break current tokens without deliberate policy approval.
- Reiterate staging/production gates: counsel-approved consent versions, production email provider, distributed rate limits/abuse controls, and native PostgreSQL concurrency coverage.
- Do not introduce third-party KYC or new endpoints in this task.

## 5 — Run the actual validation gate
Execute the scripts that exist in this repository (correct environment and secrets required) and record exact outcomes:
- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:integration` **with** `RUN_INTEGRATION=1` and the isolated test database
- `git diff --check`
Report counts, skips, database instance and any failures. Never report skipped integration tests as passing integration coverage.

## 6 — Prepare an auditable Git checkpoint (no commit unless approved)
- Audit ignored/tracked files: `.env`, credentials, generated clients, `node_modules`, `dist` and other local artifacts must not be staged.
- Since multiple prior tasks modify the same files, avoid artificially splitting history into commits whose snapshots would not build/test; propose one verified cohesive local commit if necessary, or a small series of coherent commits if independently stageable and valid.
- Provide proposed commit message(s), included file groups, untracked files, and exact risks. Do not rewrite `abdcfa6`, force push, push, or create remotes.
- If owner explicitly authorizes local commit(s), only commit the reviewed files, confirm clean status (or explain deliberate uncommitted files), and report resulting commit hash(es).

## 7 — Documentation consistency
For any **behavior or API change**, update:
- `docs/api/CURRENT_APIS.md`
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`
- `openapi/identity.yaml` (as applicable)
- `docs/plans/STATUS.md`
- Relevant acceptance matrix and README
Distinguish LIVE, DEV_ONLY, PLANNED and release-blocked functionality.

## Definition of done
1. Dedicated test database is reachable and correctly isolated from development and production targets; integration runs against that configured target.
2. Full verification gate passes or every failure is precisely documented.
3. Password hashing cost is compared against current OWASP guidance; safe upgrade applied and tested if justified, otherwise risk and precise next step documented.
4. Secrets excluded; Git staging/commit plan reviewed; no unauthorized commit or push.
5. Flutter/API documentation reflects any actual behavior change.
6. A concise completion report names changes, files, test counts, DB targets (redacted), unresolved issues, and one recommendation for the next feature milestone.

## Out of scope
New KYC sessions, verification claims, OAuth, social features, marketplace, profile expansion, payments, deployments, production email integration, and broad refactoring.
