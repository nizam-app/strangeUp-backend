# CURSOR TASK 001 — StrangeUp Backend Foundation (Development Only)

## Task

Initialize or complete a safe, production-quality *foundation* for `strangeup-backend`, **without implementing any product business features or business Prisma models**.

## Repository context

- Source of truth: `AGENTS.md`, `.cursor/rules/engineering.mdc`, `docs/architecture/SYSTEM.md`, `docs/product/OPEN_QUESTIONS.md`, `docs/plans/STATUS.md`.
- Confirmed stack: Node.js + TypeScript + Express + Prisma + PostgreSQL; Flutter consumer; Git and Cursor.
- Architecture proposal: modular monolith. Backend hosting undecided.
- Documentation is currently DRAFT. User wants safe expandable architecture but no invented business behavior.
- **You are operating on the developer's local repository; ChatGPT has not inspected it. Always inspect actual contents first.**

## Inspection first — report before changes

1. Print current working directory and Git status; inspect existing directory structure, package.json, locks, tsconfig, Prisma config/schema, `.env.example`, `.gitignore` and README if present.
2. Detect Node version/package manager actually installed. Use a current supported LTS Node version and compatible maintained dependency releases; verify versions/compatibility from tools/docs, do not blindly copy unverified latest versions. Respect existing lockfile.
3. Check if there is existing code. If nonempty, prefer minimally invasive additive changes and state constraints; never overwrite without explanation.
4. Examine docs and open questions; don't treat any proposed state machine as approved product behavior.

## Scope — create only what is needed

- Initialize TypeScript Node/Express application with `src/app.ts` (app setup) and `src/server.ts` (process bootstrap), config/schema validation and dev scripts.
- Folders may include `src/config`, `src/common/{errors,middleware,types,utils}`, `src/infrastructure/database`, `src/modules` (empty is fine), `prisma`, `tests`, `scripts` only when necessary. Favor small, understandable structure.
- Establish Zod or equivalent validation with strict unknown-field behavior; use a typed env/config layer (dev/test/production separation). Avoid failing test commands solely because production-only variables aren't provided.
- Set up Prisma with PostgreSQL, using versions compatible with the current Prisma major release (including correct client adapter/generator conventions). Use one shared database access abstraction and proper disconnect on shutdown.
- **No business tables:** do not create User, Profile, Message, Order, Subscription, KYC or any other domain models in Task 001. If Prisma setup requires a baseline migration, explain and use the smallest empty/baseline migration safely. Prefer to postpone migrations until first approved models.
- Provide Docker Compose or equivalent reproducible local PostgreSQL **only if Docker is available/desired**. Use no production credentials. Keep dev and test DB isolated.
- Add basic middleware: JSON parsing with bounded payload size, CORS via explicit env origin(s), helmet where appropriate, request ID propagation, structured redacted logging, centralized Not Found and error handling (no stack trace disclosure in production). Avoid enabling permissive wildcard CORS with credentials.
- Create `GET /health/live` and `GET /health/ready`. Liveness depends only on process; readiness performs a safe bounded DB connectivity check. If DB is down, readiness must return non-2xx with sanitized error; don't expose connection secrets.
- Add ESLint, Prettier, TypeScript typecheck, tests (Vitest or suitable maintained tool), and npm scripts (`dev`, `build`, `start`, `typecheck`, `lint`, `format:check`, `test`, `test:integration`, `prisma:generate`, etc. as appropriate).
- Add `.env.example` with placeholders, `.gitignore` protecting `.env*` except `.env.example`, documentation for exact local commands and environmental requirements.
- Add minimal CI validation workflow if repo uses GitHub Actions; avoid any deployment workflow until infra is approved.
- Document a standard versioned API envelope/error code convention, but do NOT build product APIs.

## Security and quality boundaries

- Do NOT touch Figma; do NOT run migrations against staging/production; do NOT select or buy cloud/identity/payment providers.
- No secret values, tokens, real KYC docs or payment card data in Git or logs.
- No business hardcoding: trial prices, subscription plans, activity limits, age rules, profiles, marketplace orders and chat permissions are unresolved.
- No fake 'tests pass' claims. Any command that can't run must be marked NOT RUN with blocker.
- No broad repo refactor or unnecessary framework/services.

## Acceptance tests

1. `npm run typecheck` succeeds (or package-manager equivalent).
2. `npm run lint` and `npm run format:check` succeed.
3. `npm test` unit health/error behavior and request-ID tests succeed.
4. `npm run build` emits compiled runtime-compatible output and `npm start` boots with valid local config.
5. `GET /health/live` returns 200, stable body and request ID.
6. `GET /health/ready` returns 200 **only with working test/dev DB**; returns 503 or other appropriate unavailable response when DB offline.
7. Invalid JSON, unknown routes and unexpected errors use sanitized stable contracts; sensitive values not logged.
8. Test connection uses isolated DB. If Docker isn't available, give exact alternatives and do not fake DB test success.
9. Inspect Git diff and verify no secret, unrelated file overwrite or domain business table was introduced.
10. README and `docs/plans/STATUS.md` reflect ACTUALLY COMPLETED vs TESTED vs PENDING work.

## Completion report — mandatory

- Created/edited files and why; package versions and manager; database/config state.
- Commands actually run with pass/fail/not-run and relevant output excerpts.
- Security/architecture decisions and any deviations.
- Known gaps/risks, especially any db test blocked by environment.
- Suggested next task (foundation polish only if needed; otherwise propose auth core *after* product rules sign-off).

## Cursor behavior

Implement in a bounded batch, validating incrementally. If prerequisites are absent, make the safest possible non-destructive progress, document blockers and report instead of guessing product rules. No confirmation needed for reversible local boilerplate changes; seek explicit approval before destructive or production-impacting steps.
