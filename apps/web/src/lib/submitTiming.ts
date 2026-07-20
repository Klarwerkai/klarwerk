// WP-D10 (Fix 2, Pedis Live-Befund): die Einreichen-Latenz sichtbar machen. Die Spannen stammen aus
// den VORHANDENEN performance.now-Messpunkten des Submit-Pfads (WP-D7b: tCreate/tFinalize +
// onPhase-Übergang "uploading"→"linking") — hier wird NICHTS neu gemessen, nur gesammelt und für die
// aufklappbare Zeile „Details zur Dauer" in der Bestätigung formatiert. DOM-frei und pur → Node-Gate.

// Die drei ehrlichen Phasen des Submit-Pfads: Anlegen/Promoten (Phase 1), paralleler Upload (Phase A),
// serielle KO-Verknüpfung inkl. Quellen (Phase B — Quellen laufen INNERHALB der seriellen KO-Writes,
// es gibt dafür keinen eigenen bestehenden Messpunkt, daher bewusst EIN gemeinsamer Eintrag).
export type SubmitTimingKey = "create" | "upload" | "link";

export interface SubmitTimingSpan {
  key: SubmitTimingKey;
  ms: number;
  // Nur für "upload": die real übertragene Größe (bereits lokalisiert formatiert, aus WP-D7b).
  mb?: string | null;
}

export interface SubmitTimingEntry {
  key: SubmitTimingKey;
  labelKey: string;
  // Sekunden mit einer Nachkommastelle, lokalisiert (z. B. „3,4" in DE, "3.4" in EN).
  seconds: string;
  mb?: string;
}

const LABEL_KEYS: Record<SubmitTimingKey, string> = {
  create: "capture.submitTiming.create",
  upload: "capture.submitTiming.upload",
  link: "capture.submitTiming.link",
};

// ms → Sekunden-String mit einer Nachkommastelle im Nutzer-Locale. Unter 0,1 s ehrlich als „0,1"-Grenze
// nicht aufgehübscht: minimumFractionDigits 1 zeigt auch „0,0" (die Phase lief, war nur schnell).
export function formatSubmitSeconds(ms: number, locale: string): string {
  return (ms / 1000).toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

// WP-D10b (bens GELB-Auflage aus BERICHT-sammel5): Zeilen NUR für ECHTE Arbeit. finalizeCaptureSubmit
// feuert onPhase("uploading")/("linking") IMMER — auch beim reinen Text-Submit ohne Anhänge/Original/
// Quellen; ohne diese Ableitung erschienen dann eine Upload-Zeile ohne MB und eine leere Verknüpfen-
// Zeile. Die Arbeitszähler stammen aus den ohnehin vorhandenen Finalizer-Eingaben (Anzahl Anhänge,
// Original, Quellen) — nichts wird neu gemessen.
export interface SubmitPhaseSpanInput {
  // Anzahl real geplanter Upload-Objekte in Phase A (Anhänge + ggf. Original-Upload; ein per Ref-Cache
  // übersprungenes Original zählt NICHT — es werden keine Bytes übertragen).
  uploadWork: number;
  // Anzahl Phase-B-Aufgaben (Attach je Anhang, Original-Attach, Import-Quelle, externe Quellen).
  linkWork: number;
  // Gemessene Spannen aus den vorhandenen Messpunkten; null = Phasen-Übergang fehlte (defensiv).
  uploadMs: number | null;
  linkMs: number | null;
  uploadMb?: string | null;
}

export function submitPhaseSpans(input: SubmitPhaseSpanInput): SubmitTimingSpan[] {
  const spans: SubmitTimingSpan[] = [];
  if (input.uploadWork > 0 && input.uploadMs !== null) {
    spans.push({ key: "upload", ms: input.uploadMs, mb: input.uploadMb ?? null });
  }
  if (input.linkWork > 0 && input.linkMs !== null) {
    spans.push({ key: "link", ms: input.linkMs });
  }
  return spans;
}

// Sammelt die gemessenen Spannen zu Anzeige-Einträgen: feste Phasen-Reihenfolge (create → upload →
// link), ungültige Spannen (negativ/NaN — z. B. wenn ein Phasen-Übergang nie feuerte) werden EHRLICH
// weggelassen statt mit 0 erfunden.
export function buildSubmitTimingEntries(
  spans: readonly SubmitTimingSpan[],
  locale: string,
): SubmitTimingEntry[] {
  const order: SubmitTimingKey[] = ["create", "upload", "link"];
  const entries: SubmitTimingEntry[] = [];
  for (const key of order) {
    const span = spans.find((s) => s.key === key);
    if (!span || !Number.isFinite(span.ms) || span.ms < 0) {
      continue;
    }
    entries.push({
      key,
      labelKey: LABEL_KEYS[key],
      seconds: formatSubmitSeconds(span.ms, locale),
      ...(span.mb ? { mb: span.mb } : {}),
    });
  }
  return entries;
}
