// ================================================================================================
// AUFNAHME gesamt-sso · R-0560 — ANMELDUNG ÜBER DAS ÄLTERE UNTERNEHMENSVERFAHREN SAML.
// ================================================================================================
//
// Gemessen werden `services/auth/src/saml.ts` und die vier Türen in `routes.ts`.
//
// WARUM DIE SIGNATUREN HIER NICHT MIT DEM KANONISIERER DES PRODUKTS ENTSTEHEN: sonst bestätigte der
// Test nur, dass ein Fehler auf beiden Seiten derselbe ist. Die signierten Teile stehen deshalb
// unten als VON HAND in kanonischer Form (exc-c14n) geschriebene Zeichenketten — sortierte
// Attribute, Namensraum am Scheitel, leere Elemente ausgeschrieben —, und Digest und Signatur
// rechnet `node:crypto` unmittelbar über diese Zeichenketten. Im DOKUMENT steht die Assertion
// dagegen OHNE eigene Namensraumdeklaration (sie erbt sie von der Antwort): das Produkt muss beim
// Kanonisieren also selbst den richtigen Namensraum setzen. Die Kanonisierung bekommt zusätzlich
// eigene Fälle (K1–K5) mit Erwartungen aus der W3C-Regel, nicht aus dem eigenen Ergebnis.
//
//   K1–K5 exc-c14n: Namensräume, Attributreihenfolge, Vorgabenamensraum, Maskierung, PrefixList.
//   S1    EN/NL: ohne Konfiguration antworten Start, Metadaten, Rücksprung und Abschluss 501.
//   S2    eine gültige, signierte Antwort ergibt Identität, Adresse, Gruppen und Rolle.
//   S3    eine nach dem Signieren veränderte NameID scheitert am Digest.
//   S4    eine mit fremdem Schlüssel signierte Antwort scheitert an der Signatur.
//   S5    Signatur-Umhüllung (XSW): eine zweite, unsignierte Assertion wird abgelehnt.
//   S6    dieselbe Antwort ein zweites Mal (InResponseTo verbraucht) wird abgelehnt.
//   S7    falsche Audience, falscher Empfänger, abgelaufene Assertion, unsignierte Antwort, DOCTYPE.
//   S8    ein Kommentar in der NameID ändert weder Signatur noch gelesenen Wert.
//   S9    EN/NL: ein gescheiterter Rücksprung zeigt die Fehlerseite mit dem Katalogsatz.
//   S10   der ganze Weg am Draht: Start (Browsernachweis) → signierte Antwort (noch keine Sitzung)
//         → Abschluss mit dem Nachweis → Sitzung → /api/auth/me. S10b: zurück ins Word-Fenster.
//   S11   „nur Firmen-Login" mit SAML: Passwortweg zu, Status meldet SAML.
//   S12   Konfiguration aus der Umgebung: öffentlicher Schlüssel als PEM, Lücken, Unlesbares.
//   S13   Browserbindung: eine gültige Antwort ohne, mit fremdem oder geratenem Nachweis ergibt
//         keine Sitzung; der Abschlusscode gilt nur einmal; eine Anfrage ohne Bindung wird abgelehnt.
import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startbericht } from "../../services/app/src/start-vertrag";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes } from "../../services/auth/src/routes";
import {
  type SamlKonfig,
  type SamlProvider,
  createSamlProvider,
  createSamlProviderFromEnv,
  kanonisiere,
  kinderVon,
  leseXml,
} from "../../services/auth/src/saml";
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
const JETZT = Date.parse("2026-10-08T09:00:00Z");

const ANBIETER = generateKeyPairSync("rsa", { modulusLength: 2048 });
const FREMD = generateKeyPairSync("rsa", { modulusLength: 2048 });

function konfig(teil: Partial<SamlKonfig> = {}): SamlKonfig {
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
    ...teil,
  };
}

function zeit(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

interface Angaben {
  inResponseTo: string;
  nameId?: string;
  email?: string;
  gruppen?: string[];
  jetzt?: number;
  audience?: string;
  recipient?: string;
  /** Wer signiert — Vorgabe: der konfigurierte Anbieter. */
  schluessel?: typeof ANBIETER.privateKey;
  ohneSignatur?: boolean;
  /** Vorgabe `_assertion-1`; eine zweite Einlösung derselben Kennung wäre eine Wiederholung. */
  assertionId?: string;
}

/**
 * Eine SAML-Antwort mit signierter Assertion. Die beiden signierten Zeichenketten (Assertion ohne
 * Signatur, SignedInfo) stehen in kanonischer Form da — siehe Kopf.
 */
function antwort(a: Angaben): string {
  const jetzt = a.jetzt ?? JETZT;
  const assertionId = a.assertionId ?? "_assertion-1";
  const kopf = (mitNs: boolean) =>
    `<saml:Assertion${mitNs ? ` xmlns:saml="${NS_A}"` : ""} ID="${assertionId}" IssueInstant="${zeit(jetzt)}" Version="2.0">`;
  const issuer = `<saml:Issuer>${IDP}</saml:Issuer>`;
  const gruppen = (a.gruppen ?? ["klara-admins"])
    .map((g) => `<saml:AttributeValue>${g}</saml:AttributeValue>`)
    .join("");
  const rest = [
    "<saml:Subject>",
    `<saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">${a.nameId ?? "subjekt-4711"}</saml:NameID>`,
    '<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">',
    `<saml:SubjectConfirmationData InResponseTo="${a.inResponseTo}" NotOnOrAfter="${zeit(jetzt + 300_000)}" Recipient="${a.recipient ?? ACS}"></saml:SubjectConfirmationData>`,
    "</saml:SubjectConfirmation></saml:Subject>",
    `<saml:Conditions NotBefore="${zeit(jetzt - 60_000)}" NotOnOrAfter="${zeit(jetzt + 300_000)}">`,
    `<saml:AudienceRestriction><saml:Audience>${a.audience ?? SP}</saml:Audience></saml:AudienceRestriction>`,
    "</saml:Conditions><saml:AttributeStatement>",
    `<saml:Attribute Name="${ATTR_EMAIL}"><saml:AttributeValue>${a.email ?? "paula@firma.test"}</saml:AttributeValue></saml:Attribute>`,
    `<saml:Attribute Name="${ATTR_GRUPPEN}">${gruppen}</saml:Attribute>`,
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
    .sign(a.schluessel ?? ANBIETER.privateKey, "base64");
  const signatur = a.ohneSignatur
    ? ""
    : `<ds:Signature xmlns:ds="${NS_DS}">${signedInfo}<ds:SignatureValue>${wert}</ds:SignatureValue></ds:Signature>`;
  return [
    `<samlp:Response xmlns:samlp="${NS_P}" xmlns:saml="${NS_A}" Destination="${ACS}" ID="_antwort-1" InResponseTo="${a.inResponseTo}" IssueInstant="${zeit(jetzt)}" Version="2.0">`,
    `<saml:Issuer>${IDP}</saml:Issuer>`,
    '<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>',
    kopf(false),
    issuer,
    signatur,
    rest,
    "</samlp:Response>",
  ].join("");
}

const b64 = (xml: string): string => Buffer.from(xml, "utf8").toString("base64");

/** Ein Anbieter mit genau einer offenen Anfrage `_anfrage-1`. */
function anbieterMitAnfrage(teil: Partial<SamlKonfig> = {}): SamlProvider {
  const anbieter = createSamlProvider(konfig(teil), {
    now: () => JETZT,
    genId: () => "_anfrage-1",
  });
  anbieter.anmeldeUrl();
  return anbieter;
}

function grund(f: () => unknown): string {
  try {
    f();
  } catch (fehler) {
    return (fehler as { grund?: string }).grund ?? String(fehler);
  }
  return "kein Fehler";
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("R-0560 · exklusive Kanonisierung (W3C exc-c14n)", () => {
  it("K1 sichtbar genutzte Namensräume, Attribute nach (URI, Name), leere Elemente ausgeschrieben", () => {
    const x = leseXml(
      '<a:x xmlns:a="u" xmlns:b="v" z="1" a:y="2"><b:k/>text&amp;<![CDATA[<c>]]></a:x>',
    );
    expect(kanonisiere(x)).toBe(
      '<a:x xmlns:a="u" z="1" a:y="2"><b:k xmlns:b="v"></b:k>text&amp;&lt;c&gt;</a:x>',
    );
  });

  it("K2 der Vorgabenamensraum: gesetzt, aufgehoben, nicht doppelt", () => {
    const x = leseXml('<r xmlns="d"><s xmlns=""><t/></s><u/></r>');
    expect(kanonisiere(x)).toBe('<r xmlns="d"><s xmlns=""><t></t></s><u></u></r>');
  });

  it("K3 Attributwerte und Text werden nach der Regel maskiert", () => {
    const x = leseXml('<e a="x&#xA;y" b="&quot;&lt;&gt;">1 &gt; 0</e>');
    expect(kanonisiere(x)).toBe('<e a="x&#xA;y" b="&quot;&lt;>">1 &gt; 0</e>');
  });

  it("K4 ein Teilbaum trägt den geerbten Namensraum selbst", () => {
    const x = leseXml('<p:o xmlns:p="u" xmlns:q="w"><p:i/></p:o>');
    const innen = kinderVon(x, "u", "i")[0];
    expect(innen).toBeDefined();
    expect(kanonisiere(innen as NonNullable<typeof innen>)).toBe('<p:i xmlns:p="u"></p:i>');
  });

  it("K5 InclusiveNamespaces: die PrefixList rendert einen ungenutzten Namensraum", () => {
    const x = leseXml('<x xmlns:q="w"><y/></x>');
    const y = kinderVon(x, "", "y")[0] as NonNullable<ReturnType<typeof kinderVon>[number]>;
    expect(kanonisiere(y)).toBe("<y></y>");
    expect(kanonisiere(y, { inklusiv: ["q"] })).toBe('<y xmlns:q="w"></y>');
  });
});

describe("R-0560 · die SAML-Antwort wird vollständig geprüft", () => {
  it("S2 eine gültige, signierte Antwort ergibt Identität, Adresse, Gruppen und Rolle", () => {
    const anbieter = anbieterMitAnfrage();
    const gueltig = b64(antwort({ inResponseTo: "_anfrage-1" }));
    const { claims, rolle } = anbieter.pruefeAntwort(gueltig);
    expect(claims).toMatchObject({
      sub: "subjekt-4711",
      email: "paula@firma.test",
      iss: IDP,
      roles: ["klara-admins"],
      rolesClaimPresent: true,
    });
    expect(claims.emailVerified).toBeUndefined();
    expect(rolle).toBe("admin");
  });

  it("S3 eine nach dem Signieren veränderte NameID scheitert am Digest", () => {
    const anbieter = anbieterMitAnfrage();
    const echt = antwort({ inResponseTo: "_anfrage-1" });
    const gefaelscht = echt.replace(">subjekt-4711<", ">jemand-anderes<");
    expect(gefaelscht).not.toBe(echt);
    expect(grund(() => anbieter.pruefeAntwort(b64(gefaelscht)))).toContain("Digest");
  });

  it("S4 eine mit fremdem Schlüssel signierte Antwort scheitert an der Signatur", () => {
    const anbieter = anbieterMitAnfrage();
    const fremd = antwort({ inResponseTo: "_anfrage-1", schluessel: FREMD.privateKey });
    expect(grund(() => anbieter.pruefeAntwort(b64(fremd)))).toContain("Wert stimmt nicht");
  });

  it("S5 Signatur-Umhüllung: eine zweite, unsignierte Assertion wird abgelehnt", () => {
    const anbieter = anbieterMitAnfrage();
    const echt = antwort({ inResponseTo: "_anfrage-1" });
    const boese = `<saml:Assertion ID="_boese" IssueInstant="${zeit(JETZT)}" Version="2.0"><saml:Issuer>${IDP}</saml:Issuer><saml:Subject><saml:NameID>admin</saml:NameID></saml:Subject></saml:Assertion>`;
    const umhuellt = echt.replace("</samlp:Response>", `${boese}</samlp:Response>`);
    expect(grund(() => anbieter.pruefeAntwort(b64(umhuellt)))).toContain("genau eine Assertion");
  });

  it("S6 dieselbe Antwort ein zweites Mal wird abgelehnt", () => {
    const anbieter = anbieterMitAnfrage();
    const einmal = b64(antwort({ inResponseTo: "_anfrage-1" }));
    expect(anbieter.pruefeAntwort(einmal).claims.sub).toBe("subjekt-4711");
    expect(grund(() => anbieter.pruefeAntwort(einmal))).toContain("InResponseTo");
  });

  it("S7 Audience, Empfänger, Ablauf, fehlende Signatur, fremde Anfrage und DOCTYPE werden abgelehnt", () => {
    const faelle: [string, Angaben, string][] = [
      ["Audience", { inResponseTo: "_anfrage-1", audience: "https://fremd.test" }, "Audience"],
      ["Empfänger", { inResponseTo: "_anfrage-1", recipient: "https://fremd.test/acs" }, "Bearer"],
      ["abgelaufen", { inResponseTo: "_anfrage-1", jetzt: JETZT - 3_600_000 }, "Bearer"],
      ["unsigniert", { inResponseTo: "_anfrage-1", ohneSignatur: true }, "signiert"],
      ["fremde Anfrage", { inResponseTo: "_nie-gestellt" }, "InResponseTo"],
    ];
    for (const [name, angaben, erwartet] of faelle) {
      const anbieter = anbieterMitAnfrage();
      const xml = b64(antwort(angaben));
      expect(
        grund(() => anbieter.pruefeAntwort(xml)),
        name,
      ).toContain(erwartet);
    }
    const anbieter = anbieterMitAnfrage();
    const mitDoctype = `<!DOCTYPE x [<!ENTITY a "b">]>${antwort({ inResponseTo: "_anfrage-1" })}`;
    expect(grund(() => anbieter.pruefeAntwort(b64(mitDoctype)))).toContain("DOCTYPE");
  });

  it("S8 ein Kommentar in der NameID ändert weder die Signatur noch den gelesenen Wert", () => {
    const anbieter = anbieterMitAnfrage();
    const mitKommentar = antwort({ inResponseTo: "_anfrage-1" }).replace(
      ">subjekt-4711<",
      ">subjekt<!-- dazwischen -->-4711<",
    );
    expect(anbieter.pruefeAntwort(b64(mitKommentar)).claims.sub).toBe("subjekt-4711");
  });
});

/** Auth-Routen mit (oder ohne) SAML-Anbieter, ein Passwortkonto als Bestand. */
async function buehne(anbieter?: SamlProvider) {
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
  });
  await service.register({
    name: "Erste Admin",
    email: "admin@firma.test",
    password: "geheim12345",
  });
  const app = Fastify();
  app.register(authRoutes(service, anbieter ? { saml: anbieter } : {}));
  return { app, service };
}

type App = Awaited<ReturnType<typeof buehne>>["app"];

/** Ein Browser startet: Weiterleitung, gestellte Anfrage und sein Nachweis als Cookie-Paar. */
async function samlStart(app: App, query = "") {
  const start = await app.inject({ method: "GET", url: `/api/auth/saml/start${query}` });
  const ziel = new URL(String(start.headers.location));
  const anfrage = inflateRawSync(
    Buffer.from(ziel.searchParams.get("SAMLRequest") ?? "", "base64"),
  ).toString("utf8");
  const nachweis = /kw_saml_bindung=[^;]+/.exec(String(start.headers["set-cookie"] ?? ""))?.[0];
  expect(nachweis, "der Start hat keinen Browsernachweis gesetzt").toBeDefined();
  return {
    start,
    anfrage,
    anfrageId: /ID="([^"]+)"/.exec(anfrage)?.[1] ?? "",
    nachweis: nachweis ?? "",
  };
}

/** Der Rücksprung des Anbieters — ein fremd ausgelöster Formular-POST, also OHNE Cookies. */
function acs(app: App, xml: string, relayState?: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/saml/acs",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({
      SAMLResponse: b64(xml),
      ...(relayState ? { RelayState: relayState } : {}),
    }).toString(),
  });
}

describe("R-0560 · die SAML-Türen am Draht", () => {
  it.each([
    ["en", "SAML is not configured."],
    ["nl", "SAML is niet geconfigureerd."],
  ] as const)(
    "S1 SAML_DISABLED · die vier SAML-Türen antworten ohne Konfiguration 501 auf %s",
    async (sprache, satz) => {
      const { app } = await buehne();
      try {
        for (const tuer of [
          { method: "GET" as const, url: "/api/auth/saml/start" },
          { method: "GET" as const, url: "/api/auth/saml/metadata" },
          { method: "POST" as const, url: "/api/auth/saml/acs", payload: { SAMLResponse: "x" } },
          { method: "GET" as const, url: "/api/auth/saml/abschluss?code=x" },
        ]) {
          const res = await app.inject({ ...tuer, headers: { "accept-language": sprache } });
          expect(res.statusCode, tuer.url).toBe(501);
          expect(res.json().error, tuer.url).toBe("SAML_DISABLED");
          expect(res.json().message, tuer.url).toBe(satz);
        }
      } finally {
        await app.close();
      }
    },
  );

  it.each([
    ["en", "Signing in with the company login (SAML) failed. Please sign in again."],
    ["nl", "Aanmelden via de bedrijfslogin (SAML) is mislukt. Meld je opnieuw aan."],
  ] as const)(
    "S9 SAML_LOGIN_FAILED · eine verfälschte Antwort endet auf der Fehlerseite auf %s",
    async (sprache, satz) => {
      const { app } = await buehne(anbieterMitAnfrage());
      try {
        const gefaelscht = antwort({ inResponseTo: "_anfrage-1" }).replace(
          ">subjekt-4711<",
          ">jemand-anderes<",
        );
        const res = await app.inject({
          method: "POST",
          url: "/api/auth/saml/acs",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "accept-language": sprache,
          },
          payload: new URLSearchParams({ SAMLResponse: b64(gefaelscht) }).toString(),
        });
        expect(res.statusCode).toBe(401);
        expect(res.headers["content-type"]).toContain("text/html");
        expect(res.body).toContain(satz);
        expect(res.headers["set-cookie"]).toBeUndefined();
      } finally {
        await app.close();
      }
    },
  );

  it("S10 der ganze Weg: Start, signierte Antwort, Abschluss im selben Browser, Sitzung", async () => {
    const jetzt = Date.now();
    const anbieter = createSamlProvider(konfig(), { now: () => jetzt });
    const { app } = await buehne(anbieter);
    try {
      const browser = await samlStart(app);
      expect(browser.start.statusCode).toBe(302);
      const ziel = new URL(String(browser.start.headers.location));
      expect(ziel.origin + ziel.pathname).toBe("https://idp.firma.test/sso");
      expect(browser.anfrage).toContain(`AssertionConsumerServiceURL="${ACS}"`);
      expect(browser.anfrage).toContain(`<saml:Issuer>${SP}</saml:Issuer>`);
      expect(browser.anfrageId).toMatch(/^_[0-9a-f]{32}$/);
      // Der Nachweis: nur für die SAML-Türen, nicht für Skripte lesbar.
      const gesetztBeimStart = String(browser.start.headers["set-cookie"] ?? "");
      expect(gesetztBeimStart).toContain("HttpOnly");
      expect(gesetztBeimStart).toContain("Path=/api/auth/saml");
      expect(gesetztBeimStart).toContain("SameSite=Lax");

      // Der Rücksprung des Anbieters (fremd ausgelöster POST, ohne Cookie): noch KEINE Sitzung.
      const ruecksprung = await acs(app, antwort({ inResponseTo: browser.anfrageId, jetzt }));
      expect(ruecksprung.statusCode, ruecksprung.body).toBe(303);
      expect(ruecksprung.headers["set-cookie"]).toBeUndefined();
      const abschlussUrl = String(ruecksprung.headers.location);
      expect(abschlussUrl).toMatch(/^\/api\/auth\/saml\/abschluss\?code=[\w-]{43}$/);

      const abschluss = await app.inject({
        method: "GET",
        url: abschlussUrl,
        headers: { cookie: browser.nachweis },
      });
      expect(abschluss.statusCode, abschluss.body).toBe(303);
      expect(abschluss.headers.location).toBe("/");
      const gesetzt = String(abschluss.headers["set-cookie"] ?? "");
      const sitzung = /kw_session=[^;]+/.exec(gesetzt)?.[0];
      expect(sitzung, gesetzt).toBeDefined();
      // Der Nachweis ist verbraucht und wird gelöscht.
      expect(gesetzt).toContain("kw_saml_bindung=; HttpOnly; Path=/api/auth/saml; Max-Age=0");

      const ich = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { cookie: sitzung ?? "" },
      });
      expect(ich.statusCode, ich.body).toBe(200);
      expect(ich.json()).toMatchObject({ email: "paula@firma.test", role: "admin" });

      // Ein fremdes Ziel öffnet keine Weiterleitung: nur die EINE feste Kennung reist mit.
      const offen = await app.inject({
        method: "GET",
        url: "/api/auth/saml/start?ziel=https://boese.test",
      });
      expect(new URL(String(offen.headers.location)).searchParams.get("RelayState")).toBeNull();
    } finally {
      await app.close();
    }
  });

  it("S10b aus dem Word-Fenster gestartet, führt der Rücksprung ins Fenster zurück", async () => {
    const jetzt = Date.now();
    const anbieter = createSamlProvider(konfig(), { now: () => jetzt });
    const { app } = await buehne(anbieter);
    try {
      const browser = await samlStart(app, "?ziel=word-addin");
      const ziel = new URL(String(browser.start.headers.location));
      expect(ziel.searchParams.get("RelayState")).toBe("word-addin");
      const ruecksprung = await acs(
        app,
        antwort({ inResponseTo: browser.anfrageId, jetzt }),
        "word-addin",
      );
      expect(ruecksprung.statusCode, ruecksprung.body).toBe(303);
      const abschluss = await app.inject({
        method: "GET",
        url: String(ruecksprung.headers.location),
        headers: { cookie: browser.nachweis },
      });
      expect(abschluss.statusCode, abschluss.body).toBe(303);
      expect(abschluss.headers.location).toBe("/word-addin/anmeldung.html");
    } finally {
      await app.close();
    }
  });

  it("S13 ohne den Nachweis des startenden Browsers entsteht keine Sitzung", async () => {
    const jetzt = Date.now();
    const anbieter = createSamlProvider(konfig(), { now: () => jetzt });
    const { app } = await buehne(anbieter);
    const ohneSitzung = (res: { statusCode: number; body: string; headers: object }) => {
      expect(res.statusCode, res.body).toBe(401);
      expect(res.body).toContain('data-testid="saml-fehler"');
      expect(String((res.headers as Record<string, unknown>)["set-cookie"] ?? "")).not.toContain(
        "kw_session=",
      );
    };
    try {
      // Login-CSRF: der Angreifer startet SELBST, meldet sich beim Anbieter an und lässt seine
      // frische Antwort von einem fremden Browser einlösen — der hat keinen oder einen anderen
      // Nachweis.
      const opfer = await samlStart(app);
      const versuche: [string, string | undefined][] = [
        ["ohne Nachweis", undefined],
        ["Nachweis eines anderen Browsers", opfer.nachweis],
        ["geratener Nachweis", "kw_saml_bindung=geraten"],
      ];
      for (const [nr, [name, cookie]] of versuche.entries()) {
        const angreifer = await samlStart(app);
        const ruecksprung = await acs(
          app,
          antwort({ inResponseTo: angreifer.anfrageId, jetzt, assertionId: `_versuch-${nr}` }),
        );
        expect(ruecksprung.statusCode, name).toBe(303);
        const abschluss = await app.inject({
          method: "GET",
          url: String(ruecksprung.headers.location),
          headers: cookie ? { cookie } : {},
        });
        ohneSitzung(abschluss);
        // Danach ist der Code verbraucht — auch der startende Browser löst ihn nicht mehr ein.
        const nochmal = await app.inject({
          method: "GET",
          url: String(ruecksprung.headers.location),
          headers: { cookie: angreifer.nachweis },
        });
        ohneSitzung(nochmal);
      }

      // Ein erfundener Code ohne Rücksprung führt ebenso nirgends hin.
      ohneSitzung(
        await app.inject({
          method: "GET",
          url: "/api/auth/saml/abschluss?code=erfunden",
          headers: { cookie: opfer.nachweis },
        }),
      );

      // Eine Anfrage, die ohne Browserbindung gestellt wurde, löst der Rücksprung gar nicht ein.
      const { app: ohneBindung } = await buehne(anbieterMitAnfrage());
      try {
        ohneSitzung(await acs(ohneBindung, antwort({ inResponseTo: "_anfrage-1" })));
      } finally {
        await ohneBindung.close();
      }
    } finally {
      await app.close();
    }
  });

  it("S11 nur Firmen-Login mit SAML: Status meldet SAML, der Passwortweg ist zu", async () => {
    vi.stubEnv("KLARWERK_SSO_ONLY", "1");
    const { app } = await buehne(anbieterMitAnfrage());
    try {
      const status = await app.inject({ method: "GET", url: "/api/auth/status" });
      expect(status.json()).toMatchObject({
        samlEnabled: true,
        oidcEnabled: false,
        passwordLoginEnabled: false,
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "admin@firma.test", password: "geheim12345" },
      });
      expect(login.statusCode).toBe(403);
      expect(login.json().error).toBe("PASSWORD_LOGIN_DISABLED");
      const metadaten = await app.inject({ method: "GET", url: "/api/auth/saml/metadata" });
      expect(metadaten.statusCode).toBe(200);
      expect(metadaten.body).toContain(`entityID="${SP}"`);
      expect(metadaten.body).toContain(`Location="${ACS}"`);
    } finally {
      await app.close();
    }
  });
});

describe("R-0560 · Konfiguration aus der Umgebung", () => {
  const pem = ANBIETER.publicKey.export({ type: "spki", format: "pem" }).toString();
  const env: Record<string, string> = {
    SAML_IDP_ENTITY_ID: IDP,
    SAML_IDP_SSO_URL: "https://idp.firma.test/sso",
    SAML_IDP_CERT: pem,
    SAML_SP_ENTITY_ID: SP,
    SAML_ACS_URL: ACS,
  };

  it("S12 vollständig: aktiv — auch mit `\\n` als Zeichenfolge; Lücke oder Unlesbares: aus und benannt", () => {
    expect(createSamlProviderFromEnv(env)?.config.acsUrl).toBe(ACS);
    const eingezeilt = { ...env, SAML_IDP_CERT: pem.replace(/\n/g, "\\n") };
    expect(createSamlProviderFromEnv(eingezeilt)).toBeDefined();

    const ohneAcs = { ...env, SAML_ACS_URL: "" };
    expect(createSamlProviderFromEnv(ohneAcs)).toBeUndefined();
    const lueckenbericht = startbericht(ohneAcs, { art: "leer" });
    const luecke = lueckenbericht.maengel.find((m) => m.befund.startsWith("SAML ist unvoll"));
    expect(luecke?.betrifft).toEqual(["SAML_ACS_URL"]);

    const kaputt = { ...env, SAML_IDP_CERT: "kein-zertifikat" };
    expect(createSamlProviderFromEnv(kaputt)).toBeUndefined();
    const kaputtbericht = startbericht(kaputt, { art: "leer" });
    const unlesbar = kaputtbericht.maengel.find((m) => m.betrifft.includes("SAML_IDP_CERT"));
    expect(unlesbar?.befund).toContain("nicht lesbar");

    // Vollständig und lesbar: kein SAML-Mangel.
    const voll = startbericht(env, { art: "leer" });
    expect(voll.maengel.some((m) => m.befund.startsWith("SAML"))).toBe(false);
  });
});
