// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · Entscheidungen 18/19 und 27 — WIE ES AM EINTRAG STEHT.
// ================================================================================================
//
// Die Prüfmarke (apps/web/src/components/trust/Verifizierungsmarke.tsx) zeigt seit Nacharbeit 6
// die befugte Herkunft einer Weisung samt Sichtung und die übernommene externe Freigabe samt
// bestätigter interner Anwendbarkeit. Geprüft wird: jede Angabe steht da, Namen kommen über die
// Verzeichnisregel, offene/überfällige/erledigte Sichtung sind unterscheidbar, und der Knopf zum
// Sichten erscheint NUR, wenn die Lesefläche ihn anbietet (benannte Person, offene Sichtung).
// Dazu der Spiegel der Befugnisregel, mit dem die Lesefläche das Setzen anbietet oder nicht.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "../../apps/web/node_modules/react";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { Verifizierungsmarke } from "../../apps/web/src/components/trust/Verifizierungsmarke";
import { WeisungDialog } from "../../apps/web/src/components/trust/WeisungDialog";
import { sichtungsAuswahl, weisungsbefugtFuer } from "../../apps/web/src/lib/weisungsbefugnis";
import { renderMarkup, setLanguage } from "../../apps/web/src/test/render";
import { repoPfad } from "../support/repoPfad";

const NAMEN: Record<string, string> = {
  "u-anna": "Anna Fach",
  "u-bob": "Bob Sichtet",
  "u-carla": "Carla Controller",
};
const nameOf = (id: string): string => NAMEN[id] ?? `Unbekannte Person (${id})`;

type Marke = Pick<KnowledgeObject, "verifizierung" | "aiCheck"> &
  Partial<Pick<KnowledgeObject, "weisung" | "externeFreigabe" | "version" | "geschlossen">>;

function zeige(ko: Marke, aufSichten?: () => void): string {
  return renderMarkup(
    createElement(Verifizierungsmarke, { ko, nameOf, ...(aufSichten ? { aufSichten } : {}) }),
  );
}

const WEISUNG: NonNullable<KnowledgeObject["weisung"]> = {
  von: "u-anna",
  am: "2026-10-11T08:00:00.000Z",
  bereich: "Technik",
  fassung: 2,
  bestehenGelassen: [],
  sichtung: { verantwortlich: "u-bob", frist: "2099-12-31" },
};

afterEach(async () => {
  await setLanguage("de");
});

describe("Entscheidungen 18/19 · die Weisung steht mit befugter Herkunft und Sichtung an der Marke", () => {
  it("wer, wann, welcher Bereich — und die offene Sichtung mit Person und Frist", async () => {
    await setLanguage("de");
    const html = zeige({ version: 2, weisung: WEISUNG });
    expect(html).toContain("Weisung von Anna Fach am 11.10.2026");
    expect(html).toContain("Bereich „Technik“");
    expect(html).toContain("Sichtung durch Bob Sichtet bis 31.12.2099 — offen");
    expect(html).not.toContain("galt Fassung");
  });

  it("überfällige Sichtung, frühere Fassung und bestehen gelassene Punkte werden gesagt", async () => {
    await setLanguage("de");
    const html = zeige({
      version: 3,
      weisung: {
        ...WEISUNG,
        bestehenGelassen: ["k-1", "k-2"],
        sichtung: { verantwortlich: "u-bob", frist: "2020-01-01" },
      },
    });
    expect(html).toContain("— überfällig");
    expect(html).toContain("galt Fassung v2");
    expect(html).toContain("2 betroffene Punkte ausdrücklich bestehen gelassen");
  });

  it("erledigte Sichtung mit Person, Zeitpunkt und Vermerk — dann kein Knopf mehr", async () => {
    await setLanguage("de");
    const html = zeige(
      {
        version: 2,
        weisung: {
          ...WEISUNG,
          sichtung: {
            verantwortlich: "u-bob",
            frist: "2099-12-31",
            gesichtetVon: "u-bob",
            gesichtetAm: "2026-10-12T09:00:00.000Z",
            vermerk: "Passt.",
          },
        },
      },
      () => undefined,
    );
    expect(html).toContain("Gesichtet von Bob Sichtet am 12.10.2026");
    expect(html).toContain("Vermerk: Passt.");
    expect(html).not.toContain('data-testid="ko-weisung-sichten"');
  });

  it("der Knopf zum Sichten erscheint nur, wenn die Lesefläche ihn anbietet", async () => {
    await setLanguage("de");
    expect(zeige({ weisung: WEISUNG })).not.toContain('data-testid="ko-weisung-sichten"');
    const mit = zeige({ weisung: WEISUNG }, () => undefined);
    expect(mit).toContain('data-testid="ko-weisung-sichten"');
    expect(mit).toContain("Als gesichtet bestätigen");
  });
});

describe("Entscheidung 27 · die externe Freigabe steht mit Herkunft und interner Bestätigung da", () => {
  const EXTERN: NonNullable<KnowledgeObject["externeFreigabe"]> = {
    art: "wissen",
    herausgeber: "Hersteller GmbH",
    freigegebenAm: "2026-05-01",
    freigabeKennung: "HB-4711",
    nachweis: "https://example.org/hb-4711",
    geltung: "Technik",
    zustaendig: "u-bob",
    bestaetigtVon: "u-carla",
    bestaetigtAm: "2026-10-11T10:00:00.000Z",
    fassung: 1,
  };

  it("Herausgeber, Datum, Kennung, Nachweis — und wer die interne Anwendbarkeit bestätigt hat", async () => {
    await setLanguage("de");
    const html = zeige({ externeFreigabe: EXTERN });
    expect(html).toContain("Externe Freigabe: Hersteller GmbH, freigegeben am 01.05.2026");
    expect(html).toContain("Kennung HB-4711");
    expect(html).toContain("Nachweis: https://example.org/hb-4711");
    expect(html).toContain("Intern anwendbar bestätigt von Carla Controller am 11.10.2026");
    expect(html).toContain("zuständig: Bob Sichtet");
    expect(html).not.toContain("Externe Referenz");
  });

  it("R-0178: ein ganzes Dokument trägt das Etikett „Externe Referenz“", async () => {
    await setLanguage("de");
    const html = zeige({ externeFreigabe: { ...EXTERN, art: "referenz" } });
    expect(html).toContain("Externe Referenz · Externe Freigabe: Hersteller GmbH");
  });

  it("dieselben Angaben in Englisch und Niederländisch", async () => {
    await setLanguage("en");
    expect(zeige({ externeFreigabe: EXTERN })).toContain("External approval: Hersteller GmbH");
    expect(zeige({ weisung: WEISUNG })).toContain("Directive by Anna Fach");
    await setLanguage("nl");
    expect(zeige({ externeFreigabe: EXTERN })).toContain("Externe goedkeuring: Hersteller GmbH");
    expect(zeige({ weisung: WEISUNG })).toContain("Instructie van Anna Fach");
  });
});

describe("Entscheidung 18 · die Lesefläche bietet die Weisung nur mit Befugnis am Konto an", () => {
  it("ohne Vermerk nie, mit Bereich nur dort, mit „alle Bereiche“ überall", () => {
    expect(weisungsbefugtFuer(undefined, "Technik")).toBe(false);
    expect(weisungsbefugtFuer({ bereiche: ["technik "], gesamt: false }, "Technik")).toBe(true);
    expect(weisungsbefugtFuer({ bereiche: ["Technik"], gesamt: false }, "Recht")).toBe(false);
    expect(weisungsbefugtFuer({ bereiche: [], gesamt: true }, "Recht")).toBe(true);
  });

  it("das Angebot hängt an der Befugnis, nicht an der Rolle", () => {
    const lesen = readFileSync(
      repoPfad("apps/web/src/components/bibliothek/BibliothekLesen.tsx"),
      "utf8",
    );
    expect(lesen).toContain("weisungsbefugtFuer(user?.weisungsbefugnis, ko.category)");
    expect(lesen).toContain('testId="bib-menue-weisung"');
    expect(lesen).toContain('testId="bib-menue-extern"');
  });
});

// ================================================================================================
// Nacharbeit 11 · Ben B1/B2 — DIE AUSWAHL DER SICHTENDEN UND DIE ENTSCHEIDUNG JE PUNKT.
// ================================================================================================
describe("Nacharbeit 11 · Auswahl der Sichtenden und Entscheidung je betroffenem Punkt", () => {
  const VERZEICHNIS = [
    { id: "u-anna", name: "Anna Fach" },
    { id: "u-bob", name: "Bob Sichtet" },
    { id: "u-carla", name: "Carla Controller" },
    { id: "u-viktor", name: "Viktor Viewer" },
  ];

  it("B1 · wählbar ist nur, wen der Server als sichtungsfähig nennt — nie die weisende Person", () => {
    const auswahl = sichtungsAuswahl(VERZEICHNIS, ["u-carla", "u-anna"], "u-anna");
    expect(auswahl.map((k) => k.id)).toEqual(["u-carla"]);
    // Ohne Liste vom Server ist niemand wählbar — die Oberfläche rät nicht, wer lesen darf.
    expect(sichtungsAuswahl(VERZEICHNIS, undefined, "u-anna")).toEqual([]);
  });

  it("B1 · die Lesefläche reicht genau diese Auswahl an den Dialog", () => {
    const lesen = readFileSync(
      repoPfad("apps/web/src/components/bibliothek/BibliothekLesen.tsx"),
      "utf8",
    );
    expect(lesen).toMatch(
      /konten=\{sichtungsAuswahl\([\s\S]{0,120}?ko\.sichtungsKandidaten,\s*user\?\.id,?\s*\)\}/,
    );
  });

  it("B1/B2 · der Dialog zeigt nur die übergebenen Konten und je Punkt beide Entscheidungen", async () => {
    await setLanguage("de");
    const html = renderMarkup(
      createElement(WeisungDialog, {
        bereich: "Technik",
        konten: sichtungsAuswahl(VERZEICHNIS, ["u-carla"], "u-anna"),
        punkte: [{ conflictId: "k-1", koId: "ko-alt", titel: "Bolzen handfest" }],
        laeuft: false,
        fehler: null,
        aufSetzen: () => undefined,
        aufAbbrechen: () => undefined,
      }),
    );
    expect(html).toContain("Carla Controller");
    expect(html).not.toContain("Viktor Viewer");
    expect(html).not.toContain("Bob Sichtet");
    expect(html).toContain('data-testid="weisung-punkt-k-1"');
    expect(html).toContain('data-testid="weisung-punkt-ueberstimmen-k-1"');
    expect(html).toContain("bleibt bestehen");
    expect(html).toContain("überstimmen und schließen");
  });

  it("B1 · ohne sichtungsfähige Person sagt der Dialog, warum niemand wählbar ist", async () => {
    await setLanguage("de");
    const html = renderMarkup(
      createElement(WeisungDialog, {
        bereich: "Technik",
        konten: [],
        punkte: [],
        laeuft: false,
        fehler: null,
        aufSetzen: () => undefined,
        aufAbbrechen: () => undefined,
      }),
    );
    expect(html).toContain('data-testid="weisung-keine-kandidaten"');
  });

  it("B2 · ein geschlossener Punkt sagt an der Marke, dass er durch Weisung überstimmt ist", async () => {
    await setLanguage("de");
    const html = renderMarkup(
      createElement(Verifizierungsmarke, {
        ko: {
          verifizierung: { mensch: { stand: "nicht_belegt" }, validiertVon: [] },
          aiCheck: undefined,
          geschlossen: {
            durchKoId: "ko-neu",
            conflictId: "k-1",
            von: "u-anna",
            am: "2026-10-11T12:00:00.000Z",
            fassung: 1,
          },
        } as unknown as Marke,
        nameOf,
      }),
    );
    expect(html).toContain("Durch Weisung überstimmt und geschlossen am 11.10.2026");
  });
});
