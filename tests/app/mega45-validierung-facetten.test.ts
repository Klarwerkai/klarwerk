// ================================================================================================
// AUFTRAG-mega45 BLOCK H (SCRUM-425) — DIE VALIDIERUNG BEKOMMT DIE FILTERSCHIENE.
// ================================================================================================
//
// Der Filter-Vorschlag vom 25.07. ist gebaut — als `FacetFilter` mit Zaehlern, ausgegrauten
// Null-Treffern, aktiven Pillen und „Alle zuruecksetzen". Eingesetzt war er nur in `Library.tsx`.
// SCRUM-425 beschreibt genau diese Luecke.
//
// Dieser Test haelt die drei Zusagen des Blocks fest:
//   H-1 · DIESELBE KOMPONENTE, nicht eine zweite Fassung.
//   H-2 · KEIN FUNKTIONSVERLUST an den Pruef-Aktionen — und keine neue Datenabhaengigkeit.
//   H-3 · Die Facettenwerte stammen aus Feldern, die die Karten ohnehin rendern.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
// JOB 3027: die Facettenwerte werden aus einer PRUEFBRETT-ZEILE gebildet — also aus dem Objekt UND
// der Auskunft der Route (Stufe/Herkunft samt Beleglage), nicht mehr aus dem Objekt allein.
import {
  type AuskunftsFelder,
  type PruefZeile,
  pruefZeile,
} from "../../apps/web/src/lib/boardAuskunft";
import {
  VALIDATION_FACET_CONFIGS,
  validationFacetValues,
} from "../../apps/web/src/lib/validationFacets";

const WURZEL = process.cwd();
const VALIDATION = readFileSync(join(WURZEL, "apps/web/src/pages/Validation.tsx"), "utf8");
// JOB 3063 (H4): die Filterlogik der Bibliothek wohnt in der Fläche, nicht mehr in der Seitendatei.
const BIBLIOTHEK = readFileSync(
  join(WURZEL, "apps/web/src/components/bibliothek/BibliothekFlaeche.tsx"),
  "utf8",
);

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Lieferzeiten",
    statement: "Fuenf Werktage.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Logistik",
    tags: [],
    confidence: 50,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "u-anna",
    author: "u-anna",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as KnowledgeObject;
}

/**
 * Dieselbe Vorlage als PRUEFBRETT-ZEILE. Ohne weitere Angabe traegt sie KEINE Auskunftsfelder —
 * das ist der Antwortstand von vor JOB 3003 und damit die Lage „Auskunft fehlt".
 */
function zeile(
  over: Partial<Omit<KnowledgeObject, "confidentiality" | "origin">> & AuskunftsFelder = {},
): PruefZeile {
  const { confidentiality, confidentialityProvenance, origin, originSources, ...koFelder } = over;
  return pruefZeile({
    ...ko(koFelder),
    ...(confidentiality === undefined ? {} : { confidentiality }),
    ...(confidentialityProvenance === undefined ? {} : { confidentialityProvenance }),
    ...(origin === undefined ? {} : { origin }),
    ...(originSources === undefined ? {} : { originSources }),
  });
}

describe("mega45 H · die Filterschiene der Validierung", () => {
  it("H-1: eine Fassung im Baum — und die Validierung nimmt sie, ohne eine eigene zu bauen", () => {
    // JOB 3063 (H4) — WAS HIER FRÜHER STAND: „es ist DIESELBE Komponente wie in der Bibliothek",
    // geprüft an derselben Importzeile in beiden Seiten. Die Bibliothek hat seit H4 KEINE
    // Filterschiene mehr — ihre zehn Facetten liegen im Menü „Filter" (Pedis Entscheidung vom
    // 04.09.: Erklärtext und Filterwände gehören hinter Menüs). Die Zusicherung „dieselbe
    // Komponente" wäre damit ein Pin auf eine Fläche, die es nicht mehr gibt.
    //
    // WAS BLEIBT und was der Fall wirklich schützen sollte: die Validierung baut sich KEINE eigene
    // zweite Schiene, sondern nimmt die eine vorhandene Komponente.
    const importZeile = /import\s*\{\s*FacetFilter\s*\}\s*from\s*"\.\.\/components\/FacetFilter"/;
    expect(VALIDATION).toMatch(importZeile);
    expect(VALIDATION).not.toMatch(/function\s+ValidationFacetFilter/);
    expect(VALIDATION).toContain("<FacetFilter");
    // Die Bibliothek filtert weiter über DIESELBE Logik (`lib/facetRail.ts`), nur über Menüs —
    // kein zweiter Filterweg, keine zweite Wertermittlung.
    expect(BIBLIOTHEK).toMatch(/from\s*"\.\.\/\.\.\/lib\/facetRail"/);
    expect(BIBLIOTHEK).toContain("facetRailGroups(");
    expect(BIBLIOTHEK).not.toContain("<FacetFilter");
  });

  it("H-2: keine neue Datenabhaengigkeit — die Schiene bringt keine zweite Abfrage mit", () => {
    // Konfliktlage waere die naheliegende dritte Facette und ist BEWUSST nicht gebaut: sie braeuchte
    // `useConflicts` und damit eine zweite Lade-/Fehlerquelle auf dem Pruef-Board. Steht im Bericht.
    expect(VALIDATION).not.toMatch(/useConflicts/);
    // Es bleibt bei der einen Board-Abfrage.
    expect(VALIDATION.match(/useValidationBoard\(/g)?.length).toBe(1);
  });

  it("H-2: die Pruef-Aktionen und die vorhandenen Filter sind unberuehrt", () => {
    // Die Entscheidungs-Mechanik des Boards.
    for (const anker of [
      "matchesValidationFilter",
      "matchesReviewFocus",
      "matchesDemoKnowledgeFilter",
      "sortByReviewPriority",
      "countByReviewFocus",
      "mineQueueEmptyHint",
    ]) {
      expect(VALIDATION, `${anker} fehlt — Pruef-Logik angetastet`).toContain(anker);
    }
    // Und die drei klassischen Auswahlfelder sind NICHT durch die Schiene ersetzt worden.
    expect(VALIDATION).toContain("categoryOptions");
    expect(VALIDATION).toContain("tagOptions");
    expect(VALIDATION).toContain("typeOptions");
  });

  it("H-2: die Schiene ueberlebt Lade- und Fehlerzustand (Ableitung ausserhalb QueryState)", () => {
    // Die Bibliothek hat diesen Rueckschritt bereits benannt und vermieden: laege die Ableitung im
    // children-Slot, verschwaende die Schiene bei jedem Lade- und Fehlerzustand.
    //
    // JOB 3061 · H2: `QueryState` gibt es auf dieser Seite nicht mehr — die vier Lagen (laden,
    // leer, Erstfehler, Bestand) zeichnet die Fläche selbst (`flaechenZustand`). Die MESSUNG ist
    // dieselbe geblieben: die Ableitung steht VOR der Fläche, die die Lagen unterscheidet, und die
    // Schiene wird deshalb in keiner davon abgeräumt.
    const ableitung = VALIDATION.indexOf("const facetGroups = facetRailGroups(");
    const flaeche = VALIDATION.indexOf('data-testid="pruefen-flaeche"');
    expect(ableitung).toBeGreaterThan(0);
    expect(flaeche).toBeGreaterThan(0);
    expect(ableitung).toBeLessThan(flaeche);
    // Und die Lagen-Unterscheidung selbst ist da — sonst wäre „vor der Fläche" trivial erfüllt.
    expect(VALIDATION).toContain("flaechenZustand(query)");
  });

  it("H-3: die Facettenwerte kommen aus dem Objekt selbst — keine erfundene Dimension", () => {
    const werte = validationFacetValues(zeile());
    expect(Object.keys(werte).sort()).toEqual(VALIDATION_FACET_CONFIGS.map((c) => c.key).sort());
    // Jede Facette liefert genau die Werte des Objekts, nichts Geratenes.
    expect(werte.pruefstand).toEqual(["validated"]);
    expect(werte.trust).toEqual(["t70"]);
    // JOB 3027 (Ablösung, nachgeführt): Hier stand `["intern"]` — für ein Objekt, das gar keine
    // Stufe trägt und dessen Antwort auch keine Beleglage mitbringt. Das war genau die Glättung
    // durch `confidentialityOf`, die JOB 3027 abgelöst hat: die Schiene behauptete eine Einstufung,
    // die nie jemand gesetzt hat. Der Wert kommt jetzt aus `boardAuskunft` und benennt die Lage.
    expect(werte.confidentiality).toEqual(["auskunft_fehlt"]);
    expect(werte.author).toEqual(["u-anna"]);

    // Die drei Lagen, jede mit ihrem eigenen Wert — und „nicht eingestuft" ist keine Stufe.
    expect(
      validationFacetValues(zeile({ confidentiality: null, confidentialityProvenance: "unknown" }))
        .confidentiality,
    ).toEqual(["nicht_eingestuft"]);
    expect(
      validationFacetValues(zeile({ confidentiality: "intern", confidentialityProvenance: "ko" }))
        .confidentiality,
    ).toEqual(["intern"]);

    // Und sie folgt dem Objekt, statt einen Zustand zu erfinden.
    const offen = validationFacetValues(zeile({ status: "offen", trust: 0, assignments: [] }));
    expect(offen.pruefstand).toEqual(["new"]);
    const zugewiesen = validationFacetValues(
      zeile({ status: "offen", trust: 10, assignments: ["u-bernd"] }),
    );
    expect(zugewiesen.pruefstand).toEqual(["assigned"]);
  });

  it("H-3: jede Facettengruppe traegt einen Beschriftungsschluessel", () => {
    for (const c of VALIDATION_FACET_CONFIGS) {
      expect(c.labelKey, `Facette ${c.key} ohne labelKey`).toMatch(/^[a-z]+\.facet\./);
    }
  });
});
