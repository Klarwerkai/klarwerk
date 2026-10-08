// Reine, DOM-freie Export-Format-Logik für die Bibliothek (SCRUM-135 / FE-LIB-03).
// Backend: GET /api/library/export?format=markdown|mediawiki|html (Default JSON), optional
// `ids=<a>,<b>` für eine Auswahl (aufnahme:20260922:gesamt-wissen-export, R-0681 / FR-LIB-02).

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

export function exportUrl(format: ExportFormat, ids?: readonly string[]): string {
  const teile: string[] = [];
  if (format !== "json") {
    teile.push(`format=${format}`);
  }
  if (ids) {
    teile.push(`ids=${ids.map(encodeURIComponent).join(",")}`);
  }
  return teile.length === 0 ? "/api/library/export" : `/api/library/export?${teile.join("&")}`;
}

export function exportFilename(format: ExportFormat): string {
  return `klarwerk-export.${META[format].ext}`;
}

// ================================================================================================
// N-0082 — WAS EXPORTIERT WIRD, STEHT VOR DEM DOWNLOAD.
// ================================================================================================
//
// Befund: bei gefilterter Liste lieferte der Export fünf andere Einträge und den sichtbaren
// (offenen, eigenen) Treffer nicht — das Menü nannte nur Formate. Der Server exportiert IMMER nur
// validierte Einträge, vertrauliche nur mit Prüfrecht; daran ändert die Auswahl nichts. Die Fläche
// sagt deshalb vorher, welche Menge gemeint ist und wie viele der gewählten Einträge der
// Validiert-Grenze wegen NICHT mitgehen.
//
// Die Auswahl reist als Kennungsliste in der Adresse. Damit sie nicht an der Längengrenze einer
// Anfragezeile scheitert, ist sie gedeckelt; darüber nennt die Fläche den Gesamtbestand als Weg,
// statt still abzuschneiden.
export const EXPORT_AUSWAHL_MAX = 100;

export type ExportUmfangArt = "bestand" | "treffer" | "markiert";

export const EXPORT_UMFANG_ARTEN: readonly ExportUmfangArt[] = ["bestand", "treffer", "markiert"];

export interface ExportEintrag {
  id: string;
  status: string;
}

export type ExportUmfang =
  // Validierter Gesamtbestand — der Server bestimmt die Menge; keine Kennungen.
  | { art: "bestand"; ids: undefined }
  // Eine Auswahl: `validiert` geht mit, `ausgelassen` sind die nicht validierten der Auswahl.
  | {
      art: "treffer" | "markiert";
      ids: string[];
      gewaehlt: number;
      validiert: number;
      ausgelassen: number;
      zuViele: boolean;
    };

export function exportUmfang(
  art: ExportUmfangArt,
  eintraege: readonly ExportEintrag[],
): ExportUmfang {
  if (art === "bestand") {
    return { art, ids: undefined };
  }
  const ids = [...new Set(eintraege.filter((e) => e.status === "validiert").map((e) => e.id))];
  return {
    art,
    ids,
    gewaehlt: eintraege.length,
    validiert: ids.length,
    ausgelassen: eintraege.length - ids.length,
    zuViele: ids.length > EXPORT_AUSWAHL_MAX,
  };
}

/** Ob die Formatlinks für diesen Umfang angeboten werden (eine Auswahl braucht ≥1 und ≤ Deckel). */
export function exportMoeglich(umfang: ExportUmfang): boolean {
  return umfang.art === "bestand" || (umfang.validiert > 0 && !umfang.zuViele);
}
