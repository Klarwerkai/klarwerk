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
  it("liest DOCX-Markup (wrapImagesInFigures) — id, src und Caption", () => {
    const body = wrapImagesInFigures(
      `<img src="${PNG}"><p>x</p><img src="${PNG}">`,
      "Platzhalter",
      "tok111",
    );
    const images = extractBodyImages(body);
    expect(images.length).toBe(2);
    expect(images[0]).toEqual({ id: "kw-img-tok111-1", src: PNG, caption: "Platzhalter" });
    expect(images[1]?.id).toBe("kw-img-tok111-2");
  });

  it("liest PPTX-Markup (WP-D9-figure-Form, data-image-id VOR src)", () => {
    const body =
      '<h2>Folie 1</h2><figure><img data-image-id="kw-img-abc123-1" src="data:image/jpeg;base64,QQ=="><figcaption data-image-id="kw-img-abc123-1">Noch keine Bildbeschreibung</figcaption></figure><p>Text</p>';
    const images = extractBodyImages(body);
    expect(images).toEqual([
      {
        id: "kw-img-abc123-1",
        src: "data:image/jpeg;base64,QQ==",
        caption: "Noch keine Bildbeschreibung",
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
    const before = wrapImagesInFigures(`<img src="${PNG}">`, "Alte Beschreibung", "tok222");
    const after = before.replace("Alte Beschreibung", "Neue, präzisere Beschreibung");
    expect(extractBodyImages(before)[0]?.caption).toBe("Alte Beschreibung");
    expect(extractBodyImages(after)[0]?.caption).toBe("Neue, präzisere Beschreibung");
  });

  it("Caption wird als Klartext geliefert (Entities aufgelöst, Whitespace geglättet)", () => {
    const body =
      '<figure><img data-image-id="kw-img-a1-1" src="/api/objects/x/raw"><figcaption data-image-id="kw-img-a1-1">  Ventil &amp; Pumpe\n geprüft </figcaption></figure>';
    expect(extractBodyImages(body)[0]?.caption).toBe("Ventil & Pumpe geprüft");
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
