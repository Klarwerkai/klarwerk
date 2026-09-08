// ================================================================================================
// JOB 3338 · DER WORTLAUT-MASSSTAB — was ein ISO-Hilfetext NICHT sagen darf.
// ================================================================================================
//
// Kein Prüfstand, sondern der gemeinsame Massstab zweier: `iso-hilfe-flaeche.test.tsx` misst damit
// die gerenderte Seite, `iso-wortlaut.test.ts` das Inhaltsmodul. Eine Liste, zwei Messorte.
//
// WARUM NICHT EINFACH DIE WÖRTER „zertifiziert", „garantiert", „konform" VERBIETEN. Weil die
// abgenommene Lieferung sie BRAUCHT — und zwar genau dort, wo sie die Grenze zieht:
//
//     „… es garantiert weder die Erstzertifizierung noch deren Erhalt."   (iso-9001, DE)
//     „Zertifiziert wird das Managementsystem … durch eine externe Zertifizierungsstelle."
//     „… belegen keine ISO-27001-Konformität."                            (iso-27001, DE)
//
// Ein Verbot der Wörter würde genau die drei Sätze rot machen, die den Text ehrlich halten, und die
// Bahn zum Löschen der Einschränkung drängen. Gemessen wird deshalb die ZUSAGE, nicht das Wort:
//
//   1. BLOCKLISTE — ausgeschriebene Versprechen („garantiert die Zertifizierung", „ISO-zertifiziert",
//      „ensures compliance"). Sie treffen die Lieferung nachweislich nicht (`iso-wortlaut.test.ts`
//      prüft beide Richtungen: Liste greift bei erfundenen Sätzen, greift nicht bei den echten).
//   2. SATZREGEL — ein Satz, der Klarwerk UND ein Zertifizierungs-/Konformitätswort nennt, muss
//      seine Einschränkung IM SELBEN SATZ tragen („nicht", „weder", „allein", „nur", „hängt … ab").
//      Diese Regel fängt auch die Zusage, an die beim Schreiben der Blockliste niemand dachte.

export interface Zusage {
  readonly muster: RegExp;
  readonly warum: string;
}

/** Ausgeschriebene Versprechen. Jede Zeile ist ein Satz, den Klarwerk nicht halten kann. */
export const VERBOTENE_ZUSAGEN: readonly Zusage[] = [
  // ---- Deutsch -------------------------------------------------------------------------------
  { muster: /Klarwerk\s+zertifiziert/i, warum: "Klarwerk zertifiziert niemanden" },
  {
    muster: /zertifiziert\s+(Sie|Ihr|Ihre|Ihren|Ihr\s+Unternehmen)/i,
    warum: "Zertifizierung des Kunden zugesagt",
  },
  {
    muster:
      /garantiert\s+(Ihnen\s+)?(die\s+|eine\s+|den\s+|das\s+)?(Konformit|Zertifiz|Normkonform|Compliance|Erfüllung|Einhaltung)/i,
    warum: "Konformität oder Zertifizierung garantiert",
  },
  {
    muster:
      /(ist|sind|wird|werden|macht|machen|bleibt)\s+(damit\s+|dadurch\s+|automatisch\s+)?(ISO[-\s]?\d*\s*)?konform\b/i,
    warum: "Konformität als erreichten Zustand behauptet",
  },
  { muster: /normkonform/i, warum: "Konformität als Eigenschaft behauptet" },
  { muster: /ISO[-\s]?zertifiziert/i, warum: "ISO-Zertifizierung behauptet" },
  {
    muster: /automatisch\s+(konform|zertifiziert|normkonform)/i,
    warum: "Konformität als automatische Folge behauptet",
  },
  {
    muster:
      /erfüllt\s+(damit\s+|automatisch\s+)?(die\s+|alle\s+)?(Norm(en)?\b|ISO\b|Anforderungen\s+der\s+Norm)/i,
    warum: "Erfüllung der Norm zugesagt",
  },
  {
    muster: /(sichert|stellt)\s+(die\s+)?(Konformität|Zertifizierung)\s+(sicher|her)?/i,
    warum: "Konformität sichergestellt",
  },
  { muster: /revisionssicher/i, warum: "Nachweisqualität zugesagt, die nicht belegt ist" },
  // ---- Englisch ------------------------------------------------------------------------------
  { muster: /Klarwerk\s+certifies/i, warum: "Klarwerk certifies nobody" },
  { muster: /certifies\s+(you|your)/i, warum: "certification of the customer promised" },
  {
    muster:
      /guarantees?\s+(you\s+)?(the\s+|your\s+)?(compliance|conformity|certification|conformance)/i,
    warum: "compliance or certification guaranteed",
  },
  {
    muster:
      /\b(is|are|makes\s+you|makes\s+your|becomes?|will\s+be)\b[^.;]{0,40}\b(fully\s+)?compliant\b/i,
    warum: "compliance claimed as an achieved state",
  },
  { muster: /ISO[-\s]?certified/i, warum: "ISO certification claimed" },
  {
    muster: /ensures?\s+(compliance|conformity|certification)/i,
    warum: "compliance ensured",
  },
  {
    muster: /automatically\s+(compliant|certified)/i,
    warum: "compliance claimed as an automatic consequence",
  },
  {
    muster: /\bmeets\s+(the\s+|all\s+)?(standard|ISO|requirements\s+of\s+the\s+standard)/i,
    warum: "meeting the standard promised",
  },
  {
    muster: /achieves?\s+(certification|compliance|conformity)/i,
    warum: "achievement of certification promised",
  },
  {
    muster: /\baudit[-\s]?proof\b/i,
    warum: "evidence quality promised that is not established",
  },
];

/** Wörter, die einen Satz zu einer Aussage über Zertifizierung/Konformität machen. */
const ZERTIFIZIERUNGSWORT =
  /(zertifizier|zertifikat|konformit|konform\b|normanforderung|certif|complian|conformity|conformance)/i;

/** Klarwerk oder ein Stellvertreter davon („die Software", „using Klarwerk"). */
const KLARWERK = /(klarwerk|die\s+software|einer\s+software|the\s+software|using\s+software)/i;

/**
 * Einschränkungen. Steht eine davon im Satz, ist die Aussage begrenzt und keine Zusage.
 * Absichtlich grosszügig: die Regel soll die VERGESSENE Zusage fangen, nicht Formulierungen zählen.
 */
const EINSCHRAENKUNG =
  /(nicht|kein|weder|allein|nur\b|ohne\b|sofern|abhäng|hängt|bleibt|bleiben|extern|\bnot\b|\bno\b|neither|alone|only\b|without|provided|depends?|remain)/i;

/**
 * Text → Sätze. Zwei Trenner, beide nötig:
 *   · Zeilenumbruch — eine Überschrift endet ohne Punkt. Ohne diesen Trenner klebte sie am ersten
 *     Satz des Fliesstexts und schleppte deren Wörter in ihn hinein (gemessen an `iso-maintain`:
 *     die Überschrift „Zertifizierung vorbereiten …" machte den harmlosen Folgesatz zum Befund).
 *   · Satzzeichen OHNE Pflicht auf ein folgendes Leerzeichen — im DOM hängen Absätze aneinander.
 */
function saetze(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s*/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);
}

/** Nur die Blockliste — für rohen DOM-Text, in dem auch URLs und Beschriftungen stehen. */
export function zusagenBlockliste(text: string): string[] {
  const flach = text.replace(/\s+/g, " ");
  return VERBOTENE_ZUSAGEN.filter((z) => z.muster.test(flach)).map(
    (z) => `${z.warum} — Muster ${z.muster.source}`,
  );
}

/** Blockliste UND Satzregel. Für den eigentlichen Erklärtext (Titel + Absätze). */
export function zusagenBefund(text: string): string[] {
  const befund = [...zusagenBlockliste(text)];
  for (const satz of saetze(text)) {
    if (KLARWERK.test(satz) && ZERTIFIZIERUNGSWORT.test(satz) && !EINSCHRAENKUNG.test(satz)) {
      befund.push(`Satz über Klarwerk und Zertifizierung ohne Einschränkung: „${satz}"`);
    }
  }
  return befund;
}
