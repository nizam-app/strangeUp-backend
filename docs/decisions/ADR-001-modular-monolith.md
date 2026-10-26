# ADR-001 — Prefer Modular Monolith Initially

**Status:** PROPOSED — not signed off.  
**Context:** StrangeUp contains interconnected trust, groups, activities, chats, commerce and subscription entitlements; team builds a new backend with TypeScript/Express/Prisma/Postgres.  
**Decision proposed:** One deployable app; explicit domain modules with separate controllers/application/domain/repositories where meaningful; a transactional Postgres source of truth.  
**Benefits:** simple local dev, reliable transactions for cross-domain operations, fewer deployment/saga complications, lower ops cost, testability.  
**Trade-offs:** discipline needed to prevent module coupling; service extraction later may be required when real bottlenecks appear.  
**Alternative considered:** premature microservices; rejected unless scale/independent team deployment makes it necessary.  
**Approval requirement:** owner or designated engineering lead records ACCEPTED before making irreversible architecture commitments.
