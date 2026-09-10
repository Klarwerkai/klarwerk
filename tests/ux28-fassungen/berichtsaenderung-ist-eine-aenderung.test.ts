// ================================================================================================
// JOB 3475 · UX-28 — EINE BERICHTSÄNDERUNG IST EINE ÄNDERUNG.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (`apps/web/src/lib/koVersionDiff.ts:29-39` am Basisstand
// 9c3f0ce): verglichen wurden GENAU SECHS Felder — `title`, `statement`, `conditions`, `measures`,
// `type`, `status`. Der ausführliche Bericht (`bodyHtml`, `api/types.ts:337`) war NICHT darunter.
// Wer nur den Bericht überarbeitete, las danach auf der Fassungskarte
// (`MehrAbschnitte.tsx:1490-1493`) „Keine Änderung in den Hauptfeldern" — eine Aussage, die der
// gespeicherte Stand nicht deckt.
//
// WAS HIER GEMESSEN WIRD: die Ableitung selbst, an zwei Schnappschüssen, die sich AUSSCHLIESSLICH
// im Bericht unterscheiden. Der Gegenfall (zwei gleiche Schnappschüsse bleiben `[]`) steht
// gleichrangig daneben: ohne ihn machte ein „alles ist geändert" diese Datei grün.
//
// DIE ENTSCHEIDUNG, DIE HIER MITGEPRÜFT WIRD — WORAUF DER BERICHT VERGLICHEN WIRD.
//
// RUNDE 2, KORREKTURPFLICHT 1 (BEN): Runde 1 verglich das Roh-HTML mit UNTERSCHIEDSLOS entferntem
// Leerraum zwischen allen Tags. Damit galt
//     `<strong>nicht</strong> <em>freigeben</em>`  ==  `<strong>nicht</strong><em>freigeben</em>`
// als unverändert — obwohl ein Mensch dort „nicht freigeben" gegen „nichtfreigeben" liest. Genau
// diese falsche Verneinung sollte UX-28 beseitigen; sie war nur eine Ebene tiefer gerutscht.
//
// JETZT trägt der Vergleich ZWEI Teile, und geändert ist, was in EINEM von beiden abweicht:
//   1. der SICHTBARE TEXT (`htmlToPlainText`, die eine Textreduktion dieses Hauses) — er trennt
//      bedeutungslosen Leerraum zwischen Blockelementen von sichtbarem Leerraum zwischen
//      Inline-Elementen, weil er GENAU für die Blockenden ein Leerzeichen einsetzt und sonst nur
//      Tags entfernt.
//   2. das MARKUP ohne Leerraum zwischen Tags — es fängt, was der Text nicht sieht: eine
//      Formatierung mehr, ein anderes Bild, ein anderes Ziel.
// Damit gilt:
//   · reine Einrückung/Serialisierung (`<p>a</p>\n  <p>b</p>` gegen `<p>a</p><p>b</p>`)
//     → UNVERÄNDERT (Fall C)
//   · eine Formatierung mehr (`<strong>` um ein Wort) → GEÄNDERT (Fall D)
//   · sichtbarer Leerraum zwischen Inline-Elementen → GEÄNDERT (Fall F, BENs Gegenfall)
// Ein Vergleich NUR auf dem Textauszug wäre der falsche Weg: er meldete für Fall D „keine
// Änderung", obwohl der gespeicherte Bericht ein anderer ist.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject, KoVersionSnapshot } from "../../apps/web/src/api/types";
import { diffForVersion, versionDiffs } from "../../apps/web/src/lib/koVersionDiff";

const BERICHT_V1 = "<p>Die Spritzzone wird nach jeder Schicht nass gereinigt.</p>";
const BERICHT_V2 =
  "<p>Die Spritzzone wird nach jeder Schicht nass gereinigt.</p><p>Zusatz: Die Dichtungen werden dabei geprüft.</p>";

function ko(version: number, overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone Linie 3",
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml: BERICHT_V1,
    conditions: ["Anlage steht"],
    measures: ["Nassreinigung"],
    type: "technik",
    category: "Instandhaltung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    history: [],
    ...overrides,
  };
}

function snap(version: number, overrides: Partial<KnowledgeObject> = {}): KoVersionSnapshot {
  return {
    koId: "ko-1",
    version,
    snapshot: ko(version, overrides),
    at: `2026-08-01T10:0${version}:00.000Z`,
    author: "u1",
    note: version === 1 ? "erstellt" : "überarbeitet",
  };
}

/** Die geänderten Felder der Fassung `version` — der Weg, den die Fassungskarte selbst geht. */
function geaendert(snapshots: readonly KoVersionSnapshot[], version: number): string[] {
  const diff = diffForVersion(snapshots, version);
  if (!diff) {
    throw new Error(`Kein Diff für v${version} — die Ableitung liefert die Fassung nicht.`);
  }
  return [...diff.changed];
}

describe("JOB 3475 · A — nur der Bericht ist anders", () => {
  it("meldet „bodyHtml“ als geändertes Feld, und nur dieses", () => {
    const zeilen = geaendert([snap(1), snap(2, { bodyHtml: BERICHT_V2 })], 2);
    expect(
      zeilen,
      "Eine reine Berichtsänderung wird nicht als Änderung gemeldet — die Karte behauptete „keine Änderung“.",
    ).toEqual(["bodyHtml"]);
  });

  it("nennt Aussage UND Bericht, wenn beides anders ist", () => {
    const zeilen = geaendert(
      [snap(1), snap(2, { statement: "Neue Aussage.", bodyHtml: BERICHT_V2 })],
      2,
    );
    expect(zeilen, "Die Änderungsangabe verliert eines der beiden Felder.").toEqual([
      "statement",
      "bodyHtml",
    ]);
  });
});

describe("JOB 3475 · B — der Gegenfall: gleich bleibt gleich", () => {
  it("zwei gleiche Schnappschüsse ergeben KEINE Änderung", () => {
    expect(
      geaendert([snap(1), snap(2)], 2),
      "Jede Fassung gilt als geändert — dann sagt die Angabe nichts mehr.",
    ).toEqual([]);
  });

  it("die Ausgangsfassung hat keinen Vorgänger und deshalb keinen Diff", () => {
    expect(versionDiffs([snap(1)])).toEqual([{ fromVersion: null, toVersion: 1, changed: [] }]);
  });

  it("fehlender und leerer Bericht sind dasselbe: „am Objekt steht kein Bericht“", () => {
    expect(
      geaendert([snap(1, { bodyHtml: null }), snap(2, { bodyHtml: "" })], 2),
      'Aus `null` gegen `""` wird eine Änderung erfunden.',
    ).toEqual([]);
  });

  it("ein zuvor fehlender Bericht, der jetzt da ist, IST eine Änderung", () => {
    expect(geaendert([snap(1, { bodyHtml: null }), snap(2, { bodyHtml: BERICHT_V2 })], 2)).toEqual([
      "bodyHtml",
    ]);
  });
});

describe("JOB 3475 · C/D — die getroffene Entscheidung, wie HTML verglichen wird", () => {
  it("C: reine Einrückung zwischen den Tags gilt als UNVERÄNDERT", () => {
    const eingerueckt = "<p>Die Spritzzone wird nach jeder Schicht nass gereinigt.</p>\n  ";
    expect(
      geaendert([snap(1), snap(2, { bodyHtml: eingerueckt })], 2),
      "Aus einer anderen Zeilenschaltung wird eine Inhaltsänderung.",
    ).toEqual([]);
  });

  it("D: eine zusätzliche Formatierung gilt als GEÄNDERT", () => {
    const fett = "<p>Die Spritzzone wird nach <strong>jeder</strong> Schicht nass gereinigt.</p>";
    expect(
      geaendert([snap(1), snap(2, { bodyHtml: fett })], 2),
      "Der gespeicherte Bericht ist ein anderer, die Karte behauptet „keine Änderung“.",
    ).toEqual(["bodyHtml"]);
  });
});

// ------------------------------------------------------------------------------------------------
// F — RUNDE 2 · KORREKTURPFLICHT 1: SICHTBARER LEERRAUM ZWISCHEN INLINE-ELEMENTEN.
// ------------------------------------------------------------------------------------------------
// BENs Gegenfall wörtlich: zwischen zwei Inline-Elementen ist das Leerzeichen KEIN Formatierungs-
// leerraum, sondern Text. Wer es entfernt, ändert, was ein Mensch liest.
describe("JOB 3475 · F — Leerraum, den man SIEHT, ist eine Änderung", () => {
  const MIT_RAUM = "<p><strong>nicht</strong> <em>freigeben</em></p>";
  const OHNE_RAUM = "<p><strong>nicht</strong><em>freigeben</em></p>";

  it("F1 · „nicht freigeben“ gegen „nichtfreigeben“ ist eine Änderung", () => {
    expect(
      geaendert([snap(1, { bodyHtml: MIT_RAUM }), snap(2, { bodyHtml: OHNE_RAUM })], 2),
      "Aus „nicht freigeben“ wurde „nichtfreigeben“, und die Karte behauptet „keine Änderung“.",
    ).toEqual(["bodyHtml"]);
  });

  it("F2 · derselbe Bericht bleibt unverändert — auch mit Inline-Auszeichnung", () => {
    expect(
      geaendert([snap(1, { bodyHtml: MIT_RAUM }), snap(2, { bodyHtml: MIT_RAUM })], 2),
      "Ein unveränderter Bericht gilt plötzlich als geändert.",
    ).toEqual([]);
  });

  it("F3 · Leerraum ZWISCHEN Blöcken bleibt bedeutungslos, auch über mehrere Absätze", () => {
    const eng = "<p>Erster Absatz.</p><p>Zweiter Absatz.</p>";
    const weit = "<p>Erster Absatz.</p>\n  <p>Zweiter Absatz.</p>\n";
    expect(
      geaendert([snap(1, { bodyHtml: eng }), snap(2, { bodyHtml: weit })], 2),
      "Aus einer anderen Einrückung wurde eine Inhaltsänderung.",
    ).toEqual([]);
  });

  it("F4 · auch Listen- und Tabellenzellen zählen als Blockenden, nicht als Text", () => {
    const eng = "<ul><li>Eins</li><li>Zwei</li></ul>";
    const weit = "<ul>\n  <li>Eins</li>\n  <li>Zwei</li>\n</ul>";
    expect(geaendert([snap(1, { bodyHtml: eng }), snap(2, { bodyHtml: weit })], 2)).toEqual([]);
  });

  it("F5 · die BEWUSST in Kauf genommene Einordnung: Inline direkt vor einem Block", () => {
    // `<strong>a</strong><p>b</p>` gegen `<strong>a</strong> <p>b</p>`: im Browser sieht man den
    // Unterschied nicht (der Absatz beginnt ohnehin neu), der Textvergleich meldet ihn trotzdem.
    // Das bleibt so: „geändert" ist die SCHWÄCHERE Aussage, und der Fall entsteht aus dem Editor
    // dieses Hauses gar nicht (der Fließtext liegt immer in Blockbehältern). Ein Sonderweg dafür
    // wäre eine zweite Tag-Aufstellung neben `htmlToPlainText` — genau die Doppelung, gegen die
    // dieses Haus mehrfach angetreten ist.
    const a = "<strong>Hinweis</strong><p>Text.</p>";
    const b = "<strong>Hinweis</strong> <p>Text.</p>";
    expect(geaendert([snap(1, { bodyHtml: a }), snap(2, { bodyHtml: b })], 2)).toEqual([
      "bodyHtml",
    ]);
  });
});

describe("JOB 3475 · E — die sechs bisherigen Felder bleiben, wie sie waren", () => {
  it("erkennt weiterhin genau das geänderte Kernfeld", () => {
    expect(geaendert([snap(1), snap(2, { statement: "Andere Aussage." })], 2)).toEqual([
      "statement",
    ]);
    expect(geaendert([snap(1), snap(2, { conditions: ["Anlage steht", "Neu"] })], 2)).toEqual([
      "conditions",
    ]);
    expect(geaendert([snap(1), snap(2, { status: "validiert" })], 2)).toEqual(["status"]);
  });
});
