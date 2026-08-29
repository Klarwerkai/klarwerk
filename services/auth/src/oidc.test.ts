import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import {
  type OidcConfig,
  codeChallengeS256,
  createOidcProvider,
  createOidcVerifier,
  createPkcePair,
  mapOidcRole,
  parseRolesClaim,
} from "./oidc";
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

function config(over: Partial<OidcConfig> = {}): OidcConfig {
  return {
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksUri: "x",
    authorizeUrl: "https://idp.example.com/authorize",
    tokenUrl: "https://idp.example.com/token",
    clientId: "klarwerk-client",
    redirectUri: "https://app.klarwerk.ai/sso/callback",
    roles: { roleClaim: "roles", adminGroup: "kw-admin", controllerGroup: "kw-ctrl" },
    ...over,
  };
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

  it("weist ein falsches nonce ab", async () => {
    const { token, jwks } = await signedToken({
      sub: "u1",
      email: "k@x.de",
      name: "K",
      nonce: "richtig",
    });
    const verifier = createOidcVerifier({ issuer: ISSUER, audience: AUDIENCE, jwksUri: "x" }, jwks);
    await expect(verifier.verify(token, "falsch")).rejects.toBeDefined();
    await expect(verifier.verify(token, "richtig")).resolves.toMatchObject({ email: "k@x.de" });
  });
});

describe("PKCE (FR-AUTH-07)", () => {
  it("challenge ist der S256-Hash des verifiers", () => {
    const { verifier, challenge } = createPkcePair();
    expect(challenge).toBe(codeChallengeS256(verifier));
    expect(verifier).not.toBe(challenge);
  });
});

describe("Rollen-Mapping (FR-AUTH-07)", () => {
  const cfg = {
    roleClaim: "roles",
    adminGroup: "kw-admin",
    controllerGroup: "kw-ctrl",
    expertGroup: "kw-exp",
  };

  it("mappt nach Präzedenz admin > controller > experte > viewer", () => {
    expect(mapOidcRole(["kw-admin"], cfg)).toBe("admin");
    expect(mapOidcRole(["kw-ctrl"], cfg)).toBe("controller");
    expect(mapOidcRole(["kw-exp"], cfg)).toBe("experte");
    expect(mapOidcRole(["irgendwas"], cfg)).toBe("viewer");
    expect(mapOidcRole(["kw-exp", "kw-admin"], cfg)).toBe("admin"); // höchste gewinnt
  });

  it("kein stiller Admin: ohne konfigurierte Admin-Gruppe niemals admin", () => {
    const noAdmin = { roleClaim: "roles" };
    expect(mapOidcRole(["admin", "kw-admin"], noAdmin)).toBe("viewer");
  });

  it("parseRolesClaim liest Array oder getrennten String", () => {
    expect(parseRolesClaim(["a", "b"])).toEqual(["a", "b"]);
    expect(parseRolesClaim("a b,c")).toEqual(["a", "b", "c"]);
    expect(parseRolesClaim(undefined)).toEqual([]);
  });
});

describe("OIDC-Provider Code-Flow (FR-AUTH-07)", () => {
  it("authorizeUrl enthält PKCE + response_type=code", () => {
    const provider = createOidcProvider(config(), { tokenExchanger: async () => "x" });
    const url = provider.authorizeUrl({ state: "s", nonce: "n", codeChallenge: "c" });
    expect(url).toContain("response_type=code");
    expect(url).toContain("code_challenge=c");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("state=s");
    expect(url).toContain("nonce=n");
  });

  it("happy path: Code-Tausch (stub) + nonce-Verify + Rolle aus Claims", async () => {
    const { token, jwks } = await signedToken({
      sub: "u1",
      email: "chef@example.com",
      name: "Chefin",
      nonce: "n1",
      roles: ["kw-admin"],
    });
    const provider = createOidcProvider(config(), {
      keyResolver: jwks,
      tokenExchanger: async ({ code, codeVerifier }) => {
        expect(code).toBe("the-code");
        expect(codeVerifier).toBe("the-verifier");
        return token;
      },
    });
    const idToken = await provider.exchange("the-code", "the-verifier");
    const claims = await provider.verify(idToken, "n1");
    expect(provider.mapRole(claims)).toBe("admin");
    expect(claims.email).toBe("chef@example.com");
  });
});

// JOB 2686 (R2-7/R2-8): `iss` und `rolesClaimPresent` gehören seither zum Claim-Vertrag.
// `rolesClaimPresent` steht hier auf `true`, wo die Fälle eine Gruppenauskunft nachstellen, und
// auf `false`, wo der Anbieter schweigt — die beiden bedeuten seit R2-8 Verschiedenes.
function claimsAus(over: {
  sub: string;
  email: string;
  name: string;
  roles: string[];
  rolesClaimPresent?: boolean;
}) {
  return {
    ...over,
    iss: ISSUER,
    rolesClaimPresent: over.rolesClaimPresent ?? over.roles.length > 0,
  };
}

describe("loginWithOidc (FR-AUTH-07)", () => {
  it("ohne Auto-Provisionierung kein Konto; mit erzeugt erstes Konto als Admin (Bootstrap)", async () => {
    const service = new AuthService({
      users: new InMemoryUserRepo(),
      sessions: new InMemorySessionRepo(),
    });
    await expect(
      service.loginWithOidc(
        claimsAus({ sub: "u1", email: "neu@x.de", name: "Neu", roles: [] }),
        false,
      ),
    ).rejects.toMatchObject({ code: "NOT_APPROVED" });

    const { token, user } = await service.loginWithOidc(
      claimsAus({ sub: "u1", email: "neu@x.de", name: "Neu", roles: [] }),
      true,
      "viewer",
    );
    expect(user.role).toBe("admin"); // erstes Konto bleibt Bootstrap-Admin
    expect(await service.authenticate(token)).toBeDefined();
  });

  it("provisioniert weiteres SSO-Konto mit gemappter Rolle", async () => {
    const users = new InMemoryUserRepo();
    const service = new AuthService({ users, sessions: new InMemorySessionRepo() });
    await service.loginWithOidc(
      claimsAus({ sub: "a", email: "admin@x.de", name: "A", roles: [] }),
      true,
      "admin",
    );

    const { user } = await service.loginWithOidc(
      claimsAus({ sub: "b", email: "ctrl@x.de", name: "B", roles: ["kw-ctrl"] }),
      true,
      "controller",
    );
    expect(user.role).toBe("controller");
  });

  // JOB 2686 (R2-8) — DIESER FALL HAT SEINE AUSSAGE GEWECHSELT, und zwar absichtlich.
  //
  // Vorher stand hier: „bestehender Nutzer behält die Admin-vergebene Rolle (Claims überschreiben
  // nicht still)" — ein „viewer"-Claim durfte einen Admin NICHT herabstufen. Der Review-Befund R2-8
  // nennt genau diese Entscheidung und dreht ihre eine Hälfte um: *„Die Entscheidung ‚Claims
  // überschreiben nie' schützt vor Privilege-Injection nach oben, lässt aber die Richtung nach
  // unten ebenso liegen."* Wer im Anbieter aus der Admin-Gruppe fliegt, blieb hier Admin.
  //
  // Die schützende Hälfte bleibt unangetastet und steht im zweiten Fall darunter: NIE ANHEBEN.
  it("ein niedrigerer Claim stuft ein SSO-Konto HERAB (R2-8)", async () => {
    const users = new InMemoryUserRepo();
    const service = new AuthService({ users, sessions: new InMemorySessionRepo() });
    // Erstes Konto = Admin (Bootstrap). Bei der Erstanlage wird NICHT abgeglichen.
    await service.loginWithOidc(
      claimsAus({ sub: "a", email: "admin@x.de", name: "A", roles: ["kw-admin"] }),
      true,
      "admin",
    );
    // Zweite Anmeldung, im Anbieter aus der Admin-Gruppe entfernt.
    const { user } = await service.loginWithOidc(
      claimsAus({ sub: "a", email: "admin@x.de", name: "A", roles: ["irgendwas"] }),
      true,
      "viewer",
    );
    expect(user.role).toBe("viewer");
  });

  it("ein höherer Claim hebt ein SSO-Konto NICHT an (R2-8, die schützende Hälfte)", async () => {
    const users = new InMemoryUserRepo();
    const service = new AuthService({ users, sessions: new InMemorySessionRepo() });
    // Ein erstes Konto, damit das folgende NICHT der Bootstrap-Admin wird.
    await service.loginWithOidc(
      claimsAus({ sub: "erst", email: "erst@x.de", name: "E", roles: [] }),
      true,
      "viewer",
    );
    await service.loginWithOidc(
      claimsAus({ sub: "b", email: "klein@x.de", name: "B", roles: ["kw-viewer"] }),
      true,
      "viewer",
    );
    const { user } = await service.loginWithOidc(
      claimsAus({ sub: "b", email: "klein@x.de", name: "B", roles: ["kw-admin"] }),
      true,
      "admin",
    );
    expect(user.role).toBe("viewer");
  });
});
