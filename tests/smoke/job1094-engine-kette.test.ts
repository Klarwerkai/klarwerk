// ================================================================================================
// JOB 1094 · D2 — DER WÄCHTER ÜBER DIE EFFEKTIVE ENGINEMENGE
// ================================================================================================
//
// KORREKTURPFLICHT 5 des Vollurteils (`BEN4-PRUEFUNG-JOB-1094-D1.md:49`): „Den Wächter von
// `tools/check` über das aufgerufene npm-Skript bis zur effektiven Playwright-Projekt- und
// Enginemenge führen. Entfernen von WebKit beziehungsweise Firefox bei unveränderter Prosa muss
// gezielt rot werden."
//
// UND PRÜFLÜCKE 6, die die Bauart vorschreibt: „Der Wächter muss die tatsächlich ausgeführte Kette
// `tools/check` → npm-Skript → Playwright-Projekte auflösen; **eine bloße Suche nach Engine- oder
// Skriptnamen genügt nicht.**"
//
// Deshalb greppt diese Datei nirgends nach „firefox" oder „smoke:ui". Sie LÖST AUF, in vier
// Schritten, jeder für sich prüfbar:
//
//   1. `tools/check`            → ausführbare Shellkommandos (Kommentare und reine Ausgaben raus)
//   2. das darin gerufene       → `package.json` → scripts[<name>]
//      npm-Skript
//   3. die `&&`-Kette           → letztes Glied → `playwright test <args>`
//   4. `--config` + `--project` → `playwright.smoke.config.ts` → Projekt→Engine
//
// Erst am Ende dieser Kette steht eine Enginemenge. `K6` beweist, dass die Auflösung wirklich
// auflöst: ein Skriptname, der NUR in einem Kommentar und in einer Echo-Zeile steht, darf nicht
// gefunden werden.
//
// ================================================================================================
// WAS DIESE DATEI AUSDRÜCKLICH NICHT TUT — UND WARUM DAS DIE WICHTIGSTE ZEILE HIER IST.
// ================================================================================================
// Auflage 2 lautet: „Stufe A netzfrei auf einem vorprovisionierten Runner ausführen … **Bei
// irgendeinem roten Enginefall keine Torverdrahtung bauen.**"
//
// Stufe A ist in dieser Bahn gemessen worden, je Engine getrennt (Rohprotokoll
// `/private/tmp/kw-pro-job1094-d2-arbeit/stufe-a-machbarkeit.txt`): alle drei Browser sind
// installiert, aber **Chromium startet nicht** („Target page, context or browser has been closed")
// und **WebKit läuft in ein 180-s-Zeitlimit**; nur Firefox startet. Zwei von drei Engines sind rot,
// bevor überhaupt ein Server läuft.
//
// Damit ist die Bedingung aus Auflage 2 NICHT erfüllt, und die Torverdrahtung unterbleibt — obwohl
// sie ein Einzeiler wäre: `smoke:ui:gate:drei` existiert bereits fertig in `package.json` und
// `tools/check` ist geleast. Genau deshalb steht `K7` in dieser Datei: er hält fest, dass das Tor
// weiterhin einengig fährt. Würde jemand die Verdrahtung stillschweigend nachziehen, würde er rot —
// und dann ist es eine Entscheidung nach grüner Stufe A und kein Nebeneffekt dieses Durchgangs.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lies = (pfad: string): string => readFileSync(pfad, "utf8");

// ------------------------------------------------------------------------------------------------
// SCHRITT 1 — aus einem Shellskript die TATSÄCHLICH AUSGEFÜHRTEN Kommandos gewinnen
// ------------------------------------------------------------------------------------------------

/**
 * Zerlegt ein Shellskript in seine ausführbaren Kommandos.
 *
 * Fail-closed gegen die drei Quellen einer Rohtext-Falschzuordnung:
 *   · Kommentarzeilen (`# …`) tragen keine Wahrheit — `tools/check` besteht zu zwei Dritteln daraus;
 *   · reine `echo`-Ausgaben nennen Skriptnamen als HINWEIS an den Menschen (Zeile 68/69/77 nennen
 *     `npm run smoke:ui`, ohne es auszuführen);
 *   · ein abschliessender Kommentar hinter einem echten Kommando wird abgeschnitten, nicht mitgelesen.
 *
 * Mehrgliedrige Zeilen (`a && b`, `a || b`) werden aufgetrennt: jedes Glied ist ein eigenes Kommando.
 */
function ausfuehrbareKommandos(shell: string): string[] {
  const out: string[] = [];
  for (const rohzeile of shell.split("\n")) {
    const zeile = rohzeile.trim();
    if (zeile.length === 0 || zeile.startsWith("#")) {
      continue;
    }
    // Ein `#` NACH einem Kommando beginnt einen Endkommentar — aber nur ausserhalb von
    // Anführungszeichen (`echo "… # …"` wäre sonst falsch beschnitten).
    let ohneKommentar = "";
    let inEinfach = false;
    let inDoppelt = false;
    for (let i = 0; i < zeile.length; i++) {
      const z = zeile.charAt(i);
      if (z === "'" && !inDoppelt) {
        inEinfach = !inEinfach;
      } else if (z === '"' && !inEinfach) {
        inDoppelt = !inDoppelt;
      } else if (z === "#" && !inEinfach && !inDoppelt) {
        break;
      }
      ohneKommentar += z;
    }
    for (const glied of ohneKommentar.split(/&&|\|\||;/)) {
      // Führende Shell-Schlüsselwörter und Gruppenklammern gehören zur STEUERUNG, nicht zum
      // Kommando. `paul-runner.sh:56` lautet `if npm run smoke:ui; then` — ohne diese Zeile hielte
      // der Zerleger das für kein npm-Kommando und die Ship-Kette bräche stumm ab. (Genau daran ist
      // der erste Lauf dieses Wächters rot geworden; die Lücke ist gemessen, nicht vermutet.)
      const befehl = glied
        .trim()
        .replace(/^\{\s*/, "")
        .replace(/^(?:if|then|elif|else|while|until|do|done|fi|!)\s+/, "")
        .trim();
      if (befehl.length === 0) {
        continue;
      }
      // Eine reine Ausgabe führt nichts aus. `echo "… npm run x …"` nennt einen Namen, ruft ihn nicht.
      if (/^echo(\s|$)/.test(befehl)) {
        continue;
      }
      out.push(befehl);
    }
  }
  return out;
}

/** Der Name des npm-Skripts, das diese Kommandofolge WIRKLICH aufruft (erstes Vorkommen). */
function gerufenesNpmSkript(kommandos: readonly string[]): string | undefined {
  for (const befehl of kommandos) {
    const treffer = /^npm\s+run\s+((?:--\S+\s+)*)(\S+)/.exec(befehl);
    if (treffer) {
      return treffer[2];
    }
  }
  return undefined;
}

// ------------------------------------------------------------------------------------------------
// SCHRITT 2/3 — npm-Skript → Playwright-Aufruf
// ------------------------------------------------------------------------------------------------

/**
 * Zerlegt eine npm-Skriptzeile in ihren Playwright-Aufruf.
 *
 * Wie in `tests/smoke/tor-ausnahme.test.ts:105-113` zählt AUSSCHLIESSLICH das letzte `&&`-Glied:
 * die vorgeschalteten Glieder (Frische-Wächter) sind Vorbedingungen und können die Projektmenge
 * nicht verändern. Bewusst das LETZTE und nicht „irgendeines mit playwright" — sonst bliebe es
 * still, wenn jemand den Aufruf hinter etwas anderes hängt.
 */
function playwrightArgumente(skriptzeile: string): string[] {
  const glieder = skriptzeile.split("&&");
  const tokens = (glieder[glieder.length - 1] ?? "").trim().split(/\s+/);
  let i = 0;
  for (; i < tokens.length; i++) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i] ?? "")) {
      break;
    }
  }
  const rest = tokens.slice(i);
  if (rest[0] !== "playwright" || rest[1] !== "test") {
    throw new Error(`kein „playwright test" am Ende der Kette: ${skriptzeile}`);
  }
  return rest.slice(2);
}

/** Die ausdrücklich gewählten Projekte — oder `null`, wenn keines genannt ist (= alle). */
function gewaehlteProjekte(args: readonly string[]): string[] | null {
  const namen: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg.startsWith("--project=")) {
      namen.push(arg.slice("--project=".length));
    } else if (arg === "--project" && args[i + 1]) {
      namen.push(args[i + 1] as string);
      i++;
    }
  }
  return namen.length > 0 ? namen : null;
}

/** Der `--config`-Pfad des Aufrufs. */
function konfigPfad(args: readonly string[]): string {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg.startsWith("--config=")) {
      return arg.slice("--config=".length);
    }
    if (arg === "--config" && args[i + 1]) {
      return args[i + 1] as string;
    }
  }
  throw new Error(`kein --config im Aufruf: ${args.join(" ")}`);
}

// ------------------------------------------------------------------------------------------------
// SCHRITT 4 — Konfiguration → Projekt/Engine
// ------------------------------------------------------------------------------------------------

/** Playwrights Gerätenamen → die Engine, die dahintersteht. */
const GERAET_ZU_ENGINE: Record<string, string> = {
  "Desktop Chrome": "chromium",
  "Desktop Firefox": "firefox",
  "Desktop Safari": "webkit",
};

interface Projekt {
  name: string;
  engine: string;
}

/**
 * Liest die Projektliste aus der Playwright-Konfiguration: je `name:` das nächstgelegene
 * `devices["…"]`. Ein Projekt ohne auflösbares Gerät wird EHRLICH als `"unbekannt"` geführt statt
 * stillschweigend weggelassen — eine unvollständige Liste wäre hier die gefährlichere Antwort.
 */
function projekteAusKonfig(konfig: string): Projekt[] {
  const teile = konfig.split(/name:\s*"/).slice(1);
  const out: Projekt[] = [];
  for (const teil of teile) {
    const name = teil.slice(0, teil.indexOf('"'));
    const geraet = /devices\["([^"]+)"\]/.exec(teil);
    out.push({ name, engine: (geraet && GERAET_ZU_ENGINE[geraet[1] as string]) ?? "unbekannt" });
  }
  return out;
}

/** Die effektive Enginemenge eines Aufrufs — sortiert, ohne das Setup-Vorspiel. */
function effektiveEngines(projekte: readonly Projekt[], gewaehlt: string[] | null): string[] {
  const wirksam = projekte
    .filter((p) => !p.name.startsWith("setup"))
    .filter((p) => gewaehlt === null || gewaehlt.includes(p.name));
  return [...new Set(wirksam.map((p) => p.engine))].sort();
}

// ------------------------------------------------------------------------------------------------
// DIE KETTE, EINMAL AUFGELÖST
// ------------------------------------------------------------------------------------------------

const PKG = JSON.parse(lies("package.json")) as { scripts?: Record<string, string> };
const KONFIG_DATEI = "playwright.smoke.config.ts";
const KONFIG_TEXT = lies(KONFIG_DATEI);
const PROJEKTE = projekteAusKonfig(KONFIG_TEXT);

/** Löst einen Skriptnamen bis zur Enginemenge auf. */
function engineMengeVon(skript: string): string[] {
  const zeile = PKG.scripts?.[skript];
  if (!zeile) {
    throw new Error(`package.json → scripts["${skript}"] fehlt`);
  }
  const args = playwrightArgumente(zeile);
  // Das Skript muss GENAU die Konfiguration nennen, die oben eingelesen wurde. Ohne diese Prüfung
  // löste der Wächter gegen eine Datei auf, die der Aufruf gar nicht verwendet — die Enginemenge
  // wäre dann ein Ergebnis über den falschen Gegenstand.
  const genannt = konfigPfad(args);
  if (genannt !== KONFIG_DATEI) {
    throw new Error(
      `scripts["${skript}"] nennt --config ${genannt}, gelesen wurde ${KONFIG_DATEI}`,
    );
  }
  return effektiveEngines(PROJEKTE, gewaehlteProjekte(args));
}

const TOR_KOMMANDOS = ausfuehrbareKommandos(lies("tools/check"));
const TOR_SKRIPT = gerufenesNpmSkript(TOR_KOMMANDOS);
const SHIP_KOMMANDOS = ausfuehrbareKommandos(lies("scripts/deploy/klarwerk-ship.command"));

const ALLE_ENGINES = ["chromium", "firefox", "webkit"];

// ------------------------------------------------------------------------------------------------
describe("JOB1094 D2 · K — die Kette von tools/check bis zur Engine", () => {
  it("K1: das Tor ruft genau EIN npm-Skript, und die Auflösung findet es", () => {
    expect(TOR_SKRIPT, "kein npm-Skript in den Kommandos von tools/check").toBe("smoke:ui:gate");
    // Die Auflösung darf nicht an einer Erwähnung hängen: das Kommando muss wirklich dastehen.
    expect(TOR_KOMMANDOS.some((b) => b.includes("smoke:ui:gate"))).toBe(true);
  });

  it("K2: die Konfiguration bietet genau drei Engines an — der Vorrat, aus dem gewählt wird", () => {
    const angeboten = [
      ...new Set(PROJEKTE.filter((p) => !p.name.startsWith("setup")).map((p) => p.engine)),
    ].sort();
    expect(angeboten).toEqual(ALLE_ENGINES);
    // Kein Projekt darf unauflösbar sein — sonst zählte die Menge unten zu wenig.
    expect(PROJEKTE.filter((p) => p.engine === "unbekannt")).toEqual([]);
  });

  it("K3 · DAS TOR: die effektive Enginemenge ist heute {chromium}", () => {
    // Der Ist-Zustand, den A19 als Deckungslücke führt. Er wird hier NICHT zum Soll erklärt — er
    // wird festgehalten, damit eine Änderung in beide Richtungen sichtbar ist (s. K7).
    expect(engineMengeVon(TOR_SKRIPT as string)).toEqual(["chromium"]);
  });

  it("K4 · DER SHIP-WEG: drei Engines, und die Kette dorthin ist wirklich aufgelöst", () => {
    // `klarwerk-ship.command` ruft den Runner; der Runner ruft das Skript. Beide Glieder werden
    // aufgelöst, nicht angenommen — sonst bliebe unbemerkt, wenn jemand den Runner austauscht.
    const runner = SHIP_KOMMANDOS.find((b) => /paul-runner\.sh/.test(b));
    expect(
      runner,
      `klarwerk-ship.command ruft keinen Runner: ${JSON.stringify(SHIP_KOMMANDOS)}`,
    ).toBeDefined();
    const runnerPfad = "docs/team2-austausch/paul-runner.sh";
    const runnerSkript = gerufenesNpmSkript(ausfuehrbareKommandos(lies(runnerPfad)));
    expect(runnerSkript).toBe("smoke:ui");
    expect(engineMengeVon(runnerSkript as string)).toEqual(ALLE_ENGINES);
  });

  it("K5 · PROSA GEGEN WIRKLICHKEIT: jedes als Drei-Engine-Weg benannte Skript ist auch eines", () => {
    // DER EIGENTLICHE WÄCHTER. `tools/check:69` und `:77` sowie `klarwerk-ship.command:33` nennen
    // `npm run smoke:ui` und behaupten dabei „drei Engines". Diese Zusicherung prüft die Behauptung
    // gegen die aufgelöste Wirklichkeit — verschwindet WebKit oder Firefox aus der Konfiguration,
    // während die Prosa unverändert stehen bleibt, wird genau hier rot.
    const prosaQuellen = ["tools/check", "scripts/deploy/klarwerk-ship.command"];
    const benannt = new Set<string>();
    for (const pfad of prosaQuellen) {
      for (const zeile of lies(pfad).split("\n")) {
        if (!/drei\s+Engines/i.test(zeile)) {
          continue;
        }
        const skript = /npm\s+run\s+(?:--\S+\s+)*([A-Za-z0-9:._-]+)/.exec(zeile);
        if (skript?.[1]) {
          benannt.add(skript[1]);
        }
      }
    }
    // Die Prosa muss überhaupt etwas benennen — sonst prüfte diese Zusicherung nichts.
    expect(benannt.size, "keine Drei-Engine-Prosa mit Skriptnamen gefunden").toBeGreaterThan(0);
    for (const skript of benannt) {
      expect(engineMengeVon(skript), `„${skript}" wird als Drei-Engine-Weg benannt`).toEqual(
        ALLE_ENGINES,
      );
    }
  });

  it("K6 · ANTI-VAKUUM: eine blosse NENNUNG in Kommentar oder Ausgabe zählt nicht als Aufruf", () => {
    // Prüflücke 6 wörtlich: „eine bloße Suche nach Engine- oder Skriptnamen genügt nicht". Genau
    // das wird hier gemessen — an einem Text, der den Namen dreimal trägt und ihn null Mal ausführt.
    const attrappe = [
      "#!/usr/bin/env bash",
      "# Alle drei Engines lokal: npm run smoke:ui",
      'echo "  Alle drei Engines lokal: npm run smoke:ui"',
      'echo "▶ ui-smoke"; # npm run smoke:ui:gate',
      "./tools/test",
    ].join("\n");
    const kommandos = ausfuehrbareKommandos(attrappe);
    expect(gerufenesNpmSkript(kommandos), `Attrappe: ${JSON.stringify(kommandos)}`).toBeUndefined();
    expect(kommandos).toEqual(["./tools/test"]);

    // KALIBRIERUNG in die Gegenrichtung: derselbe Zerleger findet den echten Aufruf sehr wohl.
    // Ohne sie wäre der Fall auch dann grün, wenn er grundsätzlich nichts fände.
    expect(
      gerufenesNpmSkript(ausfuehrbareKommandos(`${attrappe}\nnpm run --silent smoke:ui:gate`)),
    ).toBe("smoke:ui:gate");
    // Und in der Form, in der der Runner ihn wirklich schreibt — mit führendem Shell-Schlüsselwort.
    // Diese Zeile steht hier, weil der Wächter an genau ihr beim ersten Lauf gescheitert ist.
    expect(
      gerufenesNpmSkript(ausfuehrbareKommandos("if npm run smoke:ui; then\n  echo ok\nfi")),
    ).toBe("smoke:ui");
  });

  it("K7 · DIE SPERRE AUS AUFLAGE 2: das Tor bleibt einengig, bis Stufe A grün ist", () => {
    // Auflage 2: „Bei irgendeinem roten Enginefall keine Torverdrahtung bauen." Stufe A ist in
    // dieser Bahn rot gemessen (Chromium startet nicht, WebKit läuft ins Zeitlimit) — also bleibt
    // das Tor, wie es ist. Diese Zusicherung ist der SICHTBARE Verzicht: zöge jemand die
    // Verdrahtung nach, ohne Stufe A grün zu messen, wird sie rot.
    //
    // Dass es ein Einzeiler wäre, steht hier ausdrücklich: das Drei-Engine-Skript ist fertig.
    expect(PKG.scripts?.["smoke:ui:gate:drei"], "das Drei-Engine-Torskript fehlt").toBeDefined();
    expect(engineMengeVon("smoke:ui:gate:drei")).toEqual(ALLE_ENGINES);
    // Und niemand ruft es — auch das Tor nicht.
    expect(TOR_SKRIPT).not.toBe("smoke:ui:gate:drei");
    expect(engineMengeVon(TOR_SKRIPT as string)).toEqual(["chromium"]);
  });

  it("K8 · ENGINE-ENTFERNUNG: fällt WebKit oder Firefox weg, schlägt der Wächter an", () => {
    // Das ist die Zusicherung, die Auflage 5 wörtlich verlangt: „Entfernen von WebKit beziehungsweise
    // Firefox bei unveränderter Prosa muss gezielt rot werden."
    //
    // GEMESSEN AM ECHTEN KONFIGURATIONSTEXT, aber IM SPEICHER: `playwright.smoke.config.ts` ist in
    // diesem Durchgang NICHT geleast (s. Rückgabe, Abschnitt BLOCKIERT). Statt die Datei zu ändern,
    // wird ihr eingelesener Text hier um das jeweilige Projekt gekürzt und dieselbe Auflösung darauf
    // angewandt. Das beweist die Kausalität der Kette — es ERSETZT NICHT die byte-exakte
    // Gegenmutation an der echten Datei, die weiterhin aussteht und in der Rückgabe benannt ist.
    for (const weg of ["firefox", "webkit"]) {
      const gekuerzt = KONFIG_TEXT.split(/\{\s*\n\s*name:\s*"/)
        .filter((teil, i) => i === 0 || !teil.startsWith(`${weg}"`))
        .join('{\n      name: "');
      const projekte = projekteAusKonfig(gekuerzt);
      const uebrig = effektiveEngines(projekte, null);
      expect(uebrig, `${weg} liess sich nicht entfernen — die Probe prüft nichts`).not.toContain(
        weg,
      );
      expect(uebrig).toHaveLength(2);
      // Und damit stimmt die Drei-Engine-Prosa nicht mehr: genau hier wird K5 rot.
      expect(uebrig).not.toEqual(ALLE_ENGINES);
    }
  });
});
