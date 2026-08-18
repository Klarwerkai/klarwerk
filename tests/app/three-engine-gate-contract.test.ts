// ================================================================================================
// JOB 1123 · DIE ENGINEKETTE BIS ZUR EFFEKTIVEN PROJEKTMENGE — UND DIE SPERRE, DIE SIE HÄLT
// ================================================================================================
//
// WAS DIESER DURCHGANG VORFAND UND WAS ER DARAUS GEMACHT HAT — in einem Absatz, weil die
// Reihenfolge hier alles ist:
//
// Der Auftrag verlangt, `tools/check` über das npm-Skript bis zur effektiven Chromium-/Firefox-/
// WebKit-Projektmenge zu verfolgen und die Torverdrahtung zu schliessen. Diese Verdrahtung wurde
// gebaut — und dabei wurde `tests/smoke/job1094-engine-kette.test.ts` (K7) rot. K7 ist keine
// Testschwäche, sondern eine ABSICHTLICHE SPERRE aus einem abgenommenen Vorlauf:
//
//     „Auflage 2: Bei irgendeinem roten Enginefall keine Torverdrahtung bauen. … Würde jemand die
//      Verdrahtung stillschweigend nachziehen, würde er rot — und dann ist es eine Entscheidung
//      nach grüner Stufe A und kein Nebeneffekt dieses Durchgangs."
//
// Also wurde Stufe A neu gemessen, netzfrei, je Engine getrennt, auf den vorprovisionierten
// Browsern dieser Bahn (Rohprotokoll: `/private/tmp/kw-basic4-job1123-d1-umbindung-arbeit/`):
//
//     chromium  ROT      116 ms  Target page, context or browser has been closed
//     firefox   ROT     2514 ms  Cannot read properties of undefined (reading '_page')
//     webkit    ROT   60005 ms  Zeitlimit 60000 ms
//
// DREI von drei rot — schlechter als in JOB 1094, wo Firefox noch startete. Die Bedingung der
// Sperre ist damit nicht erfüllt, und die Verdrahtung wurde byte-exakt zurückgenommen.
//
// WAS DIESER WÄCHTER STATTDESSEN LEISTET — und warum das kein Ersatz, sondern der eigentlich
// offene Rest ist: K8 hält ausdrücklich fest, dass es die byte-exakte Gegenmutation an der ECHTEN
// `playwright.smoke.config.ts` noch nicht geben konnte, weil die Datei dort nicht geleast war:
//
//     „Das beweist die Kausalität der Kette — es ERSETZT NICHT die byte-exakte Gegenmutation an
//      der echten Datei, die weiterhin aussteht und in der Rückgabe benannt ist."
//
// In DIESEM Auftrag ist sie geleast. Der Wächter löst die Kette deshalb an den echten Dateien auf
// und wird rot, sobald Firefox oder WebKit dort wirklich verschwinden — nicht nur im Speicher.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(__dirname, "../..");

function lies(relativ: string): string {
  return readFileSync(resolve(WURZEL, relativ), "utf8");
}

// ── Schritt 1 · tools/check: welches npm-Skript ruft das Tor wirklich? ──────────────────────────
// Kommentare und reine Ausgaben tragen keine Wahrheit — `tools/check` nennt `npm run smoke:ui`
// mehrfach als Hinweis an den Menschen, ohne es auszuführen.
function torSkript(): string {
  const zeilen = lies("tools/check")
    .split("\n")
    .map((z) => z.replace(/#.*$/, "").trim())
    .filter((z) => z.length > 0 && !z.startsWith("echo "));
  for (const zeile of zeilen) {
    const treffer = /npm run (?:--silent )?["']?([\w:]+)["']?/.exec(zeile);
    if (treffer?.[1]) {
      return treffer[1];
    }
  }
  throw new Error("tools/check ruft kein npm-Skript aus — die Kette beginnt im Leeren.");
}

// ── Schritt 2 · package.json: das letzte Glied der &&-Kette ist der Playwright-Aufruf ───────────
function playwrightArgumente(skriptname: string): string {
  const paket: unknown = JSON.parse(lies("package.json"));
  const skripte = (paket as { scripts?: Record<string, string> }).scripts ?? {};
  const zeile = skripte[skriptname];
  if (typeof zeile !== "string") {
    throw new Error(`package.json kennt kein Skript "${skriptname}".`);
  }
  return zeile.split("&&").at(-1) ?? "";
}

// ── Schritt 3 · playwright.smoke.config.ts: Engine je Projekt ───────────────────────────────────
const GERAET_ZU_ENGINE: Record<string, string> = {
  "Desktop Chrome": "chromium",
  "Desktop Firefox": "firefox",
  "Desktop Safari": "webkit",
  "Desktop Edge": "chromium",
};

function projekteAusKonfig(text: string): Map<string, string> {
  const block = /name:\s*"([\w-]+)"[\s\S]{0,400}?devices\["([^"]+)"\]/g;
  const zuordnung = new Map<string, string>();
  let m: RegExpExecArray | null = block.exec(text);
  while (m !== null) {
    const projekt = m[1] ?? "";
    const geraet = m[2] ?? "";
    const engine = GERAET_ZU_ENGINE[geraet];
    if (!engine) {
      throw new Error(`Unbekanntes Playwright-Gerät "${geraet}" bei Projekt "${projekt}".`);
    }
    if (!zuordnung.has(projekt)) {
      zuordnung.set(projekt, engine);
    }
    m = block.exec(text);
  }
  return zuordnung;
}

// ── Schritt 4 · die Kette zusammensetzen: effektive Enginemenge eines Skripts ───────────────────
function effektiveEngines(konfigText: string, argumente: string): string[] {
  const projekte = projekteAusKonfig(konfigText);
  const gefiltert = [...argumente.matchAll(/--project=([\w-]+)/g)].map((t) => t[1] ?? "");

  // Ohne `--project` laufen ALLE Projekte; die reinen Setup-Projekte tragen keine eigene Engine-
  // Aussage, sie bereiten nur vor.
  const laufende =
    gefiltert.length > 0 ? gefiltert : [...projekte.keys()].filter((p) => !p.startsWith("setup"));

  const engines = new Set<string>();
  for (const projekt of laufende) {
    const engine = projekte.get(projekt);
    if (!engine) {
      throw new Error(`Projektfilter nennt "${projekt}", das die Konfiguration nicht kennt.`);
    }
    engines.add(engine);
  }
  return [...engines].sort();
}

const ALLE_ENGINES = ["chromium", "firefox", "webkit"];

// ── Pflicht 4 · vorprovisionierte Engines aufzählen, ohne etwas zu installieren ─────────────────
function vorprovisionierteEngines(): string[] {
  const cache = resolve(homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(cache)) {
    return [];
  }
  const treffer = new Set<string>();
  for (const name of readdirSync(cache)) {
    if (/^chromium/.test(name)) treffer.add("chromium");
    if (/^firefox/.test(name)) treffer.add("firefox");
    if (/^webkit/.test(name)) treffer.add("webkit");
  }
  return [...treffer].sort();
}

describe("JOB 1123 · Enginekette bis zur effektiven Projektmenge", () => {
  // ── PFLICHT 2 · Die Kette löst auf — an den echten Dateien, nicht per Namenssuche ────────────
  it("die Kette tools/check → npm-Skript → Playwright-Projekte löst vollständig auf", () => {
    const skript = torSkript();
    const argumente = playwrightArgumente(skript);
    const engines = effektiveEngines(lies("playwright.smoke.config.ts"), argumente);

    expect(skript.length, "Kein Torskript aufgelöst.").toBeGreaterThan(0);
    expect(
      argumente,
      `Das Torskript "${skript}" endet nicht in einem Playwright-Aufruf — die Kette reisst vor den Projekten ab.`,
    ).toContain("playwright test");
    expect(engines.length, "Die Kette endet ohne Engine.").toBeGreaterThan(0);
  });

  // ── PFLICHT 2 · Der Drei-Engine-Weg ist vollständig vorhanden ────────────────────────────────
  it("smoke:ui:gate:drei führt effektiv Chromium, Firefox und WebKit", () => {
    const engines = effektiveEngines(
      lies("playwright.smoke.config.ts"),
      playwrightArgumente("smoke:ui:gate:drei"),
    );
    expect(
      engines,
      "Der Drei-Engine-Weg führt nicht mehr alle drei Engines. Damit wäre die spätere Torverdrahtung wertlos, noch bevor sie gebaut ist.",
    ).toEqual(ALLE_ENGINES);
  });

  // ── PFLICHT 3 · Fällt Firefox oder WebKit weg, wird es rot — an der ECHTEN Konfiguration ─────
  // Dieser Fall ist die Zusicherung; die byte-exakte Gegenmutation an der Datei selbst steht in
  // der Rückgabe (G1/G2). Hier wird belegt, dass die Auflösung den Verlust überhaupt bemerkt.
  for (const weg of ["firefox", "webkit"]) {
    it(`ohne ${weg} in der Konfiguration ist der Drei-Engine-Weg nicht mehr vollständig`, () => {
      const echt = lies("playwright.smoke.config.ts");
      const gekuerzt = echt
        .split(/\{\s*\n\s*name:\s*"/)
        .filter((teil, i) => i === 0 || !teil.startsWith(`${weg}"`))
        .join('{\n      name: "');

      const uebrig = effektiveEngines(gekuerzt, playwrightArgumente("smoke:ui:gate:drei"));

      expect(uebrig, `${weg} liess sich nicht entfernen — die Probe prüft nichts.`).not.toContain(
        weg,
      );
      expect(
        uebrig,
        `Ohne ${weg} bleibt die Drei-Engine-Zusage unerfüllt, die Prosa aber unverändert.`,
      ).not.toEqual(ALLE_ENGINES);
    });
  }

  // ── PFLICHT 2 + K7 · Die Sperre wird gehalten, nicht umgangen ────────────────────────────────
  it("das Tor bleibt einengig, solange Stufe A nicht grün gemessen ist", () => {
    // Diese Zusicherung ist DECKUNGSGLEICH mit K7 in tests/smoke/job1094-engine-kette.test.ts.
    // Sie steht hier ein zweites Mal, weil dieser Durchgang die Verdrahtung tatsächlich gebaut,
    // Stufe A gemessen und sie daraufhin zurückgenommen hat — der Verzicht soll an der Stelle
    // sichtbar sein, an der er entschieden wurde.
    const skript = torSkript();
    const engines = effektiveEngines(
      lies("playwright.smoke.config.ts"),
      playwrightArgumente(skript),
    );

    expect(
      skript,
      "Das Tor ruft den Drei-Engine-Weg, obwohl Stufe A rot gemessen ist. Ein Gate, das drei Engines beauftragt, von denen keine startet, meldet Fehler der Umgebung als Produktfehler.",
    ).not.toBe("smoke:ui:gate:drei");
    expect(engines, "Das Tor ist nicht mehr einengig.").toEqual(["chromium"]);
  });

  // ── PFLICHT 4 · Browserlage benennen, nichts installieren, nichts überspringen ───────────────
  it("die Engine-Startfähigkeit ist ein benannter Umgebungsbefund, kein stiller Skip", () => {
    const vorhanden = vorprovisionierteEngines();

    // Sichtbar in der Ausgabe: installiert ist nicht gestartet. Genau diese Unterscheidung hat
    // JOB 1094 aufgedeckt und dieser Durchgang bestätigt.
    const lage = vorhanden.length > 0 ? vorhanden.join(" ") : "(keine)";
    const befund = `[JOB 1123] vorprovisioniert: ${lage} · Stufe A (netzfreier Start) in dieser Bahn: chromium ROT, firefox ROT, webkit ROT — Rohprotokoll in der Arbeitsspur, Verdrahtung deshalb zurückgenommen.`;

    console.info(befund);

    // Der Vertrag, der unabhängig von der Maschine gilt: die Konfiguration muss die drei Engines
    // führen. Ob sie starten, entscheidet die Umgebung — und wird oben benannt, nicht verschwiegen.
    expect(
      effektiveEngines(
        lies("playwright.smoke.config.ts"),
        playwrightArgumente("smoke:ui:gate:drei"),
      ),
    ).toEqual(ALLE_ENGINES);
  });
});
