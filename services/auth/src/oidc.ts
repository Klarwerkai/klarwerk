import { type JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from "jose";

// FR-AUTH-07: generisches OIDC. Verifiziert ein ID-Token gegen den IdP (Issuer + Audience +
// JWKS). Anbieteragnostisch: funktioniert mit Azure AD/Entra, Auth0, Keycloak, Google …
export interface OidcConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
  autoProvision?: boolean;
}

export interface OidcClaims {
  sub: string;
  email: string;
  name: string;
}

export interface OidcVerifier {
  readonly autoProvision: boolean;
  verify(idToken: string): Promise<OidcClaims>;
}

// keyResolver ist injizierbar → in Tests ohne Netz prüfbar (lokales JWKS).
export function createOidcVerifier(
  config: OidcConfig,
  keyResolver?: JWTVerifyGetKey,
): OidcVerifier {
  const keys = keyResolver ?? createRemoteJWKSet(new URL(config.jwksUri));
  return {
    autoProvision: config.autoProvision ?? false,
    async verify(idToken: string): Promise<OidcClaims> {
      const { payload } = await jwtVerify(idToken, keys, {
        issuer: config.issuer,
        audience: config.audience,
      });
      const email = typeof payload.email === "string" ? payload.email : "";
      if (!email) {
        throw new Error("OIDC-Token enthält keine E-Mail.");
      }
      const name = typeof payload.name === "string" ? payload.name : email;
      return { sub: String(payload.sub ?? ""), email, name };
    },
  };
}

export function createOidcVerifierFromEnv(
  env: Record<string, string | undefined> = process.env,
): OidcVerifier | undefined {
  if (!env.OIDC_ISSUER || !env.OIDC_AUDIENCE || !env.OIDC_JWKS_URI) {
    return undefined;
  }
  return createOidcVerifier({
    issuer: env.OIDC_ISSUER,
    audience: env.OIDC_AUDIENCE,
    jwksUri: env.OIDC_JWKS_URI,
    autoProvision: env.OIDC_AUTOPROVISION === "true",
  });
}
