import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// ================================================================================================
// I51 — ZWEI TORE, EINE REGEL. Dieser Test hält fest, dass es wieder EINS ist.
//
// DER BEFUND (OFFEN.md I51, Quellenhash fbfde1a5…): `.github/workflows/ci.yml` rief `npm run
// build`, `lint`, `arch` und `test` EINZELN auf; `./tools/check` ruft dieselben Werkzeuge PLUS den
// hermetischen Chromium-Smoke. Die letzte Zeile des Workflows lautet „Nichts kommt nach main, das
// diese Pipeline nicht grün durchläuft" — und unser Ship-Tor prüfte eine andere Pipeline als die,
// in der diese Regel steht. `ci.yml` stand seit dem 15.07. unverändert, `tools/check` wurde zuletzt
// am 29.07. geändert: zwei Wochen Auseinanderlaufen, unbeobachtet.
//
// EIN UNTERSCHIED WAR NICHT NUR ORGANISATORISCH, SONDERN WIRKSAM: `tools/test:15` setzt
// `export KLARWERK_SKIP_KEYCHAIN="${KLARWERK_SKIP_KEYCHAIN:-1}"`. CI rief `npm run test`, also
// blankes `vitest run` OHNE diese Variable — in CI lief damit ein anderer Zweig des Produktcodes
// als bei jedem lokalen Lauf. Der Aufruf des Gesamttors schließt das mit, ohne es zu erwähnen.
//
// WARUM STRUKTURTEST UND NICHT „CI GRÜN": ein Testlauf kann nicht prüfen, was ein fremder Runner
// tut. Was er prüfen kann, ist die einzige Ursache, die hier je Schaden angerichtet hat — dass die
// beiden Tore auseinanderlaufen. Genau darauf ist dieser Test gerichtet, und auf nichts anderes.
// ================================================================================================

const WORKFLOW = ".github/workflows/ci.yml";
const yml = readFileSync(WORKFLOW, "utf8");

// Zerlegung in Jobblöcke statt Regex über die ganze Datei: sonst könnte eine Zusicherung über den
// Check-Job versehentlich am Integrationsjob grün werden (oder umgekehrt) — beide enthalten
// `npm ci` und `node-version`. Fail-closed: ein nicht auffindbarer Block wirft, statt still leer
// zu bleiben und jede `not.toContain`-Zusicherung geschenkt zu erfüllen.
function jobBlock(name: string): string {
  const zeilen = yml.split("\n");
  const kopf = zeilen.findIndex((z) => new RegExp(`^  ${name}:\\s*$`).test(z));
  if (kopf === -1) {
    throw new Error(`Jobblock „${name}" nicht gefunden in ${WORKFLOW}`);
  }
  const rest = zeilen.slice(kopf + 1);
  const naechster = rest.findIndex((z) => /^ {2}\S/.test(z));
  const block = (naechster === -1 ? rest : rest.slice(0, naechster)).join("\n");
  if (block.trim().length === 0) {
    throw new Error(`Jobblock „${name}" ist leer — die Zerlegung trägt nicht mehr`);
  }
  return block;
}

// Die tatsächlich ausgeführten Kommandos eines Jobs. Ein Substring-Vergleich über den Rohtext
// würde auch Kommentare und Schrittnamen treffen; hier zählt nur, was wirklich läuft.
function runBefehle(block: string): string[] {
  return Array.from(block.matchAll(/^\s*(?:- )?run:\s*(.+?)\s*$/gm))
    .map((m) => m[1])
    .filter((befehl): befehl is string => befehl !== undefined);
}

const CHECK = jobBlock("check");
const CHECK_RUNS = runBefehle(CHECK);

describe("I51 · der Check-Job fährt dasselbe Gesamttor wie die Hand", () => {
  it("ruft ./tools/check auf — und keine auseinanderlaufende Viererliste mehr", () => {
    expect(
      CHECK_RUNS.some((b) => /(^|\s|&&\s*)\.\/tools\/check(\s|$)/.test(b)),
      `der Check-Job muss das versionierte Gesamttor aufrufen; gefunden: ${JSON.stringify(CHECK_RUNS)}`,
    ).toBe(true);
    // Die vier Einzelaufrufe dürfen nicht daneben stehenbleiben: sonst gäbe es wieder zwei
    // Wahrheiten, nur diesmal in derselben Datei.
    for (const einzeln of ["npm run build", "npm run lint", "npm run arch", "npm run test"]) {
      expect(
        CHECK_RUNS.filter((b) => b === einzeln),
        `„${einzeln}" läuft wieder einzeln statt über das Gesamttor`,
      ).toEqual([]);
    }
  });

  it("provisioniert Chromium ausdrücklich — das Tor darf nicht am fehlenden Browser scheitern", () => {
    // Zwei zulässige Schreibweisen, weil die ABSICHT gepinnt wird und nicht eine Formulierung:
    // der direkte Playwright-Aufruf (CI braucht zusätzlich die Systembibliotheken) oder das
    // versionierte Skript `smoke:browser:setup`. Was NICHT zulässig ist, ist gar keine
    // Provisionierung — dann scheitert `./tools/check` am fehlenden Browser.
    expect(
      CHECK_RUNS.some(
        (b) =>
          (/playwright\s+install/.test(b) && /chromium/.test(b)) || /smoke:browser:setup/.test(b),
      ),
      `keine Browser-Provisionierung im Check-Job; gefunden: ${JSON.stringify(CHECK_RUNS)}`,
    ).toBe(true);
  });

  it("bleibt hermetisch: kein Cloud-Geheimnis und kein Modellschlüssel im Check-Job", () => {
    // `tools/check` fährt bewusst `smoke:ui:gate` (ohne Modell, ohne Egress) und NICHT `smoke:ui`.
    expect(CHECK).not.toMatch(/secrets\./);
    expect(CHECK).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(CHECK).not.toMatch(/KLARWERK_SHIP_SMOKE_API_KEY/);
    expect(CHECK_RUNS.some((b) => /smoke:ui(?!:gate)/.test(b))).toBe(false);
  });

  it("erhält Node-Version, beide npm-Installationen und die Auslöser", () => {
    expect(CHECK).toContain('node-version: "20"');
    expect(CHECK_RUNS).toContain("npm ci");
    expect(CHECK_RUNS).toContain("npm ci --prefix apps/web");
    expect(yml).toContain("push: { branches: [main] }");
    expect(yml).toContain("pull_request: {}");
  });

  it("lässt den Postgres-Integrationsjob unangetastet", () => {
    const integration = jobBlock("integration");
    expect(runBefehle(integration)).toEqual(["npm ci", "npm run test:integration"]);
    expect(integration).toContain('node-version: "20"');
    // Er bekommt ausdrücklich KEIN Gesamttor: er ist der zweite, langsamere Nachweis.
    expect(integration).not.toContain("./tools/check");
  });
});

describe("I51 · das aufgerufene Tor ist wirklich das Gesamttor", () => {
  it("tools/check existiert, ist ausführbar und enthält den Chromium-Smoke", () => {
    const modus = statSync("tools/check").mode;
    expect(
      modus & 0o111,
      "tools/check ist nicht ausführbar — ./tools/check schlüge in CI fehl",
    ).not.toBe(0);
    const tor = readFileSync("tools/check", "utf8");
    expect(tor).toContain("smoke:ui:gate");
    expect(tor).toContain("./tools/test");
  });
});
