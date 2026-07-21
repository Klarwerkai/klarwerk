// WP-BILD-1f (bens P3): STRIKTE, FRÜHE Validierung der describe-Bild-Daten an der Route — VOR
// jedem Provider-/HTTP-Aufruf. Abgelehnt wird deterministisch und ehrlich:
//  - "format":         keine data:image-URL der vier sicheren Rasterformate (SVG & Co. → raus)
//  - "base64":         defekte Base64 (Zeichensatz/Länge/Padding — nicht nur grob plausibel)
//  - "too-large":      die DEKODIERTE Bytegrenze ist überschritten (nicht nur die String-Länge;
//                      die Größe wird ARITHMETISCH aus Länge+Padding bestimmt — ein zu großes
//                      Bild wird nie erst in einen Buffer materialisiert)
//  - "magic-mismatch": die deklarierte MIME passt nicht zu den MAGIC BYTES des Inhalts
import { parseImageDataUrl } from "./model-client";

// Autoritative Grenze: DEKODIERTE Bytes des Bildes (die „max. 5 MB" der Nutzer-Meldung).
export const MAX_DESCRIBE_IMAGE_BYTES = 5 * 1024 * 1024;

export type DescribeImageRejection = "format" | "base64" | "too-large" | "magic-mismatch";

export type DescribeImageVerdict =
  | { ok: true; mediaType: string; bytes: number }
  | { ok: false; code: DescribeImageRejection };

// Strikte Base64-Form: nur Basiszeichen, Padding (max. 2 „=") ausschließlich am Ende, Gesamtlänge
// in Vierergruppen. BEWUSST ohne Gruppen-Wiederholung im Regex — ein (?:…{4})*-Muster läuft bei
// megabyte-großen Eingaben in einen Regex-Stack-Überlauf; die einfache Zeichenklassen-Prüfung ist
// stack-sicher und linear.
const BASE64_BODY_RE = /^[A-Za-z0-9+/]*={0,2}$/;

function isStrictBase64(base64: string): boolean {
  return base64.length > 0 && base64.length % 4 === 0 && BASE64_BODY_RE.test(base64);
}

function decodedByteLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

// Datei-Signaturen der vier erlaubten Rasterformate.
function magicMatches(mediaType: string, bytes: Buffer): boolean {
  switch (mediaType) {
    case "image/png":
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/gif":
      return bytes.length >= 6 && bytes.toString("latin1", 0, 4) === "GIF8";
    case "image/webp":
      return (
        bytes.length >= 12 &&
        bytes.toString("latin1", 0, 4) === "RIFF" &&
        bytes.toString("latin1", 8, 12) === "WEBP"
      );
    default:
      return false;
  }
}

export function validateDescribeImageDataUrl(dataUrl: unknown): DescribeImageVerdict {
  if (typeof dataUrl !== "string") {
    return { ok: false, code: "format" };
  }
  // parseImageDataUrl erzwingt bereits data:image/(png|jpeg|gif|webp);base64,<charset> — SVG,
  // fremde MIMEs und Nicht-data-URLs enden hier.
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) {
    return { ok: false, code: "format" };
  }
  if (!isStrictBase64(parsed.base64)) {
    return { ok: false, code: "base64" };
  }
  const bytes = decodedByteLength(parsed.base64);
  if (bytes > MAX_DESCRIBE_IMAGE_BYTES) {
    return { ok: false, code: "too-large" };
  }
  const decoded = Buffer.from(parsed.base64, "base64");
  if (!magicMatches(parsed.mediaType, decoded)) {
    return { ok: false, code: "magic-mismatch" };
  }
  return { ok: true, mediaType: parsed.mediaType, bytes };
}
