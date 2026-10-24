import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";
import type { Loeschmarkierung, LoeschmarkierungsAblage } from "./loeschmarkierung-typen";
import type { RoutinenRepo } from "./vormachen";

// ================================================================================================
// produkt:20261011:peter-p06 · RF-17 — LÖSCHMARKIERUNGEN, DIE EINE SICHERUNG ÜBERDAUERN.
// ================================================================================================
//
// Originalfall RF-17: „Privatverlauf löschen, getrennt geteilte Firmennotiz behalten; später
// Testrestore → Privatbestand entfernt, geteiltes Wissen erhalten, Löschmarkierung vor
// Wiederfreigabe angewendet." Peters Entscheidung 45 (Wiederanlauf): „Zuerst Integrität,
// Rechteentzüge und Löschmarkierungen nachführen; anschließend Suche und Bibliothek öffnen."
//
// DAS PROBLEM: Die Privatlöschung entfernt Zeilen aus `persoenliche_routinen`. Eine ältere Sicherung
// enthält sie noch; nach dem Restore wären sie zurück. Die Verwaltung kann sie im Wiederanlauf nicht
// über einen vorhandenen Weg nachführen — sie sieht persönliche Routinen bewusst nicht, und die Spur
// der Löschung (Prüfprotokoll) liegt in derselben, zurückgesetzten Datenbank.
//
// DIE LÖSUNG IM BESTEHENDEN WEG, OHNE ZWEITES SYSTEM:
//   · Die Privatlöschung vermerkt VOR dem Löschen eine Markierung — nur Art, Kontokennung und
//     Zeitpunkt, kein Inhalt — in einer Datei AUSSERHALB der Datenbank (`KLARWERK_LOESCHMARKIERUNGEN`).
//     Scheitert der Vermerk, wird nicht gelöscht (die Person sieht den Fehler und kann es erneut
//     versuchen): eine Löschung ohne Markierung käme mit dem nächsten Restore unbemerkt zurück.
//   · Der Wiederanlauf (`wiederanlauf.ts`) wendet alle Markierungen an, BEVOR er eine Anfrage annimmt —
//     also vor der Freigabe: entfernt werden die Routinen des Kontos, die zum Zeitpunkt der Markierung
//     schon bestätigt waren. Später bestätigte Routinen bleiben. Das ist wiederholbar (eine zweite
//     Anwendung entfernt nichts mehr) und unabhängig vom Sicherungsstand.
//   · Firmeninhalte berührt das nicht: eine Firmenübergabe ist ein eigener Entwurf (P06-AC07).
//
// Eine unlesbare Ablage bricht den Wiederanlauf ab (fail-closed), statt mit wieder aufgetauchten
// Privatdaten zu öffnen. Ohne gesetzte Ablage wird nichts vermerkt; die Auskunft des Wiederanlaufs
// sagt das ausdrücklich (`ort: null`).

export const LOESCHMARKIERUNGEN_ENV = "KLARWERK_LOESCHMARKIERUNGEN";

export const LOESCHMARKIERUNG_ARTEN = ["persoenliche_routinen"] as const;
export type LoeschmarkierungArt = (typeof LOESCHMARKIERUNG_ARTEN)[number];

export type { Loeschmarkierung, LoeschmarkierungsAblage };

function istMarkierung(x: unknown): x is Loeschmarkierung {
  const m = x as Partial<Loeschmarkierung> | null | undefined;
  return (
    typeof m === "object" &&
    m !== null &&
    LOESCHMARKIERUNG_ARTEN.includes(m.art as LoeschmarkierungArt) &&
    typeof m.kontoId === "string" &&
    m.kontoId.length > 0 &&
    typeof m.am === "string" &&
    !Number.isNaN(Date.parse(m.am))
  );
}

/**
 * Eine Zeile JSON je Markierung, angehängt und mit `fsync` auf den Datenträger gebracht. Eine letzte
 * Zeile ohne Zeilenende ist ein abgebrochener Vermerk — zu ihm gab es keine Löschung, sie zählt nicht.
 * Jede andere unlesbare Zeile ist ein Fehler.
 */
export class DateiLoeschmarkierungen implements LoeschmarkierungsAblage {
  constructor(readonly ort: string) {}

  // Beide Methoden sind `async`: jeder Fehler (Datenträger, unlesbare Zeile) kommt als ABGELEHNTES
  // Versprechen an, nie als synchroner Wurf — so wie der Vertrag `LoeschmarkierungsAblage` es sagt.
  async vermerke(m: Loeschmarkierung): Promise<void> {
    mkdirSync(dirname(this.ort), { recursive: true });
    const fd = openSync(this.ort, "a", 0o600);
    try {
      writeSync(fd, `${JSON.stringify({ art: m.art, kontoId: m.kontoId, am: m.am })}\n`);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }

  async alle(): Promise<Loeschmarkierung[]> {
    if (!existsSync(this.ort)) {
      return [];
    }
    const zeilen = readFileSync(this.ort, "utf8").split("\n");
    // Nach dem letzten Zeilenende: leer oder ein abgebrochener Vermerk.
    zeilen.pop();
    return zeilen.map((zeile, i) => {
      let wert: unknown;
      try {
        wert = JSON.parse(zeile);
      } catch {
        wert = undefined;
      }
      if (!istMarkierung(wert)) {
        throw new Error(`Löschmarkierungen ${this.ort}: Zeile ${i + 1} ist keine Markierung.`);
      }
      return wert;
    });
  }
}

export class InMemoryLoeschmarkierungen implements LoeschmarkierungsAblage {
  readonly ort = "speicher";
  private readonly m: Loeschmarkierung[] = [];

  vermerke(m: Loeschmarkierung): Promise<void> {
    this.m.push({ ...m });
    return Promise.resolve();
  }

  alle(): Promise<Loeschmarkierung[]> {
    return Promise.resolve(this.m.map((x) => ({ ...x })));
  }
}

/** Liest den Ort aus der Umgebung; nicht gesetzt → keine Ablage. */
export function leseLoeschmarkierungsAblage(
  env: Record<string, string | undefined> = process.env,
): LoeschmarkierungsAblage | undefined {
  const ort = env[LOESCHMARKIERUNGEN_ENV]?.trim();
  return ort ? new DateiLoeschmarkierungen(ort) : undefined;
}

export interface LoeschmarkierungsNachfuehrung {
  /** Ort der Ablage; `null`: keine Ablage eingerichtet — dann wurde nichts nachgeführt. */
  readonly ort: string | null;
  readonly markierungen: number;
  /** Zahl der dabei entfernten Routinen (beim zweiten Anwenden 0). */
  readonly entfernt: number;
}

/** Wendet alle Markierungen auf die (wiederhergestellten) persönlichen Routinen an. */
export async function fuehreLoeschmarkierungenNach(
  ablage: LoeschmarkierungsAblage | undefined,
  routinen: RoutinenRepo,
): Promise<LoeschmarkierungsNachfuehrung> {
  if (!ablage) {
    return { ort: null, markierungen: 0, entfernt: 0 };
  }
  const alle = await ablage.alle();
  let entfernt = 0;
  for (const m of alle) {
    entfernt += await routinen.entferneBestaetigtBis(m.kontoId, m.am);
  }
  return { ort: ablage.ort, markierungen: alle.length, entfernt };
}
