// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02, K10, Ben nacharbeit-4) — ECHTE MODELLBEOBACHTUNG
// IM REGULÄREN PRÜFABLAUF.
// ================================================================================================
//
// Ben: „Die sieben Fälle im regulären Prüfablauf mit einem erlaubten, eingerichteten Anbieter
// durchführen … Sollte der Zugang tatsächlich fehlen, die konkrete externe Voraussetzung belegen."
//
//   V0 · VORAUSSETZUNG — läuft IMMER: welche erlaubten Optionen (openai, anthropic, local) in der
//        Umgebung DIESES Prüflaufs eingerichtet sind, je mit dem geheimnisfreien Grund der
//        bestehenden Fabriken (Variablennamen, nie Werte). Das ist der Beleg, falls der Zugang fehlt.
//   V1 · BEOBACHTUNG — läuft, sobald eine Option eingerichtet ist: die sieben fiktiven Fälle gegen
//        das ECHTE Prüfmodell. Der vollständige Bericht (Modelle, Zustände, Begründungen, Dauer,
//        Verbrauch, Kosten nach `KLARWERK_KI_PREISLISTE`) steht im Protokoll dieses Laufs.
//        Zugesichert wird, dass wirklich geprüft wurde und dass keine Bestätigung ohne Fundstelle
//        entsteht — NICHT, dass das Modell jedes Urteil wie erwartet trifft (keine Fehlerfreiheit).
//
// Umgebung: die des Prüfablaufs. Wie der volle Smoke (`npm run smoke:ui`) wird ein dort gesetzter
// `KLARWERK_SHIP_SMOKE_API_KEY` als Anthropic-Zugang gelesen, sofern `ANTHROPIC_API_KEY` fehlt. Mit
// `KLARWERK_REFERENZ_BEOBACHTUNG=aus` unterbleibt V1 ausdrücklich (dann sagt V0 das).
import { describe, expect, it } from "vitest";
import type { ReasonerReferenzWahl } from "../../services/reasoner";
import { anbieterLage, beobachte } from "./beobachtung";

const UMGEBUNG: Record<string, string | undefined> = {
  ...process.env,
  ...(!process.env.ANTHROPIC_API_KEY?.trim() && process.env.KLARWERK_SHIP_SMOKE_API_KEY?.trim()
    ? { ANTHROPIC_API_KEY: process.env.KLARWERK_SHIP_SMOKE_API_KEY }
    : {}),
};
const LAGE = anbieterLage(UMGEBUNG);
const REIHENFOLGE: readonly ReasonerReferenzWahl[] = ["anthropic", "openai", "local"];
const GEWUENSCHT = UMGEBUNG.KLARWERK_REFERENZ_BEOBACHTUNG_PRUEFER as
  | ReasonerReferenzWahl
  | undefined;
const WAHL: ReasonerReferenzWahl | undefined =
  GEWUENSCHT && LAGE[GEWUENSCHT]?.eingerichtet
    ? GEWUENSCHT
    : REIHENFOLGE.find((w) => LAGE[w].eingerichtet);
const AUS = UMGEBUNG.KLARWERK_REFERENZ_BEOBACHTUNG?.trim().toLowerCase() === "aus";

describe("REF-02 · K10 — echte Modellbeobachtung der sieben fiktiven Fälle", () => {
  it("V0 · Voraussetzung: eingerichtete Prüfoptionen dieses Prüflaufs (geheimnisfrei)", () => {
    const beleg = {
      eingerichtet: REIHENFOLGE.filter((w) => LAGE[w].eingerichtet),
      gruende: Object.fromEntries(
        REIHENFOLGE.filter((w) => !LAGE[w].eingerichtet).map((w) => [w, LAGE[w].grund]),
      ),
      gewaehlt: WAHL ?? null,
      beobachtungAusgeschaltet: AUS,
    };
    console.info(`REF-02 · K10 · Voraussetzung → ${JSON.stringify(beleg)}`);
    // Der Beleg selbst darf keinen Schlüsselwert tragen — nur Namen und Gründe.
    for (const wert of [UMGEBUNG.ANTHROPIC_API_KEY, UMGEBUNG.OPENAI_API_KEY]) {
      if (wert && wert.length > 8) {
        expect(JSON.stringify(beleg)).not.toContain(wert);
      }
    }
    // Ein nicht eingerichteter Anbieter nennt immer seinen Grund.
    for (const w of REIHENFOLGE) {
      expect(LAGE[w].eingerichtet || (LAGE[w].grund ?? "").length > 0).toBe(true);
    }
  });

  it.skipIf(WAHL === undefined || AUS)(
    "V1 · Beobachtung: sieben Fälle gegen das echte Prüfmodell, mit Modell, Dauer und Kosten",
    async () => {
      const bericht = await beobachte(WAHL as ReasonerReferenzWahl, UMGEBUNG);
      console.info(`REF-02 · K10 · Bericht → ${JSON.stringify(bericht)}`);
      expect(bericht.ergebnisse).toHaveLength(7);
      // Wirklich geprüft: die fünf Fälle mit Fundstelle (korrekter Beleg, teilweise gedeckt,
      // Gegenpassage, sachfremde Quelle, Prompt-Injection) haben je einen Prüflauf MIT Modell. Der
      // erfundene Link hat keine Fundstelle und damit keinen Aufruf; der Prüferausfall endet am 1-ms-
      // Zeitlimit, ggf. noch vor der Übertragung.
      expect(bericht.modellaufrufeNachweis.mitModell).toBeGreaterThanOrEqual(5);
      expect(bericht.modellaufrufeNachweis.modelle.length).toBeGreaterThan(0);
      expect(bericht.modellaufrufeNachweis.modelle).not.toContain("fixtur-antwort");
      for (const l of bericht.laufprotokoll.filter((x) => x.task === "referenz")) {
        expect(l.dauerMs).toBeGreaterThanOrEqual(0);
      }
      const nach = (k: string) => bericht.ergebnisse.find((r) => r.kennung === k);
      // Technische Zusagen, unabhängig vom Modellurteil:
      expect(nach("erfundener_link")?.beobachtet).toEqual(["nicht_pruefbar"]);
      expect(nach("erfundener_link")?.messung.modellaufrufe).toBe(0);
      expect(nach("prueferausfall")?.status).toBe("nicht_pruefbar");
      expect(nach("prueferausfall")?.grund).toBe("zeitlimit");
      for (const r of bericht.ergebnisse) {
        expect(r.pruefer?.modell ?? null).not.toBe("fixtur-antwort");
        expect(r.beobachtet.length).toBeGreaterThan(0);
      }
    },
    300_000,
  );
});
