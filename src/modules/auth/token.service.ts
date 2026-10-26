import { SignJWT, jwtVerify } from "jose";
import type { AuthEnv } from "../../config/env.js";

export type AccessTokenClaims = {
  sub: string;
  sid: string;
};

export class TokenService {
  private readonly secret: Uint8Array;
  private readonly accessTtlSeconds: number;

  constructor(authEnv: AuthEnv) {
    this.secret = new TextEncoder().encode(authEnv.JWT_ACCESS_SECRET);
    this.accessTtlSeconds = authEnv.JWT_ACCESS_TTL_SECONDS;
  }

  async issueAccessToken(
    userId: string,
    sessionId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + this.accessTtlSeconds * 1000);
    const token = await new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(this.secret);
    return { token, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.secret, { algorithms: ["HS256"] });
    const sub = payload.sub;
    const sid = payload.sid;
    if (typeof sub !== "string" || typeof sid !== "string") {
      throw new Error("invalid token claims");
    }
    return { sub, sid };
  }
}
