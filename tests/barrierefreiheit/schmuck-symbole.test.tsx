// @vitest-environment jsdom
// ================================================================================================
// WCAG 1.1.1 / 4.1.2 — `lib/schmuckSymbole.ts`: namenlose Lucide-Symbole werden verborgen, benannte
// nicht (Audit nacharbeit-8).
// ================================================================================================
//
// Gemessen am DOM, nicht an Klassennamen im Quelltext: Symbole werden eingefügt, wie React sie
// einfügt — vor dem Binden und danach —, und es zählt allein das Attribut, das Hilfstechnik liest.
// Der Beleg im echten Browser (AX-Baum ohne namenlose Bilder) ist der Audit-Smoke.
import { afterEach, describe, expect, it } from "vitest";
import { bindeSchmuckSymbole } from "../../apps/web/src/lib/schmuckSymbole";

const SVG = "http://www.w3.org/2000/svg";

function symbol(klasse: string, attribute: Record<string, string> = {}): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", klasse);
  for (const [name, wert] of Object.entries(attribute)) {
    svg.setAttribute(name, wert);
  }
  return svg;
}

const warte = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

let abmelden: (() => void) | null = null;

afterEach(() => {
  abmelden?.();
  abmelden = null;
  document.body.replaceChildren();
});

describe("Schmuck-Symbole", () => {
  it("vorhandene namenlose Lucide-Symbole werden beim Binden verborgen", () => {
    const knopf = document.createElement("button");
    knopf.textContent = "Speichern";
    knopf.prepend(symbol("lucide lucide-save"));
    document.body.append(knopf);

    abmelden = bindeSchmuckSymbole(document.body);

    expect(knopf.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("später eingefügte Symbole werden ebenfalls verborgen — auch tief verschachtelt", async () => {
    abmelden = bindeSchmuckSymbole(document.body);
    const liste = document.createElement("ul");
    const zeile = document.createElement("li");
    zeile.append(symbol("lucide lucide-chevron-right"), "Bibliothek");
    liste.append(zeile);
    document.body.append(liste);
    await warte();

    expect(zeile.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("ein Symbol mit Bedeutung (Rolle oder Name) bleibt sichtbar für Hilfstechnik", async () => {
    abmelden = bindeSchmuckSymbole(document.body);
    const benannt = symbol("lucide lucide-lock", { role: "img", "aria-label": "Läuft" });
    const verwiesen = symbol("lucide lucide-info", { "aria-labelledby": "hinweis" });
    document.body.append(benannt, verwiesen);
    await warte();

    expect(benannt.hasAttribute("aria-hidden")).toBe(false);
    expect(verwiesen.hasAttribute("aria-hidden")).toBe(false);
  });

  it("KALIBRIERUNG: ein fremdes SVG (kein Lucide) wird nicht angefasst", async () => {
    abmelden = bindeSchmuckSymbole(document.body);
    const fremd = symbol("diagramm");
    document.body.append(fremd);
    await warte();

    expect(fremd.hasAttribute("aria-hidden")).toBe(false);
  });

  it("ein ausdrückliches aria-hidden=false bleibt stehen", async () => {
    abmelden = bindeSchmuckSymbole(document.body);
    const sichtbar = symbol("lucide lucide-star", { "aria-hidden": "false" });
    document.body.append(sichtbar);
    await warte();

    expect(sichtbar.getAttribute("aria-hidden")).toBe("false");
  });
});
