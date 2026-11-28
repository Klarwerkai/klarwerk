// ================================================================================================
// SICHTBARKEITSPRÜFER · DURCHSICHTIG IST NUR ALPHA 0 (Ben, Lauf 5 Runde 1, BEN-05).
// ================================================================================================
//
// `durchsichtigeFarbe` in `SICHT_HILFEN` wertete jede Farbe mit der Endung „,0)“ als durchsichtig.
// Damit fiel die deckende Hinweisfarbe `rgb(138, 90, 0)` (Blauanteil 0) durch, und Browserfälle
// meldeten sichtbare Produkthinweise als unsichtbar. Hier läuft GENAU der Quelltext, den die
// Browserfälle in die Seite geben — keine Abschrift.
import { describe, expect, it, vi } from "vitest";
import { SICHT_HILFEN, type Sichtbefund, mussSichtbarTragen } from "./weg";

const durchsichtigeFarbe = new Function(`${SICHT_HILFEN}\nreturn durchsichtigeFarbe;`)() as (s: {
  color: string;
}) => boolean;

describe("SICHT_HILFEN · durchsichtigeFarbe", () => {
  it.each([
    "rgb(138, 90, 0)",
    "rgba(138, 90, 0, 1)",
    "rgb(0, 0, 0)",
    "rgba(0, 0, 0, 0.5)",
    "rgb(138 90 0)",
    "rgb(138 90 0 / 1)",
    "rgb(255 255 255 / 50%)",
  ])("deckend: %s", (color) => {
    expect(durchsichtigeFarbe({ color })).toBe(false);
  });

  it.each([
    "transparent",
    "rgba(138, 90, 0, 0)",
    "rgba(0, 0, 0, 0)",
    "rgba(0,0,0,0.0)",
    "rgb(138 90 0 / 0)",
    "rgb(138 90 0 / 0%)",
  ])("durchsichtig: %s", (color) => {
    expect(durchsichtigeFarbe({ color })).toBe(true);
  });
});

describe("Kopfband beim Seitenwechsel", () => {
  const beschriftet = { da: true, text: "Arbeitsbereiche", verborgen: [], flaeche: 200 };

  it("liest beim Einbau Anwesenheit und beschriftete Fläche in derselben Messung", async () => {
    const evaluate = vi
      .fn<() => Promise<Sichtbefund>>()
      .mockResolvedValueOnce({ da: false, text: "", verborgen: [], flaeche: 0 })
      .mockResolvedValueOnce(beschriftet);
    await expect(
      mussSichtbarTragen({ evaluate }, "#menue", "Arbeitsbereiche", "Einstieg", 1000),
    ).resolves.toBe("Arbeitsbereiche");
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ ...beschriftet, flaeche: 0 }, "keine Fläche"],
    [{ ...beschriftet, text: "Anderer Bereich" }, "erwartet war"],
  ] as const)(
    "prüft den ersten vorhandenen Einstieg auf Fläche und Beschriftung",
    async (befund, meldung) => {
      const evaluate = vi
        .fn<() => Promise<Sichtbefund>>()
        .mockResolvedValueOnce(befund)
        .mockResolvedValue(beschriftet);
      await expect(
        mussSichtbarTragen({ evaluate }, "#menue", "Arbeitsbereiche", "Einstieg", 1000),
      ).rejects.toThrow(meldung);
      expect(evaluate).toHaveBeenCalledTimes(1);
    },
  );
});
