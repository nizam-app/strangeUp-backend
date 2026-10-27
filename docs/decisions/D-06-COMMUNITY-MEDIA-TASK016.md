# D-06 — Community stories, photo posts & polls (Task 016)

**Status:** **PROVISIONAL** — implementation exists behind `GROUP_COMMUNITY_INTERACTIVE_ENABLED` (default **false**). **Not owner-approved for production activation.** Home `stories` remains **`DEFERRED`** until explicit owner sign-off.

| ID | Topic | Proposed conservative behavior | Status now |
|---|---|---|---|
| D06-01 | Story publisher / audience | ACTIVE members create; ACTIVE members view; no public discovery | PROVISIONAL |
| D06-02 | Expiry & cleanup | 24h from server `createdAt`; read-time deny when `expiresAt <= now`; filesystem purge via manual `scripts/cleanup-group-expired-content.ts` only | PROVISIONAL |
| D06-03 | Media & moderation | JPEG/PNG/WebP ≤5 MiB, Sharp re-encode; author + owner/mod removal; operator moderation workflows not built | PROVISIONAL |
| D06-04 | Personal vs group stories | Group stories only; personal “Your Story” deferred | PROVISIONAL |
| D06-05 | Photo posts | One photo per post; member-only byte access; no anonymous CDN | PROVISIONAL |
| D06-06 | Polls | Single-choice, 2–6 options, one vote/member, server counts, no voter list to members | PROVISIONAL |
| D06-07 | Reports | Bounded intake + owner/mod OPEN queue; no platform SLA or auto-suspension | PROVISIONAL |

**Activation gate:** Set `GROUP_COMMUNITY_INTERACTIVE_ENABLED=true` only after owner approves rows above. Flutter must treat default-off responses (`403 FEATURE_DISABLED`) as disabled UI, not errors.
