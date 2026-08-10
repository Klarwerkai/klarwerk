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
//   · Die Zusicherungen (c) und (d) sind ROT, weil `lib/librarySpace.ts` noch nicht existiert.
//     PLAN 378 §8.3 hält ausdrücklich fest, dass `R-12` erst mit dem Serververtrag (BASIC 379) ganz
//     grün werden kann. Das ist kein Mangel, sondern die Reihenfolge: Sicherheit vor Sichtbarkeit.
import { describe, expect, it } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { libraryFilterValues } from "../../apps/web/src/lib/libraryFacets";
import { ladeOrtArtefakt, leseOrtArtefakt, ortFunktion } from "./support/wissensraum-ort-vertrag";

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

  it("R-12 (c): eine Zahl entsteht NUR aus einer Serverzahl — nie aus einer Trefferliste", async () => {
    const modul = await ladeOrtArtefakt("librarySpace");
    const zahl = ortFunktion(modul, "spaceResultCount", "librarySpace");

    // Ohne Serverzahl gibt es GAR KEINE Zahl (PLAN 378 §4.3 Satz 4, `P-3`). Nicht 0 — `0` wäre
    // eine Auskunft („hier ist nichts“), und genau die darf bei getrimmten Beständen nicht fallen.
    expect(zahl(undefined)).toBeNull();
    expect(zahl(null)).toBeNull();

    // Und eine Trefferliste ist keine Zahl. Wer hier `3` zurückbekäme, hätte den ungetrimmten
    // Count aus `T-3` gebaut — der Client kennt nur die GELADENE Menge, nie die wahre.
    expect(zahl([koMitHeimat(), koMitHeimat(), koMitHeimat()])).toBeNull();
    expect(zahl({ length: 3 })).toBeNull();
    expect(zahl("3")).toBeNull();

    // Eine echte Serverzahl kommt unverändert durch — sonst wäre der Umschalter nie entscheidbar.
    expect(zahl(42)).toBe(42);
    expect(zahl(0)).toBe(0);
  });

  it("R-12 (d): `librarySpace.ts` kennt die zählenden Module gar nicht erst", () => {
    // Strukturell statt punktuell: (c) belegt das Ergebnis für die geprüften Eingaben, (d) belegt,
    // dass der AUFRUFWEG nicht existiert. Diese drei Module sind die einzigen, in denen im Web-
    // Bestand über eine Treffermenge gezählt wird.
    const quelltext = leseOrtArtefakt("librarySpace");
    for (const zaehlmodul of ["libraryFacets", "facetRail", "libraryDisplay", "facetFilter"]) {
      expect(quelltext, `librarySpace.ts importiert „${zaehlmodul}“`).not.toContain(zaehlmodul);
    }
    // Und es zieht sich die Wahrheit auch nicht über den API-Client selbst heran: der Ort erreicht
    // die Oberfläche ausschliesslich über `home` am KO und die Raumliste — es gibt keinen dritten
    // Weg (PLAN 378 §4.3 Satz 1). Ein reines Modul holt nichts.
    expect(quelltext).not.toContain("api/client");
    expect(quelltext).not.toContain("api/endpoints");
  });
});
