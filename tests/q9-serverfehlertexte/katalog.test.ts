import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("R6 jeder echte Katalogschlüssel hat drei nichtleere Sprachfassungen", async () => {
  const pfad = resolve(__dirname, "../../services/auth/src/meldungen.ts");
  expect(existsSync(pfad), "Auth-Meldungskatalog fehlt").toBe(true);
  const { MELDUNGEN, meldung } = await import("../../services/auth/src/meldungen");
  const katalog = MELDUNGEN as Record<string, Record<string, string>>;
  expect(Object.keys(katalog).length).toBeGreaterThan(0);
  for (const [key, texte] of Object.entries(katalog)) {
    for (const sprache of ["de", "en", "nl"]) {
      expect(typeof texte[sprache], `${key}.${sprache} fehlt`).toBe("string");
      expect(texte[sprache]?.trim(), `${key}.${sprache} ist leer`).not.toBe("");
    }
    expect(meldung(key)).toBe(texte.de);
    expect(meldung(key, "fr")).toBe(texte.de);
  }
});
