import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

// ================================================================================================
// Aufnahme `gesamt-ocr` · R-0151 (Nacharbeit 13) — DIE ENGINE DER BILD-TEXTERKENNUNG AUF DERSELBEN
// HERKUNFT.
// ================================================================================================
//
// Gemessen mit der technischen OCR-Probe (Peters Entscheidung 25, fiktives Bild): tesseract.js lud
// seinen Arbeiter aus einer `blob:`-Adresse und Kern/Sprachdaten von einem CDN. Die CSP der
// Anwendung (`script-src 'self'`, `connect-src 'self'`) verbietet beides, jede Erkennung scheiterte.
//
// Dieses Bau-Plugin legt Arbeiter und Kern aus dem installierten Paket als gewöhnliche Dateien der
// Auslieferung ab — unter `/ocr/engine/` und BEWUSST NICHT unter `/assets/`: es sind keine Stücke
// der Anwendung, sie werden erst beim ausdrücklichen Klick auf die Erkennung geladen, und die
// Bündelmessung in `tests/erstladezeit/` zählt `/assets/*.js` (ein mehrere MB großer Kern dort wäre
// eine Falschaussage über die Anwendung). Im Entwicklungsserver liefert dieselbe Fabrik die Dateien
// direkt aus dem Paket aus.
//
// STRUKTURELL TYPISIERT, ohne `import type { Plugin } from "vite"` — wie `klaraStand()` (Begründung
// dort und am Kopf von `apps/web/vite.config.ts`).

/** Wo die Auslieferung Arbeiter und Kern bereitstellt (gelesen von `lib/files.ts`). */
export const OCR_ENGINE_PFAD = "/ocr/engine";

/** Wo die Auslieferung die Sprachdaten bereitstellt (`lib/files.ts`, OCR_SPRACHDATEN_PFAD). */
export const OCR_SPRACHDATEN_ZIEL = "/ocr/lang";

/**
 * DIE SPRACHDATEN sind NICHT im installierten Paket enthalten (tesseract.js lädt sie sonst von
 * einem CDN). Sie kommen auf einem von zwei Wegen in die Auslieferung — beide gleichherkünftig:
 *   1. als Dateien `apps/web/public/ocr/lang/<sprache>.traineddata.gz` (Vite übernimmt `public/`),
 *   2. beim Bau aus dem Verzeichnis in KLARWERK_OCR_SPRACHDATEN (alle `*.traineddata.gz` darin).
 * Fehlen sie, meldet die Anwendung beim Klick ehrlich „OCR ist derzeit nicht verfügbar".
 */
export const OCR_SPRACHDATEN_UMGEBUNG = "KLARWERK_OCR_SPRACHDATEN";

interface Sprachdatei {
  name: string;
  pfad: string;
}

/** Die Sprachdateien aus dem in der Umgebung genannten Verzeichnis — leer, wenn keins genannt ist. */
export function ocrSprachdateien(verzeichnis: string | undefined): Sprachdatei[] {
  if (!verzeichnis || !existsSync(verzeichnis)) {
    return [];
  }
  return readdirSync(verzeichnis)
    .filter((name) => name.endsWith(".traineddata.gz"))
    .sort()
    .map((name) => ({ name, pfad: join(verzeichnis, name) }));
}

/** Die zwei Dateien: Quelle im installierten Paket → Name unter `OCR_ENGINE_PFAD`. */
export const OCR_ENGINE_DATEIEN: readonly { quelle: string; name: string }[] = [
  { quelle: "tesseract.js/dist/worker.min.js", name: "worker.min.js" },
  // Der Kern mit eingebettetem WebAssembly, SIMD und nur LSTM — passend zur Voreinstellung von
  // tesseract.js 5 (OEM LSTM_ONLY). SIMD-WebAssembly können alle aktuellen Browser.
  {
    quelle: "tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    name: "tesseract-core-simd-lstm.wasm.js",
  },
];

const paket = createRequire(import.meta.url);

function lies(quelle: string): Buffer {
  return readFileSync(paket.resolve(quelle));
}

interface Zwischenstand {
  emitFile(datei: { type: "asset"; fileName: string; source: Uint8Array }): string;
}

interface Entwicklungsserver {
  middlewares: {
    use(
      pfad: string,
      bearbeiter: (
        anfrage: { url?: string },
        antwort: { setHeader(name: string, wert: string): void; end(daten: Buffer): void },
        weiter: () => void,
      ) => void,
    ): void;
  };
}

export function ocrEngineDateien(): {
  readonly name: "ocr-engine-dateien";
  generateBundle(this: Zwischenstand): void;
  configureServer(server: Entwicklungsserver): void;
} {
  return {
    name: "ocr-engine-dateien",
    generateBundle() {
      for (const datei of OCR_ENGINE_DATEIEN) {
        this.emitFile({
          type: "asset",
          fileName: `${OCR_ENGINE_PFAD.slice(1)}/${datei.name}`,
          source: lies(datei.quelle),
        });
      }
      for (const datei of ocrSprachdateien(process.env[OCR_SPRACHDATEN_UMGEBUNG])) {
        this.emitFile({
          type: "asset",
          fileName: `${OCR_SPRACHDATEN_ZIEL.slice(1)}/${datei.name}`,
          source: readFileSync(datei.pfad),
        });
      }
    },
    configureServer(server) {
      server.middlewares.use(OCR_ENGINE_PFAD, (anfrage, antwort, weiter) => {
        const name = (anfrage.url ?? "").replace(/^\/+/, "").split("?")[0];
        const datei = OCR_ENGINE_DATEIEN.find((d) => d.name === name);
        if (!datei) {
          weiter();
          return;
        }
        antwort.setHeader("Content-Type", "text/javascript");
        antwort.end(lies(datei.quelle));
      });
      server.middlewares.use(OCR_SPRACHDATEN_ZIEL, (anfrage, antwort, weiter) => {
        const name = (anfrage.url ?? "").replace(/^\/+/, "").split("?")[0];
        const umgebung = process.env[OCR_SPRACHDATEN_UMGEBUNG];
        const datei = ocrSprachdateien(umgebung).find((d) => d.name === name);
        if (!datei) {
          weiter();
          return;
        }
        antwort.setHeader("Content-Type", "application/gzip");
        antwort.end(readFileSync(datei.pfad));
      });
    },
  };
}
