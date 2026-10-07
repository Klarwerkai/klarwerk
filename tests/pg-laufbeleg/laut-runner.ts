// R-1327: der Testläufer des Integrationslaufs (`vitest.integration.config.ts`, `test.runner`).
// Nach jeder Datei meldet er deren übersprungene Fälle mit Namen auf stderr — Begründung in
// `./melder.ts`.
//
// WARUM EIN RUNNER UND KEINE SETUP-DATEI MIT `afterAll` (Bens Befund, Nacharbeit 2): Eine Datei,
// deren Fälle ALLE statisch abgeschaltet sind (`describe.skipIf` über dem ganzen Inhalt), steht
// nach der Sammlung selbst auf `mode=skip`. Vitest fährt dann keinen einzigen ihrer Hooks, und wer
// `--reporter` selbst wählt, verliert zusätzlich die Bilanz des Reporters.
//
// WARUM DIE DATEI-HOOKS UND NICHT `onAfterRunSuite` (Prüfbefund L5, Nacharbeit 3): auch
// `onAfterRunSuite` meldete für eine solche Datei nichts — gemessen unter Vitest 2.1.9, die Ausgabe
// blieb stumm. Deshalb hängt die Meldung jetzt an den beiden Haken, die `startTests` für JEDE
// Datei ruft:
//   · `onCollected` — nach der Sammlung. Eine ganz statisch übersprungene Datei ist hier schon
//     vollständig bekannt (Modus `skip` bis in jeden Fall) und wird HIER gemeldet;
//   · `onAfterRunFiles` — nach dem Lauf. Alle übrigen Dateien werden HIER gemeldet, mit dem
//     Ausgang jedes Falls (`ctx.skip()` zur Laufzeit, `it.skip`, `todo`).
// Jede Datei wird so genau einmal gemeldet.
//
// Die Haken werden im Konstruktor UM die vorhandenen gelegt, nicht als Methoden überschrieben:
// ob `VitestTestRunner` sie selbst trägt, ist von außen nicht zugesichert, und eine vorhandene
// Fassung muss weiterlaufen.
import { VitestTestRunner } from "vitest/runners";
import { type Aufgabe, dateiMeldung, laufbild } from "./melder";

type Dateihaken = (dateien: readonly Aufgabe[]) => unknown;

interface Haken {
  onCollected?: Dateihaken;
  onAfterRunFiles?: Dateihaken;
}

function melde(datei: Aufgabe): void {
  const meldung = dateiMeldung(laufbild([datei]));
  if (meldung !== undefined) {
    process.stderr.write(meldung);
  }
}

/** Ganz übersprungen heißt: die Datei selbst steht nach der Sammlung auf `skip`/`todo`. */
function ganzUebersprungen(datei: Aufgabe): boolean {
  return datei.mode === "skip" || datei.mode === "todo";
}

export default class LautUebersprungenRunner extends VitestTestRunner {
  constructor(...argumente: ConstructorParameters<typeof VitestTestRunner>) {
    super(...argumente);
    const selbst = this as unknown as Haken;
    const gesammelt = selbst.onCollected?.bind(this);
    const gelaufen = selbst.onAfterRunFiles?.bind(this);
    selbst.onCollected = async (dateien) => {
      await gesammelt?.(dateien);
      for (const datei of dateien.filter(ganzUebersprungen)) {
        melde(datei);
      }
    };
    selbst.onAfterRunFiles = async (dateien) => {
      await gelaufen?.(dateien);
      for (const datei of dateien.filter((d) => !ganzUebersprungen(d))) {
        melde(datei);
      }
    };
  }
}
