// AUFTRAG-mega89 Block B — DIE GALERIE VERLOR EIN BILD, UND DAS ÜBRIGE BEKAM DIE FALSCHE FUSSNOTE.
//
// DER BEFUND, am Quelltext nachgemessen: `extractBodyImages` zerlegte den Body mit
// `/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi`. Der Stern ist NICHT-GIERIG — bei einer figure IN einer
// figure endet der Abschnitt der ÄUSSEREN am INNEREN `</figure>`. Das erste Bild wurde daher mit
// der ersten INNEREN Fußnote kombiniert, und der zweite Galerieeintrag ging ganz verloren
// (`bodyImages.ts:66`, `:71`, `:42` in der Fassung vor mega89).
//
// WAS HIER GEMESSEN WIRD: die Galerie zeigt BEIDE Bilder mit der JEWEILS RICHTIGEN Beschreibung —
// bei verschachteltem Bestand, bei einer eingehenden Mehrbild-figure aus Word und (unverändert) im
// flachen Normalfall. Gepaart wird über die stabile gemeinsame `data-image-id`, nicht über die
// Verschachtelung; der Rückfall in Reihenfolge trägt den Altbestand, dessen Fußnote noch gar keine
// Kennung hat.
//
// UND DIE SERVERGRENZE BLEIBT, WO SIE IST: `services/structure/src/captions.ts` (der Zwilling für
// das persistierte Suchfeld) paart überhaupt nicht — er sammelt Fußnotentexte. Er ist deshalb von
// der Verschachtelung nie betroffen gewesen und bleibt unverändert. Dass die Parität hält, wird
// hier gemessen statt behauptet.
import { describe, expect, it } from "vitest";
import { extractBodyImages } from "../../apps/web/src/lib/bodyImages";
import { imageCaptionTexts } from "../../services/structure/src/captions";

const A = "/api/objects/bild-a/raw";
const B = "/api/objects/bild-b/raw";

// So sah der Bestand aus, den die Fassung vor mega89 aus Word-Markup erzeugt hat.
const VERSCHACHTELT = [
  "<h2>Befund</h2>",
  `<figure><img src="${A}" data-image-id="kw-img-alt-1">`,
  `<figure><img src="${B}" data-image-id="kw-img-alt-2">`,
  '<figcaption data-image-id="kw-img-alt-2">Lagerschale, Innenring</figcaption></figure>',
  '<figcaption data-image-id="kw-img-alt-1">Riefen in Laufrichtung</figcaption></figure>',
].join("");

// So kommt es aus Word herein, wenn es ohne Editor gespeichert wird (Klara, API-Aufrufer).
const EINE_FIGUR_ZWEI_BILDER = [
  `<figure><img src="${A}" data-image-id="kw-img-alt-1">`,
  `<img src="${B}" data-image-id="kw-img-alt-2">`,
  '<figcaption data-image-id="kw-img-alt-1">Riefen in Laufrichtung</figcaption></figure>',
].join("");

const FLACH = [
  `<figure><img src="${A}" data-image-id="kw-img-alt-1">`,
  '<figcaption data-image-id="kw-img-alt-1">Riefen in Laufrichtung</figcaption></figure>',
  `<figure><img src="${B}" data-image-id="kw-img-alt-2">`,
  '<figcaption data-image-id="kw-img-alt-2">Lagerschale, Innenring</figcaption></figure>',
].join("");

// Altbestand aus der Zeit vor WP-BILD-1b: das Bild trägt eine Kennung, die Fußnote nicht.
const OHNE_KENNUNG_AN_DER_FUSSNOTE = `<figure><img src="${A}" data-image-id="kw-img-alt-1"><figcaption>Riefen in Laufrichtung</figcaption></figure>`;

describe("AUFTRAG-mega89 Block B: die Galerie paart über die Kennung, nicht über Verschachtelung", () => {
  it("verschachtelter Bestand: BEIDE Bilder erscheinen, jedes mit SEINER Beschreibung", () => {
    const bilder = extractBodyImages(VERSCHACHTELT);
    expect(
      bilder.length,
      "Der zweite Galerieeintrag ist verloren gegangen — die nicht-gierige figure-Zerlegung endet am inneren </figure>",
    ).toBe(2);
    expect(bilder.map((b) => ({ src: b.src, caption: b.caption }))).toEqual([
      { src: A, caption: "Riefen in Laufrichtung" },
      { src: B, caption: "Lagerschale, Innenring" },
    ]);
  });

  it("eine eingehende figure mit zwei Bildern: beide erscheinen, der Text bleibt beim ersten", () => {
    const bilder = extractBodyImages(EINE_FIGUR_ZWEI_BILDER);
    expect(bilder.length, "Das zweite Bild fehlt in der Galerie").toBe(2);
    expect(bilder.map((b) => ({ src: b.src, caption: b.caption }))).toEqual([
      { src: A, caption: "Riefen in Laufrichtung" },
      { src: B, caption: "" },
    ]);
  });

  it("der flache Normalfall bleibt Zeichen für Zeichen derselbe", () => {
    expect(extractBodyImages(FLACH)).toEqual([
      { id: "kw-img-alt-1", src: A, caption: "Riefen in Laufrichtung" },
      { id: "kw-img-alt-2", src: B, caption: "Lagerschale, Innenring" },
    ]);
  });

  it("Altbestand ohne Kennung an der Fußnote wird weiterhin gepaart", () => {
    expect(extractBodyImages(OHNE_KENNUNG_AN_DER_FUSSNOTE)).toEqual([
      { id: "kw-img-alt-1", src: A, caption: "Riefen in Laufrichtung" },
    ]);
  });

  it("bei MEHREREN Bildern wandert eine fremd gekennzeichnete Fußnote an KEINES von ihnen", () => {
    // Zwei Bilder, eine Fußnote mit einer Kennung, die zu keinem gehört. Hier ist „welches Bild
    // ist gemeint" nicht beantwortbar — und eine geratene Antwort ist genau der Datenschaden.
    const html = [
      `<figure><img src="${A}" data-image-id="kw-img-alt-1">`,
      `<img src="${B}" data-image-id="kw-img-alt-2">`,
      '<figcaption data-image-id="kw-img-fremd-9">Gehört woanders hin</figcaption></figure>',
    ].join("");
    expect(extractBodyImages(html)).toEqual([
      { id: "kw-img-alt-1", src: A, caption: "" },
      { id: "kw-img-alt-2", src: B, caption: "" },
    ]);
  });

  it("bei EINEM Bild bleibt die Zuordnung genau wie bisher — auch bei abweichender Kennung", () => {
    // Kein Rückschritt an einer Stelle, die nie kaputt war: in einer figure mit genau EINEM Bild
    // ist „die Fußnote dieser figure" eindeutig, unabhängig von der Kennung.
    const html = `<figure><img src="${A}" data-image-id="kw-img-alt-1"><figcaption data-image-id="kw-img-fremd-9">Riefen in Laufrichtung</figcaption></figure>`;
    expect(extractBodyImages(html)).toEqual([
      { id: "kw-img-alt-1", src: A, caption: "Riefen in Laufrichtung" },
    ]);
  });

  it("ein Bild außerhalb jeder figure kommt weiterhin NICHT in die Galerie", () => {
    expect(extractBodyImages(`<p><img src="${A}" data-image-id="kw-img-alt-1"></p>`)).toEqual([]);
  });
});

describe("AUFTRAG-mega89 Block B: der Server-Zwilling bleibt unberührt — die Parität hält", () => {
  it("das persistierte Suchfeld liest aus verschachtelt und flach DIESELBEN Texte", () => {
    expect(imageCaptionTexts(VERSCHACHTELT)).toEqual([
      "Lagerschale, Innenring",
      "Riefen in Laufrichtung",
    ]);
    // Flach gemacht steht derselbe Bestand in Lesereihenfolge — und beide Texte sind weiterhin da.
    expect(new Set(imageCaptionTexts(FLACH))).toEqual(new Set(imageCaptionTexts(VERSCHACHTELT)));
  });

  it("das Flachmachen erzeugt LEERE Fußnoten — und die stehen nie im Suchfeld", () => {
    expect(imageCaptionTexts(EINE_FIGUR_ZWEI_BILDER)).toEqual(["Riefen in Laufrichtung"]);
  });
});
