// ================================================================================================
// JOB 3475 · UX-28 — ZWEI FASSUNGEN SIND UNTERSCHEIDBAR, AUCH WENN NUR DER BERICHT ANDERS IST.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (`apps/web/src/lib/koVersionSnapshots.ts:33` am Basisstand
// 9c3f0ce): die Zeile einer Fassung trug als einzigen Inhalt
// `excerpt: snapshotExcerpt(entry.snapshot.statement || entry.snapshot.title || "")`. Der
// ausführliche Bericht kam in `KoVersionSnapshotRow` (`:3-12`) GAR NICHT vor. Zwei Fassungen, die
// sich nur im Bericht unterscheiden, ergaben deshalb zwei zeichengleiche Zeilen — Pedis Befund
// „v1/v2 zeigen identische 139-Zeichen-Vorschauen" (Nutzungsprüfung 06.09., N-0055/N-0057).
//
// WIE DIE UNTERSCHEIDUNG ZUSTANDE KOMMT — und ausdrücklich, wie NICHT: ausschließlich aus den
// VORHANDENEN Daten des Schnappschusses. Die Zeile führt den gespeicherten Bericht (`berichtHtml`)
// und seine GEMESSENE Länge in Zeichen Klartext (`berichtZeichen`) mit. Es wird nichts
// zusammengefasst, nichts erfunden und kein Modell gefragt.
//
// `snapshotExcerpt` bleibt die EINE Kürzungsregel (Fälle C und D) — kein zweiter Kürzer.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject, KoVersionSnapshot } from "../../apps/web/src/api/types";
import {
  type KoVersionSnapshotRow,
  koVersionRows,
  snapshotExcerpt,
} from "../../apps/web/src/lib/koVersionSnapshots";

/** Die Kürzungsgrenze aus `snapshotExcerpt` — Sollwert, bewusst als Literal (nicht importiert). */
const GRENZE = 140;

const BERICHT_V1 = "<p>Die Spritzzone wird nach jeder Schicht nass gereinigt.</p>";
const BERICHT_V2 =
  "<p>Die Spritzzone wird nach jeder Schicht nass gereinigt.</p><p>Zusatz: Die Dichtungen werden dabei geprüft und bei Verschleiß getauscht.</p>";

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

function zeile(rows: readonly KoVersionSnapshotRow[], version: number): KoVersionSnapshotRow {
  const treffer = rows.find((r) => r.version === version);
  if (!treffer) {
    throw new Error(`Keine Zeile für v${version}`);
  }
  return treffer;
}

/**
 * WORIN sich zwei Zeilen unterscheiden — ohne die Felder, die schon von Haus aus je Fassung anders
 * sind (`key`, `version`, `at`, `note`). Sonst wäre jede Zeile „unterscheidbar", ohne dass ein
 * Mensch am INHALT etwas sähe.
 */
function inhaltlicheUnterschiede(a: KoVersionSnapshotRow, b: KoVersionSnapshotRow): string[] {
  const ohne = new Set(["key", "version", "at", "note"]);
  const felder = (r: KoVersionSnapshotRow): Record<string, unknown> =>
    r as unknown as Record<string, unknown>;
  return Object.keys(a)
    .filter((k) => !ohne.has(k))
    .filter((k) => JSON.stringify(felder(a)[k]) !== JSON.stringify(felder(b)[k]));
}

describe("JOB 3475 · A — nur der Bericht ist anders", () => {
  const rows = koVersionRows([snap(1), snap(2, { bodyHtml: BERICHT_V2 })]);

  it("die beiden Zeilen sind inhaltlich unterscheidbar", () => {
    const unterschiede = inhaltlicheUnterschiede(zeile(rows, 1), zeile(rows, 2));
    expect(
      unterschiede,
      "Die Zeilen zweier Fassungen sind inhaltlich gleich — ein Mensch sieht keinen Unterschied.",
    ).not.toEqual([]);
  });

  it("die gemessene Berichtslänge unterscheidet die Fassungen", () => {
    const v1 = zeile(rows, 1);
    const v2 = zeile(rows, 2);
    expect(v1.berichtZeichen, "die Berichtslänge von v1 ist nicht gemessen").toBeGreaterThan(0);
    expect(
      v2.berichtZeichen,
      "die gemessene Berichtslänge ist für beide Fassungen dieselbe",
    ).not.toBe(v1.berichtZeichen);
    // GEMESSEN, nicht geschätzt: die Zahl ist die Länge des Klartexts des GESPEICHERTEN Berichts.
    expect(v1.berichtZeichen).toBe("Die Spritzzone wird nach jeder Schicht nass gereinigt.".length);
  });

  it("die Zeile führt den gespeicherten Bericht dieser Fassung mit — unverändert", () => {
    expect(zeile(rows, 1).berichtHtml).toBe(BERICHT_V1);
    expect(zeile(rows, 2).berichtHtml).toBe(BERICHT_V2);
  });
});

describe("JOB 3475 · B — ohne gespeicherten Bericht wird nichts behauptet", () => {
  it("fehlender Bericht: kein HTML, keine Länge — und keine Übernahme aus einer anderen Fassung", () => {
    const rows = koVersionRows([snap(1, { bodyHtml: null }), snap(2, { bodyHtml: BERICHT_V2 })]);
    expect(zeile(rows, 1).berichtHtml, "aus `null` wurde Inhalt").toBe("");
    expect(zeile(rows, 1).berichtZeichen).toBe(0);
    expect(zeile(rows, 2).berichtHtml).toBe(BERICHT_V2);
  });

  it("ein Bericht aus leeren Tags gilt als nicht gespeichert", () => {
    const rows = koVersionRows([snap(1, { bodyHtml: "<p></p>\n<p>  </p>" })]);
    expect(zeile(rows, 1).berichtHtml, "leere Absätze gelten als Inhalt").toBe("");
    expect(zeile(rows, 1).berichtZeichen).toBe(0);
  });
});

describe("JOB 3475 · C/D — `snapshotExcerpt` bleibt die eine Kürzungsregel", () => {
  it("C: ein sehr langer Auszug endet an der Grenze, mit Auslassungszeichen", () => {
    const lang = `Sehr lange Aussage. ${"Wort ".repeat(80)}Ende.`;
    const auszug = zeile(koVersionRows([snap(1, { statement: lang })]), 1).excerpt;
    expect(auszug.length, `der Auszug hält die Grenze ${GRENZE} nicht`).toBeLessThanOrEqual(GRENZE);
    expect(
      auszug.length,
      "der Auszug ist weit unter der Grenze — es kürzt ein anderer",
    ).toBeGreaterThan(GRENZE - 5);
    expect(auszug.endsWith("…"), "der gekürzte Auszug sagt nicht, dass er gekürzt ist").toBe(true);
    expect(auszug, "der Auszug folgt nicht `snapshotExcerpt`").toBe(snapshotExcerpt(lang));
  });

  it("D: ohne Aussage tritt der BERICHTSTEXT an ihre Stelle — unter derselben Grenze", () => {
    const langerBericht = `<p>${"Berichtssatz. ".repeat(40)}</p>`;
    const zeilen = koVersionRows([snap(1, { statement: "", bodyHtml: langerBericht })]);
    const auszug = zeile(zeilen, 1).excerpt;
    expect(auszug.startsWith("Berichtssatz."), "der Berichtstext tritt nicht ein").toBe(true);
    expect(auszug, "der Titel steht statt des Berichts").not.toContain(
      "Reinigung Spritzzone Linie 3",
    );
    expect(auszug.length, `der Auszug hält die Grenze ${GRENZE} nicht`).toBeLessThanOrEqual(GRENZE);
    expect(auszug.endsWith("…"), "der gekürzte Auszug sagt nicht, dass er gekürzt ist").toBe(true);
    expect(auszug, "es gibt einen zweiten Kürzer").toBe(
      snapshotExcerpt("Berichtssatz. ".repeat(40)),
    );
  });

  it("mit Aussage bleibt der Auszug die Aussage — der Bericht drängt sich nicht davor", () => {
    const zeilen = koVersionRows([snap(1)]);
    expect(zeile(zeilen, 1).excerpt).toBe("Die Spritzzone wird nach jeder Schicht nass gereinigt.");
  });

  it("ohne Aussage UND ohne Bericht bleibt der Titel der letzte Halt", () => {
    const zeilen = koVersionRows([snap(1, { statement: "", bodyHtml: null })]);
    expect(zeile(zeilen, 1).excerpt).toBe("Reinigung Spritzzone Linie 3");
  });
});

describe("JOB 3475 · E — die übrigen gespeicherten Felder stehen der Karte zur Verfügung", () => {
  it("Aussage, Bedingungen, Maßnahmen und Art kommen aus DIESEM Schnappschuss", () => {
    const rows = koVersionRows([
      snap(1),
      snap(2, {
        statement: "Neue Aussage.",
        conditions: ["Anlage steht", "Schicht zu Ende"],
        measures: ["Nassreinigung", "Dichtungsprüfung"],
        type: "best_practice",
      }),
    ]);
    const v1 = zeile(rows, 1);
    const v2 = zeile(rows, 2);
    expect(v1.statement).toBe("Die Spritzzone wird nach jeder Schicht nass gereinigt.");
    expect(v1.conditions).toEqual(["Anlage steht"]);
    expect(v1.type).toBe("technik");
    expect(v2.statement).toBe("Neue Aussage.");
    expect(v2.conditions).toEqual(["Anlage steht", "Schicht zu Ende"]);
    expect(v2.measures).toEqual(["Nassreinigung", "Dichtungsprüfung"]);
    expect(v2.type).toBe("best_practice");
  });

  it("die Reihenfolge bleibt: die jüngste Fassung steht oben", () => {
    const rows = koVersionRows([snap(1), snap(2), snap(3)]);
    expect(rows.map((r) => r.version)).toEqual([3, 2, 1]);
  });
});
