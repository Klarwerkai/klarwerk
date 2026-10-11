// Reine, DOM-freie Export-Format-Logik für die Bibliothek (SCRUM-135 / FE-LIB-03).
// Backend: GET /api/library/export?format=markdown|mediawiki|html|paket (Default JSON), optional
// `ids=<a>,<b>` für eine Auswahl (aufnahme:20260922:gesamt-wissen-export, R-0681 / FR-LIB-02).
// produkt:20261010:poc-wiederherstellung-export: `paket` ist das ZIP mit Fassungen,
// Originalanhängen und Verzeichnis (`services/app/src/wissenspaket.ts`) — dieselbe Menge.
import type { Confidentiality } from "../api/types";
import { isConfidential } from "./confidentiality";

export type ExportFormat = "json" | "markdown" | "mediawiki" | "html" | "paket";

export const EXPORT_FORMATS: readonly ExportFormat[] = [
  "json",
  "markdown",
  "mediawiki",
  "html",
  "paket",
];

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
  paket: { labelKey: "lib.format.paket", ext: "zip" },
};

// R-1349 (Aufnahme gesamt-aufruferwaechter): bis hierher ohne Produktleser — die Bibliothek setzte
// den Schlüssel als `lib.format.${fmt}` daneben selbst zusammen. Sie liest ihn jetzt hier.
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
  confidentiality?: Confidentiality | null;
}

// BEN-NACHARBEIT (N-0082): die Fläche zählte nur nach Status. Ein Experte sieht aber seine EIGENEN
// vertraulichen Einträge (`services/app/src/sichtbarkeit.ts`) und kann sie markieren — der Export
// liefert sie ihm nicht (`library-routes.ts`: `includeConfidential = can(role, "ko.validate")`).
// Das Menü versprach dann „1 von 1" für eine leere Datei. Gezählt wird deshalb mit DERSELBEN
// Regel wie der Server: validiert UND (Prüfrecht ODER nicht vertraulich). `isConfidential` ist
// zeichengleich zu `services/knowledge-object/src/confidentiality.ts`.
export function darfVertraulichExportieren(role: string | null | undefined): boolean {
  // Spiegel von `ROLE_PERMISSIONS` (services/rbac/src/policy.ts): `ko.validate` haben genau
  // controller und admin. Unbekannte Rolle oder keine Anmeldung: fail-safe ohne Vertrauliches.
  return role === "controller" || role === "admin";
}

export type ExportUmfang =
  // Validierter Gesamtbestand — der Server bestimmt die Menge; keine Kennungen.
  | { art: "bestand"; ids: undefined }
  // Eine Auswahl: `ids`/`exportierbar` gehen mit; die übrigen sind nach Grund getrennt gezählt.
  | {
      art: "treffer" | "markiert";
      ids: string[];
      gewaehlt: number;
      exportierbar: number;
      nichtValidiert: number;
      vertraulichOhneRecht: number;
      zuViele: boolean;
    };

export function exportUmfang(
  art: ExportUmfangArt,
  eintraege: readonly ExportEintrag[],
  vertraulichErlaubt = false,
): ExportUmfang {
  if (art === "bestand") {
    return { art, ids: undefined };
  }
  const validiert = eintraege.filter((e) => e.status === "validiert");
  const gesperrt = (e: ExportEintrag): boolean =>
    !vertraulichErlaubt && isConfidential(e.confidentiality);
  const ids = [...new Set(validiert.filter((e) => !gesperrt(e)).map((e) => e.id))];
  return {
    art,
    ids,
    gewaehlt: eintraege.length,
    exportierbar: ids.length,
    nichtValidiert: eintraege.length - validiert.length,
    vertraulichOhneRecht: validiert.filter(gesperrt).length,
    zuViele: ids.length > EXPORT_AUSWAHL_MAX,
  };
}

/** Ob die Formatlinks für diesen Umfang angeboten werden (eine Auswahl braucht ≥1 und ≤ Deckel). */
export function exportMoeglich(umfang: ExportUmfang): boolean {
  return umfang.art === "bestand" || (umfang.exportierbar > 0 && !umfang.zuViele);
}
