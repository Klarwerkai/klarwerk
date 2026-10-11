// ================================================================================================
// R-2066 (NFR-TAI-03) · „PRINZIPIEN DOKUMENTIERT NACHGEWIESEN" — UND DIE NACHWEISE GIBT ES WIRKLICH.
// ================================================================================================
//
// `docs/compliance/vertrauenswuerdige-ki.md` ordnet Transparenz, menschlicher Aufsicht und
// Nachvollziehbarkeit je Produktstellen und Tests zu. Ein solches Dokument veraltet still, sobald eine
// Datei umzieht. Diese Prüfung hält es ehrlich: alle drei Abschnitte sind da, jeder nennt Belege, und
// jede genannte Datei liegt im Repository.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOKUMENT = "docs/compliance/vertrauenswuerdige-ki.md";
const ABSCHNITTE = ["Transparenz", "Menschliche Aufsicht", "Nachvollziehbarkeit"] as const;
const PFAD = /`((?:apps|services|tests|docs|specs)\/[^`\s]+\.(?:ts|tsx|md|json))`/g;

function abschnitt(text: string, titel: string): string {
  const beginn = text.indexOf(`\n## ${titel}\n`);
  if (beginn < 0) {
    return "";
  }
  const rest = text.slice(beginn + titel.length + 5);
  const ende = rest.indexOf("\n## ");
  return ende < 0 ? rest : rest.slice(0, ende);
}

describe("R-2066 · die Prinzipien vertrauenswürdiger KI sind mit Belegen dokumentiert", () => {
  const text = readFileSync(join(WURZEL, DOKUMENT), "utf8");

  it("jedes der drei Prinzipien hat einen Abschnitt mit mindestens drei Belegdateien", () => {
    for (const titel of ABSCHNITTE) {
      const pfade = new Set([...abschnitt(text, titel).matchAll(PFAD)].map((m) => m[1]));
      expect([titel, pfade.size >= 3]).toEqual([titel, true]);
    }
  });

  it("jede genannte Datei liegt im Repository", () => {
    const pfade = [...new Set([...text.matchAll(PFAD)].map((m) => m[1] ?? ""))];
    expect(pfade.length).toBeGreaterThan(10);
    const fehlen = pfade.filter((pfad) => !existsSync(join(WURZEL, pfad)));
    expect(fehlen).toEqual([]);
  });
});
