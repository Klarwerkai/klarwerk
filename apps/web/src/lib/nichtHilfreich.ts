// ================================================================================================
// R-1649 (ROADMAP 7.3) — STIMM-ERKANNTES „MARKIEREN ALS NICHT HILFREICH".
// ================================================================================================
//
// „Wenn der Bediener nach einer KLARWERK-Antwort sagt: ‚Das war nicht hilfreich, ich habe es so
// gemacht …' — KLARWERK erkennt das, registriert die Negativ-Bewährung und nimmt die abweichende
// Lösung als neuen Wissens-Entwurf auf."
//
// Gesprochen wird ins Fragefeld: das Diktat (`lib/speechDictation.ts`) schreibt das Erkannte
// dorthin, und beim Absenden fragt die Fläche hier, ob es eine Frage ist oder diese Rückmeldung.
// DOM-frei und ohne Netz — die Erkennung bleibt beim Browser, dieser Schritt liest nur Text.
//
// Bewusst eng: ein Satz, der mit „?" endet, ist eine Frage; der Auslöser muss am Anfang stehen
// (höchstens ein kurzer Vorsatz wie „Danke, aber"). Entscheiden tut ohnehin der Mensch — die
// Fläche zeigt eine Bestätigung, bevor etwas gespeichert wird.

export interface NichtHilfreichErkannt {
  /** Der abweichende Weg in den Worten des Bedieners; leer, wenn er keinen genannt hat. */
  alternative: string;
}

// DE / EN / NL — unabhängig von der Oberflächensprache, weil gesprochen wird, wie gesprochen wird.
const AUSLOESER: readonly RegExp[] = [
  /\bnicht\s+(?:sehr\s+)?hilfreich\b/iu,
  /\bnicht\s+geholfen\b/iu,
  /\bhalf\s+(?:mir\s+)?nicht\b/iu,
  /\bnot\s+(?:very\s+)?helpful\b/iu,
  /\bunhelpful\b/iu,
  /\b(?:didn't|didn’t|did\s+not)\s+help\b/iu,
  /\bniet\s+(?:erg\s+)?(?:behulpzaam|nuttig)\b/iu,
  /\bniet\s+geholpen\b/iu,
];

// Wie weit vorne der Auslöser stehen darf: Platz für „Danke, aber das war leider …", nicht für eine
// Sachfrage, in der die Worte irgendwo vorkommen.
const MAX_VORSATZ = 40;

const TRENNER = /^[\s,.;:!—–…-]+/u;

// Überleitungen zum eigenen Weg; sie gehören nicht in den Entwurf.
const UEBERLEITUNG =
  /^(?:(?:aber|but|maar)\s+)?(?:ich\s+(?:habe|hab)\s+(?:es|das)\s+(?:stattdessen\s+)?(?:so|anders)\s+gemacht|stattdessen|sondern|i\s+did\s+it\s+(?:like\s+this|this\s+way|differently)|instead|ik\s+heb\s+het\s+(?:zo|anders)\s+gedaan|in\s+plaats\s+daarvan)\b/iu;

export function erkenneNichtHilfreich(text: string): NichtHilfreichErkannt | null {
  const satz = text.trim();
  if (!satz || satz.endsWith("?")) {
    return null;
  }
  let treffer: RegExpExecArray | null = null;
  for (const muster of AUSLOESER) {
    const t = muster.exec(satz);
    if (t && (treffer === null || t.index < treffer.index)) {
      treffer = t;
    }
  }
  if (!treffer || treffer.index > MAX_VORSATZ) {
    return null;
  }
  let rest = satz.slice(treffer.index + treffer[0].length).replace(TRENNER, "");
  rest = rest.replace(UEBERLEITUNG, "").replace(TRENNER, "");
  return { alternative: rest.trim() };
}
