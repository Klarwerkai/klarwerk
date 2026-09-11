// ================================================================================================
// JOB 3576 · DIE NEUN WORTE DER ORTSZEILE — AN GENAU EINER STELLE.
// ================================================================================================
//
// WAS ES VORHER GAB. Dieselben neun Beschriftungen standen DREIMAL im Testbaum, jedes Mal von Hand
// abgeschrieben (gemessen am Basisstand `33510d5`):
//
//     tests/bibliothek-scope-sprache/ortszeile-390px-browser.test.ts:17-19   alle neun
//     tests/bibliothek-scope-sprache/ortszeile-sprache-mounted.test.tsx:17-21 alle neun
//     tests/design/h4-funktionsinventar.test.ts:246                          das deutsche Paar
//
// Wer eine Beschriftung ändert, muss drei Orte nachziehen. Vergisst er einen, faellt es nicht
// einmal auf — die dritte Stelle setzte nie eine Sprache und war gruen, weil Deutsch die Vorgabe
// des Produkts ist (`lib/sprachwahl.ts:26`, `STANDARD_SPRACHE`). Genau das war Codex' zweite
// Prueflücke zu JOB 3489 (`archiv/3489/runde-1/ben.md:29`).
//
// SIE WIRD NICHT AUS `i18n` ABGELEITET, und das ist der Kern. Ein Sollwert, der aus derselben
// Laufzeitquelle kommt wie der Istwert, vergleicht die Quelle mit sich selbst und ist immer gruen —
// auch dann, wenn alle drei englischen Werte wieder auf Deutsch zurueckfallen. Dieselbe Begruendung
// hat JOB 3565 fuer `GEFUEHRTE_SPRACHEN` festgehalten
// (`tests/bibliothek-scope-sprache/ortszeile-sprache-mounted.test.tsx:23-25`). Die Werte hier sind
// deshalb HART und aus dem Bestand abgeschrieben — einmal, sichtbar, an dieser Stelle:
// `apps/web/src/i18n.ts:3696-3698` (de), `:8961-8963` (en), `:13846-13848` (nl).
//
// SIE HAT KEINE ABHAENGIGKEIT AUSSER TYPESCRIPT-TYPEN. Kein Playwright, kein `buildApp`, kein
// `i18n`. Der Grund ist gemessen und nicht vorsichtshalber: `ortszeile-sprache-mounted.test.tsx`
// laeuft in `jsdom` und `ortszeile-390px-browser.test.ts` in der seriellen Browser-Gruppe
// (`tests/tor-inventar/browser-gruppe.ts` berechnet sie aus der Importhuelle). Haette diese Datei
// eine Server- oder Browserbindung, zoege die gemountete Datei sie sich ueber den Umweg einer
// Wortliste ein — und wechselte damit die Gruppe.
//
// KEINE ZWEITE WORTQUELLE. Vor dem Anlegen wurde `tests/support/**` durchgesehen: dort liegen
// `repoPfad.ts` (Pfade), `demoZugang.ts` (Zugangsdaten) und `i18nBestand.ts` — Letzterer holt den
// Sprachbestand ABSICHTLICH aus der Laufzeit (`i18n.getResourceBundle`) und ist damit das genaue
// Gegenteil dessen, was hier gebraucht wird: er sagt, was die Oberflaeche hat, nicht, was sie haben
// SOLL. Beide Dateien nebeneinander sind kein Doppel, sondern die zwei Seiten derselben Aussage.
//
// WER SIE BENUTZT (`tests/bibliothek-scope-sprache/ortszeile-sprache-mounted.test.tsx`, Fall 10,
// haelt es fest): die drei Dateien oben und `tests/design/h4-harness.ts`. In keiner von ihnen darf
// eines der neun Worte noch als Literal stehen.

/** Die drei Beschriftungen der Ortszeile in EINER Sprache. */
export interface OrtszeileWorte {
  /** Der zugaengliche Gruppenname des `fieldset` — Schluessel `lib.ownScope.label`. */
  readonly label: string;
  /** Die Schaltflaeche des eigenen Bestands — Schluessel `lib.ownScope.meine`. */
  readonly meine: string;
  /** Die Schaltflaeche des gesamten sichtbaren Bestands — Schluessel `lib.ownScope.alle`. */
  readonly alle: string;
}

/** Die neun Worte, nach Sprachkuerzel. Aendert sich eine Beschriftung, aendert sie sich HIER. */
export const ORTSZEILE_WORTE = {
  de: { label: "Geltungsbereich", meine: "Meine Ablage", alle: "Alle Inhalte" },
  en: { label: "Scope", meine: "My collection", alle: "All content" },
  nl: { label: "Bereik", meine: "Mijn verzameling", alle: "Alle inhoud" },
} as const satisfies Record<string, OrtszeileWorte>;

/** Die Sprachkuerzel, die diese Quelle fuehrt — `de` | `en` | `nl`. */
export type OrtszeileSprache = keyof typeof ORTSZEILE_WORTE;
