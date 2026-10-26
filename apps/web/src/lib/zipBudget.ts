// Derselbe budgetierte ZIP-Kern wird für PPTX, XLSX und die DOCX-Vorprüfung genutzt.
export type PptxUnzip = (data: Uint8Array) => Record<string, Uint8Array>;
export const PPTX_MAX_ENTRIES = 5000; // Backstop-Cap für assertArchiveWithinBudget (gefilterte Menge)
export const PPTX_MAX_TOTAL_DECOMPRESSED_BYTES = 64 * 1024 * 1024; // 64 MiB
export const PPTX_MAX_ARCHIVE_ENTRIES = 4000;
export const PPTX_MAX_SLIDE_ENTRIES = 2000;
export const PPTX_MAX_ENTRY_EXPANSION_RATIO = 100;
export const PPTX_NEEDED_ENTRY_RE =
  /^ppt\/(?:presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels|media\/[^/]+)$/;
const PPTX_SLIDE_ENTRY_RE = /^ppt\/slides\/slide\d+\.xml$/;

export type PptxImportErrorReason =
  | "file-too-large"
  | "archive-too-large"
  | "too-many-entries"
  | "expansion-ratio"
  // WP-D5d (GELB-Härtung 3): zu viele/zu lange Namespace-Präfixe (entartetes XML).
  | "too-many-namespaces";

export class PptxTooLargeError extends Error {
  readonly reason: PptxImportErrorReason;
  constructor(reason: PptxImportErrorReason) {
    super(`PPTX_TOO_LARGE:${reason}`);
    this.name = "PptxTooLargeError";
    this.reason = reason;
  }
}

export function assertArchiveWithinBudget(
  files: Record<string, Uint8Array>,
  limits: { maxEntries?: number | undefined; maxTotalBytes?: number | undefined } = {},
): void {
  const maxEntries = limits.maxEntries ?? PPTX_MAX_ENTRIES;
  const maxTotalBytes = limits.maxTotalBytes ?? PPTX_MAX_TOTAL_DECOMPRESSED_BYTES;
  const names = Object.keys(files);
  if (names.length > maxEntries) {
    throw new PptxTooLargeError("too-many-entries");
  }
  let total = 0;
  for (const name of names) {
    total += files[name]?.byteLength ?? 0;
    if (total > maxTotalBytes) {
      throw new PptxTooLargeError("archive-too-large");
    }
  }
}

// WP-D5c/WP-D5d (bens ROT-Fix 2): ZIP-Eintrags-Metadaten. size/originalSize sind DEKLARIERTE Angaben des
// Archivs — bei Streaming-Entpacken können sie fehlen (undefined). Sie dienen nur als billiger Vorfilter;
// die harte Garantie ist die Ist-Byte-Zählung (addOutputBytes).
export interface PptxZipEntryMeta {
  name: string;
  compressedSize?: number | undefined;
  originalSize?: number | undefined;
}

export interface PptxUnzipBudgetLimits {
  maxArchiveEntries?: number;
  maxSlideEntries?: number;
  maxTotalDecompressedBytes?: number;
  maxEntryExpansionRatio?: number;
  // R-0179 (Excel-Import): dasselbe Budget für ein anderes OOXML-Archiv. `neededEntry` ersetzt die
  // PPTX-Namensliste, `countedEntry` die Folien-Untermenge unter `maxSlideEntries`. Ohne Angabe gilt
  // unverändert der PPTX-Vertrag.
  neededEntry?: RegExp;
  countedEntry?: RegExp;
}

// undefined = unbekannt (Streaming, keine Metadaten) → NICHT fail-closed; bad = vorhanden aber korrupt
// (NaN/negativ) → fail-closed; sonst die Zahl.
function sizeState(v: number | undefined): "unknown" | "bad" | number {
  if (v === undefined) {
    return "unknown";
  }
  if (!Number.isFinite(v) || v < 0) {
    return "bad";
  }
  return v;
}

// WP-D5c/WP-D5d (bens ROT-Fix 2): zustandsbehaftetes Budget. `accept` läuft je Eintrag VOR der
// Dekompression (Name-Caps + billige DEKLARIERTE-Größen-Sanity); `addOutputBytes` zählt die ECHTEN
// dekomprimierten Bytes während des Streamings und bricht ab, sobald das Budget (pro Eintrag ODER
// kumuliert) fällt — damit ist eine MANIPULIERTE originalSize egal, die reale Arbeit ist gedeckelt.
// Durchgesetzt:
//  - JEDER gesehene Eintrag zählt gegen den Archiv-Iterations-Cap;
//  - nur benötigte Einträge (PPTX_NEEDED_ENTRY_RE) werden akzeptiert;
//  - FAIL-CLOSED bei WIDERSPRÜCHLICHEN deklarierten Größen: NaN/negativ, oder Null-Denominator
//    (originalSize>0 aber compressedSize<=0) → inkonsistente Metadaten; FEHLENDE Größen (Streaming) sind
//    KEIN Fehler, weil die Ist-Byte-Zählung greift;
//  - Expansionsratio-Prüfung für jeden nichtleeren Eintrag mit bekannten Größen;
//  - deklariertes Vorab-Budget als Vorfilter; die harte Grenze ist addOutputBytes;
//  - harter Cap auf akzeptierte slideN.xml-Einträge.
export function createPptxUnzipBudget(limits: PptxUnzipBudgetLimits = {}): {
  accept(entry: PptxZipEntryMeta): boolean;
  beginEntry(): void;
  addOutputBytes(n: number): void;
  stats(): { seen: number; acceptedSlides: number; totalOriginal: number; totalReal: number };
} {
  const maxArchiveEntries = limits.maxArchiveEntries ?? PPTX_MAX_ARCHIVE_ENTRIES;
  const maxSlideEntries = limits.maxSlideEntries ?? PPTX_MAX_SLIDE_ENTRIES;
  const maxTotalBytes = limits.maxTotalDecompressedBytes ?? PPTX_MAX_TOTAL_DECOMPRESSED_BYTES;
  const maxRatio = limits.maxEntryExpansionRatio ?? PPTX_MAX_ENTRY_EXPANSION_RATIO;
  const neededEntry = limits.neededEntry ?? PPTX_NEEDED_ENTRY_RE;
  const countedEntry = limits.countedEntry ?? PPTX_SLIDE_ENTRY_RE;
  let seen = 0;
  let acceptedSlides = 0;
  let totalOriginal = 0;
  let totalReal = 0;
  let realEntry = 0;
  return {
    accept(entry: PptxZipEntryMeta): boolean {
      seen += 1;
      if (seen > maxArchiveEntries) {
        throw new PptxTooLargeError("too-many-entries");
      }
      if (!neededEntry.test(entry.name)) {
        return false;
      }
      const cs = sizeState(entry.compressedSize);
      const os = sizeState(entry.originalSize);
      // Korrupte deklarierte Größe (vorhanden aber NaN/negativ) → fail-closed.
      if (cs === "bad" || os === "bad") {
        throw new PptxTooLargeError("archive-too-large");
      }
      // Null-Denominator / inkonsistente Metadaten: originalSize>0 aber compressedSize<=0.
      if (typeof os === "number" && os > 0 && typeof cs === "number" && cs <= 0) {
        throw new PptxTooLargeError("archive-too-large");
      }
      // Ratio nur bei bekannten Größen und compressed>0 (billiger Vorfilter).
      if (typeof cs === "number" && typeof os === "number" && cs > 0 && os / cs > maxRatio) {
        throw new PptxTooLargeError("expansion-ratio");
      }
      if (typeof os === "number") {
        totalOriginal += os;
        if (totalOriginal > maxTotalBytes) {
          throw new PptxTooLargeError("archive-too-large");
        }
      }
      if (countedEntry.test(entry.name)) {
        acceptedSlides += 1;
        if (acceptedSlides > maxSlideEntries) {
          throw new PptxTooLargeError("too-many-entries");
        }
      }
      return true;
    },
    beginEntry(): void {
      realEntry = 0;
    },
    addOutputBytes(n: number): void {
      realEntry += n;
      totalReal += n;
      // Ist-Byte-Garantie: pro Eintrag UND kumuliert — unabhängig von der deklarierten Größe.
      if (realEntry > maxTotalBytes || totalReal > maxTotalBytes) {
        throw new PptxTooLargeError("archive-too-large");
      }
    },
    stats() {
      return { seen, acceptedSlides, totalOriginal, totalReal };
    },
  };
}

// WP-D5d (bens ROT-Fix 2): schmaler fflate-STREAMING-Vertrag (nur das Genutzte). Der Handler bekommt je
// Datei einen Stream; `start()` beginnt die Dekompression, `ondata` liefert die ECHTEN Chunks, `terminate`
// bricht ab. Die deklarierte originalSize ist damit irrelevant — gezählt werden die tatsächlichen Bytes.
export interface FflateUnzipFileStream {
  name: string;
  size?: number;
  originalSize?: number;
  compression: number;
  ondata: (err: Error | null, data: Uint8Array, final: boolean) => void;
  start(): void;
  terminate: () => void;
}
export interface FflateStreamingUnzip {
  onfile: (file: FflateUnzipFileStream) => void;
  register(decoder: unknown): void;
  push(chunk: Uint8Array, final?: boolean): void;
}
export interface FflateStreaming {
  Unzip: new () => FflateStreamingUnzip;
  UnzipInflate: unknown;
  UnzipPassThrough?: unknown; // für STORE-Einträge (Methode 0); PPTX-XML ist i. d. R. deflate.
}

// 16 KiB komprimiert je push — fflate dekomprimiert inkrementell, sodass die reale Ausgabe je Schritt
// gedeckelt ist. WP-D5e (bens GELB-Auflage, ehrliche Abbruchsemantik): terminate()/das failure-Flag
// unterbrechen NICHT die synchrone Dekompression des GERADE laufenden push(); der Abbruch wirkt erst ab dem
// NÄCHSTEN push. Die Restarbeit eines laufenden Pushs ist durch diese Chunk-Größe (16 KiB komprimiert)
// begrenzt; zusätzlich verwirft der ondata-Callback nach erkanntem failure den bisherigen Puffer und
// konkateniert nicht weiter.
const PPTX_STREAM_CHUNK_BYTES = 1 << 14;

function concatChunks(chunks: readonly Uint8Array[]): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0] ?? new Uint8Array(0);
  }
  let len = 0;
  for (const c of chunks) {
    len += c.length;
  }
  const out = new Uint8Array(len);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// WP-D5d (bens ROT-Fix 2): budgetierter, selektiver STREAMING-Entpacker über ECHTES fflate (injiziert →
// testbar mit fflate.zipSync-Fixtures). Der Name-Filter läuft VOR der Dekompression (unbenötigte Einträge
// werden gar nicht erst gestartet); für akzeptierte Einträge zählt der ondata-Callback die ECHTEN Bytes
// und bricht bei Budgetüberschreitung sofort ab (Stream terminieren). Eine untertriebene/lügende
// originalSize ändert daran nichts — die Ist-Arbeit ist gedeckelt.
export function budgetedPptxUnzip(
  fflate: FflateStreaming,
  limits?: PptxUnzipBudgetLimits,
): PptxUnzip {
  return (data) => {
    const files: Record<string, Uint8Array> = {};
    const budget = createPptxUnzipBudget(limits);
    let failure: unknown = null;
    const uz = new fflate.Unzip();
    uz.register(fflate.UnzipInflate);
    if (fflate.UnzipPassThrough) {
      uz.register(fflate.UnzipPassThrough);
    }
    uz.onfile = (file) => {
      if (failure) {
        return;
      }
      let accepted = false;
      try {
        accepted = budget.accept({
          name: file.name,
          compressedSize: file.size,
          originalSize: file.originalSize,
        });
      } catch (e) {
        failure = e;
        return;
      }
      if (!accepted) {
        return; // nicht benötigt → start() NICHT aufrufen → keine Dekompression
      }
      const chunks: Uint8Array[] = [];
      budget.beginEntry();
      file.ondata = (err, chunk, final) => {
        // WP-D5e (GELB): failure kann während EINES laufenden Pushs mehrfach ondata auslösen. Nach erkanntem
        // failure den bisherigen Puffer verwerfen und NICHT weiter konkatenieren → Restarbeit minimiert.
        if (failure) {
          chunks.length = 0;
          return;
        }
        if (err) {
          failure = err;
          chunks.length = 0;
          return;
        }
        try {
          budget.addOutputBytes(chunk.length);
        } catch (e) {
          failure = e;
          chunks.length = 0;
          try {
            file.terminate();
          } catch {
            // terminate ist best-effort; der Abbruch erfolgt ohnehin über das failure-Flag.
          }
          return;
        }
        chunks.push(chunk);
        if (final) {
          files[file.name] = concatChunks(chunks);
        }
      };
      try {
        file.start();
      } catch (e) {
        failure = e;
      }
    };
    try {
      for (let off = 0; off < data.length && !failure; off += PPTX_STREAM_CHUNK_BYTES) {
        const end = Math.min(off + PPTX_STREAM_CHUNK_BYTES, data.length);
        uz.push(data.subarray(off, end), end >= data.length);
      }
    } catch (e) {
      // Ein fflate-interner Fehler (z. B. Größen-/CRC-Mismatch eines manipulierten Archivs) wird ebenso
      // als kontrollierter Importfehler behandelt — nie als unkontrollierter Absturz durchgereicht.
      failure = failure ?? e;
    }
    if (failure) {
      throw failure instanceof PptxTooLargeError
        ? failure
        : new PptxTooLargeError("archive-too-large");
    }
    return files;
  };
}
