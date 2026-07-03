// SCRUM-405 (Pedi-Sichtabnahme 03.07.): „Aus Dokument ergänzen" — ausgewählte Extraktions-
// Punkte des vorhandenen extract-Tasks (SCRUM-390, G-2-Belegstellen-Gate) als Abschnitte an
// den BESTEHENDEN Artikel anhängen. Nichts wird ersetzt; jede Übernahme trägt ihren Beleg
// (Belegstellen-Zitat + Dateiname) sichtbar im Abschnitt. Gleiche Bau-Muster wie
// captureDraftArticle: escaptes/sanitisiertes Fragment, Set/Append statt Überschreiben.
import type { ExtractedPoint } from "../api/types";
import { isEmptyHtml, sanitizeHtml } from "./richText";

export type ExtractSectionLocale = "de" | "en";

const LABELS: Record<ExtractSectionLocale, { source: string }> = {
  de: { source: "Quelle" },
  en: { source: "Source" },
};

export function normalizeExtractLocale(locale: string | null | undefined): ExtractSectionLocale {
  return locale?.toLowerCase().startsWith("en") ? "en" : "de";
}

// G-2: Übernahmefähig ist nur, was Titel UND Belegstelle trägt — ohne Beleg keine Übernahme.
export function appendablePoints(points: readonly ExtractedPoint[]): ExtractedPoint[] {
  return points.filter((p) => p.title.trim().length > 0 && p.sourceExcerpt.trim().length > 0);
}

// HTML-Abschnitt je Punkt: H3-Titel, Kurzfassung, Belegstelle als Zitat mit Quellenvermerk.
// Das Fragment läuft komplett durch sanitizeHtml (Allowlist inkl. blockquote) — kein Roh-HTML.
export function extractSectionsHtml(
  points: readonly ExtractedPoint[],
  fileName: string,
  locale: ExtractSectionLocale = "de",
): string {
  const label = LABELS[locale].source;
  const parts = appendablePoints(points).map((p) => {
    const summary = p.summary.trim() ? `<p>${p.summary.trim()}</p>` : "";
    return `<h3>${p.title.trim()}</h3>${summary}<blockquote><p>„${p.sourceExcerpt.trim()}“ — ${label}: ${fileName}</p></blockquote>`;
  });
  if (parts.length === 0) {
    return "";
  }
  return sanitizeHtml(parts.join(""));
}

// Übernahme in den vorhandenen Body: leer → setzen, sonst NICHT-destruktiv anhängen —
// exakt das Set/Append-Verhalten von applyDraftArticle/applyBodyTemplate (nichts ersetzen).
export function appendExtractSections(
  currentHtml: string | null | undefined,
  points: readonly ExtractedPoint[],
  fileName: string,
  locale: ExtractSectionLocale = "de",
): string {
  const base = currentHtml ?? "";
  const next = extractSectionsHtml(points, fileName, locale);
  if (next.length === 0) {
    return base;
  }
  return isEmptyHtml(base) ? next : base + next;
}

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (Muster CAPTURE_FILE_TEXT).
export const BODY_EXTRACT_TEXT = {
  title: "xtr.title",
  hint: "xtr.hint",
  applyCta: "xtr.applyCta",
  appended: "xtr.appended",
  helpTitle: "xtr.help.title",
  helpBody: "xtr.help.body",
} as const;
