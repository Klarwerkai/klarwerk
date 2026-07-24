// WP-SHIP9-S2 Paket 2 (Import-UX D2–D7): reines View-Modell der Auswahl-Trefferliste.
// Keine React-/Netz-Abhängigkeit — die UI (ImportSelect.tsx) hält nur den State und rendert; die
// gesamte Auswahl-, Filter-, Such- und Gruppierungs-Logik lebt hier und ist als pure Logik getestet.
// Der Auswahl-Zustand bleibt `checkedRows: boolean[]`, indexiert nach dem ORIGINAL-Index in
// `preview[]` (Bindeglied, das durch Filtern/Gruppieren stabil bleibt).
import type { ImportPreviewEntry } from "../api/types";
import { languageFromTitle } from "./facets";
import { displayImportText } from "./htmlEntities";

// D7: Filter-Chips über der Trefferliste. "all" = keine Einschränkung.
export type PreviewChip = "all" | "new" | "imported" | "queued";
// D3/D5: Ordner-/Gruppen-Ansicht. "none" = flache Liste (Standard).
export type PreviewGroupMode = "none" | "theme" | "language";
export type PreviewLanguage = "de" | "en" | "nl" | "other";

export interface PreviewViewState {
  // D7: Freitext-Suche über der Trefferliste (Titel + Autor, dekodiert).
  query: string;
  // D7: aktiver Filter-Chip.
  chip: PreviewChip;
  // D4: „Bereits importierte/vorgemerkte ausblenden".
  hideImported: boolean;
  // D3/D5: Gruppierung.
  groupMode: PreviewGroupMode;
}

export const DEFAULT_PREVIEW_VIEW: PreviewViewState = {
  query: "",
  chip: "all",
  hideImported: false,
  groupMode: "none",
};

export interface PreviewRow {
  entry: ImportPreviewEntry;
  // Original-Index in preview[] — die Verbindung zu checkedRows bleibt über Filter/Gruppen erhalten.
  index: number;
}

export interface PreviewGroup {
  key: string;
  kind: "theme" | "language";
  // Rohwert der Gruppe (Theme-Text bzw. Sprach-Schlüssel) — die Anzeige dekodiert der Aufrufer.
  value: string;
  language?: PreviewLanguage;
  rows: PreviewRow[];
}

// D5: führendes Sprach-Präfix des Titels → DE/EN/NL, sonst "other".
// RT5c (nacht24 Paket 5, „Code teilen"): dieselbe Erkennung wie die Bibliotheks-Facetten —
// die Präfix-Logik lebt jetzt EINMAL in lib/facets.languageFromTitle.
export function previewLanguage(entry: ImportPreviewEntry): PreviewLanguage {
  return languageFromTitle(displayImportText(entry.title, entry.textCodec));
}

// D7: welchem Filter-Chip genügt ein Eintrag?
export function chipMatches(entry: ImportPreviewEntry, chip: PreviewChip): boolean {
  switch (chip) {
    case "new":
      return entry.alreadyImported !== true && entry.alreadyQueued !== true;
    case "imported":
      return entry.alreadyImported === true;
    case "queued":
      return entry.alreadyQueued === true;
    default:
      return true;
  }
}

// D7: Freitext-Suche — dekodierter Titel + Autor, case-insensitiv (Teilstring).
export function searchMatches(entry: ImportPreviewEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return true;
  }
  const author = entry.author ? displayImportText(entry.author, entry.textCodec) : "";
  const hay = `${displayImportText(entry.title, entry.textCodec)} ${author}`.toLowerCase();
  return hay.includes(q);
}

// D4: „bereits importiert" ODER „bereits vorgemerkt" = ausblendbarer Bestand.
function isKnown(entry: ImportPreviewEntry): boolean {
  return entry.alreadyImported === true || entry.alreadyQueued === true;
}

// F1 (bens ROT): ZENTRALE Regel, welche Zeilen eine BULK-Aktion (Alle wählen, Themen-/Sprach-
// Gruppen-Checkbox) überhaupt anfassen darf — bereits importierte oder vorgemerkte Einträge NIE.
// (Ein einzelnes bewusstes Wieder-Anwählen bleibt über die Zeilen-Checkbox möglich; nur Bulk darf
// es nicht auslösen.) Dieselbe Regel steuert auch den Gruppen-/Alle-Haken (rowsAllChecked).
export function isBulkSelectable(entry: ImportPreviewEntry): boolean {
  return !isKnown(entry);
}

// F1: aus einer sichtbaren Zeilenmenge die bulk-wählbare Teilmenge — die EINE Reichweite, die alle
// Bulk-Setzer UND die Haken-Anzeige gemeinsam verwenden (Text und Wirkung fallen so nie auseinander).
export function bulkSelectableRows(rows: readonly PreviewRow[]): PreviewRow[] {
  return rows.filter((row) => isBulkSelectable(row.entry));
}

// Sichtbare Zeilen nach Filter-Chip (D7) + Suche (D7) + Ausblenden-Schalter (D4). Reihenfolge = Original.
export function visibleRows(
  entries: readonly ImportPreviewEntry[],
  state: PreviewViewState,
): PreviewRow[] {
  const rows: PreviewRow[] = [];
  entries.forEach((entry, index) => {
    if (state.hideImported && isKnown(entry)) {
      return;
    }
    if (!chipMatches(entry, state.chip)) {
      return;
    }
    if (!searchMatches(entry, state.query)) {
      return;
    }
    rows.push({ entry, index });
  });
  return rows;
}

const LANGUAGE_ORDER: PreviewLanguage[] = ["de", "en", "nl", "other"];

// D3/D5: sichtbare Zeilen in auf-/zuklappbare Gruppen bündeln. Reihenfolge innerhalb einer Gruppe
// bleibt die Original-Reihenfolge; Sprachen in fester Ordnung (DE/EN/NL/übrige), Themen alphabetisch
// mit „ohne Thema" ganz am Ende.
export function groupRows(rows: readonly PreviewRow[], mode: PreviewGroupMode): PreviewGroup[] {
  if (mode === "none") {
    return [];
  }
  if (mode === "language") {
    const buckets = new Map<PreviewLanguage, PreviewRow[]>();
    for (const row of rows) {
      const lang = previewLanguage(row.entry);
      const bucket = buckets.get(lang);
      if (bucket) {
        bucket.push(row);
      } else {
        buckets.set(lang, [row]);
      }
    }
    return LANGUAGE_ORDER.filter((lang) => buckets.has(lang)).map((lang) => ({
      key: `lang:${lang}`,
      kind: "language",
      value: lang,
      language: lang,
      rows: buckets.get(lang) as PreviewRow[],
    }));
  }
  // mode === "theme"
  const NO_THEME = "";
  const buckets = new Map<string, PreviewRow[]>();
  for (const row of rows) {
    const theme = row.entry.themes[0] ?? NO_THEME;
    const bucket = buckets.get(theme);
    if (bucket) {
      bucket.push(row);
    } else {
      buckets.set(theme, [row]);
    }
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (a === NO_THEME) {
      return 1;
    }
    if (b === NO_THEME) {
      return -1;
    }
    return displayImportText(a).localeCompare(displayImportText(b));
  });
  return keys.map((theme) => ({
    key: `theme:${theme}`,
    kind: "theme",
    value: theme,
    rows: buckets.get(theme) as PreviewRow[],
  }));
}

// D2/D3: alle übergebenen Zeilen auf einen Wert setzen (Alle wählen/abwählen bzw. Gruppen-Checkbox).
export function setRowsSelected(
  checked: readonly boolean[],
  rows: readonly PreviewRow[],
  value: boolean,
): boolean[] {
  const next = [...checked];
  for (const { index } of rows) {
    next[index] = value;
  }
  return next;
}

// F2 (bens ROT): „Alle abwählen" leert die GESAMTE Auswahl — unabhängig von Suche, Chip-Filter und
// Ausblenden-Schalter (der Text verspricht ALLE, also gilt ALLE). Auch weggefilterte, aber gewählte
// Treffer werden dadurch abgewählt.
export function clearAllSelected(checked: readonly boolean[]): boolean[] {
  return checked.map(() => false);
}

// Sind ALLE (nicht-leeren) Zeilen angehakt? (Zustand der Alle-/Gruppen-Checkbox.)
export function rowsAllChecked(checked: readonly boolean[], rows: readonly PreviewRow[]): boolean {
  return rows.length > 0 && rows.every(({ index }) => checked[index] === true);
}

// Ist mindestens eine Zeile angehakt? (Für den indeterminierten/teil-gewählten Zustand.)
export function rowsAnyChecked(checked: readonly boolean[], rows: readonly PreviewRow[]): boolean {
  return rows.some(({ index }) => checked[index] === true);
}

// WP-BILD-1f RT5b: Dreizustand des Gruppen-Hakens (Baugruppen-Verhalten). "on" = alle bulk-wählbaren
// Zeilen an (mehr kann eine Bulk-Aktion nicht erreichen); "off" = keine Zeile der Gruppe an; sonst
// "mixed" (teilgewählt → indeterminierter Haken). Bekannte (importierte/vorgemerkte) Zeilen zählen für
// "any/off" mit, aber ein Bulk-ANWÄHLEN erfasst sie nie (F1) — deshalb entscheidet für "on" die
// bulk-wählbare Teilmenge.
export type GroupCheckState = "on" | "off" | "mixed";
export function groupCheckboxState(
  checked: readonly boolean[],
  rows: readonly PreviewRow[],
): GroupCheckState {
  if (!rowsAnyChecked(checked, rows)) {
    return "off";
  }
  const selectable = bulkSelectableRows(rows);
  if (selectable.length > 0 && rowsAllChecked(checked, selectable)) {
    return "on";
  }
  return "mixed";
}

// WP-BILD-1f RT5a: eingeklappt-Standard, sobald „viele" Gruppen entstehen. Schwelle: MEHR als
// COLLAPSE_GROUPS_THRESHOLD (=4) Gruppen → Ordner starten zugeklappt (der Nutzer klappt gezielt auf).
// Bis einschließlich 4 Gruppen bleiben sie offen (schneller Überblick ohne Klick).
export const COLLAPSE_GROUPS_THRESHOLD = 4;
export function groupsCollapsedByDefault(groupCount: number): boolean {
  return groupCount > COLLAPSE_GROUPS_THRESHOLD;
}

// WP-BILD-1f RT5c: Status-Filter-Chips DYNAMISCH aus den tatsächlichen Treffern — nur vorkommende
// Werte, jeweils mit Zähler. "all" ist immer dabei (Gesamtzahl); "new"/"imported"/"queued" nur, wenn
// wenigstens ein Treffer sie erfüllt. Verschwindet ein Wert aus dem Bestand, verschwindet sein Chip.
export interface StatusChipCount {
  chip: PreviewChip;
  count: number;
}
export function statusChipCounts(entries: readonly ImportPreviewEntry[]): StatusChipCount[] {
  const out: StatusChipCount[] = [{ chip: "all", count: entries.length }];
  for (const chip of ["new", "imported", "queued"] as const) {
    const count = entries.reduce((n, entry) => (chipMatches(entry, chip) ? n + 1 : n), 0);
    if (count > 0) {
      out.push({ chip, count });
    }
  }
  return out;
}

// WP-BILD-1f RT5c: Gruppier-Modi DYNAMISCH — „nach Sprache"/„nach Thema" werden nur angeboten, wenn
// sie im Bestand mindestens ZWEI Gruppen ergäben (sonst ist die Gruppierung sinnlos). "none" (flache
// Liste) ist immer dabei. count = Anzahl Gruppen, die der Modus erzeugt (bei "none": Trefferzahl).
export interface GroupModeOption {
  mode: PreviewGroupMode;
  count: number;
}
export function groupModeOptions(entries: readonly ImportPreviewEntry[]): GroupModeOption[] {
  const rows: PreviewRow[] = entries.map((entry, index) => ({ entry, index }));
  const out: GroupModeOption[] = [{ mode: "none", count: entries.length }];
  const languageCount = groupRows(rows, "language").length;
  if (languageCount >= 2) {
    out.push({ mode: "language", count: languageCount });
  }
  const themeCount = groupRows(rows, "theme").length;
  if (themeCount >= 2) {
    out.push({ mode: "theme", count: themeCount });
  }
  return out;
}

// WP-BILD-1f RT5c: der angeforderte Gruppier-Modus, sofern er im aktuellen Bestand überhaupt
// angeboten wird — sonst fällt er ehrlich auf „none" zurück (kein toter, unsichtbarer Modus).
export function effectiveGroupMode(
  entries: readonly ImportPreviewEntry[],
  requested: PreviewGroupMode,
): PreviewGroupMode {
  return groupModeOptions(entries).some((option) => option.mode === requested) ? requested : "none";
}

// ---- RT5a-c (nacht24 Paket 5): Sprach-Massenaktion + echter Subfolder-Baum ----

// Sprach-Zähler über den GESAMTEN gefundenen Bestand (nicht nur die sichtbaren Zeilen) — Basis der
// „alle <Sprache> abwählen"-Massenaktion. Nur vorkommende Sprachen, feste Ordnung DE/EN/NL/übrige.
export interface LanguageCount {
  language: PreviewLanguage;
  count: number;
}

export function languageCounts(entries: readonly ImportPreviewEntry[]): LanguageCount[] {
  const counts = new Map<PreviewLanguage, number>();
  for (const entry of entries) {
    const lang = previewLanguage(entry);
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  return (["de", "en", "nl", "other"] as const)
    .filter((lang) => (counts.get(lang) ?? 0) > 0)
    .map((lang) => ({ language: lang, count: counts.get(lang) as number }));
}

// „Alle <Sprache> abwählen" mit EINEM Klick: wirkt auf ALLE Einträge dieser Sprache — unabhängig
// von Suche/Filter/Sichtbarkeit (der Text verspricht ALLE, also gilt ALLE; dieselbe Ehrlichkeitsregel
// wie clearAllSelected/F2). Nur Abwahl — nie eine versteckte Anwahl.
export function deselectLanguage(
  checked: readonly boolean[],
  entries: readonly ImportPreviewEntry[],
  language: PreviewLanguage,
): boolean[] {
  const next = [...checked];
  entries.forEach((entry, index) => {
    if (previewLanguage(entry) === language) {
      next[index] = false;
    }
  });
  return next;
}

// RT5a (nacht24): ECHTER Subfolder-Baum — im Sprach-Modus bekommt jeder Sprach-Ordner
// Themen-UNTERORDNER (auf-/zuklappbar), sobald in der Sprache mindestens ZWEI Themen-Gruppen
// entstehen (sonst bleibt der Ordner ehrlich flach — ein einzelner Unterordner wäre nur Klickweg).
// Der Themen-Modus bleibt bewusst einstufig (Themen sind im Bestand nicht hierarchisch).
export interface PreviewTreeGroup extends PreviewGroup {
  children?: PreviewGroup[];
}

export function groupRowsTree(
  rows: readonly PreviewRow[],
  mode: PreviewGroupMode,
): PreviewTreeGroup[] {
  const top = groupRows(rows, mode);
  if (mode !== "language") {
    return top;
  }
  return top.map((group) => {
    const children = groupRows(group.rows, "theme");
    return children.length >= 2 ? { ...group, children } : group;
  });
}

// D7: dauerhaft sichtbare Auswahl-Zusammenfassung „X von Y gewählt".
export interface SelectionSummary {
  selected: number;
  total: number;
}

export function selectionSummary(checked: readonly boolean[]): SelectionSummary {
  return {
    selected: checked.reduce((n, on) => (on ? n + 1 : n), 0),
    total: checked.length,
  };
}
