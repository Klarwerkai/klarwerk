// ================================================================================================
// AUFNAHME gesamt-sso · R-0541 — DIE ANMELDUNG MIT PASSWORT LÄSST SICH GANZ ABSCHALTEN.
// ================================================================================================
//
// DER ZIELZUSTAND (Originalpunkt R-0541): „Ein Schalter erlaubt es, die Anmeldung mit Passwort ganz
// abzuschalten, sodass nur noch der Firmen-Login gilt und damit dessen Zwei-Faktor-Schutz."
//
// DER SCHALTER ist `KLARWERK_SSO_ONLY` (=1/true), gelesen von `passwordLoginEnabled` in
// `services/auth/src/routes.ts`. Gemessen wird am echten Auth-Draht (`app.inject`):
//   P1  die Schalterregel selbst — nur ein ausdrückliches 1/true, UNABHÄNGIG vom Firmen-Login.
//   P2  EN/NL: alle vier Passwortwege antworten 403 mit dem Satz der Sprache (Katalogwächter H4).
//   P3  DE und die Wirkung: kein Konto entsteht, keine Sitzung, keine Reset-Mail.
//   P4  der Firmen-Login bleibt offen: Status meldet „nur SSO", Start und Rücklauf gehen durch.
//   P5  GEGENPROBE ohne Schalter: die Passwortanmeldung läuft wie bisher.
//   P6  BEN-BEFUND (Nacharbeit 2) an der echten Kompositionswurzel: Schalter an, KEIN Firmen-Login
//       eingerichtet — das Passwort bleibt TROTZDEM gesperrt, und der Startbericht nennt, was fehlt.
//       (Bis Nacharbeit 1 hielt dieser Fall das Gegenteil fest: offenes Passwort. Das widersprach
//       R-0541 „nur noch der Firmen-Login" und ist berichtigt.)
//   P7  EN/NL: ohne eingerichteten Firmen-Login sagt die 403 genau das (`SSO_ONLY_NOT_CONFIGURED`).
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { startbericht } from "../../services/app/src/start-vertrag";
import type { OidcConfig, OidcProvider } from "../../services/auth/src/oidc";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes, passwordLoginEnabled, ssoOnlyRequested } from "../../services/auth/src/routes";
import { AuthService } from "../../services/auth/src/service";
import type { Mailer } from "../../services/notifications";

const OIDC_CONFIG: OidcConfig = {
  issuer: "https://idp.example.test",
  audience: "klarwerk-client",
  jwksUri: "https://idp.example.test/jwks",
  authorizeUrl: "https://idp.example.test/authorize",
  tokenUrl: "https://idp.example.test/token",
  clientId: "klarwerk-client",
  redirectUri: "https://app.klarwerk.test/sso/callback",
  roles: { roleClaim: "roles", adminGroup: "kw-admin" },
};

/** Ein Anbieter, der ohne Netz antwortet: Tausch und Prüfung liefern sofort eine Identität. */
const ANBIETER: OidcProvider = {
  autoProvision: true,
  config: OIDC_CONFIG,
  authorizeUrl: () => "https://idp.example.test/authorize",
  exchange: () => Promise.resolve("id-token"),
  verify: () =>
    Promise.resolve({
      sub: "sso-subjekt-r0541",
      email: "sso@firma.test",
      name: "SSO-Nutzerin",
      roles: [],
      iss: OIDC_CONFIG.issuer,
      rolesClaimPresent: false,
    }),
  mapRole: () => "viewer",
};

const ADMIN = { name: "Erste Admin", email: "admin@firma.test", password: "geheim12345" };

async function buehne(mitSso: boolean) {
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
  });
  // Ein echtes Passwortkonto, damit ein 403 nicht mit „falsches Passwort" verwechselt werden kann.
  await service.register(ADMIN);
  const mails: string[] = [];
  const mailer: Mailer = {
    send: async (nachricht) => {
      mails.push(nachricht.to);
    },
  };
  const app = Fastify();
  app.register(authRoutes(service, mitSso ? { oidc: ANBIETER, mailer } : { mailer }));
  return { app, service, mails };
}

const PASSWORTWEGE = [
  {
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  },
  {
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Neue Person", email: "neu@firma.test", password: "geheim12345" },
  },
  { method: "POST", url: "/api/auth/forgot", payload: { email: ADMIN.email } },
  {
    method: "POST",
    url: "/api/auth/reset",
    payload: { token: "beliebig", newPassword: "geheim12345" },
  },
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("R-0541 · nur noch Firmen-Login", () => {
  it("P1 der Schalter: nur ein ausdrückliches 1/true — und dann gilt er immer", () => {
    expect(ssoOnlyRequested({ KLARWERK_SSO_ONLY: "1" })).toBe(true);
    expect(ssoOnlyRequested({ KLARWERK_SSO_ONLY: "true" })).toBe(true);
    for (const wert of [undefined, "", "0", "false", "ja", "TRUE"]) {
      expect(ssoOnlyRequested({ KLARWERK_SSO_ONLY: wert }), String(wert)).toBe(false);
      expect(passwordLoginEnabled({ KLARWERK_SSO_ONLY: wert }), String(wert)).toBe(true);
    }
    // Die Sperre hängt an keinem zweiten Wert — auch kein fehlender Firmen-Login öffnet sie.
    expect(passwordLoginEnabled({ KLARWERK_SSO_ONLY: "1" })).toBe(false);
    expect(passwordLoginEnabled({ KLARWERK_SSO_ONLY: "true", OIDC_ISSUER: "" })).toBe(false);
  });

  it.each([
    [
      "en",
      "Password sign-in is switched off on this instance. Please sign in with your company login (SSO).",
    ],
    [
      "nl",
      "Aanmelden met een wachtwoord is op deze instantie uitgeschakeld. Meld je aan via de bedrijfslogin (SSO).",
    ],
  ] as const)(
    "P2 PASSWORD_LOGIN_DISABLED · alle vier Passwortwege antworten 403 auf %s",
    async (sprache, satz) => {
      vi.stubEnv("KLARWERK_SSO_ONLY", "1");
      const { app } = await buehne(true);
      try {
        for (const weg of PASSWORTWEGE) {
          const res = await app.inject({ ...weg, headers: { "accept-language": sprache } });
          expect(res.statusCode, weg.url).toBe(403);
          expect(res.json().error, weg.url).toBe("PASSWORD_LOGIN_DISABLED");
          expect(res.json().message, weg.url).toBe(satz);
        }
      } finally {
        await app.close();
      }
    },
  );

  it("P3 auf Deutsch, und die Wirkung: kein Konto, keine Sitzung, keine Reset-Mail", async () => {
    vi.stubEnv("KLARWERK_SSO_ONLY", "1");
    const { app, service, mails } = await buehne(true);
    try {
      for (const weg of PASSWORTWEGE) {
        const res = await app.inject({ ...weg });
        expect(res.statusCode, weg.url).toBe(403);
        expect(res.json().message, weg.url).toBe(
          "Die Anmeldung mit Passwort ist auf dieser Instanz abgeschaltet. Bitte über den Firmen-Login (SSO) anmelden.",
        );
        expect(res.headers["set-cookie"], `${weg.url} setzt eine Sitzung`).toBeUndefined();
      }
      expect((await service.listUsers()).map((u) => u.email)).toEqual([ADMIN.email]);
      expect(mails).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it("P4 der Firmen-Login bleibt offen: Status sagt es, Start und Rücklauf gehen durch", async () => {
    vi.stubEnv("KLARWERK_SSO_ONLY", "1");
    const { app } = await buehne(true);
    try {
      const status = await app.inject({ method: "GET", url: "/api/auth/status" });
      expect(status.json()).toMatchObject({ oidcEnabled: true, passwordLoginEnabled: false });

      const start = await app.inject({ method: "GET", url: "/api/auth/oidc/start" });
      expect(start.statusCode).toBe(302);
      const gesetzt = start.headers["set-cookie"];
      const paare = (Array.isArray(gesetzt) ? gesetzt : [gesetzt ?? ""]).map(
        (c) => c.split(";")[0] ?? "",
      );
      const state = paare.find((p) => p.startsWith("kw_oidc_state="))?.split("=")[1] ?? "";
      const ruecklauf = await app.inject({
        method: "POST",
        url: "/api/auth/oidc",
        headers: { cookie: paare.join("; ") },
        payload: { code: "code-vom-idp", state },
      });
      expect(ruecklauf.statusCode, ruecklauf.body).toBe(200);
      expect(ruecklauf.json().user.email).toBe("sso@firma.test");
    } finally {
      await app.close();
    }
  });

  it("P5 Gegenprobe: ohne Schalter läuft die Passwortanmeldung wie bisher", async () => {
    const { app } = await buehne(true);
    try {
      const status = await app.inject({ method: "GET", url: "/api/auth/status" });
      expect(status.json()).toMatchObject({ oidcEnabled: true, passwordLoginEnabled: true });
      const res = await app.inject({ ...PASSWORTWEGE[0] });
      expect(res.statusCode, res.body).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("P6 Schalter an, kein Firmen-Login eingerichtet: das Passwort bleibt GESPERRT und der Startbericht sagt, was fehlt", async () => {
    vi.stubEnv("KLARWERK_SSO_ONLY", "1");
    // Die echte Kompositionswurzel: ohne OIDC_*- und SAML_*-Werte gibt es keinen Firmen-Login.
    const app = buildApp(buildServices());
    try {
      const status = await app.inject({ method: "GET", url: "/api/auth/status" });
      expect(status.json()).toMatchObject({
        oidcEnabled: false,
        samlEnabled: false,
        passwordLoginEnabled: false,
      });
      // Die Ersteinrichtung einer Instanz OHNE Konto bleibt der eine Weg (dokumentierte Ausnahme).
      const setup = await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
      expect(setup.statusCode, setup.body).toBe(201);
      // Danach gilt die Sperre — auch für genau dieses Konto.
      const login = await app.inject({ ...PASSWORTWEGE[0] });
      expect(login.statusCode, login.body).toBe(403);
      expect(login.json()).toMatchObject({ error: "PASSWORD_LOGIN_DISABLED" });
      expect(login.json().message).toBe(
        "Die Anmeldung mit Passwort ist abgeschaltet, der Firmen-Login ist aber noch nicht eingerichtet. Bitte die IT bitten, die Anbieterwerte zu ergänzen.",
      );
    } finally {
      await app.close();
    }
    const halb = startbericht({ KLARWERK_SSO_ONLY: "1" }, { art: "leer" });
    const mangel = halb.maengel.find((m) => m.betrifft.includes("KLARWERK_SSO_ONLY"));
    expect(mangel?.befund).toContain("GESPERRT");
    expect(mangel?.betrifft).toContain("OIDC_TOKEN_URL");
    // Gegenprobe: mit vollständigem SSO gibt es diesen Mangel nicht.
    const voll: Record<string, string> = { KLARWERK_SSO_ONLY: "1" };
    for (const name of [
      "OIDC_ISSUER",
      "OIDC_AUDIENCE",
      "OIDC_JWKS_URI",
      "OIDC_AUTHORIZE_URL",
      "OIDC_TOKEN_URL",
      "OIDC_CLIENT_ID",
      "OIDC_REDIRECT_URI",
    ]) {
      voll[name] = "gesetzt";
    }
    const ganz = startbericht(voll, { art: "leer" });
    expect(ganz.maengel.some((m) => m.betrifft.includes("KLARWERK_SSO_ONLY"))).toBe(false);
  });

  it.each([
    [
      "en",
      "Password sign-in is switched off, but the company login has not been set up yet. Please ask your IT team to add the provider settings.",
    ],
    [
      "nl",
      "Aanmelden met een wachtwoord is uitgeschakeld, maar de bedrijfslogin is nog niet ingericht. Vraag je IT-afdeling de gegevens van de aanbieder aan te vullen.",
    ],
  ] as const)(
    "P7 SSO_ONLY_NOT_CONFIGURED · ohne Firmen-Login bleiben alle vier Passwortwege gesperrt auf %s",
    async (sprache, satz) => {
      vi.stubEnv("KLARWERK_SSO_ONLY", "1");
      const { app, service } = await buehne(false);
      try {
        for (const weg of PASSWORTWEGE) {
          const res = await app.inject({ ...weg, headers: { "accept-language": sprache } });
          expect(res.statusCode, weg.url).toBe(403);
          expect(res.json().error, weg.url).toBe("PASSWORD_LOGIN_DISABLED");
          expect(res.json().message, weg.url).toBe(satz);
        }
        expect((await service.listUsers()).map((u) => u.email)).toEqual([ADMIN.email]);
      } finally {
        await app.close();
      }
    },
  );
});
