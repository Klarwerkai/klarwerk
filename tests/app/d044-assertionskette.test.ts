// ================================================================================================
// JOB 1020 / D13 — DER ORTSWÄCHTER ÜBER DIE BELEG-ASSERTIONSKETTE.
// ================================================================================================
//
// WAS DIESE DATEI IN D12 WAR: die Heimat der Kettenprüfung `belegAssertionErfuellt` samt zwölf
// Kalibrierfällen. BEN hat genau das PRODUKT-ROT gestellt, und der Satz sitzt:
//
//   „Der technisch grüne Endstand kalibriert nur eine neue testlokale Assertionslogik; er
//    schliesst weder den zentralen Wächter noch den konkreten D-044-Dialog an."
//
// Die Logik war gut — sie stand nur an der falschen Stelle und prüfte dort sich selbst. Der
// Sammler, der tatsächlich über Freigaben entscheidet, kannte sie nicht.
//
// WAS SIE IN D13 IST: Die Implementierung und alle zwölf Kalibrierfälle sind nach
// `tests/app/mega47-modale-flaechen-sammler.test.tsx` gewandert — in den zentralen Wächter, wo
// BEN sie haben will (Korrekturpflicht 1, erste der beiden zugelassenen Formen). Nichts davon ist
// verloren gegangen; alles läuft dort, nur eben am entscheidenden Ort.
//
// WARUM NICHT DER IMPORTWEG, den Korrekturpflicht 1 alternativ zulässt: Er verlangt ein `export`
// aus einer `.test.ts`-Datei, und die Hausregel `lint/suspicious/noExportsInTest` verbietet das.
// Der Bestand befolgt sie ausdrücklich, statt sie zu unterdrücken — `tests/security/
// egress-encapsulation.test.ts:51` schreibt dazu wörtlich „Kein Export (Biome: noExportsInTest)".
// GEMESSEN in diesem Durchgang: Der Importweg war gebaut und lief (83 statt 71 Fälle im
// Sammlerlauf), scheiterte aber an vier `noExportsInTest`-Befunden — und hätte nebenbei alle
// zwölf Kalibrierfälle bei jedem Sammlerlauf ein zweites Mal ausgeführt.
//
// WAS DIESE DATEI JETZT LEISTET — und warum sie nicht einfach verschwindet: Sie ist der
// ORTSWÄCHTER. Ohne sie könnte jemand die Kettenprüfung morgen wieder aus dem Sammler
// herausziehen, in eine eigene Testdatei legen und damit exakt den D12-Zustand herstellen, den
// BEN abgelehnt hat — ohne dass ein einziger Test rot würde. Diese Datei prüft die STELLE, nicht
// die Semantik: Die Semantik ist im Sammler kalibriert, wo sie ausgeführt wird.
//
// KEIN `export` und KEIN Import aus einer Testdatei: Beide Wege sind hausregelwidrig. Gearbeitet
// wird auf dem Quelltext.
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const SAMMLER = join("tests", "app", "mega47-modale-flaechen-sammler.test.tsx");

function posix(pfad: string): string {
  return pfad.split(sep).join("/");
}

function lies(relativ: string): string {
  return readFileSync(join(WURZEL, relativ), "utf8");
}

/** Alle TypeScript-Quellen unter `tests/` — die Menge, in der eine zweite Kopie entstehen könnte. */
function testDateien(verzeichnis = "tests"): string[] {
  const raus: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
    if (eintrag.name === "node_modules" || eintrag.name.startsWith(".")) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      raus.push(...testDateien(relativ));
    } else if (relativ.endsWith(".ts") || relativ.endsWith(".tsx")) {
      raus.push(relativ);
    }
  }
  return raus;
}

describe("JOB 1020 D13: die Belegprüfung lebt im zentralen Wächter — und nur dort", () => {
  it("O1 · die Kettenprüfung ist im zentralen Sammler DEFINIERT", () => {
    // Der Kern von BENs Korrekturpflicht 1. Steht die Definition nicht dort, prüft der Sammler
    // die Belegform nicht — und D12 wäre wiederhergestellt.
    expect(
      /function\s+belegAssertionErfuellt\s*\(/.test(lies(SAMMLER)),
      `${posix(SAMMLER)} definiert \`belegAssertionErfuellt\` nicht mehr: die Prüfung ist aus dem entscheidenden Wächter verschwunden`,
    ).toBe(true);
  });

  it("O2 · sie ist im gesamten Testbaum GENAU EINMAL definiert", () => {
    // „Nach diesem Durchgang darf es die Logik nicht mehr zweimal geben." Gezählt wird über den
    // ganzen Baum, nicht über zwei bekannte Dateien — eine dritte Kopie soll nicht unbemerkt
    // entstehen können.
    const definitionen = testDateien().filter((d) =>
      /function\s+belegAssertionErfuellt\s*\(/.test(lies(d)),
    );
    expect(
      definitionen.map(posix).sort(),
      "die Kettenprüfung ist mehrfach definiert — genau die Verdopplung, die Pflicht 1 ausschliesst",
    ).toEqual([posix(SAMMLER)]);
  });

  it("O3 · diese Datei führt selbst KEINE zweite Kopie", () => {
    // Die Gegenprobe an der eigenen Stelle: Wäre sie hier wieder da, wäre O2 zwar rot — aber
    // dieser Fall benennt den Ort und macht die Meldung lesbar statt nur zählend.
    const eigener = lies(join("tests", "app", "d044-assertionskette.test.ts"));
    expect(/function\s+belegAssertionErfuellt\s*\(/.test(eigener)).toBe(false);
    // Und kein `export`: Der Importweg ist nach `noExportsInTest` versperrt, und diese Datei darf
    // ihn nicht durch die Hintertür wieder aufmachen.
    expect(/^export\s/m.test(eigener), "eine Testdatei exportiert nichts (noExportsInTest)").toBe(
      false,
    );
  });

  it("O4 · der Sammler führt die beiden von BEN benannten Ablehnungsfälle wirklich aus", () => {
    // BENs Prüflücke 1 verlangt sie namentlich: „einmal auf zwei `it`-Rümpfe verteilt, einmal mit
    // Namensauflösung an einer fremden Elementvariable". Ein Sammler, der die Prüfung zwar
    // definiert, sie aber an keiner Form ausführt, wäre wieder eine Zusage ohne Messung.
    const sammler = lies(SAMMLER);
    expect(sammler).toContain("auf zwei it-Rümpfe verteilt bleibt der Kandidat ABGELEHNT");
    expect(sammler).toContain("Namensauflösung am fremden Element bleibt ABGELEHNT");
    expect(sammler).toContain("die echte Zwischenvariablenform wird ANGENOMMEN");
  });

  it("O5 · der SourceFile-Rückfall ist nicht zurückgekehrt", () => {
    // Der D11-Fehler, den D12 behoben hat: Fällt die Prüfung auf den gesamten Quelldateiknoten
    // zurück, gibt sie zwei getrennte Testfälle fälschlich frei. Die Rückkehr wäre eine
    // Verschlechterung, die kein Kalibrierfall im Sammler allein sichtbar macht — dort stünde nur
    // ein einzelner roter Fall. Hier steht der Grund.
    const sammler = lies(SAMMLER);
    const ruempfeBlock = /function\s+testRuempfe\s*\([\s\S]*?\n}/.exec(sammler)?.[0] ?? "";
    expect(ruempfeBlock, "`testRuempfe` ist im Sammler nicht mehr auffindbar").not.toBe("");
    expect(
      /return\s*\[\s*\.\.\.raus\s*,\s*sf\s*\]|return\s*\[\s*sf\s*\]/.test(ruempfeBlock),
      "`testRuempfe` fällt wieder auf den gesamten SourceFile zurück — das ist der D11-Fehler",
    ).toBe(false);
  });
});
