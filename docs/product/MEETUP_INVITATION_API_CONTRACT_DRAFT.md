# Personal Meetup Invitation — API & DTO contract (DRAFT)

**Status:** **Schema + policy IMPLEMENTED (028C)**; **HTTP NOT IMPLEMENTED (028D pending)**  
**Date:** 2026-10-29 (updated post-028C)  
**Task:** 028B design / 028C foundation  
**Policy:** `docs/decisions/D-28-personal-meetup-invitation-2026-10-29.md`  
**Not in:** `CURRENT_APIS.md`, OpenAPI, or runtime routers.

---

## 1. Router placement

- Base path: **`/v1/meetup-invites`**
- Middleware: `authenticate` + **`requireHomeAccess`** (same as `/v1/discover`, `/v1/users`) — mount via `mountMainApp` in `app.ts` when implemented.
- Module suggestion: `src/modules/meetup-invites/` (name TBD at implementation).

---

## 2. Prisma model (implemented 028C)

```prisma
enum PersonalMeetupInviteStatus {
  PENDING
  ACCEPTED
  DECLINED
  WITHDRAWN
  EXPIRED
}

enum PersonalMeetupInviteType {
  COFFEE
  ACTIVITY
  SPORTS
  OTHER
}

model PersonalMeetupInvitation {
  id                 String                       @id @default(uuid()) @db.Uuid
  senderId           String                       @db.Uuid
  sender             User                         @relation("MeetupInviteSender", fields: [senderId], references: [id], onDelete: Restrict)
  recipientId        String                       @db.Uuid
  recipient          User                         @relation("MeetupInviteRecipient", fields: [recipientId], references: [id], onDelete: Restrict)

  status             PersonalMeetupInviteStatus
  meetupType         PersonalMeetupInviteType
  title              String                       // bounded, e.g. max 80
  scheduledStartsAt  DateTime                     // UTC
  scheduleTimeZone   String                       // IANA

  venueCity          String
  venueRegion        String
  venueLabel         String?                      // public-facing name, optional
  venueAddressLine   String?                      // precise; redacted in DTO pre-accept
  venuePlaceNotes    String?                      // optional bounded; redacted pre-accept

  note               String?                      // max 200

  createIdempotencyKey String?                    @unique // scoped to sender at application layer

  createdAt          DateTime                     @default(now())
  updatedAt          DateTime                     @updatedAt
  acceptedAt         DateTime?
  declinedAt         DateTime?
  withdrawnAt        DateTime?
  expiredAt          DateTime?

  @@index([recipientId, status, createdAt, id])
  @@index([senderId, status, createdAt, id])
  @@index([scheduledStartsAt])
  // Partial unique (PostgreSQL): one PENDING per pair — express in migration SQL
}
```

**Relationships:** two optional `User` relations; **no** FK to `Activity`, `DirectConversation`, or `CommunityGroup`.

**Deletion / history:**

- **No** hard delete on accept/decline (audit trail).
- User account deletion: **NEEDS DECISION** — propose `onDelete: Restrict` until anonymization policy exists, or cascade anonymize invite rows.

**Indexes rationale:**

- Inbox queries: `(recipientId, status, createdAt desc)`
- Outgoing: `(senderId, status, createdAt desc)`
- Expiry sweeps: `scheduledStartsAt` where `status = PENDING`

---

## 3. REST endpoints (candidate)

| Method | Path | Actor | Purpose |
|---|---|---|---|
| `POST` | `/v1/meetup-invites` | Sender | Create invitation → `PENDING` |
| `GET` | `/v1/meetup-invites` | Sender or recipient | Inbox / outbox list |
| `GET` | `/v1/meetup-invites/:inviteId` | Sender or recipient | Detail |
| `POST` | `/v1/meetup-invites/:inviteId/accept` | Recipient | → `ACCEPTED` |
| `POST` | `/v1/meetup-invites/:inviteId/decline` | Recipient | → `DECLINED` |
| `POST` | `/v1/meetup-invites/:inviteId/withdraw` | Sender | → `WITHDRAWN` |

**Not in MVP:** `PATCH`, `propose-time`, `reschedule`, admin routes.

### 3.1 `POST /v1/meetup-invites`

**Headers:** optional `Idempotency-Key` (sender-scoped; same key + same body → same invite; conflicting body → **409**).

**Body (proposed):**

```json
{
  "recipientUserId": "uuid",
  "meetupType": "COFFEE",
  "title": "Coffee Meetup",
  "scheduledStartsAt": "2026-11-15T22:00:00.000Z",
  "scheduleTimeZone": "America/New_York",
  "venue": {
    "city": "Miami Beach",
    "region": "FL",
    "label": "Panther Coffee - Miami Beach",
    "addressLine": "1875 Purdy Ave, Miami Beach, FL 33139",
    "placeNotes": "Sunset Harbour entrance"
  },
  "note": "Looking forward to meeting you!"
}
```

**Validation (proposed):**

- `recipientUserId` ≠ authenticated user.
- `title`: 1–80 chars (NEEDS DECISION on exact max).
- `scheduledStartsAt` future per §7 D-28.
- `scheduleTimeZone`: validate with `Intl` or allow-list pattern.
- `venue.city` / `venue.region`: required, bounded length.
- `venue.addressLine` / `placeNotes`: optional, bounded (e.g. 200).
- `note`: optional, max 200.

**Responses:**

- **201** `{ data: MeetupInviteDetailDto }` on create.
- **200** same if idempotent replay.
- **400** `VALIDATION_ERROR`
- **403** `AUTH_FORBIDDEN` (activation/KYC)
- **404** `NOT_FOUND` (recipient not eligible — generic message)
- **409** `CONFLICT` (pending pair exists, idempotency mismatch, declined cooldown if enabled)
- **429** rate limit

### 3.2 `GET /v1/meetup-invites`

**Query:**

| Param | Values | Default |
|---|---|---|
| `box` | `incoming` \| `outgoing` | `incoming` |
| `status` | `pending` \| `accepted` \| `declined` \| `withdrawn` \| `expired` \| `all` | `pending` (match Figma tab default) |
| `limit` | 1–50 | 20 |
| `cursor` | opaque | — |

**Response:**

```json
{
  "data": {
    "invites": [ "MeetupInviteListItemDto" ],
    "nextCursor": "string|null",
    "counts": {
      "pending": 0
    }
  }
}
```

`counts.pending` optional **PROPOSED** for badge (incoming only).

**404/403:** not used for empty list — **200** empty array.

### 3.3 `GET /v1/meetup-invites/:inviteId`

**Authorization:** user must be sender or recipient; else **404**.

Apply lazy expiry before response.

**Response:** `MeetupInviteDetailDto` with `viewerRole: "sender" | "recipient"` and redacted `venue` per D-28 §6.

### 3.4 Mutations (`accept` | `decline` | `withdraw`)

- Empty body `{}`.
- Optional `Idempotency-Key` per mutation **NEEDS DECISION** (recommend yes for accept).

**Success:** **200** `{ data: MeetupInviteDetailDto }`

**Errors:**

| HTTP | Code | When |
|---|---|---|
| 403 | `AUTH_FORBIDDEN` | Wrong role, lost activation, KYC fail on accept |
| 404 | `NOT_FOUND` | Not participant, blocked, or hidden |
| 409 | `CONFLICT` | Not `PENDING`, expired, duplicate action |
| 409 | `CONFLICT` | Pending pair conflict on create (different endpoint) |

---

## 4. DTO shapes (proposed)

### 4.1 `MeetupInviteCounterpartyPreview`

Reuse pattern from `SocialUserPreview` / `toPublicProfilePreview` — **no** trust badges:

- `userId`, `displayName`, `username`, `hasAvatar`, `locationCity`, `locationRegion`

### 4.2 `MeetupInviteVenueDto`

```typescript
type MeetupInviteVenueDto = {
  city: string;
  region: string;
  label: string | null;
  addressLine: string | null;  // null when redacted
  placeNotes: string | null;   // null when redacted
};
```

### 4.3 `MeetupInviteListItemDto`

- `id`, `status`, `meetupType`, `title`
- `scheduledStartsAt`, `scheduleTimeZone`
- `venue` (redacted rules for list: **no** `addressLine` / `placeNotes` for any viewer in list view **PROPOSED**)
- `notePreview` (truncated) or omit note in list **NEEDS DECISION**
- `counterparty` preview
- `viewerRole`
- `createdAt`
- `actions`: `{ canAccept, canDecline, canWithdraw }` booleans (Flutter convenience)

### 4.4 `MeetupInviteDetailDto`

List fields plus full `note`, precise venue per redaction matrix, timestamps (`acceptedAt`, etc.).

**Explicitly omitted:** `mutualCount`, `distanceMiles`, `isVerifiedBanner`, `checkInScheduled`, map URLs.

---

## 5. Idempotency & duplicates

| Mechanism | Scope |
|---|---|
| `createIdempotencyKey` unique column | Same sender + same key → return existing invite if body hash matches |
| Partial unique index | One `PENDING` per `(senderId, recipientId)` |
| Accept/decline/withdraw | Idempotent on terminal repeat; transactional row lock |

**Client create retry:** use `Idempotency-Key` UUID.

---

## 6. Anti-spam options (028D — propose env)

| Env (proposed) | Default | Purpose |
|---|---|---|
| `MEETUP_INVITE_RATE_LIMIT_SEND_PER_USER` | 10 / hour | Create cap |
| `MEETUP_INVITE_DECLINED_COOLDOWN_HOURS` | 0 (off) | **NEEDS DECISION** |

---

## 7. Settings capability flip (post-028D)

When REST verified on Neon:

- `capabilities.meetupInvites`: `DEFERRED` → **`LIVE`** (only after owner approves D-28 and bounded tests pass).

Until then Flutter must keep hub row disabled.

---

## 8. Distinction from Activity APIs (Flutter)

| Personal meetup | Activity 027E |
|---|---|
| `/v1/meetup-invites*` | `/v1/activities/:id/rsvp`, `/join-requests/*` |
| `PersonalMeetupInvitation.status` | `ActivityParticipation.state` |
| Accept = agree to **1:1 meetup** | Approve = **activity seat** |

---

## 9. Notification read vs invite status

Figma **Mark read** on Meetup Invites screen:

- **Do not** add `readAt` on `PersonalMeetupInvitation`.
- Use existing `PATCH /v1/me/notifications/:id/read` (or bulk read) for notification rows emitted in 028G.

Accept/decline does **not** auto-mark unrelated notifications read.

**028G notifications (implemented 2026-10-29):** `MEETUP_INVITATION_NOTIFICATION_CONTRACT_TASK028G.md`, `TASK_028G_PERSONAL_MEETUP_NOTIFICATIONS_REPORT.md`.
