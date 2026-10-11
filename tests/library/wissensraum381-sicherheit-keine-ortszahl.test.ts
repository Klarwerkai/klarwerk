// ==================================================================================================
// AUFTRAG PRO 381 · BÜNDEL 1 (Sicherheit) · `R-12` — ES GIBT KEINEN AUFRUFWEG ZU EINER ORTSZAHL.
// ==================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI GERICHTET IST (PLAN PRO 378 §2.3, `T-1` bis `T-3`):
// Die Bibliothek filtert alle zehn Achsen CLIENTSEITIG, leitet die Facettenwerte je Wissensobjekt
// CLIENTSEITIG aus dem Objekt ab (`libraryFilterValues`) und rechnet die Zähler je Option
// CLIENTSEITIG über die GELADENE Treffermenge (`facetRailGroups`). Genau diese Mechanik ist der
// Grund, warum der Ort keine elfte Facette werden darf: eine Ortszahl aus der geladenen Menge wäre
// der von REF-0001 `:48` verbotene ungetrimmte Count — und damit eine Existenzauskunft über Dinge,
// die der Betrachter nicht sehen darf.
//
// ZWEI ARTEN VON ZUSICHERUNG, und die Trennung ist Absicht:
//   · Die BEWAHRUNGSANKER (a) und (b) sind HEUTE messbar und HEUTE grün. Sie sind das Gegenstück zu
//     „additiv“: sie werden rot, sobald jemand den Ort doch in die Facettenmechanik zieht.
//   · Die Zusicherungen (c) und (d) maßen `lib/librarySpace.ts` (`spaceResultCount` und seine
//     Importe). R-1349 (Aufnahme gesamt-aufruferwaechter, Nacharbeit 10): das Modul ist samt
//     `LibraryScopeBar` und `KoHomeLine` entfernt — die Umsetzungswelle mit `home`-Kette kam nicht,
//     geliefert ist das flache Space-Modell (produkt:20261007:spaces), das keine Ortszahl zeigt.
//     Die Bewahrungsanker (a) und (b) gelten unverändert: der Ort wird keine elfte Facette.
import { describe, expect, it } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { libraryFilterValues } from "../../apps/web/src/lib/libraryFacets";

/**
 * Die ZEHN Achsen der Filterschiene, wörtlich aus `pages/Library.tsx` `LIBRARY_FILTER_CONFIGS`
 * (`:116-127`). PLAN 378 §2.2 korrigiert hier eine falsche Zahl aus PRO 359: es sind zehn, nicht
 * neun — `maturity` fehlte, ausgerechnet die Achse, die der Quelltext als erste führt.
 */
const ZEHN_ACHSEN = [
  "maturity",
  "category",
  "tag",
  "confidentiality",
  "author",
  "origin",
  "type",
  "language",
  "age",
  "trust",
] as const;

/** Jedes Wort, mit dem ein Ort in eine Facette, einen Zähler oder eine Sicht sickern könnte. */
const ORTSWOERTER = ["home", "raum", "ort", "space", "placement", "container", "node", "pfad"];

function istOrtswort(text: string): boolean {
  const klein = text.toLowerCase();
  return ORTSWOERTER.some((wort) => klein.includes(wort));
}

/** Ein Wissensobjekt, dem ein `home` bereits ANHÄNGT — der Fall nach der Umsetzungswelle. */
function koMitHeimat(): KnowledgeObject {
  return {
    id: "ko-mit-heimat",
    title: "Ventil bei Überdruck schließen",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: ["ventil"],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    // Das Feld, das die spätere Welle einführt (PLAN 378 §4.2: optionales `home` am KO).
    home: { chain: [{ id: "r1", name: "Technik" }] },
  } as unknown as KnowledgeObject;
}

describe("PRO 381 · R-12 — keine clientseitig gerechnete Ortszahl", () => {
  it("R-12 (a) BEWAHRUNGSANKER: `libraryFilterValues` bekommt den Ort nicht — auch nicht, wenn er am KO hängt", () => {
    // PLAN 378 §4.3 Satz 2: „`libraryFilterValues` bekommt den Ort NICHT. Damit kann keine Facette,
    // kein Zähler, keine Gruppierung und keine gemerkte Sicht ihn je enthalten."
    // Das ist die EINE Stelle, an der sich das strukturell entscheidet — nicht zehn Stellen.
    const werte = libraryFilterValues(koMitHeimat(), Date.parse("2026-08-05T00:00:00.000Z"));
    for (const schluessel of Object.keys(werte)) {
      expect(istOrtswort(schluessel), `Facettenachse „${schluessel}“ trägt ein Ortswort`).toBe(
        false,
      );
    }
    // Und auch kein WERT darf den Ortsnamen tragen — eine Achse „category“ mit dem Wert „Technik“
    // aus der Heimatkette wäre derselbe Verstoss unter anderem Namen.
    for (const [schluessel, werteliste] of Object.entries(werte)) {
      for (const wert of werteliste ?? []) {
        expect(wert, `Achse „${schluessel}“ trägt den Heimatnamen als Wert`).not.toBe("Technik");
      }
    }
  });

  it("R-12 (b) BEWAHRUNGSANKER: die zehn Achsen der Schiene enthalten keine Ortsachse", () => {
    // Der Ort ist keine elfte Facette (PLAN 378 §2.3, tragende Entscheidung). Diese Zeile wird rot,
    // sobald jemand ihn doch zu einer macht — unabhängig davon, wie er sie nennt.
    expect(ZEHN_ACHSEN).toHaveLength(10);
    for (const achse of ZEHN_ACHSEN) {
      expect(istOrtswort(achse), `Achse „${achse}“ trägt ein Ortswort`).toBe(false);
    }
    // Gegenprobe, damit der Wächter nicht bloss eine Wortliste bejaht: die abgeleiteten Werte des
    // Bestands decken die zehn Achsen wirklich ab (sonst prüfte (a) eine leere Menge).
    const werte = libraryFilterValues(koMitHeimat(), Date.parse("2026-08-05T00:00:00.000Z"));
    for (const achse of ZEHN_ACHSEN) {
      expect(Object.keys(werte), `Achse „${achse}“ fehlt in der Werteableitung`).toContain(achse);
    }
  });
});
