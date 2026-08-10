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

/**
 * Die zugelassenen Ausnahmen — Datei und vollständiger Titel, exakt wie das Tor sie meldet.
 *
 * AUFTRAG-mega52 — DIE ZWEITE AUSNAHME, UND WARUM SIE KEINE AUFWEICHUNG IST.
 *
 * Bis mega51 stand hier genau ein Eintrag, und die Zusicherung unten lautete „GENAU EINEN". Dieser
 * Wächter hat in mega52 exakt das getan, wofür mega25 ihn gebaut hat: er ist rot geworden, als ein
 * zweiter Fall die Marke bekam, statt ihn still mitauszuschließen. Die Erweiterung ist deshalb eine
 * SICHTBARE Entscheidung, keine Umgehung — und sie steht hier mit ihrem Grund.
 *
 * DER GRUND. Der Fragen-Fall belegte bis mega52 nichts: in der Playwright-Spur des Tor-Laufs gibt es
 * keinen einzigen `/api/ask`-Aufruf. Er war grün, weil `getByText("Aus validiertem Wissen")` per
 * Vorgabe teilzeichenketten- und schreibweisen-unabhängig matcht und sich damit im STATISCHEN
 * Einleitungstext der Seite selbst traf. Einlösen konnte er sein Versprechen im Tor auch im Prinzip
 * nicht: ohne Modell ist der Fragen-Knopf HART gesperrt (D-AISTATE PAKET 1) — dieselbe Lage, die den
 * Erfassungs-Kernfluss schon seit mega25 zu einem @modell-Fall macht. Es ist also nicht eine zweite
 * Ausnahme HINZUGEKOMMEN; es war immer schon dieselbe Lage, nur unbemerkt.
 *
 * Was im Tor nachweisbar ist, prüft der Fall „Fragen ohne Modell: der Weg ist gesperrt und sagt
 * warum" — er läuft im Tor mit und ist keine Ausnahme.
 */
const ERLAUBTE_AUSNAHMEN = [
  {
    file: "ui-smoke.spec.ts",
    title: "Kernfluss: Erzählen → Wissensseite → Einreichen @modell",
  },
  {
    file: "ui-smoke.spec.ts",
    title: "Fragen antwortet ehrlich (Antwort oder Wissenslücke, nie erfunden) @modell",
  },
] as const;

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
const ERWARTET = ERLAUBTE_AUSNAHMEN.map((a) => `${a.file} › ${a.title}`).sort();

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
    // … gegen die vollständige Suite unter derselben Konfiguration, auf die Projekte des Tors
    // begrenzt.
    //
    // AUFTRAG-163 — HIER STAND `find` STATT `filter`, UND DAS WAR EINE STILLE LÜCKE.
    // Seit das Tor ZWEI Projekte fährt (`--project=chromium --project=chromium-zustand`, der
    // isolierte Kontext des Demo-Kernwegs), hätte `find` nur das erste genommen: `imTor` kannte dann
    // beide Projekte, `alle` nur eines. Die Differenz wäre weiterhin berechenbar gewesen — der Pin
    // hätte das zweite Projekt aber schlicht nicht mehr abgedeckt und das nirgends gesagt. Genau
    // diese Sorte lautloser Schwächung ist der Grund, aus dem es diesen Pin überhaupt gibt
    // (mega25 Block B). `filter` nimmt alle konfigurierten Projektargumente.
    const projektArgs = gate.args.filter((a) => a.startsWith("--project"));
    alle = list([...configArgs, ...projektArgs], gateEnv);

    // Der Setup-Lauf ist Vorbedingung, kein Prüffall: er hängt als `dependencies` an jeder Engine und
    // steht in BEIDEN Aufzählungen. Ausgenommen ist er damit nie.
    //
    // AUFTRAG-163: seit dem isolierten Kontext gibt es ein ZWEITES Setup (`setup-zustand`) — der
    // zweite Server hat einen eigenen, jungfräulichen Bestand und braucht seine eigene
    // Ersteinrichtung. Der Filter fragt deshalb nach dem PRÄFIX statt nach dem exakten Namen; sonst
    // stünde die Ersteinrichtung des zweiten Kontexts plötzlich in der Ausnahmeliste und der Pin
    // meldete eine Abweichung, die keine ist.
    ausgenommen = alle
      .filter((f) => !f.projects.some((p) => p.startsWith("setup")))
      .filter((f) => !imTor.has(schluessel(f)));
  });

  it('nimmt GENAU die benannten Tests aus — nicht „alle mit dieser Marke"', () => {
    // DIE Bedingung: ein WEITERER @modell-Test macht das Tor ROT, statt still mitausgeschlossen zu
    // werden. Diese Zusicherung ist die Stelle, an der er rot wird — in mega52 ist genau das
    // passiert, und die Liste oben ist daraufhin BEGRÜNDET gewachsen, nicht stillschweigend.
    expect(
      ausgenommen.map(schluessel).sort(),
      "Das Tor darf NUR die oben benannten Tests auslassen. Weicht diese Liste ab, lügt die " +
        "Meldung in tools/check über den Umfang des Laufs.",
    ).toEqual(ERWARTET);
  });

  it("nimmt genau die benannten Fälle aus, mit vollständigem Titel", () => {
    for (const erlaubt of ERLAUBTE_AUSNAHMEN) {
      expect(
        ausgenommen.some((f) => f.file === erlaubt.file && f.title === erlaubt.title),
        `Ausnahme nicht gefunden: ${erlaubt.file} › ${erlaubt.title}`,
      ).toBe(true);
    }
    expect(ausgenommen).toHaveLength(ERLAUBTE_AUSNAHMEN.length);
  });

  it("kennt suiteweit nur die benannten @modell-Faelle", () => {
    // Zweite, unabhängige Achse: nicht „was der Filter auslässt", sondern „was die Marke trägt". Ein
    // @modell-Test, den der Filter aus Versehen NICHT ausschlösse, fiele oben durch; einer, der die
    // Marke trägt und irgendwo neu auftaucht, fällt hier durch.
    const markiert = [
      ...new Set(alle.filter((f) => f.tags.includes("modell")).map(schluessel)),
    ].sort();
    expect(markiert).toEqual(ERWARTET);
  });
});
