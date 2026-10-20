/** Nur auf der bereits geöffneten Seite suchen. Keine Aktionen, Datenabrufe oder Rechteänderungen. */
export function echtesZiel(selector: string): HTMLElement | null {
  // Die Definitionen nennen einfache Ersatz-Ziele in Priorität (ohne Komma im Einzelziel).
  for (const kandidat of selector.split(",")) {
    const treffer = Array.from(document.querySelectorAll<HTMLElement>(kandidat.trim())).find(
      (el) =>
        !el.closest(
          '[data-testid="tutorial-bereich"], [data-tutorial-demo], [hidden], [aria-hidden="true"], [inert]',
        ) &&
        !el.matches(':disabled, [aria-disabled="true"]') &&
        el.getClientRects().length > 0,
    );
    if (treffer) return treffer;
  }
  return null;
}
/** Temporäre semantische Markierung für dieselbe Klara-Zielsuche, mit vollständigem Rückbau. */
export function markiereEchtesZiel(el: HTMLElement, name: string): () => void {
  const vorher = ["data-tutorial-ziel", "data-tutorial-aktiv", "tabindex"].map(
    (a) => [a, el.getAttribute(a)] as const,
  );
  el.setAttribute("data-tutorial-ziel", name);
  el.setAttribute("data-tutorial-aktiv", "true");
  if (!el.matches('button, input, textarea, select, a[href], [tabindex], [contenteditable="true"]'))
    el.tabIndex = -1;
  return () => {
    for (const [a, wert] of vorher) {
      if (wert === null) el.removeAttribute(a);
      else el.setAttribute(a, wert);
    }
  };
}
