import { describe, expect, it } from "vitest";
import {
  createGroupBodySchema,
  createGroupPostBodySchema,
  groupListQuerySchema,
  myGroupListQuerySchema,
  patchGroupBodySchema,
  sendGroupMessageBodySchema,
} from "../src/modules/groups/group.validation.js";

const validCreate = {
  name: "Sunrise Riders",
  category: "sports",
  privacy: "PUBLIC",
};

describe("group validation", () => {
  it("accepts a valid create body and normalizes tags", () => {
    const parsed = createGroupBodySchema.parse({
      ...validCreate,
      tags: [" Bike-Club ", "miami"],
      meetupFrequency: "WEEKLY",
      memberCapacity: 20,
    });
    expect(parsed.name).toBe("Sunrise Riders");
    expect(parsed.tags).toEqual(["bike-club", "miami"]);
  });

  it("enforces the Figma 60-character name counter", () => {
    expect(() => createGroupBodySchema.parse({ ...validCreate, name: "x".repeat(61) })).toThrow();
    expect(createGroupBodySchema.parse({ ...validCreate, name: "x".repeat(60) }).name).toHaveLength(
      60,
    );
  });

  it("rejects unknown categories, free-form tags, and extra keys", () => {
    expect(() => createGroupBodySchema.parse({ ...validCreate, category: "biking" })).toThrow();
    expect(() => createGroupBodySchema.parse({ ...validCreate, tags: ["not a tag"] })).toThrow();
    expect(() =>
      createGroupBodySchema.parse({ ...validCreate, verifiedCommunity: true }),
    ).toThrow();
    expect(() => createGroupBodySchema.parse({ ...validCreate, memberCapacity: 1 })).toThrow();
  });

  it("rejects empty patches and owner-only unknown fields", () => {
    expect(() => patchGroupBodySchema.parse({})).toThrow();
    expect(() => patchGroupBodySchema.parse({ ownerId: "nope" })).toThrow();
  });

  it("validates discovery filters without geo or nearby keys", () => {
    const parsed = groupListQuerySchema.parse({
      q: "sunrise",
      category: "sports",
      city: "Miami",
      privacy: "PRIVATE_APPROVAL",
    });
    expect(parsed.q).toBe("sunrise");
    expect(() => groupListQuerySchema.parse({ nearby: true })).toThrow();
    expect(() => groupListQuerySchema.parse({ miles: 5 })).toThrow();
  });

  it("validates my groups inventory views and rejects mixed filters", () => {
    expect(myGroupListQuerySchema.parse({ view: "managed" }).view).toBe("managed");
    expect(myGroupListQuerySchema.parse({ q: "run" }).q).toBe("run");
    expect(() =>
      myGroupListQuerySchema.parse({ view: "joined", status: "ACTIVE" }),
    ).toThrow();
    expect(() => myGroupListQuerySchema.parse({ nearby: true })).toThrow();
  });

  it("bounds posts and chat to plain text", () => {
    expect(createGroupPostBodySchema.parse({ body: "hello" }).body).toBe("hello");
    expect(() => createGroupPostBodySchema.parse({ body: "" })).toThrow();
    expect(() => createGroupPostBodySchema.parse({ poll: { options: ["a"] } })).toThrow();
    expect(
      sendGroupMessageBodySchema.parse({
        body: "hi",
        clientMessageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }).clientMessageId,
    ).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });
});
