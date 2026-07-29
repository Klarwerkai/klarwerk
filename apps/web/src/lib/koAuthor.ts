// SCRUM-70 / FR-LIF-04: Vermächtnis-Framing — der Autor ist überall am KO sichtbar.
// Reiner, DOM-freier Helfer: löst Autor (+ Originalautor bei Transfer) zu Anzeigenamen
// auf. Keine neue Backend-Logik, keine Transfer-Logik — nur Darstellung.
export type NameResolver = (id: string) => string;

export interface KoAuthorRef {
  author: string;
  originalAuthor?: string;
}

export interface KoAuthorParts {
  author: string;
  // Nur gesetzt, wenn der Ursprungsautor vom aktuellen Autor abweicht (Transfer).
  originalAuthor?: string;
}

// ================================================================================================
// AUFTRAG-mega51 BLOCK F2 — EINE UUID IST KEIN NAME.
// ================================================================================================
// Fehlt der Verzeichniseintrag zu einer Autoren-Kennung, stand bisher die ROHE Kennung in der
// Oberfläche: `dir.data?.find(...)?.name || uid`. In der Bibliothek traf das die Autorenzeile jeder
// Trefferzeile UND die Autoren-Facette in der Filterschiene. Dieselbe Zeile stand an sechs Stellen
// im Produktbaum (Bibliothek, KO-Detail, Aufgaben, Fragen, Risiko, Validierung) — deshalb steht die
// Antwort jetzt EINMAL hier und nicht sechsmal dort.
//
// WARUM NICHT NUR „Unbekannte Person": zwei verschiedene Kennungen ohne Verzeichniseintrag sähen
// dann wie EINE Person aus — in der Autoren-Facette würden aus zwei Einträgen zwei identische
// Zeilen. Das wäre eine neue Unwahrheit an der Stelle, an der wir gerade eine beseitigen. Deshalb
// trägt die ehrliche Auskunft ein kurzes, stabiles Unterscheidungsmerkmal — nicht die ganze
// Kennung, aber genug, um zwei Unbekannte auseinanderzuhalten.
export const AUTHOR_UNKNOWN_KEY = "ko.authorUnknown";

export function authorShortRef(uid: string): string {
  return uid
    .replace(/[^0-9a-zA-Z]/g, "")
    .slice(0, 6)
    .toLowerCase();
}

// `unknown` liefert die ÜBERSETZTE Auskunft (i18n bleibt aus diesem DOM-freien Modul draußen).
export function authorDisplayName(
  uid: string,
  name: string | null | undefined,
  unknown: (ref: string) => string,
): string {
  const gepflegt = (name ?? "").trim();
  return gepflegt.length > 0 ? gepflegt : unknown(authorShortRef(uid));
}

// Liefert die anzuzeigenden Autorennamen. `nameOf` löst IDs auf; fehlt der Name
// (oder kein Resolver), wird auf die ID zurückgefallen.
export function koAuthorParts(ko: KoAuthorRef, nameOf?: NameResolver): KoAuthorParts {
  const resolve: NameResolver = nameOf ?? ((id) => id);
  const author = resolve(ko.author);
  const hasOriginal = !!ko.originalAuthor && ko.originalAuthor !== ko.author;
  return hasOriginal
    ? { author, originalAuthor: resolve(ko.originalAuthor as string) }
    : { author };
}
