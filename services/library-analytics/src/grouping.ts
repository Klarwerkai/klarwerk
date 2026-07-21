// WP-IC-4 (Schritt 4 des abgenommenen Cockpit-Flows): pure Zulieferung für die KI-Gruppierung.
// Baut aus der eingegrenzten Kandidatenliste die SPARSAME Modell-Eingabe (id, kanonisierter Titel,
// kurzer kanonisierter Text, IC-1-Thema — NIE volle Bodies) und die rein DETERMINISTISCHEN
// Qualitätshinweise je Kandidat. Kennt bewusst KEIN Reasoner-Symbol (das Modul bleibt unterhalb;
// die App-Route reicht die strukturell kompatiblen Eingaben an den Reasoner weiter).
import { canonicalImportText } from "./text-codec";
import { deriveTitleThemes } from "./themes";
import type { ImportItem } from "./types";

// Sparsamkeits-Deckel des Kurztexts je Kandidat (Modell-Eingabe, nie volle Bodies zur Cloud).
export const GROUP_TEXT_MAX_CHARS = 240;

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

// Kandidatenliste → sparsame, KANONISIERTE Modell-Eingaben. Das Thema je Kandidat kommt aus den
// IC-1-Quellen: erstes echtes Label, sonst die deterministische Titel-Ableitung (deriveTitleThemes)
// der label-losen Items — dieselbe Kanonisierung wie Erkundung/Suche (canonicalImportText).
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
  return items.map((item, index) => {
    const firstTag = (item.tags ?? [])
      .map((tag) => canonicalImportText(item, tag).trim())
      .find((tag) => tag.length > 0);
    const text = canonicalImportText(item, item.statement).trim().slice(0, GROUP_TEXT_MAX_CHARS);
    return {
      id: candidateIdOf(item, index),
      title: canonicalImportText(item, item.title),
      ...(text.length > 0 ? { text } : {}),
      theme: firstTag ?? derived.get(item) ?? null,
    };
  });
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
