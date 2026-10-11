// ================================================================================================
// produkt:20261010:assistenz-name-avatar — DIE MIMIK DER MOTIVE MIT GESICHT (ANIMATIONSZUSTAENDE.json).
// ================================================================================================
//
// Die gelieferten Basisbilder sind Standbilder; Lidschlag, Mund- und Schnabelbewegung entstehen als
// Ebene ÜBER dem unveränderten Bild (`components/assistenz/AvatarMimik.tsx`, Regeln in `index.css`).
// Hier steht je Motiv, WO sein vorhandenes Gesicht liegt — in den Pixelkoordinaten des 1254 × 1254
// großen PNGs, durch Ansehen der gelieferten Dateien vermessen:
//   · `augen`  die beiden Augen (Mittelpunkt und Halbachsen); darüber schließt sich ein Lid in der
//              Farbe der Haut, des Gefieders oder des Bildschirms um das Auge;
//   · `mund`   die Mundöffnung bzw. der Spalt am Schnabel, die beim Sprechen auf- und zugeht;
//   · `lid`    die Farbe rund um die Augen.
//
// NUR die acht Motive des Stils „expressiv“ haben ein Gesicht und stehen hier. Die fünf sachlichen
// Objekte (Prisma, Wissensbuch, Verbindungsknoten, Monolith, Leuchtkreis) und die neutrale
// Ersatzgrafik bekommen KEINE Mimik — keine nachträglich erfundenen Augen oder Münder
// (ANIMATIONSZUSTAENDE.json, `rules` und `style_precedence`). Das Bild selbst bleibt bytegleich;
// das Original behält seine Identität.

/** Kantenlänge der gelieferten Basisbilder (MANIFEST.json, `size`). */
export const MIMIK_RASTER = 1254;

export interface MimikAuge {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface MimikGesicht {
  augen: readonly [MimikAuge, MimikAuge];
  mund: { x: number; y: number; rx: number; ry: number; farbe: string; art: "mund" | "schnabel" };
  lid: string;
}

const MIMIK_GESICHTER: Readonly<Record<string, MimikGesicht>> = {
  original: {
    augen: [
      { x: 482, y: 380, rx: 47, ry: 62 },
      { x: 737, y: 437, rx: 47, ry: 58 },
    ],
    mund: { x: 578, y: 512, rx: 34, ry: 22, farbe: "#1f2333", art: "mund" },
    lid: "#e2713a",
  },
  lichtwesen: {
    augen: [
      { x: 545, y: 597, rx: 66, ry: 72 },
      { x: 829, y: 525, rx: 50, ry: 70 },
    ],
    mund: { x: 712, y: 658, rx: 26, ry: 16, farbe: "#7a2e12", art: "mund" },
    lid: "#f8c46a",
  },
  roboter: {
    augen: [
      { x: 545, y: 428, rx: 64, ry: 64 },
      { x: 770, y: 410, rx: 60, ry: 62 },
    ],
    mund: { x: 683, y: 503, rx: 24, ry: 12, farbe: "#8fe0d6", art: "mund" },
    lid: "#2a2d31",
  },
  eule: {
    augen: [
      { x: 562, y: 408, rx: 78, ry: 78 },
      { x: 800, y: 500, rx: 74, ry: 70 },
    ],
    mund: { x: 652, y: 552, rx: 18, ry: 10, farbe: "#6b3f1c", art: "schnabel" },
    lid: "#ece3d2",
  },
  fuchs: {
    augen: [
      { x: 612, y: 537, rx: 57, ry: 62 },
      { x: 852, y: 475, rx: 50, ry: 64 },
    ],
    mund: { x: 775, y: 612, rx: 22, ry: 14, farbe: "#3a1d17", art: "mund" },
    lid: "#ea8a6c",
  },
  pinguin: {
    augen: [
      { x: 520, y: 415, rx: 50, ry: 58 },
      { x: 785, y: 378, rx: 42, ry: 55 },
    ],
    mund: { x: 690, y: 458, rx: 40, ry: 9, farbe: "#9a3f12", art: "schnabel" },
    lid: "#f2ece4",
  },
  wolke: {
    augen: [
      { x: 522, y: 515, rx: 50, ry: 55 },
      { x: 738, y: 577, rx: 50, ry: 55 },
    ],
    mund: { x: 595, y: 625, rx: 24, ry: 14, farbe: "#3b2a6b", art: "mund" },
    lid: "#c1b8f2",
  },
  kompass: {
    augen: [
      { x: 540, y: 522, rx: 50, ry: 58 },
      { x: 800, y: 577, rx: 46, ry: 56 },
    ],
    mund: { x: 663, y: 688, rx: 30, ry: 16, farbe: "#253a33", art: "mund" },
    lid: "#f2e8d0",
  },
};

/** Das Gesicht eines Motivs — oder `null` für sachliche Objekte, Ersatzgrafik und Unbekanntes. */
export function mimikGesicht(motivId: string | null | undefined): MimikGesicht | null {
  if (!motivId || !Object.hasOwn(MIMIK_GESICHTER, motivId)) {
    return null;
  }
  return MIMIK_GESICHTER[motivId] ?? null;
}
