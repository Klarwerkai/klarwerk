import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type DocxEngine, extractDocxRich, extractDocxText } from "../../apps/web/src/lib/docx";
import {
  DOCX_MAX_COMPRESSED_BYTES,
  DocxImportError,
  assertDocxArchive,
} from "../../apps/web/src/lib/docxArchive";
import { docxLesefehlerSatz } from "../../apps/web/src/lib/docxLesefehler";
import { slideToHtml } from "../../apps/web/src/lib/pptx";
import { isStaleChunkError } from "../../apps/web/src/lib/staleChunk";

const NS =
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const slide = (body: string) =>
  `<p:sld ${NS}><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`;
const text = (value: string) => `<a:p><a:r><a:t>${value}</a:t></a:r></a:p>`;
const options = { slideNumber: 1, slideLabel: "Folie" };

async function archive(
  files: Record<string, string>,
  compression: "STORE" | "DEFLATE" = "DEFLATE",
) {
  const zip = new JSZip();
  for (const [name, value] of Object.entries(files)) zip.file(name, value);
  return zip.generateAsync({ type: "arraybuffer", compression });
}
function fakeEngine(): DocxEngine {
  return {
    convertToHtml: vi.fn(async () => ({ value: "<p>nicht aufrufen</p>", messages: [] })),
    extractRawText: vi.fn(async () => ({ value: "nicht aufrufen", messages: [] })),
  };
}
function alterOriginalSize(buffer: ArrayBuffer, size: number): ArrayBuffer {
  const out = buffer.slice(0);
  const view = new DataView(out);
  for (let i = 0; i + 46 < out.byteLength; i += 1) {
    const signature = view.getUint32(i, true);
    if (signature === 0x04034b50) view.setUint32(i + 22, size, true);
    if (signature === 0x02014b50) view.setUint32(i + 24, size, true);
  }
  return out;
}

describe("W4.1 · fortlaufende PPTX-Tagverarbeitung", () => {
  it.each(
    [
      "<p:sp>".repeat(32_000),
      `<p:sp>${"<a:p>".repeat(12_000)}</p:sp>`,
      `<p:sp><a:p>${"<a:t>".repeat(12_000)}</a:p></p:sp>`,
      `<p:sp><a:p>${"<a:pPr>".repeat(12_000)}<a:t>Inhalt</a:t></a:p></p:sp>`,
      `<p:graphicFrame>${"<a:tbl>".repeat(12_000)}</p:graphicFrame>`,
      `<p:graphicFrame><a:tbl>${"<a:tr>".repeat(12_000)}</a:tbl></p:graphicFrame>`,
      `<p:graphicFrame><a:tbl><a:tr>${"<a:tc>".repeat(12_000)}</a:tr></a:tbl></p:graphicFrame>`,
    ].map((body, index) => [index, body] as const),
  )("offene Blockart%i endet kontrolliert", (_index, body) => {
    const start = performance.now();
    const result = slideToHtml(slide(body), options);
    expect(result.html).toContain("<h2>Folie 1</h2>");
    expect(performance.now() - start).toBeLessThan(1500);
  });

  it("gültiger Inhalt nach leeren Formen, Unicode-Namespace, Titel, Umbruch, Liste und Tabelle", () => {
    const body = [
      "<p:sp/>",
      `<p:sp label=">"><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>${text("Titel &amp; Text")}</p:sp>`,
      '<p:sp><a:p><a:pPr><a:buChar char="•"/></a:pPr><a:r><a:t>Hallo</a:t></a:r><a:br/><a:r><a:t>Welt</a:t></a:r></a:p></p:sp>',
      `<p:graphicFrame><a:tbl><a:tr><a:tc>${text("Zelle")}</a:tc></a:tr></a:tbl></p:graphicFrame>`,
    ].join("");
    const xml = slide(body)
      .replaceAll("<p:", "<prä:")
      .replaceAll("</p:", "</prä:")
      .replace("xmlns:p=", "xmlns:prä=")
      .replaceAll("<a:", "<字:")
      .replaceAll("</a:", "</字:")
      .replace("xmlns:a=", "xmlns:字=");
    const result = slideToHtml(xml, options);
    expect(result.html).toContain("<h2>Titel &amp; Text</h2>");
    expect(result.html).toContain("<ul><li>Hallo Welt</li></ul>");
    expect(result.html).toContain("<table><tr><td>Zelle</td></tr></table>");
    expect(result.tableCount).toBe(1);
    expect(result.text).toContain("Titel & Text");
  });
});

describe("W4.1 · DOCX-Grenzen vor jedem Mammoth-Port", () => {
  it("echtes gültiges DOCX bleibt direkt reich und als Klartext lesbar", async () => {
    const bytes = await readFile(new URL("../fixtures/sample.docx", import.meta.url));
    const input = new Uint8Array(bytes).buffer;
    expect(await extractDocxText(input)).toContain("Ventil bei Überdruck schließen");
    const result = await extractDocxRich(input);
    expect(result.text).toContain("Ventil bei Überdruck schließen");
    expect(result.html).toContain("Ventil");
  });

  it("starke Kompression stoppt vor der injizierten Konvertierung und Klartextrunde", async () => {
    const input = await archive({ "word/document.xml": "a".repeat(300_000) });
    const engine = fakeEngine();
    await expect(extractDocxRich(input, { engine })).rejects.toMatchObject({
      reason: "expansion-ratio",
    });
    expect(engine.convertToHtml).not.toHaveBeenCalled();
    expect(engine.extractRawText).not.toHaveBeenCalled();
  });

  it("zu viele Einträge werden vor Konvertierung abgewiesen", async () => {
    const input = await archive(
      Object.fromEntries(Array.from({ length: 4001 }, (_, i) => [`teil-${i}`, ""])),
    );
    const engine = fakeEngine();
    await expect(extractDocxRich(input, { engine })).rejects.toMatchObject({
      reason: "too-many-entries",
    });
    expect(engine.convertToHtml).not.toHaveBeenCalled();
  });

  it("deklariertes Gesamtbudget fällt unabhängig vom zulässigen Einzelverhältnis", async () => {
    const input = alterOriginalSize(
      await archive({ a: "x".repeat(400_000), b: "y".repeat(400_000) }, "STORE"),
      33 * 1024 * 1024,
    );
    const engine = fakeEngine();
    await expect(extractDocxRich(input, { engine })).rejects.toMatchObject({
      reason: "archive-too-large",
    });
    expect(engine.convertToHtml).not.toHaveBeenCalled();
  });

  it("gelogene kleine Originalgrößen passieren die tatsächliche Byteprüfung nicht", async () => {
    const input = alterOriginalSize(
      await archive({ "word/document.xml": "Hallo ".repeat(1000) }),
      1,
    );
    const engine = fakeEngine();
    await expect(extractDocxRich(input, { engine })).rejects.toBeInstanceOf(DocxImportError);
    expect(engine.convertToHtml).not.toHaveBeenCalled();
  });

  it("komprimierte Obergrenze gilt auch am direkten reichen Port", async () => {
    const engine = fakeEngine();
    await expect(
      extractDocxRich(new ArrayBuffer(DOCX_MAX_COMPRESSED_BYTES + 1), { engine }),
    ).rejects.toMatchObject({ reason: "file-too-large" });
    expect(engine.convertToHtml).not.toHaveBeenCalled();
  });

  it("abgeschnittenes Archiv ist ein kontrollierter Formatfehler", async () => {
    const input = (await archive({ "word/document.xml": "Hallo" })).slice(0, -4);
    await expect(assertDocxArchive(input)).rejects.toMatchObject({ reason: "invalid-archive" });
  });

  it.each(["de", "en", "nl"])(
    "verständliche Format-/Grenzmeldung in%s, technische Gründe bleiben erhalten",
    (language) => {
      const t = i18n.getFixedT(language);
      for (const reason of ["invalid-archive", "expansion-ratio", "too-many-entries"] as const) {
        const error = new DocxImportError(reason);
        const message = docxLesefehlerSatz(error, "Test.docx", t);
        expect(message).toContain("Test.docx");
        expect(message).not.toContain("DOCX_IMPORT");
        expect(message).not.toContain("officeimport.");
        expect(error.reason).toBe(reason);
      }
    },
  );

  it("fehlender fflate-Chunk bleibt unverfälscht für den Neu-laden-Weg", async () => {
    const input = await archive({ "word/document.xml": "Hallo" });
    const failure = new TypeError(
      "Failed to fetch dynamically imported module: /assets/fflate-alt.js",
    );
    vi.doMock("fflate", () => {
      throw failure;
    });
    vi.resetModules();
    try {
      const { assertDocxArchive: guard, DocxImportError: CurrentDocxError } = await import(
        "../../apps/web/src/lib/docxArchive"
      );
      // Vitest umhüllt einen Fehler seiner Mock-Factory selbst; der Guard darf ihn nicht umklassifizieren.
      await expect(guard(input)).rejects.not.toBeInstanceOf(CurrentDocxError);
      expect(isStaleChunkError(failure)).toBe(true);
      expect(docxLesefehlerSatz(failure, "Test.docx", i18n.t)).toBeNull();
    } finally {
      vi.doUnmock("fflate");
      vi.resetModules();
    }
  });
});
