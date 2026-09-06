// JOB 3113 H1b / JOB 3125 H1c: örtliches Schreiben ist keine Serverbestätigung.
// setQueryData erneuert dataUpdatedAt und kann eine abgelaufene Zahl wieder sichtbar machen.
// H1c entwertet beim Board-Schreiben im Löschweg die Bestätigung ausdrücklich (updatedAt: 0).
// BEKANNT ist deshalb leer; die Datei bleibt vollständig in der Erhebung.
// Der echte Löschweg wird in loeschen-kopfzaehler-mounted.test.tsx gemessen.
// Der Sammler erkennt literale Schlüssel und updatedAt im Aufruftext (höchstens acht Zeilen),
// nicht Aliase oder die Richtigkeit des übergebenen Zeitpunkts. Die Laufzeitprobe ergänzt ihn.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
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
function schreibzugriffe(): Fund[] {
  const raus: Fund[] = [];
  for (const pfad of dateien(WURZEL)) {
    const zeilen = ohneKommentare(readFileSync(pfad, "utf8")).split("\n");
    zeilen.forEach((zeile, i) => {
      if (!/\bsetQuer(y|ies)Data\s*[<(]/.test(zeile)) {
        return;
      }
      raus.push({
        datei: relative(process.cwd(), pfad),
        zeile: i + 1,
        text: aufrufText(zeilen, i),
      });
    });
  }
  return raus;
}

type Zugriff = Fund & { readonly schluessel: string };

/**
 * Auf welche Zählquellen ein Aufruf ohne erhaltenen Zeitpunkt schreibt.
 *
 * Leer heisst: geht die Sache nichts an. Entweder trifft der Aufruf keine der fünf Zählquellen,
 * oder er reicht `{ updatedAt: … }` mit; react-query übernimmt diesen Wert dann als
 * `dataUpdatedAt`, statt JETZT zu setzen, und die Zahl altert weiter wie sie soll.
 */
function ungedeckteZiele(aufruf: string): string[] {
  if (/\bupdatedAt\s*:/.test(aufruf)) {
    return [];
  }
  return ZAEHLER_SCHLUESSEL.filter((schluessel) => aufruf.includes(schluessel));
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
        "jetzt und lässt damit eine unbestätigte Zahl im Kopfband wieder erscheinen (JOB 3113 " +
        "H1b). Schreibe mit erhaltenem Zeitpunkt — `setQueryData(key, updater, " +
        "{ updatedAt: <bisheriger dataUpdatedAt> })` — statt den Eintrag hier zu ergänzen.",
    ).toEqual([]);
  });

  it("der bekannte Zugriff steht noch — sonst ist sein Eintrag zu streichen", () => {
    expect(
      erledigt(ungedeckteZugriffe(), BEKANNT),
      "Dieser Zugriff schreibt die Zählquelle nicht mehr ungedeckt (Stelle entfernt oder auf " +
        "einen erhaltenen `updatedAt` umgestellt) — der Eintrag in `BEKANNT` ist damit falsch und " +
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
  // ERKENNUNG EINES ERHALTENEN ZEITPUNKTS
  // ==============================================================================================
  // Diese Sammlerfälle ersetzen keinen Laufzeitbeleg für den tatsächlichen Zeitstempel.
  describe("ein Schreibzugriff mit erhaltenem Zeitpunkt gilt als behoben", () => {
    const ohne =
      'qc.setQueriesData({ queryKey: ["validation", "board"] }, (items) => rest(items));';

    it("ohne `updatedAt` zielt er ungedeckt auf die Zählquelle", () => {
      expect(ungedeckteZiele(ohne)).toEqual(['"validation", "board"']);
    });

    it("mit `updatedAt` zählt er nicht mehr als ungedeckt", () => {
      const mit = `${ohne.slice(0, -2)}, { updatedAt: bisher });`;
      expect(ungedeckteZiele(mit)).toEqual([]);
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
        "  { updatedAt: bisher },",
        ");",
      ];
      expect(ungedeckteZiele(aufrufText(zeilen, 0))).toEqual([]);
    });
  });
});
