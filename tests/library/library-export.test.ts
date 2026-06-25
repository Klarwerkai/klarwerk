import { describe, expect, it } from "vitest";
import {
  EXPORT_FORMATS,
  type ExportFormat,
  exportFilename,
  exportFormatMeta,
  exportUrl,
} from "../../apps/web/src/lib/libraryExport";

describe("SCRUM-135: Library-Export-Formate", () => {
  it("kennt alle vier Formate mit Label-Key + Endung", () => {
    expect([...EXPORT_FORMATS]).toEqual(["json", "markdown", "mediawiki", "html"]);
    for (const f of EXPORT_FORMATS) {
      const meta = exportFormatMeta(f);
      expect(meta.labelKey).toBe(`lib.format.${f}`);
      expect(meta.ext.length).toBeGreaterThan(0);
    }
  });

  it("baut die richtige Export-URL je Format", () => {
    expect(exportUrl("json")).toBe("/api/library/export");
    expect(exportUrl("markdown")).toBe("/api/library/export?format=markdown");
    expect(exportUrl("mediawiki")).toBe("/api/library/export?format=mediawiki");
    expect(exportUrl("html")).toBe("/api/library/export?format=html");
  });

  it("setzt sinnvolle Download-Dateinamen", () => {
    const ext: Record<ExportFormat, string> = {
      json: "json",
      markdown: "md",
      mediawiki: "wiki",
      html: "html",
    };
    for (const f of EXPORT_FORMATS) {
      expect(exportFilename(f)).toBe(`klarwerk-export.${ext[f]}`);
    }
  });
});
