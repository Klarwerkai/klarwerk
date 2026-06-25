import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// Nur der DOM-freie DOCX-Kern wird getestet — kein Import aus `files.ts` (DOM),
// kein `new File(...)`. So bleibt der Root-/Node-Typecheck DOM-frei.
import { extractDocxText, isDocxDocumentLike } from "../../apps/web/src/lib/docx";

// FR-CAP-06: DOCX wird client-seitig zu Klartext extrahiert (mammoth, lazy).
const here = dirname(fileURLToPath(import.meta.url));

// Buffer in eine frische Kopie übertragen → echtes `ArrayBuffer` (nicht SharedArrayBuffer).
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return copy.buffer;
}

describe("FR-CAP-06: DOCX-Extraktion", () => {
  it("liest den Klartext aus einer .docx", async () => {
    const buf = await readFile(join(here, "..", "fixtures", "sample.docx"));
    const text = await extractDocxText(toArrayBuffer(buf));
    expect(text).toContain("Ventil bei Überdruck schließen");
  });

  it("erkennt .docx über Name/MIME, nicht aber .pdf oder .txt", () => {
    expect(isDocxDocumentLike({ name: "anleitung.docx" })).toBe(true);
    expect(
      isDocxDocumentLike({
        name: "ohne-endung",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe(true);
    expect(isDocxDocumentLike({ name: "bericht.pdf" })).toBe(false);
    expect(isDocxDocumentLike({ name: "notiz.txt", type: "text/plain" })).toBe(false);
  });
});
