// ================================================================================================
// R-0918 · DIE SCHRIFTSKALA DER WEB-APP — eine feste Liste statt frei gewählter Pixel.
// ================================================================================================
//
// WOHER DIE WERTE KOMMEN (nicht neu erfunden, R-0906):
//   · die freigegebenen Zielbilder der Web-App (`design/klarwerk/*.dc.html`), deren Sollwerte
//     `tools/design-vergleich/werte.ts` und die Chromium-Messungen `tests/design/zielbild-h*.test.ts`
//     lesen: 11 · 11,5 · 12 · 12,5 · 13 · 13,5 · 14 · 15 · 16 · 20 · 26 px;
//   · das Brand Book (`docs/ci/CI_KURZREFERENZ.md`): „Label 11–13 Mono".
//
// DIE UNTERGRENZE ist 11 px. Über 400 Stellen lagen darunter (9–10,5 px) — für Berater unter
// Zeitdruck zu klein. Zwei Ausnahmen stehen ausdrücklich so in den Zielbildern und bleiben:
//   · `zaehler` 10,5 px — die Zahl-Plakette im Kopfband (Main.dc.html, gemessen in
//     `zielbild-h1-huelle` V10);
//   · `fussnote` 10 px — die hochgestellte Quellenmarke im Antworttext (Fragen.dc.html, gemessen
//     in `zielbild-h5-fragen` V18b).
// Beide sind Ziffern an fester Stelle, keine Lesetexte.
//
// Die Tailwind-Stufen (`text-klein`, `text-zaehler`, `text-fussnote`, `text-micro`) stehen in
// `apps/web/tailwind.config.ts`; `tests/design-schriftskala/schriftskala.test.ts` hält beide Orte
// deckungsgleich und verbietet frei gesetzte Größen unter der Untergrenze.

export const MINDEST_LESEGROESSE_PX = 11;

export interface Schriftstufe {
  /** Tailwind-Klasse bzw. Bezeichnung der Stufe. */
  klasse: string;
  px: number;
  /** i18n-Schlüssel der Verwendung (Bausteinkatalog `/ui-kit`). */
  verwendungKey: string;
}

/** Die benannten Stufen unterhalb bzw. an der Untergrenze — die einzigen mit eigenem Namen. */
export const BENANNTE_STUFEN: readonly Schriftstufe[] = [
  { klasse: "text-fussnote", px: 10, verwendungKey: "bausteine.schrift.fussnote" },
  { klasse: "text-zaehler", px: 10.5, verwendungKey: "bausteine.schrift.zaehler" },
  { klasse: "text-klein", px: 11, verwendungKey: "bausteine.schrift.klein" },
  { klasse: "text-micro", px: 11, verwendungKey: "bausteine.schrift.micro" },
];

/** Die Größen der freigegebenen Zielbilder (px), aufsteigend — ab der Untergrenze. */
export const ZIELBILD_GROESSEN_PX: readonly number[] = [
  11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 20, 26,
];
