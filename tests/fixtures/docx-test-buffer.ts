import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const bytes = readFileSync(resolve(process.cwd(), "tests/fixtures/sample.docx"));

/** Auch eine injizierte HTML-Engine erhält ein gültiges, vorprüfbares DOCX statt vier Nullbytes. */
export function docxTestBuffer(): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}
