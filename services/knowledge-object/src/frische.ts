// ================================================================================================
// aufnahme:20260922:gesamt-wissen-frische — WIE FRISCH IST EIN WISSENSOBJEKT, UND WAS FOLGT DARAUS.
// ================================================================================================
//
// Eine reine Ableitung, kein Zustand und kein Schreibweg. Sie beantwortet an EINER Stelle die
// Fragen der Originalpunkte R-0207, R-0236, R-0248, R-0652, R-1636 und FR-EXT-06:
//   · wie frisch ist es (frisch, altert, fällig, veraltet),
//   · bis wann gilt es als gesichert (Haltbarkeit) und wer muss es bestätigen (Verantwortlicher),
//   · ist es der aktuelle Stand, darf es in erzeugte Dokumente, was wäre der nächste Schritt,
//   · wie schutzbedürftig ist es und in welchem Betriebsmodell darf es verarbeitet werden.
//
// WORAUS GERECHNET WIRD — nur aus Feldern, die das Objekt ohnehin trägt:
//   · die letzte Fassung (`history[].at`, sonst `createdAt`) — jede Bestätigung „Noch gültig"
//     erzeugt eine neue Fassung (LifecycleService.confirmStillValid) und setzt damit beides neu;
//   · das letzte Frische-Signal (`frischeSignal`, R-0206): jemand hat das Wissen angewendet und
//     bestätigt, dass es weiterhin stimmt — es macht das Objekt FRISCHER, ist aber keine Prüfung;
//   · die letzte Fristbestätigung (`fristBestaetigung`): dasselbe Signal, aber vom Verantwortlichen.
//     Nur sie (oder eine neue Fassung) verlängert die Haltbarkeit — R-0248: „bis der
//     Verantwortliche es bestätigt".
//
// HALBWERTSZEIT JE WISSENSART (R-1636). Die Originalquelle begründet sie mit „Vorschriften ändern
// sich, Bauchgefühl ändert sich kaum" — das sind die fünf Wissensarten des Pflichtenhefts (§3.5),
// nicht das frei benannte Feld `category`. Die Werte sind feste Vorgaben; das LERNEN aus der
// Bewährungs-Historie, das die Quelle als Ausbau nennt, ist hier ausdrücklich nicht gebaut.
//
// FEHLT EINE GRUNDLAGE, WIRD NICHTS GERATEN: ohne lesbares Datum gilt das Objekt als fällig und
// nicht gesichert; ein nicht erhobener Merker oder Konfliktstand steht als Grund in `ungeprueft`
// und sperrt die Freigabe in Dokumente (dieselbe Form wie `discloseDisplayStatus`).
import type { Erhoben } from "./display-status";
import { responsibleKindOf, responsibleOf } from "./ownership";
import type { Confidentiality, KnowledgeObject, KnowledgeType, KoFrischeSignal } from "./types";

export type FrischeStufe = "frisch" | "altert" | "faellig" | "veraltet";

const STUFEN_RANG: readonly FrischeStufe[] = ["frisch", "altert", "faellig", "veraltet"];

/**
 * R-0652 / FR-EXT-06: die Empfehlung, in welchem Betriebsmodell das Objekt verarbeitet werden darf.
 *   · `freigegebene_ki` — intern: auch ein öffentlicher KI-Anbieter, sofern der Admin ihn freigegeben hat;
 *   · `lokales_modell`  — vertraulich: nur ein im Haus betriebenes Modell;
 *   · `ohne_ki`         — streng vertraulich oder Stufe unbekannt: keine Modellverarbeitung.
 * Eine EMPFEHLUNG, kein Tor — die harten Egress-Grenzen bleiben `dropConfidential` und die
 * Cloud-Sperre der Klara-Wege.
 */
export type Betriebsmodell = "freigegebene_ki" | "lokales_modell" | "ohne_ki";

export type FrischeSchritt =
  | "konflikt_klaeren"
  | "validierung_abschliessen"
  | "erneut_bestaetigen"
  | "bald_bestaetigen"
  | "keiner";

/** R-1636: Halbwertszeit in Tagen je Wissensart — die Haltbarkeit eines bestätigten Stands. */
export const HALBWERTSZEIT_TAGE: Readonly<Record<KnowledgeType, number>> = {
  technik: 180,
  best_practice: 365,
  lernkurve: 365,
  negativwissen: 730,
  bauchgefuehl: 1095,
};

/** R-0248: so viele Tage vor Fristende wird der Verantwortliche erinnert (höchstens die halbe Frist). */
export const ERINNERUNG_VORLAUF_TAGE = 14;

const TAG_MS = 24 * 60 * 60 * 1000;

export interface FrischeAuskunft {
  stufe: FrischeStufe;
  halbwertszeitTage: number;
  /** Bezug der Frische: letzte Fassung oder jüngeres Frische-Signal (ISO), `null` ohne lesbares Datum. */
  bezugAm: string | null;
  letztesSignal: KoFrischeSignal | null;
  /** Bis dahin gilt ein validiertes Objekt in Antworten als gesichert (ISO), `null` ohne Datum. */
  haltbarBis: string | null;
  erinnerungAb: string | null;
  /** Ab `erinnerungAb` und vor Fristende: der Verantwortliche soll bestätigen. */
  erinnern: boolean;
  verantwortlich: string;
  verantwortlichArt: "owner" | "author-fallback";
  /** R-0248: validiert, Frist nicht abgelaufen, keine erneute Prüfung angefordert. */
  gesichert: boolean;
  /** R-0236: validiert, frisch oder alternd, keine erneute Prüfung angefordert. */
  aktuellerStand: boolean;
  /** R-0652: die gültige Schutzstufe — `null`, wenn der Bestand keine gültige trägt. */
  schutz: Confidentiality | null;
  betriebsmodell: Betriebsmodell;
  /** R-0207: darf in erzeugte Dokumente (validiert, aktuell, ohne Konflikt, nicht vertraulich). */
  inDokumente: boolean;
  naechsterSchritt: FrischeSchritt;
  /** Eingänge, die für diese Auskunft nicht erhoben werden konnten — mit Grund. */
  ungeprueft: { revalidierung?: string; konflikt?: string };
}

export interface FrischeEingaenge {
  readonly revalidierung: Erhoben<boolean>;
  readonly konflikt: Erhoben<boolean>;
}

type FrischeKo = Pick<
  KnowledgeObject,
  | "type"
  | "status"
  | "createdAt"
  | "history"
  | "author"
  | "ownership"
  | "confidentiality"
  | "frischeSignal"
  | "fristBestaetigung"
>;

function zeit(wert: string | undefined): number {
  return wert === undefined ? Number.NaN : Date.parse(wert);
}

/** Der späteste lesbare Zeitpunkt — `NaN`, wenn keiner lesbar ist. */
function spaetester(...werte: number[]): number {
  const lesbar = werte.filter((w) => Number.isFinite(w));
  return lesbar.length === 0 ? Number.NaN : Math.max(...lesbar);
}

function iso(ms: number): string | null {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function letzteFassungMs(ko: FrischeKo): number {
  return spaetester(zeit(ko.createdAt), ...(ko.history ?? []).map((h) => zeit(h.at)));
}

/** R-1636: die Halbwertszeit des Objekts — unbekannte Art fällt auf ein Jahr. */
export function halbwertszeitTage(ko: Pick<KnowledgeObject, "type">): number {
  return HALBWERTSZEIT_TAGE[ko.type] ?? 365;
}

/** Ende der Haltbarkeit in ms — `NaN` ohne lesbares Datum. */
function haltbarBisMs(ko: FrischeKo): number {
  const bezug = spaetester(letzteFassungMs(ko), zeit(ko.fristBestaetigung?.at));
  return bezug + halbwertszeitTage(ko) * TAG_MS;
}

/**
 * R-0248: ist die Haltbarkeit abgelaufen? Der Fragepfad nutzt genau diese Zeile, damit ein
 * validiertes Objekt nach Fristende in Antworten nicht mehr als gesichert gilt. Ohne lesbares
 * Datum ist die Frist nicht belegt — und damit abgelaufen (fail-closed).
 */
export function haltbarkeitAbgelaufen(ko: FrischeKo, jetztMs: number): boolean {
  const bis = haltbarBisMs(ko);
  return !Number.isFinite(bis) || jetztMs >= bis;
}

function hoehere(a: FrischeStufe, b: FrischeStufe): FrischeStufe {
  return STUFEN_RANG.indexOf(a) >= STUFEN_RANG.indexOf(b) ? a : b;
}

function betriebsmodellFuer(schutz: Confidentiality | null): Betriebsmodell {
  if (schutz === "intern") {
    return "freigegebene_ki";
  }
  if (schutz === "vertraulich") {
    return "lokales_modell";
  }
  return "ohne_ki";
}

/** Fehlt das Feld (Altbestand), gilt „intern"; ein ungültiger Wert ist unbekannt (`null`). */
function schutzVon(wert: unknown): Confidentiality | null {
  if (wert === undefined || wert === null) {
    return "intern";
  }
  return wert === "intern" || wert === "vertraulich" || wert === "streng_vertraulich" ? wert : null;
}

export function frischeVon(
  ko: FrischeKo,
  jetztMs: number,
  eingaenge: FrischeEingaenge,
): FrischeAuskunft {
  const halbwertszeit = halbwertszeitTage(ko);
  const signal = ko.frischeSignal ?? null;
  const bezug = spaetester(letzteFassungMs(ko), zeit(signal?.at));
  const bis = haltbarBisMs(ko);
  const vorlauf = Math.min(ERINNERUNG_VORLAUF_TAGE, halbwertszeit / 2) * TAG_MS;
  const erinnerungAb = bis - vorlauf;
  const abgelaufen = haltbarkeitAbgelaufen(ko, jetztMs);

  const ungeprueft: FrischeAuskunft["ungeprueft"] = {};
  if ("ungeprueft" in eingaenge.revalidierung) {
    ungeprueft.revalidierung = eingaenge.revalidierung.ungeprueft;
  }
  if ("ungeprueft" in eingaenge.konflikt) {
    ungeprueft.konflikt = eingaenge.konflikt.ungeprueft;
  }
  const angefordert = "wert" in eingaenge.revalidierung && eingaenge.revalidierung.wert;
  const keineAnforderung = "wert" in eingaenge.revalidierung && !eingaenge.revalidierung.wert;
  const imKonflikt = "wert" in eingaenge.konflikt && eingaenge.konflikt.wert;
  const ohneKonflikt = "wert" in eingaenge.konflikt && !eingaenge.konflikt.wert;

  let stufe: FrischeStufe;
  if (!Number.isFinite(bezug)) {
    stufe = "faellig";
  } else {
    const alter = jetztMs - bezug;
    const h = halbwertszeit * TAG_MS;
    stufe =
      alter < h / 2 ? "frisch" : alter < h ? "altert" : alter < 2 * h ? "faellig" : "veraltet";
  }
  if (abgelaufen || angefordert) {
    stufe = hoehere(stufe, "faellig");
  }

  const validiert = ko.status === "validiert";
  const aktuell = stufe === "frisch" || stufe === "altert";
  const schutz = schutzVon(ko.confidentiality);
  const erinnern = Number.isFinite(bis) && jetztMs >= erinnerungAb && jetztMs < bis;

  let naechsterSchritt: FrischeSchritt;
  if (imKonflikt) {
    naechsterSchritt = "konflikt_klaeren";
  } else if (!validiert) {
    naechsterSchritt = "validierung_abschliessen";
  } else if (!aktuell) {
    naechsterSchritt = "erneut_bestaetigen";
  } else if (erinnern) {
    naechsterSchritt = "bald_bestaetigen";
  } else {
    naechsterSchritt = "keiner";
  }

  return {
    stufe,
    halbwertszeitTage: halbwertszeit,
    bezugAm: iso(bezug),
    letztesSignal: signal,
    haltbarBis: iso(bis),
    erinnerungAb: iso(erinnerungAb),
    erinnern,
    verantwortlich: responsibleOf(ko),
    verantwortlichArt: responsibleKindOf(ko),
    gesichert: validiert && !abgelaufen && keineAnforderung,
    aktuellerStand: validiert && aktuell && keineAnforderung,
    schutz,
    betriebsmodell: betriebsmodellFuer(schutz),
    inDokumente: validiert && aktuell && keineAnforderung && ohneKonflikt && schutz === "intern",
    naechsterSchritt,
    ungeprueft,
  };
}

/** Die Auskunft als Feld der Leseantwort — dieselbe Bauform wie `discloseDisplayStatus`. */
export function discloseFrische(
  ko: FrischeKo,
  jetztMs: number,
  eingaenge: FrischeEingaenge,
): { frische: FrischeAuskunft } {
  return { frische: frischeVon(ko, jetztMs, eingaenge) };
}
