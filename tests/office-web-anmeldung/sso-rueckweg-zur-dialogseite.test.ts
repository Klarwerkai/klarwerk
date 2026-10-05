// ================================================================================================
// AUFNAHME m365-anmeldung · R-0355-RESTFALL — NACH SSO ÜBERGIBT DER DIALOG VON SELBST
// ================================================================================================
//
// DER BEFUND (Ben, Runde 1): der SSO-Knopf der Dialogseite (`word-addin/anmeldung.html`) verliess
// die Seite, der Rücksprung des Anbieters landete in der Anwendung — dort gibt es kein
// `messageParent`, und der Mensch musste in Klara ein zweites Mal „Anmelden" drücken.
//
// DER WEG JETZT: der Dialog startet das SSO mit genau EINER Zielkennung (`?ziel=word-addin`). Der
// Server merkt sie sich in einem kurzlebigen Ablauf-Cookie wie state/nonce/verifier und nennt nach
// ERFOLGREICHEM Rückruf genau EINE feste Adresse (`weiter`). Die Anwendung schickt das Fenster
// dorthin (`ssoWeiterziel`), die Dialogseite findet die Sitzung und übergibt von selbst
// (`tests/office-web-anmeldung/dialogseite.test.ts`, Zweig „schon angemeldet").
//
// GEMESSEN, am echten Fastify-Draht mit echter Signaturprüfung (lokales JWKS, kein Netz):
//   Z1  Start aus dem Dialog setzt das Ziel-Cookie; der Rückruf nennt die Dialogseite und löscht es
//   Z2  GEGENPROBE: Start aus der Anwendung löscht ein altes Ziel-Cookie; Rückruf ohne `weiter`
//   Z3  Kein offener Rücksprung: eine fremde Zielkennung setzt nichts, `weiter` bleibt aus
//   Z4  Ein gescheiterter Rückruf nennt kein Ziel und löscht das Ziel-Cookie
//   Z5  Die Anwendung folgt nur genau dieser einen Adresse (`ssoWeiterziel`)
//   Z6  Die ausgelieferte Dialogseite startet das SSO mit genau dieser Kennung
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from "fastify";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { ssoWeiterziel } from "../../apps/web/src/lib/ssoWeiterziel";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  AuthService,
  InMemorySessionRepo,
  InMemoryUserRepo,
  authRoutes,
  createOidcProvider,
} from "../../services/auth";

const ISSUER = "https://idp.example.com";
const AUDIENCE = "klarwerk-client";
const NONCE = "nonce-fest";
const STATE = "state-fest";
const DIALOGSEITE = "/word-addin/anmeldung.html";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = await exportJWK(publicKey);
jwk.kid = "test-key";
jwk.alg = "RS256";
const JWKS = createLocalJWKSet({ keys: [jwk] });

async function idToken(): Promise<string> {
  return new SignJWT({ nonce: NONCE, sub: "sso-1", email: "sso@firma.de", email_verified: true })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("1h")
    .sign(privateKey);
}

async function baueApp(): Promise<FastifyInstance> {
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  const ausgegeben = await idToken();
  const provider = createOidcProvider(
    {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUri: "x",
      authorizeUrl: "https://idp.example.com/authorize",
      tokenUrl: "https://idp.example.com/token",
      clientId: AUDIENCE,
      redirectUri: "https://app.klarwerk.ai/sso/callback",
      autoProvision: true,
      roles: { roleClaim: "roles", adminGroup: "kw-admin", controllerGroup: "kw-ctrl" },
    },
    { keyResolver: JWKS, tokenExchanger: async () => ausgegeben },
  );
  const app = Fastify();
  await app.register(authRoutes(service, { oidc: provider }));
  await app.ready();
  return app;
}

function gesetzt(antwort: LightMyRequestResponse): string[] {
  const roh = antwort.headers["set-cookie"];
  return Array.isArray(roh) ? roh : roh ? [roh] : [];
}

function zielCookie(antwort: LightMyRequestResponse): string | undefined {
  return gesetzt(antwort).find((c) => c.startsWith("kw_oidc_ziel="));
}

function rueckruf(
  app: FastifyInstance,
  zielWert: string | null,
  state = STATE,
): Promise<LightMyRequestResponse> {
  const ziel = zielWert === null ? "" : `; kw_oidc_ziel=${zielWert}`;
  return app.inject({
    method: "POST",
    url: "/api/auth/oidc",
    headers: {
      cookie: `kw_oidc_state=${STATE}; kw_oidc_nonce=${NONCE}; kw_oidc_verifier=v${ziel}`,
    },
    payload: { code: "der-code", state },
  });
}

describe("Aufnahme m365-anmeldung · SSO aus dem Word-Dialog springt auf die Dialogseite zurück", () => {
  it("Z1 — Start aus dem Dialog merkt das Ziel; der Rückruf nennt die Dialogseite und löscht es", async () => {
    const app = await baueApp();
    const start = await app.inject({ method: "GET", url: "/api/auth/oidc/start?ziel=word-addin" });
    expect(start.statusCode).toBe(302);
    const ziel = zielCookie(start) ?? "";
    expect(ziel).toMatch(/^kw_oidc_ziel=word-addin;/);
    expect(ziel).toContain("HttpOnly");
    expect(ziel).toContain("SameSite=Lax");
    expect(ziel).toContain("Max-Age=600");

    const zurueck = await rueckruf(app, "word-addin");
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    expect(zurueck.json().weiter).toBe(DIALOGSEITE);
    expect(zielCookie(zurueck)).toMatch(/^kw_oidc_ziel=;.*Max-Age=0/);
    // Die Sitzung entsteht wie immer als Cookie — genau das findet die Dialogseite danach.
    expect(gesetzt(zurueck).some((c) => c.startsWith("kw_session="))).toBe(true);
  });

  it("Z2 — GEGENPROBE: Start aus der Anwendung löscht ein altes Ziel; Rückruf ohne weiter", async () => {
    const app = await baueApp();
    const start = await app.inject({ method: "GET", url: "/api/auth/oidc/start" });
    expect(zielCookie(start)).toMatch(/^kw_oidc_ziel=;.*Max-Age=0/);
    const zurueck = await rueckruf(app, null);
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    expect(zurueck.json()).not.toHaveProperty("weiter");
  });

  it("Z3 — kein offener Rücksprung: fremde Kennungen setzen nichts, weiter bleibt aus", async () => {
    const app = await baueApp();
    for (const fremd of [
      "https://evil.example/x",
      "/word-addin/anmeldung.html",
      "WORD-ADDIN",
      "",
    ]) {
      const start = await app.inject({
        method: "GET",
        url: `/api/auth/oidc/start?ziel=${encodeURIComponent(fremd)}`,
      });
      expect(zielCookie(start), fremd).toMatch(/^kw_oidc_ziel=;.*Max-Age=0/);
    }
    // Auch ein von Hand gesetztes fremdes Cookie lenkt nirgendwohin.
    const zurueck = await rueckruf(app, "https%3A%2F%2Fevil.example");
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    expect(zurueck.json()).not.toHaveProperty("weiter");
  });

  it("Z4 — ein gescheiterter Rückruf nennt kein Ziel und löscht das Ziel-Cookie", async () => {
    const app = await baueApp();
    const zurueck = await rueckruf(app, "word-addin", "anderer-state");
    expect(zurueck.statusCode).toBe(400);
    expect(zurueck.json()).not.toHaveProperty("weiter");
    expect(zielCookie(zurueck)).toMatch(/^kw_oidc_ziel=;.*Max-Age=0/);
  });

  it("Z5 — die Anwendung folgt nur genau dieser einen Adresse", () => {
    expect(ssoWeiterziel(DIALOGSEITE)).toBe(DIALOGSEITE);
    for (const anders of [
      undefined,
      null,
      "",
      "https://evil.example/word-addin/anmeldung.html",
      "//evil.example/word-addin/anmeldung.html",
      "/word-addin/anmeldung.html?x=1",
      "/word-addin/taskpane.html",
      42,
    ]) {
      expect(ssoWeiterziel(anders), String(anders)).toBe("/");
    }
  });

  it("Z6 — die ausgelieferte Dialogseite startet das SSO mit genau dieser Kennung", () => {
    const seite = readFileSync(
      resolve(__dirname, "..", "..", "apps", "web", "public", "word-addin", "anmeldung.html"),
      "utf8",
    );
    const starts = seite.match(/\/api\/auth\/oidc\/start[^"']*/g) ?? [];
    expect(starts).toEqual(["/api/auth/oidc/start?ziel=word-addin"]);
  });
});
