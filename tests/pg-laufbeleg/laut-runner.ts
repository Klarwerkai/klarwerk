// R-1327: der Testläufer des Integrationslaufs (`vitest.integration.config.ts`, `test.runner`).
// Nach jeder Datei meldet er deren übersprungene Fälle mit Namen auf stderr — Begründung in
// `./melder.ts`.
//
// WARUM EIN RUNNER UND KEINE SETUP-DATEI MIT `afterAll` (Bens Befund, Nacharbeit 2): Eine Datei,
// deren Fälle ALLE statisch abgeschaltet sind (`describe.skipIf` über dem ganzen Inhalt), steht
// nach der Sammlung selbst auf `mode=skip`. Vitest fährt dann keinen einzigen ihrer Hooks — auch
// den `afterAll` einer Setup-Datei nicht —, und wer `--reporter` selbst wählt, verliert zusätzlich
// die Bilanz des Reporters. Genau diese Datei schwieg also vollständig. `onAfterRunSuite` des
// Läufers wird dagegen für JEDE Datei aufgerufen, auch für eine übersprungene, und hängt an keinem
// Reporter.
import { VitestTestRunner } from "vitest/runners";
import { dateiMeldung, laufbild } from "./melder";

type Gruppe = Parameters<VitestTestRunner["onAfterRunSuite"]>[0];

export default class LautUebersprungenRunner extends VitestTestRunner {
  override async onAfterRunSuite(gruppe: Gruppe): Promise<void> {
    await super.onAfterRunSuite(gruppe);
    // Nur die Datei selbst, nicht jede Gruppe darin — sonst käme jeder Fall mehrfach.
    if (!("filepath" in gruppe)) {
      return;
    }
    const meldung = dateiMeldung(laufbild([gruppe]));
    if (meldung !== undefined) {
      process.stderr.write(meldung);
    }
  }
}
