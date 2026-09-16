// ================================================================================================
// JOB 4213 · WIKI-NACHVOLLZIEHEN — ZWEI FREI GEWÄHLTE FASSUNGEN, MIT BEIDEN WERTEN.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (Basisstand f5fe18b): `koVersionDiff.ts` kannte GENAU EINEN
// Vergleich — jede Fassung gegen ihren unmittelbaren Vorgänger (`const prev = asc[index - 1]`,
// `versionDiffs`), und das Ergebnis war eine Liste von FELDNAMEN (`changed: KoVersionDiffField[]`).
// Zwei frei gewählte Fassungen liessen sich nicht vergleichen, und WAS in einem Feld anders ist,
// stand nirgends. Vor dieser Runde ist jeder Fall dieser Datei rot, weil `paarDiff` nicht existiert.
//
// WAS HIER AUSSERDEM GEMESSEN WIRD, und das ist der eigentliche Punkt: dass der neue Weg die
// VORHANDENE Regel benutzt und nicht danebenbaut. Die Berichtsfälle C und D stammen wörtlich aus
// `tests/ux28-fassungen/berichtsaenderung-ist-eine-aenderung.test.ts` — reine Einrückung gilt
// weiterhin als unverändert, eine zusätzliche Auszeichnung als geändert. Wäre hier eine zweite
// Vergleichsregel entstanden, gingen diese beiden Fälle auseinander, und genau das würde auffallen.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject, KoVersionSnapshot } from "../../apps/web/src/api/types";
import { diffForVersion, paarDiff, versionDiffs } from "../../apps/web/src/lib/koVersionDiff";

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone",
    statement: "Nach jeder Schicht nass reinigen.",
    bodyHtml: "<p>Alt</p>",
    conditions: ["Anlage steht"],
    measures: ["Nassreinigung"],
    type: "technik",
    category: "Produktion",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
    ...overrides,
  } as KnowledgeObject;
}

function fassung(version: number, overrides: Partial<KnowledgeObject> = {}): KoVersionSnapshot {
  return {
    koId: "ko-1",
    version,
    at: `2026-08-0${version}T10:00:00.000Z`,
    author: "u1",
    note: "überarbeitet",
    snapshot: ko({ version, ...overrides }),
  };
}

/**
 * DREI FASSUNGEN, in denen sich JEDE Fassung von ihrer Nachbarin in EINEM anderen Feld
 * unterscheidet. Nur so trennt sich „v1 gegen v3" wirklich von „v2 gegen v3": wer weiterhin den
 * Vorgänger vergliche, fände hier NUR die Maßnahmen und nicht auch die Aussage.
 */
const DREI = [
  fassung(1, { statement: "Nur trocken abkehren.", measures: ["Trockenreinigung"] }),
  fassung(2, { statement: "Nach jeder Schicht nass reinigen.", measures: ["Trockenreinigung"] }),
  fassung(3, { statement: "Nach jeder Schicht nass reinigen.", measures: ["Nassreinigung"] }),
];

describe("JOB 4213 · A — v1 gegen v3, nicht v2 gegen v3", () => {
  it("nennt die Felder, die sich zwischen den GEWÄHLTEN Fassungen unterscheiden", () => {
    const d = paarDiff(DREI, 1, 3);
    expect(d, "paarDiff findet die gewählten Fassungen nicht").not.toBeNull();
    expect(d?.von).toBe(1);
    expect(d?.bis).toBe(3);
    expect(
      d?.felder.map((f) => f.feld).sort(),
      "der Vergleich hängt weiterhin am unmittelbaren Vorgänger",
    ).toEqual(["measures", "statement"]);
  });

  it("liefert je Feld BEIDE Werte — alt und neu, nicht nur den Namen", () => {
    const d = paarDiff(DREI, 1, 3);
    const aussage = d?.felder.find((f) => f.feld === "statement");
    expect(aussage?.alt, "der ALTE Wert fehlt").toBe("Nur trocken abkehren.");
    expect(aussage?.neu, "der NEUE Wert fehlt").toBe("Nach jeder Schicht nass reinigen.");
    const massnahmen = d?.felder.find((f) => f.feld === "measures");
    expect(massnahmen?.alt).toBe("Trockenreinigung");
    expect(massnahmen?.neu).toBe("Nassreinigung");
  });

  it("die Reihenfolge der Eingabe entscheidet nicht, was „alt“ heisst", () => {
    expect(paarDiff(DREI, 3, 1)).toEqual(paarDiff(DREI, 1, 3));
  });

  it("dieselbe Fassung zweimal ist keine Verneinung über eine Änderung", () => {
    const d = paarDiff(DREI, 2, 2);
    expect(d?.von).toBe(2);
    expect(d?.bis).toBe(2);
    expect(d?.felder).toEqual([]);
  });

  it("eine Fassung, die es im Bestand nicht gibt, ergibt KEINE leere Feldliste", () => {
    // Die leere Liste läse sich als „zwischen diesen beiden hat sich nichts geändert" — eine
    // Tatsachenbehauptung über einen Stand, der gar nicht vorliegt.
    expect(
      paarDiff(DREI, 1, 9),
      "eine fehlende Fassung wird als „keine Änderung“ gelesen",
    ).toBeNull();
    expect(paarDiff([], 1, 2)).toBeNull();
  });
});

describe("JOB 4213 · B — die vorhandene Berichtsregel wird BENUTZT, nicht nachgebaut", () => {
  // Wörtlich dieselben zwei Aussagen wie `tests/ux28-fassungen/…-ist-eine-aenderung.test.ts` C/D.
  const mitBericht = (v: number, html: string): KoVersionSnapshot => fassung(v, { bodyHtml: html });

  it("C · reine Einrückung im Bericht gilt weiterhin als UNVERÄNDERT", () => {
    const bestand = [
      mitBericht(1, "<p>a</p>\n  <p>b</p>"),
      mitBericht(2, "<p>x</p>"),
      mitBericht(3, "<p>a</p><p>b</p>"),
    ];
    expect(
      paarDiff(bestand, 1, 3)?.felder.map((f) => f.feld),
      "eine Serialisierungsdifferenz gilt als Inhaltsänderung",
    ).toEqual([]);
  });

  it("D · eine zusätzliche Auszeichnung gilt als GEÄNDERT", () => {
    const bestand = [
      mitBericht(1, "<p>nicht freigeben</p>"),
      mitBericht(2, "<p>zwischendrin</p>"),
      mitBericht(3, "<p><strong>nicht</strong> freigeben</p>"),
    ];
    const d = paarDiff(bestand, 1, 3);
    expect(d?.felder.map((f) => f.feld)).toEqual(["bodyHtml"]);
    // Der Bericht kommt als ROH-HTML zurück — er wird auf der Fläche über `SanitizedHtml`
    // gezeichnet, nicht als Klartext. Eine Kürzung hier wäre eine zweite Darstellungsregel.
    expect(d?.felder[0]?.alt).toBe("<p>nicht freigeben</p>");
    expect(d?.felder[0]?.neu).toBe("<p><strong>nicht</strong> freigeben</p>");
  });
});

describe("JOB 4213 · C — der alte Weg bleibt, er wird nicht ersetzt", () => {
  // Die Änderungszeile der Fassungskarte (`MehrAbschnitte.tsx`) hängt an diesen beiden Funktionen.
  it("`versionDiffs` und `diffForVersion` vergleichen weiterhin mit dem Vorgänger", () => {
    expect(versionDiffs(DREI).map((d) => [d.fromVersion, d.toVersion, d.changed])).toEqual([
      [null, 1, []],
      [1, 2, ["statement"]],
      [2, 3, ["measures"]],
    ]);
    expect(diffForVersion(DREI, 3)?.fromVersion).toBe(2);
  });
});

describe("JOB 4213 · D — fehlend, null und leer sind EINE Aussage", () => {
  it("ein fehlender Bericht steht als leerer Wert da, nicht als „null“", () => {
    const bestand = [
      fassung(1, { bodyHtml: null as unknown as string }),
      fassung(2, { bodyHtml: "<p>Jetzt steht hier etwas.</p>" }),
    ];
    const d = paarDiff(bestand, 1, 2);
    expect(d?.felder.map((f) => f.feld)).toEqual(["bodyHtml"]);
    expect(d?.felder[0]?.alt).toBe("");
  });

  it("Listenfelder kommen als lesbare Werte, nicht als Rohobjekte", () => {
    const bestand = [
      fassung(1, { conditions: ["Anlage steht", "Schicht zu Ende"] }),
      fassung(2, { conditions: [] }),
    ];
    const d = paarDiff(bestand, 1, 2);
    expect(d?.felder[0]?.alt).toBe("Anlage steht · Schicht zu Ende");
    expect(d?.felder[0]?.neu).toBe("");
  });
});
