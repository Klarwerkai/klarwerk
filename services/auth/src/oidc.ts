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
  // JOB 2686 (R2-7): siehe createOidcVerifier — Vorgabe `true`, fail-closed.
  requireEmailVerified?: boolean;
  roles: OidcRoleConfig;
}

export interface OidcClaims {
  sub: string;
  email: string;
  name: string;
  roles: string[];
  // JOB 2686 (R2-7): der Aussteller. `sub` ist nur INNERHALB eines Ausstellers eindeutig — erst
  // das Paar (iss, sub) ist eine Identitaet. Kommt aus dem verifizierten Token, nicht aus der
  // Konfiguration: `jwtVerify` hat ihn bereits gegen `config.issuer` geprueft, er kann also nicht
  // abweichen — aber er steht damit auch belegt im Claim und nicht nur als Annahme daneben.
  iss: string;
  // JOB 2686 (R2-7): `undefined` heisst „der Anbieter hat den Claim nicht gesendet" — das ist NICHT
  // dasselbe wie `false`. Manche Anbieter senden ihn gar nicht; die duerfen nicht ausgesperrt
  // werden. `false` dagegen ist eine ausdrueckliche Aussage: diese Adresse ist ungeprueft.
  emailVerified?: boolean | undefined;
  // JOB 2686 (R2-8): hat der Anbieter den Rollen-Claim ueberhaupt gesendet? Ein fehlender Claim
  // und eine leere Gruppenliste sehen nach dem Parsen beide wie `[]` aus, bedeuten aber
  // Verschiedenes — „keine Auskunft" gegen „ausdruecklich keine Gruppen". Ohne diese Unterscheidung
  // koennte ein Anbieter, der den Claim vergisst, jeden still zum Betrachter herabstufen.
  rolesClaimPresent: boolean;
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
    // JOB 2686 (R2-7): Vorgabe `true` — fail-closed. Wer den Schalter nicht kennt, bekommt die
    // sichere Seite. Er ist nur fuer den Fall da, dass ein Anbieter `email_verified: false` sendet,
    // obwohl seine Adressen aus anderer Quelle verlaesslich sind; dann ist es eine bewusste,
    // dokumentierte Entscheidung des Betreibers und kein Versehen.
    requireEmailVerified?: boolean;
  },
  keyResolver?: JWTVerifyGetKey,
): OidcVerifier {
  const roleClaim = config.roleClaim ?? "roles";
  const requireEmailVerified = config.requireEmailVerified ?? true;
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
      // JOB 2686 (R2-7), PRUEFUNG 1: DAS SUBJEKT MUSS DA SEIN.
      //
      // Vorher stand hier `String(payload.sub ?? "")` — ein Token ohne `sub` ergab den leeren
      // String, und der lief als gueltige Identitaet durch. `sub` ist im OIDC-Kern ein
      // Pflichtclaim; fehlt er, ist das Token kaputt oder gebastelt, und beides ist kein Grund,
      // jemanden anzumelden.
      const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
      if (!sub) {
        throw new Error("OIDC-Token enthält kein Subjekt (sub).");
      }
      // JOB 2686 (R2-7), PRUEFUNG 2: EINE AUSDRUECKLICH UNGEPRUEFTE ADRESSE IST KEINE IDENTITAET.
      //
      // Die Unterscheidung ist der ganze Punkt: NICHT GESENDET laeuft durch (viele Anbieter
      // fuehren den Claim nicht), AUSDRUECKLICH `false` nicht. Wer im eigenen Anbieter
      // `admin@fremde-firma.de` eintraegt, ohne sie zu belegen, kommt damit nicht weiter.
      const emailVerified =
        typeof payload.email_verified === "boolean" ? payload.email_verified : undefined;
      if (requireEmailVerified && emailVerified === false) {
        throw new Error("OIDC-Token trägt eine nicht verifizierte E-Mail-Adresse.");
      }
      const name = typeof payload.name === "string" ? payload.name : email;
      return {
        sub,
        email,
        name,
        roles: parseRolesClaim(payload[roleClaim]),
        // `jwtVerify` hat den Aussteller bereits gegen `config.issuer` geprueft — beide Werte sind
        // an dieser Stelle zwangslaeufig gleich. Der Rueckfall ist nur der Typenglaettung wegen da.
        iss: typeof payload.iss === "string" ? payload.iss : config.issuer,
        emailVerified,
        rolesClaimPresent: payload[roleClaim] !== undefined,
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
      requireEmailVerified: config.requireEmailVerified ?? true,
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
      // JOB 2686 (R2-7): FAIL-CLOSED — nur ein ausdrueckliches "false" schaltet die Pruefung ab.
      // Bewusst andersherum als `OIDC_AUTOPROVISION` (dort schaltet ein ausdrueckliches "true"
      // EIN): ein Tippfehler, eine leere Variable oder eine vergessene Zeile landet hier auf der
      // sicheren Seite, dort auf der zurueckhaltenden. Beide Male gewinnt nicht der Zufall.
      requireEmailVerified: env.OIDC_REQUIRE_EMAIL_VERIFIED !== "false",
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
