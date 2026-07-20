// WP-BILD-1a (Pedi 20.07.): Bild-Fußnoten-Fundament. Jedes importierte Inline-Bild bekommt beim
// DOCX-Import eine <figure> mit <figcaption data-image-id="…"> und einem EHRLICHEN Platzhalter (keine
// erfundene Beschreibung). Getestet: DOM-freier Kern (wrapImagesInFigures + extractDocxRich), die
// Byte-Budget-Interaktion (Notbremse droppt das GANZE figure-Element), beide Sanitizer (Client richText +
// Server services/structure) erhalten figure/figcaption/data-image-id und strippen böse Attribute,
// shouldPreserveRichBody wertet figure als reich, i18n-Platzhalter DE/EN/NL.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { shouldPreserveRichBody } from "../../apps/web/src/lib/bodyAiAssist";
import {
  type DocxEngine,
  IMAGE_ID_PREFIX,
  applyInlineImageBudget,
  extractDocxRich,
  utf8ByteLength,
  wrapImagesInFigures,
} from "../../apps/web/src/lib/docx";
import { sanitizeHtml as clientSanitize } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
const PLACEHOLDER = "Noch keine Bildbeschreibung";

function engineOf(html: string, text = "Text"): DocxEngine {
  return {
    convertToHtml: async () => ({ value: html, messages: [] }),
    extractRawText: async () => ({ value: text, messages: [] }),
  };
}

describe("WP-BILD-1a: wrapImagesInFigures", () => {
  it("hüllt jedes Bild in <figure> mit <figcaption> + stabiler, fortlaufender ID", () => {
    const out = wrapImagesInFigures(`<img src="${PNG}"><p>x</p><img src="${PNG}">`, PLACEHOLDER);
    expect(out).toContain("<figure>");
    expect(out).toContain(`<figcaption data-image-id="${IMAGE_ID_PREFIX}1">`);
    expect(out).toContain(`<figcaption data-image-id="${IMAGE_ID_PREFIX}2">`);
    expect(out).toContain(PLACEHOLDER);
    // Kein erfundener Text — genau der ehrliche Platzhalter.
    expect((out.match(/<figure>/g) ?? []).length).toBe(2);
  });

  it("escapt den Platzhalter defensiv und lässt Bilder ohne data:image unberührt", () => {
    const out = wrapImagesInFigures('<img src="/api/objects/x/raw">', "<b>böse</b>");
    // Object-Store-Bild (kein data:image) wird NICHT umhüllt.
    expect(out).toBe('<img src="/api/objects/x/raw">');
    const escaped = wrapImagesInFigures(`<img src="${PNG}">`, "<b>böse</b>");
    expect(escaped).toContain("&lt;b&gt;böse&lt;/b&gt;");
    expect(escaped).not.toContain("<b>böse");
  });
});

describe("WP-BILD-1a: extractDocxRich erzeugt Bild-Fußnoten", () => {
  it("mit Platzhalter → figure/figcaption/data-image-id im bodyHtml; Zähler stimmen", async () => {
    const { html, totalImages } = await extractDocxRich(new ArrayBuffer(4), {
      engine: engineOf(`<p>Text</p><img src="${PNG}">`),
      mapImage: async (src) => src,
      imageBudgetBytes: 3_500_000,
      imageCaptionPlaceholder: PLACEHOLDER,
    });
    expect(html).toContain("<figure>");
    expect(html).toContain(`data-image-id="${IMAGE_ID_PREFIX}1"`);
    expect(html).toContain(PLACEHOLDER);
    expect(html).toContain(PNG);
    expect(totalImages).toBe(1);
  });

  it("ohne Platzhalter → rückwärtskompatibel bare <img> (keine figure)", async () => {
    const { html } = await extractDocxRich(new ArrayBuffer(4), {
      engine: engineOf(`<img src="${PNG}">`),
      mapImage: async (src) => src,
      imageBudgetBytes: 3_500_000,
    });
    expect(html).not.toContain("<figure>");
    expect(html).toContain(PNG);
  });
});

describe("WP-BILD-1a: Byte-Budget droppt das GANZE figure-Element", () => {
  it("figure-umhülltes Bild wird als Einheit gemessen und bei Überlauf komplett entfernt", async () => {
    const two = wrapImagesInFigures(`<img src="${PNG}"><img src="${PNG}">`, PLACEHOLDER);
    const oneFigure = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER);
    // Budget = genau eine figure-Einheit → das zweite Bild fällt komplett (samt Fußnote).
    const budget = utf8ByteLength(oneFigure);
    const res = await applyInlineImageBudget(two, async (src) => src, budget);
    expect(res.total).toBe(2);
    expect(res.kept).toBe(1);
    expect(res.dropped).toBe(1);
    // Keine verwaiste Fußnote: genau eine figcaption bleibt, kein loses </figure>.
    expect((res.html.match(/<figcaption/g) ?? []).length).toBe(1);
    expect((res.html.match(/<figure>/g) ?? []).length).toBe(1);
    expect((res.html.match(/<\/figure>/g) ?? []).length).toBe(1);
  });

  it("re-encodiert die Bild-src innerhalb der figure (compressed zählt korrekt)", async () => {
    const one = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER);
    const res = await applyInlineImageBudget(
      one,
      async () => "data:image/jpeg;base64,SCALED",
      3_500_000,
    );
    expect(res.kept).toBe(1);
    expect(res.compressed).toBe(1);
    expect(res.html).toContain("data:image/jpeg;base64,SCALED");
    expect(res.html).toContain("<figcaption");
    expect(res.html).not.toContain(PNG);
  });
});

describe("WP-BILD-1a: Sanitizer erhalten figure/figcaption/data-image-id, strippen Böses", () => {
  const evil =
    '<figure><img src="/api/objects/abc/raw"><figcaption data-image-id="kw-img-1" onclick="x()" style="color:red">Beschreibung</figcaption></figure>';

  for (const [label, sanitize] of [
    ["Client (richText)", clientSanitize],
    ["Server (services/structure)", serverSanitize],
  ] as const) {
    it(`${label}: figure/figcaption/data-image-id bleiben, on*/style raus`, () => {
      const clean = sanitize(evil);
      expect(clean).toContain("<figure>");
      expect(clean).toContain('<figcaption data-image-id="kw-img-1">');
      expect(clean).toContain("Beschreibung");
      expect(clean).not.toContain("onclick");
      expect(clean).not.toContain("style");
    });

    it(`${label}: ungültige data-image-id (Leerzeichen) wird verworfen`, () => {
      const clean = sanitize('<figcaption data-image-id="evil id spaces">x</figcaption>');
      expect(clean).toContain("<figcaption>");
      expect(clean).not.toContain("data-image-id");
    });

    it(`${label}: <script> in der Fußnote wird komplett entfernt`, () => {
      const clean = sanitize(
        '<figcaption data-image-id="kw-img-1">Text<script>alert(1)</script></figcaption>',
      );
      expect(clean).not.toContain("<script");
      expect(clean).not.toContain("alert(1)");
      expect(clean).toContain("Text");
    });
  }
});

describe("WP-BILD-1a: Rich-Body + i18n", () => {
  it("shouldPreserveRichBody wertet einen figure-Body als reich (Original ist heilig)", () => {
    expect(
      shouldPreserveRichBody(
        `<figure><img src="/api/objects/x/raw"><figcaption data-image-id="kw-img-1">c</figcaption></figure>`,
      ),
    ).toBe(true);
  });

  it("Platzhalter-Key existiert DE/EN/NL und ist ehrlich (keine erfundene Beschreibung)", () => {
    for (const lng of ["de", "en", "nl"]) {
      const msg = String(
        i18n.getResource(lng, "translation", "capture.file.imageCaptionPlaceholder"),
      );
      expect(msg.length, lng).toBeGreaterThan(0);
    }
    expect(
      String(i18n.getResource("de", "translation", "capture.file.imageCaptionPlaceholder")),
    ).toMatch(/Noch keine/);
  });
});
