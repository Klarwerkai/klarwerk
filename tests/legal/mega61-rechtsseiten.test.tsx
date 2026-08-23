// ================================================================================================
// AUFTRAG-mega61 BLOCK A — WO DIE GEMOUNTETEN TORWÄCHTER-TESTS WOHNEN, UND WARUM DORT.
// ================================================================================================
//
// DIE EIGENTLICHEN FÄLLE stehen in `apps/web/src/legal/mega61-rechtsseiten.test.tsx`. Hier steht
// nur der Wächter, der sie dort HÄLT — und der Grund dafür, weil er sonst beim nächsten Aufräumen
// verlorengeht:
//
// `tsconfig.tests-tsx.json` typprüft alle `.tsx` unter `tests/**` in einem EIGENEN Programm mit den
// Einstellungen und Typen der WURZEL. Für kleine, gemountete Bausteine reicht das. Sobald ein Test
// dort aber `apps/web/src/App` importiert, zieht er über `routes.tsx` die GANZE Anwendung in dieses
// Programm — und dann prüft der Wurzel-Typprüfer Web-Dateien mit Wurzel-Einstellungen. Ergebnis
// gemessen, nicht vermutet: acht Fehler in fünf Dateien (fehlendes `vite/client` für
// `import.meta.env`, `override` an der Fehlergrenze, `exactOptionalPropertyTypes` gegen die
// i18next-Typen), von denen KEINER ein echter Defekt ist. Der Typprüfer der Anwendung
// (`apps/web/tsconfig.json`) ist über dieselben Dateien grün — er hat DOM, jsx, `vite/client` und
// die passenden @types.
//
// Deshalb wohnen Tests, die den Torwächter oder die Anwendungshülle MONTIEREN, unter
// `apps/web/src/**`. Der Testlauf sieht sie dort genauso (vitest.config.ts schließt
// `apps/web/src/**/*.test.{ts,tsx}` seit mega59 ein), und der richtige Typprüfer auch.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// AUFTRAG-mega86 BLOCK D — DIESER WÄCHTER HAT NAMENSANWESENHEIT GEMESSEN.
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// DER BEFUND (ben, sammel84-mega85, GELB): hier stand `inhalt.includes("apps/web/src/App")` — eine
// Suche nach einer ZEICHENFOLGE im Dateitext, die weder Importdeklarationen noch Kommentare noch
// Stringliterale unterschied. Zwei Fehler in einem:
//   · Er wurde bei bloßer DOKUMENTATION falsch rot. Genau das ist in mega85 passiert: der Sammler
//     `tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx` musste den Pfad NENNEN, um ihn
//     auszuschließen, und hat ihn deshalb aus Teilstücken zusammengesetzt. Eine Ausweichkonvention,
//     die zur zweiten Wahrheit geworden wäre — sie ist mit mega86 zurückgebaut.
//   · Und er übersah zugleich andere Importformen (`import type`, `export … from`, dynamisches
//     `import()`, `require`), die den Rahmen genauso in das Programm ziehen.
//
// JETZT WERDEN ECHTE IMPORTDEKLARATIONEN ERKANNT, über den TypeScript-Baum statt über Textsuche.
// Der SCHUTZZWECK ist unverändert und wird NICHT aufgeweicht — er wird genauer: mehr Importformen
// werden erfasst, und Erwähnungen in Kommentar oder Zeichenkette lösen ihn nicht mehr aus. Weil das
// so ist, prüft der Wächter seit mega86 auch SICH SELBST mit (die Selbstausnahme ist weg) — obwohl
// diese Datei den Pfad mehrfach nennt.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// AUFTRAG-JOB-1184 D1 — DIE UMSTELLUNG HATTE AN EINER STELLE DECKUNG VERLOREN.
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// DER BEFUND (ben, sammel85, `OFFEN.md:384` = I44, zweitens, ausdrücklich als NICHT-BLOCKER
// eingeordnet): Bei Aufrufen stand `ts.isStringLiteral` — ein gültiges `` import(`./x`) `` oder
// `` require(`./x`) `` mit Template-Literal OHNE Platzhalter entging dem Wächter, **obwohl die alte
// Namenssuche den Pfad sah**. Der Umstieg auf den Syntaxbaum war richtig und hat trotzdem an
// genau dieser Stelle etwas verloren, das vorher da war.
//
// GEMESSEN AM 20.08.2026, und die Messung ist der eigentliche Beleg: Trägt diese Datei selbst einen
// solchen Import, bleibt der Wächter mit `isStringLiteral` **grün** — 16 von 16 Fällen, Rahmen-
// Treffer 0 —, obwohl sie den Anwendungsrahmen zieht. Mit `isStringLiteralLike` wird derselbe
// Stand rot: der Verstoßfall UND der Selbstbeleg unten.
//
// SEITHER GILT HIER:
//   · `ts.isStringLiteralLike` bei Aufrufen — deckt `"…"` UND das Template-Literal ohne Platzhalter.
//   · Ein Pfad MIT Platzhalter (`` `./${name}` ``) ist statisch nicht auflösbar. Er wird
//     AUSDRÜCKLICH GEMELDET (`unaufgeloesteAufrufe`) statt still übergangen — „keine Aussage" ist
//     nicht dasselbe wie „kein Import".
//
// WAS HIER BIS ZUM 23.08.2026 OFFEN BLIEB — und seither BEHOBEN ist (AUFTRAG-JOB-2062 D1):
// Die Erhebung durchsuchte nur `.tsx` (`dateien("tests", ".tsx")`), während die Meldung von „allen
// Tests unter tests/**" sprach; am 20.08. lagen dort 181 `.tsx` und 616 `.ts`. Ein `tests/**/*.ts`,
// das den Rahmen importierte, sah dieser Wächter nicht. Seit JOB 2062 D1 liest er beide Endungen —
// siehe `testDateien()` und `artVon()` unten samt ihren Sonden.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");

function dateien(verzeichnis: string, endung: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis))) {
    if (eintrag === "node_modules" || eintrag.startsWith(".")) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag);
    if (statSync(join(WURZEL, relativ)).isDirectory()) {
      gefunden.push(...dateien(relativ, endung));
    } else if (relativ.endsWith(endung)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// AUFTRAG-JOB-2062 D1 (I44, zweitens — die VORBESTEHENDE Blindstelle) — `.ts` WIRD MITGELESEN.
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// Bis hierher stand an beiden Erhebungsstellen `dateien("tests", ".tsx")`, während die Meldung des
// Wächters von „allen Tests unter tests/**" sprach. Ein `tests/**/*.ts`, das den Anwendungsrahmen
// importiert, fiel damit durch — nicht weil jemand es erlaubt hätte, sondern weil niemand hinsah.
//
// GEMESSEN, zwei Zeitpunkte, damit die Richtung belegt ist und nicht behauptet:
//   20.08.2026 (im Kopf dieser Datei festgehalten):  181 `.tsx`  ·  616 `.ts`
//   23.08.2026 (dieser Durchgang):                   201 `.tsx`  ·  664 `.ts`
// Die blinde Menge ist um 48 Dateien gewachsen, die gesehene um 20. Die Lücke schließt sich nicht
// von selbst — sie wird größer.
//
// ZWEI DINGE, DIE DABEI NICHT ÜBERSEHEN WERDEN DÜRFEN:
//   · `"x.tsx".endsWith(".ts")` ist FALSE. Die beiden Endungen überschneiden sich also nicht, und
//     keine Datei wird doppelt erhoben. Das ist unten eine eigene Sonde und keine Fußnote.
//   · Eine `.ts`-Datei darf NICHT als TSX geparst werden. `const f = <T,>(x: T) => x` ist gültiges
//     TypeScript, wird im TSX-Modus aber als JSX-Element gelesen — der Baum wäre still falsch.
//     Deshalb entscheidet `artVon` die Sprache an der Endung, und eine Sonde fährt genau diesen
//     Fall. Ohne sie hätte die Erweiterung eine neue stille Lücke gebaut, statt eine zu schließen.
const TEST_ENDUNGEN = [".ts", ".tsx"] as const;

function testDateien(): string[] {
  return TEST_ENDUNGEN.flatMap((endung) => dateien("tests", endung));
}

function artVon(dateiname: string): ts.ScriptKind {
  return dateiname.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

// AUFTRAG-JOB-2062 D1/D2: die Ladestellen, die mit der Erweiterung auf `.ts` sichtbar werden.
// Sie sind nicht neu — sie waren nur außerhalb der Grundmenge. Alle drei laden mit ABSICHT
// dynamisch, alle drei liegen auf fremder Fläche, und bei allen dreien wäre ein statisch
// geschriebener Pfad sachlich falsch, nicht bloß unbequem:
//
//   · `write-fence-race.test.ts:71` lädt ein Modul, das FEHLEN DARF, und meldet sonst den Grund.
//   · `job642-testpfade-cwd-unabhaengig.test.ts:104` hängt einen Frischezähler an den Pfad, um den
//     Modul-Cache zu umgehen — das ist der Zweck genau dieses Tests.
//   · `wissensraum-ort-vertrag.ts:90` lädt ein Artefakt über `pathToFileURL(absolut).href`, das
//     VOR der Umsetzungswelle noch nicht existiert; die Datei sagt es in ihrer eigenen Meldung
//     (`:87`): „Kein Test darf dafür künstlich grün gemacht werden."
//
// EINE AUSNAHME MIT ORT UND GRUND IST ETWAS ANDERES ALS EINE BLINDSTELLE: sie steht hier, sie wird
// unten in BEIDE Richtungen gefahren, und eine VIERTE Stelle macht den Wächter sofort rot.
//
// D2, zur Herkunft dieser Liste: In D1 stand sie mit ZWEI Einträgen hier und der Wächter wurde
// rot. Der Grund war nicht die Erweiterung, sondern wie ich die Liste gefüllt hatte — mit einer
// abgeschnittenen Textsuche statt mit der Erhebung selbst. Die dritte Stelle lag außerhalb der
// ersten 25 Treffer. Jetzt ist die Liste GEMESSEN: dieselbe Erhebung über alle 865 Dateien, und
// sie meldet genau diese drei.
const BEKANNT_UNAUFLOESBAR = new Set<string>([
  "tests/app/write-fence-race.test.ts:71",
  "tests/app/job642-testpfade-cwd-unabhaengig.test.ts:104",
  "tests/library/support/wissensraum-ort-vertrag.ts:90",
]);

// AUFTRAG-mega86 Block D: die Modulpfade, die eine Datei WIRKLICH lädt — erhoben aus dem
// TypeScript-Baum. Erfasst sind alle Formen, die den Typprüfer das Modul öffnen lassen: statischer
// Import (auch reiner Typ-Import und Seiteneffekt-Import), Re-Export, `import … = require(…)`,
// dynamisches `import()` und `require()`. Kommentare und Zeichenketten sind im Baum keine
// Modulpfade und kommen damit baulich nicht vor — nicht weil sie herausgefiltert würden.
function importierteModule(quelle: string, dateiname: string): string[] {
  const baum = ts.createSourceFile(
    dateiname,
    quelle,
    ts.ScriptTarget.Latest,
    true,
    artVon(dateiname),
  );
  const module: string[] = [];
  const besuche = (knoten: ts.Node): void => {
    if (ts.isImportDeclaration(knoten) || ts.isExportDeclaration(knoten)) {
      const spez = knoten.moduleSpecifier;
      if (spez && ts.isStringLiteral(spez)) {
        module.push(spez.text);
      }
    } else if (
      ts.isImportEqualsDeclaration(knoten) &&
      ts.isExternalModuleReference(knoten.moduleReference) &&
      ts.isStringLiteral(knoten.moduleReference.expression)
    ) {
      module.push(knoten.moduleReference.expression.text);
    } else if (
      ts.isCallExpression(knoten) &&
      (knoten.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(knoten.expression) && knoten.expression.text === "require"))
    ) {
      const erstes = knoten.arguments[0];
      if (erstes && ts.isStringLiteralLike(erstes)) {
        module.push(erstes.text);
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(baum);
  return module;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// AUFTRAG-JOB-1184 D1 — DIE AUFRUFE, DIE STATISCH NICHT AUFLÖSBAR SIND, WERDEN GEMELDET.
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// `isStringLiteralLike` oben deckt zwei Formen: das gewöhnliche `"…"` und das Template-Literal
// OHNE Platzhalter (`NoSubstitutionTemplateLiteral`). Beide sind statisch lesbare Pfade.
//
// ES BLEIBT EINE DRITTE FORM, und sie darf nicht still durchfallen: `` import(`./${name}`) `` ist
// gültiges TypeScript und statisch NICHT auflösbar. Der Wächter kann darüber keine Aussage machen —
// aber „keine Aussage" ist etwas anderes als „kein Import". Wer sie gleichsetzt, baut genau die
// stille Lücke, gegen die dieser Wächter gerichtet ist.
//
// Deshalb sammelt diese Funktion die unauflösbaren Aufrufstellen mit Datei und Zeile. Sie ist
// bewusst NEBEN `importierteModule` gebaut und nicht in ihr: `importiertRahmen` beantwortet eine
// Ja/Nein-Frage und soll das weiter tun. Ein Befund ist keine Antwort auf diese Frage — er ist der
// ehrliche Vermerk, dass die Frage hier nicht beantwortbar war.
function unaufgeloesteAufrufe(quelle: string, dateiname: string): string[] {
  const baum = ts.createSourceFile(
    dateiname,
    quelle,
    ts.ScriptTarget.Latest,
    true,
    artVon(dateiname),
  );
  const offen: string[] = [];
  const besuche = (knoten: ts.Node): void => {
    if (
      ts.isCallExpression(knoten) &&
      (knoten.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(knoten.expression) && knoten.expression.text === "require"))
    ) {
      const erstes = knoten.arguments[0];
      // DIESELBE Literalregel wie in `importierteModule` — bewusst wieder `ts.isStringLiteralLike`
      // und keine eigene Auslegung. Die beiden Stellen sind zwei Fragen an EINE Regel: „was ist
      // auflösbar" und „was blieb übrig". Fielen sie auseinander, gäbe es einen Aufruf, der weder
      // erfasst noch gemeldet wird — die stille Lücke in ihrer schlimmsten Form.
      if (erstes && !ts.isStringLiteralLike(erstes)) {
        const zeile = baum.getLineAndCharacterOfPosition(erstes.getStart()).line + 1;
        offen.push(`${dateiname}:${zeile}`);
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(baum);
  return offen;
}

// Der Anwendungsrahmen selbst — und NUR er. Das Präfix reicht nicht: ein Nachbarmodul wie
// `apps/web/src/AppShell` ist ein anderes Modul und darf den Wächter nicht auslösen.
const RAHMEN_MODUL = /(^|\/)apps\/web\/src\/App(\.[jt]sx?)?$/;

function importiertRahmen(quelle: string, dateiname: string): boolean {
  return importierteModule(quelle, dateiname).some((pfad) => RAHMEN_MODUL.test(pfad));
}

describe("mega61 A · die gemounteten Torwächter-Tests liegen im Web-Typprüfpfad", () => {
  it("sie sind da, wo der Typprüfer der Anwendung sie sieht", () => {
    const erwartet = [
      join("apps", "web", "src", "legal", "mega61-rechtsseiten.test.tsx"),
      join("apps", "web", "src", "legal", "mega61-hinweisbanner.test.tsx"),
    ];
    const vorhanden = dateien(join("apps", "web", "src"), ".test.tsx");
    for (const datei of erwartet) {
      expect(vorhanden, `${datei} fehlt — wurde er zurückverschoben?`).toContain(datei);
    }
  });

  it("KEIN Test unter tests/** zieht die ganze Anwendung in den Wurzel-Typprüfer", () => {
    // Die Regel über die Bauform, nicht über die heutigen Dateien: Wer künftig `App` (oder den
    // Router, der alle Seiten einsammelt) aus einem `tests/**`-Test importiert, wird hier rot —
    // und zwar mit dem Grund, statt später mit acht rätselhaften Typfehlern.
    //
    // GEMESSEN, nicht geraten: `apps/web/src/routes` allein ist heute unbedenklich — ein Test
    // importiert es (tests/app/stage2-gate-mounted.test.tsx) und das Programm bleibt grün.
    // `apps/web/src/App` ist es nicht: es zieht zusätzlich den Anwendungsrahmen mit
    // `import.meta.env`, der Fehlergrenze und den Anmeldeschirmen herein, und genau dort brechen
    // die Wurzel-Einstellungen. Die Regel bleibt deshalb auf das eingeschränkt, was WIRKLICH
    // bricht; würde sie mehr behaupten, wäre sie eine Vermutung mit Testfarbe.
    //
    // AUFTRAG-mega86 Block D: KEINE Selbstausnahme mehr. Diese Datei nennt den Rahmenpfad in
    // Kommentar und Zeichenkette mehrfach — und wird davon nicht mehr rot, weil jetzt der
    // Importgraf zählt und nicht der Dateitext.
    //
    // AUFTRAG-JOB-2062 D1: `testDateien()` statt `dateien("tests", ".tsx")` — seit diesem Durchgang
    // deckt die Erhebung `.ts` UND `.tsx`, also wirklich „alle Tests unter tests/**", wie die
    // Meldung es seit jeher behauptet hat.
    const verstoesse: string[] = [];
    for (const datei of testDateien()) {
      const inhalt = readFileSync(join(WURZEL, datei), "utf8");
      if (importiertRahmen(inhalt, datei)) {
        verstoesse.push(
          `${datei} importiert apps/web/src/App — solche Tests gehören nach apps/web/src/**`,
        );
      }
    }
    expect(verstoesse).toEqual([]);
  });

  // AUFTRAG-JOB-1184 D1: die zweite Hälfte derselben Erhebung. Ein `import()`/`require()`, dessen
  // Pfad erst zur Laufzeit entsteht, ist für diesen Wächter unlesbar — und genau deshalb muss er
  // ihn NENNEN statt ihn zu übergehen. Heute ist die Liste leer; wer den ersten solchen Aufruf
  // einführt, bekommt hier den Ort und die Entscheidung, statt eine stille Lücke zu erben.
  it("kein Test unter tests/** verbirgt seinen Modulpfad hinter einem Platzhalter", () => {
    const offen: string[] = [];
    for (const datei of testDateien()) {
      offen.push(...unaufgeloesteAufrufe(readFileSync(join(WURZEL, datei), "utf8"), datei));
    }
    // AUFTRAG-JOB-2062 D1/D2: Mit der Erweiterung auf `.ts` werden drei VORBESTEHENDE Ladestellen
    // sichtbar, die es vorher auch schon gab — sie lagen nur außerhalb der Grundmenge. Alle drei
    // laden absichtlich dynamisch und dürfen NICHT statisch geschrieben werden; Ort und Grund
    // stehen bei `BEKANNT_UNAUFLOESBAR`. Sie liegen auf fremder Fläche; dieser Durchgang fasst sie
    // nicht an, er BENENNT sie. Damit sind es benannte Grenzen und keine unbenannten — genau die
    // Unterscheidung, auf der I44 steht.
    const unbekannt = offen.filter((ort) => !BEKANNT_UNAUFLOESBAR.has(ort));
    expect(
      unbekannt,
      `Diese Aufrufe sind statisch nicht auflösbar — der Wächter kann über sie NICHTS sagen. Entweder den Pfad statisch schreiben oder in BEKANNT_UNAUFLOESBAR mit Grund eintragen:\n${unbekannt.join("\n")}`,
    ).toEqual([]);
  });

  // AUFTRAG-JOB-2062 D1: die Gegenrichtung, ohne die jede Ausnahmeliste verwahrlost. Eine Ausnahme,
  // deren Stelle es nicht mehr gibt, ist eine Karteileiche — und die nächste Zeile, die zufällig auf
  // dieselbe Nummer rutscht, wäre stillschweigend gedeckt.
  it("jede benannte Ausnahme zeigt noch auf eine wirklich unauflösbare Stelle", () => {
    const offen = new Set<string>();
    for (const datei of testDateien()) {
      for (const ort of unaufgeloesteAufrufe(readFileSync(join(WURZEL, datei), "utf8"), datei)) {
        offen.add(ort);
      }
    }
    const verwaist = [...BEKANNT_UNAUFLOESBAR].filter((ort) => !offen.has(ort));
    expect(
      verwaist,
      `Diese Ausnahmen decken nichts mehr — sie gehören aus der Liste entfernt:\n${verwaist.join("\n")}`,
    ).toEqual([]);
  });
});

// ── AUFTRAG-mega86 Block D: der Erkenner selbst wird gefahren ────────────────────────────────────
//
// Ein Wächter, dessen Erkennung niemand prüft, ist eine Behauptung mit Testfarbe. Die Sonden unten
// fahren beide Richtungen: was ein echter Import IST, und was nur wie einer AUSSIEHT.

describe("mega86 D · der Rahmen-Erkenner liest Importe, nicht Zeichenfolgen", () => {
  const ECHTE_IMPORTE = [
    { form: "gewöhnlicher Import", quelle: 'import App from "../../apps/web/src/App";' },
    { form: "benannter Import", quelle: 'import { App } from "../../apps/web/src/App";' },
    // `import type` wird zwar wegradiert, der Typprüfer LÄDT das Modul aber trotzdem — genau der
    // Fall, den die alte Textsuche zufällig traf und eine naive Import-Regex verfehlt hätte.
    { form: "reiner Typ-Import", quelle: 'import type { X } from "../../apps/web/src/App";' },
    { form: "Seiteneffekt-Import", quelle: 'import "../../apps/web/src/App";' },
    { form: "Re-Export", quelle: 'export { App } from "../../apps/web/src/App";' },
    { form: "dynamischer Import", quelle: 'const m = await import("../../apps/web/src/App");' },
    { form: "require", quelle: 'const m = require("../../apps/web/src/App.tsx");' },
    { form: "mit Endung", quelle: 'import App from "../../apps/web/src/App.tsx";' },
    // AUFTRAG-JOB-1184 D1 (I44, zweitens): ein Template-Literal OHNE Platzhalter ist ein gültiger,
    // statisch lesbarer Modulpfad — TypeScript lädt das Modul genauso. Bis heute Nacht sah der
    // Wächter ihn NICHT (`ts.isStringLiteral`), obwohl die Textsuche davor ihn gesehen hatte.
    // Gemessen: mit `isStringLiteral` bleibt der Wächter grün, obwohl die Datei den Rahmen zieht.
    {
      form: "dynamischer Import als Template-Literal ohne Platzhalter",
      quelle: "const m = await import(`../../apps/web/src/App`);",
    },
    {
      form: "require als Template-Literal ohne Platzhalter",
      quelle: "const m = require(`../../apps/web/src/App.tsx`);",
    },
  ];

  for (const fall of ECHTE_IMPORTE) {
    it(`${fall.form}: wird als Rahmen-Import erkannt`, () => {
      expect(importiertRahmen(fall.quelle, "sonde.tsx")).toBe(true);
    });
  }

  const KEINE_IMPORTE = [
    { form: "Zeilenkommentar", quelle: "// dieser Test importiert apps/web/src/App NICHT\n" },
    { form: "Blockkommentar", quelle: "/* siehe apps/web/src/App für den Rahmen */\n" },
    {
      form: "Zeichenkette",
      quelle: 'const RAHMEN = "apps/web/src/App.tsx";\nexpect(x).not.toContain(RAHMEN);',
    },
    {
      form: "Nachbarmodul mit gleichem Präfix",
      quelle: 'import { AppShell } from "../../apps/web/src/AppShell";',
    },
    { form: "unbeteiligter Import", quelle: 'import { routes } from "../../apps/web/src/routes";' },
  ];

  for (const fall of KEINE_IMPORTE) {
    it(`${fall.form}: macht den Wächter NICHT rot`, () => {
      expect(
        importiertRahmen(fall.quelle, "sonde.tsx"),
        "Der Wächter misst wieder Namensanwesenheit statt Importe — genau die Klasse, die in " +
          "diesem Zyklus mehrfach nicht getragen hat.",
      ).toBe(false);
    });
  }

  // ── AUFTRAG-JOB-1184 D1: die dritte Form, und sie ist die heikelste ────────────────────────────
  //
  // Ein Pfad mit Platzhalter ist statisch nicht auflösbar. Der Wächter darf ihn deshalb WEDER als
  // Rahmen-Import melden (er weiß es nicht) NOCH stillschweigend übergehen (er weiß eben NICHT,
  // dass es keiner ist). Beide Richtungen werden hier einzeln gefahren.
  const MIT_PLATZHALTER = [
    {
      form: "dynamischer Import mit Platzhalter",
      quelle: "const m = await import(`../../apps/web/src/${name}`);",
    },
    {
      form: "require mit Platzhalter",
      quelle: "const m = require(`../../apps/web/src/${name}`);",
    },
    {
      form: "Aufruf mit Variable statt Literal",
      quelle: "const m = await import(pfad);",
    },
  ];

  for (const fall of MIT_PLATZHALTER) {
    it(`${fall.form}: wird NICHT als Rahmen-Import behauptet`, () => {
      expect(
        importiertRahmen(fall.quelle, "sonde.tsx"),
        "Der Wächter würde eine Auflösung behaupten, die er nicht hat.",
      ).toBe(false);
    });

    it(`${fall.form}: wird als UNAUFGELÖST gemeldet, nicht still übergangen`, () => {
      expect(
        unaufgeloesteAufrufe(fall.quelle, "sonde.tsx"),
        "Genau das ist die stille Lücke: der Aufruf fällt durch, ohne dass jemand davon erfährt.",
      ).toEqual(["sonde.tsx:1"]);
    });
  }

  it("GEGENPROBE — ein statisch lesbarer Aufruf erzeugt KEINEN Befund", () => {
    // Ohne sie wäre die Meldung oben wertlos: sie könnte auch daher kommen, dass JEDER Aufruf als
    // unaufgelöst gilt. Beide Literalformen einzeln, weil eine einzige nur sich selbst beweist.
    expect(
      unaufgeloesteAufrufe('const m = await import("../../apps/web/src/App");', "sonde.tsx"),
      "ein gewöhnliches Stringliteral ist auflösbar",
    ).toEqual([]);
    expect(
      unaufgeloesteAufrufe("const m = await import(`../../apps/web/src/App`);", "sonde.tsx"),
      "ein Template-Literal OHNE Platzhalter ist ebenfalls auflösbar",
    ).toEqual([]);
  });

  // ── AUFTRAG-JOB-2062 D1: die Erweiterung auf `.ts` wird gefahren, nicht behauptet ─────────────
  //
  // Drei Fragen, drei Sonden: Sieht der Wächter eine `.ts`-Datei überhaupt? Liest er sie in der
  // richtigen Sprache? Und zählt er dabei keine Datei doppelt?

  it("ein `.ts`-Test, der den Rahmen importiert, wird erkannt — das war die Blindstelle", () => {
    // Bis JOB 2062 D1 kam diese Datei in der Grundmenge nicht vor. Der Import ist derselbe, den der
    // Wächter in einer `.tsx` seit jeher findet; allein die Endung entschied über Sehen und Nicht-
    // sehen. Genau das ist die Klasse, gegen die dieser Wächter gerichtet ist.
    expect(importiertRahmen('import App from "../../apps/web/src/App";', "tests/sonde.ts")).toBe(
      true,
    );
  });

  it("eine `.ts`-Datei wird als TypeScript geparst, nicht als TSX", () => {
    // `const f = <T,>(x: T) => x` ist gültiges TypeScript. Im TSX-Modus liest der Parser `<T,>` als
    // JSX-Element, der Baum wird still falsch — und ein Import dahinter könnte verlorengehen.
    // Die Sonde prüft deshalb nicht die Sprache selbst, sondern ihre FOLGE: der Import wird trotz
    // vorangehender Generic-Pfeilfunktion gefunden.
    const quelle = 'const f = <T,>(x: T) => x;\nimport App from "../../apps/web/src/App";';
    expect(
      importiertRahmen(quelle, "tests/sonde.ts"),
      "Mit TSX-Parsing verschluckt der Baum die Generic-Pfeilfunktion und alles dahinter.",
    ).toBe(true);
    expect(artVon("tests/sonde.ts")).toBe(ts.ScriptKind.TS);
    expect(artVon("tests/sonde.tsx")).toBe(ts.ScriptKind.TSX);
  });

  it("die Grundmenge enthält jede Datei genau einmal und ist echt gewachsen", () => {
    const alle = testDateien();
    expect(new Set(alle).size, "`.tsx` endet nicht auf `.ts` — es darf keine Dublette geben").toBe(
      alle.length,
    );
    const tsx = alle.filter((d) => d.endsWith(".tsx"));
    const nurTs = alle.filter((d) => d.endsWith(".ts"));
    expect(tsx.length + nurTs.length).toBe(alle.length);
    // Die Erweiterung soll die Grundmenge VERGRÖSSERN. Fiele `nurTs` je auf 0, wäre der Wächter
    // klammheimlich wieder da, wo er vorher war — ohne dass ein einziger Fall rot würde.
    expect(
      nurTs.length,
      "kein einziger `.ts`-Test in der Grundmenge — ist die Erhebung zurückgebaut?",
    ).toBeGreaterThan(0);
    expect(alle.length).toBeGreaterThan(tsx.length);
  });

  it("diese Datei nennt den Rahmenpfad — und importiert ihn nicht", () => {
    // Der Selbstbeleg: ohne ihn wäre nicht gezeigt, dass die Selbstausnahme wirklich entbehrlich ist.
    const selbst = readFileSync(__filename, "utf8");
    expect(selbst).toContain("apps/web/src/App");
    expect(importiertRahmen(selbst, "mega61-rechtsseiten.test.tsx")).toBe(false);
  });
});
