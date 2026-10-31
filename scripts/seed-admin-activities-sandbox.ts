/**
 * Task 033C — repeatable synthetic Activities seed for Admin directory verification.
 * Writes only to Neon catalog strangeup_test. Never logs URLs, passwords, or secrets.
 *
 * Usage:
 *   npx tsx scripts/seed-admin-activities-sandbox.ts --inspect
 *   npx tsx scripts/seed-admin-activities-sandbox.ts
 *   npx tsx scripts/seed-admin-activities-sandbox.ts --cleanup --dry-run
 *   npx tsx scripts/seed-admin-activities-sandbox.ts --cleanup --apply
 */
import { config as loadDotenv } from "dotenv";
import type {
  ActivityAudience,
  ActivityJoinMode,
  ActivityMode,
  ActivityParticipationState,
  ActivityStatus,
} from "../generated/prisma/client.js";
import { createPrismaClient, type DatabaseClient } from "../src/infrastructure/database/prisma.js";
import { hashPassword } from "../src/modules/auth/crypto.js";
import { ACTIVITY_CATEGORY_CATALOG } from "../src/modules/activities/activity-catalog.js";
import {
  ACTIVITY_DESCRIPTION_MAX,
  ACTIVITY_TITLE_MAX,
} from "../src/modules/activities/activity.constants.js";
import {
  REQUIRED_INTEGRATION_DATABASE,
  assertIntegrationDatabaseUrlPolicy,
  parseDatabaseTarget,
  redactDatabaseUrl,
  verifyIntegrationDatabaseIdentity,
} from "../tests/setup/integration-database-guard.js";

export const TASK_ID = "033C";
export const SEED_MARKER = "TASK033C_SANDBOX_SEED";
export const PRIVATE_MEETING_CANARY = "TASK033C_PRIVATE_MEETING_NOTE";
export const PRIVATE_VIRTUAL_CANARY = "TASK033C_PRIVATE_VIRTUAL_LINK";
export const EMAIL_PREFIX = "task033c-";
export const EMAIL_DOMAIN = "example.com";
export const SYNTHETIC_PASSWORD = "ValidPass1";

const VALID_ACTIVITY_STATUSES = new Set<ActivityStatus>([
  "DRAFT",
  "PUBLISHED",
  "CANCELLED",
  "COMPLETED",
]);

const FORBIDDEN_LIFECYCLE = ["PENDING_APPROVAL", "SUSPENDED"];

type HostSpec = {
  key: string;
  firstName: string;
  lastName: string;
  city: string;
  region: string;
  timeZone: string;
};

type GuestSpec = {
  key: string;
  firstName: string;
  lastName: string;
};

type ParticipationSpec = {
  guestKey: string;
  state: ActivityParticipationState;
  waitlistPosition?: number;
};

type ActivitySpec = {
  key: number;
  title: string;
  hostKey: string;
  categorySlug: string;
  status: ActivityStatus;
  mode: ActivityMode;
  audience: ActivityAudience;
  joinMode: ActivityJoinMode;
  capacity: number;
  waitlistEnabled: boolean;
  city: string | null;
  region: string | null;
  venueName: string | null;
  timeZone: string;
  startOffsetMs: number;
  durationMs: number;
  extraDescription: string;
  skillNotes: string | null;
  gearNotes: string | null;
  participations: ParticipationSpec[];
};

const HOSTS: HostSpec[] = [
  {
    key: "host-01",
    firstName: "Avery",
    lastName: "Chen",
    city: "Miami",
    region: "FL",
    timeZone: "America/New_York",
  },
  {
    key: "host-02",
    firstName: "Jordan",
    lastName: "Blake",
    city: "Austin",
    region: "TX",
    timeZone: "America/Chicago",
  },
  {
    key: "host-03",
    firstName: "Riley",
    lastName: "Santos",
    city: "Denver",
    region: "CO",
    timeZone: "America/Denver",
  },
  {
    key: "host-04",
    firstName: "Casey",
    lastName: "Nguyen",
    city: "Portland",
    region: "OR",
    timeZone: "America/Los_Angeles",
  },
  {
    key: "host-05",
    firstName: "Morgan",
    lastName: "Patel",
    city: "Chicago",
    region: "IL",
    timeZone: "America/Chicago",
  },
  {
    key: "host-06",
    firstName: "Quinn",
    lastName: "Rivera",
    city: "Seattle",
    region: "WA",
    timeZone: "America/Los_Angeles",
  },
];

const GUESTS: GuestSpec[] = [
  { key: "guest-01", firstName: "Sam", lastName: "Ortiz" },
  { key: "guest-02", firstName: "Taylor", lastName: "Brooks" },
  { key: "guest-03", firstName: "Jamie", lastName: "Cole" },
  { key: "guest-04", firstName: "Reese", lastName: "Dunn" },
  { key: "guest-05", firstName: "Parker", lastName: "Ellis" },
  { key: "guest-06", firstName: "Cameron", lastName: "Frost" },
  { key: "guest-07", firstName: "Drew", lastName: "Garcia" },
  { key: "guest-08", firstName: "Hayden", lastName: "Hale" },
  { key: "guest-09", firstName: "Finley", lastName: "Ives" },
  { key: "guest-10", firstName: "Rowan", lastName: "Jones" },
  { key: "guest-11", firstName: "Skyler", lastName: "Kim" },
  { key: "guest-12", firstName: "Logan", lastName: "Lane" },
  { key: "guest-13", firstName: "Micah", lastName: "Moss" },
  { key: "guest-14", firstName: "Noah", lastName: "Nash" },
  { key: "guest-15", firstName: "Oakley", lastName: "Perez" },
  { key: "guest-16", firstName: "Peyton", lastName: "Quinn" },
];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function pad12(n: number): string {
  return String(n).padStart(12, "0");
}

export function seedUserId(kind: "host" | "guest", index: number): string {
  const offset = kind === "host" ? index : 100 + index;
  return `c033c000-0000-4000-8000-${pad12(offset)}`;
}

export function seedActivityId(index: number): string {
  return `c033c100-0000-4000-8000-${pad12(index)}`;
}

export function seedEmail(key: string): string {
  return `${EMAIL_PREFIX}${key}@${EMAIL_DOMAIN}`;
}

function confirmed(keys: string[]): ParticipationSpec[] {
  return keys.map((guestKey) => ({ guestKey, state: "CONFIRMED" as const }));
}

function buildActivitySpecs(): ActivitySpec[] {
  const partial = confirmed(["guest-01", "guest-02", "guest-03", "guest-04", "guest-05"]);
  const fullEight = confirmed([
    "guest-01",
    "guest-02",
    "guest-03",
    "guest-04",
    "guest-05",
    "guest-06",
    "guest-07",
    "guest-08",
  ]);
  const waitlisted = [
    ...confirmed(["guest-09", "guest-10", "guest-11", "guest-12", "guest-13", "guest-14"]),
    { guestKey: "guest-15", state: "WAITLISTED" as const, waitlistPosition: 1 },
    { guestKey: "guest-16", state: "WAITLISTED" as const, waitlistPosition: 2 },
  ];
  const pendingJoins = [
    ...confirmed(["guest-01", "guest-02", "guest-03"]),
    { guestKey: "guest-04", state: "PENDING" as const },
    { guestKey: "guest-05", state: "PENDING" as const },
    { guestKey: "guest-06", state: "DECLINED" as const },
  ];
  const mixedPast = [
    ...confirmed(["guest-07", "guest-08", "guest-09", "guest-10"]),
    { guestKey: "guest-11", state: "CANCELLED" as const },
  ];

  return [
    {
      key: 1,
      title: "033C Harbor Loop Sunrise Ride",
      hostKey: "host-01",
      categorySlug: "biking",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 12,
      waitlistEnabled: false,
      city: "Miami",
      region: "FL",
      venueName: "Bayfront Park",
      timeZone: "America/New_York",
      startOffsetMs: 2 * DAY,
      durationMs: 2 * HOUR,
      extraDescription: "Easy coastal loop for new and returning riders.",
      skillNotes: "Beginner-friendly pace.",
      gearNotes: "Helmet required. Lights recommended.",
      participations: partial,
    },
    {
      key: 2,
      title: "033C Padel Mixer at Zilker",
      hostKey: "host-02",
      categorySlug: "padel-tennis",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 8,
      waitlistEnabled: false,
      city: "Austin",
      region: "TX",
      venueName: "Zilker Courts",
      timeZone: "America/Chicago",
      startOffsetMs: 3 * DAY,
      durationMs: 90 * 60 * 1000,
      extraDescription: "Round-robin padel with rotating partners.",
      skillNotes: "Intermediate rally preferred.",
      gearNotes: "Bring a paddle if you have one.",
      participations: confirmed(["guest-01", "guest-02", "guest-03"]),
    },
    {
      key: 3,
      title: "033C Cherry Creek Tempo Run",
      hostKey: "host-03",
      categorySlug: "running",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 16,
      waitlistEnabled: false,
      city: "Denver",
      region: "CO",
      venueName: "Cherry Creek Trail",
      timeZone: "America/Denver",
      startOffsetMs: 4 * DAY,
      durationMs: 75 * 60 * 1000,
      extraDescription: "Five-mile tempo with a cool-down stretch.",
      skillNotes: "Comfortable at 9:00/mile.",
      gearNotes: "Trail or road shoes.",
      participations: confirmed(["guest-04", "guest-05", "guest-06", "guest-07"]),
    },
    {
      key: 4,
      title: "033C Sellwood Open-Water Swim",
      hostKey: "host-04",
      categorySlug: "swimming",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 10,
      waitlistEnabled: false,
      city: "Portland",
      region: "OR",
      venueName: "Sellwood River Dock",
      timeZone: "America/Los_Angeles",
      startOffsetMs: 5 * DAY,
      durationMs: 90 * 60 * 1000,
      extraDescription: "Supervised open-water laps along the dock.",
      skillNotes: "Confident continuous swim.",
      gearNotes: "Wetsuit optional. Bright cap required.",
      participations: confirmed(["guest-08", "guest-09"]),
    },
    {
      key: 5,
      title: "033C Lakefront Mobility Hour",
      hostKey: "host-05",
      categorySlug: "fitness",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 20,
      waitlistEnabled: false,
      city: "Chicago",
      region: "IL",
      venueName: "Lincoln Park Lawn",
      timeZone: "America/Chicago",
      startOffsetMs: 6 * DAY,
      durationMs: HOUR,
      extraDescription: "Bodyweight mobility and core circuit.",
      skillNotes: "All levels.",
      gearNotes: "Mat optional.",
      participations: confirmed([
        "guest-10",
        "guest-11",
        "guest-12",
        "guest-13",
        "guest-14",
        "guest-15",
      ]),
    },
    {
      key: 6,
      title: "033C Green Lake Easy Ride",
      hostKey: "host-06",
      categorySlug: "biking",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "FOLLOWERS_ONLY",
      joinMode: "AUTO",
      capacity: 14,
      waitlistEnabled: false,
      city: "Seattle",
      region: "WA",
      venueName: "Green Lake Loop",
      timeZone: "America/Los_Angeles",
      startOffsetMs: 7 * DAY,
      durationMs: 2 * HOUR,
      extraDescription: "Flat neighborhood loop for followers.",
      skillNotes: "Casual conversational pace.",
      gearNotes: "City bike is enough.",
      participations: confirmed(["guest-16", "guest-01", "guest-02"]),
    },
    {
      key: 7,
      title: "033C Full Court Padel Night",
      hostKey: "host-02",
      categorySlug: "padel-tennis",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 8,
      waitlistEnabled: false,
      city: "Austin",
      region: "TX",
      venueName: "South Congress Club",
      timeZone: "America/Chicago",
      startOffsetMs: 8 * DAY,
      durationMs: 2 * HOUR,
      extraDescription: "Fully booked weeknight padel block.",
      skillNotes: "Intermediate.",
      gearNotes: "Indoor court shoes.",
      participations: fullEight,
    },
    {
      key: 8,
      title: "033C Sold-Out Indoor Cycling",
      hostKey: "host-05",
      categorySlug: "fitness",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 8,
      waitlistEnabled: false,
      city: "Chicago",
      region: "IL",
      venueName: "West Loop Studio",
      timeZone: "America/Chicago",
      startOffsetMs: 9 * DAY,
      durationMs: HOUR,
      extraDescription: "Every bike is reserved.",
      skillNotes: "High cadence intervals.",
      gearNotes: "Clipless optional.",
      participations: fullEight,
    },
    {
      key: 9,
      title: "033C Capacity Swim Clinic",
      hostKey: "host-04",
      categorySlug: "swimming",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 8,
      waitlistEnabled: false,
      city: "Portland",
      region: "OR",
      venueName: "Grant Pool",
      timeZone: "America/Los_Angeles",
      startOffsetMs: 10 * DAY,
      durationMs: 90 * 60 * 1000,
      extraDescription: "Stroke clinic with no remaining lanes.",
      skillNotes: "Lane swimming experience.",
      gearNotes: "Fins optional.",
      participations: fullEight,
    },
    {
      key: 10,
      title: "033C Empty Dawn Trail Run",
      hostKey: "host-03",
      categorySlug: "running",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 12,
      waitlistEnabled: false,
      city: "Denver",
      region: "CO",
      venueName: "City Park Pavilion",
      timeZone: "America/Denver",
      startOffsetMs: 11 * DAY,
      durationMs: 90 * 60 * 1000,
      extraDescription: "Published with zero confirmed guests.",
      skillNotes: "Easy conversational miles.",
      gearNotes: "Headlamp.",
      participations: [],
    },
    {
      key: 11,
      title: "033C Open Virtual Yoga Hour",
      hostKey: "host-06",
      categorySlug: "fitness",
      status: "PUBLISHED",
      mode: "VIRTUAL",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 30,
      waitlistEnabled: false,
      city: null,
      region: null,
      venueName: null,
      timeZone: "America/Los_Angeles",
      startOffsetMs: 3 * DAY + 4 * HOUR,
      durationMs: HOUR,
      extraDescription: "Live virtual mobility class with no sign-ups yet.",
      skillNotes: "Gentle flow.",
      gearNotes: "Mat and block.",
      participations: [],
    },
    {
      key: 12,
      title: "033C Quiet Harbor Draft Ride",
      hostKey: "host-01",
      categorySlug: "biking",
      status: "PUBLISHED",
      mode: "HYBRID",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 10,
      waitlistEnabled: false,
      city: "Miami",
      region: "FL",
      venueName: "Museum Park Overlook",
      timeZone: "America/New_York",
      startOffsetMs: 12 * DAY,
      durationMs: 2 * HOUR,
      extraDescription: "Hybrid ride-and-stream session still empty.",
      skillNotes: "Steady endurance.",
      gearNotes: "Phone mount if joining remote.",
      participations: [],
    },
    {
      key: 13,
      title: "033C Live Midday Spin",
      hostKey: "host-05",
      categorySlug: "fitness",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 12,
      waitlistEnabled: false,
      city: "Chicago",
      region: "IL",
      venueName: "Riverwalk Terrace",
      timeZone: "America/Chicago",
      startOffsetMs: -45 * 60 * 1000,
      durationMs: 6 * HOUR,
      extraDescription: "Currently in session on the riverwalk.",
      skillNotes: "All levels.",
      gearNotes: "Water bottle.",
      participations: confirmed(["guest-01", "guest-03", "guest-05", "guest-07"]),
    },
    {
      key: 14,
      title: "033C Live Virtual Stretch",
      hostKey: "host-06",
      categorySlug: "fitness",
      status: "PUBLISHED",
      mode: "VIRTUAL",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 25,
      waitlistEnabled: false,
      city: null,
      region: null,
      venueName: null,
      timeZone: "America/Los_Angeles",
      startOffsetMs: -20 * 60 * 1000,
      durationMs: 4 * HOUR,
      extraDescription: "Live remote stretch happening now.",
      skillNotes: "Desk-friendly.",
      gearNotes: "None.",
      participations: confirmed(["guest-02", "guest-04"]),
    },
    {
      key: 15,
      title: "033C Live Hybrid Track Repeats",
      hostKey: "host-03",
      categorySlug: "running",
      status: "PUBLISHED",
      mode: "HYBRID",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 18,
      waitlistEnabled: false,
      city: "Denver",
      region: "CO",
      venueName: "Washington Park Track",
      timeZone: "America/Denver",
      startOffsetMs: -HOUR,
      durationMs: 5 * HOUR,
      extraDescription: "On-site and remote athletes sharing splits.",
      skillNotes: "800m repeats.",
      gearNotes: "Watch with lap split.",
      participations: confirmed(["guest-06", "guest-08", "guest-10", "guest-12", "guest-14"]),
    },
    {
      key: 16,
      title: "033C September Creek Run",
      hostKey: "host-03",
      categorySlug: "running",
      status: "COMPLETED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 15,
      waitlistEnabled: false,
      city: "Denver",
      region: "CO",
      venueName: "Cherry Creek Trail",
      timeZone: "America/Denver",
      startOffsetMs: -40 * DAY,
      durationMs: 90 * 60 * 1000,
      extraDescription: "Completed autumn group run.",
      skillNotes: "Easy long run.",
      gearNotes: "Layers.",
      participations: mixedPast,
    },
    {
      key: 17,
      title: "033C Completed Padel Social",
      hostKey: "host-02",
      categorySlug: "padel-tennis",
      status: "COMPLETED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 8,
      waitlistEnabled: false,
      city: "Austin",
      region: "TX",
      venueName: "Zilker Courts",
      timeZone: "America/Chicago",
      startOffsetMs: -28 * DAY,
      durationMs: 2 * HOUR,
      extraDescription: "Finished social night with a full card.",
      skillNotes: "Mixed levels.",
      gearNotes: "Court shoes.",
      participations: fullEight,
    },
    {
      key: 18,
      title: "033C Completed Harbor Ride",
      hostKey: "host-01",
      categorySlug: "biking",
      status: "COMPLETED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 12,
      waitlistEnabled: false,
      city: "Miami",
      region: "FL",
      venueName: "Bayfront Park",
      timeZone: "America/New_York",
      startOffsetMs: -21 * DAY,
      durationMs: 2 * HOUR,
      extraDescription: "Past weekend ride that wrapped on time.",
      skillNotes: "Endurance.",
      gearNotes: "Spare tube.",
      participations: partial,
    },
    {
      key: 19,
      title: "033C Completed Virtual Core",
      hostKey: "host-05",
      categorySlug: "fitness",
      status: "COMPLETED",
      mode: "VIRTUAL",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 20,
      waitlistEnabled: false,
      city: null,
      region: null,
      venueName: null,
      timeZone: "America/Chicago",
      startOffsetMs: -14 * DAY,
      durationMs: HOUR,
      extraDescription: "Recorded-complete virtual core class.",
      skillNotes: "Beginner.",
      gearNotes: "Mat.",
      participations: confirmed(["guest-01", "guest-09"]),
    },
    {
      key: 20,
      title: "033C Completed Empty Swim",
      hostKey: "host-04",
      categorySlug: "swimming",
      status: "COMPLETED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 6,
      waitlistEnabled: false,
      city: "Portland",
      region: "OR",
      venueName: "Grant Pool",
      timeZone: "America/Los_Angeles",
      startOffsetMs: -10 * DAY,
      durationMs: HOUR,
      extraDescription: "Completed session that never filled.",
      skillNotes: "Technique.",
      gearNotes: "Goggles.",
      participations: [],
    },
    {
      key: 21,
      title: "033C Completed Followers Ride",
      hostKey: "host-06",
      categorySlug: "biking",
      status: "COMPLETED",
      mode: "IN_PERSON",
      audience: "FOLLOWERS_ONLY",
      joinMode: "AUTO",
      capacity: 10,
      waitlistEnabled: false,
      city: "Seattle",
      region: "WA",
      venueName: "Alki Beach Path",
      timeZone: "America/Los_Angeles",
      startOffsetMs: -7 * DAY,
      durationMs: 2 * HOUR,
      extraDescription: "Past followers-only waterfront ride.",
      skillNotes: "Steady.",
      gearNotes: "Lights.",
      participations: confirmed(["guest-12", "guest-13", "guest-14"]),
    },
    {
      key: 22,
      title: "033C Draft Brick Workout",
      hostKey: "host-05",
      categorySlug: "fitness",
      status: "DRAFT",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 12,
      waitlistEnabled: false,
      city: "Chicago",
      region: "IL",
      venueName: "Northerly Island",
      timeZone: "America/Chicago",
      startOffsetMs: 15 * DAY,
      durationMs: 2 * HOUR,
      extraDescription: "Unpublished brick session.",
      skillNotes: "Bike then run.",
      gearNotes: "Transition towel.",
      participations: [],
    },
    {
      key: 23,
      title: "033C Draft Night Swim",
      hostKey: "host-04",
      categorySlug: "swimming",
      status: "DRAFT",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 8,
      waitlistEnabled: false,
      city: "Portland",
      region: "OR",
      venueName: "Grant Pool",
      timeZone: "America/Los_Angeles",
      startOffsetMs: 16 * DAY,
      durationMs: 90 * 60 * 1000,
      extraDescription: "Draft lane reservation.",
      skillNotes: "Continuous 400s.",
      gearNotes: "Pull buoy.",
      participations: [],
    },
    {
      key: 24,
      title: "033C Draft Virtual Office Yoga",
      hostKey: "host-06",
      categorySlug: "fitness",
      status: "DRAFT",
      mode: "VIRTUAL",
      audience: "FOLLOWERS_ONLY",
      joinMode: "HOST_APPROVAL",
      capacity: 15,
      waitlistEnabled: false,
      city: null,
      region: null,
      venueName: null,
      timeZone: "America/Los_Angeles",
      startOffsetMs: 18 * DAY,
      durationMs: 45 * 60 * 1000,
      extraDescription: "Draft remote class pending publish.",
      skillNotes: "Chair-friendly.",
      gearNotes: "None.",
      participations: [],
    },
    {
      key: 25,
      title: "033C Draft Hybrid Skills Clinic",
      hostKey: "host-02",
      categorySlug: "padel-tennis",
      status: "DRAFT",
      mode: "HYBRID",
      audience: "PUBLIC",
      joinMode: "HOST_APPROVAL",
      capacity: 10,
      waitlistEnabled: false,
      city: "Austin",
      region: "TX",
      venueName: "Zilker Courts",
      timeZone: "America/Chicago",
      startOffsetMs: 20 * DAY,
      durationMs: 2 * HOUR,
      extraDescription: "Unpublished clinic outline.",
      skillNotes: "Serve and volley.",
      gearNotes: "Paddle.",
      participations: [],
    },
    {
      key: 26,
      title: "033C Cancelled Storm Ride",
      hostKey: "host-01",
      categorySlug: "biking",
      status: "CANCELLED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 12,
      waitlistEnabled: false,
      city: "Miami",
      region: "FL",
      venueName: "Bayfront Park",
      timeZone: "America/New_York",
      startOffsetMs: 2 * DAY + 3 * HOUR,
      durationMs: 2 * HOUR,
      extraDescription: "Cancelled after a weather warning.",
      skillNotes: "Endurance.",
      gearNotes: "Rain jacket.",
      participations: confirmed(["guest-01", "guest-02"]),
    },
    {
      key: 27,
      title: "033C Cancelled Pool Booking",
      hostKey: "host-04",
      categorySlug: "swimming",
      status: "CANCELLED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 8,
      waitlistEnabled: false,
      city: "Portland",
      region: "OR",
      venueName: "Grant Pool",
      timeZone: "America/Los_Angeles",
      startOffsetMs: -3 * DAY,
      durationMs: HOUR,
      extraDescription: "Cancelled when the pool closed.",
      skillNotes: "Laps.",
      gearNotes: "Goggles.",
      participations: [],
    },
    {
      key: 28,
      title: "033C Cancelled Virtual HIIT",
      hostKey: "host-05",
      categorySlug: "fitness",
      status: "CANCELLED",
      mode: "VIRTUAL",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 20,
      waitlistEnabled: false,
      city: null,
      region: null,
      venueName: null,
      timeZone: "America/Chicago",
      startOffsetMs: 4 * DAY,
      durationMs: 45 * 60 * 1000,
      extraDescription: "Host cancelled the remote HIIT block.",
      skillNotes: "Intervals.",
      gearNotes: "None.",
      participations: confirmed(["guest-15"]),
    },
    {
      key: 29,
      title: "033C Cancelled Followers Run",
      hostKey: "host-03",
      categorySlug: "running",
      status: "CANCELLED",
      mode: "IN_PERSON",
      audience: "FOLLOWERS_ONLY",
      joinMode: "AUTO",
      capacity: 10,
      waitlistEnabled: false,
      city: "Denver",
      region: "CO",
      venueName: "City Park Pavilion",
      timeZone: "America/Denver",
      startOffsetMs: 6 * DAY,
      durationMs: HOUR,
      extraDescription: "Cancelled followers-only meetup.",
      skillNotes: "Easy.",
      gearNotes: "Layers.",
      participations: [],
    },
    {
      key: 30,
      title: "033C Waitlist Harbor Century",
      hostKey: "host-01",
      categorySlug: "biking",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 6,
      waitlistEnabled: true,
      city: "Miami",
      region: "FL",
      venueName: "Rickenbacker Causeway",
      timeZone: "America/New_York",
      startOffsetMs: 5 * DAY + 2 * HOUR,
      durationMs: 5 * HOUR,
      extraDescription: "Long ride with an active waitlist.",
      skillNotes: "Century training.",
      gearNotes: "Two bottles and snacks.",
      participations: waitlisted,
    },
    {
      key: 31,
      title: "033C Waitlist Night Padel",
      hostKey: "host-02",
      categorySlug: "padel-tennis",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 6,
      waitlistEnabled: true,
      city: "Austin",
      region: "TX",
      venueName: "South Congress Club",
      timeZone: "America/Chicago",
      startOffsetMs: 6 * DAY + HOUR,
      durationMs: 2 * HOUR,
      extraDescription: "Courts are full; waitlist is open.",
      skillNotes: "Intermediate.",
      gearNotes: "Grip tape.",
      participations: waitlisted,
    },
    {
      key: 32,
      title: "033C Approval-Only Hill Repeats",
      hostKey: "host-03",
      categorySlug: "running",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "HOST_APPROVAL",
      capacity: 10,
      waitlistEnabled: false,
      city: "Denver",
      region: "CO",
      venueName: "Lookout Mountain Gate",
      timeZone: "America/Denver",
      startOffsetMs: 8 * DAY + 2 * HOUR,
      durationMs: 90 * 60 * 1000,
      extraDescription: "Host reviews each join request.",
      skillNotes: "Hill experience.",
      gearNotes: "Trail shoes.",
      participations: pendingJoins,
    },
    {
      key: 33,
      title: "033C Approval Virtual Strength",
      hostKey: "host-05",
      categorySlug: "fitness",
      status: "PUBLISHED",
      mode: "VIRTUAL",
      audience: "FOLLOWERS_ONLY",
      joinMode: "HOST_APPROVAL",
      capacity: 12,
      waitlistEnabled: false,
      city: null,
      region: null,
      venueName: null,
      timeZone: "America/Chicago",
      startOffsetMs: 9 * DAY + 3 * HOUR,
      durationMs: HOUR,
      extraDescription: "Followers request a seat before joining.",
      skillNotes: "Dumbbells 8-15 lb.",
      gearNotes: "Two light dumbbells.",
      participations: pendingJoins,
    },
    {
      key: 34,
      title: "033C Hybrid Open Swim Briefing",
      hostKey: "host-04",
      categorySlug: "swimming",
      status: "PUBLISHED",
      mode: "HYBRID",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 14,
      waitlistEnabled: false,
      city: "Portland",
      region: "OR",
      venueName: "Sellwood River Dock",
      timeZone: "America/Los_Angeles",
      startOffsetMs: 13 * DAY,
      durationMs: 90 * 60 * 1000,
      extraDescription: "Dock briefing plus remote safety talk.",
      skillNotes: "Open water.",
      gearNotes: "Bright cap.",
      participations: confirmed(["guest-03", "guest-06", "guest-09"]),
    },
    {
      key: 35,
      title: "033C Distant December Ride",
      hostKey: "host-06",
      categorySlug: "biking",
      status: "PUBLISHED",
      mode: "IN_PERSON",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 16,
      waitlistEnabled: false,
      city: "Seattle",
      region: "WA",
      venueName: "Alki Beach Path",
      timeZone: "America/Los_Angeles",
      startOffsetMs: 40 * DAY,
      durationMs: 2 * HOUR,
      extraDescription: "Published beyond the 14-day upcoming window.",
      skillNotes: "Easy.",
      gearNotes: "Lights and layers.",
      participations: confirmed(["guest-11", "guest-16"]),
    },
    {
      key: 36,
      title: "033C Distant Hybrid Clinic",
      hostKey: "host-01",
      categorySlug: "padel-tennis",
      status: "PUBLISHED",
      mode: "HYBRID",
      audience: "PUBLIC",
      joinMode: "AUTO",
      capacity: 10,
      waitlistEnabled: true,
      city: "Miami",
      region: "FL",
      venueName: "Bayfront Courts",
      timeZone: "America/New_York",
      startOffsetMs: 45 * DAY,
      durationMs: 2 * HOUR,
      extraDescription: "Later-month hybrid clinic with spare capacity.",
      skillNotes: "Footwork.",
      gearNotes: "Paddle.",
      participations: confirmed(["guest-02", "guest-08"]),
    },
  ];
}

export const ACTIVITY_SPECS = buildActivitySpecs();

function assertSeedIntegrity(): void {
  const keys = new Set<number>();
  for (const spec of ACTIVITY_SPECS) {
    if (keys.has(spec.key)) {
      throw new Error(`Duplicate activity key ${spec.key}`);
    }
    keys.add(spec.key);
    if (!VALID_ACTIVITY_STATUSES.has(spec.status)) {
      throw new Error(`Unsupported activity status ${spec.status}`);
    }
    if (FORBIDDEN_LIFECYCLE.includes(spec.status)) {
      throw new Error(`Refusing invented lifecycle ${spec.status}`);
    }
    if (spec.title.length > ACTIVITY_TITLE_MAX) {
      throw new Error(`Title too long for activity ${spec.key}`);
    }
    if (!spec.title.includes("033C")) {
      throw new Error(`Activity ${spec.key} is missing the 033C title marker`);
    }
    const confirmedCount = spec.participations.filter((row) => row.state === "CONFIRMED").length;
    if (confirmedCount > spec.capacity) {
      throw new Error(`Activity ${spec.key} confirmed count exceeds capacity`);
    }
    const guestKeys = new Set<string>();
    for (const row of spec.participations) {
      if (guestKeys.has(row.guestKey)) {
        throw new Error(`Duplicate guest ${row.guestKey} on activity ${spec.key}`);
      }
      guestKeys.add(row.guestKey);
      if (row.guestKey === spec.hostKey) {
        throw new Error(`Host cannot participate on activity ${spec.key}`);
      }
    }
  }
  if (ACTIVITY_SPECS.length < 30 || ACTIVITY_SPECS.length > 40) {
    throw new Error(`Expected 30-40 activities, got ${ACTIVITY_SPECS.length}`);
  }
}

export function resolveSandboxDatabaseUrl(): string {
  loadDotenv({ path: ".env" });
  const integration = process.env.INTEGRATION_DATABASE_URL?.trim();
  const development = process.env.DATABASE_URL?.trim();
  if (!integration) {
    throw new Error("INTEGRATION_DATABASE_URL is required");
  }
  assertIntegrationDatabaseUrlPolicy(integration, development);
  const target = parseDatabaseTarget(integration);
  if (target.database !== REQUIRED_INTEGRATION_DATABASE) {
    throw new Error(`Refusing catalog "${target.database}"`);
  }
  if (development) {
    const devTarget = parseDatabaseTarget(development);
    if (devTarget.database !== "strangeup_dev") {
      throw new Error(`Refusing unexpected DATABASE_URL catalog "${devTarget.database}"`);
    }
  }
  return integration;
}

export async function connectSandbox(): Promise<{
  db: DatabaseClient;
  databaseUrl: string;
  identity: { database: string; user: string };
}> {
  const databaseUrl = resolveSandboxDatabaseUrl();
  const identity = await verifyIntegrationDatabaseIdentity(databaseUrl);
  if (identity.database !== REQUIRED_INTEGRATION_DATABASE) {
    throw new Error(`Live database identity mismatch: ${identity.database}`);
  }
  const db = createPrismaClient(databaseUrl);
  const live = await db.$queryRaw<
    Array<{ database: string }>
  >`SELECT current_database() AS database`;
  if (live[0]?.database !== REQUIRED_INTEGRATION_DATABASE) {
    await db.$disconnect();
    throw new Error(`Prisma identity mismatch: ${live[0]?.database}`);
  }
  return { db, databaseUrl, identity };
}

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

export async function inspectSandbox(db: DatabaseClient, databaseUrl: string): Promise<void> {
  const identity = await db.$queryRaw<Array<{ database: string; db_user: string }>>`
    SELECT current_database() AS database, current_user AS db_user
  `;
  const migrations = await db.$queryRaw<MigrationRow[]>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
    ORDER BY finished_at DESC NULLS LAST
    LIMIT 12
  `;
  const [categories, users, activities, participations, seedUsers, seedActivities] =
    await Promise.all([
      db.activityCategory.findMany({
        orderBy: { sortOrder: "asc" },
        select: { slug: true, label: true },
      }),
      db.user.count(),
      db.activity.count(),
      db.activityParticipation.count(),
      db.user.count({
        where: { emailNormalized: { startsWith: EMAIL_PREFIX } },
      }),
      db.activity.count({
        where: { description: { contains: SEED_MARKER } },
      }),
    ]);
  const pending = migrations.filter((row) => !row.finished_at || row.rolled_back_at);
  console.log("catalog", identity[0]?.database);
  console.log("db_user", identity[0]?.db_user);
  console.log("connection", redactDatabaseUrl(databaseUrl));
  console.log("categories", categories.map((row) => row.slug).join(","));
  console.log("existing_users", users);
  console.log("existing_activities", activities);
  console.log("existing_participations", participations);
  console.log("task033c_users", seedUsers);
  console.log("task033c_activities", seedActivities);
  console.log("recent_migrations", migrations.length);
  for (const row of migrations) {
    const state = row.rolled_back_at ? "rolled_back" : row.finished_at ? "applied" : "pending";
    console.log(`  ${state} ${row.migration_name}`);
  }
  if (pending.length > 0) {
    console.log("warning unfinished_migrations", pending.length);
  }
}

function descriptionFor(spec: ActivitySpec): string {
  const text = `[${SEED_MARKER}] ${spec.extraDescription} Synthetic sandbox row only.`;
  if (text.length > ACTIVITY_DESCRIPTION_MAX) {
    throw new Error(`Description too long for activity ${spec.key}`);
  }
  return text;
}

function meetingInstructions(spec: ActivitySpec): string | null {
  if (spec.mode === "VIRTUAL") {
    return null;
  }
  return `${PRIVATE_MEETING_CANARY}: arrive at the marked bench. Staff APIs must omit this.`;
}

function virtualDetails(spec: ActivitySpec): string | null {
  if (spec.mode === "IN_PERSON") {
    return null;
  }
  return `${PRIVATE_VIRTUAL_CANARY}: https://meet.example.test/task033c-${spec.key}`;
}

function usernameFor(key: string, firstName: string): string {
  return `task033c_${key.replace("-", "_")}_${firstName.toLowerCase()}`;
}

async function ensureCategories(db: DatabaseClient): Promise<Map<string, string>> {
  const rows = await db.activityCategory.findMany({
    select: { id: true, slug: true },
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row.id]));
  for (const entry of ACTIVITY_CATEGORY_CATALOG) {
    if (!bySlug.has(entry.slug)) {
      throw new Error(
        `Required category "${entry.slug}" is missing. Refusing to invent catalog rows.`,
      );
    }
  }
  return bySlug;
}

async function assertSafeUserTarget(db: DatabaseClient, id: string, email: string): Promise<void> {
  const byId = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      emailNormalized: true,
      platformStaffGrants: { select: { role: true, revokedAt: true } },
    },
  });
  if (byId && !byId.emailNormalized.startsWith(EMAIL_PREFIX)) {
    throw new Error(`Refusing to overwrite non-task user ${id}`);
  }
  if (byId?.platformStaffGrants.some((grant) => grant.revokedAt === null)) {
    throw new Error(`Refusing to mutate staff-granted user ${id}`);
  }
  const byEmail = await db.user.findUnique({
    where: { emailNormalized: email },
    select: { id: true, emailNormalized: true },
  });
  if (byEmail && byEmail.id !== id) {
    throw new Error(`Email ${email} is already owned by another user`);
  }
}

async function assertSafeActivityTarget(db: DatabaseClient, id: string): Promise<void> {
  const existing = await db.activity.findUnique({
    where: { id },
    select: { id: true, description: true, host: { select: { emailNormalized: true } } },
  });
  if (!existing) {
    return;
  }
  const marked = existing.description?.includes(SEED_MARKER);
  const ownedHost = existing.host.emailNormalized.startsWith(EMAIL_PREFIX);
  if (!marked && !ownedHost) {
    throw new Error(`Refusing to overwrite unrelated activity ${id}`);
  }
}

async function upsertUsers(db: DatabaseClient, passwordHash: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const people: Array<{
    key: string;
    firstName: string;
    lastName: string;
    kind: "host" | "guest";
    index: number;
  }> = [
    ...HOSTS.map((host, index) => ({ ...host, kind: "host" as const, index: index + 1 })),
    ...GUESTS.map((guest, index) => ({ ...guest, kind: "guest" as const, index: index + 1 })),
  ];

  for (const person of people) {
    const id = seedUserId(person.kind, person.index);
    const email = seedEmail(person.key);
    await assertSafeUserTarget(db, id, email);
    await db.user.upsert({
      where: { id },
      create: {
        id,
        email,
        emailNormalized: email,
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date("2026-09-01T12:00:00.000Z"),
        ageEligibilityStatus: "ELIGIBLE",
        identityVerificationStatus: "NOT_STARTED",
        adminReviewStatus: "NOT_READY",
      },
      update: {
        email,
        emailNormalized: email,
        accountStatus: "ACTIVE",
        deletedAt: null,
        suspendedAt: null,
      },
    });
    await db.profile.upsert({
      where: { userId: id },
      create: {
        userId: id,
        firstName: person.firstName,
        lastName: person.lastName,
        displayName: `${person.firstName} ${person.lastName}`,
        username: usernameFor(person.key, person.firstName),
        birthDate: new Date("1994-04-12"),
        locationCity: person.kind === "host" ? HOSTS[person.index - 1]?.city : "Miami",
        locationRegion: person.kind === "host" ? HOSTS[person.index - 1]?.region : "FL",
        scheduleTimeZone:
          person.kind === "host" ? HOSTS[person.index - 1]?.timeZone : "America/New_York",
      },
      update: {
        firstName: person.firstName,
        lastName: person.lastName,
        displayName: `${person.firstName} ${person.lastName}`,
        username: usernameFor(person.key, person.firstName),
      },
    });
    await db.passwordCredential.upsert({
      where: { userId: id },
      create: { userId: id, passwordHash },
      update: {},
    });
    ids.set(person.key, id);
  }
  return ids;
}

async function upsertActivities(
  db: DatabaseClient,
  userIds: Map<string, string>,
  categoryIds: Map<string, string>,
  now: Date,
): Promise<{ activities: number; participations: number }> {
  let participations = 0;
  for (const spec of ACTIVITY_SPECS) {
    const id = seedActivityId(spec.key);
    const hostId = userIds.get(spec.hostKey);
    const categoryId = categoryIds.get(spec.categorySlug);
    if (!hostId || !categoryId) {
      throw new Error(`Missing host or category for activity ${spec.key}`);
    }
    await assertSafeActivityTarget(db, id);
    const startsAt = new Date(now.getTime() + spec.startOffsetMs);
    const endsAt = new Date(startsAt.getTime() + spec.durationMs);
    const publishedAt = spec.status === "DRAFT" ? null : new Date(startsAt.getTime() - 3 * DAY);
    const cancelledAt = spec.status === "CANCELLED" ? new Date(now.getTime() - HOUR) : null;

    await db.activity.upsert({
      where: { id },
      create: {
        id,
        hostId,
        title: spec.title,
        description: descriptionFor(spec),
        categoryId,
        startsAt,
        endsAt,
        timeZone: spec.timeZone,
        mode: spec.mode,
        status: spec.status,
        audience: spec.audience,
        joinMode: spec.joinMode,
        venueName: spec.venueName,
        locationCity: spec.city,
        locationRegion: spec.region,
        meetingInstructions: meetingInstructions(spec),
        virtualMeetingDetails: virtualDetails(spec),
        skillNotes: spec.skillNotes,
        gearNotes: spec.gearNotes,
        capacity: spec.capacity,
        waitlistEnabled: spec.waitlistEnabled,
        publishedAt,
        cancelledAt,
        coverStorageKey: null,
        coverContentType: null,
      },
      update: {
        hostId,
        title: spec.title,
        description: descriptionFor(spec),
        categoryId,
        startsAt,
        endsAt,
        timeZone: spec.timeZone,
        mode: spec.mode,
        status: spec.status,
        audience: spec.audience,
        joinMode: spec.joinMode,
        venueName: spec.venueName,
        locationCity: spec.city,
        locationRegion: spec.region,
        meetingInstructions: meetingInstructions(spec),
        virtualMeetingDetails: virtualDetails(spec),
        skillNotes: spec.skillNotes,
        gearNotes: spec.gearNotes,
        capacity: spec.capacity,
        waitlistEnabled: spec.waitlistEnabled,
        publishedAt,
        cancelledAt,
        coverStorageKey: null,
        coverContentType: null,
      },
    });

    await db.activityParticipation.deleteMany({ where: { activityId: id } });
    for (const row of spec.participations) {
      const userId = userIds.get(row.guestKey);
      if (!userId) {
        throw new Error(`Missing guest ${row.guestKey}`);
      }
      await db.activityParticipation.create({
        data: {
          activityId: id,
          userId,
          state: row.state,
          waitlistPosition: row.waitlistPosition ?? null,
          hostApprovedAt: row.state === "CONFIRMED" ? startsAt : null,
          cancelledAt: row.state === "CANCELLED" ? now : null,
        },
      });
      participations += 1;
    }
  }
  return { activities: ACTIVITY_SPECS.length, participations };
}

export function allSeedUserIds(): string[] {
  return [
    ...HOSTS.map((_, index) => seedUserId("host", index + 1)),
    ...GUESTS.map((_, index) => seedUserId("guest", index + 1)),
  ];
}

export function allSeedActivityIds(): string[] {
  return ACTIVITY_SPECS.map((spec) => seedActivityId(spec.key));
}

export async function previewCleanup(db: DatabaseClient) {
  const seedUserIds = allSeedUserIds();
  const seedActivityIds = allSeedActivityIds();
  const activities = await db.activity.findMany({
    where: {
      OR: [{ id: { in: seedActivityIds } }, { description: { contains: SEED_MARKER } }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      host: { select: { emailNormalized: true } },
    },
  });
  const ownedActivities = activities.filter((row) => {
    const marked = row.description?.includes(SEED_MARKER) ?? false;
    const knownId = seedActivityIds.includes(row.id);
    const ownedHost = row.host.emailNormalized.startsWith(EMAIL_PREFIX);
    return marked && (knownId || ownedHost);
  });
  const users = await db.user.findMany({
    where: {
      OR: [{ emailNormalized: { startsWith: EMAIL_PREFIX } }, { id: { in: seedUserIds } }],
    },
    select: {
      id: true,
      emailNormalized: true,
      platformStaffGrants: { select: { revokedAt: true } },
      hostedActivities: { select: { id: true, description: true } },
    },
  });
  const ownedUsers = users.filter((row) => {
    const emailOwned = row.emailNormalized.startsWith(EMAIL_PREFIX);
    const idOwned = seedUserIds.includes(row.id);
    const staff = row.platformStaffGrants.some((grant) => grant.revokedAt === null);
    const foreignHost = row.hostedActivities.some(
      (activity) => !activity.description?.includes(SEED_MARKER),
    );
    return emailOwned && idOwned && !staff && !foreignHost;
  });
  return {
    ownedActivities,
    ownedUsers,
    skippedUsers: users.filter((row) => !ownedUsers.some((owned) => owned.id === row.id)),
  };
}

async function applyCleanup(db: DatabaseClient): Promise<void> {
  const preview = await previewCleanup(db);
  const activityIds = preview.ownedActivities.map((row) => row.id);
  const userIds = preview.ownedUsers.map((row) => row.id);
  if (activityIds.length > 0) {
    const deletedParts = await db.activityParticipation.deleteMany({
      where: { activityId: { in: activityIds } },
    });
    const deletedActivities = await db.activity.deleteMany({
      where: { id: { in: activityIds } },
    });
    console.log("deleted_participations", deletedParts.count);
    console.log("deleted_activities", deletedActivities.count);
  }
  if (userIds.length > 0) {
    await db.passwordCredential.deleteMany({ where: { userId: { in: userIds } } });
    await db.profile.deleteMany({ where: { userId: { in: userIds } } });
    const deletedUsers = await db.user.deleteMany({ where: { id: { in: userIds } } });
    console.log("deleted_users", deletedUsers.count);
  }
}

function parseArgs(argv: string[]) {
  return {
    inspect: argv.includes("--inspect"),
    cleanup: argv.includes("--cleanup"),
    apply: argv.includes("--apply"),
    dryRun: argv.includes("--dry-run") || (!argv.includes("--apply") && argv.includes("--cleanup")),
  };
}

async function seed(db: DatabaseClient): Promise<void> {
  assertSeedIntegrity();
  const categoryIds = await ensureCategories(db);
  const passwordHash = await hashPassword(SYNTHETIC_PASSWORD);
  const userIds = await upsertUsers(db, passwordHash);
  const result = await upsertActivities(db, userIds, categoryIds, new Date());
  const orphanParts = await db.activityParticipation.count({
    where: {
      activityId: { in: ACTIVITY_SPECS.map((spec) => seedActivityId(spec.key)) },
      user: { emailNormalized: { not: { startsWith: EMAIL_PREFIX } } },
    },
  });
  if (orphanParts > 0) {
    throw new Error("Seed created a participation on a non-task user");
  }
  console.log("seeded_users", userIds.size);
  console.log("seeded_activities", result.activities);
  console.log("seeded_participations", result.participations);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { db, databaseUrl } = await connectSandbox();
  try {
    console.log("identity_ok", REQUIRED_INTEGRATION_DATABASE);
    await inspectSandbox(db, databaseUrl);
    if (args.inspect && !args.cleanup) {
      return;
    }
    if (args.cleanup) {
      const preview = await previewCleanup(db);
      console.log("cleanup_preview_activities", preview.ownedActivities.length);
      for (const row of preview.ownedActivities) {
        console.log(`  activity ${row.id} ${row.title}`);
      }
      console.log("cleanup_preview_users", preview.ownedUsers.length);
      for (const row of preview.ownedUsers) {
        console.log(`  user ${row.id} ${row.emailNormalized}`);
      }
      if (preview.skippedUsers.length > 0) {
        console.log("cleanup_skipped_users", preview.skippedUsers.length);
      }
      if (args.dryRun || !args.apply) {
        console.log("cleanup_dry_run true");
        return;
      }
      await applyCleanup(db);
      console.log("cleanup_applied true");
      return;
    }
    await seed(db);
    console.log("seed_complete true");
  } finally {
    await db.$disconnect();
  }
}

const invokedDirectly = process.argv[1]?.includes("seed-admin-activities-sandbox");
if (invokedDirectly) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
