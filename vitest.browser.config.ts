import { defineConfig } from "vitest/config";
// ==================================================================================================
// JOB 3131 T2 — DER ERSTE DER ZWEI TOR-AUFRUFE: die Chromium-Tests, einer nach dem anderen.
// ==================================================================================================
//
// WAS HIER LAEUFT: genau die Testdateien, deren Importhuelle ein Playwright-Paket beruehrt, also
// die, die einen echten Browser starten koennen. Die Menge steht NICHT als Liste da, sie wird bei
// jedem Laden aus dem Importgraphen berechnet (`tests/tor-inventar/browser-gruppe.ts`). Der Grund
// steht dort ausfuehrlich; kurz: eine gepflegte Liste ist am Tag ihrer Entstehung richtig, und der
// naechste neue Chromium-Test rutschte still in den parallelen Aufruf zurueck.
//
// WIEVIELE GLEICHZEITIG: einer. Die Grenze setzt `tools/test` am Aufruf
// (`--pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1`) und nicht diese
// Datei — genau deshalb ist es ein eigener AUFRUF und kein Workspace-Projekt: die Poolgroesse ist
// in Vitest 2.1.9 eine globale Option und je Aufruf wirksam, je Projekt nicht (Begruendung in
// `vitest.config.ts`).
//
// DIE ISOLIERUNG BLEIBT UNANGETASTET: kein `singleFork`, kein `singleThread` (Codex, technischer
// Nachtrag T2: „Isolation erhalten"). `isolate` steht auf seinem Vorgabewert `true` — jede Datei
// bekommt ihren eigenen frischen Prozess, sie laufen nur nicht mehr gleichzeitig.
//
// GEERBT WIRD NICHTS VON SELBST. Ein zweiter Aufruf ist eine eigene Vitest-Konfiguration:
// `vitest.config.ts` ist fuer ihn keine Vorlage, sondern eine Datei, aus der er ausdruecklich
// uebernimmt. Faellt `GEMEINSAM` hier weg, laeuft die Browsergruppe ohne Test-Env
// (`tests/setup-env.ts`) und mit den Integrationstests — beides still.
import { browserMuster } from "./tests/tor-inventar/browser-gruppe";
import { GEMEINSAM } from "./vitest.config";

export default defineConfig({
  // Ein eigener Cache-Ordner. Beide Aufrufe schreiben sonst nacheinander dieselbe
  // `${cacheDir}/vitest/results.json` und ueberschreiben gegenseitig die Laufzeiten, aus denen
  // Vitest seine Dateireihenfolge bildet. Getrennt bleibt jede Gruppe bei ihrer eigenen Erfahrung.
  // `.local/run/` ist seit SCRUM-387 git-ignoriert (Begruendung in `vitest.config.ts`, JOB 2622 D1).
  cacheDir: ".local/run/vite-cache-browser",
  test: {
    ...GEMEINSAM,
    include: browserMuster(),
  },
});
