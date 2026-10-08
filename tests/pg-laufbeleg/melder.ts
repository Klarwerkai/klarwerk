// ================================================================================================
// R-1327 / R-2211 — EIN ÜBERSPRUNGENER DATENBANKFALL MELDET SICH LAUT, IN JEDER DATEI.
// ================================================================================================
//
// DER BEFUND. Die Integrationsdateien (`*.integration.test.ts`) fahren fast alle dieselbe Hausform:
// lokale Testinstanz über `guardedLocalPgTestUrl`, sonst Testcontainers, sonst `ctx.skip()`. Ohne
// Docker wird so aus jeder Postgres-Zusicherung ein übersprungener Fall, Vitest endet mit Exit 0,
// und der Lauf sieht grün aus, obwohl nichts gegen die echte Datenbank geprüft wurde. Genau EINE
// Datei (`services/audit/src/repo-pg.integration.test.ts`, A-1303) hat das bisher für sich selbst
// gelöst; die übrigen über hundert schweigen weiter.
//
// DIE ABHILFE STEHT ZENTRAL und nicht hundertfach: `vitest.integration.config.ts` hängt
//   · `tests/pg-laufbeleg/laut-runner.ts` als Testläufer ein — er meldet nach JEDER Datei deren
//     übersprungene Fälle mit Namen, auch für eine Datei, die ganz statisch übersprungen ist. Das
//     hängt an keinem Reporter, gilt also auch, wenn ein Aufrufer `--reporter` selbst wählt;
//   · `PgLaufMelder` als zusätzlichen Reporter ein — er schreibt am Ende EINE Bilanz des ganzen
//     Laufs. Läuft kein einziger Fall, sagt sie ausdrücklich, dass dieser Lauf keinen echten
//     Datenbankbetrieb belegt (R-2211).
//
// BEWUSST NICHT GEBAUT: ein Überspringen färbt den Lauf weiterhin NICHT rot. Dieselbe Entscheidung
// wie in A-1303 — auf einer Maschine ohne Docker geriete sonst jeder Lauf ins Rot. Ob ein Lauf
// ohne Datenbank scheitern MUSS, bleibt eine Betriebsentscheidung. Verlangt ist hier nur, dass der
// Lauf sagt, was er geprüft hat und was nicht.
//
// ZÄHLWEISE. Übersprungen ist jeder Fall, der nicht ausgeführt wurde: `ctx.skip()` zur Laufzeit,
// `it.skip`/`describe.skipIf`, `todo` — und auch ein von `-t` ausgefilterter Fall. Letzteres ist
// Absicht: auch er hat nichts geprüft.

/** Der Ausschnitt einer Vitest-Aufgabe, den der Melder liest — Datei, Gruppe oder Fall. */
export interface Aufgabe {
  readonly name: string;
  readonly mode: string;
  readonly result?: { readonly state?: string } | undefined;
  readonly tasks?: readonly Aufgabe[] | undefined;
}

export interface Laufbild {
  readonly gelaufen: number;
  readonly fehlgeschlagen: number;
  /** Je übersprungenem Fall der volle Pfad „Datei › Gruppe › Fall". */
  readonly uebersprungen: readonly string[];
}

const KENNUNG = "[KLARWERK][R-1327]";

/** Wie viele Namen die Schlussbilanz höchstens aufzählt; die Dateimeldungen nennen alle. */
const HOECHSTENS_GENANNT = 40;

function istUebersprungen(fall: Aufgabe): boolean {
  const zustand = fall.result?.state;
  return fall.mode === "skip" || fall.mode === "todo" || zustand === "skip" || zustand === "todo";
}

/** Zählt die FÄLLE (Blätter) unter den übergebenen Aufgaben. */
export function laufbild(aufgaben: readonly Aufgabe[]): Laufbild {
  let gelaufen = 0;
  let fehlgeschlagen = 0;
  const uebersprungen: string[] = [];
  const besuche = (a: Aufgabe, pfad: readonly string[]): void => {
    const hier = [...pfad, a.name];
    if (a.tasks !== undefined) {
      for (const kind of a.tasks) {
        besuche(kind, hier);
      }
      return;
    }
    if (istUebersprungen(a)) {
      uebersprungen.push(hier.join(" › "));
    } else if (a.result?.state === "fail") {
      fehlgeschlagen += 1;
    } else if (a.result?.state === "pass") {
      gelaufen += 1;
    }
  };
  for (const a of aufgaben) {
    besuche(a, []);
  }
  return { gelaufen, fehlgeschlagen, uebersprungen };
}

/** Die Meldung nach einer Datei — `undefined`, wenn in ihr nichts übersprungen wurde. */
export function dateiMeldung(bild: Laufbild): string | undefined {
  if (bild.uebersprungen.length === 0) {
    return undefined;
  }
  const zeilen = [
    `${KENNUNG} ${bild.uebersprungen.length} Fall/Fälle ÜBERSPRUNGEN — gegen die echte Datenbank wurde dabei NICHTS geprüft:`,
    ...bild.uebersprungen.map((name) => `${KENNUNG}   ÜBERSPRUNGEN: ${name}`),
  ];
  return `${zeilen.join("\n")}\n`;
}

/** Die Schlussbilanz des ganzen Integrationslaufs. */
export function gesamtMeldung(bild: Laufbild): string {
  const strich = "=".repeat(96);
  const zeilen = [
    strich,
    `${KENNUNG} INTEGRATIONSLAUF: ${bild.gelaufen} gelaufen · ${bild.uebersprungen.length} ÜBERSPRUNGEN · ${bild.fehlgeschlagen} fehlgeschlagen`,
  ];
  if (bild.uebersprungen.length === 0) {
    zeilen.push(`${KENNUNG} Kein Fall übersprungen.`);
  } else {
    zeilen.push(
      `${KENNUNG} Übersprungene Fälle haben NICHTS gegen die echte Datenbank geprüft. Ein grüner Lauf belegt für sie keinen Datenbankbetrieb.`,
    );
    for (const name of bild.uebersprungen.slice(0, HOECHSTENS_GENANNT)) {
      zeilen.push(`${KENNUNG}   ÜBERSPRUNGEN: ${name}`);
    }
    const rest = bild.uebersprungen.length - HOECHSTENS_GENANNT;
    if (rest > 0) {
      zeilen.push(`${KENNUNG}   … und ${rest} weitere (je Datei oben einzeln gemeldet).`);
    }
  }
  if (bild.gelaufen === 0) {
    zeilen.push(
      `${KENNUNG} KEIN EINZIGER FALL LIEF — dieser Lauf belegt KEINEN echten Datenbankbetrieb (R-2211).`,
    );
  }
  zeilen.push(strich);
  return `${zeilen.join("\n")}\n`;
}

/**
 * Zusätzlicher Reporter des Integrationslaufs: schreibt die Schlussbilanz auf stderr.
 *
 * Er ersetzt den Standardreporter nicht, er steht neben ihm. Übergibt ein Aufrufer `--reporter`,
 * entfällt er — die Dateimeldungen der Setup-Datei bleiben trotzdem.
 */
export class PgLaufMelder {
  onFinished(dateien: readonly Aufgabe[] = []): void {
    process.stderr.write(gesamtMeldung(laufbild(dateien)));
  }
}
