// Reine, DOM-freie Export-Format-Logik für die Bibliothek (SCRUM-135 / FE-LIB-03).
// Backend: GET /api/library/export?format=markdown|mediawiki|html (Default JSON).

export type ExportFormat = "json" | "markdown" | "mediawiki" | "html";

export const EXPORT_FORMATS: readonly ExportFormat[] = ["json", "markdown", "mediawiki", "html"];

interface ExportMeta {
  labelKey: string;
  ext: string;
}

const META: Record<ExportFormat, ExportMeta> = {
  json: { labelKey: "lib.format.json", ext: "json" },
  markdown: { labelKey: "lib.format.markdown", ext: "md" },
  mediawiki: { labelKey: "lib.format.mediawiki", ext: "wiki" },
  // HTML ist bewusst Druck-/„print to PDF"-Ansicht, kein dedizierter PDF-Export.
  html: { labelKey: "lib.format.html", ext: "html" },
};

export function exportFormatMeta(format: ExportFormat): ExportMeta {
  return META[format];
}

export function exportUrl(format: ExportFormat): string {
  return format === "json" ? "/api/library/export" : `/api/library/export?format=${format}`;
}

export function exportFilename(format: ExportFormat): string {
  return `klarwerk-export.${META[format].ext}`;
}
