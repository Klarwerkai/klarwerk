// ================================================================================================
// R-0125 / Befund 10 — DIE BILDFORMATLISTE GILT AN JEDER STELLE GLEICH.
// ================================================================================================
//
// Die Quelle zu R-0125 verlangt, Bildformate gegen EINE serverseitige Liste zu prüfen, und nennt
// die wortgleiche Zweitfassung im Client (`apps/web/src/lib/richText.ts`, `isSafeImgSrc`). Ein
// Paritätstest soll rot werden, wenn beide auseinanderlaufen.
// tests/security/job2675-sanitizer-attribut-escape.test.ts hält ausdrücklich fest, dass dieser
// Test (JOB 2656 D3) im Bestand fehlt, und deckt selbst nur die Attribut-Escapes ab — nicht die
// Bild-Allowlist.
//
// Warum das für die Bildbilanz zählt: Die Route `/api/drafts/from-docx` zählt die eingebetteten
// Bilder auf dem GESPEICHERTEN Stand (JOB 2912 D1), die Galerie im Entwurf zählt mit
// `extractBodyImages` → `isSafeImgSrc` (Client). Lassen beide Listen verschiedene Formate durch,
// melden Antwort und Galerie zwei verschiedene Zahlen über denselben Entwurf — oder die Galerie
// zeigt ein Bild, das der Server beim Speichern still verwirft.
//
// Geprüft wird VERHALTEN, nicht Quelltext: dieselbe Eingabe durch beide Sanitizer, dazu die
// Client-Stellen, die laut ihrem eigenen Kommentar mit `isSafeImgSrc` konsistent bleiben müssen
// (`editorDropPaste.ts`, `editorImages.ts`).
import { describe, expect, it } from "vitest";
import { extractBodyImages } from "../../apps/web/src/lib/bodyImages";
import { isInsertableImageMime } from "../../apps/web/src/lib/editorDropPaste";
import { editorImagesFromLocalImages } from "../../apps/web/src/lib/editorImages";
import { sanitizeHtml as clientSanitize, isSafeImgSrc } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";

// Gängige Bildtypen aus Word, PowerPoint und Browser — darunter die, die der Sanitizer verwirft
// (EMF/WMF aus eingefügten Grafiken, SVG als XSS-Vektor, TIFF/BMP/AVIF/HEIC).
const MIME_TYPEN = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/PNG",
  "image/bmp",
  "image/tiff",
  "image/avif",
  "image/heic",
  "image/svg+xml",
  "image/x-emf",
  "image/x-wmf",
  "image/emf",
] as const;

const NUTZLAST = "iVBORw0KGgo=";

function dataUrl(mime: string): string {
  return `data:${mime};base64,${NUTZLAST}`;
}

/** Hat der Sanitizer genau dieses Bild im Ergebnis stehen lassen? */
function behalten(sanitize: (html: string) => string, src: string): boolean {
  return sanitize(`<p><img src="${src}" alt="x"></p>`).includes(`src="${src}"`);
}

const QUELLEN: readonly string[] = [
  ...MIME_TYPEN.map(dataUrl),
  "DATA:image/png;BASE64,iVBORw0KGgo=",
  "data:image/png,iVBORw0KGgo=",
  "/api/objects/abc-123/raw",
  "/api/objects/abc/../raw",
  "https://example.invalid/bild.png",
  "javascript:alert(1)",
];

describe("R-0125 · eine Bildformatliste: Server und Client lassen dieselben Bilder durch", () => {
  it.each(QUELLEN)("%s — Server-Sanitizer und Client-Sanitizer entscheiden gleich", (src) => {
    const server = behalten(serverSanitize, src);
    const client = behalten(clientSanitize, src);
    expect(client, `Client ${client ? "behält" : "verwirft"}, Server nicht`).toBe(server);
  });

  it.each(QUELLEN)("%s — die Galerie-Policy (isSafeImgSrc) folgt dem Server", (src) => {
    expect(isSafeImgSrc(src)).toBe(behalten(serverSanitize, src));
  });

  it.each(MIME_TYPEN)("%s — der Einfügeweg im Editor nimmt nur, was der Server behält", (mime) => {
    const server = behalten(serverSanitize, dataUrl(mime));
    expect(isInsertableImageMime(mime), "editorDropPaste").toBe(server);
    const lokal = editorImagesFromLocalImages([
      { id: "1", name: "bild", mime, dataUrl: dataUrl(mime) },
    ]);
    expect(lokal.length === 1, "editorImages").toBe(server);
  });

  it("die Galerie zählt im gespeicherten Stand dieselben Bilder, die der Server behalten hat", () => {
    // Derselbe Rumpf wie nach einem Word-Import mit Bildfussnoten: ein heiles PNG, ein EMF, ein SVG.
    const roh = [
      `<figure><img src="${dataUrl("image/png")}" data-image-id="kw-img-p1-1"><figcaption data-image-id="kw-img-p1-1">A</figcaption></figure>`,
      `<figure><img src="${dataUrl("image/x-emf")}" data-image-id="kw-img-p1-2"><figcaption data-image-id="kw-img-p1-2">B</figcaption></figure>`,
      `<figure><img src="${dataUrl("image/svg+xml")}" data-image-id="kw-img-p1-3"><figcaption data-image-id="kw-img-p1-3">C</figcaption></figure>`,
    ].join("");
    const gespeichert = serverSanitize(roh);
    const imServer = (gespeichert.match(/<img\b[^>]*\bsrc="data:image\//g) ?? []).length;
    expect(extractBodyImages(gespeichert)).toHaveLength(imServer);
    expect(extractBodyImages(clientSanitize(roh))).toHaveLength(imServer);
  });
});

describe("R-0125 · Kalibrierung: der Vergleich unterscheidet wirklich", () => {
  it("ein PNG bleibt auf beiden Seiten stehen", () => {
    expect(behalten(serverSanitize, dataUrl("image/png"))).toBe(true);
    expect(behalten(clientSanitize, dataUrl("image/png"))).toBe(true);
  });

  it("SVG und EMF fallen auf beiden Seiten weg — sonst wäre „gleich“ auch bei Nichtstun wahr", () => {
    for (const mime of ["image/svg+xml", "image/x-emf"]) {
      expect(behalten(serverSanitize, dataUrl(mime)), mime).toBe(false);
      expect(behalten(clientSanitize, dataUrl(mime)), mime).toBe(false);
    }
  });
});
