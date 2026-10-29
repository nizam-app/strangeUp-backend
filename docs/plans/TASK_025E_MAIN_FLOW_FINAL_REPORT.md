# Task 025E — Main Flow final engineering report

**Date:** 2026-10-28  
**Phase:** 025E **COMPLETE** — Task 025 staged plan **COMPLETE** (no further Main Flow phases in plan)

## Summary

Consolidated Figma Main Flow parity across **Home, Discover, Activities, Marketplace, Profile/Settings**; ran bounded cross-tab Neon E2E; closed **legal-name lock bypass** when KYC enforcement lapses.

## Security fix (025E)

**Issue:** `legalNameLocked` followed `hasTrustedKycForEnforcement` only. Users with **expired**, **revoked**, or **cleared** provider KYC fields could set `legalNameLocked: false` while still having been staff-approved on a prior trusted session.

**Fix:** Sticky lock via `isLegalNameLockedFromSnapshot` (`identityVerificationApprovedAt`, `identityVerificationRevokedAt`) plus `resolveLegalNameLocked()` querying `IdentityAdminReviewDecision` for any **`APPROVED`** staff decision. Used on `GET/PATCH /v1/me/profile` and settings overview. No new self-service rename workflow.

## Parity deliverable

- **Master matrix:** `docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025E.md`
- Phase detail retained: `FIGMA_MAIN_FLOW_PARITY_TASK025{A,B,C,D}.md`

## Files changed (025E)

| Path | Change |
|---|---|
| `src/modules/me/profile-identity-policy.ts` | Sticky lock + audit-aware `resolveLegalNameLocked` |
| `src/modules/me/me.service.ts` | Async lock resolution on profile read/patch |
| `src/modules/settings/settings-overview.service.ts` | Async lock on overview |
| `tests/profile-identity-policy.test.ts` | Expiry/revoke sticky unit cases |
| `tests/integration/main-flow-025e.integration.test.ts` | T025E-E01–E03, T025E-S01–S02 |
| `docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025E.md` | Consolidated matrix |
| API/handoff/OpenAPI/status/task plan updates | This commit set |

## Tests (2026-10-28)

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run test` | **240/240** pass |
| Focused Neon E2E | **14/14** pass on **`strangeup_test`** (`main-flow-025e`, `access-enforcement`, `main-flow-025d`) |

```bash
RUN_INTEGRATION=1 npm run test:integration -- \
  tests/integration/main-flow-025e.integration.test.ts \
  tests/integration/access-enforcement.integration.test.ts \
  tests/integration/main-flow-025d.integration.test.ts
```

## Remaining gaps (not Task 025 scope)

- Precise geo (D-04), stories (D-06), checkout/commerce (MKT-03), ACT-APPROVAL, HOME-08, COPY-TRUST marketing metrics, destructive delete (SET-03), full Neon regression at release gate.

## Release blockers

See **Release blockers** table in `FIGMA_MAIN_FLOW_PARITY_TASK025E.md`. Marketplace **checkout UNAVAILABLE** unchanged.
