// JOB 3136 H1e: örtliches Schreiben ist keine Serverbestätigung.
// setQueryData erneuert dataUpdatedAt und kann eine abgelaufene Zahl wieder sichtbar machen.
// Seit H1c entzieht der Löschweg die Bestätigung mit updatedAt: 0. NUR dieses Literal im
// dritten Aufrufargument ist gedeckt; andere Zeitpunkte und fehlende Optionen machen das Tor rot.
// BEKANNT bleibt leer. Der Sammler liest höchstens acht Zeilen; Schlüssel müssen wörtlich wie
// ZAEHLER_SCHLUESSEL im ersten Argument stehen. Erhebung und Urteil treffen setQueryData(...) /
// setQueriesData(...), auch mit Typargumenten, sowie qc.setQueryData(...) und qc?.setQueryData(...)
// (jeweils beide Methoden). Name und öffnende Klammer bzw. < müssen auf derselben Zeile stehen.
// Nicht erhoben: Elementzugriffe qc["setQueryData"](...), optionale Aufrufe f?.(...), umbenannte
// Funktionen und indirekte Aufrufe über .call/.apply/.bind. Kein allgemeiner Datenflussbeweis.
// Gedeckt ist nur ein direktes Optionsobjekt mit genau einer Eigenschaft updatedAt: 0;
// zusätzliche Eigenschaften, Spreads, berechnete Namen und andere Null-Ausdrücke sind ungedeckt.
// Aliasierte Schlüssel werden nicht statisch aufgelöst: Import- und Scope-Auflösung durch eine
// Textsuche wäre unzuverlässig. Der zusätzliche Laufzeitfall „Alias-unabhängig“ in
// loeschen-kopfzaehler-mounted.test.tsx misst den echten Schreiber unabhängig vom Schlüsselnamen.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WURZEL = join(process.cwd(), "apps/web/src");

/** Die Schlüssel der fünf Zählquellen (`api/hooks.ts`), so wie sie im Quelltext stehen. */
const ZAEHLER_SCHLUESSEL = [
  '"validation", "board"',
  '"conflicts"',
  '"duplicates"',
  '"gaps", "summary"',
  '"lifecycle", "pending"',
];

interface Eintrag {
  /** Datei, in der der geduldete Zugriff steht. */
  readonly datei: string;
  /** Der Zählschlüssel, auf den er zielt — wörtlich wie im Quelltext. */
  readonly schluessel: string;
  /** Wie viele ungedeckte Zugriffe auf genau diesen Schlüssel dort geduldet sind. */
  readonly anzahl: number;
  /** Warum, am Code geprüft. */
  readonly grund: string;
}

/** H1c hat den letzten geduldeten Zugriff entfernt. Keine Dateiausnahme. */
const BEKANNT: readonly Eintrag[] = [];

/** Datei + Schlüssel als eine Zeile — die Kennung, unter der gezählt wird. */
const kennung = (datei: string, schluessel: string): string => `${datei} → ${schluessel}`;

function dateien(ordner: string): string[] {
  const raus: string[] = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) {
      raus.push(...dateien(pfad));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      raus.push(pfad);
    }
  }
  return raus;
}

/** Zeilenkommentare und Blockkommentare durch Leerzeichen ersetzen — Zeilenzahlen bleiben gleich. */
function ohneKommentare(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
}

interface Fund {
  readonly datei: string;
  readonly zeile: number;
  readonly text: string;
}

/**
 * Der GANZE Aufruf ab der Fundzeile: bis die runden Klammern wieder aufgehen, höchstens acht
 * Zeilen. Ein festes Fenster von drei Zeilen verlöre bei mehrzeiligen Aufrufen genau das Argument,
 * auf das es ankommt — den Schlüssel und ein etwaiges `{ updatedAt: … }`.
 */
function aufrufText(zeilen: string[], start: number): string {
  const teile: string[] = [];
  let tiefe = 0;
  for (let i = start; i < Math.min(zeilen.length, start + 8); i++) {
    const zeile = zeilen[i] ?? "";
    teile.push(zeile);
    for (const zeichen of zeile) {
      if (zeichen === "(") {
        tiefe++;
      } else if (zeichen === ")") {
        tiefe--;
      }
    }
    if (tiefe <= 0) {
      break;
    }
  }
  return teile.join(" ");
}

/** Jeder örtliche Cache-Schreibzugriff im Produkt, mit dem ganzen Aufruf als Zielangabe. */
function schreibzugriffe(
  quellen = dateien(WURZEL).map((pfad) => ({
    datei: relative(process.cwd(), pfad),
    text: readFileSync(pfad, "utf8"),
  })),
): Fund[] {
  const raus: Fund[] = [];
  for (const quelle of quellen) {
    const zeilen = ohneKommentare(quelle.text).split("\n");
    zeilen.forEach((zeile, i) => {
      if (!/\bsetQuer(y|ies)Data\s*[<(]/.test(zeile)) {
        return;
      }
      raus.push({
        datei: quelle.datei,
        zeile: i + 1,
        text: aufrufText(zeilen, i),
      });
    });
  }
  return raus;
}

type Zugriff = Fund & { readonly schluessel: string };

/** Nur das direkte Optionsargument mit Literal 0 entzieht die Bestätigung sicher.
 * Spreads, berechnete Namen und doppelte Eigenschaften können diesen Wert überschreiben.
 * Der TypeScript-Parser unterscheidet Optionen von Daten/Updatern und 0 von Ausdrücken mit 0.
 */
function entziehtBestaetigung(optionen: ts.Expression | undefined): boolean {
  if (!optionen || !ts.isObjectLiteralExpression(optionen) || optionen.properties.length !== 1) {
    return false;
  }
  const eigenschaft = optionen.properties[0];
  return (
    eigenschaft !== undefined &&
    ts.isPropertyAssignment(eigenschaft) &&
    (ts.isIdentifier(eigenschaft.name) || ts.isStringLiteral(eigenschaft.name)) &&
    eigenschaft.name.text === "updatedAt" &&
    ts.isNumericLiteral(eigenschaft.initializer) &&
    eigenschaft.initializer.getText() === "0"
  );
}

/** Zählquellen ohne ausdrückliche Entwertung. Geprüft wird jeder Cache-Aufruf im Fenster;
 * Optionen eines benachbarten oder verschachtelten Aufrufs decken den Schreiber nicht.
 * Schlüsselaliase bleiben eine benannte Grenze der Erhebung, ergänzt durch die Laufzeitprobe.
 */
function ungedeckteZiele(aufruf: string): string[] {
  const quelle = ts.createSourceFile("aufruf.ts", aufruf, ts.ScriptTarget.Latest, true);
  const ziele = new Set<string>();
  const besuchen = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ((ts.isPropertyAccessExpression(node.expression) &&
        /^setQuer(y|ies)Data$/.test(node.expression.name.text)) ||
        (ts.isIdentifier(node.expression) && /^setQuer(y|ies)Data$/.test(node.expression.text))) &&
      !entziehtBestaetigung(node.arguments[2])
    ) {
      const ziel = node.arguments[0]?.getText() ?? "";
      for (const schluessel of ZAEHLER_SCHLUESSEL) {
        if (ziel.includes(schluessel)) {
          ziele.add(schluessel);
        }
      }
    }
    ts.forEachChild(node, besuchen);
  };
  besuchen(quelle);
  return [...ziele];
}

/** Die Schreibzugriffe des Produkts, die auf eine Zählquelle ungedeckt schreiben. */
function ungedeckteZugriffe(): Zugriff[] {
  return schreibzugriffe().flatMap((fund) =>
    ungedeckteZiele(fund.text).map((schluessel) => ({ ...fund, schluessel })),
  );
}

/** Kennung -> die ungedeckten Zugriffe, die unter ihr gefunden wurden. */
function bestand(funde: Zugriff[]): Map<string, Zugriff[]> {
  const karte = new Map<string, Zugriff[]>();
  for (const fund of funde) {
    const name = kennung(fund.datei, fund.schluessel);
    karte.set(name, [...(karte.get(name) ?? []), fund]);
  }
  return karte;
}

/**
 * Die REGEL, getrennt von der Erhebung: was über die geduldete Anzahl hinausgeht, ist Neuzugang.
 *
 * Getrennt, damit sie mit erfundenen Eingaben geprüft werden kann, ohne das Produkt zu verstellen —
 * insbesondere der Fall, an dem Runde 3 scheiterte: ein ZWEITER Zugriff in der bekannten Datei.
 */
function ueberschuss(funde: Zugriff[], geduldet: readonly Eintrag[]): string[] {
  const erlaubt = new Map(geduldet.map((e) => [kennung(e.datei, e.schluessel), e.anzahl]));
  const raus: string[] = [];
  for (const [name, treffer] of bestand(funde)) {
    for (const fund of treffer.slice(erlaubt.get(name) ?? 0)) {
      raus.push(`${fund.datei}:${fund.zeile} → ${fund.schluessel}`);
    }
  }
  return raus;
}

/** Die Einträge, deren geduldeter Zugriff nicht mehr (oder nicht mehr oft genug) dasteht. */
function erledigt(funde: Zugriff[], geduldet: readonly Eintrag[]): string[] {
  const vorhanden = bestand(funde);
  return geduldet
    .filter((e) => (vorhanden.get(kennung(e.datei, e.schluessel))?.length ?? 0) < e.anzahl)
    .map((e) => kennung(e.datei, e.schluessel));
}

describe("JOB 3113 H1b: kein örtlicher Cache-Eingriff erneuert die Bestätigung einer Zählquelle", () => {
  it("KALIBRIERUNG: die Erhebung findet die vorhandenen Schreibzugriffe überhaupt", () => {
    // Ohne diese Zusicherung wäre ein kaputter Sucher (falscher Pfad, falsche Regex) von einem
    // sauberen Produkt nicht zu unterscheiden — der Wächter meldete stumm Entwarnung.
    expect(
      schreibzugriffe().length,
      "Die Quelltext-Erhebung findet gar nichts — sie ist kaputt",
    ).toBeGreaterThan(0);
    // Und sie findet den bekannten Zugriff wirklich, mit genau der eingetragenen Anzahl: sonst
    // wäre der Eintrag in `BEKANNT` eine Behauptung über eine Stelle, die niemand mehr sieht.
    const gefunden = bestand(ungedeckteZugriffe());
    for (const eintrag of BEKANNT) {
      const name = kennung(eintrag.datei, eintrag.schluessel);
      expect(
        gefunden.get(name)?.length,
        `Der eingetragene Zugriff ${name} wird von der Erhebung nicht gefunden — der Eintrag beschreibt nichts Wirkliches.`,
      ).toBe(eintrag.anzahl);
    }
  });

  it("kein NEUER ungedeckter Schreibzugriff — auch nicht in der bekannten Datei", () => {
    expect(
      ueberschuss(ungedeckteZugriffe(), BEKANNT),
      "Örtlicher Schreibzugriff auf eine Zählquelle: `setQueryData` setzt `dataUpdatedAt` auf " +
        "jetzt oder auf einen unbestätigten Zeitpunkt (JOB 3136 H1e). Nur das Literal " +
        "`{ updatedAt: 0 }` im dritten Argument ist gedeckt: es entzieht die Bestätigung. " +
        "Date.now(), new Date(), Variablen und fehlende Optionen sind ungedeckt; " +
        "keine Ausnahme ergänzen.",
    ).toEqual([]);
  });

  it("der bekannte Zugriff steht noch — sonst ist sein Eintrag zu streichen", () => {
    expect(
      erledigt(ungedeckteZugriffe(), BEKANNT),
      "Dieser Zugriff schreibt die Zählquelle nicht mehr ungedeckt (Stelle entfernt oder auf " +
        "`updatedAt: 0` umgestellt) — der Eintrag in `BEKANNT` ist damit falsch und " +
        "gehört gestrichen (H1c). Eine Ausnahmeliste, die nur wächst, ist der Anfang vom Ende " +
        "dieses Wächters.",
    ).toEqual([]);
  });

  // ==============================================================================================
  // DIE REGEL SELBST — hier scheiterte Runde 3 (Ben, Korrekturpflicht 1)
  // ==============================================================================================
  // Runde 3 versprach „JEDEN weiteren örtlichen Schreibzugriff rot", nahm aber die ganze Datei aus;
  // Bens Gegenprobe (ein zusätzliches `setQueryData(["conflicts"], …)` in genau dieser Datei) blieb
  // grün. Diese Fälle halten das Versprechen ab jetzt fest, ohne dass jemand das Produkt verstellen
  // muss: sie führen der Regel erfundene Erhebungen vor.
  describe("Neuzugang wird auch INNERHALB der geduldeten Datei erkannt", () => {
    const DATEI = "apps/web/src/pages/Validation.tsx";
    const geduldet: readonly Eintrag[] = [
      { datei: DATEI, schluessel: '"validation", "board"', anzahl: 1, grund: "Prüffall" },
    ];
    const zugriff = (schluessel: string, zeile: number): Zugriff => ({
      datei: DATEI,
      zeile,
      text: "",
      schluessel,
    });

    it("der geduldete Zugriff allein ist kein Neuzugang", () => {
      expect(ueberschuss([zugriff('"validation", "board"', 216)], geduldet)).toEqual([]);
    });

    it("Bens Fall: ein ANDERER Zählschlüssel in derselben Datei ist Neuzugang", () => {
      expect(
        ueberschuss([zugriff('"validation", "board"', 216), zugriff('"conflicts"', 224)], geduldet),
      ).toEqual([`${DATEI}:224 → "conflicts"`]);
    });

    it("ein ZWEITER Zugriff auf denselben Schlüssel in derselben Datei ist Neuzugang", () => {
      expect(
        ueberschuss(
          [zugriff('"validation", "board"', 216), zugriff('"validation", "board"', 300)],
          geduldet,
        ),
      ).toEqual([`${DATEI}:300 → "validation", "board"`]);
    });

    it("fällt der geduldete Zugriff weg, verlangt der Wächter das Streichen seines Eintrags", () => {
      expect(erledigt([], geduldet)).toEqual([`${DATEI} → "validation", "board"`]);
    });
  });

  // ==============================================================================================
  // NUR DAS LITERAL 0 ENTZIEHT DIE BESTÄTIGUNG
  // ==============================================================================================
  // Diese Sammlerfälle ersetzen keinen Laufzeitbeleg für den tatsächlichen Zeitstempel.
  describe("nur updatedAt: 0 im Optionsargument deckt einen Schreibzugriff", () => {
    it.each([
      "qc.setQueryData",
      "setQueryData",
      "qc?.setQueryData",
      "qc.setQueriesData",
      "setQueriesData",
      "qc?.setQueriesData",
    ])("Aufrufform %s: fehlende und falsche Bestätigung werden geurteilt", (form) => {
      expect(ungedeckteZiele(`${form}(["conflicts"], (i) => i);`)).toEqual(['"conflicts"']);
      // Dieselben Eingaben durch die echte Erhebung führen: kein Fund darf zwischen
      // Zeilensammler und Syntaxbaum-Urteil stumm verloren gehen (Ben, Runde 1).
      for (const typ of ["", "<unknown>"]) {
        const text = `${form}${typ}(["conflicts"], (i) => i);`;
        const funde = schreibzugriffe([{ datei: "Probe.tsx", text: `\n${text}` }]);
        expect(funde).toEqual([{ datei: "Probe.tsx", zeile: 2, text }]);
        expect(
          ueberschuss(
            funde.flatMap((fund) =>
              ungedeckteZiele(fund.text).map((schluessel) => ({ ...fund, schluessel })),
            ),
            [],
          ),
        ).toEqual(['Probe.tsx:2 → "conflicts"']);
      }
      for (const wert of ["Date.now()", "new Date()", "bisher"]) {
        expect(
          ungedeckteZiele(`${form}(["conflicts"], (i) => i, { updatedAt: ${wert} });`),
        ).toEqual(['"conflicts"']);
      }
      expect(ungedeckteZiele(`${form}(["conflicts"], (i) => i, { updatedAt: 0 });`)).toEqual([]);
    });

    it.each([
      'qc["setQueryData"](["conflicts"], (i) => i);',
      'qc.setQueryData?.(["conflicts"], (i) => i);',
      'schreiben(["conflicts"], (i) => i);',
      'qc.setQueryData.call(qc, ["conflicts"], (i) => i);',
      'qc.setQueryData.apply(qc, [["conflicts"], (i) => i]);',
      'qc.setQueryData.bind(qc)(["conflicts"], (i) => i);',
      'qc.setQueryData\n(["conflicts"], (i) => i);',
    ])("benannte Erhebungsgrenze: %s", (text) => {
      expect(schreibzugriffe([{ datei: "Probe.tsx", text }])).toEqual([]);
    });

    const ohne =
      'qc.setQueriesData({ queryKey: ["validation", "board"] }, (items) => rest(items));';

    it("ohne `updatedAt` zielt er ungedeckt auf die Zählquelle", () => {
      expect(ungedeckteZiele(ohne)).toEqual(['"validation", "board"']);
    });

    it("mit `updatedAt: 0` zählt er nicht mehr als ungedeckt", () => {
      const mit = `${ohne.slice(0, -2)}, { updatedAt: 0 });`;
      expect(ungedeckteZiele(mit)).toEqual([]);
    });

    it.each(["Date.now()", "new Date()", "bisher", "1", "0 + Date.now()", "0 || Date.now()"])(
      "updatedAt: %s ist keine Entwertung",
      (wert) => {
        expect(ungedeckteZiele(`${ohne.slice(0, -2)}, { updatedAt: ${wert} });`)).toEqual([
          '"validation", "board"',
        ]);
      },
    );

    it.each([
      "{ updatedAt: 0, ...optionen }",
      "{ updatedAt: 0, updatedAt: Date.now() }",
      "{ meta: { updatedAt: 0 } }",
    ])("verdeckte oder überschriebene Entwertung %s deckt nicht", (optionen) => {
      expect(ungedeckteZiele(`${ohne.slice(0, -2)}, ${optionen});`)).toEqual([
        '"validation", "board"',
      ]);
    });

    it("updatedAt: 0 in den Daten ist kein Optionsargument", () => {
      expect(ungedeckteZiele('qc.setQueryData(["conflicts"], { updatedAt: 0 });')).toEqual([
        '"conflicts"',
      ]);
    });

    it("Date.now() meldet Datei und Aufrufzeile", () => {
      const text = `${ohne.slice(0, -2)}, { updatedAt: Date.now() });`;
      const funde = ungedeckteZiele(text).map((schluessel) => ({
        datei: "apps/web/src/pages/Probe.tsx",
        zeile: 42,
        text,
        schluessel,
      }));
      expect(ueberschuss(funde, [])).toEqual([
        'apps/web/src/pages/Probe.tsx:42 → "validation", "board"',
      ]);
    });

    it("liest höchstens acht Zeilen und duldet keine Entwertung ausserhalb des Fensters", () => {
      const zeilen = [
        "qc.setQueriesData(",
        '  { queryKey: ["validation", "board"] },',
        "  (items) => {",
        "    const rest = items;",
        "    return rest;",
        "  },",
        "",
        "",
        "  { updatedAt: 0 },",
        ");",
      ];
      const text = aufrufText(zeilen, 0);
      expect(text).toBe(zeilen.slice(0, 8).join(" "));
      expect(ungedeckteZiele(text)).toEqual(['"validation", "board"']);
    });

    it("ein Schlüssel, der keine Zählquelle ist, geht den Wächter nichts an", () => {
      expect(ungedeckteZiele('qc.setQueriesData({ queryKey: ["kos"] }, (i) => rest(i));')).toEqual(
        [],
      );
    });

    it("der mehrzeilige Aufruf wird ganz gelesen — sonst entginge das späte `updatedAt`", () => {
      const zeilen = [
        'qc.setQueriesData<KnowledgeObject[]>({ queryKey: ["validation", "board"] }, (items) =>',
        "  withoutKoById(items, id),",
        "  { updatedAt: 0 },",
        ");",
      ];
      expect(ungedeckteZiele(aufrufText(zeilen, 0))).toEqual([]);
    });
  });
});
