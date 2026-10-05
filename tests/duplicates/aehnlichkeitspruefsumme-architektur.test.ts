// R-0194 · K4 (bens Befund, Nacharbeit 2) — der Architekturabgleich als AUSGEFÜHRTE Prüfung.
//
// Fährt denselben Aufruf wie `tools/check:11` (`depcruise --config .dependency-cruiser.cjs services`)
// mit JSON-Ausgabe und wertet sie zweistufig aus:
//   1. Auftragsumfang: kein Verstoß (error) an einer Datei, die dieser Auftrag angelegt oder geändert
//      hat — und der neue Prüfsummenbaustein ist tatsächlich im Lauf enthalten (keine Leerprüfung).
//   2. Gesamttor: null error-Verstöße über ganz `services`. Fällt NUR diese Stufe, liegt ein fremder
//      Basisfehler vor; die Meldung nennt ihn, ohne ihn dem Auftragsumfang zuzurechnen.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const WURZEL = fileURLToPath(new URL("../..", import.meta.url));

const AUFTRAGSDATEIEN = [
  "services/conflicts/src/similarity-checksum.ts",
  "services/conflicts/src/overlap-service.ts",
  "services/conflicts/src/overlap-types.ts",
  "services/conflicts/index.ts",
  "services/app/src/duplicate-detection.ts",
];

interface Verstoss {
  from: string;
  to: string;
  rule: { name: string; severity: string };
}

interface CruiseErgebnis {
  modules: { source: string }[];
  summary: { error: number; violations: Verstoss[] };
}

let ergebnis: CruiseErgebnis;
let exitCode: number | null;

beforeAll(() => {
  const lauf = spawnSync(
    join(WURZEL, "node_modules/.bin/depcruise"),
    ["--config", ".dependency-cruiser.cjs", "--output-type", "json", "services"],
    { cwd: WURZEL, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
  );
  if (lauf.error) {
    throw lauf.error;
  }
  exitCode = lauf.status;
  ergebnis = JSON.parse(lauf.stdout) as CruiseErgebnis;
}, 600_000);

const fehler = (): Verstoss[] =>
  ergebnis.summary.violations.filter((v) => v.rule.severity === "error");

describe("R-0194 · K4 — dependency-cruiser über services (Aufruf aus tools/check)", () => {
  it("der Prüfsummenbaustein und seine Einbindung sind im Lauf enthalten", () => {
    const quellen = new Set(ergebnis.modules.map((m) => m.source));
    for (const datei of AUFTRAGSDATEIEN) {
      expect(quellen.has(datei), datei).toBe(true);
    }
  });

  it("Auftragsumfang: kein Architekturverstoß an einer Auftragsdatei", () => {
    const betroffen = fehler().filter(
      (v) => AUFTRAGSDATEIEN.includes(v.from) || AUFTRAGSDATEIEN.includes(v.to),
    );
    expect(betroffen).toEqual([]);
  });

  it("Gesamttor wie tools/check: null error-Verstöße (sonst fremder Basisfehler, s. Meldung)", () => {
    expect(
      fehler().map((v) => `${v.rule.name}: ${v.from} → ${v.to}`),
      "Verstöße außerhalb des Auftragsumfangs wären fremde Basisfehler",
    ).toEqual([]);
    expect(ergebnis.summary.error).toBe(0);
    expect(exitCode).toBe(0);
  });
});
