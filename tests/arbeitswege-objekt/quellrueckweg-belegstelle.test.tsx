// @vitest-environment jsdom
// ================================================================================================
// ARBEITSWEGE AM SELBEN ARTIKEL (produkt:20261007:arbeitswege-objekt) · K3 — QUELLRÜCKWEG UND
// BELEGSTELLE ZUSAMMEN (Nacharbeit 8, bens Befund).
// ================================================================================================
//
// `pages/Ask.tsx` (`quellenHref`) baut den Weg aus einer Antwortquelle so:
//   quellenRueckwegHref(id, belegstelleHref(id, stelle), objektbezug)
// Gemessen wird GENAU diese Kette mit dem echten `belegstelleHref` (R-0326). Der Befund: eine
// tragende Passage über `STELLE_MAX` (600 Zeichen) verwirft dort Anker UND Fassung — der Weg zurück
// zum gefragten Beitrag verlor dann seine Fassung. Fiktive Kennungen, keine Zugangsdaten.
import { describe, expect, it } from "vitest";
import { STELLE_MAX, belegstelleHref } from "../../apps/web/src/lib/belegstelle";
import { quellenRueckwegHref } from "../../apps/web/src/lib/objektbezug";

const BEZUG = { koId: "ko-gefragt", fassung: 4 };

/** Dieselbe Kette wie `quellenHref` in `pages/Ask.tsx` (ohne den Demo-Zusatz). */
function quellenweg(
  id: string,
  stelle: { passage: string; fassung: number | null } | null,
  bezug: { koId: string; fassung: number | null } | null,
): string {
  return quellenRueckwegHref(id, belegstelleHref(id, stelle), bezug);
}

describe("K3 · Quellrückweg behält Kennung und Fassung des gefragten Beitrags", () => {
  it("überlange tragende Passage am gefragten Beitrag: zurück mit derselben Kennung und Fassung", () => {
    const lang = "Pumpe P-12 ".repeat(Math.ceil((STELLE_MAX + 1) / 11));
    expect(lang.trim().length).toBeGreaterThan(STELLE_MAX);
    // Kalibrierung: der Belegstellen-Helfer allein verwirft hier Anker UND Fassung (A2 in
    // tests/r0326-belegstelle/belegstelle.test.tsx) — genau die Lücke des Befunds.
    expect(belegstelleHref(BEZUG.koId, { passage: lang, fassung: 4 })).toBe("/wissen/ko-gefragt");

    const href = quellenweg(BEZUG.koId, { passage: lang, fassung: 4 }, BEZUG);
    expect(href).toBe("/wissen/ko-gefragt?fassung=4");
    // Die Passage wird nicht abgeschnitten mitgeschickt.
    expect(new URL(href, "https://klarwerk.test").searchParams.has("stelle")).toBe(false);
  });

  it("verwertbare tragende Passage: die genauere Belegstelle samt ihrer Fassung bleibt", () => {
    const href = quellenweg(BEZUG.koId, { passage: "Alle vier Wochen prüfen.", fassung: 5 }, BEZUG);
    const url = new URL(href, "https://klarwerk.test");
    expect(url.pathname).toBe("/wissen/ko-gefragt");
    expect(url.searchParams.get("stelle")).toBe("Alle vier Wochen prüfen.");
    expect(url.searchParams.get("fassung")).toBe("5");
  });

  it("ohne tragende Passage am gefragten Beitrag: ebenfalls mit Kennung und Fassung", () => {
    expect(quellenweg(BEZUG.koId, null, BEZUG)).toBe("/wissen/ko-gefragt?fassung=4");
  });

  it("eine ANDERE Quelle erbt den Bezug des gefragten Beitrags nicht", () => {
    const lang = "x".repeat(STELLE_MAX + 1);
    expect(quellenweg("ko-andere", { passage: lang, fassung: 2 }, BEZUG)).toBe("/wissen/ko-andere");
    expect(quellenweg("ko-andere", null, BEZUG)).toBe("/wissen/ko-andere");
  });

  it("ohne Objektbezug (Frage nicht aus einem Artikel) bleibt mains Verhalten unverändert", () => {
    const lang = "x".repeat(STELLE_MAX + 1);
    expect(quellenweg(BEZUG.koId, { passage: lang, fassung: 4 }, null)).toBe("/wissen/ko-gefragt");
  });
});
