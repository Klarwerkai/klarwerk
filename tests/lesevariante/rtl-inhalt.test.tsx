// @vitest-environment jsdom
// ================================================================================================
// R-1056 · RECHTS-NACH-LINKS — DER ERSTE BEGRENZTE SCHRITT: INHALT IN SEINER LESERICHTUNG.
// ================================================================================================
//
// Gemessen wird genau die Zusage aus `components/SanitizedHtml.tsx`: der gerenderte INHALT trägt
// `dir="auto"`, damit ein hebräisches/arabisches Original in seiner Leserichtung steht. Nicht
// gemessen (und nicht behauptet): eine RTL-Oberfläche, eine Absatzauflösung je Block, eine
// automatische Übersetzung. jsdom berechnet keine Schreibrichtung — geprüft wird das Attribut, das
// sie im Browser auslöst, und dass der Sanitizer dabei nichts Fremdes durchlässt.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "../../apps/web/node_modules/react";
import { SanitizedHtml } from "../../apps/web/src/components/SanitizedHtml";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";
import { renderMarkup } from "../../apps/web/src/test/render";

function wurzel(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderMarkup(createElement(SanitizedHtml, { html, className: "prose-kw" }));
  const kind = host.firstElementChild;
  if (!(kind instanceof HTMLElement)) {
    throw new Error("SanitizedHtml hat kein Element gerendert");
  }
  return kind;
}

describe("R-1056 · Inhalt steht in seiner eigenen Schreibrichtung", () => {
  it("ein hebräisches Original trägt dir=auto und bleibt wörtlich erhalten", () => {
    const original = "<p>שסתום הלחץ נסגר ידנית.</p>";
    const el = wurzel(original);
    expect(el.getAttribute("dir")).toBe("auto");
    expect(el.getAttribute("class")).toBe("prose-kw");
    expect(el.querySelector("p")?.textContent).toBe("שסתום הלחץ נסגר ידנית.");
  });

  it("ein arabisches Original ebenso — dieselbe eine Stelle, keine Sprachtabelle", () => {
    const el = wurzel("<p>أغلق صمام الضغط يدويًا.</p>");
    expect(el.getAttribute("dir")).toBe("auto");
    expect(el.textContent).toBe("أغلق صمام الضغط يدويًا.");
  });

  it("deutscher Inhalt bekommt KEINE erzwungene Richtung (auto, nicht rtl)", () => {
    const el = wurzel("<p>Ventil bei Überdruck schließen.</p>");
    expect(el.getAttribute("dir")).toBe("auto");
    expect(el.getAttribute("dir")).not.toBe("rtl");
  });

  it("der Sanitizer bleibt unverändert: ein fremdes dir/on*-Attribut im Inhalt fällt weiter", () => {
    expect(sanitizeHtml('<p dir="rtl" onclick="x()">a</p>')).toBe("<p>a</p>");
    const el = wurzel('<p dir="ltr" style="color:red">שלום</p>');
    const absatz = el.querySelector("p");
    expect(absatz?.getAttribute("dir")).toBeNull();
    expect(absatz?.getAttribute("style")).toBeNull();
  });

  it("die Flächen dieses Auftrags rendern ihren Inhalt über genau diesen Baustein", () => {
    // Prüfkarte Stufe 2 (importierter Seitentext eines Kandidaten) und die übersetzte Leseansicht
    // auf `/wissen/:id` — beide erben die Richtung, weil sie keinen eigenen HTML-Weg haben.
    const stufe2 = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Stufe2.tsx"), "utf8");
    const detail = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/KnowledgeDetail.tsx"),
      "utf8",
    );
    expect(stufe2).toMatch(/<SanitizedHtml[\s\S]*?html=\{befund\.html\}/);
    expect(detail).toMatch(/<SanitizedHtml[\s\S]*?html=\{variante\.bodyHtml\}/);
    expect(stufe2).not.toContain("dangerouslySetInnerHTML");
    expect(detail).not.toContain("dangerouslySetInnerHTML");
  });
});
