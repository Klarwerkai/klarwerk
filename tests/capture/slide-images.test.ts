// WP-D11 (Client-Seite): der „Folienansicht"-Abschnitt — je Folie eine figure im BILD-1a/1b-Vertrag
// mit kollisionsfesten IDs; die D9b/D9c-Budget-Regeln gelten unverändert (Drop-to-fit ganzer
// figures, ehrliche Zähler); Copy in DE/EN/NL; Capture-Verdrahtung inkl. ehrlicher Fehlerpfade.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_INLINE_BODY_HTML_BYTES, applyInlineImageBudget } from "../../apps/web/src/lib/docx";
import {
  SLIDE_IMAGES_TEXT,
  appendSlideSection,
  countKeptSlides,
  slideImageId,
} from "../../apps/web/src/lib/slideImages";

const PNG = (payload: string): string => `data:image/png;base64,${payload}`;

describe("WP-D11: Folien-figures (pure)", () => {
  it("n Folien → n figures in Folienreihenfolge, je mit beidseitiger data-image-id und leerer Fußnote", () => {
    const html = appendSlideSection(
      "<p>Text</p>",
      "Folienansicht",
      [PNG("QQ=="), PNG("Ug=="), PNG("Uw==")],
      "tok1",
    );
    expect(html.startsWith("<p>Text</p><h2>Folienansicht</h2>")).toBe(true);
    // Reihenfolge = Folienreihenfolge; jede figure trägt die ID an img UND figcaption, Fußnote LEER.
    for (let i = 1; i <= 3; i++) {
      const id = slideImageId("tok1", i);
      expect(html).toContain(`<img data-image-id="${id}"`);
      expect(html).toContain(`<figcaption data-image-id="${id}"></figcaption>`);
    }
    expect(html.indexOf(slideImageId("tok1", 1))).toBeLessThan(
      html.indexOf(slideImageId("tok1", 2)),
    );
    // Überschrift wird escaped eingebettet (kein HTML aus Übersetzungen).
    expect(appendSlideSection(null, "<b>x</b>", [], "tok1")).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("IDs sind kollisionsfest: eigener s-Namensraum + eigener Run-Token (Foto-figures unberührt)", () => {
    // Foto-IDs desselben Imports: kw-img-<fotoToken>-N; Folien: kw-img-<slideToken>-sN.
    expect(slideImageId("tokA", 1)).toBe("kw-img-tokA-s1");
    expect(slideImageId("tokA", 1)).not.toBe("kw-img-tokA-1");
    expect(slideImageId("tokA", 2)).not.toBe(slideImageId("tokB", 2));
    // Token-Muster bleibt im Sanitizer-Vertrag ([\w-]{1,64}).
    expect(/^[\w-]{1,64}$/.test(slideImageId("tokA", 30))).toBe(true);
  });

  it("BUDGET-Integration (D9b/D9c unverändert): große Folien-PNGs → Drop-to-fit, ehrlicher Zähler", async () => {
    // Folie 1 klein, Folien 2+3 sprengen zusammen das Budget → first-fit behält die frühe Folie.
    const big = PNG("A".repeat(MAX_INLINE_BODY_HTML_BYTES));
    const html = appendSlideSection(
      "<p>Text</p>",
      "Folienansicht",
      [PNG("QQ=="), big, big],
      "tok1",
    );
    const budgeted = await applyInlineImageBudget(
      html,
      async (src) => src,
      MAX_INLINE_BODY_HTML_BYTES,
    );
    expect(budgeted.overflow).toBe(false); // der Text selbst passt — nur figures fallen
    const kept = countKeptSlides(budgeted.html, "tok1", 3);
    expect(kept).toBe(1);
    expect(budgeted.html).toContain(slideImageId("tok1", 1));
    expect(budgeted.html).not.toContain(`data-image-id="${slideImageId("tok1", 2)}"`);
  });

  it("die Folien-Copy existiert in DE, EN und NL", () => {
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const key of Object.values(SLIDE_IMAGES_TEXT)) {
      expect(`${key}:${i18n.split(`"${key}":`).length - 1}`).toBe(`${key}:3`);
    }
  });

  it("Capture-Verdrahtung: Konvertierung nur bei Toggle, Budget-Lauf, ehrliche 503/429-Meldungen", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    expect(src).toContain("if (slidesAsImages) {");
    expect(src).toContain("endpoints.slides.convert(");
    // Budget-Regeln unverändert: das kombinierte HTML läuft durch den D9-Mechanismus.
    expect(src).toContain("applyInlineImageBudget(");
    expect(src).toContain("MAX_INLINE_BODY_HTML_BYTES");
    // Ehrliche Fehlerpfade: 503 → nicht verfügbar, 429 → belegt, sonst generisch — Text bleibt.
    expect(src).toContain("SLIDE_IMAGES_TEXT.unavailable");
    expect(src).toContain("SLIDE_IMAGES_TEXT.busy");
    expect(src).toContain("SLIDE_IMAGES_TEXT.failed");
    expect(src).toContain("countKeptSlides(");
  });
});
