// AUFTRAG-mega48 Block A — EINE Wahrheit darüber, was in einer modalen Fläche erreichbar ist.
//
// Bis mega47 stand derselbe Selektor samt Filterregel zweimal wörtlich im Baum (FacetFilter,
// MobileNavDrawer); die Fokus-Rückgabe der Modalgrenze braucht ihn ein drittes Mal. Drei Kopien
// heißt: eine weicht irgendwann auf, und zwar still. Deshalb steht er hier einmal.
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Kein offsetParent-Sichtbarkeitsfilter: jsdom rechnet kein Layout (offsetParent ist dort immer
// null). `hidden`/`aria-hidden` fliegen raus; im echten Browser sichert zusätzlich die
// Inert-Schaltung der Modalgrenze, dass nur Elemente der obersten Fläche erreichbar sind.
export function focusablesIn(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) {
    return [];
  }
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hasAttribute("hidden") && el.closest("[hidden],[aria-hidden='true']") === null,
  );
}

// Fokus in eine Fläche setzen: erstes bedienbares Element, ersatzweise das Panel selbst (es trägt
// dafür `tabIndex={-1}`).
export function focusFirstIn(panel: HTMLElement | null): void {
  (focusablesIn(panel)[0] ?? panel)?.focus();
}
