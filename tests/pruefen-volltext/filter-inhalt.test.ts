// ================================================================================================
// JOB 3290 · A — „VOLLTEXT FILTERN" IN PRÜFEN DURCHSUCHT DEN VOLLTEXT NICHT.
// ================================================================================================
//
// DER BEFUND (Codex, review26-bibliothek-pruefen 1/2, Live 1.185–1.187, Beleg
// 38-pruefen-volltext-ende.png): der Endmarker `ENDE-REV26-065813` steht im AUSFÜHRLICHEN INHALT
// eines Wissensobjekts. Die Bibliothek findet ihn. „Volltext filtern" in Prüfen fand ihn zweimal
// nicht — 0 Treffer. Dieselbe Marke in der Kernaussage: 1 Treffer.
//
// DIE URSACHE, gemessen: `matchesValidationFilter` baut seinen Heuhaufen aus Titel, Aussage,
// Bedingungen, Maßnahmen, Kategorie und Schlagwörtern (`apps/web/src/lib/validationFilters.ts`,
// `haystack`). `bodyHtml` — also genau das, was der Mensch geschrieben und gelesen hat — kommt
// darin nicht vor. Das Feld LIEGT der Fläche vor: `GET /api/validation/board` gibt VOLLE
// Wissensobjekte aus (`services/validation/src/service.ts:451` → `koService.list`; die
// Pg-Projektion ist dort bewusst `SELECT data` samt `bodyHtml`, `repo-pg.ts:530-539` — die
// body-freie Projektion gilt ausdrücklich NUR dem Suchpfad). Es wird nur nie gelesen.
//
// ================================================================================================
// WARUM DIESE DATEI DEN MANGEL MISST UND NICHT BEHEBT
// ================================================================================================
//
// Die Behebung ist EINE Zeile in `apps/web/src/lib/validationFilters.ts` (Heuhaufen um den
// Klartext aus `bodyHtml` erweitern, über die kanonische Reduktion `htmlToPlainText` aus
// `lib/richText.ts` — dieselbe, die die Entwurfsliste seit mega85 benutzt, `draftListView.ts:77`).
// Diese Datei steht NICHT in den Zielpfaden dieses Auftrags, und ein Diff ausserhalb der Zielpfade
// ist ungeprüfter Code (Runde 1 wurde genau dafür ROT). Die Zielpfade nennen `pruefenFilter*`,
// `Pruefen*.tsx` und `gap-routes.ts` — Dateien, die es im Produkt nicht gibt. Die Rückgabe nennt
// die Korrektur, die der Auftrag braucht.
//
// DIE TRENNLINIE dieser Datei läuft deshalb nicht zwischen „grün" und „rot", sondern zwischen zwei
// Arten von Aussage — dieselbe Bauform, die JOB 687 D6 nach bens Auflage eingeführt hat
// (`apps/web/src/pages/Validation.quittung.test.tsx:18-27`):
//
//   * `it(...)`       = Zustand, der HEUTE SCHON gilt und nie wieder fallen darf. Hier: die
//                       kurzen Felder sind durchsuchbar, die Filter wirken als AND, und derselbe
//                       Marker trifft, sobald er in der Aussage steht. Das ist zugleich die
//                       KALIBRIERUNG — ohne sie wäre jeder Fehlschlag unten ein Messartefakt.
//   * `it.fails(...)` = der gewünschte Nutzerzustand, HEUTE NOCH NICHT GEBAUT. Der Fall behauptet
//                       das Ziel und schlägt kausal fehl. Wird die Zeile gebaut, besteht die
//                       Erwartung, `it.fails` meldet das — und der Bauende stellt auf `it` um.
//
// KEIN Fall behauptet einen Mangel als Wunsch, und kein Fall ist dauerhaft rot: das Tor bleibt
// grün und weiss trotzdem, was fehlt.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  EMPTY_VALIDATION_FILTER,
  matchesValidationFilter,
} from "../../apps/web/src/lib/validationFilters";

/** Die Marke aus Codex' Beleg — wörtlich, damit die Abnahme dieselbe Zeichenfolge fährt. */
const MARKE = "ENDE-REV26-065813";

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Zu prüfendes Wissen",
    statement: "Eine Aussage ohne Marke.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-09-08T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

/** Der Filter mit genau einer gesetzten Suchzeile — alles andere neutral. */
function suche(k: KnowledgeObject, text: string): boolean {
  return matchesValidationFilter(k, { ...EMPTY_VALIDATION_FILTER, search: text }, "u1");
}

/** Das Objekt aus Codex' Fall: die Marke steht AUSSCHLIESSLICH im ausführlichen Inhalt. */
const markeNurImInhalt = ko({
  bodyHtml: `<p>Erster Absatz.</p><p>Letzter Absatz mit ${MARKE} am Ende.</p>`,
});

// ------------------------------------------------------------------------------------------------
// K — DIE KALIBRIERUNG. Sie steht VOR den erwarteten Fehlschlägen und ausserhalb von ihnen.
// ------------------------------------------------------------------------------------------------
describe("JOB 3290 A/K · was der Prüfen-Volltextfilter heute leistet (und nie verlieren darf)", () => {
  it("K1 · KALIBRIERUNG: DIESELBE Marke trifft, sobald sie in der Kernaussage steht", () => {
    // Der Gegenpol zu A1 unten: gleiches Objekt, gleiche Zeichenfolge, nur ein anderes Feld.
    // Damit ist bewiesen, dass die Marke suchbar IST und A1 nicht an ihr scheitert.
    expect(suche(ko({ statement: `Eine Aussage mit ${MARKE}.` }), MARKE)).toBe(true);
    expect(suche(markeNurImInhalt, MARKE)).toBe(false); // der Befund, hier als Tatsache festgehalten
  });

  it("K2 · KALIBRIERUNG: der Filter unterscheidet überhaupt — Treffer und Nicht-Treffer", () => {
    const objekt = ko({ title: "Absperrarmatur prüfen" });
    expect(suche(objekt, "Absperrarmatur")).toBe(true);
    expect(suche(objekt, "Turboverdichter")).toBe(false);
  });

  it("K3 · die kurzen Felder sind durchsuchbar — jedes einzeln gemessen", () => {
    const felder: Array<[string, Partial<KnowledgeObject>]> = [
      ["Titel", { title: `Titel ${MARKE}` }],
      ["Aussage", { statement: `Aussage ${MARKE}` }],
      ["Bedingungen", { conditions: [`Bedingung ${MARKE}`] }],
      ["Maßnahmen", { measures: [`Maßnahme ${MARKE}`] }],
      ["Kategorie", { category: `Anlage ${MARKE}` }],
      ["Tags", { tags: [MARKE] }],
    ];
    for (const [name, feld] of felder) {
      expect(suche(ko(feld), MARKE), `${name} ist nicht durchsuchbar`).toBe(true);
    }
  });

  it("K4 · Groß-/Kleinschreibung spielt keine Rolle", () => {
    const objekt = ko({ statement: "Drehmoment am Flansch" });
    expect(suche(objekt, "DREHMOMENT")).toBe(true);
    expect(suche(objekt, "flansch")).toBe(true);
  });

  it("K5 · die übrigen Filter wirken gemeinsam als AND", () => {
    const objekt = ko({ statement: `Aussage ${MARKE}`, category: "Anlage 1" });
    const mit = (zusatz: Partial<typeof EMPTY_VALIDATION_FILTER>) =>
      matchesValidationFilter(
        objekt,
        { ...EMPTY_VALIDATION_FILTER, search: MARKE, ...zusatz },
        "u1",
      );
    expect(mit({ category: "Anlage 1" })).toBe(true);
    expect(mit({ category: "Anlage 2" })).toBe(false);
    expect(
      matchesValidationFilter(objekt, { ...EMPTY_VALIDATION_FILTER, mineOnly: true }, "u1"),
    ).toBe(false);
  });

  it("K6 · ein Objekt ohne Inhalt bleibt filterbar und stürzt nicht ab", () => {
    // Die drei Formen, in denen „kein Inhalt" wirklich ankommt: ausdrückliches `null` (Board-/
    // Detailweg), FEHLENDER Schlüssel (Altbestand, body-freie Projektion) und die leere Zeichenkette.
    expect(suche(ko({ bodyHtml: null }), "Aussage")).toBe(true);
    expect(suche(ko(), "Aussage")).toBe(true);
    expect(suche(ko({ bodyHtml: "" }), "Aussage")).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// A — DER SOLLVERTRAG. Jeder Fall behauptet das Ziel und schlägt heute kausal fehl.
// ------------------------------------------------------------------------------------------------
describe("JOB 3290 A/S · SOLLVERTRAG: der Filter durchsucht auch den ausführlichen Inhalt", () => {
  it.fails("A1 · die Marke steht NUR im ausführlichen Inhalt und wird gefunden", () => {
    // Codex' Fall, wörtlich. Voraussetzung ausserhalb dieses Fehlschlags: K1 oben.
    expect(suche(markeNurImInhalt, MARKE)).toBe(true);
  });

  it.fails("A2 · die Marke in der Bildbeschreibung trifft (figcaption im Inhalt)", () => {
    const objekt = ko({
      bodyHtml: `<figure><img src="/api/objects/o1/raw" alt="Ventil"><figcaption>Ventil V2 ${MARKE}</figcaption></figure>`,
    });
    expect(suche(objekt, MARKE)).toBe(true);
  });

  it.fails(
    "A3 · die Bildbeschreibung trifft auch, wenn die Route sie OHNE bodyHtml liefert",
    () => {
      // Der Suchweg der Bibliothek liefert `captionTexts` und lässt `bodyHtml` weg
      // (`services/knowledge-object/src/repo.ts:473-493`). Ein Prüfbrett-Objekt aus einem solchen Weg
      // darf die Fußnote nicht verlieren — dieselbe Rückfallregel wie in `librarySearch.ts:172`.
      const objekt = ko({ bodyHtml: null, captionTexts: [`Ventil V2 ${MARKE}`] });
      expect(suche(objekt, MARKE)).toBe(true);
    },
  );

  it.fails("A4 · sichtbarer Klartext bleibt suchbar, auch über Auszeichnung hinweg", () => {
    // Der Suchvertrag, den `htmlToPlainText` mitbringt und den die Behebung erben MUSS: `<em>`
    // verschwindet spurlos, eine Absatzgrenze wird zu GENAU EINEM Leerzeichen. Das Artefakt der
    // alten, naiven Reduktion („V2 ,") ist dabei ausdrücklich KEIN Treffer.
    const objekt = ko({ bodyHtml: "<p>Ventil <em>V2</em>, sichtbar</p><p>Ende</p>" });
    expect(suche(objekt, "Ventil V2, sichtbar")).toBe(true);
    expect(suche(objekt, "sichtbar Ende")).toBe(true);
    expect(suche(objekt, "V2 ,")).toBe(false);
  });

  it.fails(
    "A5 · ANTI-VAKUUM des Sollvertrags: eine Marke, die nirgends steht, trifft NICHT",
    () => {
      // Dieser Fall schlägt heute aus dem GEGENTEILIGEN Grund fehl wie A1: die erste Erwartung
      // (Nicht-Treffer) gilt schon jetzt, die zweite (Treffer im Inhalt) nicht. Er ist der Schutz
      // davor, den Filter später einfach auf „trifft immer" zu stellen — dann bliebe A1 grün, dieser
      // Fall aber würde als bestanden gemeldet und die Umstellung auf `it` fiele auf.
      expect(suche(ko({ bodyHtml: "<p>Ein Absatz ohne jede Marke.</p>" }), MARKE)).toBe(false);
      expect(suche(ko({ bodyHtml: `<p>${MARKE}</p>` }), MARKE)).toBe(true);
    },
  );
});
