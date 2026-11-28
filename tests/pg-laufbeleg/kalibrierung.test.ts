import { describe, expect, it } from "vitest";
import { belegeKalibrierung } from "./kalibrierung";

describe("Der PG-Pflichtlauf bewertet den konkreten Befund einer Gegenprobe", () => {
  const meldung = /^Bild 2 ist unsichtbar$/u;
  it("bestätigt den erwarteten Messfehler", async () => {
    await expect(
      belegeKalibrierung("K1", meldung, async () => {
        throw new Error("Bild 2 ist unsichtbar");
      }),
    ).resolves.toBeUndefined();
  });
  it("reicht einen Fehler des Prüfplatzes unverändert durch", async () => {
    const defekt = new Error("Datenbank nicht erreichbar");
    await expect(
      belegeKalibrierung("K1", meldung, async () => {
        throw defekt;
      }),
    ).rejects.toBe(defekt);
  });
  it("meldet eine wirkungslose Verstellung", async () => {
    await expect(belegeKalibrierung("K1", meldung, async () => undefined)).rejects.toThrow(
      "Kalibrierung ohne erwarteten Befund",
    );
  });
});
