// DOM-freier DOCX-Kern (FR-CAP-06).
// Bewusst OHNE File/Image/document/FileReader, damit dieses Modul auch im
// Node-/Root-Typecheck und in Tests ohne DOM-lib geprüft werden kann.
// Der Browser-Wrapper liegt in `files.ts`.

// mammoth liefert keine verlässlichen Typen; schlanke lokale Vertragsdefinition statt `any`.
// mammoth wird je Umgebung unterschiedlich aufgelöst: Browser-Build akzeptiert
// `arrayBuffer`, Node-Build `buffer`. Beide Schlüssel zulassen → läuft in beiden.
type MammothInput = { arrayBuffer: ArrayBuffer; buffer?: Uint8Array };
type MammothModule = {
  extractRawText(input: MammothInput): Promise<{ value: string; messages: unknown[] }>;
};

const WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// DOM-freie Erkennung über Dateiname/MIME (ohne File-Objekt).
// Altes Binärformat .doc wird NICHT unterstützt (mammoth liest nur .docx).
export function isDocxDocumentLike(input: { name: string; type?: string }): boolean {
  return input.type === WORD_MIME || input.name.toLowerCase().endsWith(".docx");
}

// Reiner Extraktionskern (ArrayBuffer → Klartext), in Node testbar.
// mammoth wird lazy geladen, damit es nicht ins Haupt-Bundle wandert.
export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  // CJS/ESM-Interop robust auflösen (mammoth ist CommonJS, ohne Typen).
  const mod = (await import("mammoth")) as unknown as MammothModule & { default?: MammothModule };
  const mammoth = mod.default ?? mod;
  // Browser-Build nutzt `arrayBuffer`, Node-Build `buffer` — beide übergeben.
  const result = await mammoth.extractRawText({
    arrayBuffer: buffer,
    buffer: new Uint8Array(buffer),
  });
  return result.value.trim();
}
