// ================================================================================================
// JOB 3776 · R2 — DER ORT DES VERTRAGSAUFRUFS, NICHT NUR SEINE WIRKUNG.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. `echter-serverstart.test.ts` misst die WIRKUNG am laufenden Prozess:
// eine erste Zeile in der Form `Serverstart fehlgeschlagen: …`. Das ist die Zusage an den
// Betreiber, und sie ist die wichtigere Hälfte. Sie allein trägt aber nicht: dieselbe Zeile
// entstünde auch, wenn der Vertrag irgendwo anders im Ablauf stünde und der Fänger sie zufällig
// noch erwischte. Diese Datei nagelt deshalb den ORT fest.
//
// DER RÜCKFALL, GEGEN DEN SIE STEHT (JOB 3655 Runde 2, `build-app.ts` Zeile 286): Der Vertrag stand
// im MODULRUMPF von `build-app.ts` — also in dem Code, der beim `import` läuft. Ein Wurf von dort
// geschieht, BEVOR die erste Anweisung von `server.ts` ausgeführt wird, und erreicht den Fänger um
// `start()` (server.ts, `start().catch(...)`) deshalb nie. Der Betreiber bekam eine Stapelspur aus
// dem Modulladen. Gemessen am Stand 8208f57, wörtlich die erste Zeile:
//   `/…/services/app/src/start-vertrag.ts:927`
// statt der gewohnten Form. Wer den Aufruf dorthin zurückschiebt, macht diese Datei rot.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2, KORREKTURPFLICHT 1 — WARUM HIER JETZT EIN PARSER STEHT UND KEINE SPALTENPRÜFUNG MEHR.
// ------------------------------------------------------------------------------------------------
//
// DER BEFUND (BEN, Runde 1): Runde 1 setzte „Modulebene" mit „Spalte 0" gleich — sie prüfte, ob die
// Zeile mit `pruefeStartvertrag(` BEGINNT. BEN hat das widerlegt, indem er den Aufruf mit ZWEI
// FÜHRENDEN LEERZEICHEN in den Modulrumpf schrieb: Der Wächter blieb grün, der Aufruf lief aber
// weiterhin beim Import, und F5 wurde rot. Einrückung bestimmt in TypeScript keinen
// Gültigkeitsbereich — eine Prüfung, die daran hängt, prüft die Formatierung und nicht die Lage.
//
// DESHALB WIRD JETZT GEPARST. `ts.createSourceFile` liefert den echten Syntaxbaum; `vertragsaufrufe`
// unten bestimmt für JEDEN Aufruf die umschliessende Funktion. Steht keine dazwischen, läuft der
// Aufruf beim Import — unabhängig davon, wie tief die Zeile eingerückt ist, ob er in einem
// `if`-Block steht oder in einer sofort aufgerufenen Funktion (IIFE). R2/5 kalibriert genau das
// gegen den ECHTEN Quelltext von `build-app.ts`.
//
// SIE LIEST QUELLTEXT, und das ist hier kein Notbehelf, sondern der Gegenstand: „an welcher Stelle
// steht der Aufruf" ist eine Eigenschaft des Quelltextes. Zur Laufzeit ist sie nicht beobachtbar,
// ohne genau die Ausgabe zu messen, die R1 schon misst.
//
// DIE GEMESSENE MENGE DER EINSTIEGSPUNKTE (JOB 3776, Lieferung 1) — der Stand, gegen den geprüft
// wird. Ein Einstiegspunkt ist eine Datei, die `build-app` lädt UND als eigener Prozess läuft:
//
//   1. `services/app/src/server.ts`  — `start().catch(...)` auf Modulebene. Der Produktionsweg
//      schlechthin: das Dockerfile setzt `ENV NODE_ENV=production` und startet ihn als `CMD`.
//   2. `services/app/src/seed.ts`    — CLI-Runner hinter `process.argv[1]?.endsWith("seed.ts")`
//      (`npm run seed:demo`). In Produktion erreichbar, aber nur mit `SEED_ALLOW_PROD=1`.
//   3. `tools/bodytext-nachziehen.ts` — CLI-Werkzeug hinter einem `invokedDirectly`-Riegel, lädt
//      `build-app` per dynamischem `import`. Es liegt AUSSERHALB der Zielpfade von JOB 3776 und
//      trägt den Vertrag deshalb nicht; siehe ABWEICHUNGEN in der Rückgabe.
//
// NICHT in dieser Menge, entgegen dem alten Kommentar in `build-app.ts` (Zeile 278–279), der drei
// Einstiegspunkte nannte: `services/app/src/dev-persist.ts`. Die Datei hat KEINE Anweisung auf
// Modulebene und keinen CLI-Riegel — sie ist eine Bibliothek, die `server.ts` (Zeile 8) importiert.
// Gemessen: `node --import tsx services/app/src/dev-persist.ts` mit `NODE_ENV=test` endet mit 0 und
// gibt nichts aus. Sie war nie ein Einstiegspunkt; der Vertrag gehört dort nicht hin.
//
// WAS DIESE DATEI NICHT SIEHT und was deshalb offen bleibt: (a) ein KÜNFTIGER Einstiegspunkt, der
// `build-app` lädt, ohne in der Liste oben zu stehen — die Liste ist eine Momentaufnahme der
// Messung, kein Suchlauf über den Baum; (b) ein Aufruf in einem statischen Klassenblock
// (`static { … }`), der ebenfalls beim Import läuft: `vertragsaufrufe` behandelt eine Klasse als
// Grenze. Beides ist bewusst offen und in der Rückgabe unter REST benannt.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");

function quelltext(pfad: string): string {
  return readFileSync(join(WURZEL, pfad), "utf8");
}

function zeilen(pfad: string): string[] {
  return quelltext(pfad).split("\n");
}

/** Ist diese Zeile ausführbarer Code — also weder leer noch Kommentar? */
function istAnweisung(zeile: string): boolean {
  const t = zeile.trim();
  return t !== "" && !t.startsWith("//") && !t.startsWith("/*") && !t.startsWith("*");
}

const VERTRAGSNAME = "pruefeStartvertrag";
/** Der Ort, den `vertragsaufrufe` meldet, wenn keine Funktion den Aufruf umschliesst. */
const MODULRUMPF = "<Modulrumpf — läuft beim import>";

function istFunktionsartig(knoten: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(knoten) ||
    ts.isFunctionExpression(knoten) ||
    ts.isArrowFunction(knoten) ||
    ts.isMethodDeclaration(knoten) ||
    ts.isConstructorDeclaration(knoten) ||
    ts.isGetAccessorDeclaration(knoten) ||
    ts.isSetAccessorDeclaration(knoten) ||
    ts.isClassDeclaration(knoten) ||
    ts.isClassExpression(knoten)
  );
}

/**
 * Wird diese Funktion an Ort und Stelle SOFORT aufgerufen (IIFE)? Dann ist sie KEINE Grenze: ihr
 * Rumpf läuft beim Import genauso wie eine nackte Anweisung. `(() => { … })()` war der zweite Weg,
 * den eine reine Spaltenprüfung übersehen hätte.
 */
function sofortAufgerufen(fn: ts.Node): boolean {
  let kind: ts.Node = fn;
  let eltern: ts.Node | undefined = fn.parent;
  while (eltern !== undefined && ts.isParenthesizedExpression(eltern)) {
    kind = eltern;
    eltern = eltern.parent;
  }
  return eltern !== undefined && ts.isCallExpression(eltern) && eltern.expression === kind;
}

function nameVon(knoten: ts.Node): string {
  if (
    (ts.isFunctionDeclaration(knoten) ||
      ts.isMethodDeclaration(knoten) ||
      ts.isClassDeclaration(knoten)) &&
    knoten.name !== undefined
  ) {
    return knoten.name.getText();
  }
  const eltern = knoten.parent;
  if (eltern !== undefined && ts.isVariableDeclaration(eltern) && ts.isIdentifier(eltern.name)) {
    return eltern.name.text;
  }
  return "<anonyme Funktion>";
}

interface Vertragsaufruf {
  /** 1-basierte Zeilennummer des Aufrufs. */
  zeile: number;
  /** Die umschliessende Funktion — oder MODULRUMPF, wenn der Aufruf beim Import läuft. */
  ort: string;
}

/**
 * ALLE Aufrufe von `pruefeStartvertrag` in dieser Quelle, je mit dem Ort, an dem sie stehen.
 *
 * Der Ort wird über den SYNTAXBAUM bestimmt, nicht über Einrückung: es zählt die nächste
 * umschliessende Funktion, die nicht sofort aufgerufen wird. Gibt es keine, läuft der Aufruf beim
 * Import, und der Ort ist MODULRUMPF — egal ob die Zeile bei Spalte 0 beginnt oder eingerückt ist.
 */
function vertragsaufrufe(quelle: string, dateiname = "quelle.ts"): Vertragsaufruf[] {
  const datei = ts.createSourceFile(dateiname, quelle, ts.ScriptTarget.ESNext, true);
  const treffer: Vertragsaufruf[] = [];
  const ortFuer = (knoten: ts.Node): string => {
    let p: ts.Node | undefined = knoten.parent;
    while (p !== undefined) {
      if (istFunktionsartig(p) && !sofortAufgerufen(p)) {
        return nameVon(p);
      }
      p = p.parent;
    }
    return MODULRUMPF;
  };
  const gehe = (knoten: ts.Node): void => {
    if (
      ts.isCallExpression(knoten) &&
      ts.isIdentifier(knoten.expression) &&
      knoten.expression.text === VERTRAGSNAME
    ) {
      treffer.push({
        zeile: datei.getLineAndCharacterOfPosition(knoten.getStart(datei)).line + 1,
        ort: ortFuer(knoten),
      });
    }
    knoten.forEachChild(gehe);
  };
  datei.forEachChild(gehe);
  return treffer;
}

const WEG_ZURUECK =
  "Der Vertrag muss aus dem EINSTIEGSPUNKT gerufen werden (erste Anweisung von start() in " +
  "services/app/src/server.ts bzw. im Runner von services/app/src/seed.ts), nicht aus einem " +
  "Modulrumpf. Ein Wurf im Modulrumpf läuft beim import und erreicht den Fänger " +
  "start().catch(...) in server.ts nie — der Betreiber sieht dann eine Stapelspur statt der " +
  "Zeile 'Serverstart fehlgeschlagen: …'. Siehe JOB 3776 und den Kommentar in dieser Datei.";

describe("JOB 3776 R2 · der Startvertrag steht am Einstiegspunkt, nicht im Modulrumpf", () => {
  it("R2/1 · server.ts ruft den Vertrag als ERSTE Anweisung von start()", () => {
    const pfad = "services/app/src/server.ts";
    const aufrufe = vertragsaufrufe(quelltext(pfad), "server.ts");
    expect(
      aufrufe.map((a) => a.ort),
      `In ${pfad} steht der Vertragsaufruf nicht in start(), sondern in: ` +
        `${JSON.stringify(aufrufe)}. ${WEG_ZURUECK}`,
    ).toEqual(["start"]);

    const quelle = zeilen(pfad);
    const start = quelle.findIndex((z) => z.includes("async function start("));
    expect(
      start,
      "async function start( nicht gefunden in services/app/src/server.ts",
    ).toBeGreaterThanOrEqual(0);

    const ersteAnweisung = quelle.findIndex((z, i) => i > start && istAnweisung(z));
    expect(
      quelle[ersteAnweisung],
      `${pfad}:${ersteAnweisung + 1} — die erste Anweisung von start() ist ` +
        `'${quelle[ersteAnweisung]?.trim()}' und nicht der Aufruf pruefeStartvertrag(process.env). ` +
        `${WEG_ZURUECK}`,
    ).toContain("pruefeStartvertrag(");

    // Und er steht damit VOR dem Speicherwächter — sonst nennte der wieder nur DATABASE_URL und
    // schnitte die Sammelmeldung ab (BENs Befund aus JOB 3655 Runde 1).
    const waechter = quelle.findIndex((z) => z.includes("assertPersistentStore({"));
    expect(waechter, "assertPersistentStore({ nicht gefunden in server.ts").toBeGreaterThan(0);
    expect(
      ersteAnweisung,
      `pruefeStartvertrag steht in Zeile ${ersteAnweisung + 1}, assertPersistentStore in Zeile ` +
        `${waechter + 1} — der Vertrag muss VORHER stehen.`,
    ).toBeLessThan(waechter);
  });

  it("R2/2 · seed.ts ruft den Vertrag im Runner, bevor irgendein Dienst entsteht", () => {
    const pfad = "services/app/src/seed.ts";
    const aufrufe = vertragsaufrufe(quelltext(pfad), "seed.ts");
    expect(
      aufrufe.map((a) => a.ort),
      `In ${pfad} steht der Vertragsaufruf nicht in runSeed(), sondern in: ` +
        `${JSON.stringify(aufrufe)}. Ein Seed-Lauf in Produktion (SEED_ALLOW_PROD=1) liefe damit ` +
        `ohne Vertragsprüfung. ${WEG_ZURUECK}`,
    ).toEqual(["runSeed"]);

    // Vor der Verdrahtung: ein Lauf mit fehlendem Pflichtwert darf keine Verbindung aufbauen und
    // keine Dienste bauen, bevor er den Mangel meldet.
    const quelle = zeilen(pfad);
    const aufrufZeile = aufrufe[0]?.zeile ?? -1;
    const runner = quelle.findIndex((z) => z.includes("export async function runSeed("));
    for (const marke of ["createPool(", "buildPgServices(", "buildServices("]) {
      const stelle = quelle.findIndex((z, i) => i > runner && z.includes(marke));
      if (stelle < 0) {
        continue;
      }
      expect(
        aufrufZeile,
        `${pfad}:${stelle + 1} — '${marke}' steht VOR dem Vertragsaufruf (Zeile ${aufrufZeile}). Der Vertrag gehört davor.`,
      ).toBeLessThan(stelle + 1);
    }
  });

  it("R2/3 · build-app.ts ruft den Vertrag NICHT beim Import — unabhängig von der Einrückung", () => {
    const aufrufe = vertragsaufrufe(quelltext("services/app/src/build-app.ts"), "build-app.ts");
    expect(
      aufrufe.length,
      "In build-app.ts wird pruefeStartvertrag gar nicht mehr gerufen — der Aufruf im RUMPF von " +
        "buildApp() muss bleiben (s. R2/4).",
    ).toBeGreaterThan(0);

    const beimImport = aufrufe.filter((a) => a.ort === MODULRUMPF);
    expect(
      beimImport,
      `services/app/src/build-app.ts — der Vertrag wird wieder beim IMPORT gerufen (Zeile(n) ${beimImport.map((a) => a.zeile).join(", ")}). Keine Funktion umschliesst den Aufruf; die Einrückung ändert daran nichts. ${WEG_ZURUECK}`,
    ).toEqual([]);
  });

  it("R2/4 · der Aufruf im RUMPF von buildApp bleibt — er ist ein anderer Aufruf", () => {
    // Gegenrichtung zu R2/3: wer beim Aufräumen den falschen der beiden Aufrufe mitnimmt, nimmt die
    // Prüfung für eine App mit, die erst NACH einer Umgebungsänderung gebaut wird.
    //
    // GEMESSEN UND FESTGEHALTEN (Runde 1, zweite Gegenprobe): `tests/security/vip2-gate.test.ts`
    // schützt diesen Aufruf NICHT — entfernt man ihn, bleibt vip2-gate grün, weil es in seinem
    // `beforeEach` DATABASE_URL und APP_BASE_URL selbst setzt und damit um den Vertrag herum
    // arbeitet. Dieser Fall hier ist der einzige Schutz.
    const aufrufe = vertragsaufrufe(quelltext("services/app/src/build-app.ts"), "build-app.ts");
    expect(
      aufrufe.map((a) => a.ort),
      "Im Rumpf von buildApp() wird pruefeStartvertrag nicht mehr gerufen — dieser Aufruf gehört " +
        "NICHT zu JOB 3776 und muss stehen bleiben.",
    ).toContain("buildApp");
  });

  it("R2/5 · KALIBRIERUNG: der Wächter erkennt den eingerückten Modulaufruf und die IIFE", () => {
    // ============================================================================================
    // RUNDE 2, KORREKTURPFLICHT 1 — DIESER FALL IST DER BELEG, DASS R2/3 ÜBERHAUPT ETWAS PRÜFT.
    // ============================================================================================
    //
    // Ohne ihn wäre R2/3 auch dann grün, wenn `vertragsaufrufe` nie etwas fände. Kalibriert wird
    // gegen den ECHTEN Quelltext von `build-app.ts`, nicht gegen ein Kunstbeispiel: jede Mutation
    // hängt eine Anweisung an die reale Datei an und fragt, ob der Wächter sie sieht.
    const echt = quelltext("services/app/src/build-app.ts");
    expect(vertragsaufrufe(echt, "build-app.ts").filter((a) => a.ort === MODULRUMPF)).toEqual([]);

    // (a) BENs Mutation: zwei führende Leerzeichen. Einrückung ist kein Gültigkeitsbereich — das
    //     läuft beim Import. Die Spaltenprüfung aus Runde 1 hat das durchgelassen.
    const eingerueckt = `${echt}\n  ${VERTRAGSNAME}(process.env);\n`;
    expect(
      vertragsaufrufe(eingerueckt, "build-app.ts").filter((a) => a.ort === MODULRUMPF).length,
      "Der eingerückte Modulaufruf wurde NICHT erkannt — genau die Lücke aus Runde 1.",
    ).toBe(1);

    // (b) Tief eingerückt in einem Block auf Modulebene — läuft ebenfalls beim Import.
    const imBlock = `${echt}\nif (process.env.NODE_ENV) {\n      ${VERTRAGSNAME}(process.env);\n}\n`;
    expect(
      vertragsaufrufe(imBlock, "build-app.ts").filter((a) => a.ort === MODULRUMPF).length,
      "Der Aufruf in einem Block auf Modulebene wurde NICHT erkannt.",
    ).toBe(1);

    // (c) Sofort aufgerufene Funktion (IIFE) — sieht nach Funktion aus, läuft aber beim Import.
    const iife = `${echt}\n(() => {\n  ${VERTRAGSNAME}(process.env);\n})();\n`;
    expect(
      vertragsaufrufe(iife, "build-app.ts").filter((a) => a.ort === MODULRUMPF).length,
      "Der Aufruf in einer sofort aufgerufenen Funktion wurde NICHT erkannt.",
    ).toBe(1);

    // (d) GEGENRICHTUNG: ein Aufruf in einer echten, NICHT sofort gerufenen Funktion läuft NICHT
    //     beim Import und darf den Wächter nicht auslösen. Ohne diese Zeile wäre der Wächter auch
    //     dann grün-kaputt, wenn er einfach ALLES meldete — und R2/4 würde nie durchkommen.
    const inFunktion = `${echt}\nfunction niemalsGerufen() {\n  ${VERTRAGSNAME}(process.env);\n}\n`;
    const gemeldet = vertragsaufrufe(inFunktion, "build-app.ts").filter(
      (a) => a.ort === MODULRUMPF,
    );
    expect(
      gemeldet,
      "Ein Aufruf in einer gewöhnlichen Funktion wurde fälschlich als Modulrumpf gemeldet.",
    ).toEqual([]);
    expect(vertragsaufrufe(inFunktion, "build-app.ts").map((a) => a.ort)).toContain(
      "niemalsGerufen",
    );
  });
});
