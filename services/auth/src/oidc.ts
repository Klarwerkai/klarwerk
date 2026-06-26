import { createHash, randomBytes } from "node:crypto";
import { type JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from "jose";
import type { Role } from "./types";

// FR-AUTH-07: generisches OIDC mit Authorization-Code-Flow + PKCE (S256).
// Anbieteragnostisch: Azure AD/Entra, Auth0, Keycloak, Google … Best Practice:
// kein Implicit, kein id_token im Browser-Fragment; Code-Tausch serverseitig.

export interface OidcRoleConfig {
  // Claim, der die Gruppen/Rollen des Nutzers trägt (Array oder getrennter String).
  roleClaim: string;
  // Exakte Gruppennamen → KLARWERK-Rolle. Fehlt einer, ist diese Rolle per Claim unerreichbar.
  adminGroup?: string | undefined;
  controllerGroup?: string | undefined;
  expertGroup?: string | undefined;
}

export interface OidcConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  clientSecret?: string | undefined;
  autoProvision?: boolean;
  roles: OidcRoleConfig;
}

export interface OidcClaims {
  sub: string;
  email: string;
  name: string;
  roles: string[];
}

// --- PKCE / Zufallswerte ---------------------------------------------------

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function codeChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function createPkcePair(): PkcePair {
  const verifier = randomToken(32);
  return { verifier, challenge: codeChallengeS256(verifier) };
}

// --- Rollen-Mapping (rein, deterministisch) --------------------------------

// Liest den Rollen-/Gruppen-Claim robust: Array von Strings oder getrennter String.
export function parseRolesClaim(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    return value
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

// Default viewer. Admin/Controller/Experte NUR bei exakt konfigurierter Gruppe.
// Präzedenz admin > controller > experte > viewer. Keine stillen Admin-Rechte:
// ist adminGroup nicht gesetzt, kann kein Claim Admin erzeugen.
export function mapOidcRole(groups: readonly string[], cfg: OidcRoleConfig): Role {
  const has = (g?: string): boolean => Boolean(g) && groups.includes(g as string);
  if (has(cfg.adminGroup)) {
    return "admin";
  }
  if (has(cfg.controllerGroup)) {
    return "controller";
  }
  if (has(cfg.expertGroup)) {
    return "experte";
  }
  return "viewer";
}

// --- Verifier (id_token), rückwärtskompatibel -------------------------------

export interface OidcVerifier {
  readonly autoProvision: boolean;
  verify(idToken: string, expectedNonce?: string): Promise<OidcClaims>;
}

export function createOidcVerifier(
  config: Pick<OidcConfig, "issuer" | "audience" | "jwksUri"> & {
    autoProvision?: boolean;
    roleClaim?: string;
  },
  keyResolver?: JWTVerifyGetKey,
): OidcVerifier {
  const roleClaim = config.roleClaim ?? "roles";
  // JWKS erst bei Bedarf auflösen (lazy) — so lässt sich ein Provider bauen, ohne
  // dass eine (evtl. noch nicht erreichbare) JWKS-URL sofort geparst werden muss.
  let keys = keyResolver;
  const resolveKeys = (): JWTVerifyGetKey => {
    keys ??= createRemoteJWKSet(new URL(config.jwksUri));
    return keys;
  };
  return {
    autoProvision: config.autoProvision ?? false,
    async verify(idToken: string, expectedNonce?: string): Promise<OidcClaims> {
      const { payload } = await jwtVerify(idToken, resolveKeys(), {
        issuer: config.issuer,
        audience: config.audience,
      });
      // Replay-Schutz: nonce muss exakt dem beim Start gesetzten Wert entsprechen.
      if (expectedNonce !== undefined && payload.nonce !== expectedNonce) {
        throw new Error("OIDC-nonce stimmt nicht überein.");
      }
      const email = typeof payload.email === "string" ? payload.email : "";
      if (!email) {
        throw new Error("OIDC-Token enthält keine E-Mail.");
      }
      const name = typeof payload.name === "string" ? payload.name : email;
      return {
        sub: String(payload.sub ?? ""),
        email,
        name,
        roles: parseRolesClaim(payload[roleClaim]),
      };
    },
  };
}

// --- Token-Tausch (injizierbar für Tests) ----------------------------------

// Tauscht den Authorization Code (mit PKCE-Verifier) am Token-Endpoint gegen das id_token.
export type TokenExchanger = (input: { code: string; codeVerifier: string }) => Promise<string>;

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function createTokenExchanger(config: OidcConfig, fetchImpl?: FetchLike): TokenExchanger {
  const doFetch = (fetchImpl ?? (globalThis.fetch as unknown as FetchLike)) as FetchLike;
  return async ({ code, codeVerifier }) => {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      code_verifier: codeVerifier,
    });
    if (config.clientSecret) {
      params.set("client_secret", config.clientSecret);
    }
    const res = await doFetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: params.toString(),
    });
    if (!res.ok) {
      throw new Error(`Token-Endpoint antwortete mit ${res.status}.`);
    }
    const data = (await res.json()) as { id_token?: unknown };
    if (typeof data.id_token !== "string") {
      throw new Error("Token-Antwort enthält kein id_token.");
    }
    return data.id_token;
  };
}

// --- Provider (bündelt Config + Verifier + Tausch + Mapping) ----------------

export interface AuthorizeParams {
  state: string;
  nonce: string;
  codeChallenge: string;
}

export interface OidcProvider {
  readonly autoProvision: boolean;
  readonly config: OidcConfig;
  authorizeUrl(p: AuthorizeParams): string;
  exchange(code: string, codeVerifier: string): Promise<string>;
  verify(idToken: string, expectedNonce: string): Promise<OidcClaims>;
  mapRole(claims: OidcClaims): Role;
}

export interface OidcProviderDeps {
  keyResolver?: JWTVerifyGetKey;
  tokenExchanger?: TokenExchanger;
  fetchImpl?: FetchLike;
}

export function createOidcProvider(config: OidcConfig, deps: OidcProviderDeps = {}): OidcProvider {
  const verifier = createOidcVerifier(
    {
      issuer: config.issuer,
      audience: config.audience,
      jwksUri: config.jwksUri,
      autoProvision: config.autoProvision ?? false,
      roleClaim: config.roles.roleClaim,
    },
    deps.keyResolver,
  );
  const exchanger = deps.tokenExchanger ?? createTokenExchanger(config, deps.fetchImpl);
  return {
    autoProvision: config.autoProvision ?? false,
    config,
    authorizeUrl({ state, nonce, codeChallenge }): string {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: "openid email profile",
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      const sep = config.authorizeUrl.includes("?") ? "&" : "?";
      return `${config.authorizeUrl}${sep}${params.toString()}`;
    },
    exchange: (code, codeVerifier) => exchanger({ code, codeVerifier }),
    verify: (idToken, expectedNonce) => verifier.verify(idToken, expectedNonce),
    mapRole: (claims) => mapOidcRole(claims.roles, config.roles),
  };
}

// Voll konfiguriert? Nur dann ist SSO aktiv (sonst UI ehrlich deaktiviert).
export function createOidcProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
  deps: OidcProviderDeps = {},
): OidcProvider | undefined {
  const required = [
    env.OIDC_ISSUER,
    env.OIDC_AUDIENCE,
    env.OIDC_JWKS_URI,
    env.OIDC_AUTHORIZE_URL,
    env.OIDC_TOKEN_URL,
    env.OIDC_CLIENT_ID,
    env.OIDC_REDIRECT_URI,
  ];
  if (required.some((v) => !v)) {
    return undefined;
  }
  return createOidcProvider(
    {
      issuer: env.OIDC_ISSUER as string,
      audience: env.OIDC_AUDIENCE as string,
      jwksUri: env.OIDC_JWKS_URI as string,
      authorizeUrl: env.OIDC_AUTHORIZE_URL as string,
      tokenUrl: env.OIDC_TOKEN_URL as string,
      clientId: env.OIDC_CLIENT_ID as string,
      redirectUri: env.OIDC_REDIRECT_URI as string,
      clientSecret: env.OIDC_CLIENT_SECRET,
      autoProvision: env.OIDC_AUTOPROVISION === "true",
      roles: {
        roleClaim: env.OIDC_ROLE_CLAIM ?? "roles",
        adminGroup: env.OIDC_GROUP_ADMIN,
        controllerGroup: env.OIDC_GROUP_CONTROLLER,
        expertGroup: env.OIDC_GROUP_EXPERTE,
      },
    },
    deps,
  );
}
