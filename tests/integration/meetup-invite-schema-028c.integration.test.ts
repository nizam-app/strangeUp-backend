import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "../../generated/prisma/client.js";
import { createPrismaClient, type DatabaseClient } from "../../src/infrastructure/database/prisma.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

const describeSchema = runIntegration ? describe : describe.skip;

describeSchema("meetup-invite schema 028C (Neon strangeup_test)", () => {
  let db: DatabaseClient;

  beforeAll(() => {
    const url = process.env.INTEGRATION_DATABASE_URL;
    if (!url) {
      throw new Error("INTEGRATION_DATABASE_URL required");
    }
    db = createPrismaClient(url);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("enforces one PENDING invite per ordered sender-recipient pair", async () => {
    const sender = await db.user.create({
      data: {
        email: `meetup-sender-${randomUUID()}@example.test`,
        emailNormalized: `meetup-sender-${randomUUID()}@example.test`,
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date(),
        ageEligibilityStatus: "ELIGIBLE",
      },
    });
    const recipient = await db.user.create({
      data: {
        email: `meetup-recipient-${randomUUID()}@example.test`,
        emailNormalized: `meetup-recipient-${randomUUID()}@example.test`,
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date(),
        ageEligibilityStatus: "ELIGIBLE",
      },
    });

    const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const base = {
      senderId: sender.id,
      recipientId: recipient.id,
      status: "PENDING" as const,
      meetupType: "COFFEE" as const,
      title: "Coffee",
      scheduledStartsAt: startsAt,
      scheduleTimeZone: "America/New_York",
      venueCity: "Miami Beach",
      venueRegion: "FL",
    };

    await db.personalMeetupInvitation.create({ data: base });

    await expect(db.personalMeetupInvitation.create({ data: base })).rejects.toMatchObject({
      code: "P2002",
    });

    await db.personalMeetupInvitation.updateMany({
      where: { senderId: sender.id, recipientId: recipient.id },
      data: { status: "DECLINED", declinedAt: new Date() },
    });

    const second = await db.personalMeetupInvitation.create({ data: base });
    expect(second.status).toBe("PENDING");

    await db.personalMeetupInvitation.deleteMany({
      where: { senderId: sender.id, recipientId: recipient.id },
    });
    await db.user.deleteMany({ where: { id: { in: [sender.id, recipient.id] } } });
  });

  it("RESTRICTs user deletion when invitations exist", async () => {
    const sender = await db.user.create({
      data: {
        email: `meetup-sender-del-${randomUUID()}@example.test`,
        emailNormalized: `meetup-sender-del-${randomUUID()}@example.test`,
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date(),
        ageEligibilityStatus: "ELIGIBLE",
      },
    });
    const recipient = await db.user.create({
      data: {
        email: `meetup-recipient-del-${randomUUID()}@example.test`,
        emailNormalized: `meetup-recipient-del-${randomUUID()}@example.test`,
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date(),
        ageEligibilityStatus: "ELIGIBLE",
      },
    });

    await db.personalMeetupInvitation.create({
      data: {
        senderId: sender.id,
        recipientId: recipient.id,
        status: "PENDING",
        meetupType: "OTHER",
        title: "Test",
        scheduledStartsAt: new Date(Date.now() + 86400000),
        scheduleTimeZone: "UTC",
        venueCity: "City",
        venueRegion: "ST",
      },
    });

    await expect(db.user.delete({ where: { id: sender.id } })).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );

    await db.personalMeetupInvitation.deleteMany({ where: { senderId: sender.id } });
    await db.user.deleteMany({ where: { id: { in: [sender.id, recipient.id] } } });
  });
});
