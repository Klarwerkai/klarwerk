import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
// Transitive Chromium-Kante für den vorhandenen Produkt-Collector.
import "../design/h6-chromium";
import { t1bAbbau } from "./t1b-original";

const STARTOPTIONEN = {
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
};

const DATEIEN = [
  "tests/start-karten-schmal/start-karten-schmal-chromium.test.tsx",
  "tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts",
];

// ------------------------------------------------------------------------------------------------
// JOB 3579 · DAS ETIKETT DIESER PROBE WEIST SIE ALS PROBE AUS.
// ------------------------------------------------------------------------------------------------
// Die Probe splittet das ECHTE `afterAll` der beiden Dateien oben in ihre Wegwerfläufe — das ist ihr
// ganzer Zweck und bleibt so. Dieses `afterAll` ruft `schliesseChromium("<echter Pfad>", …)` mit dem
// Pfad als LITERAL, und die Messstelle setzt ihn unverändert in ihre drei Ausgabelagen
// (`chromium-abbau.ts:66` kein Browser, `:90` geworfener Fehler, `:95-97` Protokollzeile). Weil
// `lauf()` die ganze Unterlaufausgabe weiterreicht (`console.log(ausgabe)`, unten), stand
//
//     Chromium-Abbau · tests/start-karten-schmal/…-chromium.test.tsx · 45028.67ms · Grenze …
//
// zwischen den echten Läufen im Torprotokoll — und wurde 36 Jobs lang für einen Befund über DIESE
// Datei gehalten: 44 rote Torbefunde, 63 Protokollzeilen (JOB 3573,
// `tests/tor-chromium-abbau/etikett-ist-kein-laufnachweis.test.ts:5-19`).
//
// DAS PRÄFIX SITZT DESHALB AN DER WURZEL, nicht in der Anzeige: die Wegwerfdatei importiert die
// Messstelle unter anderem Namen und legt einen GLEICHNAMIGEN Ummantler davor. Der eingesplittete
// Hook ruft weiter den blanken Namen und trifft damit den Ummantler. So tragen ALLE drei
// Ausgabelagen das Präfix, nicht nur die rote — und weder `chromium-abbau.ts` noch `t1b-original.ts`
// mussten dafür angefasst werden. `DATEIEN` bleibt unverändert stehen: die Probe MUSS das echte
// `afterAll` der echten Dateien splitten, und F1b des Wächters von JOB 3573 besteht auf den beiden
// Literalen.
//
// In keiner Ausgabe eines ECHTEN Laufs kann dieses Präfix entstehen — kein Aufruf im Bestand
// beschriftet sich so (gemessen in `tests/tor-chromium-abbau/probe-beschriftet-sich-als-probe.test.ts`,
// Fall F5d; dass die Probe es TRÄGT, misst dort Fall F5a an ihrer tatsächlichen Ausgabe).
const PROBE_PRAEFIX = "PROBE (t1b) · ";

// ------------------------------------------------------------------------------------------------
// FARBFEST, und zwar aus gemessenem Anlass.
// ------------------------------------------------------------------------------------------------
// Erzwingt die Umgebung Farbe (in der Cloud-Arbeitsprüfung der Fall), schiebt Vitest ANSI-Folgen
// zwischen „Test Files" und „2 passed", und ein Muster über den rohen Text trifft nicht mehr.
// Die Unterlaufausgabe wird deshalb vor JEDEM Vergleich entfärbt. Der Steuerzeichen-Code steht als
// `fromCharCode`, nicht als Literal.
//
// JOB 3579 — WAS HIER BERICHTIGT IST: dieser Helfer stand bis hierher erst VOR dem langsamen Fall,
// und nur dieser eine Fall benutzte ihn. Die früheren Fälle verglichen weiter den rohen Text. Das
// war kein Restrisiko, sondern ein gemessener Fehler: in der Cloud-Arbeitsprüfung von JOB 3573
// (Lauf 28194ce8…, Exit 1) scheiterte er mit „expected '\n\x1b[1m\x1b[7m\x1b[36m RUN \u…' to match
// /Test Files\s+2 passed/", und bei der Wiederholung am 11.09. (Lauf 29105f29…) scheiterten
// dieselben Vergleiche in BEIDEN früheren Fällen. Im Tor fiel es nie auf, weil dort keine Farbe
// erzwungen wird. Der Helfer steht jetzt VOR seinem ersten Gebrauch, es gibt ihn genau EINMAL, und
// jeder Vergleich über die Unterlaufausgabe geht durch ihn — gepinnt von den Fällen F5b/F5c in
// `tests/tor-chromium-abbau/probe-beschriftet-sich-als-probe.test.ts`, die den Syntaxbaum lesen und
// sich von einem Kommentar weder rot noch grün machen lassen.
const OHNE_FARBE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const klartext = (s: string): string => s.replace(OHNE_FARBE, "");

/**
 * Jede Abbauzeile einer Ausgabe, in der Form, in der sie im Torprotokoll steht.
 *
 * Erwartet ENTFÄRBTEN Text; über rohem Text wäre die Aussage wertlos, sobald Farbe im Spiel ist.
 *
 * AUSGENOMMEN sind die Quelltextauszüge des Reporters: Vitest druckt zu einem Fehler die Umgebung
 * der werfenden Zeile mit, und dort steht die VORLAGE `Chromium-Abbau · ${datei} · …` aus
 * `chromium-abbau.ts:90` — kein Etikett, sondern der Bauplan dafür. Solche Zeilen tragen den
 * Zeilenzähler des Reporters („ 90| ") und sind kein Protokolleintrag. Gemessen am 11.09. im
 * Arbeitsprüflauf 29105f29…: zwei dieser Zeilen im Negativfall, je eine je Probedatei.
 */
function abbauzeilen(ausgabe: string): string[] {
  return ausgabe
    .split("\n")
    .filter((z) => !/^\s*\d+\s*\|/.test(z))
    .flatMap((z) => z.match(/Chromium-Abbau · [^\n]*/g) ?? []);
}

/** Jede Abbauzeile eines Probenlaufs, die sich NICHT als Probe ausweist — muss immer leer sein. */
function ohneProbenetikett(ausgabe: string): string[] {
  return abbauzeilen(ausgabe).filter((z) => !z.startsWith(`Chromium-Abbau · ${PROBE_PRAEFIX}`));
}

/**
 * Welche Lage die Probe fahren soll.
 *
 * Ein Satz benannter Schalter statt einer Reihe blanker Wahrheitswerte: `lauf(false, false, true)`
 * war an der Aufrufstelle nicht mehr lesbar, und seit JOB 3579 R2 kommt mit `ohneBrowser` eine
 * vierte Lage dazu. Jeder Schalter hat genau einen Grund, und der steht daneben.
 */
interface Modus {
  /** Der Negativfall: close() löst nie auf, die Abschlussbestätigung bleibt aus. */
  readonly fehlend?: boolean;
  /** JOB 3448 R3: ein close(), das ECHTE Sekunden braucht und trotzdem gültig ist. */
  readonly langsam?: boolean;
  /**
   * Die dritte Ausgabelage der Messstelle (`chromium-abbau.ts:65-67`): es wurde gar kein Browser
   * aufgebaut, also ist nichts zu messen. Die Wegwerfdatei baut dann keine Bühne auf und reicht
   * `undefined` an den Abbau — genau das, was der eingesplittete Original-Hook mit `stand?.browser`
   * bzw. `browser` täte, wenn `beforeAll` gescheitert wäre. Ohne diesen Lauf blieb die Zusage aus
   * Pflichtlieferung 3 („ALLE drei Ausgabelagen tragen das Präfix") für diese eine Lage unbelegt
   * (BEN, Prüfbericht Runde 1, Prüfpunkt 6).
   */
  readonly ohneBrowser?: boolean;
  /** Der Unterprozess bekommt Farbe aufgezwungen — die Lage der Cloud-Arbeitsprüfung. */
  readonly farbe?: boolean;
}

/**
 * Echte Vitest-Hooks und echtes close(); der Negativfall verliert die Abschlussbestätigung.
 *
 * JOB 3448 (Lieferpunkt 6): `langsam` ist der dritte Zustand — ein close(), das ECHTE Sekunden
 * braucht und trotzdem gültig ist. Kein Fall belegte diese Lage seit JOB 3173 den 10 500-ms-
 * Stellvertreter entfernt hat. Die Verzögerung ist eine echte `setTimeout`-Wartezeit IM
 * UNTERPROZESS, keine virtuelle Uhr: nur so ist die protokollierte Dauer eine gemessene Dauer.
 */
async function mitProbedateien<T>(
  modus: Modus,
  pruefe: (ordner: string, dateien: string[]) => Promise<T>,
): Promise<T> {
  const fehlend = modus.fehlend === true;
  const langsam = modus.langsam === true;
  const ohneBrowser = modus.ohneBrowser === true;
  const ordner = mkdtempSync(join(tmpdir(), "klarwerk-t1b-abbau-"));
  const dateien: string[] = [];
  try {
    // Eigener Testroot: der Produkt-Collector darf diese absichtlich roten Dateien nie sehen.
    // Abhängigkeiten bleiben dieselben; Konfiguration und Cache gehören nur dieser Probe.
    symlinkSync(resolve("node_modules"), join(ordner, "node_modules"), "dir");
    writeFileSync(
      join(ordner, "vitest.config.mjs"),
      `export default ${JSON.stringify({
        root: ordner,
        cacheDir: join(ordner, ".vite"),
        test: { include: ["*.test.ts"], testTimeout: 60_000 },
      })};`,
    );
    // Was der Attrappenbrowser beim close() tut. `ohneBrowser` lässt ihn ganz weg: der
    // eingesplittete Original-Hook reicht dann `undefined` an den Abbau, und die Messstelle geht in
    // ihre dritte Ausgabelage. Der Ummantler setzt das Präfix, BEVOR die Messstelle den Browser
    // überhaupt ansieht — deshalb trägt auch diese Lage es, und deshalb ist sie messbar.
    const schliessen = fehlend
      ? 'console.log("letzter Zustand: Browser geschlossen, Abschlussbestätigung fehlt"); await new Promise(() => {});'
      : langsam
        ? // ECHTE Wartezeit im Unterprozess — keine virtuelle Uhr im Positivfall. Erst danach der
          // echte Abbau. Wer diese Zeile entfernt, nimmt R3 seine Aussage.
          "await new Promise((r) => setTimeout(r, 2100)); await echt.close();"
        : "await echt.close();";
    for (const [i, datei] of DATEIEN.entries()) {
      const pfad = join(ordner, `abbau-${i}.test.ts`);
      dateien.push(pfad);
      writeFileSync(
        pfad,
        `
import { beforeAll, afterAll as registriere, it, expect, vi } from "vitest";
import { schliesseChromium as echterAbbau, ABBAU_GRENZE_MS } from ${JSON.stringify(resolve("tests/tor-bereitschaft/chromium-abbau.ts"))};
// Der Ummantler: der eingesplittete Original-Hook ruft weiter den blanken Namen und landet hier.
// Damit trägt JEDE Zeile, die die Messstelle schreibt, das Probenetikett — auch die Lage
// „nicht gemessen: kein Browser aufgebaut" und die Protokollzeile des Gutfalls.
const schliesseChromium = (datei, browser) => echterAbbau(${JSON.stringify(PROBE_PRAEFIX)} + datei, browser);
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
let echt;
let fertig = false;
const browser = ${
          ohneBrowser
            ? "undefined"
            : `{ close: async () => {
  ${schliessen}
  fertig = true;
} }`
        };
const stand = { browser };
const afterAll = (callback, timeout) => registriere(async () => {
  expect(timeout, "unveränderter Hook-Rahmen").toBe(60000);
  ${fehlend ? 'vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });' : ""}
  const start = performance.now();
  try {
    const ergebnis = callback().then(() => null, e => e);
    ${fehlend ? "await vi.advanceTimersByTimeAsync(ABBAU_GRENZE_MS + 1);" : ""}
    const fehler = await ergebnis;
    if (fehler) throw fehler;
    ${
      ohneBrowser
        ? 'expect(fertig, "ohne Browser gibt es nichts zu bestätigen").toBe(false);'
        : "expect(fertig).toBe(true);"
    }
  } finally {
    console.log("Abbau: " + (performance.now()-start) + "ms; bestätigt=" + fertig);
    vi.useRealTimers();
  }
}, timeout);
beforeAll(async () => {
  ${
    ohneBrowser
      ? "// Keine Bühne — genau das ist die Lage, die dieser Lauf misst."
      : `echt = await chromium.launch(${JSON.stringify(STARTOPTIONEN)});
  await echt.newPage();`
  }
}, 60000);
it(${JSON.stringify(PROBE_PRAEFIX + datei)}, async () => {
  ${
    ohneBrowser
      ? 'expect(echt, "ohne Browser wird auch keiner aufgebaut").toBe(undefined);'
      : "expect(echt.isConnected()).toBe(true);"
  }
  // Vor der virtuellen Negativuhr ist der reale Abbau fertig. Nur die fehlende Bestätigung
  // wird gestört; die echte close()-Dauer im Positivlauf bleibt unverfälscht.
  ${fehlend ? "await echt.close();" : ""}
});
${t1bAbbau(datei)}
`,
      );
    }
    return await pruefe(ordner, dateien);
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
}

async function lauf(modus: Modus): Promise<{ code: number; ausgabe: string }> {
  return await mitProbedateien(modus, async (ordner, dateien) => {
    // JOB 3579 (Lieferung 5): Die Farblage des Unterprozesses wird GESETZT, nicht geerbt — beide
    // Lagen sind damit in JEDER Umgebung dieselbe Messung. Geerbt wäre sie im Tor stets farblos
    // und in der Cloud stets farbig gewesen; dann prüft dieselbe Zeile an zwei Orten Verschiedenes,
    // und genau daran ist der Fehler zwei Fassungen lang unbemerkt geblieben.
    //   `farbe` = true  → wie die Cloud-Arbeitsprüfung: Vitest schiebt ANSI-Folgen mitten in die
    //                     Zeile „Test Files  2 passed". `NO_COLOR` muss weichen, sonst gewinnt es.
    //   `farbe` = false → wie der Tor-Lauf: blanker Text.
    const umgebung = { ...process.env };
    if (modus.farbe === true) {
      umgebung.FORCE_COLOR = "1";
      delete umgebung.NO_COLOR;
    } else {
      umgebung.NO_COLOR = "1";
      umgebung.FORCE_COLOR = "0";
    }
    let code = 0;
    let ausgabe = "";
    try {
      const r = await promisify(execFile)(
        process.execPath,
        [
          "node_modules/vitest/vitest.mjs",
          "run",
          "--config",
          join(ordner, "vitest.config.mjs"),
          "--pool=forks",
          "--poolOptions.forks.maxForks=1",
          "--poolOptions.forks.minForks=1",
          ...dateien,
        ],
        // Der langsame Lauf wartet je Probedatei echte ~2 s zusätzlich; die anderen behalten
        // ihren bisherigen Rahmen unverändert. Der Puffer wächst, weil ein farbiger Unterlauf
        // dieselbe Ausgabe mit ANSI-Folgen schreibt — eine Menge Bytes, keine Aufweichung.
        { env: umgebung, timeout: modus.langsam === true ? 150_000 : 60_000, maxBuffer: 2_000_000 },
      );
      ausgabe = r.stdout + r.stderr;
    } catch (e) {
      const r = e as { code: number; stdout: string; stderr: string };
      code = r.code;
      ausgabe = r.stdout + r.stderr;
    }
    console.log(ausgabe);
    return { code, ausgabe };
  });
}

it("beide Original-afterAll messen den echten Chromium-Abschluss", async () => {
  // JOB 3579 (Lieferung 5): DIESER Lauf erzwingt Farbe im Unterprozess und ist trotzdem grün.
  // Ohne ihn wäre die Entfärbung unbelegt — weder das Tor noch der lokale Lauf setzen `FORCE_COLOR`,
  // und ein grüner Lauf ohne Farbe sagt über sie nichts. Der Negativfall und der langsame Fall
  // fahren ausdrücklich OHNE Farbe: das ist die Lage des Tors, und auch sie muss grün bleiben.
  const r = await lauf({ farbe: true });
  const ausgabe = klartext(r.ausgabe);
  // Eine leere Ausgabe (Unterprozess gar nicht gestartet) darf nicht als „Muster nicht getroffen"
  // durchgehen, sondern muss sich als das melden, was sie ist.
  expect(ausgabe, "der Unterprozess hat nichts geschrieben").not.toBe("");
  expect(ausgabe).toMatch(/Test Files\s+2 passed/);
  expect(r.code).toBe(0);
  expect(ausgabe.match(/Chromium-Abbau · .* · [0-9.]+ms · Grenze/g)).toHaveLength(DATEIEN.length);
  expect(ohneProbenetikett(ausgabe), "Abbauzeile des Positivlaufs ohne Probenetikett").toEqual([]);
}, 90_000);

it("beide Original-afterAll: dauerhaft fehlender Abschluss bleibt als Dateifehler rot", async () => {
  const r = await lauf({ fehlend: true });
  const ausgabe = klartext(r.ausgabe);
  expect(ausgabe, "der Unterprozess hat nichts geschrieben").not.toBe("");
  expect(r.code).toBe(1);
  expect(ausgabe).toMatch(/Test Files\s+2 failed/);
  expect(ausgabe).toContain("Abbaugrenze überschritten");
  expect(ausgabe).toContain("close() unbestätigt");
  // JOB 3579, schärfer als vorher: der Pfad steht nicht mehr blank da, sondern hinter dem Präfix.
  for (const datei of DATEIEN) expect(ausgabe).toContain(`${PROBE_PRAEFIX}${datei}`);
  expect(ausgabe).toContain("Browser geschlossen, Abschlussbestätigung fehlt");
  // Das ist der Lauf, aus dem die 63 irreführenden Protokollzeilen stammen. Er schreibt sie nicht mehr.
  expect(
    ausgabe.match(/Chromium-Abbau · .* · [0-9.]+ms · Grenze/g)?.length ?? 0,
    "der Negativlauf hat keine Abbauzeile geschrieben — die Prüfung darunter misst dann nichts",
  ).toBeGreaterThanOrEqual(DATEIEN.length);
  expect(ohneProbenetikett(ausgabe), "Abbauzeile des Negativlaufs ohne Probenetikett").toEqual([]);
});

// JOB 3579 R2 · DIE DRITTE AUSGABELAGE DER MESSSTELLE — bis hierher unbelegt.
// `chromium-abbau.ts` beschriftet an DREI Stellen: `:66` (kein Browser), `:90` (geworfener Fehler),
// `:95-97` (Protokollzeile). Die beiden letzten messen der Positiv- und der Negativlauf oben. `:66`
// erreichte keiner von beiden — die Zusage aus Pflichtlieferung 3 galt für diese Lage also nur aus
// dem Quelltext heraus („der Ummantler setzt das Präfix vor der Browserprüfung"), nicht gemessen.
// BEN hat das in Runde 1 als Prüflücke benannt; dieser Lauf schließt sie. Er braucht keinen Browser
// und kostet deshalb fast nichts.
it("JOB 3579 · auch die Lage „kein Browser aufgebaut“ trägt das Probenetikett", async () => {
  const r = await lauf({ ohneBrowser: true });
  const ausgabe = klartext(r.ausgabe);
  expect(r.code, `der Lauf ohne Browser ist rot:\n${ausgabe.slice(-3000)}`).toBe(0);
  expect(ausgabe).toMatch(/Test Files\s+2 passed/);
  // Ohne diese Prüfung misst der Fall nichts: er belegt erst, DASS die Lage erreicht wurde.
  const lage = abbauzeilen(ausgabe).filter((z) =>
    z.includes("nicht gemessen: kein Browser aufgebaut"),
  );
  expect(lage, "die Lage „kein Browser aufgebaut“ wurde gar nicht erreicht").toHaveLength(
    DATEIEN.length,
  );
  for (const datei of DATEIEN) {
    expect(lage).toContain(
      `Chromium-Abbau · ${PROBE_PRAEFIX}${datei} · nicht gemessen: kein Browser aufgebaut`,
    );
  }
  expect(
    ohneProbenetikett(ausgabe),
    "Abbauzeile des browserlosen Laufs ohne Probenetikett",
  ).toEqual([]);
});

// JOB 3448 · R3 (Lieferpunkt 6) — DIE LAGE, DIE SEIT JOB 3173 UNBELEGT WAR:
// ein close(), das ECHTE Sekunden braucht und trotzdem gültig ist. Der Positivlauf oben misst das
// schnelle close(), der Negativlauf ein NIE auflösendes an einer virtuellen Uhr. Zwischen beiden lag
// die Lücke: nichts belegte, dass ein langsames close() vollständig abgewartet, mit seiner echten
// Dauer protokolliert und GRÜN gewertet wird. Genau diese Zusage trug der bei JOB 3173 entfernte
// 10 500-ms-Stellvertreter — jetzt hängt sie an einer gemessenen Dauer statt an einer gesetzten Zahl.
// Keine virtuelle Uhr im Positivfall: die Wartezeit ist ein echtes `setTimeout` im Unterprozess.
// Die Entfärbung, die dieser Fall seit JOB 3448 benutzt, steht seit JOB 3579 weiter oben — vor
// ihrem ersten Gebrauch und als einziger Helfer für alle Fälle dieser Datei.
it("JOB 3448 R3 · ein langsames, aber gültiges close() wird vollständig abgewartet und grün gewertet", async () => {
  const r = await lauf({ langsam: true });
  const ausgabe = klartext(r.ausgabe);
  expect(ausgabe).toMatch(/Test Files\s+2 passed/);
  expect(r.code).toBe(0);
  const zeilen = [...ausgabe.matchAll(/Abbau: ([0-9.]+)ms; bestätigt=(\w+)/g)];
  expect(zeilen, "je Probedatei genau eine Protokollzeile aus dem Original-afterAll").toHaveLength(
    DATEIEN.length,
  );
  for (const [ganz, dauer, bestaetigt] of zeilen) {
    expect(bestaetigt, `${ganz}: der Abschluss wurde nicht bestätigt`).toBe("true");
    expect(
      Number(dauer),
      `${ganz}: die protokollierte Dauer belegt kein echtes Warten von ~2 s`,
    ).toBeGreaterThanOrEqual(2000);
  }
  // Und die eine Messstelle hat für beide Dateien eine Zeile mit der geltenden Grenze geschrieben.
  expect(ausgabe.match(/Chromium-Abbau · .* · [0-9.]+ms · Grenze/g)).toHaveLength(DATEIEN.length);
  expect(ohneProbenetikett(ausgabe), "Abbauzeile des langsamen Laufs ohne Probenetikett").toEqual(
    [],
  );
}, 180_000);

it("R2 · vorhandene Abbauproben sind für den Produkt-Collector unsichtbar", async () => {
  await mitProbedateien({ fehlend: true }, async (_ordner, dateien) => {
    expect(dateien).toHaveLength(2);
    for (const datei of dateien) expect(existsSync(datei)).toBe(true);
    const r = await promisify(execFile)(process.execPath, [
      "node_modules/vitest/vitest.mjs",
      "list",
      "--filesOnly",
      "abbau-",
    ]);
    // Auch hier entfärbt, und zwar strenger statt schwächer: eine Farbfolge MITTEN in einem Pfad
    // liesse ein `not.toContain` falsch grün werden — die Probedatei wäre sichtbar und niemand sähe es.
    // KEINE „nicht leer"-Vorbedingung wie in den Fällen oben: hier ist die LEERE Liste das erwartete
    // Ergebnis, der Filter „abbau-" darf nichts finden. Eine leere Ausgabe ist also kein Verdacht.
    const liste = klartext(r.stdout);
    for (const datei of dateien) expect(liste).not.toContain(basename(datei));
  });
});

it("R2 · Abbauproben werden auch bei einem Fehler vor dem Unterprozess entfernt", async () => {
  let erzeugt = "";
  const fehler = new Error("absichtlicher Abbruch vor dem Unterprozess");
  await expect(
    mitProbedateien({ fehlend: true }, async (ordner, dateien) => {
      erzeugt = ordner;
      expect(dateien.every(existsSync)).toBe(true);
      throw fehler;
    }),
  ).rejects.toBe(fehler);
  expect(erzeugt).not.toBe("");
  expect(existsSync(erzeugt)).toBe(false);
});
