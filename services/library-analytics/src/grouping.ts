// WP-IC-4 (Schritt 4 des abgenommenen Cockpit-Flows): pure Zulieferung für die KI-Gruppierung.
// Baut aus der eingegrenzten Kandidatenliste die SPARSAME Modell-Eingabe (id, kanonisierter Titel,
// kurzer kanonisierter Text, IC-1-Thema — NIE volle Bodies) und die rein DETERMINISTISCHEN
// Qualitätshinweise je Kandidat. Kennt bewusst KEIN Reasoner-Symbol (das Modul bleibt unterhalb;
// die App-Route reicht die strukturell kompatiblen Eingaben an den Reasoner weiter).
import {
  CONFIDENTIALITY_LEVELS,
  confidentialityRank,
  isConfidential,
  isValidConfidentiality,
} from "../../knowledge-object";
import { canonicalImportText } from "./text-codec";
import { deriveTitleThemes } from "./themes";
import type { ImportItem } from "./types";

// Sparsamkeits-Deckel des Kurztexts je Kandidat (Modell-Eingabe, nie volle Bodies zur Cloud).
export const GROUP_TEXT_MAX_CHARS = 240;

// WP-SHIP7-FIX (bens sammel17-GELB): Titel-Deckel der Modell-Eingabe + harter UTF-8-Deckel über den
// GESAMTEN Gruppierungs-Prompt. Über dem Budget werden ZUERST die Kurztexte ehrlich gekappt/entfernt
// (der Flow bleibt benutzbar — Titel reichen fürs Themen-Clustern); erst wenn selbst die Minimalform
// (Titel 80, keine Texte) das Budget sprengt (pathologisch lange Ids), lehnt die Route mit 400 ab.
export const GROUP_TITLE_MAX_INPUT_CHARS = 160;
export const GROUP_PROMPT_MAX_UTF8_BYTES = 60_000;

// WP-SHIP7-FIX (bens P0, Fix 1): Vertraulichkeits-Klassifikation der GRUPPIERUNG — dieselbe
// fail-safe Kette wie der Import selbst (Confluence-Mapper: restringiert → „vertraulich";
// library-analytics beim Annehmen: fehlendes Signal → fail-safe „vertraulich", ungültige Stufe →
// restriktiv „vertraulich"). SICHERER BATCH-VERTRAG (ganz oder gar nicht, keine Partitionierung):
// sobald EIN Kandidat vertraulich, streng vertraulich, ungültig klassifiziert ODER ohne Signal ist,
// läuft die GESAMTE Gruppierung vertraulich (Provider-Kette dann nie Cloud). Nur wenn ALLE
// Kandidaten eine explizit gültige, freigegebene Stufe („intern") tragen, darf die Cloud arbeiten.
export function groupingRequiresConfidential(items: readonly ImportItem[]): boolean {
  return items.some(
    (item) => !isValidConfidentiality(item.confidentiality) || isConfidential(item.confidentiality),
  );
}

// Qualitätshinweis-Schwellen (bens Vorgaben): Veraltet nach 365 Tagen; „wenig Inhalt" unter
// 200 kanonisierten Zeichen.
export const STALE_AFTER_DAYS = 365;
export const MIN_CONTENT_CHARS = 200;

export type CandidateHint = "already-imported" | "stale" | "short";

// Sparsame Gruppierungs-Eingabe je Kandidat (strukturell kompatibel zum Reasoner-Vertrag).
export interface GroupingCandidate {
  id: string;
  title: string;
  text?: string;
  theme?: string | null;
}

// Stabile Kandidaten-Id innerhalb EINER eingegrenzten Auswahl: der quellneutrale externalId-Anker
// (IC-6a), sonst die Position in der Auswahl (Demo-/Fixture-Items ohne Anker).
export function candidateIdOf(item: ImportItem, index: number): string {
  const external = item.externalId?.trim();
  return external && external.length > 0 ? external : `row-${index + 1}`;
}

// WP-REST18 (bens Fix 1): Restriktions-Rang eines Items für den Dedupe-Entscheid — fehlende/
// ungültige Klassifikation zählt fail-safe wie „vertraulich" (dieselbe Semantik wie
// groupingRequiresConfidential: unklar macht den Batch vertraulich).
function restrictionRank(item: ImportItem): number {
  return isValidConfidentiality(item.confidentiality)
    ? confidentialityRank(item.confidentiality)
    : confidentialityRank("vertraulich");
}

// WP-SHIP8-FIX (bens F4): die gültige Version eines Items für den Inhalts-Entscheid der Dedupe.
// Nur eine positive sichere Ganzzahl zählt; alles andere (fehlend, 0, negativ, gebrochen, Fremdtyp)
// zählt wie die implizite Erstversion 1 — deckungsgleich mit `sourceVersion ?? 1` im Import-Kern.
function contentVersion(item: ImportItem): number {
  const v = item.sourceVersion;
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : 1;
}

// WP-REST18 (bens Fix 1, QUELL-ID-DEDUPE AM ROUTENEINGANG): veränderliche Pagination kann dieselbe
// externalId MEHRFACH in einen Snapshot liefern — die Genau-einmal-Invariante normalisiert aber nur
// die Modellantwort. Deshalb wird `selected` EINMAL zentral nach stabiler Kandidaten-Id
// dedupliziert, BEVOR Kandidatenliste, Modell-Eingabe, deterministischer Fallback und Apply-Map
// daraus entstehen. Ankerlose Items (row-N) sind nie Duplikate.
//
// WP-SHIP8-FIX (bens F4, VERSIONSBEWUSST): bei einer Kollision entscheiden ZWEI GETRENNTE Fragen:
//  (1) INHALT (Titel/Text/Version/sourceNewer …): es gewinnt der Eintrag mit der HÖCHSTEN gültigen
//      sourceVersion — vorher konnte eine restriktive ALTE Fassung die neue inhaltlich verdrängen.
//      Gleiche Version → der ERSTE Eintrag (deterministisch, reihenfolgeunabhängig pro Version).
//  (2) VERTRAULICHKEIT: SEPARAT als die RESTRIKTIVSTE über ALLE Kollisionen gemergt (Union —
//      fail-safe bleibt fail-safe: eine unklare/vertrauliche Variante macht auch den neuen Inhalt
//      vertraulich, die Cloud sieht den Batch dann nie). Ein fehlendes/ungültiges Signal des
//      GEWINNERS bleibt fehlend (downstream fail-safe), wird aber nie durch die Union GESENKT.
export function dedupeSelectedItems(items: readonly ImportItem[]): ImportItem[] {
  const byId = new Map<string, { content: ImportItem; maxRestriction: number }>();
  const order: string[] = [];
  items.forEach((item, index) => {
    const id = candidateIdOf(item, index);
    const existing = byId.get(id);
    if (existing === undefined) {
      byId.set(id, { content: item, maxRestriction: restrictionRank(item) });
      order.push(id);
      return;
    }
    existing.maxRestriction = Math.max(existing.maxRestriction, restrictionRank(item));
    if (contentVersion(item) > contentVersion(existing.content)) {
      existing.content = item;
    }
  });
  return order.map((id) => {
    const entry = byId.get(id) as { content: ImportItem; maxRestriction: number };
    if (entry.maxRestriction <= restrictionRank(entry.content)) {
      return entry.content;
    }
    // Eine Kollision war restriktiver als der inhaltliche Gewinner → Stufe explizit anheben
    // (fail-safe Fallback „vertraulich", falls der Rang keiner bekannten Stufe entspricht).
    return {
      ...entry.content,
      confidentiality: CONFIDENTIALITY_LEVELS[entry.maxRestriction] ?? "vertraulich",
    };
  });
}

// Ungefähre UTF-8-Bytes des Modell-Prompts dieser Kandidaten — spiegelt das Zeilenformat des
// Providers (`id | titel | text` + Zeilenumbruch). EINE Messgröße für Kappung UND Routen-Deckel.
export function groupPromptUtf8Bytes(candidates: readonly GroupingCandidate[]): number {
  const encoder = new TextEncoder();
  let bytes = 0;
  for (const c of candidates) {
    bytes += encoder.encode(`${c.id} | ${c.title}${c.text ? ` | ${c.text}` : ""}`).length + 1;
  }
  return bytes;
}

// Kandidatenliste → sparsame, KANONISIERTE Modell-Eingaben. Das Thema je Kandidat kommt aus den
// IC-1-Quellen: erstes echtes Label, sonst die deterministische Titel-Ableitung (deriveTitleThemes)
// der label-losen Items — dieselbe Kanonisierung wie Erkundung/Suche (canonicalImportText).
// WP-SHIP7-FIX (GELB): Titel hart auf GROUP_TITLE_MAX_INPUT_CHARS gekappt; liegt der Gesamtprompt
// über GROUP_PROMPT_MAX_UTF8_BYTES, werden die Kurztexte STUFENWEISE gekürzt (240 → 120 → 60 → weg),
// zuletzt zusätzlich die Titel auf 80 Zeichen — deterministisch, ehrlich, ohne den Flow zu brechen.
export function groupingCandidates(items: readonly ImportItem[]): GroupingCandidate[] {
  const untagged = items.filter(
    (it) =>
      (it.tags ?? []).map((tag) => canonicalImportText(it, tag).trim()).filter((t) => t.length > 0)
        .length === 0,
  );
  const derived = new Map<ImportItem, string | null>();
  const labels = deriveTitleThemes(untagged.map((it) => canonicalImportText(it, it.title)));
  untagged.forEach((it, i) => {
    derived.set(it, labels[i] ?? null);
  });
  const base = items.map((item, index) => {
    const firstTag = (item.tags ?? [])
      .map((tag) => canonicalImportText(item, tag).trim())
      .find((tag) => tag.length > 0);
    return {
      id: candidateIdOf(item, index),
      title: canonicalImportText(item, item.title).trim().slice(0, GROUP_TITLE_MAX_INPUT_CHARS),
      text: canonicalImportText(item, item.statement).trim().slice(0, GROUP_TEXT_MAX_CHARS),
      theme: firstTag ?? derived.get(item) ?? null,
    };
  });
  const shaped = (textCap: number, titleCap: number): GroupingCandidate[] =>
    base.map(({ id, title, text, theme }) => {
      const cappedText = text.slice(0, textCap);
      return {
        id,
        title: title.slice(0, titleCap),
        ...(cappedText.length > 0 ? { text: cappedText } : {}),
        theme,
      };
    });
  // Stufenweise Kappung bis unter das Prompt-Budget; die letzte Stufe (Titel 80, keine Texte) wird
  // IMMER zurückgegeben — ob auch sie noch zu groß ist (pathologische Ids), entscheidet die Route.
  for (const [textCap, titleCap] of [
    [GROUP_TEXT_MAX_CHARS, GROUP_TITLE_MAX_INPUT_CHARS],
    [120, GROUP_TITLE_MAX_INPUT_CHARS],
    [60, GROUP_TITLE_MAX_INPUT_CHARS],
    [0, GROUP_TITLE_MAX_INPUT_CHARS],
  ] as const) {
    const shapedCandidates = shaped(textCap, titleCap);
    if (groupPromptUtf8Bytes(shapedCandidates) <= GROUP_PROMPT_MAX_UTF8_BYTES) {
      return shapedCandidates;
    }
  }
  return shaped(0, 80);
}

// Rein deterministische Qualitätshinweise je Kandidat — KEIN Modell nötig, nüchterne Fakten:
// (a) bereits importiert (IC-6a-Wissen des Aufrufers), (b) Quelle älter als STALE_AFTER_DAYS,
// (c) kanonisierter Text unter MIN_CONTENT_CHARS. Die UI beschriftet DE/EN/NL.
export function candidateHints(
  item: ImportItem,
  alreadyImported: boolean,
  nowMs: number,
): CandidateHint[] {
  const hints: CandidateHint[] = [];
  if (alreadyImported) {
    hints.push("already-imported");
  }
  const updated = item.updatedAt ? Date.parse(item.updatedAt) : Number.NaN;
  if (Number.isFinite(updated) && nowMs - updated > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000) {
    hints.push("stale");
  }
  if (canonicalImportText(item, item.statement).trim().length < MIN_CONTENT_CHARS) {
    hints.push("short");
  }
  return hints;
}
