// R-1664 / R-2179 / R-2180 — DER GEFÜHRTE NEGATIVWISSEN-FALL IN DER FLÄCHE. DOM-frei, testbar.
//
// Form und Mindeststufe sind die des Servers (services/knowledge-object/src/negativwissen.ts). Die
// Fläche wendet dieselbe Regel VOR dem Einreichen an, damit der Mensch sieht, welche Stufe gilt —
// entscheiden tut weiterhin der Server.
//
// Sprache nach der UX-Regel der Quelle: „Lerneffekt dokumentieren", nicht „Fehler melden".
import type { Confidentiality, NegativwissenAngaben, NegativwissenBezug } from "../api/types";

export const NEGATIVWISSEN_BEZUEGE: readonly NegativwissenBezug[] = [
  "personen",
  "kunden",
  "produktion",
  "qualitaet",
];

export type NegativwissenTextfeld =
  | "incidentTrigger"
  | "mistakePattern"
  | "impact"
  | "recoveryAction"
  | "avoidanceRule";

/** Die geführten Fragen in der Reihenfolge der Quelle; „Was ist passiert?" ist die Kernaussage. */
export const NEGATIVWISSEN_FRAGEN: readonly { feld: NegativwissenTextfeld; key: string }[] = [
  { feld: "incidentTrigger", key: "negativwissen.q.incidentTrigger" },
  { feld: "mistakePattern", key: "negativwissen.q.mistakePattern" },
  { feld: "impact", key: "negativwissen.q.impact" },
  { feld: "recoveryAction", key: "negativwissen.q.recoveryAction" },
  { feld: "avoidanceRule", key: "negativwissen.q.avoidanceRule" },
];

/**
 * BEN, Nacharbeit 2 — die Obergrenzen eines Falls. GEGENSTÜCK: `NEGATIVWISSEN_LIMITS` in
 * `services/knowledge-object/src/negativwissen.ts` (der Server weist Überschreitungen ab, er kürzt
 * nicht). Werte stehen hier selbst, weil apps/web nichts aus services/ importiert (s.
 * `lib/draftLimits.ts`); `tests/negativwissen-erfassung/grenzen.test.ts` vergleicht beide.
 */
export const NEGATIVWISSEN_LIMITS = { text: 2000, warnsignale: 20, warnsignal: 300 } as const;

/** Eine Überschreitung, wie die Fläche sie nennt: welches Feld, was gezählt wurde, Ist und Grenze. */
export interface NegativwissenUeberschreitung {
  feld: NegativwissenTextfeld | "warnsignale";
  art: "zeichen" | "anzahl";
  ist: number;
  max: number;
}

/** Formularzustand: Warnsignale als ein Text, eines je Zeile — so tippt man sie. */
export interface NegativwissenForm {
  incidentTrigger: string;
  mistakePattern: string;
  impact: string;
  recoveryAction: string;
  avoidanceRule: string;
  warnsignale: string;
  bezug: NegativwissenBezug[];
}

export const LEERE_NEGATIVWISSEN_FORM: NegativwissenForm = {
  incidentTrigger: "",
  mistakePattern: "",
  impact: "",
  recoveryAction: "",
  avoidanceRule: "",
  warnsignale: "",
  bezug: [],
};

/** Die Warnsignale des Formulars in der Normalform des Servers: je Zeile, getrimmt, ohne Doppelte. */
function warnsignaleVon(form: NegativwissenForm): string[] {
  const zeilen = form.warnsignale.split("\n").map((z) => z.trim());
  return [...new Set(zeilen.filter((z) => z.length > 0))];
}

/**
 * BEN, Nacharbeit 2 — was am Formular die Obergrenzen überschreitet, in derselben Zählung wie der
 * Server (`negativwissenGrenzfehler`). Leer = alles passt. Die Fläche zeigt jede Überschreitung am
 * Feld an, und Sichern/Einreichen gehen nicht hinaus, solange die Liste nicht leer ist.
 */
export function negativwissenUeberschreitungen(
  form: NegativwissenForm,
): NegativwissenUeberschreitung[] {
  const liste: NegativwissenUeberschreitung[] = [];
  for (const { feld } of NEGATIVWISSEN_FRAGEN) {
    const ist = form[feld].trim().length;
    if (ist > NEGATIVWISSEN_LIMITS.text) {
      liste.push({ feld, art: "zeichen", ist, max: NEGATIVWISSEN_LIMITS.text });
    }
  }
  const warnsignale = warnsignaleVon(form);
  if (warnsignale.length > NEGATIVWISSEN_LIMITS.warnsignale) {
    liste.push({
      feld: "warnsignale",
      art: "anzahl",
      ist: warnsignale.length,
      max: NEGATIVWISSEN_LIMITS.warnsignale,
    });
  }
  const laengstes = Math.max(0, ...warnsignale.map((w) => w.length));
  if (laengstes > NEGATIVWISSEN_LIMITS.warnsignal) {
    liste.push({
      feld: "warnsignale",
      art: "zeichen",
      ist: laengstes,
      max: NEGATIVWISSEN_LIMITS.warnsignal,
    });
  }
  return liste;
}

/** Formular → Angaben (getrimmt, ohne Leerwerte). `undefined`, wenn nichts angegeben ist. */
export function formZuAngaben(form: NegativwissenForm): NegativwissenAngaben | undefined {
  const angaben: NegativwissenAngaben = {
    earlyWarningSigns: warnsignaleVon(form),
    bezug: NEGATIVWISSEN_BEZUEGE.filter((b) => form.bezug.includes(b)),
  };
  for (const { feld } of NEGATIVWISSEN_FRAGEN) {
    const wert = form[feld].trim();
    if (wert) {
      angaben[feld] = wert;
    }
  }
  const traegtInhalt =
    NEGATIVWISSEN_FRAGEN.some(({ feld }) => angaben[feld] !== undefined) ||
    angaben.earlyWarningSigns.length > 0 ||
    angaben.bezug.length > 0;
  return traegtInhalt ? angaben : undefined;
}

/** Gespeicherte Angaben (Entwurf fortsetzen) → Formular. */
export function angabenZuForm(angaben: NegativwissenAngaben | null | undefined): NegativwissenForm {
  if (!angaben) {
    return LEERE_NEGATIVWISSEN_FORM;
  }
  return {
    incidentTrigger: angaben.incidentTrigger ?? "",
    mistakePattern: angaben.mistakePattern ?? "",
    impact: angaben.impact ?? "",
    recoveryAction: angaben.recoveryAction ?? "",
    avoidanceRule: angaben.avoidanceRule ?? "",
    warnsignale: (angaben.earlyWarningSigns ?? []).join("\n"),
    bezug: NEGATIVWISSEN_BEZUEGE.filter((b) => (angaben.bezug ?? []).includes(b)),
  };
}

const RANG: Record<Confidentiality, number> = { intern: 0, vertraulich: 1, streng_vertraulich: 2 };

/** Mindeststufe eines Falls mit Bezug (Quelle: „mindestens L2 Confidential" → „vertraulich"). */
export const NEGATIVWISSEN_MINDESTSTUFE: Confidentiality = "vertraulich";

/** Ist `stufe` für einen Fall mit diesem Bezug wählbar? Ohne Bezug ist jede Stufe wählbar. */
export function stufeWaehlbar(
  bezug: readonly NegativwissenBezug[],
  stufe: Confidentiality,
): boolean {
  return bezug.length === 0 || RANG[stufe] >= RANG[NEGATIVWISSEN_MINDESTSTUFE];
}

/**
 * Die Stufe nach einer Bezugsänderung: liegt die bisherige Wahl unter der Mindeststufe (oder fehlt
 * sie), wird auf „vertraulich" angehoben. Eine strengere Wahl bleibt; ohne Bezug ändert sich nichts.
 */
export function stufeNachBezug(
  bezug: readonly NegativwissenBezug[],
  gewaehlt: Confidentiality | undefined,
): Confidentiality | undefined {
  if (bezug.length === 0) {
    return gewaehlt;
  }
  return gewaehlt !== undefined && stufeWaehlbar(bezug, gewaehlt)
    ? gewaehlt
    : NEGATIVWISSEN_MINDESTSTUFE;
}
