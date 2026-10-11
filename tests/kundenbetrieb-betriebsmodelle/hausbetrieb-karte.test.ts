// R-0843 — BEDIENKARTE UND EINRICHTUNGSBLAUPAUSE FÜR DEN HAUSBETRIEB SAGEN, WAS DAS PAKET TUT.
//
// Beide Blätter sind aus den vorhandenen Bausteinen zusammengesetzt. Dieser Wächter hält die Werte
// fest, die sie aus dem Paket übernehmen — Port, Ablageort, Einspielweg, Netzbindung, Prüfsumme —,
// damit eine Änderung am Paket die Karte rot macht, statt sie still falsch werden zu lassen.
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";
import { fahreNode } from "./hilfen";

const KARTE = readFileSync(repoPfad("docs/operations/hausbetrieb-bedienkarte.md"), "utf8");
const BLAUPAUSE = readFileSync(
  repoPfad("docs/operations/hausbetrieb-einrichtung-blaupause.md"),
  "utf8",
);

// Die Texte, die WIRKLICH in jedes Paket wandern — erzeugt vom echten Baustein, nicht abgeschrieben.
let start = "";
let install = "";
beforeAll(async () => {
  const modul = JSON.stringify(pathToFileURL(repoPfad("scripts/insel/release-texte.mjs")).href);
  const skript = [
    `import { installBefehlText, startBefehlText } from ${modul};`,
    "process.stdout.write(JSON.stringify([startBefehlText(), installBefehlText()]));",
  ].join("\n");
  const lauf = await fahreNode(["--input-type=module", "-e", skript]);
  expect(lauf.code, lauf.stderr).toBe(0);
  [start, install] = JSON.parse(lauf.stdout) as [string, string];
});

describe("R-0843 · Bedienkarte und Blaupause am Paket", () => {
  it("H1 · Port und Ablageort sind die Vorgaben des Pakets", () => {
    expect(start).toContain('PORT="${PORT:-3002}"');
    expect(start).toContain('SHARED_ROOT="${KLARWERK_SHARED_ROOT:-/Users/Shared/Klarwerk_Insel}"');
    expect(KARTE).toContain("`http://127.0.0.1:3002`");
    expect(KARTE).toContain("`/Users/Shared/Klarwerk_Insel/current`");
    expect(BLAUPAUSE).toContain("`/Users/Shared/Klarwerk_Insel/data/state.jsonl`");
    expect(start).toContain(
      'STATE_FILE="${KLARWERK_DEV_PERSIST_FILE:-$SHARED_ROOT/data/state.jsonl}"',
    );
  });

  it("H2 · der Doppelklick übergibt an den abgesicherten Einspielweg", () => {
    expect(install).toContain('exec bash "$WEG" "$SOURCE" "$@"');
    expect(install).toContain('WEG="$SOURCE/scripts/insel/update-einspielen.sh"');
    expect(KARTE).toContain("Doppelklick auf `install.command`");
    expect(BLAUPAUSE).toContain("Doppelklick auf `install.command`");
  });

  it("H3 · die Netzbindung steht so in der Blaupause, wie der Server horcht", () => {
    expect(readFileSync(repoPfad("services/app/src/server.ts"), "utf8")).toContain(
      'await app.listen({ port, host: "0.0.0.0" });',
    );
    expect(BLAUPAUSE).toContain('`host: "0.0.0.0"`');
  });

  it("H4 · jeder genannte Repopfad existiert", () => {
    for (const text of [KARTE, BLAUPAUSE]) {
      const pfade = [...text.matchAll(/`((?:services|scripts|docs|tests|apps)\/[^`\s*<…]+)`/g)];
      expect(pfade.length).toBeGreaterThan(2);
      for (const [, pfad] of pfade) {
        expect(existsSync(repoPfad(pfad ?? "")), pfad).toBe(true);
      }
    }
  });
});
