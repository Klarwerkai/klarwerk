// ================================================================================================
// JOB 1042 · D3 — DIE BESTANDSMATRIX, ALS SAMMLER STATT ALS ZAHL
// ================================================================================================
//
// PRÜFLÜCKE 1 des Vollurteils: „Alle 87 Confluence-bezogenen Dateien als vollständige Matrix
// klassifizieren; einschlägige Fixtures, Tests, Zieltypen und konsumierende Stellen explizit
// ausweisen." BEN dazu wörtlich (Z. 55): „Ein Zähler ersetzt diese Matrix nicht."
//
// Genau deshalb steht sie hier als LAUFENDER SAMMLER und nicht als Liste in einer Rückgabe. Eine
// Liste in einer Akte ist am Tag ihrer Erstellung wahr; ein Sammler wird rot, sobald jemand einen
// weiteren Konsumenten der Elternkette anlegt, ohne ihn zu kennen. Die Datei folgt damit dem
// vorhandenen Muster `tests/security/mega74-lesewege-sammler.test.ts`.
//
// ================================================================================================
// EINE KORREKTUR AN DER GRUNDMENGE — sie gehört benannt.
// ================================================================================================
// D2 nannte „87 Dateien mit Confluence-Bezug". Nachgemessen an der Base 9208d494 sind es 104
// (41 Tests, 48 unter `services`, 15 unter `apps/web/src`). Die Zahl ist aber für beide Werte
// UNBRAUCHBAR: sie zählt jede Datei, in der das Wort „Confluence" vorkommt — Sicherheits-Header,
// Routen, Demo-Korpus, Übersetzungen. Für die Hierarchie einschlägig ist ein kleiner Teil davon.
//
// UND EIN FEHLTREFFER, DER JEDE NAIVE ZÄHLUNG VERFÄLSCHT: Die Zeichenkette `ancestors` steht im
// Produkt auch in der Content-Security-Policy — `frame-ancestors` (services/app/src/
// security-headers.ts, server.ts und zwei CSP-Tests). Wer nach „ancestors" greppt, bekommt vier
// Dateien, die mit der Confluence-Elternkette nichts zu tun haben. `M0` hält diesen Fehltreffer
// ausdrücklich fest, damit ihn nicht der nächste Durchgang erneut mitzählt.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const BAEUME = ["services", "tests", "apps/web/src"];
const AUSGESCHLOSSEN: ReadonlySet<string> = new Set(["node_modules", "dist", "build", "coverage"]);

/** Die Begriffe, an denen eine Berührung der QUELL-HIERARCHIE erkennbar ist. */
const HIERARCHIE_BEGRIFFE = [
  "sourcePath",
  "ancestors",
  "confluenceAncestorIds",
  "confluenceAhnenBefund",
  "hierarchieBefund",
];

function alleDateien(wurzel: string): string[] {
  const out: string[] = [];
  const stapel = [wurzel];
  while (stapel.length > 0) {
    const ort = stapel.pop();
    if (ort === undefined) {
      break;
    }
    for (const eintrag of readdirSync(ort, { withFileTypes: true })) {
      if (AUSGESCHLOSSEN.has(eintrag.name)) {
        continue;
      }
      const pfad = join(ort, eintrag.name);
      if (eintrag.isDirectory()) {
        stapel.push(pfad);
      } else if (eintrag.isFile() && /\.(ts|tsx)$/.test(eintrag.name)) {
        out.push(pfad);
      }
    }
  }
  return out;
}

/** Relativ zur Clone-Wurzel, mit Schrägstrichen — stabil über Betriebssysteme. */
function relativ(pfad: string): string {
  return pfad
    .slice(WURZEL.length + 1)
    .split("\\")
    .join("/");
}

/**
 * Berührt diese Datei die Quell-Hierarchie WIRKLICH? Treffer, die ausschliesslich aus
 * `frame-ancestors` (CSP) stammen, zählen nicht.
 */
function beruehrtHierarchie(inhalt: string): boolean {
  const ohneCsp = inhalt.split("frame-ancestors").join("");
  return HIERARCHIE_BEGRIFFE.some((begriff) => ohneCsp.includes(begriff));
}

const DATEIEN = BAEUME.flatMap((baum) => alleDateien(join(WURZEL, baum)));
const EINSCHLAEGIG = DATEIEN.filter((pfad) => beruehrtHierarchie(readFileSync(pfad, "utf8")))
  .map(relativ)
  .sort();

// ------------------------------------------------------------------------------------------------
// DIE MATRIX — geschlossen, klassifiziert, mit Rolle
// ------------------------------------------------------------------------------------------------
type Rolle =
  | "quelle" // holt die Elternkette aus Confluence
  | "uebersetzer" // Quelle → quellneutrales Item (die Verluststelle)
  | "sammler" // wertet die Ketten über die ganze Seitenmenge aus
  | "zieltyp" // trägt das Feld im Vertrag
  | "projektion" // reicht es Richtung Anzeige durch
  | "anzeige" // baut daraus den Ordnerbaum
  | "fixture" // liefert Beispieldaten mit Elternkette
  | "test";

const MATRIX: Record<string, Rolle> = {
  // ---- Produktcode ----
  "services/confluence/src/rest-client.ts": "quelle",
  "services/confluence/src/mapper.ts": "uebersetzer",
  "services/confluence/src/adapter.ts": "sammler",
  "services/library-analytics/src/types.ts": "zieltyp",
  "services/library-analytics/src/select.ts": "projektion",
  "apps/web/src/api/types.ts": "zieltyp",
  "apps/web/src/lib/importSelectView.ts": "anzeige",
  "services/app/src/demo-corpus.ts": "fixture",
  // ---- Tests ----
  "tests/app/confluence-ancestors-expand.test.ts": "test",
  "tests/app/import-folder-tree.test.ts": "test",
  "tests/app/import-folder-tree-mounted.test.tsx": "test",
  "tests/app/import-folder-key-collision.test.tsx": "test",
  "tests/app/import-select-facets.test.ts": "test",
  "tests/library/import-select.test.ts": "test",
  "tests/app/job1042-hierarchie-idkette.test.ts": "test",
  "tests/app/job1042-hierarchie-kette-bis-import.test.ts": "test",
  // JOB 1131 D1: die beiden serverseitigen Prüflücken aus JOB 931 (BEN4, Prüflücken 2 und 3) —
  // der Mappervertrag der Ahnenkette (leere/fehlende Ahnen, leere Titel, mehrstufig) und der
  // Orchestrierungsvertrag der Importreihenfolge (Kind vor Elternteil ist folgenlos, Namensdublette,
  // Waise, zwei Seitenbäume). Beide Dateien tragen die Hierarchiebegriffe jetzt selbst und werden
  // vom Sammler oben erhoben; sie stehen hier, weil genau das seine Aufgabe ist.
  "services/confluence/src/mapper.test.ts": "test",
  "services/app/src/confluence-import.test.ts": "test",
  // Der Sammler zählt sich selbst mit — er trägt die Begriffe in seiner eigenen Matrix. Das ist
  // kein Schönheitsfehler, sondern die Probe darauf, dass er wirklich den Baum liest und nicht
  // eine fest verdrahtete Liste zurückgibt.
  "tests/app/job1042-hierarchie-bestandsmatrix.test.ts": "test",
};

describe("JOB1042 D3 · M — die Bestandsmatrix der Quell-Hierarchie", () => {
  it("M0 · DER FEHLTREFFER: `frame-ancestors` aus der CSP gehört NICHT zur Hierarchie", () => {
    // Vier Dateien tragen die Zeichenkette `ancestors` ausschliesslich als CSP-Direktive. Eine
    // naive Zählung nimmt sie mit — und jede daraus abgeleitete Aussage über den Bestand ist falsch.
    const cspDateien = [
      "services/app/src/security-headers.ts",
      "services/app/src/server.ts",
      "tests/app/csp-upgrade-insecure-requests.test.ts",
      "tests/app/word-addin-csp.test.ts",
    ];
    for (const pfad of cspDateien) {
      const inhalt = readFileSync(join(WURZEL, pfad), "utf8");
      // Der Fehltreffer ist ECHT vorhanden …
      expect(inhalt.includes("ancestors"), `${pfad} sollte 'ancestors' tragen`).toBe(true);
      // … und die Klassifikation lässt sich davon nicht täuschen.
      expect(beruehrtHierarchie(inhalt), `${pfad} darf NICHT als einschlägig gelten`).toBe(false);
      expect(Object.hasOwn(MATRIX, pfad)).toBe(false);
    }
  });

  it("M1 · GESCHLOSSEN: die Matrix nennt genau die Dateien, die die Hierarchie berühren", () => {
    // DAS IST DER SAMMLER. Legt jemand einen weiteren Konsumenten der Elternkette an, ohne ihn
    // hier einzutragen, wird dieser Fall rot — und der nächste Durchgang weiss davon, statt eine
    // veraltete Liste aus einer Akte zu übernehmen.
    expect(EINSCHLAEGIG).toEqual(Object.keys(MATRIX).sort());
  });

  it("M2 · JEDE ROLLE DER KETTE IST BESETZT — von der Quelle bis zur Anzeige", () => {
    const rollen = new Set(Object.values(MATRIX));
    for (const pflicht of [
      "quelle",
      "uebersetzer",
      "sammler",
      "zieltyp",
      "projektion",
      "anzeige",
      "fixture",
      "test",
    ] as Rolle[]) {
      expect(rollen.has(pflicht), `Rolle '${pflicht}' ist unbesetzt`).toBe(true);
    }
  });

  it("M3 · DIE VERLUSTSTELLE IST GENAU EINE — und sie ist benannt", () => {
    // Das Urteil lokalisiert den Verlust im Mapper. Diese Zusicherung hält fest, dass es dabei
    // bleibt: nur der Übersetzer darf aus der Quellform eine quellneutrale machen.
    const uebersetzer = Object.entries(MATRIX).filter(([, rolle]) => rolle === "uebersetzer");
    expect(uebersetzer.map(([pfad]) => pfad)).toEqual(["services/confluence/src/mapper.ts"]);
  });

  it("M4 · DIE GRUNDMENGE: 'Confluence-bezogen' ist NICHT 'hierarchie-einschlägig'", () => {
    // D2 nannte 87 Dateien „mit Confluence-Bezug". Der Wortbezug ist ein anderes, viel weiteres
    // Mass — dieser Fall belegt den Unterschied, statt eine Zahl gegen eine andere zu setzen.
    const mitWortbezug = DATEIEN.filter((pfad) =>
      readFileSync(pfad, "utf8").toLowerCase().includes("confluence"),
    );
    expect(mitWortbezug.length).toBeGreaterThan(EINSCHLAEGIG.length * 3);
    // Und jede einschlägige Datei ist eine echte Teilmenge davon? NEIN — und das ist der Punkt:
    // die Anzeige-Schicht kennt „Confluence" gar nicht (quellneutraler Vertrag).
    const wortbezugRelativ = new Set(mitWortbezug.map(relativ));
    const ohneWortbezug = EINSCHLAEGIG.filter((pfad) => !wortbezugRelativ.has(pfad));
    expect(
      ohneWortbezug.length,
      `quellneutrale Stellen ohne das Wort Confluence: ${ohneWortbezug.join(", ")}`,
    ).toBeGreaterThan(0);
  });
});
