// WP-BILD-1d (Pedis Galerie-Feature): pure Ableitung der Beitrags-Bilder aus dem sanitisierten bodyHtml.
// Quelle sind die figures des DOCX- (BILD-1a/1b) und PPTX-Imports (WP-D9) — dieselbe figcaption wie im
// Body (keine Kopie). Plus Verdrahtungs-/i18n-Pins; die gemountete Render-Logik testet
// body-image-gallery-mounted.test.tsx.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { extractBodyImages } from "../../apps/web/src/lib/bodyImages";
import { wrapImagesInFigures } from "../../apps/web/src/lib/docx";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

describe("WP-BILD-1d: extractBodyImages", () => {
  it("liest DOCX-Markup (wrapImagesInFigures) — id, src; WP-D10: Import-Fußnote ist LEER", () => {
    const body = wrapImagesInFigures(
      `<img src="${PNG}"><p>x</p><img src="${PNG}">`,
      "Platzhalter",
      "tok111",
    );
    const images = extractBodyImages(body);
    expect(images.length).toBe(2);
    // WP-D10: frisch importierte Bilder haben ehrlich KEINE Beschreibung (leere figcaption) —
    // der Platzhalter-Parameter landet nie im Body.
    expect(images[0]).toEqual({ id: "kw-img-tok111-1", src: PNG, caption: "" });
    expect(images[1]?.id).toBe("kw-img-tok111-2");
  });

  it("liest PPTX-Markup (WP-D9-figure-Form, data-image-id VOR src); WP-D10: Alt-Platzhalter gilt als LEER", () => {
    const body =
      '<h2>Folie 1</h2><figure><img data-image-id="kw-img-abc123-1" src="data:image/jpeg;base64,QQ=="><figcaption data-image-id="kw-img-abc123-1">Noch keine Bildbeschreibung</figcaption></figure><p>Text</p>';
    const images = extractBodyImages(body);
    // WP-D10: der Alt-Platzhaltertext ist KEINE Beschreibung — die Galerie behandelt das Bild ehrlich
    // als „ohne Beschreibung" (caption leer), identisch zur neuen leeren Import-Fußnote.
    expect(images).toEqual([
      {
        id: "kw-img-abc123-1",
        src: "data:image/jpeg;base64,QQ==",
        caption: "",
      },
    ]);
  });

  it("figure OHNE data-image-id und lose <img> werden NICHT aufgenommen", () => {
    const body =
      `<figure><img src="${PNG}"><figcaption>ohne Anker</figcaption></figure>` +
      `<img src="${PNG}"><p>Text</p>`;
    expect(extractBodyImages(body)).toEqual([]);
  });

  it("leerer/fehlender Body und figure ohne img → leere Liste", () => {
    expect(extractBodyImages("")).toEqual([]);
    expect(extractBodyImages(null)).toEqual([]);
    expect(extractBodyImages(undefined)).toEqual([]);
    expect(extractBodyImages("<figure><figcaption>nur Text</figcaption></figure>")).toEqual([]);
  });

  it("Caption-Quelle ist der AKTUELLE Body: geänderte figcaption spiegelt sich sofort", () => {
    // WP-D10: der Import liefert eine LEERE Fußnote; der Nutzer tippt/ändert die Beschreibung im Editor.
    const imported = wrapImagesInFigures(`<img src="${PNG}">`, "Platzhalter", "tok222");
    const before = imported.replace("></figcaption>", ">Alte Beschreibung</figcaption>");
    const after = before.replace("Alte Beschreibung", "Neue, präzisere Beschreibung");
    expect(extractBodyImages(imported)[0]?.caption).toBe("");
    expect(extractBodyImages(before)[0]?.caption).toBe("Alte Beschreibung");
    expect(extractBodyImages(after)[0]?.caption).toBe("Neue, präzisere Beschreibung");
  });

  it("Caption wird als Klartext geliefert (Entities aufgelöst, Whitespace geglättet)", () => {
    const body =
      '<figure><img data-image-id="kw-img-a1-1" src="/api/objects/x/raw"><figcaption data-image-id="kw-img-a1-1">  Ventil &amp; Pumpe\n geprüft </figcaption></figure>';
    expect(extractBodyImages(body)[0]?.caption).toBe("Ventil & Pumpe geprüft");
  });
});

// WP-D9c (bens Galerie-Auflage 3): defensive src-Grenze — extractBodyImages vertraut dem bodyHtml-String
// nicht mehr blind (Legacy-Daten/Repo-Importe), sondern prüft die ZENTRALE isSafeImgSrc-Policy.
describe("WP-D9c: defensive src-Prüfung (zentrale isSafeImgSrc-Policy)", () => {
  function fig(imgAttrs: string): string {
    return `<figure><img ${imgAttrs}><figcaption data-image-id="kw-img-z1-1">c</figcaption></figure>`;
  }

  it("weist unsichere Quellen ab: javascript:, SVG-data-URL, Remote-http(s), data-src-Attribut", () => {
    // biome-ignore lint/a11y/noBlankTarget: reine String-Fixtures für den Negativ-Test.
    const cases = [
      fig('data-image-id="kw-img-z1-1" src="javascript:alert(1)"'),
      fig('data-image-id="kw-img-z1-1" src="data:image/svg+xml;base64,PHN2Zz4="'),
      fig('data-image-id="kw-img-z1-1" src="https://boese.example/x.png"'),
      fig('data-image-id="kw-img-z1-1" src="http://boese.example/x.png"'),
      // data-src darf NICHT als src gelesen werden (Attributname-Grenze) — ohne echtes src kein Eintrag.
      fig('data-image-id="kw-img-z1-1" data-src="data:image/png;base64,QQ=="'),
    ];
    for (const body of cases) {
      expect(extractBodyImages(body), body).toEqual([]);
    }
  });

  it("nimmt sichere Quellen an: interner Object-Raw-Pfad und erlaubte Raster-data-URLs", () => {
    const rawPath = fig('data-image-id="kw-img-z1-1" src="/api/objects/abc-123/raw"');
    expect(extractBodyImages(rawPath)[0]?.src).toBe("/api/objects/abc-123/raw");
    const png = fig('data-image-id="kw-img-z1-1" src="data:image/png;base64,QQ=="');
    expect(extractBodyImages(png)[0]?.src).toBe("data:image/png;base64,QQ==");
    const webp = fig('data-image-id="kw-img-z1-1" src="data:image/webp;base64,QQ=="');
    expect(extractBodyImages(webp).length).toBe(1);
  });

  it("nutzt DIESELBE zentrale Policy wie der Sanitizer (kein Duplikat)", () => {
    const lib = readFileSync(resolve(process.cwd(), "apps/web/src/lib/bodyImages.ts"), "utf8");
    expect(lib).toContain('import { isSafeImgSrc } from "./richText"');
    // Keine Zweitkopie der Muster in bodyImages.
    expect(lib).not.toContain("api\\/objects");
  });
});

describe("WP-BILD-1d: Verdrahtung + i18n", () => {
  it("KoRead rendert die Galerie unter dem Lese-Body (nur Leseansicht, keine neuen Routen)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/ko/KoRead.tsx"),
      "utf8",
    );
    expect(src).toContain("<BodyImageGallery bodyHtml={ko.bodyHtml} />");
  });

  it("Galerie-Texte existieren DE/EN/NL (Galerie, Bild n von m, Schließen, Blättern)", () => {
    for (const lng of ["de", "en", "nl"]) {
      for (const key of [
        "ko.gallery",
        "ko.galleryCount",
        "ko.galleryClose",
        "ko.galleryOpen",
        "ko.galleryPrev",
        "ko.galleryNext",
      ]) {
        expect(
          String(i18n.getResource(lng, "translation", key)).length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
      expect(String(i18n.getResource(lng, "translation", "ko.galleryCount"))).toContain("{{n}}");
    }
  });

  it("die Galerie ist ehrliche Leseansicht: kein contenteditable, kein Editier-Handler", () => {
    const src = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/BodyImageGallery.tsx"),
      "utf8",
    );
    expect(src).not.toContain("contenteditable");
    expect(src).not.toContain("onInput");
    // Kein Browser-alert/confirm in der Lightbox.
    expect(src).not.toMatch(/\balert\(|\bconfirm\(/);
  });
});
