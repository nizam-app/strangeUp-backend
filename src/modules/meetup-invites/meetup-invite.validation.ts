import { z } from "zod";

export const meetupInviteTypeSchema = z.enum(["COFFEE", "ACTIVITY", "SPORTS", "OTHER"]);

export const createMeetupInviteBodySchema = z.object({
  recipientUserId: z.string().uuid(),
  meetupType: meetupInviteTypeSchema,
  title: z.string().min(1).max(80),
  scheduledStartsAt: z.string().datetime(),
  scheduleTimeZone: z.string().min(1).max(64),
  venue: z.object({
    city: z.string().min(1).max(120),
    region: z.string().min(1).max(120),
    label: z.string().max(160).optional().nullable(),
    addressLine: z.string().max(240).optional().nullable(),
    placeNotes: z.string().max(240).optional().nullable(),
  }),
  note: z.string().max(200).optional().nullable(),
});

export const meetupInviteIdParamSchema = z.object({
  inviteId: z.string().uuid(),
});

export const meetupInviteListQuerySchema = z.object({
  box: z.enum(["incoming", "outgoing"]).optional(),
  status: z.enum(["pending", "accepted", "declined", "withdrawn", "expired", "all"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional(),
});

export type CreateMeetupInviteBody = z.infer<typeof createMeetupInviteBodySchema>;
export type MeetupInviteListQuery = z.infer<typeof meetupInviteListQuerySchema>;
