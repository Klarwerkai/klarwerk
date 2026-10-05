// ================================================================================================
// R-0928 / R-1675 (Folgeauftrag gesamt-erstnutzerfuehrung-quellen, Nacharbeit 10): VIER KURZE
// THEMATISCHE EINSTIEGE VOR DEN VOLLFUNKTIONEN.
// ================================================================================================
//
// Die Quelle (`Frontend-Gesamtuebersicht.md` §4, vier „FocusedMissions": Capture → Expert Studio,
// Trust → Validation Board, Proof → Query Console, Asset → Library) verlangt je Thema eine kurze
// Einstiegsansicht, die in eine Aufgabe führt und an die volle Konsole übergibt. Die Kachel-Form von
// 26.06. ist durch mega38 G2 abgelöst und kehrt NICHT zurück: keine dauerhaften Startkacheln, das
// Sichtfeld von `/start` bleibt H5. Der benannte Weg hinein steht im Blatt „Über KLARWERK".
//
// EIN BAUTEIL, VIER ADRESSEN: `/einstieg/<thema>` (`pages/Einstieg.tsx`). Name, Ziel und Zweck
// kommen aus `lib/faehigkeiten.ts` und damit aus `app/navigation.ts` — kein zweites Register. Neu
// ist je Thema nur der eine Satz, womit man anfängt (`texte/erstnutzer.ts`).
import { FAEHIGKEITEN, type Faehigkeit } from "./faehigkeiten";

export const EINSTIEG_THEMEN = ["erfassen", "pruefen", "fragen", "bibliothek"] as const;
export type EinstiegThema = (typeof EINSTIEG_THEMEN)[number];

/** Thema → Navigationspunkt der Vollfunktion. */
const ZIELPUNKT: Record<EinstiegThema, string> = {
  erfassen: "erfassen",
  pruefen: "validierung",
  fragen: "fragen",
  bibliothek: "bibliothek",
};

export interface Einstieg {
  readonly thema: EinstiegThema;
  /** Die Adresse DIESER Einstiegsansicht. */
  readonly pfad: string;
  /** Der Eintrag der Fähigkeitsübersicht: Name, Zweck und Ziel der Vollfunktion. */
  readonly faehigkeit: Faehigkeit;
  /** Der eine Satz, womit man in diesem Bereich anfängt. */
  readonly ersterSchrittKey: string;
}

function faehigkeitFuer(thema: EinstiegThema): Faehigkeit {
  const f = FAEHIGKEITEN.find((x) => x.id === ZIELPUNKT[thema]);
  if (!f) {
    throw new Error(`Einstieg „${thema}": kein Eintrag der Fähigkeitsübersicht.`);
  }
  return f;
}

export const EINSTIEGE: readonly Einstieg[] = EINSTIEG_THEMEN.map((thema) => ({
  thema,
  pfad: `/einstieg/${thema}`,
  faehigkeit: faehigkeitFuer(thema),
  ersterSchrittKey: `erstnutzer.einstieg.${thema}.ersterSchritt`,
}));

/** Der Einstieg zu einem Adressteil — `null`, wenn es dieses Thema nicht gibt. */
export function einstiegFuer(thema: string | undefined): Einstieg | null {
  return EINSTIEGE.find((e) => e.thema === thema) ?? null;
}
