// ================================================================================================
// JOB 3061 · H2 — DER UNTERSCHIED WIRD IM TEXT MARKIERT, NICHT DANEBEN ERKLÄRT.
// ================================================================================================
//
// Pedi 04.09. 06:50: „Sie vergleichen Duplikat und in Konflikte sind so irreführend und so
// unübersichtlich." Die Mockups beantworten das mit einer Farbfläche IM Satz: der widersprechende
// Teil in beiden Konfliktkarten (#FBE6E6, Konflikte.dc.html:49/56), der abweichende Teil in beiden
// Duplikatkarten (#FDF1D7, Duplikate.dc.html:49/56).
//
// EHRLICHKEIT VOR OPTIK — die Regel dieser Datei: markiert wird ausschliesslich, was WÖRTLICH im
// Text steht. Findet sich die Marke nicht (der Erkenner hat sinngemäss zusammengefasst, der Text
// wurde seither geändert, Altbestand ohne Detektor-Felder), bleibt der Text UNMARKIERT — und die
// Karte behauptet dann eben nicht, sie wisse, wo der Streit steht. Eine geratene Markierung wäre
// genau die Sorte Scheinfunktion, die das Regelwerk verbietet.
//
// Beide Funktionen sind rein und DOM-frei — sie sind ohne Browser prüfbar
// (`tests/pruefseite/markierung.test.ts`).

export interface TextStueck {
  text: string;
  markiert: boolean;
}

/** Alle Vorkommen im Text finden, Überlappungen zusammenfassen. Leere Marken werden übersprungen. */
function spannen(text: string, marken: readonly string[]): Array<[number, number]> {
  const roh: Array<[number, number]> = [];
  for (const marke of marken) {
    const m = marke.trim();
    if (m.length === 0) {
      continue;
    }
    let von = text.indexOf(m);
    while (von !== -1) {
      roh.push([von, von + m.length]);
      von = text.indexOf(m, von + m.length);
    }
  }
  roh.sort((a, b) => a[0] - b[0]);
  const zusammen: Array<[number, number]> = [];
  for (const [von, bis] of roh) {
    const letzte = zusammen[zusammen.length - 1];
    if (letzte && von <= letzte[1]) {
      letzte[1] = Math.max(letzte[1], bis);
    } else {
      zusammen.push([von, bis]);
    }
  }
  return zusammen;
}

function stuecke(
  text: string,
  spannenListe: Array<[number, number]>,
  treffer: boolean,
): TextStueck[] {
  const teile: TextStueck[] = [];
  let pos = 0;
  for (const [von, bis] of spannenListe) {
    if (von > pos) {
      teile.push({ text: text.slice(pos, von), markiert: !treffer });
    }
    teile.push({ text: text.slice(von, bis), markiert: treffer });
    pos = bis;
  }
  if (pos < text.length) {
    teile.push({ text: text.slice(pos), markiert: !treffer });
  }
  return teile.filter((s) => s.text.length > 0);
}

/**
 * Markiert GENAU die genannten Stellen (Konflikt: der Streitwert dieser Seite).
 * Ohne Treffer: ein einziges unmarkiertes Stück — kein Raten.
 */
export function markiereTeile(text: string, marken: readonly string[]): TextStueck[] {
  const gefunden = spannen(text, marken);
  if (gefunden.length === 0) {
    return text.length > 0 ? [{ text, markiert: false }] : [];
  }
  return stuecke(text, gefunden, true);
}

/**
 * Markiert ALLES AUSSER den genannten Stellen (Duplikat: die gemeinsamen Aussagen bleiben ruhig,
 * abweichend ist der Rest). Wird keine gemeinsame Stelle wörtlich gefunden, wäre „alles abweichend"
 * eine Behauptung über einen Fund, den es nicht gibt — dann bleibt der Text unmarkiert.
 */
export function markiereRest(text: string, gemeinsam: readonly string[]): TextStueck[] {
  const gefunden = spannen(text, gemeinsam);
  if (gefunden.length === 0) {
    return text.length > 0 ? [{ text, markiert: false }] : [];
  }
  return stuecke(text, gefunden, false);
}

/** Wahr, sobald mindestens ein Stück markiert ist — die Karte sagt sonst nichts über den Unterschied. */
export function hatMarkierung(teile: readonly TextStueck[]): boolean {
  return teile.some((s) => s.markiert);
}
