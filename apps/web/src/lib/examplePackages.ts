// WP-B6 (Pedis Wunsch für die VIP-2-Tester): Beispielpaket-Karten als DATEN — die UI rendert die
// Liste, kein Hardcode je Karte. Die Paket-Ids MÜSSEN mit services/app/src/example-packages.ts
// übereinstimmen (der Server validiert sie ohnehin). Flache Copy-Schlüssel wie gewohnt
// (Muster IMPORT_CLEANUP_TEXT) für den i18n-Vollständigkeitstest.
export const EXAMPLE_PACKAGES_TEXT = {
  title: "exp.title",
  // Ehrlicher Entfernen-Hinweis: das Import-Aufräumen (D-CLEAN) entfernt die Beispiele NICHT —
  // sie verschwinden über den bestehenden Demo-Daten-entfernen-Weg.
  hint: "exp.hint",
  load: "exp.load",
  loading: "exp.loading",
  result: "exp.result",
} as const;

export interface ExamplePackageCard {
  id: "konflikte" | "bilder" | "qualitaet";
  titleKey: string;
  descKey: string;
}

export const EXAMPLE_PACKAGE_CARDS: readonly ExamplePackageCard[] = [
  { id: "konflikte", titleKey: "exp.pkg.konflikte.title", descKey: "exp.pkg.konflikte.desc" },
  { id: "bilder", titleKey: "exp.pkg.bilder.title", descKey: "exp.pkg.bilder.desc" },
  { id: "qualitaet", titleKey: "exp.pkg.qualitaet.title", descKey: "exp.pkg.qualitaet.desc" },
];

// Alle Keys (Basis + Karten) — EINE Liste für den ×3-Sprachen-Test.
export const EXAMPLE_PACKAGES_ALL_KEYS: readonly string[] = [
  ...Object.values(EXAMPLE_PACKAGES_TEXT),
  ...EXAMPLE_PACKAGE_CARDS.flatMap((card) => [card.titleKey, card.descKey]),
];
