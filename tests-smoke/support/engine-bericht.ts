// ================================================================================================
// AUFNAHME 20260922 · BROWSER-KERNPRÜFUNG — DER LAUF SAGT, WELCHE ENGINES ER WIRKLICH GEFAHREN HAT.
// ================================================================================================
//
// DIE ANFORDERUNG (R-1382, „Prüftor über drei Browser"): „Die Oberfläche wird in drei Browsern
// geprüft, nicht nur in einem, und der Durchlauf sagt, welche Browser er wirklich gefahren hat."
//
// Bis hierher sagte es nur die PROSA: `tools/check` druckt „Chromium, hermetisch", und die beiden
// Kettenwächter (`tests/smoke/job1094-engine-kette.test.ts`, `tests/app/three-engine-gate-contract
// .test.ts`) leiten die Enginemenge STATISCH aus `tools/check` → `package.json` →
// `playwright.smoke.config.ts` ab. Das beweist, was ein Lauf fahren SOLL — nicht, was er gefahren
// HAT. Ein Lauf, in dem Firefox nur Übersprünge lieferte oder WebKit gar nicht startete, sah im
// `list`-Protokoll aus wie jeder andere.
//
// DIESER BERICHT zählt am Ende jedes Laufs aus Playwrights eigenen Ergebnissen, je Engine:
// bestanden, übersprungen, rot. Eine Engine gilt nur als GEFAHREN, wenn mindestens ein Fall in ihr
// wirklich gelaufen ist (bestanden oder rot) — eine Engine mit ausschließlich Übersprüngen ist
// angemeldet, aber nicht gefahren, und wird auch so benannt. Angebotene Engines, die der Lauf gar
// nicht berührt hat, stehen ausdrücklich als „nicht gefahren" daneben.
//
// WAS DIESER BERICHT NICHT TUT: er verdrahtet das Tor NICHT auf drei Engines. Die Sperre aus
// Auflage 2 (K7 in `tests/smoke/job1094-engine-kette.test.ts`) bleibt unberührt — er macht die
// heutige Einengigkeit des Tors in jedem Lauf sichtbar, statt sie nur in Kommentaren zu führen.
//
// BEWUSST OHNE IMPORT AUS `@playwright/test/reporter`: die Typen unten sind die Teilmenge der
// Reporter-Schnittstelle, die hier gelesen wird. Ein Import (auch ein reiner Typimport) würde den
// Vitest-Wächter dieser Datei über den Importgraphen (`tests/tor-inventar/browser-gruppe.ts`) in
// die serielle Browsergruppe ziehen, obwohl er keinen Browser startet.

/** Die Engines, die `playwright.smoke.config.ts` anbietet — in Ausgabereihenfolge. */
export const ENGINES = ["chromium", "firefox", "webkit"] as const;

type Status = "passed" | "failed" | "timedOut" | "skipped" | "interrupted";

/** Teilmenge von Playwrights `FullProject`, die der Bericht liest. */
interface Projekt {
  name: string;
  use: { browserName?: string; defaultBrowserType?: string };
}

/** Teilmenge von Playwrights `TestCase`. */
interface Fall {
  id: string;
  parent: { project(): Projekt | undefined };
}

export interface Ergebnis {
  engine: string;
  status: Status;
}

export interface EngineZeile {
  engine: string;
  bestanden: number;
  uebersprungen: number;
  rot: number;
}

export interface EngineBilanz {
  /** Engines, in denen mindestens ein Fall wirklich lief (bestanden oder rot). */
  gefahren: EngineZeile[];
  /** Engines mit Fällen, die aber ausschließlich übersprungen wurden. */
  nurUebersprungen: EngineZeile[];
  /** Angebotene Engines ohne einen einzigen Fall im Lauf. */
  nichtGefahren: string[];
}

/**
 * Die Engine eines Projekts. `devices["Desktop …"]` setzt `defaultBrowserType`; ein ausdrückliches
 * `browserName` gewinnt. Die Setup-Projekte bereiten nur vor und tragen keine Engine-Aussage —
 * dieselbe Regel wie in beiden Kettenwächtern.
 */
export function engineVonProjekt(projekt: Projekt | undefined): string | undefined {
  if (projekt === undefined || projekt.name.startsWith("setup")) {
    return undefined;
  }
  return projekt.use.browserName ?? projekt.use.defaultBrowserType ?? "unbekannt";
}

export function engineBilanz(ergebnisse: readonly Ergebnis[]): EngineBilanz {
  const zeilen = new Map<string, EngineZeile>();
  for (const { engine, status } of ergebnisse) {
    const zeile = zeilen.get(engine) ?? { engine, bestanden: 0, uebersprungen: 0, rot: 0 };
    if (status === "passed") {
      zeile.bestanden += 1;
    } else if (status === "skipped") {
      zeile.uebersprungen += 1;
    } else {
      zeile.rot += 1;
    }
    zeilen.set(engine, zeile);
  }
  const bekannt: readonly string[] = ENGINES;
  const fremde = [...zeilen.keys()].filter((e) => !bekannt.includes(e)).sort();
  const vorhanden = [...bekannt, ...fremde].flatMap((e) => zeilen.get(e) ?? []);
  return {
    gefahren: vorhanden.filter((z) => z.bestanden + z.rot > 0),
    nurUebersprungen: vorhanden.filter((z) => z.bestanden + z.rot === 0),
    nichtGefahren: bekannt.filter((e) => !zeilen.has(e)),
  };
}

export function engineBerichtText(bilanz: EngineBilanz): string {
  const zahlen = (z: EngineZeile): string =>
    `${z.engine} (${z.bestanden} bestanden, ${z.uebersprungen} übersprungen, ${z.rot} rot)`;
  const liste = (werte: readonly string[]): string => {
    return werte.length > 0 ? werte.join(", ") : "—";
  };
  const alleDrei = ENGINES.every((e) => bilanz.gefahren.some((z) => z.engine === e));
  return [
    "▶ Engine-Bericht dieses Laufs (aus Playwrights Ergebnissen, nicht aus der Konfiguration)",
    `  gefahren:             ${liste(bilanz.gefahren.map(zahlen))}`,
    `  nur übersprungen:     ${liste(bilanz.nurUebersprungen.map(zahlen))}`,
    `  nicht gefahren:       ${liste(bilanz.nichtGefahren)}`,
    alleDrei
      ? "  ⓘ Alle drei Engines (Chromium, Firefox, WebKit) wurden in diesem Lauf gefahren."
      : "  ⓘ Dieser Lauf belegt NICHT alle drei Engines; über die übrigen sagt er nichts.",
  ].join("\n");
}

/**
 * Playwright-Reporter. Je Fall zählt das LETZTE Ergebnis (bei Wiederholungen ersetzt es die
 * früheren), damit ein Fall nicht doppelt in die Bilanz eingeht.
 */
export default class EngineBericht {
  private readonly letzte = new Map<string, Ergebnis>();

  printsToStdio(): boolean {
    return false;
  }

  onTestEnd(fall: Fall, ergebnis: { status: Status }): void {
    const engine = engineVonProjekt(fall.parent.project());
    if (engine !== undefined) {
      this.letzte.set(fall.id, { engine, status: ergebnis.status });
    }
  }

  onEnd(): void {
    console.log(`\n${engineBerichtText(engineBilanz([...this.letzte.values()]))}\n`);
  }
}
