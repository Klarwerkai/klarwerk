// IC-3 (Import-Cockpit): PURE Auswahl-/Filterlogik. Der Nutzer grenzt per Klick (Label-/Autor-/
// Jahr-Filter) ODER per Freitext (KI leitet Kriterien ab) ein, WAS importiert wird — statt alles roh
// zu bekommen. Diese Datei ist vollständig deterministisch, ohne KI und ohne Confluence-Symbole (kennt
// nur den quell-agnostischen ImportItem-Vertrag). Die KI-Ableitung ist über eine INJIZIERTE Funktion
// eingebunden (kein reasoner-Import hier); fällt sie aus, gelten leere Kriterien → nur der Klick-Filter.

// WP-IC-PAKET-1e (bens sammel10): die Selektion vergleicht gegen dieselben KANONISCHEN Pro-Item-Werte
// wie das Erkundungs-Aggregat (GETEILTE canonicalImportText-Funktion, keine Zweitlogik) — ein Klick
// auf einen Summary-Chip (z. B. dekodierter Altbestands-Autor) matcht damit auch das rohe Alt-Item.
import { canonicalImportText } from "./text-codec";
import { deriveTitleThemes } from "./themes";
import type { ImportItem } from "./types";

export interface SelectCriteria {
  // Themen-Filter: matcht echte Labels UND (WP-IC-PAKET-1 Teil 2/3) die deterministisch aus Titeln
  // abgeleiteten Themen label-loser Items — die klickbaren Erkundungs-Chips filtern damit beides.
  themes?: string[];
  authors?: string[]; // Autor-Filter (Autor muss einer sein)
  keywords?: string[]; // Stichworte → Substring-Match in Titel/Statement (mind. eines)
  yearFrom?: number; // Jahr-Untergrenze (aus updatedAt)
  yearTo?: number; // Jahr-Obergrenze (aus updatedAt)
  // WP-IC-PAKET-1 (Teil 3): Quell-Container-Filter (Space; sourceScope, sonst category).
  spaces?: string[];
  limit?: number; // Deckel auf die Vorschau/Auswahl
}

export interface SelectResult {
  selected: ImportItem[]; // passende Items, auf `limit` gedeckelt
  matched: number; // Anzahl ALLER passenden Items (vor dem Deckel)
  limited: boolean; // true, wenn der Deckel weniger zeigt, als passen
}

// Plausibilitätsgrenzen für die (auch von außen/vom Modell gelieferten) Kriterien.
const MAX_LIST_ENTRIES = 40;
const MIN_YEAR = 1990;
const MAX_YEAR = 2100;
const MAX_LIMIT = 1000;

function cleanStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") {
      continue;
    }
    const trimmed = raw.trim();
    const key = trimmed.toLowerCase();
    if (trimmed.length > 0 && !seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
    if (out.length >= MAX_LIST_ENTRIES) {
      break;
    }
  }
  return out;
}

function cleanYear(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= MIN_YEAR && n <= MAX_YEAR ? n : undefined;
}

function cleanLimit(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n > 0 && n <= MAX_LIMIT ? n : undefined;
}

// IC-3: JEDE Kriterien-Quelle (Client-Body ODER Modell-JSON) läuft hier durch — nur valide, plausible
// Felder überleben; alles andere fällt weg. „Nie raten, nie erfinden": Unbrauchbares → leeres Feld.
export function sanitizeCriteria(raw: unknown): SelectCriteria {
  if (raw === null || typeof raw !== "object") {
    return {};
  }
  const rec = raw as Record<string, unknown>;
  const themes = cleanStrings(rec.themes);
  const authors = cleanStrings(rec.authors);
  const keywords = cleanStrings(rec.keywords);
  const spaces = cleanStrings(rec.spaces);
  const yearFrom = cleanYear(rec.yearFrom);
  const yearTo = cleanYear(rec.yearTo);
  const limit = cleanLimit(rec.limit);
  return {
    ...(themes.length > 0 ? { themes } : {}),
    ...(authors.length > 0 ? { authors } : {}),
    ...(keywords.length > 0 ? { keywords } : {}),
    ...(spaces.length > 0 ? { spaces } : {}),
    ...(yearFrom !== undefined ? { yearFrom } : {}),
    ...(yearTo !== undefined ? { yearTo } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

function itemYear(item: ImportItem): number | null {
  const when = item.updatedAt?.trim();
  if (!when) {
    return null;
  }
  const match = /^(\d{4})/.exec(when);
  return match ? Number(match[1]) : null;
}

// WP-IC-PAKET-1 (Teil 2/3): matcht echte Labels ODER das deterministisch abgeleitete Titel-Thema
// (derivedTheme, für label-lose Items — dieselbe Ableitung wie in der Erkundung, kein Drift).
function matchesThemes(
  item: ImportItem,
  themes: Set<string>,
  derivedTheme: string | null,
): boolean {
  if (themes.size === 0) {
    return true;
  }
  if (
    (item.tags ?? []).some((tag) => themes.has(canonicalImportText(item, tag).trim().toLowerCase()))
  ) {
    return true;
  }
  return derivedTheme !== null && themes.has(derivedTheme.toLowerCase());
}

// WP-IC-PAKET-1 (Teil 3): Quell-Container-Filter (Space) — gleicher Scope-Begriff wie die Erkundung.
function matchesSpaces(item: ImportItem, spaces: Set<string>): boolean {
  if (spaces.size === 0) {
    return true;
  }
  // WP-IC-PAKET-1f (bens sammel11 P2): Reihenfolge durchgängig KANONISIEREN → DANN trimmen/
  // normalisieren — identisch zur Chip-Seite (Erkundung); ein Entity-gepolsterter Space (&nbsp;…)
  // matcht so exakt seinen kanonisierten Chip.
  const scope = canonicalImportText(item, item.sourceScope ?? item.category ?? "")
    .trim()
    .toLowerCase();
  return scope.length > 0 && spaces.has(scope);
}

function matchesAuthors(item: ImportItem, authors: Set<string>): boolean {
  if (authors.size === 0) {
    return true;
  }
  const author = item.author
    ? canonicalImportText(item, item.author).trim().toLowerCase()
    : undefined;
  return author !== undefined && author.length > 0 && authors.has(author);
}

function matchesYears(item: ImportItem, from?: number, to?: number): boolean {
  if (from === undefined && to === undefined) {
    return true;
  }
  const year = itemYear(item);
  if (year === null) {
    return false; // Jahr gefordert, aber keins bekannt → NICHT raten, ausschließen.
  }
  if (from !== undefined && year < from) {
    return false;
  }
  return !(to !== undefined && year > to);
}

function matchesKeywords(item: ImportItem, keywords: readonly string[]): boolean {
  if (keywords.length === 0) {
    return true;
  }
  // WP-IC-PAKET-1f (bens sammel11 P1): auch der Freitext-Satz-Pfad vergleicht gegen KANONISCHE Werte
  // (geteilte Funktion) — ein Stichwort wie „Küche" findet das rohe K&uuml;che-Alt-Item; markierte
  // Literale bleiben byte-genau und matchen nicht fälschlich.
  const haystack =
    `${canonicalImportText(item, item.title)} ${canonicalImportText(item, item.statement)}`.toLowerCase();
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

// IC-3: reine, deterministische Filterung + Deckelung. Reihenfolge = Eingabereihenfolge (stabil).
export function filterImportItems(
  items: readonly ImportItem[],
  criteria: SelectCriteria = {},
): SelectResult {
  const themes = new Set((criteria.themes ?? []).map((t) => t.toLowerCase()));
  const authors = new Set((criteria.authors ?? []).map((a) => a.toLowerCase()));
  const spaces = new Set((criteria.spaces ?? []).map((s) => s.toLowerCase()));
  const keywords = criteria.keywords ?? [];
  // WP-IC-PAKET-1 (Teil 2): abgeleitete Titel-Themen der label-losen Items — NUR berechnet, wenn ein
  // Themen-Filter aktiv ist; identische Ableitung wie summarizeImportItems (deterministisch, kein
  // Drift): Titel gehen wie dort KANONISIERT in die Ableitung (1e), und die Klassifikation
  // getaggt/label-los entscheidet wie dort NACH Kanonisierung+Trim (1f P3).
  const derivedTheme = new Map<ImportItem, string | null>();
  if (themes.size > 0) {
    const untagged = items.filter(
      (it) =>
        (it.tags ?? [])
          .map((tag) => canonicalImportText(it, tag).trim())
          .filter((tag) => tag.length > 0).length === 0,
    );
    const labels = deriveTitleThemes(untagged.map((it) => canonicalImportText(it, it.title)));
    untagged.forEach((it, i) => {
      derivedTheme.set(it, labels[i] ?? null);
    });
  }
  const passing = items.filter(
    (item) =>
      matchesThemes(item, themes, derivedTheme.get(item) ?? null) &&
      matchesAuthors(item, authors) &&
      matchesSpaces(item, spaces) &&
      matchesYears(item, criteria.yearFrom, criteria.yearTo) &&
      matchesKeywords(item, keywords),
  );
  const limit = criteria.limit;
  const selected = limit !== undefined && limit > 0 ? passing.slice(0, limit) : [...passing];
  return {
    selected,
    matched: passing.length,
    limited: limit !== undefined && limit > 0 && passing.length > limit,
  };
}

// IC-3: kompakter Vorschau-Eintrag (READ-ONLY Anzeige — kein Import). Pure Projektion eines ImportItems.
export interface ImportPreviewEntry {
  title: string;
  author?: string;
  updatedAt?: string;
  hasImage: boolean;
  themes: string[];
  // WP-IC-PAKET-1 (Teil 4, IC-6a): Import-Status — additiv, vom Aufrufer (Route) über den
  // Quell-Referenz-Abgleich gesetzt. WP-SHIP9-S1b (bens GELB): ZWEI getrennte Kennzeichen —
  // alreadyImported NUR aus einem lebenden KO-Herkunftsanker; alreadyQueued = offener Kandidat
  // („bereits zur Prüfung vorgemerkt"), nie mehr als „bereits importiert" ausgegeben.
  alreadyImported?: boolean;
  alreadyQueued?: boolean;
  // Änderungs-Signal über die Versionsnummer der Quelle (sourceVersion > importierte Version) —
  // reine Anzeige, KEIN Update-Mechanismus (IC-6b bewusst nicht gebaut).
  sourceNewer?: boolean;
  // WP-IC-PAKET-1c (bens ROT-2): Decode-Marker aus dem Item durchgereicht — die Anzeige dekodiert
  // NUR ohne Marker (Altbestand) defensiv nach; markierte Texte sind kanonisch.
  textCodec?: "decoded";
}

export interface ImportedStatus {
  alreadyImported: boolean;
  // WP-SHIP9-S1b: offener Kandidat — eigener Zustand „bereits zur Prüfung vorgemerkt".
  alreadyQueued: boolean;
  sourceNewer: boolean;
}

export function toPreviewEntry(item: ImportItem, status?: ImportedStatus): ImportPreviewEntry {
  const author = item.author?.trim();
  const updatedAt = item.updatedAt?.trim();
  const themes = (item.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  return {
    title: item.title,
    ...(author ? { author } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    hasImage: typeof item.bodyHtml === "string" && /<img\b/i.test(item.bodyHtml),
    themes,
    ...(status?.alreadyImported ? { alreadyImported: true } : {}),
    ...(status?.alreadyQueued ? { alreadyQueued: true } : {}),
    ...(status?.sourceNewer ? { sourceNewer: true } : {}),
    ...(item.textCodec === "decoded" ? { textCodec: "decoded" as const } : {}),
  };
}

// IC-3: Freitext → Kriterien über eine INJIZIERTE Inferenz (der Aufrufer verdrahtet den Reasoner).
// `infer` liefert das ROH-JSON des Modells (criteria: unknown|null) plus die EHRLICHE Ausfall-
// Ursache (fallbackReason, Muster wie überall: no-model/model-timeout/model-error; null = geliefert).
// JEDER Ausfall endet in LEEREN Kriterien: nie raten, nie erfinden — aber seit WP-SAMMEL20-FIX
// (bens Fix 2) NICHT mehr still: der Aufrufer bekommt die Ursache und meldet sie sichtbar, statt
// die ungefilterte Vollmenge als KI-Ergebnis auszugeben. Nur der deterministische sanitizeCriteria
// formt das Ergebnis. Ein leerer/whitespace-Prompt ruft die KI gar nicht erst.
export interface CriteriaInferenceOutcome {
  criteria: unknown | null;
  fallbackReason: string | null;
}
export type CriteriaInference = (prompt: string) => Promise<CriteriaInferenceOutcome>;

export interface DerivedCriteria {
  criteria: SelectCriteria;
  // null = KI hat geliefert oder war (leerer Prompt) gar nicht gefragt; sonst die Ausfall-Ursache.
  fallbackReason: string | null;
}

export async function deriveCriteriaFromPrompt(
  prompt: string,
  infer: CriteriaInference,
): Promise<DerivedCriteria> {
  if (prompt.trim().length === 0) {
    return { criteria: {}, fallbackReason: null };
  }
  try {
    const outcome = await infer(prompt);
    if (outcome.fallbackReason !== null) {
      return { criteria: {}, fallbackReason: outcome.fallbackReason };
    }
    return {
      criteria:
        outcome.criteria === null || outcome.criteria === undefined
          ? {}
          : sanitizeCriteria(outcome.criteria),
      fallbackReason: null,
    };
  } catch {
    // Ein werfender Inferenz-Adapter ist ein Modellfehler — ehrlich statt still leer.
    return { criteria: {}, fallbackReason: "model-error" };
  }
}
