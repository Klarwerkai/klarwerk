// @vitest-environment jsdom
// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0216) · DIE DETAILANSICHT: OFFENER WIDERSPRUCH → REIFE „IN PRÜFUNG".
// ================================================================================================
//
// Der montierte Bibliotheksbericht (dieselbe Bühne wie UX-27): ein validiertes Objekt, dessen
// Konflikt der SERVER meldet (R-0212), steht in der Reife-Zeile des Abschnitts „Belege" als
// „In Prüfung" — nicht als „Nutzbar". Gegenprobe: ohne Konflikt „Nutzbar". Bibliothek und
// Antworten prüft `r0216-in-pruefung.test.ts`.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { mount, oeffne, satzKnoten, text } from "../ux27-pruefstand/buehne";

async function reifeZeile(): Promise<string> {
  const abschnitt = await oeffne("belege");
  const dt = satzKnoten(abschnitt, i18n.t("lib.facet.maturity") as string);
  expect(dt, "Reife-Zeile fehlt").not.toBeNull();
  return text(dt?.parentElement as HTMLElement);
}

describe("R-0216 · Detailansicht", () => {
  it("validiert + Konflikt (Server): Reife „In Prüfung“", async () => {
    await i18n.changeLanguage("de");
    await mount({ status: "validiert", confidence: 80, trust: 80, anzeigestatus: "konflikt" });
    const zeile = await reifeZeile();
    expect(zeile).toContain("In Prüfung");
    expect(zeile).not.toContain("Nutzbar");
  });

  // Ben R3, BEN-07: der reale Zustand nach einem Wahrheitswiderspruch (R-0231) — Kern offen, 87.
  it("offen/87 + Konflikt (Server, nach R-0231): Reife „In Prüfung“, nicht „Zu prüfen“", async () => {
    await i18n.changeLanguage("de");
    await mount({ status: "offen", confidence: 87, trust: 87, anzeigestatus: "konflikt" });
    const zeile = await reifeZeile();
    expect(zeile).toContain("In Prüfung");
    expect(zeile).not.toContain("Zu prüfen");
  });

  it("Gegenprobe ohne Konflikt: „Nutzbar“", async () => {
    await i18n.changeLanguage("de");
    await mount({ status: "validiert", confidence: 80, trust: 80, anzeigestatus: "validiert" });
    expect(await reifeZeile()).toContain("Nutzbar");
  });
});
