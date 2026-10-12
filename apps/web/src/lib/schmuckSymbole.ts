// ================================================================================================
// WCAG 1.1.1 / 4.1.2 — SCHMUCK-SYMBOLE SIND FÜR HILFSTECHNIK UNSICHTBAR, AN EINER STELLE.
// ================================================================================================
//
// BEFUND (Audit nacharbeit-8, `tests-smoke/wcag21-aa-audit.spec.ts`): Auf /hilfe, /import, /extern
// und im Wissensdetail führte Chromium Dutzende Symbole als „Bild ohne Namen". Es sind
// Lucide-Symbole neben einer Beschriftung — reiner Schmuck. `lucide-react` 0.453 setzt dafür kein
// `aria-hidden`; jede Verwendungsstelle hätte es selbst tragen müssen, und neue Stellen hätten es
// wieder vergessen (nacharbeit-3/-4 haben genau so einzelne Stellen nachgezogen).
//
// DIE EINE REGEL: Ein Lucide-Symbol (`svg.lucide`), das weder einen Namen (`aria-label`,
// `aria-labelledby`) noch eine Rolle trägt, ist Schmuck und bekommt `aria-hidden="true"`. Ein
// Symbol, das etwas BEDEUTET, trägt ohnehin `role="img"` mit Namen (z. B. das Schloss in
// pages/Validation.tsx) und bleibt unberührt. Ein namenloses Symbol sagt Hilfstechnik nichts —
// es zu verbergen nimmt keinem Element einen Namen.
//
// WARUM EIN BEOBACHTER: Die Oberfläche baut Symbole laufend neu auf (Menüs, Listen, Routen). Der
// Beobachter markiert jedes neu eingefügte Symbol, bevor ein Vorlesewerkzeug es erreicht. React
// verwaltet `aria-hidden` an diesen Stellen nicht und überschreibt die Markierung deshalb nicht.

const SCHMUCK =
  "svg.lucide:not([aria-hidden]):not([aria-label]):not([aria-labelledby]):not([role])";

/** Markiert alle Schmuck-Symbole unterhalb von `wurzel` (die Wurzel eingeschlossen). */
export function markiereSchmuckSymbole(wurzel: Element): void {
  if (wurzel.matches(SCHMUCK)) {
    wurzel.setAttribute("aria-hidden", "true");
  }
  for (const symbol of wurzel.querySelectorAll(SCHMUCK)) {
    symbol.setAttribute("aria-hidden", "true");
  }
}

/** Markiert sofort und danach jedes neu eingefügte Symbol. Gibt das Abmelden zurück. */
export function bindeSchmuckSymbole(wurzel: Element): () => void {
  markiereSchmuckSymbole(wurzel);
  const beobachter = new MutationObserver((eintraege) => {
    for (const eintrag of eintraege) {
      for (const knoten of eintrag.addedNodes) {
        if (knoten instanceof Element) {
          markiereSchmuckSymbole(knoten);
        }
      }
    }
  });
  beobachter.observe(wurzel, { childList: true, subtree: true });
  return () => beobachter.disconnect();
}
