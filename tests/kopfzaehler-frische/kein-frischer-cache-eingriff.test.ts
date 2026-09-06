// ================================================================================================
// JOB 3113 · H1b — EIN ÖRTLICHER EINGRIFF IST KEINE NEUE BESTÄTIGUNG.
// ================================================================================================
//
// Codex' Befund an Runde 1, wörtlich: „Eine lokale Cache-Änderung lässt die abgelaufene Zahl ohne
// erfolgreichen neuen Listenabruf wieder erscheinen." Der Grund liegt in react-query:
// `setQueryData` setzt `dataUpdatedAt` auf JETZT — dasselbe Feld, an dem seit H1b die Aussage
// „diese Zahl ist frisch bestätigt" hängt (`lib/loadingState.ts`, `gruppeVeraltet`). Ein Klick, der
// nur örtlich etwas aus einer Liste entfernt, verlängert damit die Deckung einer Zahl, die niemand
// mehr bestätigt hat.
//
// ------------------------------------------------------------------------------------------------
// WARUM DIESE DATEI MELDET UND NICHT REPARIERT
// ------------------------------------------------------------------------------------------------
// Zu schliessen ist der Fall NUR beim Schreiber: react-query gibt am Ergebnis kein zweites Feld
// heraus, das ausschliesslich echte Abrufe zählt — der Leser (`gruppeVeraltet`) kann die beiden
// Fälle nicht auseinanderhalten. Der einzige bekannte Schreiber ist der örtliche Löschschritt der
// Prüfen-Seite, und `apps/web/src/pages/Validation.tsx` gehört zur Laufzeit dieses Auftrags dem
// parallel laufenden JOB 3112 (Q3d). Zwei Bahnen an derselben Produktdatei sind verboten; Runde 2
// hat die Datei angefasst und wurde dafür als Zielpfad-Verstoss rot geurteilt.
//
// Deshalb hier das Verfahren der Register aus `tests/capture/aufrufer-waechter.test.ts`: der
// bekannte Bestand wird EINGEFROREN und benannt, der Neuzugang ist gesperrt.
//
//   · ein NEUER ungedeckter Schreibzugriff auf eine der fünf Zählquellen -> rot, mit Datei und Zeile
//   · der EINE bekannte Zugriff                                          -> geduldet, hier begründet
//   · der bekannte Zugriff ist behoben                                   -> rot mit „Eintrag streichen"
//
// Der letzte Fall ist Absicht und nicht Schikane: eine Liste, die nur wächst, ist der Anfang vom
// Ende eines Wächters. Wenn H1c die Stelle umstellt, verlangt dieser Test seine eigene Verkürzung.
//
// ------------------------------------------------------------------------------------------------
// WAS GENAU AUSGENOMMEN IST — NICHT DIE DATEI (Ben an Runde 3, Korrekturpflicht 1)
// ------------------------------------------------------------------------------------------------
// Runde 3 nahm die ganze DATEI `pages/Validation.tsx` aus. Bens Gegenprobe hat das widerlegt: ein
// zusätzliches `qc.setQueryData(["conflicts"], [])` in derselben Datei blieb unbemerkt, die Zusage
// „JEDEN weiteren örtlichen Schreibzugriff rot" war damit unwahr. Ausgenommen ist ab jetzt der
// EINE Zugriff, identifiziert durch Datei + Zählschlüssel + ANZAHL. Ein zweiter Schreibzugriff auf
// denselben Schlüssel oder einer auf einen anderen Zählschlüssel — auch innerhalb dieser Datei —
// ist Neuzugang und damit rot.
//
// Nicht über Zeilennummern: die Datei gehört gerade JOB 3112, jede Einfügung darüber verschöbe die
// Zeile und machte den Wächter zum Fehlalarm. Datei + Schlüssel + Anzahl ist so eng, wie es geht,
// ohne an fremder Arbeit zu scheitern.
//
// ------------------------------------------------------------------------------------------------
// WORAN DER WÄCHTER DIE REPARATUR ERKENNT
// ------------------------------------------------------------------------------------------------
// Als ungedeckt zählt nur ein Schreibzugriff OHNE erhaltenen Zeitpunkt. Steht im Aufruf
// `{ updatedAt: … }` (react-query übernimmt den Wert dann als `dataUpdatedAt`, statt JETZT zu
// setzen), ist der Fall behoben und wird nicht mehr gezählt. Daraus folgt beides in einem: der
// erlaubte Weg für neue Schreiber ist derselbe, den die Fehlermeldung nennt, UND sobald H1c den
// bekannten Zugriff umstellt, fällt er aus der Erhebung — der dritte Fall wird rot und verlangt das
// Streichen des Eintrags. Das ist die Stelle, die H1c bemerkt; der gemountete Prüfstand misst nur
// das Verhalten von react-query, nicht den Produkt-Schreiber (Ben, Korrekturpflicht 2).
//
// Gelesen wird der Quelltext, nicht der Baum: gesucht wird der Aufruf UND der Schlüssel, auf den er
// zielt. Kommentare zählen dabei nicht mit (sie werden vor der Suche entfernt) — sonst deckte
// dieser Kommentarblock sich selbst als Fund.
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

/**
 * Der eingefrorene Bestand — je Zeile EIN Zugriff, nicht eine ganze Datei.
 *
 * `pages/Validation.tsx` schreibt im Löschweg örtlich `["validation","board"]` (und `["kos"]`, das
 * keine Zählquelle ist) und stösst danach einen Neuabruf an (`refreshAfterDelete`). Solange dieser
 * Abruf offen ist oder scheitert, steht die Zahl im Kopfband wieder da, obwohl sie niemand
 * bestätigt hat — der Fall aus Codex' Befund.
 */
const BEKANNT: readonly Eintrag[] = [
  {
    datei: "apps/web/src/pages/Validation.tsx",
    schluessel: '"validation", "board"',
    anzahl: 1,
    grund:
      "Örtlicher Löschschritt (`removeDeletedKoFromCaches`) mit anschliessendem Neuabruf. Offener " +
      "Rest von JOB 3113: die Datei hält zur Laufzeit JOB 3112 (Q3d), zwei Bahnen an derselben " +
      "Produktdatei sind verboten. Umstellung in H1c, sobald 3112 LIVE ist.",
  },
];

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
 * Auf welche Zählquellen ein Aufruf UNGEDECKT schreibt — die Stelle, an der H1c erkannt wird.
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
  // SO ERKENNT DIESER WÄCHTER DIE REPARATUR IN H1c
  // ==============================================================================================
  // Der gemountete Prüfstand kann das nicht: er schreibt seinen Cache selbst und misst damit
  // react-query, nicht den Produkt-Schreiber (Ben, Korrekturpflicht 2). HIER liegt die Erkennung —
  // am wirklichen Quelltext, über das eine Merkmal, das den behobenen Fall auszeichnet.
  describe("ein Schreibzugriff mit erhaltenem Zeitpunkt gilt als behoben", () => {
    const ohne =
      'qc.setQueriesData({ queryKey: ["validation", "board"] }, (items) => rest(items));';

    it("ohne `updatedAt` zielt er ungedeckt auf die Zählquelle", () => {
      expect(ungedeckteZiele(ohne)).toEqual(['"validation", "board"']);
    });

    it("mit `updatedAt` zählt er nicht mehr — genau das ist die H1c-Umstellung", () => {
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
