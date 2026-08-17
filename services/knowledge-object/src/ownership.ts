// ================================================================================================
// JOB 557 — WEM GEHÖRT EIN WISSENSOBJEKT? (Pedis Entscheidung vom 13.08.2026)
// ================================================================================================
//
// DIE FRAGE, die dieses Modul beantwortet: „Wissensobjekte haben heute nur ein Feld `author` — den
// Erzeuger. Es fehlt eine kanonische Angabe, wem das Objekt gehört, wer es geprüft und wer es
// validiert hat." Pedis Entscheidung: „Ja, kanonisches Eigentümer-Aggregat bauen." Begründung:
// „`author` als Eigentümer zu verbuchen ist fachlich falsch — der Erzeuger ist nicht der
// Verantwortliche."
//
// DASS `author` PROVENIENZ IST, sagt der Code an anderer Stelle selbst
// (`services/app/src/routes/object-routes.ts`): „Der Hochladende ist für das ungebundene Objekt
// das, was der Autor für ein Wissensobjekt ist: die Person, die es erzeugt hat."
//
// DREI ROLLEN, EIN AGGREGAT. `owner`, `reviewers` und `validators` beantworten dieselbe Frage aus
// drei Richtungen — sie werden GEMEINSAM gelesen, wenn zu entscheiden ist, ob eine Antwort eine
// FREMDE Antwort ist. Drei getrennte Felder am Objekt hätten die Zersplitterung fortgesetzt, die
// dieser Job auflöst, und jedes hätte seinen eigenen Normalisierungsweg gebraucht.
//
// WAS DIESES MODUL NICHT TUT, und das ist eine Grenze, keine Lücke:
//   · KEINE RECHTEVERGABE. Es sagt, WER verantwortlich ist, nicht, WAS diese Person darf. Wer aus
//     `owner` ein Recht ableitet, baut eine zweite Rechtequelle neben `services/rbac` — genau die
//     Sorte Doppelwahrheit, die dieser Job beseitigt.
//   · KEINE PRÜFUNG GEGEN DIE NUTZERVERWALTUNG. Das wäre eine Modulkante zu `auth` für eine
//     Zeichenkette. Ob eine Kennung einen Menschen bezeichnet, entscheidet der Schreibweg.
//   · KEINE KLEINSCHREIBUNG. Es sind Kennungen, keine Anzeigenamen; eine Faltung wäre eine
//     VERGLEICHSregel und gehörte nicht in die Speicherform.
import type { KnowledgeObject, KnowledgeOwnership } from "./types";

/** Eine Kennung ist brauchbar, wenn nach dem Trimmen etwas übrig bleibt. Mehr wird nicht behauptet. */
function kennung(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const getrimmt = value.trim();
  return getrimmt.length > 0 ? getrimmt : null;
}

/**
 * Eine Rollenliste in Normalform: nur brauchbare Kennungen, DEDUPLIZIERT, in der gelieferten
 * Reihenfolge. Die Reihenfolge bleibt, weil sie von einem Menschen stammt (wer zuerst zugewiesen
 * wurde, steht zuerst) — eine Sortierung wäre eine Aussage, die niemand getroffen hat.
 */
function liste(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const aus: string[] = [];
  for (const eintrag of value) {
    const id = kennung(eintrag);
    if (id !== null && !aus.includes(id)) {
      aus.push(id);
    }
  }
  return aus;
}

/**
 * DIE EINE NORMALFORM des Aggregats — jeder Schreibweg läuft durch sie, keiner daneben.
 *
 * `null` HEISST „KEINE ANGABE", und das ist die wichtigste Zusage dieser Funktion: eine leere oder
 * unbrauchbare Eingabe legt KEIN leeres Aggregat ab. Ein `{ reviewers: [], validators: [] }` am
 * Objekt wäre die Behauptung „hierzu ist etwas bekannt, nämlich nichts" — und ununterscheidbar von
 * Altbestand, über den wirklich nichts bekannt ist.
 *
 * UND SIE ERFINDET KEINEN EIGENTÜMER. Es gibt hier bewusst keinen Rückfall auf `author`: ein Objekt
 * ohne benannten Eigentümer bleibt ein Objekt ohne benannten Eigentümer. Wer die Verantwortung
 * braucht, fragt `responsibleOf` — dort steht der Rückfall, benannt und an genau einer Stelle.
 */
export function normalizeOwnership(value: unknown): KnowledgeOwnership | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const roh = value as Record<string, unknown>;
  const owner = kennung(roh.owner);
  const reviewers = liste(roh.reviewers);
  const validators = liste(roh.validators);
  if (owner === null && reviewers.length === 0 && validators.length === 0) {
    return null;
  }
  return {
    ...(owner !== null ? { owner } : {}),
    reviewers,
    validators,
  };
}

/**
 * Das Aggregat, wie es am Objekt steht — oder `null`. Es gibt hier KEINEN Ersatzwert: wer die
 * Wahrheit über die Verantwortung will, bekommt sie oder ein ehrliches „nicht bekannt".
 */
export function ownershipOf(ko: Pick<KnowledgeObject, "ownership">): KnowledgeOwnership | null {
  return normalizeOwnership(ko.ownership);
}

/**
 * DIE EINZIGE STELLE MIT EINEM ERSATZ, und er ist benannt: fehlt der Eigentümer, ist der Autor der
 * Verantwortliche.
 *
 * WARUM ES DEN ERSATZ ÜBERHAUPT GIBT. Für Altbestand ist kein anderer Verantwortlicher bekannt, und
 * „gehört niemandem" ließe die Nacharbeit ERSATZLOS VERFALLEN — Arbeit, die niemand mehr sieht, ist
 * schlimmer als Arbeit bei der zweitbesten Person. Der Ersatz steht deshalb genau hier und
 * NIRGENDS sonst: `ownershipOf` gibt ihn nie zurück, und kein Schreibweg trägt ihn ins Objekt.
 * Damit bleibt am Objekt ablesbar, ob Eigentum BENANNT oder nur ERSETZT ist.
 */
export function responsibleOf(ko: Pick<KnowledgeObject, "author" | "ownership">): string {
  return ownershipOf(ko)?.owner ?? ko.author;
}

/**
 * Woher die Verantwortung kommt — damit ein Beleg sie wahrheitsgemäß benennen kann.
 *
 * Ohne diese Auskunft müsste ein Protokoll raten, ob der eingetragene Name ein benannter Eigentümer
 * oder der ersetzte Autor ist. Genau diese Verwechslung ist der Befund dieses Jobs; ein Beleg, der
 * sie fortschreibt, wäre die teurere Unwahrheit.
 */
export function responsibleKindOf(
  ko: Pick<KnowledgeObject, "author" | "ownership">,
): "owner" | "author-fallback" {
  return ownershipOf(ko)?.owner !== undefined ? "owner" : "author-fallback";
}

/** Zwei Aggregate sind gleich, wenn Eigentümer und beide Folgen zeichengleich übereinstimmen. */
export function sameOwnership(a: KnowledgeOwnership | null, b: KnowledgeOwnership | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  const gleicheFolge = (x: readonly string[], y: readonly string[]): boolean =>
    x.length === y.length && x.every((wert, i) => wert === y[i]);
  return (
    a.owner === b.owner &&
    gleicheFolge(a.reviewers, b.reviewers) &&
    gleicheFolge(a.validators, b.validators)
  );
}

/**
 * DIE FORTSCHREIBUNG — aus einem TATSÄCHLICHEN Ereignis, nicht aus einer Eingabe.
 *
 * `withRole` hängt Kennungen an eine der beiden Rollenfolgen an: idempotent (was schon drinsteht,
 * kommt nicht zweimal) und ohne Reihenfolgeänderung. Gibt es noch kein Aggregat, entsteht eines —
 * aber OHNE `owner`. Das ist die entscheidende Zeile dieses Moduls: dass jemand geprüft hat, sagt
 * nichts darüber, wem das Objekt gehört. Wer hier einen Eigentümer einsetzte, hätte die verworfene
 * Gleichsetzung an einer neuen Stelle wieder eingeführt.
 *
 * `null` als Ergebnis heisst „nichts hinzugekommen und vorher war nichts" — der Aufrufer schreibt
 * dann nicht.
 */
export function withRole(
  current: KnowledgeOwnership | null,
  role: "reviewers" | "validators",
  ids: readonly unknown[],
): KnowledgeOwnership | null {
  const neue = liste(ids);
  if (neue.length === 0) {
    return current;
  }
  const basis: KnowledgeOwnership = current ?? { reviewers: [], validators: [] };
  const zusammen = [...basis[role]];
  for (const id of neue) {
    if (!zusammen.includes(id)) {
      zusammen.push(id);
    }
  }
  return normalizeOwnership({ ...basis, [role]: zusammen });
}
