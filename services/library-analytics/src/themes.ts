// WP-IC-PAKET-1 (Teil 2, Pedis Screenshot „(ohne Thema) 70"): DETERMINISTISCHE Themen-Ableitung aus
// Seitentiteln als Fallback, wenn die Quelle keine Labels liefert (die Beispieldaten haben keine).
// Vollständig pure: kein Netz, keine KI, kein Zufall — dieselben Titel ergeben immer dieselben Gruppen.
// Ein Modell DARF später bessere Cluster liefern; dieser Weg ist der getestete Default (der Cloud-
// Reasoner läuft live derzeit ohnehin im Fallback — nichts hier sieht ohne KI leer/kaputt aus).
//
// Algorithmus (bewusst einfach und erklärbar):
//  1. Titel → Kleinbuchstaben-Tokens (Buchstaben inkl. Umlaute), Stoppwörter DE/EN raus, Mindestlänge 4.
//  2. Kandidaten-Wörter = Tokens, die in MINDESTENS 2 Titeln vorkommen (Mindestgruppengröße).
//  3. Jeder Titel bekommt EIN Thema: das häufigste passende Kandidaten-Wort (Gleichstand → alphabetisch).
//  4. Gruppen, die nach der Zuordnung unter 2 Mitglieder fallen, werden aufgelöst → diese Titel bleiben
//     EHRLICH „(ohne Thema)". Label = Wort mit großem Anfangsbuchstaben.

// Reine Funktionswörter (Artikel/Präpositionen/Konjunktionen u. Ä.) — KEINE Inhaltswörter, damit echte
// Themen wie „Onboarding" oder „Wartung" nicht weggefiltert werden.
const THEME_STOPWORDS = new Set([
  // DE
  "aber",
  "alle",
  "allen",
  "aller",
  "auch",
  "beim",
  "dass",
  "dein",
  "deine",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "das",
  "durch",
  "eine",
  "einem",
  "einen",
  "einer",
  "eines",
  "für",
  "fuer",
  "gegen",
  "hier",
  "ihre",
  "mit",
  "nach",
  "nicht",
  "oder",
  "ohne",
  "sein",
  "sich",
  "sind",
  "sowie",
  "über",
  "ueber",
  "unser",
  "unsere",
  "unter",
  "vom",
  "von",
  "vor",
  "wenn",
  "wird",
  "werden",
  "wie",
  "zum",
  "zur",
  "zwischen",
  // EN
  "about",
  "after",
  "also",
  "and",
  "are",
  "before",
  "between",
  "but",
  "for",
  "from",
  "has",
  "have",
  "how",
  "into",
  "not",
  "our",
  "over",
  "than",
  "that",
  "the",
  "their",
  "then",
  "this",
  "under",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "will",
  "with",
  "without",
  "your",
]);

const MIN_TOKEN_LENGTH = 4;
export const MIN_THEME_GROUP_SIZE = 2;

// Titel → signifikante, deduplizierte Kleinbuchstaben-Tokens (Buchstaben inkl. Umlaute/ß).
export function titleThemeTokens(title: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of title.toLowerCase().split(/[^a-zäöüß]+/)) {
    if (raw.length < MIN_TOKEN_LENGTH || THEME_STOPWORDS.has(raw) || seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

function themeLabel(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

// Je Titel EIN abgeleitetes Thema (Label) oder null („ohne Thema"). Index-parallel zur Eingabe.
export function deriveTitleThemes(titles: readonly string[]): (string | null)[] {
  const tokensPerTitle = titles.map((title) => titleThemeTokens(title));
  // Wort → Anzahl Titel, in denen es vorkommt.
  const wordCounts = new Map<string, number>();
  for (const tokens of tokensPerTitle) {
    for (const token of tokens) {
      wordCounts.set(token, (wordCounts.get(token) ?? 0) + 1);
    }
  }
  // Kandidaten: kommen in mindestens MIN_THEME_GROUP_SIZE Titeln vor.
  const isCandidate = (token: string): boolean =>
    (wordCounts.get(token) ?? 0) >= MIN_THEME_GROUP_SIZE;

  // Zuordnung: das häufigste Kandidaten-Wort des Titels; Gleichstand → alphabetisch (deterministisch).
  const assigned: (string | null)[] = tokensPerTitle.map((tokens) => {
    let best: string | null = null;
    for (const token of tokens) {
      if (!isCandidate(token)) {
        continue;
      }
      if (
        best === null ||
        (wordCounts.get(token) ?? 0) > (wordCounts.get(best) ?? 0) ||
        ((wordCounts.get(token) ?? 0) === (wordCounts.get(best) ?? 0) &&
          token.localeCompare(best) < 0)
      ) {
        best = token;
      }
    }
    return best;
  });

  // Gruppen unter Mindestgröße auflösen (Titel wanderten zu größeren Gruppen ab) → ehrlich null.
  const groupSizes = new Map<string, number>();
  for (const token of assigned) {
    if (token !== null) {
      groupSizes.set(token, (groupSizes.get(token) ?? 0) + 1);
    }
  }
  return assigned.map((token) =>
    token !== null && (groupSizes.get(token) ?? 0) >= MIN_THEME_GROUP_SIZE
      ? themeLabel(token)
      : null,
  );
}
