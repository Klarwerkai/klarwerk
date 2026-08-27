// ================================================================================================
// JOB 2363 D1 — DER ENTSCHEIDUNGSHELFER NACH EINEM KONSOLENABBRUCH.
// ================================================================================================
//
// WAS HIER GEPRUEFT WIRD: `idle-in-transaction.ts`, der Entscheidungshelfer zu Punkt 2 der
// I10-Regel. Ihr Wortlaut steht in der Ursprungsakte `PAPIERKORB-AUFRAEUMEN-26072026.md:58` und
// ist in `RUECKGABE-PRO-JOB-678-D3-KORREKTUR.md:325-337` zitiert:
//
//   „Bricht eine Datenbankkonsole ab, verliert die Verbindung oder gibt eine neue Shell aus, wird
//    ZUERST geprueft, ob eine Sitzung offen haengt, bevor etwas Neues gestartet wird … Steht dort
//    eine Zeile, wird sie mit `select pg_terminate_backend(<pid>);` beendet und das Ergebnis
//    protokolliert. Erst danach beginnt der naechste Versuch."
//
// DIE ZUSICHERUNGEN P1–P7 sind nicht erfunden: sie stehen in
// `RUECKGABE-PRO-JOB-678-D3-KORREKTUR.md:133-160`, dort mit vier Gegenmutationen gemessen. Diese
// Datei baut sie nach, weil der Helfer selbst nie ins Produkt kam — er lag in einer Arbeitsspur,
// die es nicht mehr gibt.
//
// WARUM DIESE PRUEFUNG UEBERHAUPT GEBRAUCHT WIRD. Eine Sitzung im Zustand `idle in transaction`
// haelt ihre Sperren, bis jemand sie beendet. Der naechste Versuch laeuft dann in ein Timeout, das
// wie ein Fehler des neuen Versuchs aussieht und keiner ist. Die Regel schliesst das — aber nur,
// wenn die Entscheidung „beenden oder warten" nicht jedes Mal neu geraten wird.
//
// DIE FALLE, DIE DIESER HELFER STELLT (P3/P4): `idle` und `idle in transaction` sind ZWEI
// Zustaende. `idle` ist eine ruhende Verbindung ohne offene Transaktion — sie haelt nichts und
// darf NICHT beendet werden. `active` ist eine arbeitende Sitzung — sie zu beenden hiesse, laufende
// Arbeit abzuschneiden. Wer die drei verwechselt, macht mit der Regel mehr kaputt als ohne sie.
//
// REICHWEITENGRENZE, ausdruecklich: Diese Datei prueft die ENTSCHEIDUNGSLOGIK an aufgezeichneten
// Zeilen. Sie prueft NICHT, dass PostgreSQL diese Zeilen so liefert, und sie prueft NICHT, dass
// nach einem Abbruch tatsaechlich jemand nachsieht. Das erste faellt erst in einem Integrationslauf,
// das zweite ist organisatorisch und haengt an der Regel im Regelwerk, nicht an einem Test.
// ================================================================================================
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type PgAktivitaetszeile,
  ZUSTAND_HAENGT,
  beendigungsbefehl,
  bewerte,
  pruefbefehl,
} from "./idle-in-transaction";

/** Der echte Vorfall aus der Ursprungsakte — Zahlen unveraendert uebernommen. */
const VORFALL: PgAktivitaetszeile = {
  pid: 939384,
  state: "idle in transaction",
  offenSekunden: 403,
  query: "insert into ko_search_projection …",
};

const zeile = (
  pid: number,
  state: string,
  offenSekunden: number,
  query = "select 1",
): PgAktivitaetszeile => ({ pid, state, offenSekunden, query });

/**
 * Die sieben bekannten Wege, I/O in ein Modul zu holen — fuer P7b (JOB 2444).
 *
 * Kommentare werden vorher entfernt: Ein Kopfkommentar, der `import` oder `process` ERWAEHNT,
 * ist kein I/O. Ohne diese Bereinigung waere P7b in genau der Datei rot, deren Kopf die Regel
 * erklaert — und ein Waechter, der an seiner eigenen Begruendung scheitert, wird abgeschaltet.
 */
const IO_WEGE: readonly { name: string; muster: RegExp }[] = [
  { name: "statischer Import", muster: /^\s*import\s/m },
  { name: "dynamischer Import", muster: /\bimport\s*\(/ },
  // `createRequire` muss ausdruecklich mit hinein: `\brequire` greift dort NICHT, weil das `R`
  // gross ist und mitten im Wort steht. P7c hat genau das aufgedeckt — die Kalibrierung hat sich
  // damit im ersten Lauf selbst bezahlt gemacht.
  { name: "require", muster: /\b(create)?[Rr]equire\s*\(/ },
  { name: "fetch", muster: /\bfetch\s*\(/ },
  { name: "process", muster: /\bprocess\s*\./ },
  { name: "globalThis", muster: /\bglobalThis\s*\./ },
  { name: "new Function", muster: /\bnew\s+Function\s*\(/ },
];

function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function ioWege(quelle: string): string[] {
  const kern = ohneKommentare(quelle);
  return IO_WEGE.filter((w) => w.muster.test(kern)).map((w) => w.name);
}

describe("JOB 2363 D1 · P — der Entscheidungshelfer nach dem Konsolenabbruch", () => {
  it("P1 · der echte Vorfall: haengende Sitzung → beenden, PID benannt, Befehl vollstaendig", () => {
    const befund = bewerte([VORFALL]);
    expect(befund.handeln).toBe("beenden");
    expect(befund.pids).toEqual([939384]);
    expect(befund.befehle).toEqual(["select pg_terminate_backend(939384);"]);
  });

  it("P2 · leeres Ergebnis → frei, ohne PID und ohne Befehl", () => {
    const befund = bewerte([]);
    expect(befund.handeln).toBe("frei");
    expect(befund.pids).toEqual([]);
    expect(befund.befehle).toEqual([]);
  });

  // DIE FALLE. `idle` sieht aus wie `idle in transaction` und ist das Gegenteil: keine offene
  // Transaktion, keine gehaltene Sperre. Wer hier beendet, wirft eine gesunde Verbindung weg.
  it("P3 · `idle` OHNE Transaktion → frei, nicht beenden", () => {
    const befund = bewerte([zeile(4711, "idle", 900)]);
    expect(befund.handeln).toBe("frei");
    expect(befund.pids).toEqual([]);
  });

  it("P4 · `active` seit 900 s → warten, NIEMALS beenden", () => {
    const befund = bewerte([zeile(4712, "active", 900)]);
    expect(befund.handeln).toBe("warten");
    expect(befund.pids).toEqual([]);
    expect(befund.befehle).toEqual([]);
  });

  it("P5 · drei haengende Sitzungen → laengste zuerst", () => {
    const befund = bewerte([
      zeile(100, "idle in transaction", 12),
      zeile(200, "idle in transaction", 1801),
      zeile(939384, "idle in transaction", 403),
    ]);
    expect(befund.handeln).toBe("beenden");
    expect(befund.pids).toEqual([200, 939384, 100]);
    expect(befund.befehle).toEqual([
      "select pg_terminate_backend(200);",
      "select pg_terminate_backend(939384);",
      "select pg_terminate_backend(100);",
    ]);
  });

  it("P6 · der Pruefbefehl filtert auf `state = 'idle in transaction'`", () => {
    const befehl = pruefbefehl();
    expect(befehl).toContain("state = 'idle in transaction'");
    expect(befehl).toContain("pg_stat_activity");
    // Die Sortierung gehoert zum Befehl: ohne sie ist „laengste zuerst" schon an der Quelle weg.
    expect(befehl).toContain("order by xact_start");
    // Ein einziger Aufruf — Punkt 1 derselben Regel verbietet die interaktive Klammer.
    expect(befehl.startsWith('psql -c "')).toBe(true);
  });

  // KALIBRIERUNG. Ohne P7 waeren P1–P6 auch dann gruen, wenn `bewerte` heimlich eine Verbindung
  // oeffnete oder seine Eingabe umschriebe. Beides wird hier ausgeschlossen — einmal am Verhalten,
  // einmal an der Quelle.
  it("P7 · `bewerte` ist rein: Eingabe unveraendert, Ergebnis wiederholbar", () => {
    const eingabe = [VORFALL, zeile(4712, "active", 900)];
    const vorher = JSON.stringify(eingabe);
    const erst = bewerte(eingabe);
    const zweit = bewerte(eingabe);
    expect(JSON.stringify(eingabe)).toBe(vorher);
    expect(zweit).toEqual(erst);
  });

  // ==============================================================================================
  // P7b — VERSCHAERFT IN JOB 2444, nachdem BEN die alte Fassung zu Recht als zu schwach geruegt hat.
  //
  // ALT stand hier nur:  quelle.split("\n").filter((z) => /^\s*import\b/.test(z))
  // Das prueft eine STATISCHE Importzeile am Zeilenanfang — und sonst nichts.
  //
  // GEMESSEN (JOB 2444, `p7b-probe.mjs` der Arbeitsspur zu JOB 2363 D2): Von SIEBEN Wegen, I/O in
  // dieses Modul zu holen, fing die alte Fassung genau EINEN. Durch kamen: dynamischer Import
  // `await import("pg")`, derselbe in Zeilenmitte, `createRequire`, globales `fetch`, globales
  // `process` und der Umweg ueber `globalThis`.
  //
  // WARUM DAS ZAEHLT: Dieses Modul verspricht in seinem Kopf, KEIN I/O zu treiben — es formuliert
  // nur einen Befehl und beurteilt sein Ergebnis. Waere das Versprechen still gebrochen, wuerde
  // ein Entscheidungshelfer, den man fuer rein haelt, plaetzlich eine Verbindung oeffnen.
  //
  // DIE VERSCHAERFUNG prueft alle sieben Wege — und der Fall P7c darunter belegt, dass sie das
  // wirklich tun. Eine Musterliste ohne Kalibrierung waere derselbe Fehler eine Ebene hoeher.
  // ==============================================================================================
  it("P7b · das Modul zieht kein I/O herein — auf keinem der sieben bekannten Wege", () => {
    const quelle = readFileSync(new URL("./idle-in-transaction.ts", import.meta.url), "utf8");
    expect(ioWege(quelle)).toEqual([]);
  });

  // KALIBRIERUNG zu P7b. Ohne sie waere die Musterliste eine Behauptung: Sie koennte auf KEINEN
  // dieser Wege anschlagen, und P7b bliebe trotzdem gruen — genau die Bauart, an der die alte
  // Fassung gescheitert ist.
  it("P7c · KALIBRIERUNG: die Musterliste faengt jeden der sieben Wege einzeln", () => {
    const wege: readonly [string, string][] = [
      ["statischer Import", 'import { Pool } from "pg";'],
      ["dynamischer Import", 'const pg = await import("pg");'],
      [
        "dynamischer Import, Zeilenmitte",
        'const x = 1; const cp = await import("node:child_process");',
      ],
      [
        "require ueber createRequire",
        'const cp = createRequire(import.meta.url)("node:child_process");',
      ],
      ["globales fetch", 'await fetch("https://example.invalid");'],
      ["globales process", "const url = process.env.DATABASE_URL;"],
      ["globalThis-Umweg", 'await globalThis.fetch("https://example.invalid");'],
    ];
    const durchgerutscht = wege
      .filter(([, zeile]) => ioWege(zeile).length === 0)
      .map(([name]) => name);
    expect(durchgerutscht, "diese Wege kaemen unbemerkt herein").toEqual([]);

    // Gegenrichtung: harmlose Zeilen duerfen NICHT anschlagen, sonst waere P7b nur laut.
    expect(ioWege("export function bewerte(zeilen) { return zeilen.length; }")).toEqual([]);
    expect(ioWege("// ein Kommentar, der das Wort import erwaehnt")).toEqual([]);
  });
});

describe("JOB 2363 D1 · K — Kanten, an denen die Regel sonst still danebengreift", () => {
  it("K1 · haengend und aktiv zugleich → beenden hat Vorrang, nur die haengende PID", () => {
    const befund = bewerte([zeile(4712, "active", 900), VORFALL]);
    expect(befund.handeln).toBe("beenden");
    expect(befund.pids).toEqual([939384]);
  });

  it("K2 · der Zustandsname wird exakt verglichen, nicht als Teilzeichenkette", () => {
    // `idle in transaction (aborted)` ist ein EIGENER Zustand: die Transaktion ist bereits
    // gescheitert. Ein Vergleich per `includes` wuerde ihn mitbeenden, ohne dass es jemand merkt.
    const befund = bewerte([zeile(5000, "idle in transaction (aborted)", 600)]);
    expect(befund.handeln).not.toBe("beenden");
    expect(befund.pids).toEqual([]);
  });

  it("K3 · die Konstante und der Pruefbefehl nennen denselben Zustand", () => {
    expect(ZUSTAND_HAENGT).toBe("idle in transaction");
    expect(pruefbefehl()).toContain(ZUSTAND_HAENGT);
  });

  it("K4 · der Beendigungsbefehl ist eine vollstaendige, abgeschlossene Anweisung", () => {
    expect(beendigungsbefehl(939384)).toBe("select pg_terminate_backend(939384);");
  });

  it("K5 · die Begruendung benennt die Lage im Klartext, nicht nur den Zustandscode", () => {
    expect(bewerte([VORFALL]).begruendung).toContain("939384");
    expect(bewerte([]).begruendung.length).toBeGreaterThan(0);
    expect(bewerte([zeile(4712, "active", 900)]).begruendung.length).toBeGreaterThan(0);
  });
});
