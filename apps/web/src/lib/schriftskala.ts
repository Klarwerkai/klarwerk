// ================================================================================================
// R-0918 · DIE SCHRIFTSKALA DER WEB-APP — eine feste Liste statt frei gewählter Pixel.
// ================================================================================================
//
// WOHER DIE WERTE KOMMEN (nicht neu erfunden, R-0906):
//   · die freigegebenen Zielbilder (`design/klarwerk/*.dc.html`, `design/klara/*.dc.html`,
//     `DESIGN_ZIELBILD_20260827/*.dc.html`). Jeder Wert unten steht WÖRTLICH als Vorlagen-Anker
//     („font-size: …px") in einer Chromium-Messung oder in `tools/design-vergleich/werte.ts` —
//     `ZIELBILD_HERKUNFT` nennt je Wert eine Fundstelle, und der Wächter prüft, dass sie dort steht;
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

/**
 * Die VOLLSTÄNDIGE Skala ab der Untergrenze: jede Schriftgröße, die eine freigegebene Vorlage
 * nennt, und keine andere. Frei gesetzte Größen der Web-App (`text-[Npx]`) müssen hierauf liegen.
 */
export const ZIELBILD_GROESSEN_PX: readonly number[] = [
  11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 15.5, 16, 17, 20, 24, 26, 28, 30,
];

/**
 * Je Skalenwert eine Fundstelle des wörtlichen Vorlagen-Ankers (Datei unter `tests/design/` bzw.
 * `tools/design-vergleich/`). Repo-relativ; geprüft in `tests/design-schriftskala/`.
 */
export const ZIELBILD_HERKUNFT: Readonly<Record<string, string>> = {
  "10": "tests/design/zielbild-h5-fragen.test.ts",
  "10.5": "tests/design/zielbild-h1-huelle.test.ts",
  "11": "tests/design/zielbild-h4-bibliothek.test.ts",
  "11.5": "tools/design-vergleich/werte.ts",
  "12": "tests/design/zielbild-h4-bibliothek.test.ts",
  "12.5": "tests/design/zielbild-h4-bibliothek.test.ts",
  "13": "tests/design/zielbild-h4-bibliothek.test.ts",
  "13.5": "tools/design-vergleich/werte.ts",
  "14": "tests/design/zielbild-h4-bibliothek.test.ts",
  "15": "tests/design/zielbild-h2-pruefen.test.ts",
  "15.5": "tests/design/zielbild-h4-bibliothek.test.ts",
  "16": "tests/design/zielbild-h3-erfassen.test.ts",
  "17": "tests/design/zielbild-h5-fragen.test.ts",
  "20": "tests/design/zielbild-h2-pruefen.test.ts",
  "24": "tests/design/zielbild-h4-bibliothek.test.ts",
  "26": "tests/design/zielbild-h2-pruefen.test.ts",
  "28": "tests/design/zielbild-h3-erfassen.test.ts",
  "30": "tests/design/zielbild-h5-start.test.ts",
};
