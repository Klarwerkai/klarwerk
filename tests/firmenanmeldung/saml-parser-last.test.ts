// ================================================================================================
// CODE-REVIEW 21.10.2026 · SML-3 / SML-4 — DER SAML-LESER UNTER ANONYMER LAST.
// ================================================================================================
//
// Befunde (REVIEW.md 10.1, Belege `belege/pruefer2/SML/sml-last*.txt`): `POST /api/auth/saml/acs`
// ist öffentlich, und der XML-Leser läuft VOR jeder Anfrage- oder Signaturprüfung.
//
//   SML-3  Jedes Element kopierte die ganze Namensraum-Karte seines Elters: Deklarationen ×
//          Elemente im Speicher; 600 Deklarationen in ~500 KiB liessen den Prozess abstürzen.
//   SML-4  Zwei quadratische Stellen: die Dubletten-Prüfung der Attribute (44 000 Attribute =
//          4,2 s) und die PrefixList der Kanonisierung je Element (40 000 Präfixe = 19 s).
//
//   L1   Ein Element ohne eigene Deklaration teilt die Karte seines Elters.
//   L2   Deckel: Elemente, Attribute und Namensräume im Bereich je Dokument.
//   L3   Viele Attribute an einem Element: linear, Dubletten weiter erkannt.
//   L4   Eine lange PrefixList kostet je Element nur die Namensräume im Bereich.
//   L5   Die ACS-Route nimmt keinen Rumpf über 256 KiB an.
import { generateKeyPairSync } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes } from "../../services/auth/src/routes";
import { createSamlProvider, kanonisiere, leseXml } from "../../services/auth/src/saml";
import { AuthService } from "../../services/auth/src/service";

function grund(f: () => unknown): string {
  try {
    f();
  } catch (fehler) {
    return (fehler as { grund?: string }).grund ?? String(fehler);
  }
  return "kein Fehler";
}

const praefixe = (n: number): string[] =>
  Array.from({ length: n }, (_v, i) => `p${i.toString(36)}`);

describe("SML-3 · der Leser wächst nicht mit Deklarationen × Elementen", () => {
  it("L1 Elemente ohne eigene Deklaration teilen die Karte des Elters", () => {
    const decl = praefixe(40)
      .map((p) => ` xmlns:${p}="u"`)
      .join("");
    const wurzel = leseXml(`<r${decl}>${"<b/>".repeat(500)}<c xmlns:z="v"><d/></c></r>`);
    const kinder = wurzel.kinder.filter((k) => k.art === "element");
    expect(kinder).toHaveLength(501);
    for (const kind of kinder.slice(0, 500)) {
      expect(kind.imBereich).toBe(wurzel.imBereich);
    }
    // Wer selbst deklariert, bekommt eine eigene Karte — der Elter bleibt unberührt.
    const c = kinder[500];
    expect(c?.imBereich).not.toBe(wurzel.imBereich);
    expect(c?.imBereich.get("z")).toBe("v");
    expect(wurzel.imBereich.has("z")).toBe(false);
    const d = c?.kinder[0];
    expect(d?.art === "element" ? d.imBereich : undefined).toBe(c?.imBereich);
  });

  it("L2 Deckel: zu viele Elemente, Attribute oder Namensräume werden abgelehnt", () => {
    expect(grund(() => leseXml(`<r>${"<b/>".repeat(10_000)}</r>`))).toContain("zu viele Elemente");
    expect(grund(() => leseXml(`<r>${"<b/>".repeat(9_999)}</r>`))).toBe("kein Fehler");
    expect(grund(() => leseXml(`<r>${'<b x="" y="" z="" w="" v=""/>'.repeat(9_999)}</r>`))).toBe(
      "kein Fehler",
    );
    expect(
      grund(() => leseXml(`<r>${'<b a="" x="" y="" z="" w="" v=""/>'.repeat(9_000)}</r>`)),
    ).toContain("zu viele Attribute");
    const viele = praefixe(64)
      .map((p) => ` xmlns:${p}="u"`)
      .join("");
    expect(grund(() => leseXml(`<r${viele}/>`))).toContain("zu viele Namensräume");
    const genug = praefixe(60)
      .map((p) => ` xmlns:${p}="u"`)
      .join("");
    expect(grund(() => leseXml(`<r${genug}/>`))).toBe("kein Fehler");
  });

  it("L2b die Namensraum-Explosion des Befunds endet am Deckel statt im Speicher", () => {
    const decl = praefixe(60)
      .map((p) => ` xmlns:${p}="u"`)
      .join("");
    // Jedes Kind deklariert selbst — so musste der Leser die Karte kopieren.
    const kind = '<b xmlns:q="w"/>';
    const start = performance.now();
    expect(grund(() => leseXml(`<r${decl}>${kind.repeat(20_000)}</r>`))).toContain(
      "zu viele Elemente",
    );
    expect(performance.now() - start).toBeLessThan(2_000);
  });
});

describe("SML-4 · keine quadratische Rechenzeit vor der Signaturprüfung", () => {
  it("L3 viele Attribute an einem Element: linear, Dubletten weiter erkannt", () => {
    const attribute = praefixe(40_000)
      .map((p) => ` ${p}=""`)
      .join("");
    const start = performance.now();
    const el = leseXml(`<x${attribute}/>`);
    expect(performance.now() - start).toBeLessThan(1_000);
    expect(el.attribute).toHaveLength(40_000);
    // Dieselbe expandierte Kennung über zwei Präfixe bleibt eine Dublette.
    expect(grund(() => leseXml('<e xmlns:a="u" xmlns:b="u" a:x="1" b:x="2"/>'))).toContain(
      "doppeltes Attribut",
    );
    expect(grund(() => leseXml('<e x="1" x="2"/>'))).toContain("doppeltes Attribut");
  });

  it("L4 eine lange PrefixList kostet je Element nur die Namensräume im Bereich", () => {
    const baum = leseXml(`<r xmlns:q="w" xmlns:s="t">${"<b/>".repeat(5_000)}</r>`);
    const liste = [...praefixe(40_000), "q", "#default"];
    const start = performance.now();
    const kanon = kanonisiere(baum, { inklusiv: liste });
    expect(performance.now() - start).toBeLessThan(1_000);
    // Ergebnis wie nach der Regel: nur q (in der Liste und im Bereich) wird gerendert.
    expect(kanon.startsWith('<r xmlns:q="w"><b></b>')).toBe(true);
  });
});

describe("SML-3 · die ACS-Route deckelt den Rumpf", () => {
  it("L5 ein Rumpf über 256 KiB wird mit 413 abgewiesen, ohne den Leser zu erreichen", async () => {
    const service = new AuthService({
      users: new InMemoryUserRepo(),
      sessions: new InMemorySessionRepo(),
    });
    const anbieter = createSamlProvider(
      {
        idpEntityId: "https://idp.firma.test/saml",
        idpSsoUrl: "https://idp.firma.test/sso",
        idpSchluessel: generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey,
        spEntityId: "https://klara.firma.test/saml",
        acsUrl: "https://klara.firma.test/api/auth/saml/acs",
        autoProvision: true,
        attributEmail: "email",
        attributName: "name",
        attributGruppen: "gruppen",
        rollen: { adminGroup: "klara-admins" },
      },
      {},
    );
    const app = Fastify();
    app.register(authRoutes(service, { saml: anbieter }));
    try {
      const xml = `<r>${"<b/>".repeat(70_000)}</r>`;
      const gross = new URLSearchParams({
        SAMLResponse: Buffer.from(xml).toString("base64"),
      }).toString();
      expect(gross.length).toBeGreaterThan(256 * 1024);
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/saml/acs",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: gross,
      });
      expect(res.statusCode).toBe(413);
      // Unter dem Deckel erreicht die Antwort den Leser (und scheitert dort fachlich).
      const klein = new URLSearchParams({
        SAMLResponse: Buffer.from("<r/>").toString("base64"),
      }).toString();
      const res2 = await app.inject({
        method: "POST",
        url: "/api/auth/saml/acs",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: klein,
      });
      expect(res2.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
