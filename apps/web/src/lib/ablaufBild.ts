// BILDSCHIRMABLÄUFE — der Browser-Teil des Schwärzens (Canvas). Die Pixelregel selbst steht DOM-frei
// in `./ablaufSchwaerzen.ts`; Begründung (Pixel statt Überlagerung, Neukodierung) ebenda.
import { type Rechteck, schwaerzePixel } from "./ablaufSchwaerzen";

function ladeBild(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("bild-nicht-lesbar"));
    img.src = src;
  });
}

/**
 * Schwärzt die Bereiche im Bild und liefert ein NEU kodiertes PNG als data-URL.
 * Wirft, wenn das Bild nicht lesbar ist — der Aufrufer behält dann das unveränderte Bild und sagt es.
 */
export async function schwaerzeBild(src: string, bereiche: readonly Rechteck[]): Promise<string> {
  const img = await ladeBild(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("kein-canvas");
  }
  ctx.drawImage(img, 0, 0);
  const daten = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (const b of bereiche) {
    schwaerzePixel(daten.data, canvas.width, canvas.height, b);
  }
  ctx.putImageData(daten, 0, 0);
  return canvas.toDataURL("image/png");
}
