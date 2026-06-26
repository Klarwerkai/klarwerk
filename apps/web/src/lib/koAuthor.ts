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
