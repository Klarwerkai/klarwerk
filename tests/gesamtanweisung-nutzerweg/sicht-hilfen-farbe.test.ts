// ================================================================================================
// SICHTBARKEITSPRÜFER · DURCHSICHTIG IST NUR ALPHA 0 (Ben, Lauf 5 Runde 1, BEN-05).
// ================================================================================================
//
// `durchsichtigeFarbe` in `SICHT_HILFEN` wertete jede Farbe mit der Endung „,0)“ als durchsichtig.
// Damit fiel die deckende Hinweisfarbe `rgb(138, 90, 0)` (Blauanteil 0) durch, und Browserfälle
// meldeten sichtbare Produkthinweise als unsichtbar. Hier läuft GENAU der Quelltext, den die
// Browserfälle in die Seite geben — keine Abschrift.
import { describe, expect, it } from "vitest";
import { SICHT_HILFEN } from "./weg";

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
