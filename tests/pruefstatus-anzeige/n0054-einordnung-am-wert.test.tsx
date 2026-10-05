// @vitest-environment jsdom
// ================================================================================================
// PRÜFSTATUS-ANZEIGE (N-0054, Ben R2 BEN-05) · „NOCH NICHT FACHLICH GEPRÜFT" STEHT AM WERT.
// ================================================================================================
//
// Zielzustand: „Den Wert konsistent als Prüfvertrauen oder Bewertungsstand beschriften …; die
// Einordnung ‚Noch nicht fachlich geprüft' direkt beim Wert zeigen. Aktualität vorhandener Belege
// getrennt benennen." Die Berechnung bleibt unberührt (UX-27).
//
// Hier: der echte Bibliotheksabschnitt „Belege" (dieselbe Bühne wie UX-27). Die reine Ableitung
// samt Gegenfällen steht in `n0054-ableitung.test.ts` (ohne Bühne — deren Abbau setzt einen Mount
// voraus).
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { mount, oeffne, pruefeSichtbar, text } from "../ux27-pruefstand/buehne";

describe("B · Bibliothek, Abschnitt „Belege“", () => {
  it("ungeprüftes Objekt mit Wert 0: die Einordnung steht direkt beim Wert, sichtbar", async () => {
    await i18n.changeLanguage("de");
    await mount({
      status: "offen",
      confidence: 0,
      trust: 0,
      history: [],
      assignments: [],
      sources: [],
    });
    const abschnitt = await oeffne("belege");
    const einordnung = abschnitt.querySelector('[data-testid="pruefwert-einordnung"]');
    expect(einordnung).not.toBeNull();
    expect(text(einordnung as HTMLElement)).toBe("Noch nicht fachlich geprüft");
    pruefeSichtbar(einordnung as HTMLElement, abschnitt);
    // DIREKT beim Wert: dieselbe Zeile wie die Prüfstandsleiste.
    const zeile = einordnung?.parentElement;
    expect(zeile?.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(text(zeile as HTMLElement)).toContain("Prüfstand: 0 %");
  });

  it("Gegenprobe: ein validiertes Objekt trägt die Einordnung nicht", async () => {
    await i18n.changeLanguage("de");
    await mount({ status: "validiert", confidence: 80, trust: 80, history: [], sources: [] });
    const abschnitt = await oeffne("belege");
    expect(abschnitt.querySelector('[data-testid="pruefwert-einordnung"]')).toBeNull();
    expect(text(abschnitt)).not.toContain("Noch nicht fachlich geprüft");
  });

  it.each([
    ["en", "Not yet reviewed by an expert"],
    ["nl", "Nog niet inhoudelijk beoordeeld"],
  ] as const)("%s trägt einen eigenen Text", async (sprache, satz) => {
    await i18n.changeLanguage(sprache);
    await mount({ status: "offen", confidence: 0, trust: 0, history: [], sources: [] });
    const abschnitt = await oeffne("belege");
    expect(text(abschnitt)).toContain(satz);
    await i18n.changeLanguage("de");
  });
});
