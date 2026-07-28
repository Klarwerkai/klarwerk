// WP-SHIP9-S2 Paket 2 (Import-UX D2–D7): reines View-Modell der Auswahl-Trefferliste.
// Keine React-/Netz-Abhängigkeit — die UI (ImportSelect.tsx) hält nur den State und rendert; die
// gesamte Auswahl-, Filter-, Such- und Gruppierungs-Logik lebt hier und ist als pure Logik getestet.
// Der Auswahl-Zustand bleibt `checkedRows: boolean[]`, indexiert nach dem ORIGINAL-Index in
// `preview[]` (Bindeglied, das durch Filtern/Gruppieren stabil bleibt).
//
// AUFTRAG-mega27 Block A: die Trefferliste kann jetzt die ECHTE QUELL-HIERARCHIE zeigen. Bis mega26
// konnte sie nur nach ABGELEITETEN Merkmalen (Sprache/Thema) bündeln — es gab schlicht keine
// Struktur im Datensatz. Mit `sourceScope` (Quell-Container = Wurzel) und `sourcePath` (Elternkette
// darin) entsteht ein Ordnerbaum BELIEBIGER TIEFE.
//
// AUFTRAG-mega27 Block B: die Filter der Trefferliste sind kein Eigenbau mehr. Sie laufen über
// DIESELBE Facetten-Technik wie die Bibliothek (lib/facets: kombinierbare Zähler, Mengensemantik,
// struktureller No-Match) plus den additiven Bereichsfilter aus lib/facetRail. Massenaktionen
// („alle abwählen", „alle <Sprache> abwählen") bleiben in der Funktion, sind aber KEINE Filter —
// sie ändern die Auswahl, Filter ändern nur die Sicht.
import type { ImportPreviewEntry } from "../api/types";
import type { FacetGroupConfig } from "./facetFilter";
import { EMPTY_FACET_RANGE, type FacetRange, matchesFacetRange } from "./facetRail";
import { type FacetSelection, type FacetValues, languageFromTitle, matchesFacets } from "./facets";
import { displayImportText } from "./htmlEntities";

// D7: Status-Werte der Trefferliste. Bis mega26 waren das eigene Filter-Chips; seit Block B sind es
// die Werte der Facette „Status" (dieselbe Bedeutung, dieselbe Prüfung — s. chipMatches).
export type PreviewChip = "all" | "new" | "imported" | "queued";
// D3/D5 + mega27 A4: Ordner-/Gruppen-Ansicht. "none" = flache Liste; "folder" = der ECHTE
// Quell-Ordnerbaum (beliebige Tiefe); "theme"/"language" sind die abgeleiteten Sortierhilfen.
export type PreviewGroupMode = "none" | "theme" | "language" | "folder";
export type PreviewLanguage = "de" | "en" | "nl" | "other";

export interface PreviewViewState {
  // D7: Freitext-Suche über der Trefferliste (Titel + Autor, dekodiert).
  query: string;
  // D3/D5/A4: Gruppierung.
  groupMode: PreviewGroupMode;
  // Block B: die Facetten-Auswahl (Ordner/Sprache/Thema/Autor/Status) — Mengensemantik aus
  // lib/facets, kein zweiter Nachbau.
  selection: FacetSelection;
  // Block B: der additive Bereichsfilter (Zeitraum) — bewusst NEBEN der Wertemenge, s. facetRail.
  range: FacetRange;
}

export const DEFAULT_PREVIEW_VIEW: PreviewViewState = {
  query: "",
  groupMode: "none",
  selection: {},
  range: EMPTY_FACET_RANGE,
};

export interface PreviewRow {
  entry: ImportPreviewEntry;
  // Original-Index in preview[] — die Verbindung zu checkedRows bleibt über Filter/Gruppen erhalten.
  index: number;
}

export interface PreviewGroup {
  key: string;
  kind: "theme" | "language" | "folder";
  // Rohwert der Gruppe (Theme-Text bzw. Sprach-Schlüssel) — die Anzeige dekodiert der Aufrufer.
  // AUFTRAG-mega27 A4: Ordner-Knoten tragen ihren Wert bereits KANONISCH (s. textCodec unten).
  value: string;
  language?: PreviewLanguage;
  // AUFTRAG-mega27 A2/A4: Dekodier-Marker der Gruppen-Beschriftung. "decoded" = der Wert ist bereits
  // kanonisch — die Anzeige darf ihn NICHT erneut dekodieren (sonst würde ein echtes Literal
  // „&uuml;" fälschlich zu „ü"). Dieselbe Regel wie am Item (textCodec).
  textCodec?: "decoded";
  // ALLE Zeilen dieses Knotens INKLUSIVE seiner Unterordner. Dreizustand und Zähler hängen daran —
  // ein Ordner-Haken erfasst also immer den GESAMTEN Teilbaum, nicht nur die direkten Kinder.
  rows: PreviewRow[];
}

// D5: führendes Sprach-Präfix des Titels → DE/EN/NL, sonst "other".
// RT5c (nacht24 Paket 5, „Code teilen"): dieselbe Erkennung wie die Bibliotheks-Facetten —
// die Präfix-Logik lebt jetzt EINMAL in lib/facets.languageFromTitle.
export function previewLanguage(entry: ImportPreviewEntry): PreviewLanguage {
  return languageFromTitle(displayImportText(entry.title, entry.textCodec));
}

// D7: welchem Status-Wert genügt ein Eintrag? (Bis mega26 der Filter-Chip; seit Block B die EINE
// Quelle der Status-Facette — kein zweites Regelwerk daneben.)
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

// D4: „bereits importiert" ODER „bereits vorgemerkt" = bekannter Bestand.
function isKnown(entry: ImportPreviewEntry): boolean {
  return entry.alreadyImported === true || entry.alreadyQueued === true;
}

// F1 (bens ROT): ZENTRALE Regel, welche Zeilen eine BULK-Aktion (Alle wählen, Ordner-/Gruppen-
// Checkbox) überhaupt anfassen darf — bereits importierte oder vorgemerkte Einträge NIE.
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

// ---- Block B: die Facetten der Auswahl (dieselbe Technik wie die Bibliothek) -------------------

// AUFTRAG-mega27 B2: die Dimensionen der Trefferliste. Reihenfolge = Anzeigereihenfolge der
// Schiene, Führung von grob nach fein und von STRUKTUR nach ABLEITUNG:
//   Ordner (echte Quell-Struktur) · Status (was ist überhaupt noch zu tun) · Thema (Quell-Labels)
//   · Autor · Sprache (abgeleitet).
// AUFTRAG-mega28 BLOCK C (Pedi 26.07.): Diese Reihenfolge bleibt, aber „Sprache" ist NICHT mehr
// hinter „Weitere Filter" versteckt (s. IMPORT_SELECT_SECONDARY_FACET_KEYS) — sichtbar sind damit
// Ordner · Status · Thema · Sprache, hinter der Klappe steht allein „Autor".
export const IMPORT_SELECT_FACET_CONFIGS: readonly FacetGroupConfig[] = [
  { key: "folder", labelKey: "imp.select.facet.folder" },
  { key: "status", labelKey: "imp.select.facet.status" },
  { key: "theme", labelKey: "imp.select.facet.theme" },
  { key: "author", labelKey: "imp.select.facet.author" },
  { key: "language", labelKey: "imp.select.facet.language" },
];

// uxpol5 Punkt 2 (Vorbild Library.tsx): die selteneren Dimensionen hinter „Weitere Filter".
//
// AUFTRAG-mega28 BLOCK C (Pedi 26.07.): „Sprache" ist wieder in der SICHTBAREN Reihe. Die mega27-
// Begründung stimmt grundsätzlich — die Sprache ist ein aus dem Titel GERATENES Merkmal und steht
// ungern vor einem echten. Sie trifft nur nicht auf diesen Bestand zu: er ist dreisprachig gedoppelt,
// und die Sprache ist der Filter, den Pedi tatsächlich benutzt. Ein Filter, den der Nutzer täglich
// braucht, gehört nicht hinter eine Klappe, auch wenn seine Herkunft schwächer ist.
// Die übrige Reihenfolge (IMPORT_SELECT_FACET_CONFIGS) und die Massenaktion bleiben unverändert;
// „Autor" bleibt als seltenere Dimension hinter „Weitere Filter".
export const IMPORT_SELECT_SECONDARY_FACET_KEYS = ["author"] as const;

// Der Bereichsfilter wird hinter dieser Dimension einsortiert (Führung grob → fein).
export const IMPORT_SELECT_RANGE_AFTER_KEY = "theme";

// B2 „Ordner (oberste Pfadebene)": das erste Segment der Elternkette. Ein Eintrag OHNE Elternkette
// steht direkt im Quell-Container und hat damit ehrlich KEINEN Ordner — leere Liste (er fällt bei
// einer aktiven Ordner-Wahl heraus, s. FacetValues-Vertrag). Kein erfundener Sammel-Ordner.
export function previewTopFolder(entry: ImportPreviewEntry): string[] {
  const first = entry.sourcePath?.[0];
  const value = first ? displayImportText(first, entry.textCodec).trim() : "";
  return value.length > 0 ? [value] : [];
}

// B2: die Werte eines Vorschau-Eintrags je Facette. Kombinierbare Zähler und Auswahl laufen danach
// vollständig über lib/facets (combinableFacetCounts/matchesFacets) — hier steht NUR die Ableitung.
// Effizienz-Vertrag von lib/facets: der Aufrufer memoisiert diese Ableitung je Datenlauf.
export function previewFacetValues(entry: ImportPreviewEntry): FacetValues {
  return {
    folder: previewTopFolder(entry),
    // Genau die drei Zustände der bisherigen Status-Chips — über chipMatches, damit Chip-Semantik
    // und Facette nie auseinanderlaufen können. Mehrfachzugehörigkeit bleibt möglich (ein Eintrag
    // kann importiert UND vorgemerkt sein) und wird ehrlich als zwei Werte geführt.
    status: (["new", "imported", "queued"] as const).filter((chip) => chipMatches(entry, chip)),
    theme: entry.themes
      .map((theme) => displayImportText(theme, entry.textCodec).trim())
      .filter((theme) => theme.length > 0),
    author: entry.author
      ? [displayImportText(entry.author, entry.textCodec).trim()].filter((a) => a.length > 0)
      : [],
    language: [previewLanguage(entry)],
  };
}

// B2 „Jahr als Bereich": der Zeitpunkt, auf den der additive Bereichsfilter wirkt. Kein zweites
// Datums-Werk — matchesFacetRange (lib/facetRail) entscheidet, exakt wie in der Bibliothek. Ein
// Eintrag ohne (lesbares) Quell-Datum fällt bei AKTIVEM Bereich ehrlich heraus (er lässt sich
// nicht einordnen) und ist ohne Bereich unbeeinflusst.
export function previewChangedMs(entry: ImportPreviewEntry): number {
  const raw = entry.updatedAt?.trim();
  if (!raw) {
    return Number.NaN;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : Number.NaN;
}

// Sichtbare Zeilen nach Suche (D7) + Facetten-Auswahl (B2) + Bereichsfilter (B2). Reihenfolge =
// Original. `valuesOf` ist injizierbar, damit der Aufrufer die memoisierte Ableitung durchreichen
// kann (Effizienz-Vertrag) — ohne Angabe wird sie hier berechnet.
export function visibleRows(
  entries: readonly ImportPreviewEntry[],
  state: PreviewViewState,
  valuesOf: (entry: ImportPreviewEntry, index: number) => FacetValues = previewFacetValues,
): PreviewRow[] {
  const rows: PreviewRow[] = [];
  entries.forEach((entry, index) => {
    if (!searchMatches(entry, state.query)) {
      return;
    }
    if (!matchesFacets(valuesOf(entry, index), state.selection)) {
      return;
    }
    if (!matchesFacetRange(previewChangedMs(entry), state.range)) {
      return;
    }
    rows.push({ entry, index });
  });
  return rows;
}

const LANGUAGE_ORDER: PreviewLanguage[] = ["de", "en", "nl", "other"];

// D3/D5: sichtbare Zeilen in auf-/zuklappbare Gruppen bündeln. Reihenfolge innerhalb einer Gruppe
// bleibt die Original-Reihenfolge; Sprachen in fester Ordnung (DE/EN/NL/übrige), Themen alphabetisch
// mit „ohne Thema" ganz am Ende. Im Ordner-Modus liefert diese Funktion die OBERSTE Ebene des
// Baums (die Quell-Container); den vollen Baum baut groupRowsTree.
export function groupRows(rows: readonly PreviewRow[], mode: PreviewGroupMode): PreviewGroup[] {
  if (mode === "none") {
    return [];
  }
  if (mode === "folder") {
    return folderTree(rows);
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

// F2 (bens ROT): „Alle abwählen" leert die GESAMTE Auswahl — unabhängig von Suche, Facetten-Filter
// und Bereich (der Text verspricht ALLE, also gilt ALLE). Auch weggefilterte, aber gewählte
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
// AUFTRAG-mega27 A5: Aufrufer übergeben für einen Ordner IMMER `group.rows` — und das ist der
// GESAMTE Teilbaum (s. PreviewGroup.rows). Der Dreizustand aggregiert damit über alle Ebenen.
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
//
// AUFTRAG-mega27 A5 (begründete Entscheidung für den TIEFEN Baum): die Schwelle gilt JE EBENE, also
// auf der Zahl der GESCHWISTER eines Knotens — nicht auf der Gesamtzahl aller Ordner im Baum. Der
// Einklapp-Standard schützt vor einer WAND auf einen Blick, und eine Wand ist, was NEBENEINANDER
// steht, nicht was darunter liegt. Über den ganzen Baum gerechnet wäre schon eine flache Wurzel mit
// fünf Unterordnern „viel", und der Nutzer bekäme die Struktur zugeklappt, die er gerade sehen soll.
export const COLLAPSE_GROUPS_THRESHOLD = 4;
export function groupsCollapsedByDefault(siblingCount: number): boolean {
  return siblingCount > COLLAPSE_GROUPS_THRESHOLD;
}

// WP-BILD-1f RT5c: Gruppier-Modi DYNAMISCH — ein Modus wird nur angeboten, wenn er im Bestand
// mindestens ZWEI Gruppen ergäbe (sonst ist die Gruppierung sinnlos). "none" (flache Liste) ist
// immer dabei. count = Anzahl Gruppen, die der Modus erzeugt (bei "none": Trefferzahl; bei
// "folder": die Zahl ALLER Ordner im Baum, über alle Ebenen).
export interface GroupModeOption {
  mode: PreviewGroupMode;
  count: number;
}
export function groupModeOptions(entries: readonly ImportPreviewEntry[]): GroupModeOption[] {
  const rows: PreviewRow[] = entries.map((entry, index) => ({ entry, index }));
  const out: GroupModeOption[] = [{ mode: "none", count: entries.length }];
  // A4: der Ordner-Modus steht vorn — er ist die einzige Gruppierung, die eine ECHTE Quell-Struktur
  // zeigt statt einer Ableitung.
  const folderCount = countFolderNodes(folderTree(rows));
  if (hasAnySourcePath(entries) && folderCount >= 2) {
    out.push({ mode: "folder", count: folderCount });
  }
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

// ---- AUFTRAG-mega27 A4: der ECHTE Quell-Ordnerbaum ---------------------------------------------

// Trägt WENIGSTENS EIN Eintrag eine Elternkette? Ohne das gibt es keine Struktur zu zeigen — und
// dann darf der Ordner-Modus auch nicht die Vorgabe sein (er wäre ein einziger flacher Ordner).
export function hasAnySourcePath(entries: readonly ImportPreviewEntry[]): boolean {
  return entries.some((entry) => (entry.sourcePath?.length ?? 0) > 0);
}

// Der Quell-Container eines Eintrags (die WURZEL seines Ordnerbaums), bereits kanonisch.
function previewScope(entry: ImportPreviewEntry): string {
  return entry.sourceScope ? displayImportText(entry.sourceScope, entry.textCodec).trim() : "";
}

// Die Elternkette eines Eintrags, kanonisch und ohne leere Segmente (Wurzel zuerst).
function previewPath(entry: ImportPreviewEntry): string[] {
  return (entry.sourcePath ?? [])
    .map((segment) => displayImportText(segment, entry.textCodec).trim())
    .filter((segment) => segment.length > 0);
}

// AUFTRAG-mega27 A4/A5: ein Knoten des Ordnerbaums. `rows` = der GESAMTE Teilbaum (Dreizustand +
// Zähler); `ownRows` = die Zeilen, die DIREKT an diesem Knoten hängen. Ein Eintrag ohne Elternkette
// landet in den ownRows der Wurzel — sichtbar dort, wo er in der Quelle steht, NICHT in einem
// erfundenen Ordner „Sonstiges".
export interface PreviewTreeGroup extends PreviewGroup {
  children?: PreviewTreeGroup[];
  ownRows?: PreviewRow[];
}

interface FolderBuild {
  segment: string;
  own: PreviewRow[];
  all: PreviewRow[];
  children: Map<string, FolderBuild>;
}

function newFolder(segment: string): FolderBuild {
  return { segment, own: [], all: [], children: new Map() };
}

// Baut den Ordnerbaum BELIEBIGER TIEFE aus sourceScope (Wurzel) + sourcePath (Elternkette).
// Reihenfolge: Geschwister alphabetisch (eine Ordnerliste liest man alphabetisch), Zeilen innerhalb
// eines Knotens in ORIGINAL-Reihenfolge (wie in allen anderen Modi).
export function folderTree(rows: readonly PreviewRow[]): PreviewTreeGroup[] {
  const roots = new Map<string, FolderBuild>();
  const childOf = (parent: FolderBuild, segment: string): FolderBuild => {
    const existing = parent.children.get(segment);
    if (existing) {
      return existing;
    }
    const created = newFolder(segment);
    parent.children.set(segment, created);
    return created;
  };
  for (const row of rows) {
    const scope = previewScope(row.entry);
    const existingRoot = roots.get(scope);
    let node: FolderBuild;
    if (existingRoot) {
      node = existingRoot;
    } else {
      node = newFolder(scope);
      roots.set(scope, node);
    }
    node.all.push(row);
    for (const segment of previewPath(row.entry)) {
      node = childOf(node, segment);
      node.all.push(row);
    }
    node.own.push(row);
  }
  return folderTreeRoots(roots);
}

// ================================================================================================
// AUFTRAG-mega28 BLOCK B (bens M27-1) — DER ORDNER-SCHLÜSSEL KOLLIDIERT.
// ================================================================================================
//
// Der Baum übernahm jeden Pfad-Abschnitt UNVERÄNDERT als group.key; die Anzeige (ImportPreviewTree)
// verkettet Eltern- und Kind-Schlüssel mit einem Schrägstrich. Damit erhielten ein EINZELNER Ordner
// namens „A/B" und die echte Verschachtelung „A" → „B" denselben Auf-/Zu-Schlüssel: kommen beide im
// selben Import vor, teilen sie ihren Zustand, und das Aufklappen des einen schaltet das andere um.
// Bei Confluence-Titeln mit Schrägstrich ist das ein völlig legaler Fall.
//
// Die Kodierung macht die Abbildung Segment → Schlüssel INJEKTIV: encodeURIComponent maskiert „/"
// als %2F und (wichtig für die Umkehrbarkeit des Arguments) „%" selbst als %25. Ein kodiertes
// Segment kann danach keinen Schrägstrich mehr enthalten — die Verkettung in der Anzeige ist damit
// eindeutig zerlegbar und kollisionsfrei. Der Schlüssel ist reine Anzeige-Identität (Auf/Zu); er
// wird nie angezeigt, nie gespeichert und nie zurückgelesen.
function encodeTreeSegment(segment: string): string {
  return encodeURIComponent(segment);
}

export function folderTreeSegmentKey(segment: string): string {
  return encodeTreeSegment(segment);
}

function folderTreeRoots(roots: Map<string, FolderBuild>): PreviewTreeGroup[] {
  return [...roots.values()]
    .sort((a, b) => a.segment.localeCompare(b.segment))
    .map((root) => toTreeGroup(root, `folder:${encodeTreeSegment(root.segment)}`));
}

function toTreeGroup(node: FolderBuild, key: string): PreviewTreeGroup {
  const children = [...node.children.values()]
    .sort((a, b) => a.segment.localeCompare(b.segment))
    // Der Schlüssel eines Unterordners ist NUR sein (kodiertes) Segment; die Anzeige setzt den
    // vollen Pfad-Schlüssel aus Eltern- und Kind-Schlüssel zusammen (dieselbe Regel wie im
    // Sprach-/Themen-Baum). mega28 B: kodiert, damit „A/B" und „A"→„B" auseinanderfallen.
    .map((child) => toTreeGroup(child, encodeTreeSegment(child.segment)));
  return {
    key,
    kind: "folder",
    value: node.segment,
    // A2/A4: der Wert ist bereits kanonisch (displayImportText lief bei der Ableitung) — die
    // Anzeige dekodiert NICHT erneut.
    textCodec: "decoded",
    rows: node.all,
    ownRows: node.own,
    ...(children.length > 0 ? { children } : {}),
  };
}

// Zahl ALLER Ordner-Knoten im Baum (über alle Ebenen) — die ehrliche Antwort auf „wie viele Ordner".
export function countFolderNodes(groups: readonly PreviewTreeGroup[]): number {
  return groups.reduce((n, group) => n + 1 + countFolderNodes(group.children ?? []), 0);
}

// A4: WARUM der Ordner-Modus gerade nicht die Vorgabe ist — genau eine Zeile, ehrlich benannt.
// null = er ist verfügbar.
export type FolderModeUnavailableReason = "no-path" | "single-folder";
export function folderModeUnavailableReason(
  entries: readonly ImportPreviewEntry[],
): FolderModeUnavailableReason | null {
  if (!hasAnySourcePath(entries)) {
    return "no-path";
  }
  const rows: PreviewRow[] = entries.map((entry, index) => ({ entry, index }));
  return countFolderNodes(folderTree(rows)) >= 2 ? null : "single-folder";
}

// A4: der VORGABE-Modus eines frischen Bestands. Ordner, sobald wenigstens ein Eintrag einen Pfad
// trägt UND daraus mindestens zwei Ordner entstehen; sonst ehrlich das heutige Verhalten (flache
// Liste) — die Oberfläche nennt dann in einer Zeile den Grund (folderModeUnavailableReason).
export function defaultGroupMode(entries: readonly ImportPreviewEntry[]): PreviewGroupMode {
  return folderModeUnavailableReason(entries) === null ? "folder" : "none";
}

// RT5a (nacht24): ECHTER Subfolder-Baum. Im Sprach-Modus bekommt jeder Sprach-Ordner
// Themen-UNTERORDNER (auf-/zuklappbar), sobald in der Sprache mindestens ZWEI Themen-Gruppen
// entstehen (sonst bleibt der Ordner ehrlich flach — ein einzelner Unterordner wäre nur Klickweg).
// Der Themen-Modus bleibt bewusst einstufig (Themen sind im Bestand nicht hierarchisch).
// AUFTRAG-mega27 A4: der Ordner-Modus liefert den vollen Quell-Baum in BELIEBIGER Tiefe.
export function groupRowsTree(
  rows: readonly PreviewRow[],
  mode: PreviewGroupMode,
): PreviewTreeGroup[] {
  if (mode === "folder") {
    return folderTree(rows);
  }
  const top = groupRows(rows, mode);
  if (mode !== "language") {
    return top;
  }
  return top.map((group) => {
    const children = groupRows(group.rows, "theme");
    return children.length >= 2 ? { ...group, children } : group;
  });
}

// ---- Massenaktionen (Block B4: KEINE Filter — sie ändern die Auswahl, nicht die Sicht) ---------

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
