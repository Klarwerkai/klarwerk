// ================================================================================================
// JOB 3326 · DIE ÜBERSETZUNG DARF NIRGENDWO ZUR WAHRHEIT WERDEN.
// ================================================================================================
//
// Der Laufzeitbeleg dafür steht in `services/app/src/routes/lesevarianten-routes.test.ts` (R12/R13:
// die Suche findet das deutsche Wort NICHT, das englische schon). Er misst aber nur die EINE Naht,
// die es heute gibt. Dieser Wächter zieht die Grenze STRUKTURELL: die Ablage der Lesevarianten wird
// von genau den Dateien gelesen, die sie lesen sollen — und von keiner weiteren.
//
// WARUM DAS NICHT ÜBERFLÜSSIG IST: Es ist eine Zeile Arbeit, in `effective-search-document.ts` oder
// in der KI-Antwort-Beschaffung die Variante „auch noch" mitzunehmen. Die Suche fände dann Objekte
// über Wörter, die im Objekt nicht stehen, und Klaras Antwort stützte sich auf einen Text, den
// niemand freigegeben hat. Beides wäre grün getestet, weil kein bestehender Test danach fragt.
// Genau diese Klasse fängt der Wächter ab: ein neuer Leser ist rot, bis er hier eingetragen und
// begründet ist.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WURZEL, ohneKommentare, posix, quelldateien } from "../../tools/modalgrenze";

/**
 * Wer die Lesevarianten-Ablage lesen DARF — und warum genau er.
 *
 * Jeder Eintrag ist eine ANZEIGE- oder VERWALTUNGSnaht. Keiner davon speist Suche, Ähnlichkeit,
 * Konflikt, KI-Antwort, Export oder Prüfprotokoll.
 */
const ERLAUBTE_LESER: Readonly<Record<string, string>> = {
  "services/app/src/lesevarianten.ts": "die Ablage selbst",
  "services/app/src/db.ts": "die Migration der Tabelle",
  "services/app/src/build-app.ts": "die Kompositionswurzel (Verdrahtung, Registrierung)",
  "services/app/src/routes/lesevarianten-routes.ts": "die drei Routen der Lesevariante",
  "services/app/src/routes/ko-routes.ts":
    "der Detailabruf reicht die Variante als EIGENES Feld neben dem unveränderten Objekt mit",
};

/**
 * Die Dateien, in denen die Zeichenfolge `lesevariante` NIE stehen darf — die Wege, auf denen das
 * Original die Wahrheit ist. Bewusst als Muster über Verzeichnisse und nicht als Dateiliste: eine
 * neue Datei in `services/ask` soll von diesem Wächter mit erfasst werden, ohne dass jemand daran
 * denkt.
 */
const WAHRHEITSWEGE = [
  "services/knowledge-object/src/",
  "services/ask/src/",
  "services/reasoner/src/",
  "services/conflicts/src/",
  "services/output/src/",
  "services/audit/src/",
  "services/embedding/src/",
];

const dateien = quelldateien("services").map((d) => posix(d));

function inhalt(pfad: string): string {
  return readFileSync(`${WURZEL}/${pfad}`, "utf8");
}

/**
 * Ein echter Import des Ablage-Moduls — kein Vorkommen in Prosa.
 *
 * GEMESSEN AM ROHTEXT, ausdrücklich OHNE `ohneKommentare`: dessen Blockkommentar-Ersetzung ist
 * nicht stringtreu (ein `/*` in einem Zeilenkommentar verschluckt Quelltext bis zum nächsten
 * Kommentarende — nachgestellt an `ko-routes.ts`, dessen Import dabei verschwand). Der Preis dieser
 * Wahl ist bekannt und mild: ein AUSKOMMENTIERTER Import zählte hier als Leser. Er wäre falsch-rot,
 * nie falsch-grün — die richtige Richtung für einen Wächter.
 */
function importiertLesevarianten(quelle: string): boolean {
  return /^\s*import\s[^;]*from\s+["'][^"']*\/lesevarianten["'];?$/m.test(quelle);
}

describe("JOB 3326 · die Lesevariante bleibt eine LESART", () => {
  it("W1 · nur die eingetragenen Dateien lesen die Ablage — jeder neue Leser ist rot", () => {
    const leser = dateien
      .filter((d) => d !== "services/app/src/lesevarianten.ts")
      .filter((d) => importiertLesevarianten(inhalt(d)));
    expect(leser.sort()).toEqual(
      Object.keys(ERLAUBTE_LESER)
        .filter((d) => d !== "services/app/src/lesevarianten.ts")
        .sort(),
    );
  });

  it("W2 · die Kalibrierung: der Wächter findet die vier bekannten Leser wirklich", () => {
    // Ohne diese Zeile wäre W1 auch dann grün, wenn das Muster gar nichts fände.
    const gefunden = Object.keys(ERLAUBTE_LESER)
      .filter((d) => d !== "services/app/src/lesevarianten.ts")
      .filter((d) => importiertLesevarianten(inhalt(d)));
    expect(gefunden.length).toBe(4);
  });

  it("W3 · Suche, Ähnlichkeit, Konflikt, KI-Antwort, Export und Prüfprotokoll lesen sie nicht", () => {
    const wege = dateien.filter((d) => WAHRHEITSWEGE.some((weg) => d.startsWith(weg)));
    // Kalibrierung: die Wege sind wirklich besetzt (sonst wäre die leere Trefferliste bauartbedingt).
    expect(wege.length).toBeGreaterThan(50);
    expect(
      wege.filter((d) => importiertLesevarianten(inhalt(d))),
      "Diese Dateien tragen zur WAHRHEIT bei und dürfen die Übersetzung nicht lesen",
    ).toEqual([]);
  });

  it("W4 · das KO-Modell trägt kein Übersetzungsfeld (kein Umbau des Vertrags)", () => {
    const typen = ohneKommentare(inhalt("services/knowledge-object/src/types.ts"));
    // Kein Feld `lesevariante(n)` und keine `translation`-Eigenschaft am Vertrag.
    expect(typen).not.toMatch(/^\s*lesevarianten?\??\s*:/m);
    expect(typen).not.toMatch(/^\s*translations?\??\s*:/m);
    // Kalibrierung: der Vertrag wird wirklich gelesen (die bekannten Felder stehen darin).
    expect(typen).toMatch(/^\s*bodyHtml\?: string \| null;$/m);
  });

  it("W5 · die Suchprojektion speist sich nicht aus der Variante", () => {
    for (const datei of [
      "services/knowledge-object/src/search-projection.ts",
      "services/knowledge-object/src/effective-search-document.ts",
    ]) {
      expect(importiertLesevarianten(inhalt(datei)), datei).toBe(false);
    }
  });
});
