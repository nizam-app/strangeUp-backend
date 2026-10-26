# Conceptual Data Model — NO Prisma Schema Approved Yet

**This is not executable DDL.** Candidate entities are grouped by domain. Confirm scope, lifecycle and privacy before writing migrations.

| Domain | Candidate tables / aggregates | Key constraints and safeguards (PROPOSED) |
|---|---|---|
| Auth | `User`, `PasswordCredential`, `ExternalIdentity`, `Session`, `AuthChallenge` | case-normalized unique email when present, hashed secrets, expiring/revocable sessions, provider+subject unique |
| Trust | `VerificationSession`, `VerificationDecision`, `ConsentRecord` | never store raw ID/selfie by default; verified status changes audited; provider webhook idempotency |
| Profiles | `Profile`, `Interest`, `ProfileInterest`, `UserMedia`, `PrivacySetting` | public/private field separation; unique username policy, media ownership |
| Social | `Follow`, `Wave`, `UserBlock` | unique actor/target constraints; no self-follow/block; actor must have permission |
| Activities | `Activity`, `ActivityJoinRequest`, `ActivityParticipant`, `WaitlistEntry`, `ActivityTransition` | unique participant per activity; seat count atomic; host+ownership authorization; chronological audit |
| Groups | `Group`, `GroupMember`, `GroupJoinRequest`, `GroupInvite` | group+user uniqueness; scoped roles; preserve owner invariant |
| Content | `Post`, `Comment`, `Reaction`, `Story`, `StoryMedia` | user ownership and visibility; unique user+target+reaction type if appropriate; Story expiry/retention |
| Messaging | `Conversation`, `ConversationParticipant`, `Message`, `MessageReceipt` | participant ACL; stable IDs, idempotency `conversation+sender+clientMessageId`; no global chat exposure |
| Meetups | `MeetupInvite`, `MeetupRescheduleProposal`, `MeetupAudit` | sender/recipient ACL; accepted time needs mutual agreement; canonical TZ |
| Membership | `MembershipPlan`, `StoreProductMapping`, `PurchaseEvent`, `Subscription`, `Entitlement` | unique provider event IDs, verified ownership, expiry/revocation, no client-only grants |
| Physical store | `Product`, `SKU`, `StockLedger`, `Cart`, `CartItem`, `Order`, `OrderItem`, `PaymentAttempt`, `Fulfillment` | SKU inventory bounds, immutable money snapshot, idempotency keys, status transitions |
| Jobs | `Job`, `SavedJob`, `JobApplication` | unique actor+job saves, publisher ACL, native-vs-external decision |
| Notifications | `Notification`, `DeliveryAttempt`, `DeviceToken`, `NotificationPreference` | recipient-scoped reads, unique event+recipient+channel keys |
| Moderation | `Report`, `ModerationCase`, `ModerationAction`, `AuditLog` | immutable/append-only audit where required, safe access to sensitive reports |

## Shared DB conventions (PROPOSED)

- Primary keys: UUID or another compatible globally unique key; choose once for cross-module consistency.
- Use PostgreSQL-native constraints, unique indexes, check constraints and FK delete behavior grounded in lifecycle policies.
- `createdAt`, `updatedAt` standardized; UTC instants for event timestamps; preserve user-selected IANA zone for scheduled local time.
- Monetary amounts: integer minor units (`amountMinor`) and ISO currency code, or documented arbitrary precision decimal with explicit rounding; never JS float for payment totals.
- No surprise cascading deletion of payment records, identity verification audit, legal disputes or personal message history; retention policy and data minimization must be approved.
- Avoid generic polymorphic tables unless ownership, referential integrity and performance consequences are understood.
- Composite unique constraint prevents duplicate active registrations; if multiple historical states are stored, adopt unique current row plus append-only event ledger or appropriate partial index.

## Nonnegotiable race/consistency scenarios

1. 2 joins compete for final 1 activity seat: at most one becomes CONFIRMED.
2. 2 approval operations for same request: at most one succeeds; retry is idempotent.
3. Message retried with same client id: one persisted message.
4. Duplicate billing provider event: one purchase ledger event; entitlement projection converges.
5. Concurrent product orders: prevent stock underflow; reconcile payment/order state.
6. Block/suspension mid-conversation: every new send/read path re-authorizes.

## Creation order after product approval

Identity/user core -> privacy and moderation invariants -> activity/group relationships -> messaging/meetups -> premium and commerce. Explicitly do not populate all tables in initial foundation milestone.
