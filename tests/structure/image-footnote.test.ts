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
  newImageRunToken,
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
  it("hüllt jedes Bild in <figure> mit <figcaption> + kollisionsfester, fortlaufender ID", () => {
    const out = wrapImagesInFigures(
      `<img src="${PNG}"><p>x</p><img src="${PNG}">`,
      PLACEHOLDER,
      "tok123",
    );
    expect(out).toContain("<figure>");
    // WP-BILD-1b: kw-img-<runToken>-N, hier mit festem Token tok123.
    expect(out).toContain(`<figcaption data-image-id="${IMAGE_ID_PREFIX}tok123-1">`);
    expect(out).toContain(`<figcaption data-image-id="${IMAGE_ID_PREFIX}tok123-2">`);
    // WP-BILD-1b: beidseitige Verankerung — auch das img trägt dieselbe ID.
    expect(out).toContain(`<img data-image-id="${IMAGE_ID_PREFIX}tok123-1"`);
    expect(out).toContain(`<img data-image-id="${IMAGE_ID_PREFIX}tok123-2"`);
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
      imageRunToken: "run001",
    });
    expect(html).toContain("<figure>");
    expect(html).toContain(`data-image-id="${IMAGE_ID_PREFIX}run001-1"`);
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

// WP-BILD-1b (bens Auflage 1): bodyweit kollisionsfeste IDs. kw-img-N allein kollidiert, sobald zwei Importe
// in DENSELBEN Body fließen — der runToken (kw-img-<token>-N) verhindert das.
describe("WP-BILD-1b: kollisionsfeste Bild-IDs (runToken)", () => {
  function idsOf(html: string): string[] {
    return [...html.matchAll(/data-image-id="([^"]+)"/g)].map((m) => m[1] ?? "");
  }

  it("zwei Import-Läufe in EINEN Body → alle Bild-IDs eindeutig, keine Überschneidung", () => {
    const runA = wrapImagesInFigures(`<img src="${PNG}"><img src="${PNG}">`, PLACEHOLDER, "aaaaaa");
    const runB = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER, "bbbbbb");
    const body = `${runA}${runB}`;
    const ids = idsOf(body);
    // 3 Bilder × 2 Anker (img + figcaption) = 6 Vorkommen, aber nur 3 verschiedene IDs.
    expect(ids.length).toBe(6);
    expect(new Set(ids).size).toBe(3);
    // Kein Lauf-Token überschneidet sich — jede ID gehört eindeutig zu genau einem Import-Lauf.
    for (const id of new Set(ids)) {
      const fromA = id.startsWith(`${IMAGE_ID_PREFIX}aaaaaa-`);
      const fromB = id.startsWith(`${IMAGE_ID_PREFIX}bbbbbb-`);
      expect(fromA !== fromB).toBe(true);
    }
  });

  it("Einfügen in einen Body mit vorhandenen figures überschreibt bestehende IDs nie", () => {
    // Bestehender Body (früherer Import) mit fester ID; neuer Import wird nur an die ROH-Fragmente angelegt.
    const existing = `<figure><img data-image-id="${IMAGE_ID_PREFIX}old99-1" src="/api/objects/x/raw"><figcaption data-image-id="${IMAGE_ID_PREFIX}old99-1">alt</figcaption></figure>`;
    const fresh = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER, "new77");
    const merged = `${existing}${fresh}`;
    // Die bestehende ID bleibt unverändert erhalten …
    expect(merged).toContain(`${IMAGE_ID_PREFIX}old99-1`);
    // … und die neue ID kollidiert nicht mit ihr.
    expect(idsOf(fresh).every((id) => id !== `${IMAGE_ID_PREFIX}old99-1`)).toBe(true);
  });

  it("newImageRunToken liefert genau 6 Zeichen aus [a-z0-9] (Sanitizer-Token-Vertrag)", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(newImageRunToken()).toMatch(/^[a-z0-9]{6}$/);
    }
  });
});

// WP-BILD-1b (bens Auflage 2): beidseitige Verankerung — img UND figcaption tragen dieselbe data-image-id.
describe("WP-BILD-1b: img und figcaption teilen dieselbe ID", () => {
  it("pro Bild trägt sowohl <img> als auch <figcaption> exakt dieselbe data-image-id", () => {
    const out = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER, "share1");
    const id = `${IMAGE_ID_PREFIX}share1-1`;
    expect(out).toContain(`<img data-image-id="${id}"`);
    expect(out).toContain(`<figcaption data-image-id="${id}">`);
    // Genau zwei Anker mit dieser ID (Bild + Fußnote), gegenseitig auffindbar.
    expect(out.split(`data-image-id="${id}"`).length - 1).toBe(2);
  });

  it("beide Sanitizer erhalten data-image-id auch am img (gleiches Token-Muster)", () => {
    const markup = `<figure><img data-image-id="${IMAGE_ID_PREFIX}s2-1" src="/api/objects/x/raw"><figcaption data-image-id="${IMAGE_ID_PREFIX}s2-1">c</figcaption></figure>`;
    for (const sanitize of [clientSanitize, serverSanitize]) {
      const clean = sanitize(markup);
      expect(clean.split(`data-image-id="${IMAGE_ID_PREFIX}s2-1"`).length - 1).toBe(2);
    }
    // Böses Token am img wird verworfen (Vertrag gewahrt).
    const evilImg = '<img data-image-id="böse id" src="/api/objects/x/raw">';
    for (const sanitize of [clientSanitize, serverSanitize]) {
      expect(sanitize(evilImg)).not.toContain("data-image-id");
    }
  });
});

// WP-BILD-1b (bens Auflage 3): echter Save-/Reload-Roundtrip durch den SERVER-Sanitizer.
describe("WP-BILD-1b: Save-/Reload-Roundtrip (Server-Sanitizer)", () => {
  it("figure/img/figcaption mit editierter Caption bleibt beim Speichern und erneuten Laden erhalten", () => {
    const id = `${IMAGE_ID_PREFIX}round1-1`;
    const imported = wrapImagesInFigures(`<img src="${PNG}">`, PLACEHOLDER, "round1");
    // Nutzer editiert die Fußnote (ehrliche, echte Beschreibung statt Platzhalter).
    const edited = imported.replace(PLACEHOLDER, "Diagramm der Quartalszahlen");
    // Speichern = durch den autoritativen Server-Sanitizer.
    const saved = serverSanitize(edited);
    // Erneutes Laden = erneut sanitisieren → byte-gleich (idempotent, kein Verlust).
    const reloaded = serverSanitize(saved);
    expect(reloaded).toBe(saved);
    // Struktur + beide Anker + editierte Caption bleiben erhalten.
    expect(saved).toContain("<figure>");
    expect(saved).toContain("Diagramm der Quartalszahlen");
    expect(saved).not.toContain(PLACEHOLDER);
    expect(saved.split(`data-image-id="${id}"`).length - 1).toBe(2);
  });
});
