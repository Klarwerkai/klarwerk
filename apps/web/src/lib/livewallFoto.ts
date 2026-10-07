// PMO-FEA-0003: das freiwillige Foto für die Live-Wand vorbereiten.
//
// Die Wand zeigt ein Porträt, kein Dokument. Ein gewähltes Bild wird deshalb im Browser auf
// höchstens FOTO_KANTE Pixel verkleinert und als JPEG-Daten-URL hochgeladen — so bleibt es sicher
// unter der Grenze des Servers (`LIVEWALL_FOTO_MAX_ZEICHEN`, livewall-fotos.ts), und die
// Original-Datei verlässt das Gerät nicht. Nur Rasterbilder; ein SVG lehnt schon die Auswahl ab.
const FOTO_KANTE = 192;
export const FOTO_TYPEN = ["image/png", "image/jpeg", "image/webp"] as const;

export async function fotoVorbereiten(datei: File): Promise<string> {
  if (!(FOTO_TYPEN as readonly string[]).includes(datei.type)) {
    throw new Error("typ");
  }
  const bild = await createImageBitmap(datei);
  const faktor = Math.min(1, FOTO_KANTE / Math.max(bild.width, bild.height));
  const breite = Math.max(1, Math.round(bild.width * faktor));
  const hoehe = Math.max(1, Math.round(bild.height * faktor));
  const leinwand = document.createElement("canvas");
  leinwand.width = breite;
  leinwand.height = hoehe;
  const kontext = leinwand.getContext("2d");
  if (!kontext) {
    throw new Error("leinwand");
  }
  kontext.drawImage(bild, 0, 0, breite, hoehe);
  bild.close();
  return leinwand.toDataURL("image/jpeg", 0.85);
}
