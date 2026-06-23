import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { createOidcVerifier } from "./oidc";
import { InMemorySessionRepo, InMemoryUserRepo } from "./repo";
import { AuthService } from "./service";

const ISSUER = "https://idp.example.com";
const AUDIENCE = "klarwerk-client";

async function signedToken(claims: Record<string, unknown>, audience = AUDIENCE) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setExpirationTime("1h")
    .sign(privateKey);
  return { token, jwks };
}

describe("OIDC-Verifier (FR-AUTH-07)", () => {
  it("verifiziert ein gültiges ID-Token und liest die Claims", async () => {
    const { token, jwks } = await signedToken({
      sub: "u1",
      email: "karl@example.com",
      name: "Karl",
    });
    const verifier = createOidcVerifier({ issuer: ISSUER, audience: AUDIENCE, jwksUri: "x" }, jwks);
    const claims = await verifier.verify(token);
    expect(claims.email).toBe("karl@example.com");
    expect(claims.name).toBe("Karl");
  });

  it("weist eine falsche Audience ab", async () => {
    const { token, jwks } = await signedToken(
      { sub: "u1", email: "k@x.de", name: "K" },
      "fremder-client",
    );
    const verifier = createOidcVerifier({ issuer: ISSUER, audience: AUDIENCE, jwksUri: "x" }, jwks);
    await expect(verifier.verify(token)).rejects.toBeDefined();
  });

  it("loginWithOidc: ohne Auto-Provisionierung kein Konto, mit erzeugt Admin + Sitzung", async () => {
    const service = new AuthService({
      users: new InMemoryUserRepo(),
      sessions: new InMemorySessionRepo(),
    });
    await expect(
      service.loginWithOidc({ sub: "u1", email: "neu@x.de", name: "Neu" }, false),
    ).rejects.toMatchObject({ code: "NOT_APPROVED" });

    const { token, user } = await service.loginWithOidc(
      { sub: "u1", email: "neu@x.de", name: "Neu" },
      true,
    );
    expect(user.role).toBe("admin"); // erstes Konto wird Admin
    expect(await service.authenticate(token)).toBeDefined();
  });
});
