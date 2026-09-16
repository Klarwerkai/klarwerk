// ================================================================================================
// JOB 4146 · R7 — DIE WORTE, DIE ZUM NEULADEN AUFFORDERN (eine Liste, zwei Prüfer)
// ================================================================================================
//
// WARUM SIE HIER STEHT UND NICHT ZWEIMAL: der Katalogwächter (`sprachen.test.ts`) prüft die
// ÜBERSETZTEN Sätze, der Routenwächter (`fehlermeldung-neuladen.test.ts`) die VOLLSTÄNDIGE sichtbare
// Meldung samt angehängtem Servertext. Zwei Abschriften derselben Liste wären zwei Gelegenheiten,
// eine davon zu vergessen — genau so entstand der Befund BENs in Runde 6: der Katalog war sauber,
// der Servertext nicht, und geprüft wurde nur der Katalog.
//
// GEBANNT IST DIE AUFFORDERUNG, NICHT DAS WORT „erneut": „Erneut senden" ist ja der angebotene Weg.
// Die Entwürfe leben im Zustand der Lesefläche; wer neu lädt, verliert genau den Text, den dieselbe
// Meldung als erhalten bezeichnet.
export const SPRACHEN = ["de", "en", "nl"] as const;

export type Sprache = (typeof SPRACHEN)[number];

export const NEULADEN: Record<Sprache, readonly string[]> = {
  de: ["neu laden", "neu zu laden", "neuladen", "seite aktualisieren", "stand neu"],
  en: ["reload", "refresh the page"],
  // `nl` trägt zusätzlich „pagina opnieuw" und „laad de pagina": der Bestandssatz lautete
  // „laad de pagina opnieuw", und die erste Fassung dieser Liste liess ihn durch — gemessen im roten
  // Lauf `0d40e290` (R6), in dem de und en fielen und nl nicht. Ein Wächter, der zwei von drei
  // Sprachen fängt, behauptet mehr, als er prüft.
  nl: ["opnieuw laden", "herladen", "pagina vernieuwen", "pagina opnieuw", "laad de pagina"],
};

/** Jede Aufforderung, die in diesem Text steckt — leer heisst: der Text schickt niemanden fort. */
export function neuladeTreffer(text: string, lng: Sprache): string[] {
  const klein = text.toLowerCase();
  return NEULADEN[lng].filter((wort) => klein.includes(wort));
}
