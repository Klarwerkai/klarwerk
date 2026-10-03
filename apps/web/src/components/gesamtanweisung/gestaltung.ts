// ==================================================================================================
// FE-001 · DIE GESTALT DER ARBEITSANLEITUNGEN — EINE STELLE FÜR KARTE, KNOPF, FELD UND HINWEIS.
// ==================================================================================================
//
// Bis FE-001 standen Übersicht und Detail als ungestaltete Textzeilen oben links (Live-Befund des
// Beraters, 26.09.2026): Überschrift, Metadaten, Link, Feld und Aktion waren optisch kaum zu
// unterscheiden. Die Klassen hier sind KEIN eigenes Designsystem, sondern die Bausteine, die die
// Hauptseiten schon tragen (`pages/MeineEntwuerfe.tsx`, `components/WissensbeziehungenBereich.tsx`:
// `rounded-card`, `rounded-btn`, `rounded-input`, `border-hairline`, `bg-ink`, `text-muted`).
//
// EINE STELLE, weil sechs Bauteile dieselbe Frage beantworten („wie sieht eine Hauptaktion aus?") —
// sechsmal abgeschrieben liefen sie beim nächsten Umbau auseinander.
//
// FOKUS: der sichtbare Fokusring kommt aus dem Haus (`index.css`, `*:focus-visible`). Hier wird er
// nirgends abgeschaltet; `outline-none` steht deshalb an keinem bedienbaren Element.

/** Eine abgegrenzte Gruppe der Seite (Erstellen, Bestand, Abschnitte, Vergleich, Vorlegen). */
export const KARTE = "rounded-card border border-hairline bg-surface p-4 sm:p-5 space-y-3";

/** Überschrift einer Karte. */
export const KARTEN_TITEL = "text-[15px] font-semibold text-ink";

/** Erklärender Satz unter einer Überschrift oder an einem Feld. */
export const HINWEIS = "text-[12.5px] leading-relaxed text-muted";

/** Die Hauptaktion einer Gruppe — gefüllt, genau eine je Gruppe. */
export const KNOPF_HAUPT =
  "inline-flex min-h-9 items-center justify-center rounded-btn bg-ink px-3.5 py-2 text-[13px] font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45";

/** Eine Nebenaktion — umrandet, leiser als die Hauptaktion. */
export const KNOPF_NEBEN =
  "inline-flex min-h-8 items-center justify-center rounded-btn border border-hairline bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-45";

/** Beschriftung eines Feldes. */
export const FELD_LABEL = "block text-[12.5px] font-semibold text-text";

/** Einzeiliges Eingabefeld. */
export const FELD =
  "mt-1 h-9 w-full rounded-input border border-hairline bg-surface px-3 text-[13px] text-text focus:border-ink/30";

/** Mehrzeiliges Eingabefeld. */
export const FELD_MEHRZEILIG =
  "mt-1 w-full rounded-input border border-hairline bg-surface px-3 py-2 text-[13px] leading-relaxed text-text focus:border-ink/30";

/** Statuskennzeichen (Entwurf, Vorgelegt …) — immer mit Wort, nie nur Farbe. */
export const CHIP =
  "inline-flex items-center rounded-pill border border-hairline bg-page px-2 py-0.5 text-[11.5px] font-semibold text-text";

/** Ein Fehler: etwas ist NICHT geschehen. Immer als Satz, nie nur als Farbe. */
export const MELDUNG_FEHLER =
  "rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] leading-relaxed text-trust-crit-text";

/** Ein Hinweis, der den nächsten Schritt nennt (Sperrgrund, fehlende Anbindung). */
export const MELDUNG_HINWEIS =
  "rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] leading-relaxed text-trust-warn-text";

/** Eine Bestätigung (gespeichert, aufgenommen). */
export const BESTAETIGUNG = "text-[12.5px] font-semibold text-text";
