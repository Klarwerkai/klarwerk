import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GELIEFERTE_ADAPTER,
  OFFICE_KONTEXT_TTL_MS,
  OFFICE_KONTEXT_VERTRAG,
  eingetrageneHerkuenfte,
  erlaubteAktionen,
  herkunftErlaubt,
  officeBezug,
  pruefeHandlungsbezug,
  pruefeKontextmarke,
  pruefeMeldung,
  stelleKontextmarkeAus,
} from "../../services/app/src/office-kontext";

// ================================================================================================
// KLARA-OFFICE-01 · DER VERTRAG ZWISCHEN ASSISTENZKERN UND HOSTADAPTER — rein, ohne Server.
// ================================================================================================
//
// Fiktive Inhalte: „Angebot Musterfirma" ist erfunden. Die Fälle sind nach den Originalkriterien
// benannt (KO-01-02 Kontextbindung, KO-01-03 offizielle Auswahl, KO-01-06/07 Wechsel und Ziel).

const SUMME = createHash("sha256").update("Angebot Musterfirma").digest("hex");
const SCHLUESSEL = Buffer.alloc(32, 7);
const JETZT = Date.parse("2026-10-10T10:00:00.000Z");

function meldung(ueber: Record<string, unknown> = {}) {
  return {
    vertrag: OFFICE_KONTEXT_VERTRAG,
    host: { anwendung: "word", plattform: "Mac", version: "16.89" },
    objekt: { art: "dokument" },
    auswahl: { quelle: "host-api", art: "text", laenge: 19, pruefsumme: SUMME },
    sequenz: 1,
    ...ueber,
  };
}

const BINDUNG = {
  sessionId: "sitzung-1",
  actorId: "konto-a",
  addinInstanceId: "inst-1",
  documentContextId: "doc-s-1",
};

function marke() {
  const { marke: roh } = stelleKontextmarkeAus(
    {
      sid: BINDUNG.sessionId,
      act: BINDUNG.actorId,
      inst: BINDUNG.addinInstanceId,
      doc: BINDUNG.documentContextId,
      host: "word",
      seq: 3,
      sum: SUMME,
    },
    SCHLUESSEL,
    JETZT,
  );
  const geprueft = pruefeKontextmarke(roh, SCHLUESSEL, JETZT + 1);
  if (!geprueft.gueltig) {
    throw new Error("Kalibrierung: frische Marke muss gelten");
  }
  return { roh, inhalt: geprueft.inhalt };
}

describe("KO-01-02 · der gemeinsame Kontext bindet Host, Objekt, Auswahl und Folge eindeutig", () => {
  it("eine vollständige Word-Meldung wird angenommen", () => {
    const ergebnis = pruefeMeldung(meldung());
    expect(ergebnis.ok).toBe(true);
  });

  it("der Office-Bezug trägt keine Klarwerk-Wissenskennung und ist als ungeprüft markiert", () => {
    const ergebnis = pruefeMeldung(meldung({ sequenz: 4 }));
    if (!ergebnis.ok) {
      throw new Error(ergebnis.grund);
    }
    const bezug = officeBezug(ergebnis.meldung, "doc-s-abc", JETZT);
    expect(bezug.kennung).toBe("office:word:doc-s-abc#4");
    expect(bezug.art).toBe("office-bezug");
    expect(bezug.pruefstand).toBe("ungeprueft");
    expect(bezug).not.toHaveProperty("koId");
    expect(JSON.stringify(bezug)).not.toMatch(/"ko(Id|-)/);
    // Herkunft und Aktualität bleiben nachvollziehbar.
    expect(bezug.host).toEqual({ anwendung: "word", plattform: "Mac", version: "16.89" });
    expect(bezug.erfasstAm).toBe("2026-10-10T10:00:00.000Z");
    expect(bezug.sequenz).toBe(4);
  });

  it("ohne Text: ein zusätzliches Feld (etwa der Auswahltext) wird abgelehnt", () => {
    const mitText = meldung({
      auswahl: {
        quelle: "host-api",
        art: "text",
        laenge: 19,
        pruefsumme: SUMME,
        text: "Angebot Musterfirma",
      },
    });
    expect(pruefeMeldung(mitText)).toEqual({ ok: false, grund: "felder_unzulaessig" });
    expect(pruefeMeldung({ ...meldung(), dokumenttext: "x" })).toEqual({
      ok: false,
      grund: "felder_unzulaessig",
    });
  });

  it("falsche Form, fremder Vertrag und ungültige Folge werden benannt abgelehnt", () => {
    expect(pruefeMeldung(null)).toEqual({ ok: false, grund: "form_ungueltig" });
    expect(pruefeMeldung(meldung({ vertrag: "klarwerk.office-kontext/0" }))).toEqual({
      ok: false,
      grund: "vertrag_unbekannt",
    });
    expect(pruefeMeldung(meldung({ sequenz: 0 }))).toEqual({
      ok: false,
      grund: "sequenz_ungueltig",
    });
    expect(
      pruefeMeldung(
        meldung({ auswahl: { quelle: "host-api", art: "leer", laenge: 5, pruefsumme: SUMME } }),
      ),
    ).toEqual({ ok: false, grund: "form_ungueltig" });
  });

  it("nur gelieferte Adapter: Outlook, Excel und PowerPoint bleiben sichtbar offen", () => {
    expect(GELIEFERTE_ADAPTER).toEqual(["word"]);
    for (const anwendung of ["outlook", "excel", "powerpoint"]) {
      const roh = meldung({ host: { anwendung, plattform: "Mac", version: "16.89" } });
      expect(pruefeMeldung(roh), anwendung).toEqual({
        ok: false,
        grund: "adapter_nicht_geliefert",
      });
    }
    expect(
      pruefeMeldung(meldung({ objekt: { art: "mail" } })),
      "Word führt kein Mailobjekt",
    ).toEqual({ ok: false, grund: "objekt_passt_nicht" });
  });
});

describe("KO-01-03 · Auswahl nur über die offizielle Host-Schnittstelle", () => {
  it("eine Markierung im Seitenfenster ist keine Office-Dokumentauswahl", () => {
    for (const quelle of ["seitenfenster", "window.getSelection", "tutorialanker"]) {
      const roh = meldung({ auswahl: { quelle, art: "text", laenge: 19, pruefsumme: SUMME } });
      expect(pruefeMeldung(roh), quelle).toEqual({ ok: false, grund: "auswahl_nicht_vom_host" });
    }
  });

  it("Word-Aktionen nennen ihren offiziellen bzw. vorhandenen Weg", () => {
    const wege = erlaubteAktionen("word").map((a) => a.weg);
    expect(wege).toContain("office.js Word.Document.getSelection");
    expect(wege).toContain("office.js Word.Range.insertText");
    expect(wege).toContain("POST /api/ask");
    expect(erlaubteAktionen("outlook")).toEqual([]);
  });
});

describe("KO-01-07 · Kontextmarke und Bestätigungsregeln", () => {
  it("die Marke ist signiert, kurzlebig und nicht fälschbar", () => {
    const { roh } = marke();
    expect(pruefeKontextmarke(roh, SCHLUESSEL, JETZT + OFFICE_KONTEXT_TTL_MS)).toEqual({
      gueltig: false,
      grund: "marke_abgelaufen",
    });
    expect(pruefeKontextmarke(roh, Buffer.alloc(32, 8), JETZT + 1)).toEqual({
      gueltig: false,
      grund: "marke_ungueltig",
    });
    const [nutzlast, sig] = roh.split(".") as [string, string];
    const inhalt = JSON.parse(Buffer.from(nutzlast, "base64url").toString("utf8"));
    const umgeschrieben = Buffer.from(JSON.stringify({ ...inhalt, act: "konto-b" })).toString(
      "base64url",
    );
    expect(pruefeKontextmarke(`${umgeschrieben}.${sig}`, SCHLUESSEL, JETZT + 1)).toEqual({
      gueltig: false,
      grund: "marke_ungueltig",
    });
    expect(pruefeKontextmarke(undefined, SCHLUESSEL, JETZT)).toEqual({
      gueltig: false,
      grund: "marke_ungueltig",
    });
  });

  it("nur das Einfügen verlangt den zweiten Klick und eine Zielprüfung — Harmloses nicht", () => {
    const aktionen = erlaubteAktionen("word");
    const einfuegen = aktionen.find((a) => a.aktion === "einfuegen");
    expect(einfuegen).toMatchObject({ bestaetigung: "zweiter-klick", zielpruefung: true });
    for (const harmlos of aktionen.filter((a) => a.aktion !== "einfuegen")) {
      expect(harmlos.bestaetigung, harmlos.aktion).toBe("keine");
    }
    // Externe KI bleibt am vorhandenen Sitzungstor, nicht an einer neuen Office-Bestätigung.
    expect(aktionen.find((a) => a.aktion === "fragen")?.zustimmung).toBe("sitzungstor");
  });
});

describe("KO-01-06/07 · Wechsel und falsches Ziel verwerfen oder verlangen Aktualisierung", () => {
  const basis = () => ({
    marke: marke().inhalt,
    bindung: BINDUNG,
    letzteSequenz: 3,
    zielPruefsumme: SUMME,
  });

  it("passt alles, gilt der Bezug", () => {
    expect(pruefeHandlungsbezug(basis())).toEqual({ gueltig: true });
  });

  it.each([
    ["konto_gewechselt", { actorId: "konto-b" }, "verwerfen"],
    ["sitzung_gewechselt", { sessionId: "sitzung-2" }, "verwerfen"],
    ["instanz_gewechselt", { addinInstanceId: "inst-2" }, "verwerfen"],
    ["dokument_gewechselt", { documentContextId: "doc-s-2" }, "verwerfen"],
  ] as const)("%s ⇒ %s", (grund, aenderung, aktion) => {
    const lage = { ...basis(), bindung: { ...BINDUNG, ...aenderung } };
    expect(pruefeHandlungsbezug(lage)).toEqual({ gueltig: false, grund, aktion });
  });

  it("veraltete Auswahl (neuere Meldung oder keine nach Neustart) ⇒ aktualisieren", () => {
    for (const letzteSequenz of [4, undefined]) {
      expect(pruefeHandlungsbezug({ ...basis(), letzteSequenz })).toEqual({
        gueltig: false,
        grund: "auswahl_veraltet",
        aktion: "aktualisieren",
      });
    }
  });

  it("falsches Einfügeziel (andere Auswahl als gemeldet) ⇒ aktualisieren", () => {
    const andere = createHash("sha256").update("Anderer Absatz").digest("hex");
    expect(pruefeHandlungsbezug({ ...basis(), zielPruefsumme: andere })).toEqual({
      gueltig: false,
      grund: "ziel_abweichend",
      aktion: "aktualisieren",
    });
  });
});

describe("enger Kanal · nur die eigene Anwendung, Origin ist Pflicht", () => {
  const lage = (origin: unknown, secFetchSite?: string) => ({
    origin,
    secFetchSite,
    eigenerHost: "klarwerk.test",
    eingetragen: ["https://app.klarwerk.test"],
  });

  it("eigene und eingetragene Herkunft werden angenommen", () => {
    expect(herkunftErlaubt(lage("https://klarwerk.test"))).toBe(true);
    expect(herkunftErlaubt(lage("https://app.klarwerk.test", "same-origin"))).toBe(true);
  });

  it("ohne Origin, fremd, null, Loopback oder same-site wird abgelehnt", () => {
    for (const origin of [
      undefined,
      "null",
      "https://angreifer.example",
      "http://127.0.0.1:3000",
      "chrome-extension://abc",
      "https://klarwerk.test.angreifer.example",
    ]) {
      expect(herkunftErlaubt(lage(origin)), String(origin)).toBe(false);
    }
    expect(herkunftErlaubt(lage("https://klarwerk.test", "same-site"))).toBe(false);
    expect(herkunftErlaubt(lage("https://klarwerk.test", "cross-site"))).toBe(false);
  });

  it("die eingetragene Herkunft kommt nur aus einer gültigen APP_BASE_URL", () => {
    expect(eingetrageneHerkuenfte("https://app.klarwerk.test/pfad")).toEqual([
      "https://app.klarwerk.test",
    ]);
    expect(eingetrageneHerkuenfte(undefined)).toEqual([]);
    expect(eingetrageneHerkuenfte("ftp://x")).toEqual([]);
    expect(eingetrageneHerkuenfte("kein url")).toEqual([]);
  });
});
