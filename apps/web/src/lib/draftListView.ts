// AUFTRAG-sortfilter · Punkt 2: ehrliche Filterung + Sortierung der Entwurfsliste („Entwürfe
// fortsetzen"). Rein, DOM-frei, testbar. Kein neuer Egress — arbeitet nur auf den bereits geladenen
// Entwürfen (gemeinsamer Pool). Die Suche ist eine Volltext-/Titelsuche (Titel + Aussage + Fließtext),
// der Ersteller-Filter greift nur in der Admin-Ansicht („ALLE ENTWÜRFE"). Leerer Filter = alle.
import type { Draft } from "../api/types";
import { draftTitle } from "./draftForm";
import { htmlToPlainText } from "./richText";

export const DRAFT_SORT_KEYS = ["recent", "oldest", "title"] as const;
export type DraftSortKey = (typeof DRAFT_SORT_KEYS)[number];

// Default = zuletzt gespeichert (neu→alt): frisch bearbeitete Entwürfe stehen oben.
export const DEFAULT_DRAFT_SORT: DraftSortKey = "recent";

export const DRAFT_SORT_STORAGE_KEY = "klarwerk.capture.drafts.sort";
export const DRAFT_QUERY_STORAGE_KEY = "klarwerk.capture.drafts.query";
export const DRAFT_AUTHOR_STORAGE_KEY = "klarwerk.capture.drafts.author";

export const DRAFT_SORT_LABEL_KEYS: Record<DraftSortKey, string> = {
  recent: "capture.draftSort.recent",
  oldest: "capture.draftSort.oldest",
  title: "capture.draftSort.title",
};

export function isDraftSortKey(value: unknown): value is DraftSortKey {
  return typeof value === "string" && (DRAFT_SORT_KEYS as readonly string[]).includes(value);
}

// „Zuletzt gespeichert" (ms): updatedAt, sonst createdAt. Unbekannt/kaputt → 0 (sinkt ans Ende).
export function draftSavedMs(draft: Draft): number {
  const ms = Date.parse(draft.updatedAt || draft.createdAt || "");
  return Number.isFinite(ms) ? ms : 0;
}

// Durchsuchbarer Volltext eines Entwurfs: Titel + Aussage + Fließtext (bodyHtml) als Klartext.
// Rein String-basiert (kein DOM).
//
// AUFTRAG-mega85 Block A (bens ROT-Punkt 1 zu mega84): hier stand `replace(/<[^>]*>/g, " ")` —
// JEDES Tag wurde zu einem Leerzeichen. Bei tag-freien Entwürfen folgenlos, bei ausgezeichneten
// nicht: aus „<em>Ventil V2</em>," wurde „Ventil V2 ,", und eine Suche nach „Ventil V2, sichtbar"
// fand den formatierten Entwurf nicht mehr. Seit mega84 trägt die Bild-Fußnote Auszeichnung, also
// trifft das echte Inhalte. Es ist DIESELBE Klasse, die mega84 an drei Lesern geschlossen hat
// (librarySearch, captions, bodyImages) — dies war die vierte, unentdeckte Suchfläche.
//
// Korrigiert wird sie NICHT mit einer vierten Kopie der Regel, sondern über die kanonische
// Reduktion `htmlToPlainText` (richText.ts, Server-Zwilling in services/structure): Block-ENDEN
// werden zum Leerzeichen — ein Absatzwechsel IST eine Wortgrenze, „Ende“/„Anfang“ dürfen nicht zu
// „EndeAnfang“ verwachsen —, Inline-Auszeichnung verschwindet spurlos, Entities werden dekodiert.
//
// ── DER SUCHVERTRAG (AUFTRAG-mega86 Block A, nach bens ROT aus sammel84) ───────────────────────
//
// mega85 hat hier zugesagt: „jede Anfrage, die vorher traf, trifft weiterhin". Diese Zusage ist
// FALSCH, und ben hat sie mit vier Anfragen widerlegt — nachgerechnet und bestätigt, nicht
// geglaubt. `htmlToPlainText` dekodiert Entities und normalisiert `\s+` zu EINEM Leerzeichen; die
// alte Fassung tat beides nicht. Was hier gilt, ist enger:
//
//   SICHTBARER KLARTEXT BLEIBT SUCHBAR. Jede Wortfolge, die ein Mensch im Entwurf lesen kann, wird
//   weiterhin gefunden — Wortgrenzen (Absatz, Listenpunkt, Zeilenumbruch, entfernte Auszeichnung)
//   gelten dabei als GENAU EIN Leerzeichen. Nicht mehr gefunden werden vier Klassen technischer
//   Altanfragen, und zwar bewusst:
//     (1) gegen HTML-Entitätsschreibweisen — „&amp;" statt „&",
//     (2) gegen mehrfachen Whitespace — „a  b" statt „a b",
//     (3) gegen einen Zeilenumbruch als Zeichen — „dichtring\nventil",
//     (4) gegen die Leerzeichen-Artefakte der alten Reduktion — „V2 ," statt „V2,".
//   Keine dieser vier war je sichtbarer Text. Sie zu verlieren ist der ZWECK dieser Änderung, nicht
//   ihr Preis — Artefakt (4) ist genau der Fehler, gegen den mega84 und mega85 angetreten sind.
//
// Die vier Klassen stehen einzeln als ausdrücklich ausgenommen im Test, jede mit bens Beispiel
// (`tests/capture/mega85-suchtext-formatierung.test.ts`, Stufe 4). Der bleibende Teil wird dort
// über eine feste, genannte Zahl von Anfragen gefahren — nicht über eine Untergrenze.
function draftSearchText(draft: Draft, titleFallback: string): string {
  const payload = draft.payload;
  const parts = [
    draftTitle(draft, titleFallback),
    payload.title ?? "",
    payload.statement ?? "",
    htmlToPlainText(payload.bodyHtml ?? ""),
  ];
  return parts.join(" ").toLowerCase();
}

export interface DraftListFilter {
  // Volltext-/Titelsuche (leer = alle).
  query: string;
  // Ersteller-Id (leer = alle) — nur in der Admin-Ansicht befüllt.
  author: string;
}

// Filtert die Entwürfe nach Volltext-Suche UND (optional) Ersteller. Beide leer = unveränderte Liste.
export function filterDrafts(
  drafts: readonly Draft[],
  filter: DraftListFilter,
  titleFallback: string,
): Draft[] {
  const query = filter.query.trim().toLowerCase();
  const author = filter.author.trim();
  return drafts.filter((draft) => {
    if (author && draft.originalAuthor !== author) {
      return false;
    }
    if (query && !draftSearchText(draft, titleFallback).includes(query)) {
      return false;
    }
    return true;
  });
}

// Stabile Sortierung; der Original-Index ist der letzte Tie-Breaker (kein Wackeln bei Gleichstand).
export function sortDrafts(
  drafts: readonly Draft[],
  key: DraftSortKey,
  titleFallback: string,
): Draft[] {
  const primary = (a: Draft, b: Draft): number => {
    switch (key) {
      case "recent":
        return draftSavedMs(b) - draftSavedMs(a);
      case "oldest":
        return draftSavedMs(a) - draftSavedMs(b);
      case "title":
        return draftTitle(a, titleFallback).localeCompare(draftTitle(b, titleFallback));
      default:
        return 0;
    }
  };
  return drafts
    .map((draft, index) => ({ draft, index }))
    .sort((a, b) => primary(a.draft, b.draft) || a.index - b.index)
    .map((entry) => entry.draft);
}

// Filtern + Sortieren in einem Schritt (die Sicht der Entwurfsliste).
export function draftListView(
  drafts: readonly Draft[],
  opts: { filter: DraftListFilter; sort: DraftSortKey },
  titleFallback: string,
): Draft[] {
  return sortDrafts(filterDrafts(drafts, opts.filter, titleFallback), opts.sort, titleFallback);
}

// Ersteller-Auswahl für den Admin-Filter: eindeutige Ersteller-Ids in stabiler Erst-Vorkommen-Ordnung.
// Die Namen löst die Oberfläche über das Directory auf (Fallback = Id, nie ein erfundener Name).
export function draftCreatorIds(drafts: readonly Draft[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const draft of drafts) {
    const id = draft.originalAuthor;
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
