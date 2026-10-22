// ================================================================================================
// CODE-REVIEW 21.10.2026 · SML-1 / SML-2 — ASSERTION-TRANSPLANTAT UND WIEDERHOLUNG.
// ================================================================================================
//
// Befunde (REVIEW.md 10.1, Belege `belege/pruefer2/SML/`):
//
//   SML-1  Fehlte `SubjectConfirmationData/@InResponseTo`, liess `pruefeAntwort` die Bearer-
//          Bestätigung durchgehen. Die einzige weitere Bindung an die eigene Anfrage war das
//          `InResponseTo` der UNSIGNIERTEN Antwort-Hülle. Ein Angreifer mit einer abgegriffenen,
//          noch nicht eingelösten Antwort startete selbst, schrieb die Hülle auf SEINE Anfrage um,
//          löste sie in SEINEM Browser ein — und war als das Opfer angemeldet.
//   SML-2  Der Einmal-Verbrauch merkte sich die Assertion-ID nur bis `Conditions/@NotOnOrAfter`
//          (ohne Uhrtoleranz) bzw. zehn Minuten; angenommen wird sie aber bis `NotOnOrAfter` plus
//          zwei Minuten Toleranz bzw. — ohne `Conditions/@NotOnOrAfter` — bis zur Frist der
//          Bestätigung. Dazwischen war dieselbe Assertion ein zweites Mal einlösbar.
//
// Signiert wird wie in `saml-anmeldung.test.ts`: die signierten Teile stehen VON HAND in
// kanonischer Form da, Digest und Signatur rechnet `node:crypto` — nicht der Kanonisierer des
// Produkts.
//
//   T1   Signaturebene: eine fremde Assertion ohne InResponseTo in der Bestätigung, umhüllt mit der
//        eigenen Anfrage-ID (Fall 1.15), wird abgelehnt; ebenso eine ohne InResponseTo zur eigenen.
//   T2   Am Draht (sml-transplantat-route): Opfer regulär angemeldet; Transplantat, Kontrolle und
//        Gegenprobe ergeben KEINE Sitzung.
//   T3   Die Replay-Fälle 6.13/6.14 des Reviews werden abgelehnt.
//   T4   Der Einmal-Verbrauch hält, auch wenn die Anfragebindung nicht greift (dieselbe Anfrage-ID
//        wird erneut gestellt): bis `NotOnOrAfter` + Toleranz, ohne `Conditions/@NotOnOrAfter`
//        bis zur Frist der Bestätigung + Toleranz.
//   T5   Eine Bestätigung ohne jede Frist trägt nicht.
import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes } from "../../services/auth/src/routes";
import {
  SAML_UHR_TOLERANZ_MS,
  type SamlKonfig,
  createSamlProvider,
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
const T0 = Date.parse("2026-10-22T09:00:00Z");
const MINUTE = 60_000;

const ANBIETER = generateKeyPairSync("rsa", { modulusLength: 2048 });

const OPFER = { nameId: "chef-0001", email: "chef@firma.test", gruppen: ["klara-admins"] };

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

interface Angaben {
  /** `InResponseTo` der Antwort-Hülle. */
  inResponseTo: string;
  /** `InResponseTo` der Bestätigung — Vorgabe wie die Hülle; `null` = weggelassen. */
  bestaetigungAuf?: string | null;
  /** Frist der Bestätigung relativ zu `jetzt` — Vorgabe +5 min; `null` = weggelassen. */
  bestaetigungBis?: number | null;
  /** `Conditions/@NotOnOrAfter` relativ zu `jetzt` — Vorgabe +5 min; `null` = weggelassen. */
  bedingungBis?: number | null;
  assertionId?: string;
  nameId?: string;
  email?: string;
  gruppen?: string[];
  jetzt?: number;
}

/** Eine SAML-Antwort mit vom Anbieter signierter Assertion (kanonische Form von Hand). */
function antwort(a: Angaben): string {
  const jetzt = a.jetzt ?? T0;
  const assertionId = a.assertionId ?? "_assertion-1";
  const kopf = (mitNs: boolean) =>
    `<saml:Assertion${mitNs ? ` xmlns:saml="${NS_A}"` : ""} ID="${assertionId}" IssueInstant="${zeit(jetzt)}" Version="2.0">`;
  const issuer = `<saml:Issuer>${IDP}</saml:Issuer>`;
  const gruppen = (a.gruppen ?? ["klara-nutzer"])
    .map((g) => `<saml:AttributeValue>${g}</saml:AttributeValue>`)
    .join("");
  // Attribute in kanonischer Reihenfolge (ohne Namensraum: nach lokalem Namen).
  const auf = a.bestaetigungAuf === undefined ? a.inResponseTo : a.bestaetigungAuf;
  const scd = [
    auf === null ? "" : ` InResponseTo="${auf}"`,
    a.bestaetigungBis === null
      ? ""
      : ` NotOnOrAfter="${zeit(jetzt + (a.bestaetigungBis ?? 5 * MINUTE))}"`,
    ` Recipient="${ACS}"`,
  ].join("");
  const bedingungen = [
    ` NotBefore="${zeit(jetzt - MINUTE)}"`,
    a.bedingungBis === null
      ? ""
      : ` NotOnOrAfter="${zeit(jetzt + (a.bedingungBis ?? 5 * MINUTE))}"`,
  ].join("");
  const rest = [
    "<saml:Subject>",
    `<saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">${a.nameId ?? "angreifer-0815"}</saml:NameID>`,
    '<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">',
    `<saml:SubjectConfirmationData${scd}></saml:SubjectConfirmationData>`,
    "</saml:SubjectConfirmation></saml:Subject>",
    `<saml:Conditions${bedingungen}>`,
    `<saml:AudienceRestriction><saml:Audience>${SP}</saml:Audience></saml:AudienceRestriction>`,
    "</saml:Conditions><saml:AttributeStatement>",
    `<saml:Attribute Name="${ATTR_EMAIL}"><saml:AttributeValue>${a.email ?? "angreifer@firma.test"}</saml:AttributeValue></saml:Attribute>`,
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
    .sign(ANBIETER.privateKey, "base64");
  return [
    `<samlp:Response xmlns:samlp="${NS_P}" xmlns:saml="${NS_A}" Destination="${ACS}" ID="_antwort-1" InResponseTo="${a.inResponseTo}" IssueInstant="${zeit(jetzt)}" Version="2.0">`,
    `<saml:Issuer>${IDP}</saml:Issuer>`,
    '<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>',
    kopf(false),
    issuer,
    `<ds:Signature xmlns:ds="${NS_DS}">${signedInfo}<ds:SignatureValue>${wert}</ds:SignatureValue></ds:Signature>`,
    rest,
    "</samlp:Response>",
  ].join("");
}

/** Der Angreifer schreibt nur die UNSIGNIERTE Hülle um — die signierte Assertion bleibt unberührt. */
function umhuellen(xml: string, von: string, auf: string): string {
  const umgehuellt = xml.replace(
    `InResponseTo="${von}" IssueInstant`,
    `InResponseTo="${auf}" IssueInstant`,
  );
  expect(umgehuellt).not.toBe(xml);
  return umgehuellt;
}

const b64 = (xml: string): string => Buffer.from(xml, "utf8").toString("base64");

function grund(f: () => unknown): string {
  try {
    f();
  } catch (fehler) {
    return (fehler as { grund?: string }).grund ?? String(fehler);
  }
  return "kein Fehler";
}

/** Ein Anbieter auf einer stellbaren Uhr; jede Anfrage bekommt eine eigene, fortlaufende ID. */
function anbieterMitUhr(genId?: () => string) {
  const uhr = { jetzt: T0 };
  let zaehler = 0;
  const anbieter = createSamlProvider(konfig(), {
    now: () => uhr.jetzt,
    genId: genId ?? (() => `_anfrage-${++zaehler}`),
  });
  const neueAnfrage = (): string => {
    const url = new URL(anbieter.anmeldeUrl(undefined, "bindung-pruefsumme"));
    const anfrage = inflateRawSync(
      Buffer.from(url.searchParams.get("SAMLRequest") ?? "", "base64"),
    ).toString("utf8");
    return /ID=\x22([^\x22]+)\x22/.exec(anfrage)?.[1] ?? "";
  };
  return { anbieter, uhr, neueAnfrage };
}

describe("SML-1 · die Bearer-Bestätigung muss an die eigene Anfrage gebunden sein", () => {
  it("T1 eine fremde Assertion ohne InResponseTo in der Bestätigung trägt keine eigene Anfrage", () => {
    const { anbieter, neueAnfrage } = anbieterMitUhr();
    const opferAnfrage = neueAnfrage();
    const opferAntwort = antwort({
      inResponseTo: opferAnfrage,
      bestaetigungAuf: null,
      ...OPFER,
    });
    const meine = neueAnfrage();
    expect(
      grund(() => anbieter.pruefeAntwort(b64(umhuellen(opferAntwort, opferAnfrage, meine)))),
    ).toContain("keine gültige Bearer-Bestätigung");

    // Auch zur eigenen Anfrage ist eine Bestätigung ohne InResponseTo keine: der Dienst stellt
    // stets selbst die Anfrage, ein fehlendes InResponseTo ist kein erwarteter Fall.
    const { anbieter: zweiter, neueAnfrage: zweiteAnfrage } = anbieterMitUhr();
    const eigene = zweiteAnfrage();
    expect(
      grund(() =>
        zweiter.pruefeAntwort(b64(antwort({ inResponseTo: eigene, bestaetigungAuf: null }))),
      ),
    ).toContain("keine gültige Bearer-Bestätigung");

    // Gegenprobe: mit InResponseTo in der Bestätigung gilt die eigene Antwort.
    const { anbieter: dritter, neueAnfrage: dritteAnfrage } = anbieterMitUhr();
    const regulaer = dritteAnfrage();
    expect(dritter.pruefeAntwort(b64(antwort({ inResponseTo: regulaer }))).claims.sub).toBe(
      "angreifer-0815",
    );
  });

  it("T2 am Draht: das Transplantat einer abgegriffenen Opfer-Antwort ergibt keine Sitzung", async () => {
    const service = new AuthService({
      users: new InMemoryUserRepo(),
      sessions: new InMemorySessionRepo(),
    });
    await service.register({
      name: "Erste Admin",
      email: "admin@firma.test",
      password: "geheim12345",
    });
    const jetzt = Date.now();
    const app = Fastify();
    app.register(authRoutes(service, { saml: createSamlProvider(konfig(), { now: () => jetzt }) }));

    const start = async () => {
      const res = await app.inject({ method: "GET", url: "/api/auth/saml/start" });
      const anfrage = inflateRawSync(
        Buffer.from(
          new URL(String(res.headers.location)).searchParams.get("SAMLRequest") ?? "",
          "base64",
        ),
      ).toString("utf8");
      return {
        rid: /ID=\x22([^\x22]+)\x22/.exec(anfrage)?.[1] ?? "",
        nachweis: /kw_saml_bindung=[^;]+/.exec(String(res.headers["set-cookie"] ?? ""))?.[0] ?? "",
      };
    };
    /** Rücksprung (ohne Cookie) und Abschluss im Browser mit `nachweis`; liefert die Sitzung. */
    const einloesen = async (xml: string, nachweis: string) => {
      const acs = await app.inject({
        method: "POST",
        url: "/api/auth/saml/acs",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: new URLSearchParams({ SAMLResponse: b64(xml) }).toString(),
      });
      if (acs.statusCode !== 303) {
        return { schritt: `acs ${acs.statusCode}`, sitzung: undefined };
      }
      const abschluss = await app.inject({
        method: "GET",
        url: String(acs.headers.location),
        headers: { cookie: nachweis },
      });
      const sitzung = /kw_session=[^;]+/.exec(String(abschluss.headers["set-cookie"] ?? ""))?.[0];
      return { schritt: `abschluss ${abschluss.statusCode}`, sitzung };
    };

    try {
      // 0) Das Opfer meldet sich regulär an (IdP setzt InResponseTo): Konto mit Rolle admin.
      const v0 = await start();
      const regulaer = await einloesen(
        antwort({ inResponseTo: v0.rid, jetzt, assertionId: "_a-0", ...OPFER }),
        v0.nachweis,
      );
      expect(regulaer.sitzung, regulaer.schritt).toBeDefined();
      const ich = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { cookie: regulaer.sitzung ?? "" },
      });
      expect(ich.json()).toMatchObject({ email: "chef@firma.test", role: "admin" });

      // 1) Das Opfer startet erneut; die Antwort seines IdP (ohne InResponseTo in der Bestätigung)
      //    wird abgegriffen, bevor das Opfer sie einlöst.
      const v1 = await start();
      const gestohlen = antwort({
        inResponseTo: v1.rid,
        bestaetigungAuf: null,
        jetzt,
        assertionId: "_a-1",
        ...OPFER,
      });

      // 2a) Kontrolle: unverändert im Browser des Angreifers.
      const vk = await start();
      const kontrolle = antwort({
        inResponseTo: vk.rid,
        bestaetigungAuf: null,
        jetzt,
        assertionId: "_a-k",
        ...OPFER,
      });
      const a1 = await start();
      expect((await einloesen(kontrolle, a1.nachweis)).sitzung).toBeUndefined();

      // 2b) Angriff: eigene Anfrage starten, Hülle umschreiben, mit eigenem Nachweis einlösen.
      const a2 = await start();
      const angriff = await einloesen(umhuellen(gestohlen, v1.rid, a2.rid), a2.nachweis);
      expect(angriff.schritt).toBe("acs 401");
      expect(angriff.sitzung).toBeUndefined();

      // 3) Gegenprobe: IdP setzt InResponseTo in der Bestätigung — auch umhüllt keine Sitzung.
      const v3 = await start();
      const mitBindung = antwort({ inResponseTo: v3.rid, jetzt, assertionId: "_a-3", ...OPFER });
      const a3 = await start();
      const gegenprobe = await einloesen(umhuellen(mitBindung, v3.rid, a3.rid), a3.nachweis);
      expect(gegenprobe.schritt).toBe("acs 401");
      expect(gegenprobe.sitzung).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});

describe("SML-2 · eine Assertion gilt genau einmal, solange sie annehmbar wäre", () => {
  it.each([
    [
      "6.13 Replay 60 s nach Conditions.NotOnOrAfter (in der Uhrtoleranz)",
      { bedingungBis: 5 * MINUTE, bestaetigungBis: 5 * MINUTE },
      5 * MINUTE + MINUTE,
    ],
    [
      "6.14 Conditions ohne NotOnOrAfter, Bestätigung +60 min; Wiederholung nach 11 min",
      { bedingungBis: null, bestaetigungBis: 60 * MINUTE },
      11 * MINUTE,
    ],
  ] as const)(
    "T3 Review-Fall %s: Wiederholung mit neuer Anfrage-ID wird abgelehnt",
    (_name, fristen, spaeter) => {
      const { anbieter, uhr, neueAnfrage } = anbieterMitUhr();
      const rid = neueAnfrage();
      const doc = antwort({ inResponseTo: rid, bestaetigungAuf: null, ...fristen });
      // Erstlauf: so, wie der Befund ihn vorfand (Bestätigung ohne InResponseTo) — heute abgelehnt.
      grund(() => anbieter.pruefeAntwort(b64(doc)));
      uhr.jetzt = T0 + spaeter;
      const r2 = neueAnfrage();
      expect(grund(() => anbieter.pruefeAntwort(b64(umhuellen(doc, rid, r2))))).not.toBe(
        "kein Fehler",
      );
    },
  );

  // Die Anfragebindung (SML-1) schliesst die Wiederholung schon aus. Der Einmal-Verbrauch ist die
  // zweite, unabhängige Sperre — geprüft, indem dieselbe Anfrage-ID erneut gestellt wird.
  it.each([
    [
      "NotOnOrAfter +5 min: kurz vor Ende der Toleranz",
      { bedingungBis: 5 * MINUTE, bestaetigungBis: 5 * MINUTE },
      [5 * MINUTE + MINUTE, 5 * MINUTE + SAML_UHR_TOLERANZ_MS - 1_000],
    ],
    [
      "ohne Conditions.NotOnOrAfter, Bestätigung +60 min",
      { bedingungBis: null, bestaetigungBis: 60 * MINUTE },
      [11 * MINUTE, 60 * MINUTE + SAML_UHR_TOLERANZ_MS - 1_000],
    ],
  ] as const)(
    "T4 der Einmal-Verbrauch hält bis zur Frist plus Toleranz — %s",
    (_name, fristen, zeitpunkte) => {
      const { anbieter, uhr, neueAnfrage } = anbieterMitUhr(() => "_anfrage-wiederholt");
      const rid = neueAnfrage();
      const doc = b64(antwort({ inResponseTo: rid, ...fristen }));
      expect(anbieter.pruefeAntwort(doc).claims.sub).toBe("angreifer-0815");
      for (const spaeter of zeitpunkte) {
        uhr.jetzt = T0 + spaeter;
        expect(neueAnfrage()).toBe(rid);
        expect(
          grund(() => anbieter.pruefeAntwort(doc)),
          `nach ${spaeter} ms`,
        ).toContain("bereits verwendet");
      }
    },
  );

  it("T5 eine Bestätigung ohne jede Frist trägt nicht", () => {
    const { anbieter, neueAnfrage } = anbieterMitUhr();
    const rid = neueAnfrage();
    const ohneFrist = antwort({ inResponseTo: rid, bestaetigungBis: null, bedingungBis: null });
    expect(grund(() => anbieter.pruefeAntwort(b64(ohneFrist)))).toContain(
      "keine gültige Bearer-Bestätigung",
    );
  });
});
