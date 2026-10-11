// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-QUELLENANZEIGE (R-0326) — DER TEXTANKER DER BELEGSTELLE.
// ================================================================================================
//
// Das Datenmodell (`apps/web/src/lib/belegstelle.ts`): Objekt + Fassung + wörtliche Passage, in
// der Adresse getragen und beim Öffnen im gezeichneten Text aufgelöst. Gemessen wird hier die
// reine Logik: Adresse hin und zurück, wörtliche Suche über Elementgrenzen, ehrliches Nichtfinden
// und die Hervorhebung, die die Struktur des Texts nicht bricht.
import { describe, expect, it } from "vitest";
import {
  belegstelleAusAdresse,
  belegstelleHref,
  findePassage,
  markiereFundstelle,
} from "../../apps/web/src/lib/belegstelle";

function text(html: string): HTMLDivElement {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
}

describe("R-0326 · Belegstelle als Textanker", () => {
  it("A1 · Adresse hin und zurück: Passage und Fassung reisen verlustfrei, Leerraum normalisiert", () => {
    const href = belegstelleHref("ko-1", { passage: "  Offene  Profile\nsind gut. ", fassung: 3 });
    const url = new URL(href, "https://klarwerk.test");
    expect(url.pathname).toBe("/wissen/ko-1");
    expect(belegstelleAusAdresse(url.searchParams)).toEqual({
      passage: "Offene Profile sind gut.",
      fassung: 3,
    });
  });

  it("A2 · ohne Passage oder mit übergroßer Passage bleibt es die blosse Objektadresse — kein abgeschnittener Anker", () => {
    expect(belegstelleHref("ko-1", null)).toBe("/wissen/ko-1");
    expect(belegstelleHref("ko-1", { passage: "   ", fassung: 2 })).toBe("/wissen/ko-1");
    expect(belegstelleHref("ko-1", { passage: "x".repeat(601), fassung: 2 })).toBe("/wissen/ko-1");
    expect(belegstelleAusAdresse(new URLSearchParams("fassung=2"))).toBeNull();
    expect(belegstelleAusAdresse(new URLSearchParams("stelle=abc&fassung=zwei"))).toEqual({
      passage: "abc",
      fassung: null,
    });
  });

  it("F1 · wörtliche Suche über Elementgrenzen und Zeilenumbrüche; die Marke umfasst GENAU die Passage", () => {
    const d = text("<p>Vorher. Offene <strong>Profile</strong>\n  sind zu bevorzugen. Danach.</p>");
    const fund = findePassage(d, "Offene Profile sind zu bevorzugen.");
    expect(fund).not.toBeNull();
    const marken = markiereFundstelle(d, fund as NonNullable<typeof fund>);
    expect(marken.map((m) => m.textContent).join("")).toBe("Offene Profile\n  sind zu bevorzugen.");
    expect(d.querySelectorAll("mark[data-bib-belegstelle]").length).toBe(marken.length);
    // Die Struktur bleibt: das <strong> steht weiter da, der Gesamttext ist unverändert.
    expect(d.querySelector("strong")?.textContent).toBe("Profile");
    expect(d.textContent).toBe("Vorher. Offene Profile\n  sind zu bevorzugen. Danach.");
  });

  it("F2 · kein Teiltreffer, keine Ähnlichkeit: eine nicht wörtlich stehende Passage wird NICHT gefunden", () => {
    const d = text("<p>Offene Profile sind zu bevorzugen.</p>");
    expect(findePassage(d, "Offene Profile sind zwingend.")).toBeNull();
    expect(findePassage(d, "offene profile sind zu bevorzugen.")).toBeNull();
    expect(findePassage(d, "")).toBeNull();
  });
});
