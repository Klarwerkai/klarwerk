// ================================================================================================
// AUFNAHME 20260922 · BROWSER-KERNPRÜFUNG — DER LAUF SAGT, WELCHE ENGINES ER WIRKLICH GESTARTET HAT.
// ================================================================================================
//
// DIE ANFORDERUNG (R-1382, „Prüftor über drei Browser"): „Die Oberfläche wird in drei Browsern
// geprüft, nicht nur in einem, und der Durchlauf sagt, welche Browser er wirklich gefahren hat."
//
// Bis hierher sagte es nur die PROSA: `tools/check` druckt „Chromium, hermetisch", und die beiden
// Kettenwächter (`tests/smoke/job1094-engine-kette.test.ts`, `tests/app/three-engine-gate-contract
// .test.ts`) leiten die Enginemenge STATISCH aus `tools/check` → `package.json` →
// `playwright.smoke.config.ts` ab. Das beweist, was ein Lauf fahren SOLL, nicht, was er gefahren HAT.
//
// ------------------------------------------------------------------------------------------------
// NACHARBEIT 2 (Bens Befunde zum Kandidaten 035b725) — ZWEI FEHLER DER ERSTEN FASSUNG.
// ------------------------------------------------------------------------------------------------
//
//   1. Die erste Fassung war ein Playwright-REPORTER. Der Prüfadapter ruft aber mit
//      `--reporter=line,json` auf, und das ERSETZT die Reporterliste der Konfiguration — im
//      tatsächlichen Torlauf erschien der Bericht nie (`HISTORIE/nacharbeit-1/PRUEFUNG/
//      smoke-gezielt.json`, `config.reporter`). Deshalb hängt der Bericht jetzt an zwei Stellen, die
//      KEINE Reporterauswahl überschreiben kann: am Browserstart selbst (die Konfiguration wird in
//      jedem Arbeiterprozess geladen und installiert dort das Startprotokoll) und am
//      `globalTeardown` der Konfiguration, der nach dem Lauf die Bilanz druckt.
//
//   2. Die erste Fassung zählte jeden roten Fall als „gefahren". Ein Fehler BEIM BROWSERSTART
//      erzeugt aber genau solche roten Fälle — drei Startfehler hätten „alle drei Engines" ergeben,
//      also exakt die Fehlerklasse, um die es hier geht (R-1219: „startet gar kein Browser"). Jetzt
//      gilt eine Engine NUR dann als gestartet, wenn `browserType.launch()` wirklich einen Browser
//      zurückgegeben hat; seine Version steht als Nachweis daneben. Ein fehlgeschlagener Start wird
//      als STARTFEHLER mit Meldung geführt und ist nie ein Fahrnachweis.
//
// WAS DIESER BERICHT NICHT SAGT: ob die Fälle in einer Engine bestanden haben. Das steht im nativen
// Bericht des Laufs (je Projekt). Hier steht nur, welche Browser nachweislich gestartet sind und
// welche Starts scheiterten. Er verdrahtet das Tor auch NICHT auf drei Engines; die Sperre aus
// Auflage 2 (K7 in `tests/smoke/job1094-engine-kette.test.ts`) bleibt unberührt.
//
// BEWUSST OHNE IMPORT AUS `@playwright/test`: der Vitest-Wächter dieser Datei würde sonst über den
// Importgraphen (`tests/tor-inventar/browser-gruppe.ts`) in die serielle Browsergruppe gezogen,
// obwohl er keinen Browser startet. Den echten `BrowserType`-Prototyp reicht die Konfiguration herein.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/** Die Engines, die `playwright.smoke.config.ts` anbietet — in Ausgabereihenfolge. */
export const ENGINES = ["chromium", "firefox", "webkit"] as const;

/**
 * Das Laufverzeichnis des Startprotokolls. Der Hauptprozess legt es beim Laden der Konfiguration
 * fest; die Arbeiterprozesse erben die Variable und schreiben in DASSELBE Verzeichnis.
 */
export const ENGINE_LAUF_ENV = "KLARWERK_ENGINE_LAUF_DIR";

export interface StartEintrag {
  engine: string;
  /** `true` nur, wenn `launch()` einen Browser zurückgegeben hat. */
  ok: boolean;
  version?: string;
  fehler?: string;
}

/** Die Teilmenge von Playwrights `BrowserType`, an der das Protokoll ansetzt. */
export interface StartfaehigerTyp {
  launch(...args: unknown[]): Promise<unknown>;
  name(): string;
}

const MARKE = "__klarwerkStartprotokoll";

function ersteZeile(fehler: unknown): string {
  const text = fehler instanceof Error ? fehler.message : String(fehler);
  return (text.split("\n")[0] ?? "").trim().slice(0, 300);
}

/**
 * Hängt das Startprotokoll an `launch()`. Ein erfolgreicher Start schreibt Engine und Version, ein
 * gescheiterter Engine und Meldung — der Fehler wird danach UNVERÄNDERT weitergeworfen, das
 * Protokoll greift nie in den Lauf ein. Mehrfaches Installieren (die Konfiguration wird in jedem
 * Prozess geladen) bleibt wirkungslos.
 */
export function installiereStartprotokoll(
  prototyp: StartfaehigerTyp,
  schreibe: (eintrag: StartEintrag) => void,
): boolean {
  const markiert = prototyp as StartfaehigerTyp & { [MARKE]?: boolean };
  if (markiert[MARKE] === true) {
    return false;
  }
  const original = prototyp.launch;
  prototyp.launch = async function (this: StartfaehigerTyp, ...args: unknown[]): Promise<unknown> {
    const engine = this.name();
    let browser: unknown;
    try {
      browser = await original.apply(this, args);
    } catch (fehler) {
      schreibe({ engine, ok: false, fehler: ersteZeile(fehler) });
      throw fehler;
    }
    const version = (browser as { version?: () => unknown } | null)?.version;
    schreibe({
      engine,
      ok: true,
      ...(typeof version === "function" ? { version: String(version.call(browser)) } : {}),
    });
    return browser;
  };
  markiert[MARKE] = true;
  return true;
}

/** Ein Eintrag je Zeile, eine Datei je Prozess — gleichzeitige Arbeiter schreiben nie in dieselbe. */
export function schreibeStarteintrag(verzeichnis: string, eintrag: StartEintrag): void {
  mkdirSync(verzeichnis, { recursive: true });
  appendFileSync(join(verzeichnis, `starts-${process.pid}.jsonl`), `${JSON.stringify(eintrag)}\n`);
}

export function leseStartprotokoll(verzeichnis: string): StartEintrag[] {
  if (!existsSync(verzeichnis)) {
    return [];
  }
  const eintraege: StartEintrag[] = [];
  for (const datei of readdirSync(verzeichnis).sort()) {
    if (!datei.endsWith(".jsonl")) {
      continue;
    }
    for (const zeile of readFileSync(join(verzeichnis, datei), "utf8").split("\n")) {
      if (zeile.trim().length > 0) {
        eintraege.push(JSON.parse(zeile) as StartEintrag);
      }
    }
  }
  return eintraege;
}

export interface EngineStartZeile {
  engine: string;
  /** Nachgewiesene Starts: `launch()` hat einen Browser zurückgegeben. */
  starts: number;
  versionen: string[];
  /** Meldungen gescheiterter Starts. */
  startfehler: string[];
}

export interface StartBilanz {
  /** Engines mit mindestens einem NACHGEWIESENEN Browserstart. */
  gestartet: EngineStartZeile[];
  /** Engines, deren Startversuche ALLE scheiterten — ausdrücklich kein Fahrnachweis. */
  nurStartfehler: EngineStartZeile[];
  /** Angebotene Engines ohne einen einzigen Startversuch in diesem Lauf. */
  nichtVersucht: string[];
}

export function startBilanz(eintraege: readonly StartEintrag[]): StartBilanz {
  const zeilen = new Map<string, EngineStartZeile>();
  for (const eintrag of eintraege) {
    const zeile = zeilen.get(eintrag.engine) ?? {
      engine: eintrag.engine,
      starts: 0,
      versionen: [],
      startfehler: [],
    };
    if (eintrag.ok) {
      zeile.starts += 1;
      if (eintrag.version !== undefined && !zeile.versionen.includes(eintrag.version)) {
        zeile.versionen.push(eintrag.version);
      }
    } else {
      zeile.startfehler.push(eintrag.fehler ?? "(ohne Meldung)");
    }
    zeilen.set(eintrag.engine, zeile);
  }
  const bekannt: readonly string[] = ENGINES;
  const fremde = [...zeilen.keys()].filter((e) => !bekannt.includes(e)).sort();
  const vorhanden = [...bekannt, ...fremde].flatMap((e) => zeilen.get(e) ?? []);
  return {
    gestartet: vorhanden.filter((z) => z.starts > 0),
    nurStartfehler: vorhanden.filter((z) => z.starts === 0),
    nichtVersucht: bekannt.filter((e) => !zeilen.has(e)),
  };
}

export function startBerichtText(bilanz: StartBilanz): string {
  const liste = (werte: readonly string[]): string => {
    return werte.length > 0 ? werte.join("; ") : "—";
  };
  const gestartet = (z: EngineStartZeile): string => {
    const version = z.versionen.length > 0 ? ` ${z.versionen.join("/")}` : "";
    return `${z.engine}${version} (${z.starts} Start${z.starts === 1 ? "" : "s"})`;
  };
  const fehlerAlle = [...bilanz.gestartet, ...bilanz.nurStartfehler].flatMap((z) =>
    z.startfehler.map((meldung) => `${z.engine}: ${meldung}`),
  );
  const alleDrei = ENGINES.every((e) => bilanz.gestartet.some((z) => z.engine === e));
  return [
    "▶ Engine-Bericht dieses Laufs (aus dem Startprotokoll, nicht aus der Konfiguration)",
    `  Browser gestartet:    ${liste(bilanz.gestartet.map(gestartet))}`,
    `  nur Startfehler:      ${liste(bilanz.nurStartfehler.map((z) => z.engine))}`,
    `  Startfehler:          ${liste(fehlerAlle)}`,
    `  nicht versucht:       ${liste(bilanz.nichtVersucht)}`,
    alleDrei
      ? "  ⓘ Alle drei Engines (Chromium, Firefox, WebKit) wurden in diesem Lauf gestartet."
      : "  ⓘ Dieser Lauf belegt NICHT alle drei Engines; ein Startfehler ist kein Fahrnachweis.",
    "  ⓘ Bestanden/rot je Engine steht im nativen Bericht des Laufs (je Projekt).",
  ].join("\n");
}

/**
 * `globalTeardown` der Smoke-Konfiguration: liest das Startprotokoll dieses Laufs, druckt die
 * Bilanz und legt sie als `engine-bericht.txt` neben das Protokoll.
 */
export default async function engineBerichtNachLauf(): Promise<void> {
  const verzeichnis = process.env[ENGINE_LAUF_ENV];
  const text = startBerichtText(startBilanz(verzeichnis ? leseStartprotokoll(verzeichnis) : []));
  console.log(`\n${text}\n`);
  if (verzeichnis) {
    mkdirSync(verzeichnis, { recursive: true });
    writeFileSync(join(verzeichnis, "engine-bericht.txt"), `${text}\n`);
  }
}
