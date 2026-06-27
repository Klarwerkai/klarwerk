// SCRUM-226: DOM-freie Kompositions-Helfer für die Output Factory. Bringen die vom Nutzer
// gewählte KO-Reihenfolge in eine renderbare Vorschau (Output-Typ, geordnete KO-Liste,
// Provenance-Hinweis). KEIN Editor, KEIN fertiges Dokument — nur eine ehrliche Vorschau der
// Komposition VOR dem Generieren. Die eigentliche Erzeugung bleibt serverseitig (services/output),
// das Backend rendert in genau der koIds-Reihenfolge (FR-EXT-03).
import type { OutputKind, OutputSource } from "../api/types";

// Spiegelt services/output UNCERTAIN_TRUST_BELOW (Anzeige-Schwelle, kein Persistenz-Bezug).
export const UNCERTAIN_TRUST_BELOW = 60;

// Nutzer-Reihenfolge beibehalten, nur unbekannte IDs verwerfen (anders als orderedSelection,
// das in Quellenreihenfolge sortiert). Duplikate werden defensiv entfernt.
export function sanitizeOrder(
  orderedIds: readonly string[],
  sourceIds: readonly string[],
): string[] {
  const known = new Set(sourceIds);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of orderedIds) {
    if (!known.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

// Einen Eintrag um eine Position nach oben (-1) oder unten (+1) schieben. Außerhalb der
// Grenzen bleibt die Liste unverändert (idempotent an den Rändern).
export function moveInOrder(ids: readonly string[], index: number, dir: -1 | 1): string[] {
  const next = [...ids];
  const target = index + dir;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) {
    return next;
  }
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item as string);
  return next;
}

export interface CompositionItem {
  id: string;
  title: string;
  type: string;
  category: string;
  trust: number;
  version: number;
  uncertain: boolean;
}

export interface CompositionPreview {
  kind: OutputKind;
  items: CompositionItem[];
  sourceCount: number;
  uncertainCount: number;
}

// Ehrliche Vorschau der Komposition: Output-Typ + geordnete, validierte KO-Liste mit
// Provenance-Signal (uncertain = Trust < Schwelle). Reine Lesesicht, kein Dokument.
export function buildCompositionPreview(input: {
  kind: OutputKind;
  orderedIds: readonly string[];
  sources: readonly OutputSource[];
}): CompositionPreview {
  const byId = new Map(input.sources.map((s) => [s.id, s]));
  const items: CompositionItem[] = [];
  for (const id of input.orderedIds) {
    const s = byId.get(id);
    if (!s) {
      continue;
    }
    items.push({
      id: s.id,
      title: s.title,
      type: s.type,
      category: s.category,
      trust: s.trust,
      version: s.version,
      uncertain: s.trust < UNCERTAIN_TRUST_BELOW,
    });
  }
  return {
    kind: input.kind,
    items,
    sourceCount: items.length,
    uncertainCount: items.filter((i) => i.uncertain).length,
  };
}
