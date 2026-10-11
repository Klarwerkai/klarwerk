// ================================================================================================
// AUFNAHME gesamt-sso · R-0545 / R-0868 — DER FIRMEN-LOGIN KOMMT AUF DEM EIN-BEFEHL-WEG AN.
// ================================================================================================
//
// DER BEFUND (Originalpunkte R-0545 vom 21.08., R-0868 vom 26.08.2026): der Anmeldebaustein
// verlangt sieben Pflichtwerte (`createOidcProviderFromEnv`, services/auth/src/oidc.ts), die
// mitgelieferte Aufsetzdatei `docker-compose.prod.yml` reichte drei durch. Wer alle sieben in seine
// `.env` schrieb, bekam kein SSO — und ohne Meldung.
//
// GEMESSEN WIRD DER GANZE WEG OHNE DOCKER: `.env` → Interpolation der Zeile im `environment:`-Block
// des Dienstes `app` → Umgebung der Anwendung → die echte Fabrik `createOidcProviderFromEnv` und der
// echte Startbericht. Die Namen werden aus dem QUELLTEXT erhoben, nicht hier abgeschrieben — liest
// der Code morgen einen achten Wert, wird C1 rot, bis die Compose-Datei ihn durchreicht.
//
//   C0  Kalibrierung: der alte Stand (drei Werte) wird als unvollständig erkannt.
//   C1  jeder OIDC-Wert, den der Code liest, und der Schalter KLARWERK_SSO_ONLY stehen im Block.
//   C2  sieben Werte in der `.env` → SSO ist in der Anwendung AKTIV.
//   C3  einer fehlt → SSO ist aus, und der Startbericht NENNT genau diesen Namen.
//   C4  die Leer-Falle: ohne Eintrag kommt OIDC_ROLE_CLAIM mit dem Vorgabewert des Codes an.
//   C5  ohne jeden SSO-Wert: SSO aus, kein Mangel — „gar nicht eingerichtet" ist kein Fehler.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startbericht } from "../../services/app/src/start-vertrag";
import { createOidcProviderFromEnv } from "../../services/auth/src/oidc";

const WURZEL = join(__dirname, "..", "..");
const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), "utf8");

const PFLICHT = [
  "OIDC_ISSUER",
  "OIDC_AUDIENCE",
  "OIDC_JWKS_URI",
  "OIDC_AUTHORIZE_URL",
  "OIDC_TOKEN_URL",
  "OIDC_CLIENT_ID",
  "OIDC_REDIRECT_URI",
] as const;

/** Eine `.env`, wie ein Betreiber sie nach §2.7 der Anleitung schreibt. */
const DOTENV: Record<string, string> = {
  OIDC_ISSUER: "https://login.microsoftonline.com/mandant/v2.0",
  OIDC_AUDIENCE: "klarwerk-app",
  OIDC_JWKS_URI: "https://login.microsoftonline.com/mandant/discovery/v2.0/keys",
  OIDC_AUTHORIZE_URL: "https://login.microsoftonline.com/mandant/oauth2/v2.0/authorize",
  OIDC_TOKEN_URL: "https://login.microsoftonline.com/mandant/oauth2/v2.0/token",
  OIDC_CLIENT_ID: "klarwerk-app",
  OIDC_REDIRECT_URI: "https://wissen.kunde.test/sso/callback",
  OIDC_GROUP_ADMIN: "klara-admins",
};

/** Die Zuweisungen im `environment:`-Block EINES Dienstes, Kommentarzeilen ausgenommen. */
function umgebung(inhalt: string, dienst: string): Map<string, string> {
  const treffer = new Map<string, string>();
  let imDienst = false;
  let imBlock = false;
  for (const zeile of inhalt.split("\n")) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(zeile)) {
      imDienst = zeile.trim() === `${dienst}:`;
      imBlock = false;
      continue;
    }
    if (!imDienst) {
      continue;
    }
    if (/^ {4}[A-Za-z0-9_-]+:\s*$/.test(zeile)) {
      imBlock = zeile.trim() === "environment:";
      continue;
    }
    const passt = imBlock ? /^ {6}([A-Z][A-Z0-9_]*):\s*(.*)$/.exec(zeile) : null;
    const name = passt?.[1];
    if (passt && name !== undefined) {
      treffer.set(name, (passt[2] ?? "").trim());
    }
  }
  return treffer;
}

/** Compose-Interpolation `${NAME:-x}`: fehlt NAME oder ist er leer, gilt `x`. */
function interpoliere(roh: string, dotenv: Record<string, string>): string {
  const passt = /^\$\{([A-Z][A-Z0-9_]*):-(.*)\}$/.exec(roh.replace(/^"(.*)"$/, "$1"));
  if (!passt) {
    throw new Error(`nicht als \${NAME:-vorgabe} lesbar: ${roh}`);
  }
  const wert = dotenv[passt[1] as string];
  return wert === undefined || wert === "" ? (passt[2] ?? "") : wert;
}

/** Die Umgebung der Anwendung, wie `docker compose` sie aus Block und `.env` zusammensetzt. */
function anwendungsumgebung(
  block: Map<string, string>,
  dotenv: Record<string, string>,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, roh] of block) {
    if (name.startsWith("OIDC_") || name.startsWith("SAML_") || name === "KLARWERK_SSO_ONLY") {
      env[name] = interpoliere(roh, dotenv);
    }
  }
  return env;
}

/** Jeder Umgebungsname, den die Anmeldung im Quelltext liest — erhoben, nicht abgeschrieben. */
function geleseneNamen(): string[] {
  const quellen = [
    lies("services/auth/src/oidc.ts"),
    lies("services/auth/src/saml.ts"),
    lies("services/auth/src/service.ts"),
    lies("services/auth/src/routes.ts"),
    lies("services/app/src/routes/verzeichnis-routes.ts"),
    lies("services/app/src/build-app.ts"),
  ].join("\n");
  const namen = new Set<string>();
  const muster =
    /\benv\.((?:OIDC|SAML|KLARWERK_SSO|KLARWERK_SCIM)_[A-Z_]+|KLARWERK_PRUEFZUSTAENDIGKEIT)\b/g;
  for (const treffer of quellen.matchAll(muster)) {
    namen.add(treffer[1] as string);
  }
  return [...namen].sort();
}

const BLOCK = umgebung(lies("docker-compose.prod.yml"), "app");

const SSO_MANGEL = "SSO ist unvollständig konfiguriert";

describe("R-0545 / R-0868 · der Firmen-Login auf dem Ein-Befehl-Weg", () => {
  it("C0 Kalibrierung: der alte Stand mit drei Werten kommt nicht an und wird benannt", () => {
    const alt = new Map([
      ["OIDC_ISSUER", "${OIDC_ISSUER:-}"],
      ["OIDC_AUDIENCE", "${OIDC_AUDIENCE:-}"],
      ["OIDC_JWKS_URI", "${OIDC_JWKS_URI:-}"],
      ["OIDC_AUTOPROVISION", "${OIDC_AUTOPROVISION:-false}"],
    ]);
    const env = anwendungsumgebung(alt, DOTENV);
    expect(createOidcProviderFromEnv(env)).toBeUndefined();
    const bericht = startbericht(env, { art: "leer" });
    const mangel = bericht.maengel.find((m) => m.befund.startsWith(SSO_MANGEL));
    expect(mangel?.betrifft).toEqual([
      "OIDC_AUTHORIZE_URL",
      "OIDC_TOKEN_URL",
      "OIDC_CLIENT_ID",
      "OIDC_REDIRECT_URI",
    ]);
  });

  it("C1 jeder Wert, den die Anmeldung liest, steht im environment:-Block des Dienstes app", () => {
    const gelesen = geleseneNamen();
    // Die Erhebung greift: die sieben Pflichtwerte, der Schalter, SAML und die Verzeichnispflege.
    expect(gelesen).toEqual(
      expect.arrayContaining([
        ...PFLICHT,
        "KLARWERK_SSO_ONLY",
        "SAML_IDP_CERT",
        "SAML_ACS_URL",
        "KLARWERK_SCIM_TOKEN",
        "KLARWERK_PRUEFZUSTAENDIGKEIT",
      ]),
    );
    expect(gelesen.filter((name) => !BLOCK.has(name))).toEqual([]);
  });

  it("C2 sieben Werte in der .env: SSO ist in der Anwendung aktiv, kein SSO-Mangel", () => {
    const env = anwendungsumgebung(BLOCK, DOTENV);
    const anbieter = createOidcProviderFromEnv(env);
    expect(anbieter, "SSO bleibt trotz vollständiger .env aus").toBeDefined();
    expect(anbieter?.config.redirectUri).toBe(DOTENV.OIDC_REDIRECT_URI);
    expect(anbieter?.config.roles.adminGroup).toBe("klara-admins");
    const bericht = startbericht(env, { art: "leer" });
    expect(bericht.maengel.some((m) => m.befund.startsWith(SSO_MANGEL))).toBe(false);
  });

  it.each(PFLICHT)("C3 fehlt %s: SSO aus, der Startbericht nennt genau ihn", (fehlt) => {
    const ohne = Object.fromEntries(Object.entries(DOTENV).filter(([name]) => name !== fehlt));
    const env = anwendungsumgebung(BLOCK, ohne);
    expect(createOidcProviderFromEnv(env)).toBeUndefined();
    const bericht = startbericht(env, { art: "leer" });
    const mangel = bericht.maengel.find((m) => m.befund.startsWith(SSO_MANGEL));
    expect(mangel?.betrifft).toEqual([fehlt]);
  });

  it("C4 die Leer-Falle: ohne Eintrag kommt OIDC_ROLE_CLAIM mit dem Vorgabewert des Codes an", () => {
    const env = anwendungsumgebung(BLOCK, DOTENV);
    // Der Code liest `env.OIDC_ROLE_CLAIM ?? "roles"` — ein leerer String fiele daran vorbei.
    expect(lies("services/auth/src/oidc.ts")).toContain('env.OIDC_ROLE_CLAIM ?? "roles"');
    expect(env.OIDC_ROLE_CLAIM).toBe("roles");
    expect(createOidcProviderFromEnv(env)?.config.roles.roleClaim).toBe("roles");
    // Ohne Eintrag bleibt auch der Passwortweg, wie er war.
    expect(env.KLARWERK_SSO_ONLY).toBe("");
  });

  it("C5 ohne jeden SSO-Wert: SSO aus und KEIN Mangel — nicht eingerichtet ist kein Fehler", () => {
    const env = anwendungsumgebung(BLOCK, {});
    expect(createOidcProviderFromEnv(env)).toBeUndefined();
    const bericht = startbericht(env, { art: "leer" });
    expect(bericht.maengel.some((m) => m.befund.startsWith(SSO_MANGEL))).toBe(false);
  });
});
