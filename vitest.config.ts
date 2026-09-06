import { configDefaults, defineConfig } from "vitest/config";
import { browserMuster } from "./tests/tor-inventar/browser-gruppe";

// ==================================================================================================
// JOB 3131 T2 — DIE ZWEI GRUPPEN, UND WARUM SIE ZWEI AUFRUFE SIND UND KEIN WORKSPACE.
// ==================================================================================================
//
// VORHER: ein `vitest run` ueber den ganzen Bestand ohne Prozessgrenze. Darunter Dateien, die einen
// echten Chromium starten. Gemessene Folge: Last 100–140 auf 12 Kernen, Lastbremse des Taktgebers,
// Tor-Median 9,1 Minuten, Warteschlange bis 55 Minuten (`T3-VORHER-1.json`).
//
// NACHHER: `tools/test` faehrt ZWEI Vitest-Aufrufe nacheinander — `browser` (ein Fork, eine
// Chromium-Datei nach der anderen) und `rest` (sechs Forks). Diese Datei ist die gemeinsame Basis
// beider Aufrufe; `vitest.browser.config.ts` erbt sie ausdruecklich.
//
// WARUM KEIN WORKSPACE — das ist die naheliegende Loesung und in Vitest 2.1.9 die falsche. Codex hat
// es im technischen Nachtrag T2 belegt und hier ist es nachgelesen: `fileParallelism`, `maxWorkers`,
// `maxThreads` und `maxForks` sind im 2.x-Vertrag GLOBALE Optionen. Ein `poolOptions` in einem
// Workspace-PROJEKT wird von den Pool-Fabriken nie gelesen — zwei Projekte haetten also gut
// ausgesehen und nichts begrenzt. Zwei getrennte AUFRUFE haben je einen eigenen Wurzelkontext und
// damit je eine wirklich wirksame Grenze. Der Nachweis ist gemessen, nicht angenommen: `tools/test`
// zaehlt die Fork-Prozesse waehrend beider Aufrufe.
//
// WARUM DER SCHALTER UND NICHT EIN FESTES `exclude`: ein Bahn-Aufruf wie
// `npx vitest run tests/design/zielbild-h5-start.test.ts` muss weiter funktionieren. Stuende die
// Browser-Liste hier fest im `exclude`, faende so ein Aufruf „No test files found" — der Bestand
// waere von Hand nicht mehr erreichbar. OHNE `KLARWERK_TESTGRUPPE` verhaelt sich diese Datei
// deshalb zeichengleich wie vorher: sie sieht den ganzen Bestand.
const GRUPPE = process.env.KLARWERK_TESTGRUPPE;

/** Integrationstests (Postgres/Testcontainers) laufen getrennt ueber `test:integration`. */
export const AUSSCHLUSS = [...configDefaults.exclude, "**/*.integration.test.ts"];

/**
 * Was beide Aufrufe gleich haben. `vitest.browser.config.ts` uebernimmt es woertlich von hier —
 * Codex' Einwand zum Workspace gilt naemlich auch fuer zwei Konfigurationsdateien: geerbt wird
 * nichts von selbst. `setupFiles` fehlen hiesse: keine Test-Env. `cacheDir` fehlen hiesse: der
 * Cache landet wieder in `node_modules/.vite`, also im SYMLINK — der EPERM aus JOB 2622 D1.
 */
export const GEMEINSAM = {
  setupFiles: ["tests/setup-env.ts"],
  exclude: AUSSCHLUSS,
  testTimeout: 60_000,
  // ================================================================================================
  // DIE UNTERGRENZE — ohne sie bricht eine OBERGRENZE ALLEIN den ganzen Aufruf ab.
  // ================================================================================================
  // Vitest 2.1.9 baut seinen Pool so (`node_modules/vitest/dist/chunks/resolveConfig.*.js:6731-6756`):
  //     const threadsCount = Math.max(numCpus - 1, 1)                       // hier: 11
  //     const maxThreads   = poolOptions.maxForks ?? config.maxWorkers ?? threadsCount
  //     const minThreads   = poolOptions.minForks ?? config.minWorkers ?? threadsCount
  // Wer also NUR eine Obergrenze mitgibt, bekommt min=11 gegen max=4 — und Tinypool wirft
  // `RangeError: options.minThreads and options.maxThreads must not conflict`, VOR jeder Sammlung:
  // „Test Files no tests · Errors 1 error" nach 27 ms. Kein einziger Test lief, und der Aufruf sieht
  // aus wie ein Testfehler.
  //
  // GENAU DAS IST PASSIERT (06.09., Runde 2 dieses Auftrags): der Wächterlauf des Taktgebers fährt
  // `npx vitest run --pool=forks --poolOptions.forks.maxForks=4 <6 Wächterdateien>` (`takt/schritte.py`)
  // — Obergrenze ohne Untergrenze. Die Runde wurde ROT mit einer leeren Fehlerliste. Der Auftrag
  // verlangt in 5.2 ausdrücklich: „ein unpassendes Flag darf keinen Aufruf brechen". Deshalb steht
  // die Untergrenze HIER, in der Basis beider Aufrufe, und nicht in `tools/test`: der Wächterlauf,
  // die Bahnen und CI rufen Vitest direkt auf und sehen `tools/test` nie.
  //
  // `minWorkers` (nicht `poolOptions.*.minForks`) ist die Stelle mit der GERINGSTEN Wirkung: sie gilt
  // für jeden Pool — `forks` wie `threads` —, und ein Aufrufer, der seine Untergrenze selbst setzt,
  // überstimmt sie (in der Kette oben steht `poolOptions` VOR `config.minWorkers`).
  //
  // KOSTET ES DURCHSATZ? Nein: Tinypool startet bei einem Arbeiter und wächst mit der Warteschlange
  // bis zur Obergrenze. Nachgemessen 06.09. am Aufruf `rest` — die Zahl gleichzeitig laufender
  // Testdateien erreicht die Obergrenze weiterhin (s. RUECKGABE, WIRKUNGSNACHWEIS).
  //
  // Dass die Untergrenze bleibt, hält `tests/tor-inventar/waechterlauf-lastflag.test.ts` fest: er
  // startet echte Vitest-Unterprozesse mit genau der Schreibweise des Wächterlaufs.
  minWorkers: 1,
  coverage: {
    provider: "v8",
    reportsDirectory: "docs/generated/coverage",
    thresholds: { lines: 80, functions: 80 },
  },
} as const;

/** Der Bestand, woertlich wie bisher. Er wird nicht neu gefasst, nur auf zwei Aufrufe verteilt. */
export const BESTAND_INCLUDE = [
  "tests/**/*.test.{ts,tsx}",
  "services/**/*.test.ts",
  "apps/web/src/**/*.test.{ts,tsx}",
];

export default defineConfig({
  // ==============================================================================================
  // JOB 2622 D1 — DER EPERM, DER JEDE MESSUNG VERFAELSCHT (56 Rueckgaben nannten ihn).
  // ==============================================================================================
  // Vitest schreibt seinen Ergebniscache standardmaessig nach `${cacheDir}/vitest/results.json`,
  // und der Vite-Default fuer cacheDir ist `node_modules/.vite`. In den Bahn-Klonen ist
  // `node_modules` ein SYMLINK auf den geteilten Bestand unter `dev_Klarwerk/` — dort verbietet
  // die Bahn-Sandbox jeden Write (gemessen 28.08.: Schreibprobe im Klon OK, Schreibprobe durch den
  // Symlink EPERM). Folge: JEDER Vollsuitenlauf einer Bahn endete mit `VITEST-EXIT=1` bei null
  // roten Faellen, und „EXIT=1 ist normal" haette eines Tages einen echten Fehler verdeckt.
  // Der Cache zieht deshalb in einen REPO-LOKALEN, bereits git-ignorierten Ort (`.local/run/` ist
  // seit SCRUM-387 ignoriert): im Klon real beschreibbar, beim Chef/CI identisch, kein
  // git-Rauschen. Beim Chef aendert sich nichts Messbares — nur der Ablageort des Caches.
  cacheDir: ".local/run/vite-cache",
  test: {
    // WP-D8b: .test.tsx erlaubt GEMOUNTETE React-Komponenten-Tests (jsdom). Diese Dateien laufen über
    // die esbuild-Transformation von Vitest; der Root-tsc (tools/build, ohne jsx/DOM-lib) schließt sie
    // via tsconfig-exclude aus — die Web-Komponenten selbst typprüft der App-Build.
    //
    // ============================================================================================
    // AUFTRAG-mega59 BLOCK G — DAS ZWEITE LOCH AM GLEICHEN ORT.
    // ============================================================================================
    //
    // 19 Testdateien wohnen in `apps/web/src` und liefen im Tor GAR NICHT, weil diese Liste nur
    // `tests/**` und `services/**` einschloss. Der Satz darüber („die Web-Komponenten typprüft der
    // App-Build") begründete das — und war seit `tools/build` FALSCH: dort lief `vite build`, und
    // `vite build` typprüft nicht. Beides ist in dieser Runde geschlossen:
    //   · `tools/build` fährt jetzt `apps/web && npx tsc --noEmit` VOR dem Bündeln. Damit ist der
    //     Typprüfpfad für diese Dateien wirklich da — `apps/web/tsconfig.json` bringt jsx und
    //     DOM-lib mit und deckt `src` samt der 19 Dateien (kein zweiter tsconfig nötig).
    //   · Sie laufen ab jetzt im Tor mit: 19 Dateien, 100 Fälle, alle grün — nachgemessen, nicht
    //     angenommen. Vorher lag in einer davon ein echter Typfehler (s. captionAiSuggest.test.ts),
    //     den niemand sehen konnte.
    include: BESTAND_INCLUDE,
    // WP-VIP2-GATE (bens P1): Test-Env explizit setzen (Selbstregistrierung ist in Produktion
    // fail-closed AUS; die Suite ist ein Dev-Setup und schaltet sie bewusst frei).
    // Integrationstests (Postgres/Testcontainers) laufen getrennt über `test:integration`,
    // damit der schnelle Gate-Lauf kein Docker braucht. Beides steht jetzt in `GEMEINSAM`, damit
    // der Browser-Aufruf es nicht verlieren kann.
    ...GEMEINSAM,
    // JOB 3131 T2 — der Abzug. NUR im Aufruf `rest`: dort laufen die Chromium-Dateien schon im
    // ersten Aufruf, ein zweites Mal waere Doppelarbeit UND die parallele Last, die dieser Auftrag
    // beseitigt. In jedem anderen Aufruf (Bahn, `-t`, einzelne Datei) bleibt der Bestand ganz.
    // Dass Abzug und Zuschlag sich exakt decken, misst `tests/tor-inventar` am echten Collector.
    exclude: GRUPPE === "rest" ? [...AUSSCHLUSS, ...browserMuster()] : AUSSCHLUSS,
  },
});
