// AUFTRAG-mega25 Block B — DER MENGEN-PIN AUF DIE AUSNAHME DES TORS.
//
// DER BEFUND (ben, sammel24): heute ist die Ausnahme tatsächlich genau ein Test. Die BEHAUPTUNG, sie
// könne nicht still wachsen, stimmte trotzdem nicht: `--grep-invert @modell` ist ein TAG-Filter ohne
// Kardinalität. Jeder später hinzugefügte Test mit `@modell` wäre automatisch mit ausgeschlossen
// worden, während `tools/check` weiter „genau der eine benannte Kernfluss" gedruckt hätte. bens Satz
// dazu: „Das Tor bliebe grün und die Meldung würde lügen." Das ist dieselbe Gestalt, die wir seit
// sammel21 dem Produkt austreiben — eine Zusage ohne Deckung.
//
// DER GEWÄHLTE WEG (bens zweiter): ein VORGESCHALTETER Test, der genau einen `@modell`-Test mit dem
// erwarteten vollständigen Titel erlaubt und jede Abweichung rot macht.
//
// WARUM NICHT bens erster Weg (Spec-/Projekt-Trennung): eine eigene Datei bzw. ein eigenes Projekt
// VERSCHIEBT die Grenze, PINNT aber die Menge nicht. Ein zweiter modellabhängiger Test in der
// ausgenommenen Datei wäre weiterhin still mit ausgeschlossen, und die Meldung „genau einer" wäre
// weiterhin ungedeckt. Der Fehler ist nicht, WO die Grenze liegt, sondern dass niemand ihre GRÖSSE
// prüft. Genau das tut dieser Test — an der Zahl UND am vollständigen Titel.
//
// WARUM ER HIER (Vitest) LIEGT UND NICHT IN DER SMOKE-SUITE: er ist in `tools/check` dem Smoke-Lauf
// VORgelagert (Schritt „test" vor Schritt „ui-smoke"), braucht weder Browser noch Server und kostet
// zwei `--list`-Aufrufe (~1,5 s). Eine Playwright-Sonde könnte die Titel ihrer Geschwister nicht
// aufzählen.
//
// WARUM ER PLAYWRIGHT SELBST FRAGT STATT DEN QUELLTEXT ZU GREPPEN: `--list` wertet DIE ECHTE
// Konfiguration und DIE ECHTE Filtersemantik aus. Ein Regex über die Spec-Dateien wäre eine zweite,
// eigene Wahrheit — und die könnte von der des Tors abweichen, ohne dass es auffällt.
//
// WARUM ER DIE ARGUMENTE AUS `package.json` LIEST STATT SIE NOCHMAL HINZUSCHREIBEN: der Pin prüft,
// was das Tor TATSÄCHLICH ausführt. Schriebe er `--grep-invert @modell` selbst hin, prüfte er seine
// eigene Annahme; ändert jemand den Skript-Eintrag, muss der Pin das sehen, nicht überlesen.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

/** Die EINE zugelassene Ausnahme — Datei und vollständiger Titel, exakt wie das Tor sie meldet. */
const ERLAUBTE_AUSNAHME = {
  file: "ui-smoke.spec.ts",
  title: "Kernfluss: Erzählen → Wissensseite → Einreichen @modell",
} as const;

/** Das npm-Skript, dessen Aufrufzeile das Tor in `tools/check` fährt. */
const GATE_SCRIPT = "smoke:ui:gate";

interface ListedSpec {
  file?: string;
  title?: string;
  tags?: string[];
  tests?: { projectName?: string }[];
}
interface ListedSuite {
  specs?: ListedSpec[];
  suites?: ListedSuite[];
}

interface Fall {
  file: string;
  title: string;
  tags: string[];
  projects: string[];
}

function flatten(suites: readonly ListedSuite[]): Fall[] {
  const out: Fall[] = [];
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      out.push({
        file: spec.file ?? "",
        title: spec.title ?? "",
        tags: spec.tags ?? [],
        projects: (spec.tests ?? []).map((t) => t.projectName ?? ""),
      });
    }
    out.push(...flatten(suite.suites ?? []));
  }
  return out;
}

/**
 * Die Aufrufzeile des Tors zerlegen: führende ENV-Zuweisungen, dann `playwright test <args…>`.
 *
 * AUFTRAG-mega38 BLOCK C: seit dem Frische-Wächter besteht `smoke:ui:gate` aus einer &&-Kette
 * (`npm run --silent smoke:ui:frisch && KLARWERK_SMOKE_MODE=gate … playwright test …`). Dieser Pin
 * zählt die Playwright-Fälle des Tors — für ihn ist NUR das letzte Kettenglied die Aufrufzeile.
 * Die vorgeschalteten Glieder sind Vorbedingungen, keine Testauswahl; sie können den Fall-Satz
 * nicht verändern. Bewusst das LETZTE Glied und nicht „irgendeines, das playwright enthält":
 * so bleibt der Fehler laut, wenn jemand den Playwright-Aufruf hinter etwas anderes hängt.
 */
function parseGateScript(script: string): { env: Record<string, string>; args: string[] } {
  const glieder = script.split("&&");
  const tokens = (glieder[glieder.length - 1] ?? "").trim().split(/\s+/);
  const env: Record<string, string> = {};
  let i = 0;
  for (; i < tokens.length; i++) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(tokens[i] ?? "");
    if (!match) break;
    env[match[1] as string] = match[2] as string;
  }
  const rest = tokens.slice(i);
  if (rest[0] !== "playwright" || rest[1] !== "test") {
    throw new Error(
      `package.json → scripts["${GATE_SCRIPT}"] ist nicht mehr „…playwright test …": ${script}`,
    );
  }
  return { env, args: rest.slice(2) };
}

function list(args: readonly string[], env: Record<string, string>): Fall[] {
  const raw = execFileSync("npx", ["playwright", "test", ...args, "--list", "--reporter=json"], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
  });
  return flatten((JSON.parse(raw) as { suites?: ListedSuite[] }).suites ?? []);
}

/** Ein Fall ist durch Datei + Titel eindeutig; das Projekt (die Engine) ist hier nicht die Frage. */
const schluessel = (f: Fall) => `${f.file} › ${f.title}`;
const ERWARTET = `${ERLAUBTE_AUSNAHME.file} › ${ERLAUBTE_AUSNAHME.title}`;

describe("Tor-Ausnahme (AUFTRAG-mega25 Block B)", () => {
  let alle: Fall[] = [];
  let ausgenommen: Fall[] = [];

  beforeAll(() => {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { scripts?: Record<string, string> };
    const gateScript = pkg.scripts?.[GATE_SCRIPT];
    if (!gateScript) {
      throw new Error(`package.json → scripts["${GATE_SCRIPT}"] fehlt.`);
    }
    const gate = parseGateScript(gateScript);

    const configIdx = gate.args.indexOf("--config");
    const configInline = gate.args.find((a) => a.startsWith("--config="));
    const configArgs =
      configIdx >= 0 && gate.args[configIdx + 1]
        ? ["--config", gate.args[configIdx + 1] as string]
        : configInline
          ? [configInline]
          : undefined;
    if (!configArgs) {
      throw new Error(
        `scripts["${GATE_SCRIPT}"] nennt keine --config — der Pin wüsste nicht, was er zählt.`,
      );
    }

    // Beide Aufzählungen laufen im Tor-Modus. `--list` startet zwar keinen Webserver, aber die
    // Konfiguration verlangt im VOLLEN Modus ein Zugangsdatum (Block C) — und das darf ein reiner
    // Zähl-Lauf nicht brauchen.
    const gateEnv = { KLARWERK_SMOKE_MODE: "gate", ...gate.env };

    // Was das Tor tatsächlich fährt (mit allen seinen Filtern) …
    const imTor = new Set(list([...gate.args], gateEnv).map(schluessel));
    // … gegen die vollständige Suite unter derselben Konfiguration, auf die Engine des Tors begrenzt.
    const projektArg = gate.args.find((a) => a.startsWith("--project"));
    alle = list([...configArgs, ...(projektArg ? [projektArg] : [])], gateEnv);

    // Der Setup-Lauf ist Vorbedingung, kein Prüffall: er hängt als `dependencies` an jeder Engine und
    // steht in BEIDEN Aufzählungen. Ausgenommen ist er damit nie.
    ausgenommen = alle
      .filter((f) => !f.projects.includes("setup"))
      .filter((f) => !imTor.has(schluessel(f)));
  });

  it('nimmt GENAU EINEN Test aus — nicht „alle mit dieser Marke"', () => {
    // DIE Bedingung dieser Runde: ein zweiter @modell-Test macht das Tor ROT, statt still
    // mitausgeschlossen zu werden. Diese Zusicherung ist die Stelle, an der er rot wird.
    expect(
      ausgenommen.map(schluessel).sort(),
      "Das Tor darf GENAU EINEN Test auslassen. Weicht diese Liste ab, lügt die Meldung in tools/check.",
    ).toEqual([ERWARTET]);
  });

  it("nimmt genau den benannten Kernfluss aus, mit vollständigem Titel", () => {
    expect(ausgenommen[0]?.file).toBe(ERLAUBTE_AUSNAHME.file);
    expect(ausgenommen[0]?.title).toBe(ERLAUBTE_AUSNAHME.title);
  });

  it("kennt suiteweit nur diesen einen @modell-Fall", () => {
    // Zweite, unabhängige Achse: nicht „was der Filter auslässt", sondern „was die Marke trägt". Ein
    // @modell-Test, den der Filter aus Versehen NICHT ausschlösse, fiele oben durch; einer, der die
    // Marke trägt und irgendwo neu auftaucht, fällt hier durch.
    const markiert = [...new Set(alle.filter((f) => f.tags.includes("modell")).map(schluessel))];
    expect(markiert).toEqual([ERWARTET]);
  });
});
