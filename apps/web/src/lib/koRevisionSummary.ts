// SCRUM-325: DOM-freier Änderungsüberblick für die KO-Revision. Vergleicht das Original-KO mit dem
// aktuellen Edit-State und liefert einfache STRUKTUR-/Feld-Änderungssignale — KEIN Text-Diff, KEINE
// fachliche Wahrheitsbewertung, kein Backend, keine Auto-Validierung. Robust gegen null/undefined.
//
// Vergleichsregeln:
//  - Texte (title/statement/category) werden getrimmt verglichen (nur echte Änderungen zählen).
//  - bodyHtml wird getrimmt verglichen (kein HTML-Diff; insignifikante Whitespace-Ränder ignoriert).
//  - conditions/measures sind SCHRITT-/Reihenfolge-relevant → geordneter Vergleich (nach trim + Drop
//    leerer Einträge). Eine Umsortierung gilt bewusst als Änderung.
//  - tags sind eine MENGE (Reihenfolge irrelevant) → Vergleich als sortierte, getrimmte Menge.

export type KoRevisionItemId =
  | "title"
  | "statement"
  | "body"
  | "conditions"
  | "measures"
  | "tags"
  | "category"
  | "type";

// Anzeigereihenfolge der geänderten Bereiche.
const FIELD_ORDER: readonly KoRevisionItemId[] = [
  "title",
  "statement",
  "body",
  "conditions",
  "measures",
  "tags",
  "category",
  "type",
];

export interface KoRevisionItem {
  id: KoRevisionItemId;
  labelKey: string;
}

export interface KoRevisionFields {
  title?: string | null;
  statement?: string | null;
  bodyHtml?: string | null;
  type?: string | null;
  category?: string | null;
  conditions?: readonly string[] | null;
  measures?: readonly string[] | null;
  tags?: readonly string[] | null;
}

export interface KoRevisionSummary {
  hasChanges: boolean;
  changedCount: number;
  titleChanged: boolean;
  statementChanged: boolean;
  bodyChanged: boolean;
  conditionsChanged: boolean;
  measuresChanged: boolean;
  tagsChanged: boolean;
  categoryChanged: boolean;
  typeChanged: boolean;
  items: KoRevisionItem[];
}

function normText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normList(values: readonly string[] | null | undefined): string[] {
  return (values ?? []).map((v) => (v ?? "").trim()).filter((v) => v.length > 0);
}

function orderedListChanged(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  const na = normList(a);
  const nb = normList(b);
  if (na.length !== nb.length) {
    return true;
  }
  return na.some((v, i) => v !== nb[i]);
}

function setChanged(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  const na = [...normList(a)].sort();
  const nb = [...normList(b)].sort();
  if (na.length !== nb.length) {
    return true;
  }
  return na.some((v, i) => v !== nb[i]);
}

export function koRevisionItemLabelKey(id: KoRevisionItemId): string {
  return `ko.revision.field.${id}`;
}

export function koRevisionSummary(
  original: KoRevisionFields | null | undefined,
  edit: KoRevisionFields | null | undefined,
): KoRevisionSummary {
  const o = original ?? {};
  const e = edit ?? {};

  const titleChanged = normText(o.title) !== normText(e.title);
  const statementChanged = normText(o.statement) !== normText(e.statement);
  const bodyChanged = normText(o.bodyHtml) !== normText(e.bodyHtml);
  const conditionsChanged = orderedListChanged(o.conditions, e.conditions);
  const measuresChanged = orderedListChanged(o.measures, e.measures);
  const tagsChanged = setChanged(o.tags, e.tags);
  const categoryChanged = normText(o.category) !== normText(e.category);
  const typeChanged = normText(o.type) !== normText(e.type);

  const changedById: Record<KoRevisionItemId, boolean> = {
    title: titleChanged,
    statement: statementChanged,
    body: bodyChanged,
    conditions: conditionsChanged,
    measures: measuresChanged,
    tags: tagsChanged,
    category: categoryChanged,
    type: typeChanged,
  };

  const items: KoRevisionItem[] = FIELD_ORDER.filter((id) => changedById[id]).map((id) => ({
    id,
    labelKey: koRevisionItemLabelKey(id),
  }));

  return {
    hasChanges: items.length > 0,
    changedCount: items.length,
    titleChanged,
    statementChanged,
    bodyChanged,
    conditionsChanged,
    measuresChanged,
    tagsChanged,
    categoryChanged,
    typeChanged,
    items,
  };
}
