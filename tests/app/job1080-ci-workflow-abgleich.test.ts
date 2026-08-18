import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// ================================================================================================
// JOB 1080 / D3 — DER VOLLSTÄNDIGE WORKFLOW, JOBWEISE, UND DIE AUSSAGEN ÜBER IHN
// ================================================================================================
//
// Gebunden an `_relay/kopf/outbox/BEN4-PRUEFUNG-JOB-1080-D2.md` (SHA-256
// 5c91c05fa67f670f4ab5bcd6ea1a82158dd5aa4e1693988f6130a6bba56f0d2d). Zwei Durchgänge sind an
// derselben Stelle gescheitert: Sie haben den `check`-Job beschrieben und daraus auf den GANZEN
// Workflow geschlossen. BEN4, Substanzurteil 4: der zusätzliche Postgres-Integrationsjob „ist ein
// weiterer belegter Unterschied zwischen dem vollständigen GitHub-CI-Workflow und dem lokalen
// Gesamttor".
//
// WAS DIESER TEST TUT, WAS `ci-check-contract.test.ts` NICHT TUT: Jener pinnt die ABSICHT einzelner
// Zusicherungen (ruft `./tools/check`, provisioniert Chromium, bleibt hermetisch). Dieser hier pinnt
// die VOLLSTÄNDIGKEIT der Einordnung: JEDER ausführbare Schritt JEDES Jobs muss genau einer Lage
// gegenüber `./tools/check` zugeordnet sein. Ein neuer Schritt — in welchem Job auch immer — macht
// ihn rot, bis jemand die Einordnung nachträgt. Genau die Lücke, durch die der Integrationsjob
// zweimal gefallen ist.
//
// Die beiden Parserhelfer sind bewusst eine eigene Fassung und kein Import: der Vertragstest hat
// keine Exporte, und ihn dafür umzubauen hieße, einen grünen Nachbarvertrag für einen neuen Test
// anzufassen. Beide lesen dieselbe Datei; laufen sie auseinander, wird genau das rot.

const WORKFLOW = ".github/workflows/ci.yml";
const TOR = "tools/check";
const TEST_TREIBER = "tools/test";

const yml = readFileSync(WORKFLOW, "utf8");
const tor = readFileSync(TOR, "utf8");
const treiber = readFileSync(TEST_TREIBER, "utf8");

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

function runBefehle(block: string): string[] {
  return Array.from(block.matchAll(/^\s*(?:- )?run:\s*(.+?)\s*$/gm))
    .map((m) => m[1])
    .filter((b): b is string => b !== undefined);
}

/** Alle Jobnamen der Datei — damit kein Job unbemerkt dazukommt. */
function jobNamen(): string[] {
  const zeilen = yml.split("\n");
  const start = zeilen.findIndex((z) => /^jobs:\s*$/.test(z));
  if (start === -1) {
    throw new Error("kein `jobs:`-Block gefunden");
  }
  return zeilen
    .slice(start + 1)
    .filter((z) => /^ {2}[A-Za-z0-9_-]+:\s*$/.test(z))
    .map((z) => z.trim().replace(/:$/, ""));
}

// ------------------------------------------------------------------------------------------------
// DIE EINORDNUNG — vier Lagen, abschließend
// ------------------------------------------------------------------------------------------------
//
//   VOR          läuft im selben Job, aber VOR dem Tor; schafft dessen Voraussetzungen.
//   IST_DAS_TOR  der Aufruf von `./tools/check` selbst.
//   NACH         läuft im selben Job nach dem Tor. Heute leer — die Lage bleibt benannt, damit ein
//                künftiger Nachlaufschritt eine Kategorie hat und nicht still durchrutscht.
//   AUSSERHALB   liegt in einem anderen Job; `./tools/check` fährt es nicht mit.
type Lage = "VOR" | "IST_DAS_TOR" | "NACH" | "AUSSERHALB";

const EINORDNUNG: ReadonlyArray<{ job: string; befehl: string; lage: Lage }> = [
  { job: "check", befehl: "npm ci", lage: "VOR" },
  { job: "check", befehl: "npm ci --prefix apps/web", lage: "VOR" },
  { job: "check", befehl: "npx playwright install --with-deps chromium", lage: "VOR" },
  { job: "check", befehl: "./tools/check", lage: "IST_DAS_TOR" },
  { job: "integration", befehl: "npm ci", lage: "AUSSERHALB" },
  { job: "integration", befehl: "npm run test:integration", lage: "AUSSERHALB" },
];

describe("JOB 1080 · Auflage 1 — der VOLLSTÄNDIGE Workflow, jobweise eingeordnet", () => {
  it("kennt genau die Jobs, die eingeordnet sind — ein neuer Job macht diesen Test rot", () => {
    expect(jobNamen()).toEqual(["check", "integration"]);
    expect([...new Set(EINORDNUNG.map((e) => e.job))]).toEqual(["check", "integration"]);
  });

  it("ordnet JEDEN ausführbaren Schritt JEDES Jobs zu — lückenlos und in der Laufreihenfolge", () => {
    for (const job of jobNamen()) {
      const erwartet = EINORDNUNG.filter((e) => e.job === job).map((e) => e.befehl);
      expect(runBefehle(jobBlock(job)), `Job „${job}": Schritte nicht wie eingeordnet`).toEqual(
        erwartet,
      );
    }
    // Und die Gegenrichtung: keine Einordnung ohne Schritt.
    const alleSchritte = jobNamen().flatMap((j) => runBefehle(jobBlock(j)));
    expect(EINORDNUNG).toHaveLength(alleSchritte.length);
  });

  it("genau EIN Schritt ist das Tor — und er steht im `check`-Job", () => {
    const tore = EINORDNUNG.filter((e) => e.lage === "IST_DAS_TOR");
    expect(tore).toHaveLength(1);
    expect(tore[0]?.job).toBe("check");
    expect(tore[0]?.befehl).toBe("./tools/check");
  });

  it("die drei VOR-Schritte sind Voraussetzungen, die das Tor selbst NICHT herstellt", () => {
    const vor = EINORDNUNG.filter((e) => e.lage === "VOR").map((e) => e.befehl);
    expect(vor).toEqual([
      "npm ci",
      "npm ci --prefix apps/web",
      "npx playwright install --with-deps chromium",
    ]);
    // Belegt statt behauptet: das Tor installiert weder Abhängigkeiten noch einen Browser. Für
    // Chromium genügt „kommt nicht vor" NICHT — das Tor NENNT `npx playwright install chromium`
    // in seinem Fehlertext (`tools/check:68`). Der Unterschied zwischen nennen und ausführen ist
    // hier genau der Punkt: geprüft wird, dass jede Fundstelle eine Ausgabezeile ist.
    expect(tor).not.toMatch(/npm ci/);
    const installZeilen = tor.split("\n").filter((z) => /playwright\s+install/.test(z));
    expect(installZeilen.length, "keine Fundstelle — die Prüfung liefe ins Leere").toBeGreaterThan(
      0,
    );
    for (const zeile of installZeilen) {
      expect(zeile.trim(), `das Tor führt Chromium selbst aus: ${zeile.trim()}`).toMatch(/^echo\s/);
    }
    // `--with-deps` ist der bewusste Unterschied zum lokalen Lauf: der Runner bringt die
    // Systembibliotheken für Chromium nicht mit.
    expect(runBefehle(jobBlock("check")).some((b) => /--with-deps/.test(b))).toBe(true);
  });

  it("DER PUNKT, DER ZWEIMAL GEFEHLT HAT: der Integrationsjob liegt AUSSERHALB des Tors", () => {
    const integration = EINORDNUNG.filter((e) => e.job === "integration");
    expect(integration.every((e) => e.lage === "AUSSERHALB")).toBe(true);
    expect(integration.map((e) => e.befehl)).toContain("npm run test:integration");
    // Nicht behauptet, sondern an beiden Enden belegt: das Tor kennt den Integrationslauf nicht,
    // und der Integrationsjob ruft das Tor nicht.
    expect(tor).not.toMatch(/test:integration/);
    expect(jobBlock("integration")).not.toMatch(/\.\/tools\/check/);
  });

  it("das Tor führt sechs benannte Stufen — darauf stützt sich `IST_DAS_TOR`", () => {
    for (const stufe of [
      "▶ cwd-vertrag",
      "▶ build",
      "▶ lint",
      "▶ architecture",
      "▶ test",
      "▶ ui-smoke",
    ]) {
      expect(tor, `Stufe „${stufe}" fehlt im Tor`).toContain(stufe);
    }
  });

  it("keine NACH-Schritte heute — die Lage bleibt trotzdem benannt", () => {
    expect(EINORDNUNG.filter((e) => e.lage === "NACH")).toEqual([]);
    // Im `check`-Job steht das Tor an letzter Stelle; alles andere liegt davor.
    const checkRuns = runBefehle(jobBlock("check"));
    expect(checkRuns[checkRuns.length - 1]).toBe("./tools/check");
  });
});

describe("JOB 1080 · Auflage 3 — die Schlüsselbundkette, so weit sie belegbar ist", () => {
  it("das Tor erreicht Vitest ausschließlich über `./tools/test`", () => {
    expect(tor).toContain("./tools/test");
    expect(tor).not.toMatch(/^\s*npx vitest/m);
  });

  it("`tools/test` setzt den Schalter VOR dem Vitest-Lauf — nicht daneben", () => {
    const schalter = treiber.indexOf(
      'export KLARWERK_SKIP_KEYCHAIN="${KLARWERK_SKIP_KEYCHAIN:-1}"',
    );
    const vitest = treiber.indexOf("npx vitest run");
    expect(schalter, "der Schalter fehlt in tools/test").toBeGreaterThan(-1);
    expect(vitest, "der Vitest-Aufruf fehlt in tools/test").toBeGreaterThan(-1);
    expect(schalter).toBeLessThan(vitest);
  });

  it("DER WIRKSAME UNTERSCHIED: `npm run test` umgeht diesen Schalter — bis heute", () => {
    // Das ist der Kern der historischen Abweichung, und er ist AM HEUTIGEN STAND messbar: Das
    // npm-Skript ist blankes `vitest run`. Wer es direkt aufruft — wie CI es vor dem Umbau tat —
    // bekommt den Schalter NICHT. Nur der Weg über das Tor setzt ihn.
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.test).toBe("vitest run");
    expect(pkg.scripts?.test).not.toMatch(/KLARWERK_SKIP_KEYCHAIN/);
    expect(pkg.scripts?.test).not.toMatch(/tools\/test/);
  });

  it("REICHWEITE: der Schalter gilt für den Vitest-Lauf, NICHT für den UI-Smoke", () => {
    // `tools/test` sagt das selbst (mega25): ein Kindprozess ändert die Umgebung des Elternprozesses
    // nicht. Die Hermetik des Smokes wird woanders hergestellt. Wer beides gleichsetzt, behauptet
    // mehr, als der Quelltext trägt.
    expect(treiber).toMatch(/Kindprozess kann die Umgebung seines Elternprozesses nicht/);
    expect(tor).toContain("playwright.smoke.config.ts");
  });
});

describe("JOB 1080 · Auflage 4 — was das Tor über CI behauptet, muss heute noch stimmen", () => {
  // Zeilenumbrüche und Kommentarzeichen weg: die beanstandete Aussage steht im Quelltext über zwei
  // Zeilen verteilt („… bis heute\n# nicht …") und wäre zeilenweise nicht zu fassen.
  const torFliess = tor
    .split("\n")
    .map((z) => z.replace(/^\s*#\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");

  it("das Tor behauptet NICHT mehr, CI fahre es nicht", () => {
    expect(torFliess).not.toMatch(/CI fährt ihn bis heute nicht/);
    expect(torFliess).not.toMatch(/ruft build\/lint\/arch\/test einzeln auf/);
    expect(torFliess).not.toMatch(/hat NICHTS in der Automatisierung diese Suite je ausgeführt/);
  });

  it("und die Gegenprobe: der Workflow ruft das Tor wirklich auf", () => {
    // Ohne diese Zeile wäre der Test oben auch dann grün, wenn jemand den Kommentar streicht,
    // während CI das Tor tatsächlich nicht fährt. Die Aussage muss zur Lage passen, nicht fehlen.
    expect(runBefehle(jobBlock("check"))).toContain("./tools/check");
  });

  it("die Formulierung bleibt auf die belegte Reichweite begrenzt", () => {
    // Auflage 3: Ohne Laufartefakt darf kein konkreter früherer Fehllauf als reproduziert gelten.
    // Belegt ist die frühere STRUKTUR (historischer Stand aus der Repohistorie); nicht belegt ist,
    // dass gerade sie einen bestimmten roten CI-Lauf verursacht hat.
    expect(torFliess).not.toMatch(/reproduzierte[rn]? (CI-)?Fehllauf/i);
    expect(torFliess).toMatch(/fährt (es|ihn) heute|fährt das Gesamttor/);
  });
});
