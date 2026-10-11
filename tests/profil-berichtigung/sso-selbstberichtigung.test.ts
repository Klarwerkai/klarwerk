// ================================================================================================
// R-0582 (DS13) · BEN-BEFUND NACHARBEIT 3 — AUCH EIN REINES SSO-KONTO BERICHTIGT SEINE E-MAIL SELBST.
// ================================================================================================
//
// DER BEFUND: Jede Adressänderung verlangte ein lokales Passwort; ein über SSO angelegtes Konto hat
// keins (`loginWithOidc`, leerer Hash). „Jeder kann seine Kontodaten im Profil selbst berichtigen"
// war für diese Konten nicht erfüllt — der Admin ist keine Selbstberichtigung.
//
// DER WEG JETZT: die Identitätsbestätigung ist eine erneute Anmeldung beim eigenen Anbieter
// (`/api/auth/oidc/start?ziel=profil`). Der Rückruf bindet die Bestätigung an GENAU die Sitzung, die
// er ausgibt, für fünf Minuten und für EINE gelungene Adressänderung, und nennt als Rücksprung die
// eine feste Adresse `/profil?kontodaten=sso`.
//
// GEMESSEN, am echten Fastify-Draht mit echter Signaturprüfung (lokales JWKS, kein Netz):
//   P1  Ohne Bestätigung: 403 mit dem eigenen Satz, Adresse unverändert (der Name geht trotzdem)
//   P2  Mit Bestätigung: Start setzt das Ziel, Rückruf nennt das Profil, die neue Adresse gilt,
//       das Prüfprotokoll vermerkt sie, und die nächste SSO-Anmeldung findet DASSELBE Konto
//   P3  Einmalig: eine zweite Adressänderung mit derselben Sitzung braucht eine neue Bestätigung
//   P4  Sitzungsgebunden: eine andere Sitzung desselben Kontos erbt die Bestätigung nicht; eine
//       gewöhnliche SSO-Anmeldung ohne `ziel=profil` bestätigt nichts
//   P5  Befristet: nach fünf Minuten gilt die Bestätigung nicht mehr
//   P6  Die Anwendung folgt nur den festen Rücksprüngen (`ssoWeiterziel`)
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from "fastify";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
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
const ALT = "sso@firma.de";
const NEU = "sso.neu@firma.de";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = await exportJWK(publicKey);
jwk.kid = "test-key";
jwk.alg = "RS256";
const JWKS = createLocalJWKSet({ keys: [jwk] });

/** Wen der Anbieter beim NÄCHSTEN Rückruf anmeldet — P7 wechselt das Konto beim Anbieter. */
let anbieterKonto = { sub: "sso-1", email: ALT, name: "Sina Sso" };

async function idToken(): Promise<string> {
  return new SignJWT({
    nonce: NONCE,
    sub: anbieterKonto.sub,
    email: anbieterKonto.email,
    email_verified: true,
    name: anbieterKonto.name,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("1h")
    .sign(privateKey);
}

interface Buehne {
  app: FastifyInstance;
  audit: AuditService;
}

async function baueApp(): Promise<Buehne> {
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
    audit,
  });
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
    { keyResolver: JWKS, tokenExchanger: () => idToken() },
  );
  const app = Fastify();
  await app.register(authRoutes(service, { oidc: provider }));
  await app.ready();
  return { app, audit };
}

function zielCookie(antwort: LightMyRequestResponse): string | undefined {
  const roh = antwort.headers["set-cookie"];
  const liste = Array.isArray(roh) ? roh : roh ? [roh] : [];
  return liste.find((c) => c.startsWith("kw_oidc_ziel="));
}

/**
 * Ein SSO-Rückruf; `ziel` wie vom Start gesetzt (oder keins). `ausgang` ist die Sitzung, aus der
 * das Profil die Bestätigung gestartet hat — der Browser schickt ihr Cookie beim Rückruf mit.
 */
async function sso(
  app: FastifyInstance,
  ziel: string | null,
  ausgang?: string,
): Promise<{ antwort: LightMyRequestResponse; token: string }> {
  const zielTeil = ziel === null ? "" : `; kw_oidc_ziel=${ziel}`;
  const sitzung = ausgang === undefined ? "" : `; kw_session=${ausgang}`;
  const antwort = await app.inject({
    method: "POST",
    url: "/api/auth/oidc",
    headers: {
      cookie: `kw_oidc_state=${STATE}; kw_oidc_nonce=${NONCE}; kw_oidc_verifier=v${zielTeil}${sitzung}`,
    },
    payload: { code: "der-code", state: STATE },
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return { antwort, token: (antwort.json() as { token: string }).token };
}

function berichtige(
  app: FastifyInstance,
  token: string,
  payload: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "PUT",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

async function ich(app: FastifyInstance, token: string): Promise<{ id: string; email: string }> {
  const r = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(r.statusCode).toBe(200);
  return r.json() as { id: string; email: string };
}

afterEach(() => {
  vi.restoreAllMocks();
  anbieterKonto = { sub: "sso-1", email: ALT, name: "Sina Sso" };
});

describe("R-0582 · ein reines SSO-Konto berichtigt seine E-Mail selbst — mit SSO als Bestätigung", () => {
  it("P1 — ohne Bestätigung: 403 mit eigenem Satz, Adresse unverändert; der Name geht", async () => {
    const { app } = await baueApp();
    const { token } = await sso(app, null);
    const abgelehnt = await berichtige(app, token, { email: NEU });
    expect(abgelehnt.statusCode, abgelehnt.body).toBe(403);
    expect((abgelehnt.json() as { message: string }).message).toBe(
      "Bitte bestätige die neue E-Mail zuerst mit einer erneuten SSO-Anmeldung.",
    );
    // Auch ein mitgeschicktes „Passwort" öffnet nichts — es gibt keins.
    const geraten = await berichtige(app, token, { email: NEU, currentPassword: "" });
    expect(geraten.statusCode).toBe(403);
    expect((await ich(app, token)).email).toBe(ALT);

    const name = await berichtige(app, token, { name: "Sina Berichtigt" });
    expect(name.statusCode, name.body).toBe(200);
    expect((name.json() as { name: string }).name).toBe("Sina Berichtigt");
  });

  it("P2 — mit Bestätigung: Ziel gesetzt, Rücksprung ins Profil, neue Adresse gilt, Konto bleibt verknüpft", async () => {
    const { app, audit } = await baueApp();
    const vorher = await sso(app, null);
    const kontoId = (await ich(app, vorher.token)).id;

    const start = await app.inject({ method: "GET", url: "/api/auth/oidc/start?ziel=profil" });
    expect(start.statusCode).toBe(302);
    expect(zielCookie(start) ?? "").toMatch(/^kw_oidc_ziel=profil;.*HttpOnly/);

    const bestaetigt = await sso(app, "profil", vorher.token);
    expect((bestaetigt.antwort.json() as { weiter?: string }).weiter).toBe(
      "/profil?kontodaten=sso",
    );
    expect(zielCookie(bestaetigt.antwort)).toMatch(/^kw_oidc_ziel=;.*Max-Age=0/);

    const r = await berichtige(app, bestaetigt.token, { email: NEU });
    expect(r.statusCode, r.body).toBe(200);
    expect((await ich(app, bestaetigt.token)).email).toBe(NEU);

    const eintraege = (await audit.list({})) as {
      action: string;
      target: string;
      payload?: Record<string, unknown>;
    }[];
    const vermerk = eintraege.find((e) => e.action === "user.account-corrected");
    expect(vermerk?.target).toBe(kontoId);
    expect(vermerk?.payload).toMatchObject({ fields: ["email"], via: "self" });

    // Die nächste SSO-Anmeldung erkennt das Konto am Subjekt — nicht an der alten Adresse.
    const danach = await sso(app, null);
    const wieder = await ich(app, danach.token);
    expect(wieder.id).toBe(kontoId);
    expect(wieder.email).toBe(NEU);
  });

  it("P3 — einmalig: die zweite Adressänderung derselben Sitzung braucht eine neue Bestätigung", async () => {
    const { app } = await baueApp();
    const ausgang = await sso(app, null);
    const { token } = await sso(app, "profil", ausgang.token);
    expect((await berichtige(app, token, { email: NEU })).statusCode).toBe(200);
    const nochmal = await berichtige(app, token, { email: "dritte@firma.de" });
    expect(nochmal.statusCode).toBe(403);
    expect((await ich(app, token)).email).toBe(NEU);
  });

  it("P3b — eine abgelehnte Adresse verbraucht die Bestätigung nicht", async () => {
    const { app } = await baueApp();
    const ausgang = await sso(app, null);
    const { token } = await sso(app, "profil", ausgang.token);
    const falsch = await berichtige(app, token, { email: "kein-at" });
    expect(falsch.statusCode).toBe(400);
    expect((await berichtige(app, token, { email: NEU })).statusCode).toBe(200);
  });

  it("P4 — sitzungsgebunden, und eine gewöhnliche SSO-Anmeldung bestätigt nichts", async () => {
    const { app } = await baueApp();
    const ausgang = await sso(app, null);
    const bestaetigt = await sso(app, "profil", ausgang.token);
    const andereSitzung = await sso(app, null);
    expect(andereSitzung.token).not.toBe(bestaetigt.token);
    const fremd = await berichtige(app, andereSitzung.token, { email: NEU });
    expect(fremd.statusCode, "die Bestätigung hängt an der Sitzung des Rückrufs").toBe(403);
    expect((await ich(app, andereSitzung.token)).email).toBe(ALT);
    // Die bestätigte Sitzung kann es weiterhin.
    expect((await berichtige(app, bestaetigt.token, { email: NEU })).statusCode).toBe(200);
  });

  it("P5 — befristet: nach fünf Minuten gilt die Bestätigung nicht mehr", async () => {
    const { app } = await baueApp();
    const ausgang = await sso(app, null);
    const { token } = await sso(app, "profil", ausgang.token);
    const jetzt = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(jetzt + 5 * 60 * 1000 + 1);
    const spaet = await berichtige(app, token, { email: NEU });
    expect(spaet.statusCode, spaet.body).toBe(403);
    vi.restoreAllMocks();
    expect((await ich(app, token)).email).toBe(ALT);
  });

  it("P7 — Kontowechsel beim Anbieter: Konto B wird angemeldet, bestätigt ist NICHTS, A und B bleiben unverändert", async () => {
    const { app } = await baueApp();
    // Konto B existiert (eigenes Subjekt, eigene Adresse).
    anbieterKonto = { sub: "sso-2", email: "bea@firma.de", name: "Bea Zwei" };
    const b = await sso(app, null);
    const kontoB = await ich(app, b.token);
    // Konto A beginnt die Berichtigung im Profil …
    anbieterKonto = { sub: "sso-1", email: ALT, name: "Sina Sso" };
    const a = await sso(app, null);
    const kontoA = await ich(app, a.token);
    // … beim Anbieter meldet sich aber B an.
    anbieterKonto = { sub: "sso-2", email: "bea@firma.de", name: "Bea Zwei" };
    const rueckruf = await sso(app, "profil", a.token);
    expect((await ich(app, rueckruf.token)).id, "die neue Sitzung gehört B").toBe(kontoB.id);
    const versuch = await berichtige(app, rueckruf.token, { email: NEU });
    expect(versuch.statusCode, "keine Bestätigung für ein fremdes Ausgangskonto").toBe(403);
    expect((await ich(app, rueckruf.token)).email).toBe("bea@firma.de");
    expect((await ich(app, a.token)).email, "A ist unberührt").toBe(kontoA.email);
  });

  it("P7b — ohne Ausgangssitzung (Rückruf ohne angemeldetes Konto) entsteht keine Bestätigung", async () => {
    const { app } = await baueApp();
    await sso(app, null);
    const { token } = await sso(app, "profil");
    expect((await berichtige(app, token, { email: NEU })).statusCode).toBe(403);
  });

  it("P6 — die Anwendung folgt nur den festen Rücksprüngen", () => {
    expect(ssoWeiterziel("/profil?kontodaten=sso")).toBe("/profil?kontodaten=sso");
    expect(ssoWeiterziel("/word-addin/anmeldung.html")).toBe("/word-addin/anmeldung.html");
    for (const anders of [
      "/profil",
      "/profil?kontodaten=sso&x=1",
      "https://evil.example/profil?kontodaten=sso",
      "//evil.example/profil?kontodaten=sso",
      undefined,
      42,
    ]) {
      expect(ssoWeiterziel(anders), String(anders)).toBe("/");
    }
  });
});
