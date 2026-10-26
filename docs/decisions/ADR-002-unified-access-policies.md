# ADR-002 — Shared Server-Side Trust/Privacy Policy Boundary

**Status:** PROPOSED.  
**Problem:** User blocking, verification, subscription, group membership and venue/privacy controls affect many features. Scattered local checks create bypasses.  
**Proposal:** central policy interfaces for actor/target/resource; each module calls them before reads/writes and socket subscription. Policies are testable and fail closed when ambiguous.  
**Consequence:** risk of policy-module becoming excessively coupled; keep small function contracts and dependency direction explicit.  
**Open:** precise contact permissions, verified access, visibility grades, block effects, retention policy, audit requirements.
