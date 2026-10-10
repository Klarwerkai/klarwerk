// ================================================================================================
// VORLAGENSTRUKTUR — Wechsel ohne Werteverlust, Pflichtfelder in jeder Sprache, Vorrangregel
// (produkt:20261007:templates-default). Reine Rechnungen, kein Server, kein DOM.
//
//   K2  Vorlage für einen Beitrag wechseln: übernommene, verschobene und nur leere Abschnitte —
//       eingegebene Werte gehen nie verloren; ohne bekannte Vorlage wird angefügt.
//   K6  Editor (Browser) und Server lesen DIESELBE Struktur: `vorlageHtml` der Standardvorlage und
//       `fehlendePflichtfelder` des Servers passen in DE/EN/NL zusammen.
//   K9  Vorrangregel: Space-Vorgabe → persönlicher Standard → freie Eingabe mit Ersatzgrund.
//   K8  Pflichtangaben: Kategorie, Tags, Feld — mit Meldung je Befund.
// ================================================================================================
import { describe, expect, it } from "vitest";
import {
  type StrukturVorlage,
  abschnitte,
  fehlendePflichtfelder,
  textVon,
  vorlageHtml,
  wechsleVorlage,
} from "../../apps/web/src/lib/vorlagenStruktur";
import {
  KEINE_VORGABE,
  STANDARD_VORLAGEN,
  type VorlageFassung,
  bezugAus,
  pruefeAngaben,
  pruefeVorlageEingabe,
  waehleStartvorlage,
} from "../../services/app/src/vorlagen";

const std = (id: string): VorlageFassung => {
  const v = STANDARD_VORLAGEN.find((x) => x.id === id);
  if (!v) {
    throw new Error(`Standardvorlage ${id} fehlt`);
  }
  return v;
};

const BESPRECHUNG: StrukturVorlage = {
  id: "eigene-besprechung",
  name: "Besprechung",
  felder: [
    { id: "anlass", titel: "Anlass", hinweis: "Worum ging es? …", art: "absatz", pflicht: true },
    {
      id: "ergebnisse",
      titel: "Ergebnisse",
      hinweis: "Ergebnis ergänzen …",
      art: "liste",
      pflicht: false,
    },
    { id: "offen", titel: "Offen", hinweis: "Frage ergänzen …", art: "liste", pflicht: false },
  ],
};

const PROTOKOLL: StrukturVorlage = {
  id: "eigenes-protokoll",
  name: "Protokoll",
  felder: [
    { id: "anlass", titel: "Anlass", hinweis: "Anlass ergänzen …", art: "absatz", pflicht: true },
    {
      id: "beschluesse",
      titel: "Beschlüsse",
      hinweis: "Beschluss ergänzen …",
      art: "liste",
      pflicht: true,
    },
  ],
};

describe("K2 · Vorlage wechseln, ohne Werte zu verlieren", () => {
  it("leerer Beitrag: die Vorlage wird gesetzt", () => {
    const w = wechsleVorlage("", null, BESPRECHUNG, "de", "Weitere Inhalte");
    expect(w.angefuegt).toBe(false);
    expect(w.html).toBe(vorlageHtml(BESPRECHUNG, "de"));
  });

  it("freier Text ohne bekannte Vorlage: die Struktur wird darunter angefügt", () => {
    const html = "<p>Notiz aus der Halle, fiktiv.</p>";
    const w = wechsleVorlage(html, null, BESPRECHUNG, "de", "Weitere Inhalte");
    expect(w.angefuegt).toBe(true);
    expect(w.html.startsWith(html)).toBe(true);
  });

  it("gleiche Felder übernehmen ihren Inhalt, eigene Abschnitte wandern ans Ende, leere Hinweise entfallen", () => {
    const geschrieben =
      "<h2>Besprechung</h2><p>Kurz vorab.</p>" +
      "<h3>Anlass</h3><p>Ausfall Linie 4 (fiktiv).</p>" +
      "<h3>Ergebnisse</h3><ul><li>Ersatzteil bestellt.</li></ul>" +
      "<h3>Offen</h3><ul><li>Frage ergänzen …</li></ul>" +
      "<h3>Eigene Notiz</h3><p>Rückruf Lieferant.</p>";
    const w = wechsleVorlage(geschrieben, BESPRECHUNG, PROTOKOLL, "de", "Weitere Inhalte");
    expect(w.uebernommen).toEqual(["Anlass"]);
    expect(w.verschoben).toEqual(["Ergebnisse", "Eigene Notiz"]);
    expect(w.leerEntfernt).toEqual(["Offen"]);
    // Jeder eingegebene Wert steht weiterhin im Ergebnis.
    const text = textVon(w.html);
    for (const wert of [
      "Kurz vorab.",
      "Ausfall Linie 4 (fiktiv).",
      "Ersatzteil bestellt.",
      "Rückruf Lieferant.",
    ]) {
      expect(text).toContain(wert);
    }
    // Die neue Struktur ist vollständig: das neue Pflichtfeld steht als Hinweis bereit.
    const titel = abschnitte(w.html).map((a) => a.titel);
    expect(titel).toEqual(
      expect.arrayContaining([
        "Protokoll",
        "Anlass",
        "Beschlüsse",
        "Weitere Inhalte",
        "Eigene Notiz",
      ]),
    );
    expect(fehlendePflichtfelder(w.html, PROTOKOLL).map((f) => f.titel)).toEqual(["Beschlüsse"]);
  });

  it("Fassungswechsel derselben Vorlage: ein umbenanntes Feld behält seinen Inhalt über die Kennung", () => {
    const v1: StrukturVorlage = { ...BESPRECHUNG, felder: BESPRECHUNG.felder.slice(0, 2) };
    const v2: StrukturVorlage = {
      ...BESPRECHUNG,
      felder: [
        {
          id: "anlass",
          titel: "Anlass und Teilnehmende",
          hinweis: "Wer war dabei? …",
          art: "absatz",
          pflicht: true,
        },
        {
          id: "ergebnisse",
          titel: "Ergebnisse",
          hinweis: "Ergebnis ergänzen …",
          art: "liste",
          pflicht: false,
        },
      ],
    };
    const html =
      "<h2>Besprechung</h2><h3>Anlass</h3><p>Audit-Vorbereitung.</p><h3>Ergebnisse</h3><ul><li>Plan steht.</li></ul>";
    const w = wechsleVorlage(html, v1, v2, "de", "Weitere Inhalte");
    expect(w.uebernommen).toEqual(["Anlass und Teilnehmende", "Ergebnisse"]);
    expect(w.verschoben).toEqual([]);
    expect(textVon(w.html)).toContain("Audit-Vorbereitung.");
  });

  it("Benutzereingaben im Vorlagentext werden maskiert, nicht als HTML übernommen", () => {
    const boese: StrukturVorlage = {
      name: "<img src=x onerror=alert(1)>",
      felder: [
        {
          id: "a",
          titel: "<b>Titel</b>",
          hinweis: "<script>x</script>",
          art: "absatz",
          pflicht: false,
        },
      ],
    };
    const html = vorlageHtml(boese, "de");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;Titel&lt;/b&gt;");
  });
});

describe("K6 · Editor und Server lesen dieselben Felder — in jeder Sprache", () => {
  it.each(["de", "en", "nl"] as const)(
    "%s: frisch eingesetzte Standardvorlage → genau ihre Pflichtfelder fehlen",
    (sprache) => {
      for (const v of STANDARD_VORLAGEN) {
        const html = vorlageHtml(v, sprache);
        const pflicht = v.felder.filter((f) => f.pflicht).map((f) => f.id);
        expect(
          fehlendePflichtfelder(html, v).map((f) => f.id),
          `${v.id}/${sprache}`,
        ).toEqual(pflicht);
      }
    },
  );

  it("ausgefüllte englische Fassung erfüllt die deutsch definierte Pflicht", () => {
    const faq = std("std-faq");
    const html =
      "<h2>FAQ</h2><h3>Question</h3><p>Where is valve V-2?</p><h3>Answer</h3><p>Behind panel 3.</p>";
    expect(fehlendePflichtfelder(html, faq)).toEqual([]);
  });

  it("die sechs bestellten Standardvorlagen und die sechs übernommenen Startstrukturen", () => {
    expect(STANDARD_VORLAGEN.map((v) => v.name)).toEqual([
      "Regel",
      "Arbeitsanleitung",
      "Übergabe",
      "Projektentscheidung",
      "Besprechungsnotiz",
      "FAQ",
      "Störung beheben",
      "Sicherheitsrelevantes Wissen",
      "Checkliste",
      "Entscheidungshilfe",
    ]);
    // Übernommen aus `lib/bodyTemplates.ts`: procedure, handover, troubleshooting, safety,
    // checklist, decision — dieselben Kennungen, jetzt als Feldstruktur.
    for (const alt of [
      "procedure",
      "handover",
      "troubleshooting",
      "safety",
      "checklist",
      "decision",
    ]) {
      expect(
        STANDARD_VORLAGEN.some((v) => v.id === `std-${alt}`),
        alt,
      ).toBe(true);
    }
  });
});

describe("K9 · Vorrangregel", () => {
  const regel = std("std-regel");
  const faq = std("std-faq");
  const alle = [regel, faq];
  const immer = () => true;

  it("Space-Vorgabe vor persönlichem Standard — und der Standard wird als verdrängt benannt", () => {
    const w = waehleStartvorlage({
      spaceName: "Instandhaltung",
      vorgabe: { ...KEINE_VORGABE, verbindlicheVorlageId: "std-faq" },
      standardId: "std-regel",
      alle,
      anwendbar: immer,
    });
    expect(w.quelle).toBe("space");
    expect(w.vorlage?.id).toBe("std-faq");
    expect(w.verdraengt).toEqual({ id: "std-regel", name: "Regel" });
  });

  it("nicht mehr verfügbarer Standard → freie Eingabe mit Grund, nie stilles Verschwinden", () => {
    const aus = { ...regel, ausgemustert: true };
    const w = waehleStartvorlage({
      spaceName: null,
      vorgabe: null,
      standardId: "std-regel",
      alle: [aus, faq],
      anwendbar: (v) => !v.ausgemustert,
    });
    expect(w.quelle).toBe("frei");
    expect(w.vorlage).toBeNull();
    expect(w.ersatzFuer).toEqual({ id: "std-regel", name: "Regel", grund: "ausgemustert" });
    const weg = waehleStartvorlage({
      spaceName: null,
      vorgabe: null,
      standardId: "geloescht-oder-fremd",
      alle,
      anwendbar: immer,
    });
    expect(weg.ersatzFuer).toEqual({
      id: "geloescht-oder-fremd",
      name: null,
      grund: "nicht_verfuegbar",
    });
  });
});

describe("K8 · Pflichtangaben einer Space-Vorgabe", () => {
  it("Kategorie aus der Liste, Mindestzahl Tags, Pflichtfeld — je Befund eine Meldung", () => {
    const befunde = pruefeAngaben({
      bodyHtml: vorlageHtml(std("std-procedure"), "de"),
      category: "Allgemein",
      tags: [],
      vorlage: std("std-procedure"),
      verbindlich: null,
      vorgabe: { ...KEINE_VORGABE, kategorien: ["Instandhaltung"], mindestensTags: 2 },
      spaceId: "s1",
      spaceName: "Instandhaltung",
      begriffe: [],
    });
    expect(befunde.map((b) => b.art)).toEqual([
      "vorlagenfeld",
      "kategorie_nicht_erlaubt",
      "tags_fehlen",
    ]);
    expect(befunde.every((b) => b.meldung.length > 10)).toBe(true);
  });

  it("„Allgemein“ zählt nicht als angegebene Pflichtkategorie", () => {
    const befunde = pruefeAngaben({
      bodyHtml: "",
      category: "Allgemein",
      tags: ["x"],
      vorlage: null,
      verbindlich: null,
      vorgabe: { ...KEINE_VORGABE, pflichtKategorie: true },
      spaceId: "s1",
      spaceName: "S",
      begriffe: [],
    });
    expect(befunde.map((b) => b.art)).toEqual(["kategorie_fehlt"]);
  });

  it("Eingaben werden am Rand geprüft", () => {
    expect(bezugAus(null)).toBeNull();
    expect(bezugAus({ id: "std-faq", version: 1 })).toEqual({
      id: "std-faq",
      version: 1,
      spaceId: null,
    });
    expect(bezugAus({ id: "", version: 1 })).toBe("ungueltig");
    expect(bezugAus({ id: "x", version: 0 })).toBe("ungueltig");
    expect(() =>
      pruefeVorlageEingabe({ name: "Doppelt", felder: [{ titel: "A" }, { titel: "a" }] }),
    ).toThrow(/doppelt/);
    expect(() => pruefeVorlageEingabe({ name: "Ohne Felder", felder: [] })).toThrow();
  });
});
