import { describe, expect, it, vi } from "vitest";
import { CloudinaryKycEvidenceStore } from "../../src/infrastructure/kyc-evidence-storage/cloudinary-kyc-evidence-store.js";

const config = {
  cloudName: "demo",
  apiKey: "123456789012345",
  apiSecret: "test-cloudinary-api-secret-min-32-chars",
  evidenceFolder: "strangeup/kyc-evidence",
  requestTimeoutMs: 5_000,
};

describe("CloudinaryKycEvidenceStore", () => {
  it("uploads with authenticated type and access_mode", async () => {
    const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
      expect(url).toContain("/image/upload");
      const body = init?.body;
      expect(body).toBeInstanceOf(FormData);
      const form = body as FormData;
      expect(form.get("type")).toBe("authenticated");
      expect(form.get("access_mode")).toBe("authenticated");
      expect(form.get("api_key")).toBe(config.apiKey);
      const publicId = form.get("public_id");
      expect(typeof publicId === "string" ? publicId : "").toMatch(/^strangeup\/kyc-evidence\//);
      expect(form.get("signature")).toBeTypeOf("string");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            public_id: "strangeup/kyc-evidence/user/session/id_document/x",
            type: "authenticated",
            bytes: 4,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    });

    const store = new CloudinaryKycEvidenceStore(config, fetchImpl as typeof fetch);
    const result = await store.putAuthenticatedEvidence({
      publicId: "strangeup/kyc-evidence/user/session/id_document/x",
      body: Buffer.from("test"),
      contentType: "image/jpeg",
    });

    expect(result.deliveryType).toBe("authenticated");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects public_id outside evidence folder", async () => {
    const store = new CloudinaryKycEvidenceStore(config, vi.fn() as typeof fetch);
    await expect(
      store.putAuthenticatedEvidence({
        publicId: "public/avatar.jpg",
        body: Buffer.from("x"),
        contentType: "image/jpeg",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("downloads via signed authenticated download API (no public URL returned to caller)", async () => {
    const fetchImpl = vi.fn((url: string) => {
      expect(url).toContain("/image/download");
      expect(url).toContain("type=authenticated");
      expect(url).toContain("format=jpg");
      expect(url).toContain("signature=");
      expect(url).toContain("api_key=");
      return Promise.resolve(
        new Response(Buffer.from("secret-bytes"), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
      );
    });

    const store = new CloudinaryKycEvidenceStore(config, fetchImpl as typeof fetch);
    const result = await store.fetchAuthenticatedEvidence(
      "strangeup/kyc-evidence/user/session/selfie/y",
      "jpg",
    );
    expect(result.body.toString()).toBe("secret-bytes");
  });

  it("destroy uses authenticated type on admin destroy endpoint", async () => {
    const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
      expect(url).toContain("/image/destroy");
      const form = init?.body as FormData;
      expect(form.get("type")).toBe("authenticated");
      return Promise.resolve(new Response(JSON.stringify({ result: "ok" }), { status: 200 }));
    });

    const store = new CloudinaryKycEvidenceStore(config, fetchImpl as typeof fetch);
    await store.deleteEvidence("strangeup/kyc-evidence/user/session/selfie/y");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
