import { readFileSync } from "node:fs";

const bytes = readFileSync(new URL("./sample.docx", import.meta.url));

/** Auch eine injizierte HTML-Engine erhält ein gültiges, vorprüfbares DOCX statt vier Nullbytes. */
export function docxTestBuffer(): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}
