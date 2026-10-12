// ================================================================================================
// R-0303 — „ANTWORTFLÄCHE UND VALIDIERUNG BENUTZEN DAFÜR DIESELBEN WÖRTER."
// ================================================================================================
//
// Befund (BEN, Nacharbeit 1): die Antwortfläche zeigte „Stufe fehlt", die Validierung beim Anlegen
// sagt „Vertraulichkeitsstufe fehlt — …" (services/capture/src/service.ts, ko-routes.ts). Gemessen
// wird hier die Gleichheit gegen den WIRKLICHEN Text der Validierung — aus dem Quelltext gelesen,
// nicht abgeschrieben —, und dass die Torlage der Antwortfläche UND der Belegbedarf einer Lücke
// genau diesen Schlüssel rendern. Die Darstellung selbst misst
// `tests/app/job2626-klara-torlage-sichtbar-mounted.test.tsx` am gemounteten Ask.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { gapBelegbedarfSchluessel } from "../../apps/web/src/lib/gapBelegbedarf";
import { de } from "../../apps/web/src/woerterbuch/de";
import { repoPfad } from "../support/repoPfad";

const SCHLUESSEL = "ask.verschlossen.vertraulichkeitsstufe";
const VALIDIERUNG = [
  "services/capture/src/service.ts",
  "services/app/src/routes/ko-routes.ts",
] as const;

/** Der Satz, mit dem die Validierung eine fehlende Stufe zurückweist — aus dem Quelltext. */
function validierungssatz(datei: string): string {
  const quelltext = readFileSync(repoPfad(datei), "utf8");
  const treffer = quelltext.match(/"(Vertraulichkeitsstufe fehlt[^"]*)"/);
  if (!treffer?.[1]) {
    throw new Error(`${datei}: kein Satz zur fehlenden Vertraulichkeitsstufe gefunden`);
  }
  return treffer[1];
}

describe("R-0303 · dieselben Wörter an Antwortfläche und Validierung", () => {
  it("T1 · das Tor der Antwortfläche ist der Anfang des Validierungssatzes", async () => {
    await i18n.changeLanguage("de");
    const tor = i18n.t(SCHLUESSEL);
    expect(tor).toBe("Vertraulichkeitsstufe fehlt");
    for (const datei of VALIDIERUNG) {
      expect(validierungssatz(datei).startsWith(tor), datei).toBe(true);
    }
  });

  it("T2 · die Torlage der Ask-Seite rendert genau diesen Schlüssel am Stufen-Tor", () => {
    const ask = readFileSync(repoPfad("apps/web/src/pages/Ask.tsx"), "utf8");
    const zweig = ask.slice(ask.indexOf("{h.stufeFehlt ? ("), ask.indexOf("{h.volltextFehlt ? ("));
    expect(zweig.length, "KALIBRIERUNG: der Zweig des Stufen-Tors ist gefunden").toBeGreaterThan(0);
    expect(zweig).toContain(`t("${SCHLUESSEL}")`);
    expect(zweig).not.toContain('t("ask.verschlossen.stufe")');
  });

  it("T3 · der Belegbedarf einer Lücke spricht dasselbe Wort", () => {
    expect(gapBelegbedarfSchluessel({ belegbedarf: ["stufe"] })).toEqual([SCHLUESSEL]);
    expect(de[SCHLUESSEL as keyof typeof de]).toBe("Vertraulichkeitsstufe fehlt");
  });
});
