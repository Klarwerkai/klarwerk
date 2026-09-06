// ================================================================================================
// JOB 3131 · T2 — DIE LASTGRENZE DER BROWSERGRUPPE GEHOERT `tools/test`, NICHT DEM AUFRUFER.
// ================================================================================================
//
// DER FALL, DER DIESE DATEI ERZWUNGEN HAT (06.09.2026, Codex-Pruefung der Runde 3). Die Runde
// meldete „EIN Fork" und war gruen. Codex hat eine Zeile mehr getippt:
//
//     ./tools/test --pool-options.forks.maxForks=4 …   →  gemessen VIER gleichzeitige Worker
//
// Die Filterliste in `tools/test` kannte nur `--poolOptions.…`; die Kommandozeilenbibliothek von
// Vitest (cac) nimmt aber auch `--pool-options.…` und meint dasselbe. Die zugesagte Grenze war
// damit von aussen aushebelbar — und die Ausgabe behauptete weiter das Gegenteil. Urteil: PRODUKT
// ROT, mit der Auflage, beides zu reparieren UND durch einen echten Wrapper-Test abzusichern.
//
// DIESE DATEI IST DIESER TEST, in drei Teilen, die verschiedene Dinge belegen:
//
//   A  WAS ANKOMMT.  `tools/test` wird als echter Unterprozess gefahren, mit einem `npx`, das nur
//      seine Argumente aufschreibt. Damit ist Wort fuer Wort nachlesbar, was Vitest bekommen haette
//      — fuer jede Schreibweise, die im Betrieb vorkommt oder vorkommen koennte. Schnell, ohne
//      Vitest-Start, deshalb koennen es viele Faelle sein.
//   M  WAS WIRKLICH LIEF.  Der Browser-Aufruf des Tors schreibt seit dieser Runde ein
//      Laufzeitprotokoll (Vitests eingebauter JSON-Bericht, je Datei `startTime`/`endTime`).
//      Dieser Teil liest es und rechnet nach, ob sich zwei Zeitfenster ueberlappen. Er misst also
//      den LAUFENDEN Tor-Lauf, nicht eine nachgestellte Probe.
//   K  OB DAS MESSVERFAHREN UEBERHAUPT ETWAS SIEHT.  Vier Wartefaelle in einem eigenen, winzigen
//      Vitest-Werk: mit vier Forks muessen sich Fenster ueberlappen, mit einem Fork nicht. Ohne
//      diesen Teil waere M auch dann gruen, wenn das Protokoll leer oder die Rechnung kaputt ist.
//
// WAS M NICHT KANN, ausdruecklich: die Zeitfenster des JSON-Berichts umfassen die AUSFUEHRUNG der
// Faelle, nicht das Einsammeln und Uebersetzen davor. Die Messung unterschaetzt die Belegung eines
// Arbeiters also eher, als dass sie sie uebertreibt — sie kann eine Ueberlappung uebersehen, aber
// keine erfinden. Ein falsches ROT ist damit ausgeschlossen, ein falsches GRUEN nur so weit, wie
// Teil K die Empfindlichkeit belegt. Die Prozesszahl selbst (`ps`) steht in der RUECKGABE.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { WURZEL, alsPosix, browserMuster } from "./browser-gruppe";

// ------------------------------------------------------------------------------------------------
// Gemeinsames Handwerkszeug: Zeitfenster und ihre Ueberlappung.
// ------------------------------------------------------------------------------------------------

interface Fenster {
  readonly datei: string;
  readonly von: number;
  readonly bis: number;
}

/**
 * Die groesste Zahl gleichzeitig offener Fenster — ein Durchgang ueber die Zeitachse.
 *
 * Ein Fenster der Laenge 0 (`von === bis`) zaehlt nie mit: der JSON-Bericht setzt so eines, wenn in
 * einer Datei kein einziger Fall lief (dann faellt `startTime` auf die Startzeit des Berichts
 * zurueck). Solche Fenster duerfen keine Ueberlappung vortaeuschen, deshalb schliesst dieser Gang
 * bei gleicher Zeit ZUERST und oeffnet danach.
 */
function maxGleichzeitig(fenster: readonly Fenster[]): number {
  const ereignisse: Array<{ zeit: number; wert: number }> = [];
  for (const f of fenster) {
    ereignisse.push({ zeit: f.von, wert: 1 }, { zeit: f.bis, wert: -1 });
  }
  ereignisse.sort((a, b) => a.zeit - b.zeit || a.wert - b.wert);
  let offen = 0;
  let groesste = 0;
  for (const e of ereignisse) {
    offen += e.wert;
    if (offen > groesste) {
      groesste = offen;
    }
  }
  return groesste;
}

/** Die Paare, die sich wirklich ueberschneiden — als Beleg in der Fehlermeldung, nicht als Zahl. */
function ueberlappendePaare(fenster: readonly Fenster[]): string[] {
  const paare: string[] = [];
  for (let i = 0; i < fenster.length; i++) {
    for (let k = i + 1; k < fenster.length; k++) {
      const a = fenster[i] as Fenster;
      const b = fenster[k] as Fenster;
      if (a.von < b.bis && b.von < a.bis) {
        paare.push(`${a.datei} [${a.von}–${a.bis}] ∥ ${b.datei} [${b.von}–${b.bis}]`);
      }
    }
  }
  return paare;
}

/** Die Zeitfenster je Datei aus Vitests JSON-Bericht. */
function fensterAusBericht(pfad: string): Fenster[] {
  const bericht = JSON.parse(readFileSync(pfad, "utf8")) as {
    readonly testResults?: ReadonlyArray<{ name: string; startTime: number; endTime: number }>;
  };
  return (bericht.testResults ?? []).map((e) => ({
    datei: alsPosix(e.name),
    von: e.startTime,
    bis: e.endTime,
  }));
}

const werkbank = mkdtempSync(join(tmpdir(), "klarwerk-lastgrenze-"));
afterAll(() => {
  rmSync(werkbank, { recursive: true, force: true });
});

// ================================================================================================
// TEIL A — WAS BEI VITEST ANKAEME.
// ================================================================================================
//
// `tools/test` wird MIT SEINEM EIGENEN INHALT, aber in einem leeren Werk gefahren: die Datei wird
// dorthin kopiert (sie ermittelt ihr Werk selbst ueber `dirname $0/..`). So hat der Lauf keinerlei
// Wirkung auf den Arbeitsbaum — er loescht hier keine Zeitstempeldateien und ueberschreibt
// insbesondere nicht das Laufzeitprotokoll, das Teil M gerade auswertet.
const WERK = join(werkbank, "werk");
mkdirSync(join(WERK, "tools"), { recursive: true });
copyFileSync(join(WURZEL, "tools", "test"), join(WERK, "tools", "test"));
chmodSync(join(WERK, "tools", "test"), 0o755);

// Ein `npx`, das nichts startet und alles aufschreibt. Es steht in einem eigenen Verzeichnis, das
// dem PATH VORANGESTELLT wird — `sed`, `tr` und `rm`, die das Skript ebenfalls braucht, kommen
// weiterhin aus dem echten PATH.
const PFADHAKEN = join(werkbank, "pfad");
mkdirSync(PFADHAKEN, { recursive: true });
writeFileSync(
  join(PFADHAKEN, "npx"),
  [
    "#!/bin/sh",
    "{",
    '  echo "AUFRUF ${KLARWERK_TESTGRUPPE:-ohne}"',
    '  for a in "$@"; do echo "ARG $a"; done',
    '} >> "$KLARWERK_ARGV_PROTOKOLL"',
    "exit 0",
    "",
  ].join("\n"),
  { mode: 0o755 },
);

interface Aufruf {
  readonly gruppe: string;
  readonly args: readonly string[];
}

let laufnummer = 0;

/** `tools/test` einmal fahren und aufschreiben, was jeder der beiden Aufrufe bekommen haette. */
function fahre(args: readonly string[]): Aufruf[] {
  const protokoll = join(werkbank, `argv-${++laufnummer}.txt`);
  const umgebung: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${PFADHAKEN}:${process.env.PATH ?? ""}`,
    KLARWERK_ARGV_PROTOKOLL: protokoll,
  };
  // Geerbtes aus dem Tor-Lauf wird ausdruecklich entfernt: diese Datei laeuft im Tor als Kind des
  // Aufrufs `rest` und truege sonst dessen Gruppe und Forkzahl in die Messung.
  delete umgebung.KLARWERK_TESTGRUPPE;
  delete umgebung.KLARWERK_TEST_FORKS;
  const lauf = spawnSync(join(WERK, "tools", "test"), [...args], {
    cwd: WERK,
    env: umgebung,
    encoding: "utf8",
  });
  expect(lauf.status, `tools/test brach ab:\n${lauf.stdout ?? ""}\n${lauf.stderr ?? ""}`).toBe(0);
  const aufrufe: Aufruf[] = [];
  for (const zeile of readFileSync(protokoll, "utf8").split("\n")) {
    if (zeile.startsWith("AUFRUF ")) {
      aufrufe.push({ gruppe: zeile.slice(7).trim(), args: [] });
    } else if (zeile.startsWith("ARG ")) {
      (aufrufe[aufrufe.length - 1]?.args as string[]).push(zeile.slice(4));
    }
  }
  return aufrufe;
}

/**
 * Der Name eines Arguments, so wie ihn `tools/test` bildet — und wie ihn cac zusammenfuehrt:
 * fuehrende Striche weg, alles vor dem `=`, klein, ohne Binde- und Unterstriche.
 * `--pool-options.forks.maxForks=4` und `--poolOptions.forks.maxForks=4` ergeben denselben Namen.
 */
function name(arg: string): string {
  return arg.split("=")[0]?.replace(/^-+/, "").toLowerCase().replace(/[-_]/g, "") ?? "";
}

/** Die WIRKSAME Belegung einer Option: bei mehrfacher Angabe gewinnt in cac die letzte. */
function wirksam(args: readonly string[], gesucht: string): string | undefined {
  let wert: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (!arg.startsWith("-") || name(arg) !== gesucht) {
      continue;
    }
    wert = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : (args[i + 1] ?? "");
  }
  return wert;
}

const KEIN_FALL = "KEIN-FALL-MIT-DIESEM-NAMEN-JOB3131";
const ZIELDATEI = "tests/design/zielbild-h5-start.test.ts";

/** Die Schreibweisen, die im Betrieb ankommen oder ankommen koennten. */
const FREMDE_LASTFLAGS: ReadonlyArray<{ readonly was: string; readonly flags: readonly string[] }> =
  [
    { was: "Codex' Gegenprobe (Bindestriche)", flags: ["--pool-options.forks.maxForks=4"] },
    { was: "kanonische Schreibweise", flags: ["--poolOptions.forks.maxForks=4"] },
    {
      was: "tor.sh/Waechterlauf (Thread-Schreibweise)",
      flags: [
        "--pool=forks",
        "--poolOptions.threads.maxThreads=6",
        "--poolOptions.threads.minThreads=1",
      ],
    },
    { was: "Getrenntschreibweise, Wert im naechsten Argument", flags: ["--maxWorkers", "8"] },
    { was: "Getrenntschreibweise mit Bindestrich", flags: ["--max-workers", "8"] },
    { was: "Bindestrich-Unterbegriff", flags: ["--pool-options.forks.max-forks=4"] },
    {
      was: "Dateiparallelitaet, Isolierung, Untergrenze",
      flags: ["--no-file-parallelism", "--isolate=false", "--minWorkers=9"],
    },
  ];

describe("JOB 3131 T2 · A — kein Lastflag von aussen erreicht Vitest, in keiner Schreibweise", () => {
  for (const fall of FREMDE_LASTFLAGS) {
    it(`A · ${fall.was}: die Browsergruppe bleibt bei EINEM Fork`, () => {
      const aufrufe = fahre(["-t", KEIN_FALL, ...fall.flags, ZIELDATEI]);
      expect(aufrufe.map((a) => a.gruppe)).toEqual(["browser", "rest"]);
      const browser = aufrufe[0] as Aufruf;
      const rest = aufrufe[1] as Aufruf;

      // 1. Die wirksame Grenze ist unsere — gerechnet wie cac rechnet, nicht wie es aussieht.
      expect(wirksam(browser.args, "pool"), browser.args.join(" ")).toBe("forks");
      expect(wirksam(browser.args, "pooloptions.forks.maxforks"), browser.args.join(" ")).toBe("1");
      expect(wirksam(browser.args, "pooloptions.forks.minforks"), browser.args.join(" ")).toBe("1");
      expect(wirksam(rest.args, "pooloptions.forks.maxforks"), rest.args.join(" ")).toBe("6");

      // 2. Die fremden Flags sind nicht nur ueberstimmt, sie sind gar nicht erst dabei — und ihr
      //    Wert auch nicht: eine liegengebliebene „8" waere fuer Vitest ein Namensfilter, und der
      //    Aufruf faende dann gar nichts mehr. Geprueft wird der DURCHGEREICHTE Teil, also alles vor
      //    den drei eigenen Schlussflags: `--pool=forks` steht dort am Ende zu Recht, weil es unser
      //    eigenes ist — im vorderen Teil waere dasselbe Wort das des Aufrufers.
      const eigeneFlags = 3;
      for (const aufruf of [browser, rest]) {
        const durchgereicht = aufruf.args.slice(0, aufruf.args.length - eigeneFlags);
        for (const flag of fall.flags) {
          expect(
            durchgereicht,
            `„${flag}" wurde durchgereicht: ${aufruf.args.join(" ")}`,
          ).not.toContain(flag);
        }
      }

      // 3. Alles, was NICHT Last ist, geht unveraendert an beide Aufrufe — in derselben Reihenfolge.
      for (const aufruf of [browser, rest]) {
        expect(aufruf.args).toContain(ZIELDATEI);
        expect(aufruf.args).toContain(KEIN_FALL);
        expect(aufruf.args.indexOf("-t")).toBeLessThan(aufruf.args.indexOf(KEIN_FALL));
        expect(aufruf.args, "ohne --passWithNoTests waere eine leere Gruppe ein Fehler").toContain(
          "--passWithNoTests",
        );
      }

      // 4. Zweite Sicherung: unsere Grenze steht ZULETZT, hinter allem Durchgereichten. Selbst wenn
      //    eine Schreibweise durch das Sieb kaeme, waere sie damit ueberstimmt.
      const unsere = browser.args.indexOf("--poolOptions.forks.maxForks=1");
      expect(unsere).toBeGreaterThan(browser.args.indexOf(ZIELDATEI));
      expect(unsere).toBe(browser.args.length - 1);
    });
  }

  it("A · Anti-Vakuum: was kein Lastflag ist, wird NICHT verworfen", () => {
    // Ohne diesen Fall waeren alle Faelle oben auch dann gruen, wenn das Sieb einfach jedes Argument
    // wegwuerfe — dann kaeme nie ein fremdes Flag an, und kein Dateifilter mehr.
    const aufrufe = fahre(["--silent", "--reporter=verbose", ZIELDATEI]);
    for (const aufruf of aufrufe) {
      expect(aufruf.args).toContain("--silent");
      expect(aufruf.args).toContain("--reporter=verbose");
      expect(aufruf.args).toContain(ZIELDATEI);
    }
  });

  it("A · eigene Berichterstattung des Aufrufers bleibt seine — sonst schreibt der Tor-Lauf mit", () => {
    // Ohne Reporter-Wunsch haengt `tools/test` das Laufzeitprotokoll an den Browser-Aufruf (die
    // Grundlage von Teil M) und laesst die lesbare Ausgabe daneben stehen.
    const ohne = fahre([]);
    const browserOhne = ohne[0] as Aufruf;
    expect(browserOhne.args).toContain("--reporter=default");
    expect(browserOhne.args).toContain("--reporter=json");
    expect(
      browserOhne.args.some((a) => a.startsWith("--outputFile.json=")),
      browserOhne.args.join(" "),
    ).toBe(true);
    // Der Rest-Aufruf bekommt es NICHT: gemessen wird die Browsergruppe.
    expect((ohne[1] as Aufruf).args).not.toContain("--reporter=json");

    // Mit Reporter-Wunsch tritt das Protokoll zurueck, statt den Wunsch zu ueberschreiben.
    const mit = fahre(["--reporter=verbose"]);
    expect((mit[0] as Aufruf).args).not.toContain("--reporter=json");
    expect((mit[0] as Aufruf).args).toContain("--reporter=verbose");
  });

  it("A · ohne Dateifilter ist eine leere Gruppe ein Fehler, kein Durchwinken", () => {
    const aufrufe = fahre(["--pool-options.forks.maxForks=4"]);
    for (const aufruf of aufrufe) {
      expect(aufruf.args).not.toContain("--passWithNoTests");
    }
  });
});

// ================================================================================================
// TEIL M — WAS IM LAUFENDEN TOR WIRKLICH GLEICHZEITIG LIEF.
// ================================================================================================
//
// `tools/test` setzt `KLARWERK_BROWSERLAUF` fuer den zweiten Aufruf — aber nur, wenn der erste
// vollstaendig war (kein Dateifilter, keine fremde Berichterstattung, Exit 0). Fehlt die Variable,
// gibt es nichts zu messen; der Fall sagt das, statt still gruen zu sein.
const MESSPFAD = process.env.KLARWERK_BROWSERLAUF;
const MESSDATEI =
  MESSPFAD === undefined ? undefined : isAbsolute(MESSPFAD) ? MESSPFAD : join(WURZEL, MESSPFAD);

describe("JOB 3131 T2 · M — die Browsergruppe dieses Laufs lief nacheinander", () => {
  it.skipIf(MESSDATEI === undefined)(
    "M1 · kein Zeitfenster zweier Browser-Dateien ueberlappt sich",
    () => {
      const datei = MESSDATEI as string;
      expect(
        existsSync(datei),
        `tools/test hat ${datei} angekuendigt, geschrieben ist nichts`,
      ).toBe(true);
      const fenster = fensterAusBericht(datei);
      expect(fenster.length, "das Protokoll ist leer — gemessen wurde nichts").toBeGreaterThan(0);
      expect(ueberlappendePaare(fenster).join("\n")).toBe("");
      expect(maxGleichzeitig(fenster)).toBe(1);
    },
  );

  it.skipIf(MESSDATEI === undefined)(
    "M2 · gemessen wurde die ganze Browsergruppe, nicht ein Ausschnitt",
    () => {
      const gelaufen = fensterAusBericht(MESSDATEI as string)
        .map((f) => f.datei)
        .sort();
      expect(gelaufen).toEqual([...browserMuster()].sort());
    },
  );
});

// ================================================================================================
// TEIL K — SIEHT DAS MESSVERFAHREN UEBERHAUPT EINE GLEICHZEITIGKEIT?
// ================================================================================================
//
// Ein eigenes, winziges Vitest-Werk mit vier Wartefaellen. Es liegt unter `.local/run/` — dort ist
// es git-ignoriert (SCRUM-387), es liegt in KEINEM `include`-Muster des Bestandes und der
// Verzeichnisgang von `browser-gruppe.ts` betritt `.local` nicht. Damit kann es weder in den Tor-Lauf
// geraten noch die Bestandsrechnung der Nachbardatei stoeren. Node findet `vitest` von dort aus
// ueber den Aufstieg zum `node_modules` der Werkswurzel.
mkdirSync(join(WURZEL, ".local", "run"), { recursive: true });
const KALIBRIERWERK = mkdtempSync(join(WURZEL, ".local", "run", "lastgrenze-kal-"));
afterAll(() => {
  rmSync(KALIBRIERWERK, { recursive: true, force: true });
});

writeFileSync(
  join(KALIBRIERWERK, "vitest.config.ts"),
  [
    'import { defineConfig } from "vitest/config";',
    "export default defineConfig({",
    // Eigener Cache-Ordner: der Vite-Standard `node_modules/.vite` ist in den Bahn-Klonen ein
    // Symlink auf einen unbeschreibbaren Bestand (JOB 2622 D1).
    '  cacheDir: ".vite",',
    '  test: { include: ["*.test.ts"] },',
    "});",
    "",
  ].join("\n"),
);
for (let n = 1; n <= 4; n++) {
  writeFileSync(
    join(KALIBRIERWERK, `warte-${n}.test.ts`),
    [
      'import { it } from "vitest";',
      `it("Wartefall ${n}", async () => {`,
      "  await new Promise((fertig) => setTimeout(fertig, 500));",
      "});",
      "",
    ].join("\n"),
  );
}

/** Das Kalibrierwerk mit einer bestimmten Obergrenze fahren und die Zeitfenster zurueckgeben. */
function kalibriere(maxForks: number): Fenster[] {
  const bericht = join(KALIBRIERWERK, `bericht-${maxForks}.json`);
  const lauf = spawnSync(
    "npx",
    [
      "vitest",
      "run",
      "--root",
      KALIBRIERWERK,
      "--config",
      join(KALIBRIERWERK, "vitest.config.ts"),
      "--pool=forks",
      "--poolOptions.forks.minForks=1",
      `--poolOptions.forks.maxForks=${maxForks}`,
      "--reporter=json",
      `--outputFile.json=${bericht}`,
    ],
    { cwd: WURZEL, env: { ...process.env, KLARWERK_SKIP_KEYCHAIN: "1" }, encoding: "utf8" },
  );
  expect(lauf.status, `${lauf.stdout ?? ""}\n${lauf.stderr ?? ""}`).toBe(0);
  return fensterAusBericht(bericht);
}

describe("JOB 3131 T2 · K — das Messverfahren ist empfindlich", () => {
  it("K1 · mit vier Forks ueberlappen sich die Zeitfenster wirklich", () => {
    const fenster = kalibriere(4);
    expect(fenster.length).toBe(4);
    expect(
      maxGleichzeitig(fenster),
      `vier Wartefaelle auf vier Forks liefen nacheinander — dann kann M nichts sehen:\n${fenster
        .map((f) => `${f.datei} ${f.von}–${f.bis}`)
        .join("\n")}`,
    ).toBeGreaterThan(1);
  }, 120_000);

  it("K2 · mit einem Fork ueberlappt sich nichts — dieselbe Rechnung, anderes Ergebnis", () => {
    const fenster = kalibriere(1);
    expect(fenster.length).toBe(4);
    expect(ueberlappendePaare(fenster).join("\n")).toBe("");
    expect(maxGleichzeitig(fenster)).toBe(1);
  }, 120_000);
});
