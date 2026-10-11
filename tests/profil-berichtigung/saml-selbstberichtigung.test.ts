// ================================================================================================
// R-0582 · INTEGRATION NACHARBEIT 7 — AUCH EIN REINES SAML-KONTO BERICHTIGT SEINE E-MAIL SELBST.
// ================================================================================================
//
// Mit dem Hauptstand kam der SAML-Firmen-Login (R-0560). Er legt Konten über denselben
// `loginWithOidc` an wie OIDC — ohne Passwort. Die Profilbestätigung kannte bis hierher nur den
// OIDC-Weg; auf einer Instanz mit nur SAML hätte ein solches Konto seine Adresse wieder nicht
// selbst berichtigen können (Bens Befund aus Nacharbeit 3, durch die Integration erneut offen).
//
// DER WEG: `/api/auth/saml/start?ziel=profil` → RelayState `profil` → `/api/auth/saml/abschluss`.
// Dort gilt dieselbe Regel wie beim OIDC-Rückruf: bestätigt wird nur, wenn der Anbieter DASSELBE
// Konto anmeldet, aus dessen Sitzung die Bestätigung gestartet wurde; Rücksprung fest nach
// `/profil?kontodaten=sso`. Die SAML-Antworten sind echt signiert und laufen durch die
// vollständige Prüfung (`services/auth/src/saml.ts`), wie in `tests/firmenanmeldung/`.
//
//   Q1  ohne Bestätigung: 403 SSO_CONFIRMATION_REQUIRED, Adresse unverändert
//   Q2  mit Bestätigung über SAML: Rücksprung ins Profil, neue Adresse gilt, einmalig
//   Q3  Kontowechsel beim Anbieter: B wird angemeldet, bestätigt ist nichts, B unverändert
//   Q4  RelayState `profil` ohne Ausgangssitzung bestätigt nichts; fremde Ziele bleiben aus
import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes } from "../../services/auth/src/routes";
import { type SamlKonfig, createSamlProvider } from "../../services/auth/src/saml";
import { AuthService } from "../../services/auth/src/service";

const NS_A = "urn:oasis:names:tc:SAML:2.0:assertion";
const NS_P = "urn:oasis:names:tc:SAML:2.0:protocol";
const NS_DS = "http://www.w3.org/2000/09/xmldsig#";
const EXC = "http://www.w3.org/2001/10/xml-exc-c14n#";
const IDP = "https://idp.firma.test/saml";
const SP = "https://klara.firma.test/saml";
const ACS = "https://klara.firma.test/api/auth/saml/acs";
const ATTR_EMAIL = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress";
const ATTR_GRUPPEN = "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups";
const ANBIETER = generateKeyPairSync("rsa", { modulusLength: 2048 });

const KONTO_A = { nameId: "subjekt-a", email: "anna@firma.test" };
const KONTO_B = { nameId: "subjekt-b", email: "bea@firma.test" };
const NEU = "anna.neu@firma.test";

function konfig(): SamlKonfig {
  return {
    idpEntityId: IDP,
    idpSsoUrl: "https://idp.firma.test/sso",
    idpSchluessel: ANBIETER.publicKey,
    spEntityId: SP,
    acsUrl: ACS,
    autoProvision: true,
    attributEmail: ATTR_EMAIL,
    attributName: "http://schemas.microsoft.com/identity/claims/displayname",
    attributGruppen: ATTR_GRUPPEN,
    rollen: { adminGroup: "klara-admins" },
  };
}

function zeit(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

let laufendeNummer = 0;

/** Eine echt signierte SAML-Antwort (Aufbau wie `tests/firmenanmeldung/saml-anmeldung.test.ts`). */
function antwort(inResponseTo: string, konto: typeof KONTO_A, jetzt: number): string {
  laufendeNummer += 1;
  const assertionId = `_assertion-q-${laufendeNummer}`;
  const kopf = (mitNs: boolean) =>
    `<saml:Assertion${mitNs ? ` xmlns:saml="${NS_A}"` : ""} ID="${assertionId}" IssueInstant="${zeit(jetzt)}" Version="2.0">`;
  const issuer = `<saml:Issuer>${IDP}</saml:Issuer>`;
  const rest = [
    "<saml:Subject>",
    `<saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">${konto.nameId}</saml:NameID>`,
    '<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">',
    `<saml:SubjectConfirmationData InResponseTo="${inResponseTo}" NotOnOrAfter="${zeit(jetzt + 300_000)}" Recipient="${ACS}"></saml:SubjectConfirmationData>`,
    "</saml:SubjectConfirmation></saml:Subject>",
    `<saml:Conditions NotBefore="${zeit(jetzt - 60_000)}" NotOnOrAfter="${zeit(jetzt + 300_000)}">`,
    `<saml:AudienceRestriction><saml:Audience>${SP}</saml:Audience></saml:AudienceRestriction>`,
    "</saml:Conditions><saml:AttributeStatement>",
    `<saml:Attribute Name="${ATTR_EMAIL}"><saml:AttributeValue>${konto.email}</saml:AttributeValue></saml:Attribute>`,
    `<saml:Attribute Name="${ATTR_GRUPPEN}"><saml:AttributeValue>klara-team</saml:AttributeValue></saml:Attribute>`,
    "</saml:AttributeStatement></saml:Assertion>",
  ].join("");
  const kanonisch = kopf(true) + issuer + rest;
  const digest = createHash("sha256").update(kanonisch, "utf8").digest("base64");
  const signedInfo = [
    `<ds:SignedInfo xmlns:ds="${NS_DS}">`,
    `<ds:CanonicalizationMethod Algorithm="${EXC}"></ds:CanonicalizationMethod>`,
    '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></ds:SignatureMethod>',
    `<ds:Reference URI="#${assertionId}"><ds:Transforms>`,
    '<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></ds:Transform>',
    `<ds:Transform Algorithm="${EXC}"></ds:Transform></ds:Transforms>`,
    '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>',
    `<ds:DigestValue>${digest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`,
  ].join("");
  const wert = createSign("RSA-SHA256")
    .update(signedInfo, "utf8")
    .sign(ANBIETER.privateKey, "base64");
  const signatur = `<ds:Signature xmlns:ds="${NS_DS}">${signedInfo}<ds:SignatureValue>${wert}</ds:SignatureValue></ds:Signature>`;
  return [
    `<samlp:Response xmlns:samlp="${NS_P}" xmlns:saml="${NS_A}" Destination="${ACS}" ID="_antwort-${laufendeNummer}" InResponseTo="${inResponseTo}" IssueInstant="${zeit(jetzt)}" Version="2.0">`,
    `<saml:Issuer>${IDP}</saml:Issuer>`,
    '<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>',
    kopf(false),
    issuer,
    signatur,
    rest,
    "</samlp:Response>",
  ].join("");
}

async function baueApp(): Promise<{ app: FastifyInstance; jetzt: number }> {
  const jetzt = Date.now();
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
  });
  // Ein Passwortkonto als Bestand — die SAML-Konten entstehen danach ohne Passwort.
  await service.register({
    name: "Erste Admin",
    email: "admin@firma.test",
    password: "geheim12345",
  });
  const saml = createSamlProvider(konfig(), { now: () => jetzt });
  const app = Fastify();
  app.register(authRoutes(service, { saml }));
  await app.ready();
  return { app, jetzt };
}

/**
 * Ein vollständiger SAML-Durchlauf im selben Browser: Start (ggf. `?ziel=profil`), signierte
 * Antwort für `konto`, Abschluss mit Browsernachweis — und, wenn angegeben, mit der Sitzung, aus
 * der das Profil die Bestätigung gestartet hat. Liefert den Abschluss und die neue Sitzung.
 */
async function samlDurchlauf(
  app: FastifyInstance,
  jetzt: number,
  konto: typeof KONTO_A,
  ziel: string | null,
  ausgang?: string,
): Promise<{ abschluss: LightMyRequestResponse; sitzung: string }> {
  const sitzungsCookie = ausgang === undefined ? {} : { cookie: ausgang };
  const start = await app.inject({
    method: "GET",
    url: `/api/auth/saml/start${ziel === null ? "" : `?ziel=${ziel}`}`,
    headers: sitzungsCookie,
  });
  expect(start.statusCode, start.body).toBe(302);
  const weiter = new URL(String(start.headers.location));
  const anfrage = inflateRawSync(
    Buffer.from(weiter.searchParams.get("SAMLRequest") ?? "", "base64"),
  ).toString("utf8");
  const anfrageId = /ID=\x22([^\x22]+)\x22/.exec(anfrage)?.[1] ?? "";
  const nachweis = /kw_saml_bindung=[^;]+/.exec(String(start.headers["set-cookie"] ?? ""))?.[0];
  const relay = weiter.searchParams.get("RelayState");
  const ruecksprung = await app.inject({
    method: "POST",
    url: "/api/auth/saml/acs",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({
      SAMLResponse: Buffer.from(antwort(anfrageId, konto, jetzt), "utf8").toString("base64"),
      ...(relay ? { RelayState: relay } : {}),
    }).toString(),
  });
  expect(ruecksprung.statusCode, ruecksprung.body).toBe(303);
  const abschluss = await app.inject({
    method: "GET",
    url: String(ruecksprung.headers.location),
    headers: { cookie: [nachweis, ausgang].filter(Boolean).join("; ") },
  });
  expect(abschluss.statusCode, abschluss.body).toBe(303);
  const sitzung = /kw_session=[^;]+/.exec(String(abschluss.headers["set-cookie"] ?? ""))?.[0];
  expect(sitzung, "der Abschluss hat eine Sitzung gesetzt").toBeDefined();
  return { abschluss, sitzung: sitzung ?? "" };
}

function berichtige(
  app: FastifyInstance,
  sitzung: string,
  payload: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "PUT",
    url: "/api/auth/me",
    headers: { cookie: sitzung },
    payload,
  });
}

async function ich(app: FastifyInstance, sitzung: string): Promise<{ id: string; email: string }> {
  const r = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { cookie: sitzung },
  });
  expect(r.statusCode).toBe(200);
  return r.json() as { id: string; email: string };
}

describe("R-0582 · ein reines SAML-Konto berichtigt seine E-Mail selbst — mit SAML als Bestätigung", () => {
  it("Q1 — ohne Bestätigung: 403 mit dem Satz zur erneuten Anmeldung, Adresse unverändert", async () => {
    const { app, jetzt } = await baueApp();
    try {
      const { sitzung } = await samlDurchlauf(app, jetzt, KONTO_A, null);
      const r = await berichtige(app, sitzung, { email: NEU });
      expect(r.statusCode, r.body).toBe(403);
      expect((r.json() as { message: string }).message).toBe(
        "Bitte bestätige die neue E-Mail zuerst mit einer erneuten SSO-Anmeldung.",
      );
      expect((await ich(app, sitzung)).email).toBe(KONTO_A.email);
    } finally {
      await app.close();
    }
  });

  it("Q2 — mit SAML-Bestätigung: Rücksprung ins Profil, neue Adresse gilt, einmalig", async () => {
    const { app, jetzt } = await baueApp();
    try {
      const vorher = await samlDurchlauf(app, jetzt, KONTO_A, null);
      const kontoId = (await ich(app, vorher.sitzung)).id;
      const bestaetigt = await samlDurchlauf(app, jetzt, KONTO_A, "profil", vorher.sitzung);
      expect(bestaetigt.abschluss.headers.location).toBe("/profil?kontodaten=sso");
      const r = await berichtige(app, bestaetigt.sitzung, { email: NEU });
      expect(r.statusCode, r.body).toBe(200);
      const nachher = await ich(app, bestaetigt.sitzung);
      expect(nachher).toMatchObject({ id: kontoId, email: NEU });
      // Einmalig: eine zweite Adressänderung braucht eine neue Bestätigung.
      const nochmal = await berichtige(app, bestaetigt.sitzung, { email: "dritte@firma.test" });
      expect(nochmal.statusCode).toBe(403);
      // Die nächste SAML-Anmeldung findet dasselbe Konto (am Subjekt, nicht an der Adresse).
      const danach = await samlDurchlauf(app, jetzt, KONTO_A, null);
      expect(await ich(app, danach.sitzung)).toMatchObject({ id: kontoId, email: NEU });
    } finally {
      await app.close();
    }
  });

  it("Q3 — Kontowechsel beim Anbieter: B wird angemeldet, bestätigt ist nichts, B unverändert", async () => {
    const { app, jetzt } = await baueApp();
    try {
      const b = await samlDurchlauf(app, jetzt, KONTO_B, null);
      const kontoB = await ich(app, b.sitzung);
      const a = await samlDurchlauf(app, jetzt, KONTO_A, null);
      const wechsel = await samlDurchlauf(app, jetzt, KONTO_B, "profil", a.sitzung);
      expect(wechsel.abschluss.headers.location).toBe("/profil?kontodaten=sso");
      expect((await ich(app, wechsel.sitzung)).id, "die neue Sitzung gehört B").toBe(kontoB.id);
      const versuch = await berichtige(app, wechsel.sitzung, { email: NEU });
      expect(versuch.statusCode, "keine Bestätigung für ein fremdes Ausgangskonto").toBe(403);
      expect((await ich(app, wechsel.sitzung)).email).toBe(KONTO_B.email);
      expect((await ich(app, a.sitzung)).email, "A ist unberührt").toBe(KONTO_A.email);
    } finally {
      await app.close();
    }
  });

  it("Q4 — ohne Ausgangssitzung bestätigt `profil` nichts; ein fremdes Ziel reist nicht mit", async () => {
    const { app, jetzt } = await baueApp();
    try {
      await samlDurchlauf(app, jetzt, KONTO_A, null);
      const ohne = await samlDurchlauf(app, jetzt, KONTO_A, "profil");
      expect(ohne.abschluss.headers.location).toBe("/profil?kontodaten=sso");
      expect((await berichtige(app, ohne.sitzung, { email: NEU })).statusCode).toBe(403);
      const fremd = await app.inject({ method: "GET", url: "/api/auth/saml/start?ziel=boese" });
      expect(new URL(String(fremd.headers.location)).searchParams.get("RelayState")).toBeNull();
    } finally {
      await app.close();
    }
  });
});
