// R-0014 (entscheidung:65ba473c, „Zusätzlich freies Ziehen an Griffen"): DOM-freie Helfer für die
// frei gezogene Bildbreite im Editor.
//
// DIE REPRÄSENTATION: das HTML-eigene `width`-Attribut am <img>, ausschließlich als Prozentwert der
// Spaltenbreite mit höchstens einer Nachkommastelle („37.5%"). Kein `style`, kein neues Tag — der
// Browser rendert den Wert als Darstellungshinweis, in Editor UND Lesefassung, ohne Zusatz-CSS.
// Pixelwerte (z. B. Word-Paste `width="600"`) bleiben verworfen: eine Pixelbreite passte nur zu
// genau einer Fensterbreite.
//
// Die vier Stufen (`data-kw-scale` 25/50/75/100) bleiben UNVERÄNDERT ihr eigener, enger Vertrag.
// Der Editor führt immer genau eine der beiden Angaben: eine Stufe löscht die gezogene Breite, ein
// Zug löscht die Stufe. Steht trotzdem beides im Markup, gewinnt die gezogene Breite (index.css).
//
// Spiegel: `services/structure/src/sanitize.ts` (`sanitizeImageWidth`) — dieselbe Regel.

export const IMAGE_WIDTH_MIN_PERCENT = 10;
export const IMAGE_WIDTH_MAX_PERCENT = 100;

const IMAGE_WIDTH_RE = /^(\d{1,3}(?:\.\d)?)%$/;

// Endlicher Prozentwert → kanonische Attributform, auf eine Nachkommastelle gerundet und in die
// Grenzen geklemmt. Nicht-endliche Eingaben ergeben `null` (nichts wird gesetzt).
export function formatImageWidth(percent: number): string | null {
  if (!Number.isFinite(percent)) {
    return null;
  }
  const geklemmt = Math.min(IMAGE_WIDTH_MAX_PERCENT, Math.max(IMAGE_WIDTH_MIN_PERCENT, percent));
  const gerundet = Math.round(geklemmt * 10) / 10;
  return Number.isInteger(gerundet) ? `${gerundet}%` : `${gerundet.toFixed(1)}%`;
}

// Sanitizer-Regel: nur ein gültiger Wert INNERHALB der Grenzen wird übernommen — und zwar in
// kanonischer Form (Fixpunkt: normalize(normalize(x)) === normalize(x)). Alles andere: `null`.
export function normalizeImageWidth(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const m = IMAGE_WIDTH_RE.exec(value.trim());
  if (!m) {
    return null;
  }
  const percent = Number(m[1]);
  if (
    !Number.isFinite(percent) ||
    percent < IMAGE_WIDTH_MIN_PERCENT ||
    percent > IMAGE_WIDTH_MAX_PERCENT
  ) {
    return null;
  }
  return formatImageWidth(percent);
}

export function imageWidthPercent(value: string | null | undefined): number | null {
  const kanonisch = normalizeImageWidth(value);
  return kanonisch === null ? null : Number(kanonisch.slice(0, -1));
}

// Welche Kante der Griff bewegt: rechte Griffe vergrößern nach rechts, linke nach links.
export type ResizeKante = "links" | "rechts";

export interface ResizeStart {
  // Dargestellte Bildbreite beim Griff-Druck (px).
  startBreitePx: number;
  // Breite der Spalte, auf die sich der Prozentwert bezieht (px).
  spaltenBreitePx: number;
  kante: ResizeKante;
}

// Zeigerweg → neue Breite in Prozent der Spalte, geklemmt. `null`, wenn die Messung unbrauchbar ist
// (Spalte ohne Breite, nicht-endliche Zahlen) — dann bleibt das Bild, wie es ist.
export function breiteAusZug(start: ResizeStart, deltaXPx: number): number | null {
  const { startBreitePx, spaltenBreitePx, kante } = start;
  if (
    !Number.isFinite(startBreitePx) ||
    !Number.isFinite(spaltenBreitePx) ||
    !Number.isFinite(deltaXPx) ||
    spaltenBreitePx <= 0
  ) {
    return null;
  }
  const breitePx = startBreitePx + (kante === "rechts" ? deltaXPx : -deltaXPx);
  const percent = (breitePx / spaltenBreitePx) * 100;
  return Math.min(IMAGE_WIDTH_MAX_PERCENT, Math.max(IMAGE_WIDTH_MIN_PERCENT, percent));
}
