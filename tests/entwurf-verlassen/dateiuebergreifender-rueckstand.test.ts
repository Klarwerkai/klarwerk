// ================================================================================================
// JOB 3875 · WAS ZWISCHEN ZWEI DATEIEN EINES LAUFS STEHEN BLEIBT — GEMESSEN, NICHT ANGENOMMEN.
// ================================================================================================
//
// DIE FRAGE, DIE HIER BEANTWORTET WIRD, stand bis JOB 3875 als offene Selbstauskunft im Kopf von
// `huelle.tsx`: der Zustand dieser Hülle (`container`, `root`, `montiert`) ist modulweit und damit
// pro Testdatei — was zwischen ZWEI Dateien EINES vitest-Laufs an Rückstand bliebe, mass kein Fall.
// V1 bis V4 der Ganzdokument-Datei messen den Abbau INNERHALB einer Datei; die Dateigrenze nicht.
//
// WARUM DAS NICHT EGAL IST: trüge `montiert === true` samt Behälter aus einer Datei in die nächste,
// bekäme deren erster `abbauen()` einen Baum zu sehen, den er nicht angelegt hat — und acht Dateien
// dieses Ordners hingen an dieser einen Hülle.
//
// WAS DIE FÜNF FÄLLE ZUSAMMEN BEWEISEN:
//   A  Mit der Konfiguration dieses Hauses (`vitest.config.ts`, als Ganzes übernommen) und ZWEI
//      Dateien in EINEM Fork startet die zweite Datei sauber: kein Behälter, keine Adresse.
//   B  Derselbe Lauf mit `--no-isolate` trägt den Rückstand sehr wohl hinüber, und zwar samt dem
//      jsdom-Dokument: der Baum der Vordatei hängt der zweiten im eigenen `body`. Der Messstand kann
//      also sehen, was A ausschliesst — ohne B wäre A ein Ergebnis ohne Massstab.
//   D  Räumt die erste Datei auf, misst die zweite auch unter `--no-isolate` keinen HÄNGENDEN Baum
//      mehr. Die Sonde liest damit den echten Zustand und nicht eine Eigenschaft des Aufbaus.
//   C  Ein Lauf, der gar keine Datei fährt, wird laut statt still grün — der teuerste Fehler
//      dieser Bauform.
//   E  Ein Lauf, dessen Probetest NACH der Sondenmeldung scheitert, ist ebenso wenig ein Befund:
//      zwei gültige Meldungen liegen vor, der äussere Fall wird trotzdem rot — und seine Meldung
//      trägt den Ursprungsfehler des Probetests OBEN, nicht nur irgendwo im Rohauszug.
//
// WAS A, B UND D AUSSERDEM FORDERN: dass ihr Unterprozess grün geworden ist (`fertigGeworden()`).
// Die Sonde schreibt im MODULKOPF der Probedatei, also bevor ein Probetest gelaufen ist — zwei
// gültige Meldungen beweisen deshalb keinen fertigen Lauf. Ohne diese Forderung blieben B und D
// über einem roten Unterprozess grün; BEN hat das in Runde 1 gemessen. Seit JOB 3912 steht diese
// Forderung nicht mehr nur als Handmessung im Prüfbericht, sondern als eigener Fall E: er stellt
// die täuschende Lage selbst her und misst, dass `fertigGeworden()` sie zurückweist und dass
// `diagnose()` den Ursprungsfehler in die Meldung hebt.
//
// WAS ER NICHT KANN, ehrlich: er misst diesen Ordner und diese Hülle, unter `pool: forks`, Vitest
// 2.1.9. Über andere Testordner, den Thread-Pool und den Browser-Aufruf (`vitest.browser.config.ts`)
// sagt er nichts. Und er misst das VERHALTEN, nicht den Schalter: ob in `vitest.config.ts` das Wort
// `isolate` steht, liest er nirgends nach — ein Wächter auf Namen wäre hier untauglich, weil ein
// Vorgabewert, den niemand hinschreibt, ihm entginge (`wiederholung-waechter.test.ts:10-23`).
//
// BAUFORM: die Unterprozesse laufen wörtlich nach `tests/tor-inventar/waechterlauf-lastflag.test.ts`
// (`spawnSync("npx", ["vitest", "run", …], { cwd: WURZEL })`, `KLARWERK_SKIP_KEYCHAIN=1` durch-
// gereicht, `KLARWERK_TESTGRUPPE` ausdrücklich entfernt) — kein zweiter, eigener Messstand.
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WURZEL } from "../tor-inventar/browser-gruppe";

/**
 * DIE PROBEDATEIEN LIEGEN UNTER `os.tmpdir()` — nie im Produkt-Testbaum (Lehre JOB 3152 R2). Läge
 * auch nur für die Dauer dieses Falls eine `*.test.ts` unter `tests/`, sähe sie der Verzeichnisgang
 * von `tests/tor-inventar/` und der Bestandsvergleich dieses Hauses flackerte.
 */
let ort = "";

/**
 * DIE KONFIGURATION DER PROBE muss dagegen INNERHALB des Arbeitsbaums liegen, und das ist keine
 * Bequemlichkeit: Vite bündelt jede Konfigurationsdatei vor dem Laden und zieht relative Importe
 * mit hinein; `import.meta.url` zeigt darin auf den Ort der KONFIGURATION (der Grund steht in
 * `tests/tor-inventar/browser-gruppe.ts:55-60`). Stünde sie unter `os.tmpdir()`, fände der
 * Ankergang der Werkswurzel nichts und `vitest.config.ts` liesse sich gar nicht erst laden.
 * `.local/run/` ist seit SCRUM-387 git-ignoriert und wird von keinem Verzeichnisgang betreten.
 */
let konfigOrt = "";
let konfig = "";

/** Wohin die Sonden schreiben. Eine Zeile JSON je Probedatei, in der Reihenfolge ihres Laufs. */
let spur = "";

/** Der Schalter, mit dem der Aufrufer entscheidet, ob die Probedateien ihren Baum stehen lassen. */
const RAEUMT_AUF = "KLARWERK_3875_RAEUMT_AUF";

/**
 * JOB 3912: der zweite Schalter der Probedateien. Ist er gesetzt, scheitert in JEDER Probedatei ein
 * Fall — und zwar NACH dem Modulkopf, der die Sondenmeldung schreibt. Genau die Lage also, gegen die
 * `fertigGeworden()` steht: zwei gültige Meldungen über einem roten Unterprozess.
 */
const FEHLER_NACH_SONDE = "KLARWERK_3912_FEHLER_NACH_SONDE";

/**
 * Die Meldung, die der absichtlich scheiternde Probetest wirft. Sie ist fest, ohne Umlaute und
 * nirgends sonst im Haus zu finden — Fall E erwartet sie unten wörtlich in der Meldung des äusseren
 * Falls, und nur so hängt er an `diagnose()` statt bloss am Exit-Code.
 */
const FEHLERTEXT = "KLARWERK3912: Fehler nach gueltiger Sondenmeldung";

interface Befund {
  readonly datei: string;
  /** Hat `container` in dieser Datei schon einen Wert, bevor sie selbst etwas tut? */
  readonly flaecheGesetzt: boolean;
  /** Hängt dieser Behälter noch in IRGENDEINEM Dokument? (`isConnected`) */
  readonly flaecheVerbunden: boolean;
  /** Und hängt er im Dokument DIESER Datei? */
  readonly imEigenenDokument: boolean;
  /** `letzteAdresse` der Hülle — leer, solange in dieser Datei nichts gerendert wurde. */
  readonly adresse: string;
  /** Was `abbauen()` als erste Handlung der Datei geworfen hat, oder `null`. */
  readonly abbauenWurf: string | null;
}

interface Lauf {
  readonly code: number | null;
  readonly ausgabe: string;
  readonly befunde: readonly Befund[];
}

/** Der Anfangszustand, den eine Datei meldet, vor der nichts gelaufen ist. */
const SAUBER = {
  flaecheGesetzt: false,
  flaecheVerbunden: false,
  imEigenenDokument: false,
  adresse: "",
  abbauenWurf: null,
} as const;

/** Ein Modulpfad von den Probedateien aus — sie liegen ausserhalb des Arbeitsbaums. */
function nach(ziel: string): string {
  return relative(ort, ziel).split("\\").join("/");
}

/**
 * Eine Probedatei. Sie liest ihren Anfangszustand über die öffentlichen Messfenster der Hülle
 * (`flaeche()`, `adresse()`, `abbauen()`) — `huelle.tsx` bekommt dafür KEINE neue Ausfuhr, und die
 * acht Bestandsdateien des Ordners werden nicht angefasst.
 *
 * Beide Dateien sind bis auf ihren Namen zeichengleich: welche von beiden zuerst läuft, entscheidet
 * Vitest, und kein Fall unten hängt daran.
 */
function probendatei(name: string): string {
  const auth = nach(join(WURZEL, "apps", "web", "src", "api", "auth"));
  const endpoints = nach(join(WURZEL, "apps", "web", "src", "api", "endpoints"));
  const attrappen = nach(join(WURZEL, "tests", "entwurf-verlassen", "attrappen"));
  const huelle = nach(join(WURZEL, "tests", "entwurf-verlassen", "huelle"));
  return `// @vitest-environment jsdom
import { appendFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("${auth}", async () => (await import("${attrappen}")).authAttrappe());

vi.mock("${endpoints}", async () => (await import("${attrappen}")).endpointsAttrappe());

import { abbauen, adresse, flaeche, grundzustand, mount } from "${huelle}";

// DIE SONDE — gelesen, BEVOR diese Datei irgendetwas tut. Erst lesen, dann abbauen: \`abbauen()\`
// verändert genau die Grössen, um die es hier geht.
const behaelter = flaeche();
const gesetzt = behaelter !== undefined && behaelter !== null;
const verbunden = gesetzt && behaelter.isConnected === true;
const imEigenen = gesetzt && document.body.contains(behaelter);
const wo = adresse();
let wurf = null;
try {
  abbauen();
} catch (fehler) {
  wurf = String(fehler && fehler.message ? fehler.message : fehler);
}
appendFileSync(
  "${spur}",
  \`\${JSON.stringify({
    datei: "${name}",
    flaecheGesetzt: gesetzt,
    flaecheVerbunden: verbunden,
    imEigenenDokument: imEigenen,
    adresse: wo,
    abbauenWurf: wurf,
  })}\\n\`,
);

describe("Probe ${name}", () => {
  it("mountet die Hülle", async () => {
    await grundzustand();
    await mount("/erfassen", "formular");
    expect(flaeche()).toBeDefined();
    // Ob der Baum danach stehen bleibt, entscheidet der Aufrufer über die Umgebung — derselbe Satz
    // Dateien misst so beide Richtungen (Fall B gegen Fall D).
    if (process.env.${RAEUMT_AUF} === "1") {
      abbauen();
    }
  });

  // Der Fall, der NACH der Sondenmeldung oben scheitert — er wird nur angemeldet, wenn der Aufrufer
  // ihn anfordert (Fall E). Die Sondenmeldung im Modulkopf bleibt davon unberührt: sie ist längst
  // geschrieben, wenn dieser Fall läuft, und genau das ist die Täuschung, um die es geht.
  if (process.env.${FEHLER_NACH_SONDE} === "1") {
    it("scheitert NACH der Sondenmeldung", () => {
      throw new Error("${FEHLERTEXT}");
    });
  }
});
`;
}

/**
 * Die Konfiguration der Probe. Sie ÜBERNIMMT `vitest.config.ts` als Ganzes und ändert genau eine
 * Sache: welche Dateien gefahren werden. Damit trägt jeder Schalter, den jemand dort einträgt —
 * `isolate`, `pool`, `poolOptions` —, auch hier; das ist die Wirkungskette, um die es geht.
 */
function konfigdatei(): string {
  const basis = relative(konfigOrt, join(WURZEL, "vitest.config")).split("\\").join("/");
  return `import { defineConfig } from "vitest/config";
import basis from "${basis}";

export default defineConfig({
  ...basis,
  root: ${JSON.stringify(WURZEL)},
  cacheDir: ${JSON.stringify(join(konfigOrt, "vite-cache"))},
  // Ohne diese Zeile lädt Vite keine Datei ausserhalb der Werkswurzel: die Vorgabe von
  // \`server.fs.allow\` ist die Wurzel selbst, und eine Probedatei unter \`os.tmpdir()\` scheitert mit
  // „Failed to load url … Does the file exist?" (gemessen: Lauf 81cb9f9a, Exit 1). Erlaubt werden
  // GENAU die beiden Orte dieses Laufs, nicht \`strict: false\`.
  server: { fs: { allow: [${JSON.stringify(WURZEL)}, ${JSON.stringify(ort)}] } },
  test: {
    ...basis.test,
    include: [${JSON.stringify(`${ort}/*.test.ts`)}],
  },
});
`;
}

/**
 * EIN ECHTER VITEST-UNTERPROZESS über die Probedateien. `--pool=forks --poolOptions.forks.singleFork`
 * steht in JEDEM Fall: liefen die zwei Dateien in zwei Forks, wäre die Frage nach dem Rückstand
 * trivial mit „nein" beantwortet, ohne dass die Isolation etwas dazu beigetragen hätte. Der einzige
 * Unterschied zwischen den Fällen sind die `zusatz`-Flags, `raeumtAuf` und `fehlerNachSonde`.
 */
function fahre(
  zusatz: readonly string[],
  filter: readonly string[] = [],
  raeumtAuf = false,
  fehlerNachSonde = false,
): Lauf {
  writeFileSync(spur, "");
  const umgebung: NodeJS.ProcessEnv = { ...process.env, KLARWERK_SKIP_KEYCHAIN: "1" };
  delete umgebung.KLARWERK_TESTGRUPPE;
  if (raeumtAuf) {
    umgebung[RAEUMT_AUF] = "1";
  } else {
    delete umgebung[RAEUMT_AUF];
  }
  if (fehlerNachSonde) {
    umgebung[FEHLER_NACH_SONDE] = "1";
  } else {
    delete umgebung[FEHLER_NACH_SONDE];
  }
  const ergebnis = spawnSync(
    "npx",
    [
      "vitest",
      "run",
      "--config",
      konfig,
      "--pool=forks",
      "--poolOptions.forks.singleFork",
      ...zusatz,
      ...filter,
    ],
    { cwd: WURZEL, env: umgebung, encoding: "utf8" },
  );
  const befunde = readFileSync(spur, "utf8")
    .split("\n")
    .filter((zeile) => zeile.trim() !== "")
    .map((zeile) => JSON.parse(zeile) as Befund);
  return {
    code: ergebnis.status,
    ausgabe: `${ergebnis.stdout ?? ""}\n${ergebnis.stderr ?? ""}`,
    befunde,
  };
}

function belege(lauf: Lauf): string {
  return `Exit ${lauf.code}\nSonde: ${JSON.stringify(lauf.befunde)}\n${lauf.ausgabe.slice(-1500)}`;
}

/**
 * Die Farbfolgen, mit denen Vitest seine Ausgabe einfärbt. Sie stehen MITTEN in den Wörtern, auf die
 * `diagnose()` unten prüft, und werden deshalb vor jedem Mustervergleich entfernt. Das Steuerzeichen
 * steht als `String.fromCharCode(27)` da und nicht roh in der Quelle: roh wäre es unsichtbar, und
 * Biome weist es zurück (`lint/suspicious/noControlCharactersInRegex`).
 */
const FARBFOLGE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/**
 * Die Zeilen, an denen ein gescheiterter Unterprozess erkennbar ist, VOR den Rohauszug gestellt.
 * Der Grund liegt an der Bauform: die Ausgabe eines echten Vitest-Laufs ist lang, und `belege()`
 * zeigt ihre letzten 1500 Zeichen — also die Zusammenfassung. Der NAME des gescheiterten Probetests
 * und seine Fehlermeldung stehen weiter oben und wären genau dann abgeschnitten, wenn man sie
 * braucht.
 *
 * JOB 3912, GEMESSEN: bis hierher löste diese Zusage nur die HÄLFTE ein. Das Muster wurde gegen die
 * ROHE Zeile gehalten, und Vitest schreibt seine Fehlerzeile als `<rot><fett>Error<aus>: <Meldung>`
 * — zwischen „Error" und dem Doppelpunkt steht eine Farbfolge, `Error:` traf deshalb nie. Gefunden
 * wurden allein die `FAIL`- und `×`-Zeilen, also der NAME des Falls; seine MELDUNG stand nur in den
 * letzten 1500 Zeichen von `belege()` und wäre bei längerer Ausgabe verloren gewesen. Gemessen am
 * Ordnerlauf f592188f (Fall E: Ursprungsmeldung an Stelle 1785, Rohauszug schon ab Stelle 698).
 * Jede Zeile wird jetzt OHNE Farbe geprüft — ausgegeben wird sie unverändert.
 */
function diagnose(lauf: Lauf): string {
  const auffaellig = lauf.ausgabe
    .split("\n")
    .filter((zeile) => /FAIL|AssertionError|Error:|✗|×/.test(zeile.replace(FARBFOLGE, "")))
    .slice(0, 12);
  return auffaellig.length === 0 ? belege(lauf) : `${auffaellig.join("\n")}\n${belege(lauf)}`;
}

/**
 * JEDER REGULÄRE MESSLAUF MUSS AUCH FERTIG GEWORDEN SEIN — sonst ist sein Befund keiner.
 *
 * Ohne diese Forderung ist der Messstand blind gegen den Fall, der ihn am teuersten täuscht: die
 * Probedateien schreiben ihre Sondenmeldung im MODULKOPF, also BEVOR ein einziger Probetest
 * gelaufen ist. Scheitert danach ein Probetest, liegen trotzdem zwei gültige Meldungen vor, und ein
 * Fall, der nur sie liest, wird grün über einem roten Unterprozess. BEN hat das in Runde 1
 * nachgewiesen: „Unterprozesse A/B/D jeweils: Tests 2 failed (2), Exit 1. Außen dagegen: Tests 1
 * failed | 3 passed (4) — nur A rot, B und D weiterhin grün."
 *
 * Die Forderung steht HIER und nicht in den einzelnen Fällen, damit kein künftiger Fall sie
 * vergessen kann. Fall C ist ausgenommen und fordert sein Gegenteil (`code !== 0`) selbst; Fall E
 * fordert diese Zurückweisung ausdrücklich und misst sie als einziger.
 */
function fertigGeworden(lauf: Lauf): void {
  expect(
    lauf.code,
    `der Unterprozess ist nicht grün geworden — seine Sondenmeldungen sind damit kein Befund über die Dateigrenze, sondern nur der Stand vor dem Abbruch\n${diagnose(lauf)}`,
  ).toBe(0);
}

/**
 * Der Anfangszustand der Datei, die als ZWEITE lief — die eine Messung, um die es geht. Vorher die
 * Eichung: der Lauf muss fertig geworden sein, es müssen GENAU ZWEI Meldungen von ZWEI
 * VERSCHIEDENEN Dateien vorliegen, und die erste muss sauber starten. Vor ihr lief nichts; meldet
 * schon sie einen Rückstand, misst die Sonde nicht den Lauf, sondern sich selbst.
 */
function zweite(lauf: Lauf): Befund {
  fertigGeworden(lauf);
  expect(
    lauf.befunde.map((b) => b.datei),
    `die Sonde hat nicht genau zweimal gemeldet — der Lauf hat die Probedateien nicht gefahren\n${belege(lauf)}`,
  ).toHaveLength(2);
  expect(
    new Set(lauf.befunde.map((b) => b.datei)).size,
    `beide Meldungen kommen aus derselben Datei\n${belege(lauf)}`,
  ).toBe(2);
  expect(lauf.befunde[0], `die ERSTE Datei startet nicht sauber\n${belege(lauf)}`).toMatchObject(
    SAUBER,
  );
  return lauf.befunde[1] as Befund;
}

beforeAll(() => {
  ort = realpathSync(mkdtempSync(join(realpathSync(tmpdir()), "klarwerk-3875-")));
  spur = join(ort, "sonde.jsonl");
  // Bare Importe (`vitest`) werden vom Ort der importierenden Datei aus aufgelöst; ohne diesen
  // Verweis fände eine Datei unter `os.tmpdir()` das Paket nicht. Vite und Node lösen den Verweis
  // auf den echten Pfad auf — es entsteht keine zweite Vitest-Instanz.
  symlinkSync(join(WURZEL, "node_modules"), join(ort, "node_modules"), "dir");
  writeFileSync(join(ort, "probe-eins.test.ts"), probendatei("probe-eins"));
  writeFileSync(join(ort, "probe-zwei.test.ts"), probendatei("probe-zwei"));

  const unterbau = join(WURZEL, ".local", "run");
  mkdirSync(unterbau, { recursive: true });
  konfigOrt = realpathSync(mkdtempSync(join(unterbau, "job3875-")));
  konfig = join(konfigOrt, "sonde.config.ts");
  writeFileSync(konfig, konfigdatei());
});

// Das `finally` dieses Rahmens: er läuft auch, wenn jede Zusicherung darüber fällt (Lehre 3848/3864).
afterAll(() => {
  for (const weg of [ort, konfigOrt]) {
    if (weg !== "") {
      rmSync(weg, { recursive: true, force: true });
    }
  }
});

describe("JOB 3875 · dateiübergreifender Rückstand der Entwurf-verlassen-Hülle", () => {
  // ==============================================================================================
  // A · WIE DER BESTAND KONFIGURIERT IST — DIE ZWEITE DATEI STARTET SAUBER.
  // ==============================================================================================
  it("A · zwei Dateien, ein Fork, Konfiguration wie auf main: kein Rückstand", () => {
    const lauf = fahre([]);
    // Exit 0 fordert `zweite()` — für diesen Fall genauso wie für B und D, aus einer Hand.
    // Obwohl die erste Datei ihren Baum absichtlich hat stehen lassen.
    expect(zweite(lauf), belege(lauf)).toMatchObject(SAUBER);
  });

  // ==============================================================================================
  // B · DIE GEGENRICHTUNG — DIESELBEN ZWEI DATEIEN OHNE ISOLATION.
  // ==============================================================================================
  //
  // DER GEMESSENE RÜCKSTAND IST GRÖSSER, als die offene Selbstauskunft in `huelle.tsx` vermutet hat.
  // Nicht nur die drei modulweiten Grössen wandern mit: ohne Isolation teilen sich beide Dateien AUCH
  // das jsdom-Dokument (`imEigenenDokument: true`). Der fertig gerenderte Baum der Vordatei hängt der
  // zweiten also im eigenen `document.body` — und `sichtbar()`, `stellen()` und `wacheOffen()` lesen
  // genau dort. Die Wache in `huelle.tsx:282-286` schlägt dabei NICHT an: sie fragt `isConnected`,
  // und das ist wahr. `abbauen()` räumt hier stillschweigend den Baum einer fremden Datei ab.
  it("B · derselbe Lauf mit --no-isolate: der Rückstand der ersten Datei steht in der zweiten", () => {
    const lauf = fahre(["--no-isolate"]);
    expect(
      zweite(lauf),
      `ohne Isolation kam kein Rückstand in der zweiten Datei an — dann misst Fall A nichts\n${belege(lauf)}`,
    ).toMatchObject({
      flaecheGesetzt: true,
      flaecheVerbunden: true,
      imEigenenDokument: true,
      adresse: "/erfassen",
      abbauenWurf: null,
    });
  });

  // ==============================================================================================
  // D · DIE SONDE LIEST DEN ZUSTAND, NICHT DEN AUFBAU.
  // ==============================================================================================
  //
  // Derselbe Lauf wie B, nur baut die erste Datei ihren Baum am Ende ab. Dann meldet die zweite
  // keinen HÄNGENDEN Baum mehr — und ohne diesen Fall wäre B auch mit einer Sonde grün, die
  // „Rückstand" schlicht behauptet. Was bleibt, bleibt trotzdem und wird hier ebenso festgenagelt:
  // `container` zeigt weiter auf den (entfernten) Behälter, und `letzteAdresse` steht noch auf dem
  // Weg der Vordatei — `abbauen()` setzt beides nicht zurück, `grundzustand()` erst im nächsten Fall.
  it("D · dieselbe Gegenrichtung, aber die erste Datei räumt auf: kein hängender Baum mehr", () => {
    const lauf = fahre(["--no-isolate"], [], true);
    expect(zweite(lauf), belege(lauf)).toMatchObject({
      flaecheGesetzt: true,
      flaecheVerbunden: false,
      imEigenenDokument: false,
      adresse: "/erfassen",
      abbauenWurf: null,
    });
  });

  // ==============================================================================================
  // C · DER TEUERSTE FEHLER DIESER BAUFORM: EIN UNTERPROZESS, DER GAR NICHTS FÄHRT.
  // ==============================================================================================
  it("C · ein Lauf ohne Testdateien wird laut, nicht still grün", () => {
    const lauf = fahre([], ["keine-datei-mit-diesem-namen-job3875"]);
    expect(lauf.code, belege(lauf)).not.toBe(0);
    expect(lauf.ausgabe, belege(lauf)).toContain("No test files found");
    expect(lauf.befunde, "die Sonde hat gemeldet, obwohl keine Datei lief").toEqual([]);
  });

  // ==============================================================================================
  // E · DIE LAGE, GEGEN DIE `fertigGeworden()` STEHT — ZWEI GÜLTIGE MELDUNGEN, EIN ROTER LAUF.
  // ==============================================================================================
  //
  // Derselbe Lauf wie A, nur scheitert in beiden Probedateien ein Fall NACH dem Modulkopf. BEN hat
  // diese Lage zu JOB 3875 von Hand gefahren (`archiv/3875/runde-2/ben.md:11`) und ausdrücklich
  // einen dauerhaften Fall dafür bestellt; hier steht er. Er misst nicht den Unterprozess — den
  // misst schon `lauf.code` —, sondern den MESSSTAND: dass `zweite()` den Befund zurückweist und
  // dass die Meldung des äusseren Falls den Ursprungsfehler trägt statt nur „Exit 1".
  it("E · ein Probetest scheitert NACH der Sondenmeldung — der Lauf ist kein Befund", () => {
    const lauf = fahre([], [], false, true);
    // (a) Der Unterprozess ist nicht grün geworden.
    expect(lauf.code, `der Probetest hätte scheitern müssen\n${belege(lauf)}`).not.toBe(0);
    // (b) … und die Sonde hat TROTZDEM zweimal gemeldet, aus zwei verschiedenen Dateien. Ohne diese
    // Zusicherung misst E nicht die täuschende Lage, sondern nur irgendeinen kaputten Lauf.
    expect(
      lauf.befunde.map((b) => b.datei),
      `die Sonde hat nicht genau zweimal gemeldet — dann liegt die täuschende Lage gar nicht vor\n${belege(lauf)}`,
    ).toHaveLength(2);
    expect(
      new Set(lauf.befunde.map((b) => b.datei)).size,
      `beide Meldungen kommen aus derselben Datei\n${belege(lauf)}`,
    ).toBe(2);
    // (c) Und genau dann weist `zweite()` den Befund zurück — mit dem Satz aus `fertigGeworden()`
    // UND der wörtlichen Ursprungsmeldung des Probetests, die `diagnose()` vor den Rohauszug hebt.
    let wurf: unknown = null;
    try {
      zweite(lauf);
    } catch (fehler) {
      wurf = fehler;
    }
    expect(
      wurf,
      `zweite() hat den Befund angenommen, obwohl der Unterprozess rot ist\n${belege(lauf)}`,
    ).not.toBeNull();
    const meldung = wurf instanceof Error ? wurf.message : String(wurf);
    expect(meldung, `die Meldung nennt den Grund der Zurückweisung nicht\n${meldung}`).toContain(
      "der Unterprozess ist nicht grün geworden",
    );
    expect(
      meldung,
      `die Meldung nennt den Ursprungsfehler des Probetests nicht\n${meldung}`,
    ).toContain(FEHLERTEXT);
    // … und er steht VOR dem Rohauszug. Diese Zeile ist GEMESSEN nötig und nicht vorsorglich: mit
    // einer auf `belege(lauf)` reduzierten `diagnose()` blieb der Fall bis hierher grün (JOB 3912,
    // Cloud-Lauf df8c8919ce20fe015f1067cf, Exit 0) — der Ursprungsfehler fällt heute AUCH noch in
    // die letzten 1500 Zeichen. Darauf darf sich niemand verlassen: was `diagnose()` zusichert, ist
    // die LAGE der Zeilen, und genau diese Zusicherung war bis JOB 3912 nicht eingelöst (der Grund
    // steht im Kopf von `diagnose()`).
    const rohauszug = belege(lauf);
    expect(
      meldung.indexOf(FEHLERTEXT),
      `der Ursprungsfehler steht erst im Rohauszug — dann hängt er an dessen letzten 1500 Zeichen\n${meldung}`,
    ).toBeLessThan(meldung.indexOf(rohauszug));
  });
});
