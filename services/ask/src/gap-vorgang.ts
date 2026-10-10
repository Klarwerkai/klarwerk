import {
  type Confidentiality,
  type GelernteHalbwertszeiten,
  type KnowledgeObject,
  haltbarkeitAbgelaufen,
  responsibleOf,
} from "../../knowledge-object";
import {
  FALLBACK_NEEDED_VALIDATIONS,
  MAX_NEEDED_VALIDATIONS,
  MIN_NEEDED_VALIDATIONS,
} from "../../validation";
import type { BeanstandungSicht } from "./antwort-beanstandung";
import {
  AskError,
  type Gap,
  type GapAbschluss,
  type GapRuecknahmeGrund,
  type GapZuordnung,
} from "./types";

// ================================================================================================
// produkt:20261010:wissenskreislauf-schliessen — VON DER UNBEANTWORTETEN FRAGE BIS ZUR RÜCKMELDUNG.
// ================================================================================================
//
// WAS HIER STEHT: die reinen Regeln des gemeinsamen Vorgangs an EINER Lücke — wer daran beteiligt
// ist, in welcher Phase er steht, was als Nächstes zu tun ist und, vor allem, wann ein Wissenseintrag
// eine Lücke FACHLICH schliessen darf. Kein Zustand, kein Schreibweg, kein Zugriff auf Dienste: der
// `AskService` beschafft die Fakten (Objekt, Prüfstand, Sichtbarkeit), diese Datei entscheidet.
//
// WAS HIER AUSDRÜCKLICH NICHT ENTSTEHT: keine zweite Lücken-, Aufgaben-, Prüf- oder Meldungsverwaltung.
// Die Lücke bleibt die eine Lücke (Dublettenzählung `insertOrIncrement`), die Fachprüfung bleibt die
// Peer-Bewertung der Validierung (`ValidationService.pruefstandFuer`), und die Rückmeldung ist ein aus
// dem Lückenstand ABGELEITETER Eintrag der vorhandenen Glocke (`notification-feed.ts`).

/** Höchstlänge einer Rückfrage bzw. ihrer Antwort (Zeichen). */
export const RUECKFRAGE_MAX_ZEICHEN = 2000;

/** Rückfrage- bzw. Antworttext: getrimmt, nicht leer, nicht über dem Maß — sonst BAD_REQUEST. */
export function rueckfrageText(roh: unknown): string {
  const text = typeof roh === "string" ? roh.trim() : "";
  if (text.length === 0 || [...text].length > RUECKFRAGE_MAX_ZEICHEN) {
    throw new AskError(
      "BAD_REQUEST",
      `Der Text muss zwischen 1 und ${RUECKFRAGE_MAX_ZEICHEN} Zeichen lang sein.`,
    );
  }
  return text;
}

/**
 * Die Stimmenlage EINER Fassung — dieselbe Form wie `KoPruefstand.votes` der Validierung. Hier nur
 * gelesen; gezählt hat die Validierung (`stimmenAus`: nur Stimmen der übergebenen Fassung zählen).
 */
export interface GapPruefstand {
  readonly votes: { readonly up: number; readonly warn: number; readonly down: number };
}

/**
 * Warum ein Wissenseintrag eine Lücke (gerade) NICHT fachlich schliessen bzw. als Ergebnis tragen kann.
 * Maschinenlesbar; die Oberfläche übersetzt. Mehrere Gründe können zugleich gelten.
 */
export type NutzbarkeitsGrund =
  /** Kein Objekt unter dieser Kennung, oder es liegt im Papierkorb. */
  | "nicht_vorhanden"
  /** Der Betrachter darf das Objekt heute nicht sehen. Dann wird NICHTS weiter verraten. */
  | "kein_zugriff"
  /** Status ist nicht „validiert" — ein Entwurf oder eine KI-Prüfung ist keine Fachfreigabe. */
  | "nicht_freigegeben"
  /** Weniger grüne Stimmen der AKTUELLEN Fassung als verlangt (1–5). Alte Fassungen zählen nicht. */
  | "bewertungen_fehlen"
  /** Eine rote Stimme der aktuellen Fassung sperrt — auch nach einer Verwalter- oder Eigentümerfreigabe. */
  | "negative_bewertung"
  /** Die Haltbarkeit ist abgelaufen (`haltbarkeitAbgelaufen`). */
  | "abgelaufen"
  /** Schutzdaten-Quarantäne: das Objekt ist aus den Sucheinstiegen genommen. */
  | "quarantaene"
  /** Der Prüfstand liess sich nicht erheben — im Zweifel nicht nutzbar (fail-closed). */
  | "pruefstand_unbekannt";

export interface FachlicheNutzbarkeit {
  readonly nutzbar: boolean;
  readonly gruende: readonly NutzbarkeitsGrund[];
  /** Die geprüfte Fassung; `null` ohne Objekt oder ohne Zugriff. */
  readonly koVersion: number | null;
  /** Verlangte grüne Stimmen (1–5); `null` ohne Objekt oder ohne Zugriff. */
  readonly benoetigt: number | null;
  /** Grüne / rote Stimmen der AKTUELLEN Fassung; `null` ohne Prüfstand oder ohne Zugriff. */
  readonly gruen: number | null;
  readonly rot: number | null;
}

/**
 * Die verlangte Zahl grüner Stimmen — auf den Rahmen 1–5 der Validierung begrenzt. Ein unlesbarer
 * Altwert fällt auf den Standard der Validierung zurück, nie auf „eine Stimme genügt".
 */
export function benoetigteBewertungen(ko: Pick<KnowledgeObject, "neededValidations">): number {
  const n = ko.neededValidations;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return FALLBACK_NEEDED_VALIDATIONS;
  }
  return Math.min(MAX_NEEDED_VALIDATIONS, Math.max(MIN_NEEDED_VALIDATIONS, Math.ceil(n)));
}

/**
 * ============================================================================================
 * DIE EINE REGEL: TRÄGT DIESER WISSENSEINTRAG HEUTE ALS FACHLICHES ERGEBNIS?
 * ============================================================================================
 *
 * Gefragt beim fachlichen Abschluss (für die abschliessende Person), beim Ergebnisabruf und bei
 * jeder Rückmeldung (für den jeweiligen Fragenden) und bei der Wiederholungsfrage. Immer mit dem
 * FRISCH gelesenen Objekt und Prüfstand — nie mit einem gemerkten.
 *
 * Verlangt wird ALLES zugleich:
 *   · das Objekt existiert und liegt nicht im Papierkorb;
 *   · der Betrachter darf es heute sehen (fertige Entscheidung des Aufrufers, `sichtbarkeit.ts`);
 *   · Status „validiert";
 *   · mindestens `benoetigteBewertungen` grüne Stimmen DER AKTUELLEN FASSUNG und keine rote —
 *     dieselbe Regel wie `computeOutcome` (FR-VAL-02). Eine Verwalter- oder Eigentümerfreigabe setzt
 *     den Status, ersetzt aber nicht die vorgeschriebenen Bewertungen; Stimmen einer überholten
 *     Fassung zählen nicht (SCRUM-507 R2);
 *   · die Haltbarkeit ist nicht abgelaufen, und das Objekt steht nicht in Schutzdaten-Quarantäne.
 *
 * Darf der Betrachter das Objekt NICHT sehen, steht nur `kein_zugriff` da — Status, Stimmen und
 * Fassung eines fremden vertraulichen Objekts verlassen diese Funktion dann nicht.
 */
export function pruefeFachlicheNutzbarkeit(eingang: {
  readonly ko: KnowledgeObject | null | undefined;
  readonly pruefstand: GapPruefstand | null;
  readonly jetztMs: number;
  readonly gelernt?: GelernteHalbwertszeiten | undefined;
  readonly sichtbar: (ko: KnowledgeObject) => boolean;
}): FachlicheNutzbarkeit {
  const leer = { koVersion: null, benoetigt: null, gruen: null, rot: null };
  const { ko } = eingang;
  if (!ko || ko.deletedAt) {
    return { nutzbar: false, gruende: ["nicht_vorhanden"], ...leer };
  }
  if (!eingang.sichtbar(ko)) {
    return { nutzbar: false, gruende: ["kein_zugriff"], ...leer };
  }
  const gruende: NutzbarkeitsGrund[] = [];
  const benoetigt = benoetigteBewertungen(ko);
  if (ko.status !== "validiert") {
    gruende.push("nicht_freigegeben");
  }
  const votes = eingang.pruefstand?.votes ?? null;
  if (!votes) {
    gruende.push("pruefstand_unbekannt");
  } else {
    if (votes.up < benoetigt) {
      gruende.push("bewertungen_fehlen");
    }
    if (votes.down > 0) {
      gruende.push("negative_bewertung");
    }
  }
  if (ko.status === "validiert" && haltbarkeitAbgelaufen(ko, eingang.jetztMs, eingang.gelernt)) {
    gruende.push("abgelaufen");
  }
  if (ko.schutzdatenQuarantaene) {
    gruende.push("quarantaene");
  }
  return {
    nutzbar: gruende.length === 0,
    gruende,
    koVersion: ko.version,
    benoetigt,
    gruen: votes ? votes.up : null,
    rot: votes ? votes.down : null,
  };
}

/** Der Abschluss wurde verweigert — mit den maschinenlesbaren Gründen, nichts geschrieben. */
export class GapAbschlussVerweigert extends AskError {
  readonly gruende: readonly NutzbarkeitsGrund[];

  constructor(gruende: readonly NutzbarkeitsGrund[]) {
    super(
      "BAD_REQUEST",
      `Die Lücke bleibt offen: der Wissenseintrag ist (noch) kein nutzbares, fachlich freigegebenes Ergebnis (${gruende.join(", ")}).`,
    );
    this.gruende = gruende;
  }
}

// ================================================================================================
// WER AM VORGANG BETEILIGT IST.
// ================================================================================================

/** Alle Fragenden: der Ersteller zuerst, dann wer dieselbe offene Frage später stellte. */
export function fragendeVon(gap: Pick<Gap, "createdBy" | "weitereFragende">): string[] {
  const alle = [...(gap.createdBy ? [gap.createdBy] : []), ...(gap.weitereFragende ?? [])];
  return [...new Set(alle.filter((id) => id.length > 0))];
}

export function istFragender(
  gap: Pick<Gap, "createdBy" | "weitereFragende">,
  nutzerId: string,
): boolean {
  return nutzerId.length > 0 && fragendeVon(gap).includes(nutzerId);
}

export function istZustaendig(gap: Pick<Gap, "assignee">, nutzerId: string): boolean {
  return nutzerId.length > 0 && gap.assignee !== null && gap.assignee === nutzerId;
}

/**
 * Den Fragenden einer WIEDERHOLTEN Frage der offenen Lücke zuordnen — ohne Doppelte, ohne „system"
 * und ohne den Ersteller ein zweites Mal. Rein; die Ablage ruft sie unteilbar (`insertOrIncrement`).
 */
export function mitWeiteremFragenden(gap: Gap, nutzerId: string | undefined): Gap {
  if (!nutzerId || nutzerId === "system" || istFragender(gap, nutzerId)) {
    return gap;
  }
  return { ...gap, weitereFragende: [...(gap.weitereFragende ?? []), nutzerId] };
}

// ================================================================================================
// PHASE UND NÄCHSTER SCHRITT — AUS DEM TATSÄCHLICHEN STAND, NICHT AUS EINER VORLAGE.
// ================================================================================================

export type GapVorgangsphase =
  /** Offen, niemand ist zuständig. Das ist sichtbar — nicht stillschweigend „in Arbeit". */
  | "ohne_zustaendigkeit"
  /** Offen, die zuständige Person ist nicht mehr verfügbar oder nicht mehr berechtigt. */
  | "zustaendigkeit_nicht_verfuegbar"
  /** Offen, eine Rückfrage an die Fragenden ist unbeantwortet. */
  | "rueckfrage_offen"
  /** Offen, zuständig, noch kein Antwortentwurf verknüpft. */
  | "in_bearbeitung"
  /** Offen, ein Antwortentwurf ist verknüpft und noch kein nutzbares Ergebnis (Fachprüfung läuft). */
  | "in_fachpruefung"
  /** Offen, der verknüpfte Eintrag hat die Fachprüfung bestanden — der Abschluss steht aus. */
  | "bereit_zum_abschluss"
  /** Fachlich geschlossen mit nutzbarem Wissenseintrag. */
  | "geloest"
  /** Administrativ zurückgenommen — ausdrücklich KEIN fachliches Ergebnis. */
  | "zurueckgenommen"
  /** Eine Beanstandung, fachlich geprüft und begründet zurückgewiesen — die Aussage bleibt. */
  | "zurueckgewiesen"
  /** Geschlossen ohne festgehaltenen Abschluss (Altbestand von vor dieser Regel). */
  | "geschlossen_ohne_nachweis";

export type GapVorgangsrolle = "fragend" | "zustaendig" | "verwaltend";

export type GapNaechsterSchritt =
  | "zustaendigkeit_uebergeben"
  | "zustaendigkeit_zuordnen"
  | "neu_zuordnen"
  | "rueckfrage_beantworten"
  | "antwort_auf_rueckfrage_abwarten"
  | "antwortentwurf_erfassen"
  | "fachpruefung_abwarten"
  | "fachlich_abschliessen"
  | "bearbeitung_abwarten"
  | "ergebnis_lesen"
  | "erneut_fragen"
  | "begruendung_lesen"
  | "keiner";

export function vorgangsphase(
  gap: Pick<Gap, "status" | "assignee" | "rueckfragen" | "koId" | "abschluss">,
  fakten: {
    /** Ist die zuständige Person heute verfügbar und berechtigt? `null` = nicht erhoben. */
    readonly zustaendigVerfuegbar: boolean | null;
    /** Ist der verknüpfte Entwurf heute ein nutzbares Ergebnis? `null` = keiner verknüpft. */
    readonly entwurfNutzbar: boolean | null;
  },
): GapVorgangsphase {
  if (gap.status === "geschlossen") {
    if (gap.abschluss?.art === "fachlich") {
      return "geloest";
    }
    if (gap.abschluss?.art === "administrativ") {
      return "zurueckgenommen";
    }
    if (gap.abschluss?.art === "zurueckgewiesen") {
      return "zurueckgewiesen";
    }
    return "geschlossen_ohne_nachweis";
  }
  if (gap.assignee === null) {
    return "ohne_zustaendigkeit";
  }
  if (fakten.zustaendigVerfuegbar === false) {
    return "zustaendigkeit_nicht_verfuegbar";
  }
  if ((gap.rueckfragen ?? []).some((r) => r.antwort === undefined)) {
    return "rueckfrage_offen";
  }
  if (!gap.koId) {
    return "in_bearbeitung";
  }
  return fakten.entwurfNutzbar === true ? "bereit_zum_abschluss" : "in_fachpruefung";
}

/**
 * Der nächste Schritt für DIESEN Betrachter. Mehrere Rollen zugleich (die zuständige Person hat
 * selbst gefragt) — dann zählt die Rolle, die den Vorgang jetzt weiterbringt.
 */
export function naechsterSchritt(
  phase: GapVorgangsphase,
  rollen: readonly GapVorgangsrolle[],
): GapNaechsterSchritt {
  const zustaendig = rollen.includes("zustaendig");
  const verwaltend = rollen.includes("verwaltend");
  const fragend = rollen.includes("fragend");
  switch (phase) {
    case "ohne_zustaendigkeit":
      if (verwaltend) {
        return "zustaendigkeit_zuordnen";
      }
      return fragend ? "zustaendigkeit_uebergeben" : "keiner";
    case "zustaendigkeit_nicht_verfuegbar":
      if (verwaltend) {
        return "neu_zuordnen";
      }
      return fragend ? "zustaendigkeit_uebergeben" : "keiner";
    case "rueckfrage_offen":
      if (fragend) {
        return "rueckfrage_beantworten";
      }
      return zustaendig ? "antwort_auf_rueckfrage_abwarten" : "keiner";
    case "in_bearbeitung":
      return zustaendig ? "antwortentwurf_erfassen" : "bearbeitung_abwarten";
    case "in_fachpruefung":
      return zustaendig ? "fachpruefung_abwarten" : "bearbeitung_abwarten";
    case "bereit_zum_abschluss":
      return zustaendig || verwaltend ? "fachlich_abschliessen" : "bearbeitung_abwarten";
    case "geloest":
      return fragend ? "ergebnis_lesen" : "keiner";
    case "zurueckgenommen":
      return fragend ? "erneut_fragen" : "keiner";
    case "zurueckgewiesen":
      return fragend ? "begruendung_lesen" : "keiner";
    default:
      return "keiner";
  }
}

// ================================================================================================
// DIE VORGANGSSICHT — WAS EIN BETEILIGTER ÜBER „SEINEN" VORGANG ERFÄHRT.
// ================================================================================================
//
// Ausgeliefert NUR an Fragende, die zuständige Person und Verwaltende (`ko.assign`); allen anderen
// bleibt die Lücke so redigiert wie in der Liste (`redactGapForViewer`). Auch Beteiligte erfahren
// keine fremden Kennungen: wie viele weitere Personen fragten, ja — wer, nein. Eine Rückfrage zeigt
// „von mir beantwortet", nicht „von Person X".

/** Ein Wissenseintrag als Ergebnis bzw. Entwurf — nur wenn der Betrachter ihn heute sehen darf. */
export interface GapVorgangEintrag {
  readonly koId: string;
  readonly titel: string;
  readonly koVersion: number;
  readonly status: KnowledgeObject["status"];
  /** Die verantwortliche Person (`responsibleOf`) — Kennung; der Name kommt aus dem Verzeichnis. */
  readonly eigentuemer: string;
  readonly sichtbarkeit: Confidentiality | "intern";
  readonly spaceGebunden: boolean;
  readonly quellen: number;
  readonly nutzbarkeit: FachlicheNutzbarkeit;
}

export interface GapVorgangSicht {
  readonly id: string;
  readonly question: string;
  readonly status: Gap["status"];
  readonly phase: GapVorgangsphase;
  readonly rollen: readonly GapVorgangsrolle[];
  readonly naechsterSchritt: GapNaechsterSchritt;
  readonly zustaendig: { readonly id: string; readonly verfuegbar: boolean | null } | null;
  /** Wie viele Personen diese Frage gestellt haben (ohne Kennungen). */
  readonly fragende: number;
  readonly askCount: number | null;
  readonly zuordnungen: readonly Pick<GapZuordnung, "an" | "art" | "at">[];
  readonly rueckfragen: readonly {
    readonly id: string;
    readonly frage: string;
    readonly at: string;
    readonly antwort?: string;
    readonly beantwortetAm?: string;
    readonly vonMirBeantwortet?: boolean;
  }[];
  /** Der verknüpfte Antwortentwurf, solange die Lücke offen ist. `zugaenglich: false` ohne Recht. */
  readonly entwurf: GapVorgangEintrag | { readonly zugaenglich: false } | null;
  /** Das fachliche Ergebnis — FRISCH gegen heutige Rechte und Fachprüfung geprüft. */
  readonly ergebnis: GapVorgangEintrag | { readonly zugaenglich: false } | null;
  readonly abschluss:
    | { readonly art: "fachlich"; readonly at: string; readonly koVersion: number }
    | { readonly art: "administrativ"; readonly at: string; readonly grund: GapRuecknahmeGrund }
    | {
        readonly art: "zurueckgewiesen";
        readonly at: string;
        /** Leer für Betrachter ohne Textrecht (Verwaltende ohne eigene Rolle). */
        readonly begruendung: string;
        /** Die Quelle, auf die sich die Zurückweisung stützt — `null` ohne Zugriff oder ohne Quelle. */
        readonly koId: string | null;
        readonly koVersion: number | null;
      }
    | null;
  /**
   * produkt:20261010:antwort-beanstandung-korrektur: nur, wenn die Lücke eine beanstandete Aussage
   * ist — und nur der zulässige Kontext dieses Betrachters (`beanstandungSicht`).
   */
  readonly beanstandung?: BeanstandungSicht;
}

/** Ein Wissenseintrag als Vorgangsauskunft — nur aus einer bereits erteilten Sichtfreigabe. */
export function vorgangEintrag(
  ko: KnowledgeObject,
  nutzbarkeit: FachlicheNutzbarkeit,
): GapVorgangEintrag {
  return {
    koId: ko.id,
    titel: ko.title,
    koVersion: ko.version,
    status: ko.status,
    eigentuemer: responsibleOf(ko),
    sichtbarkeit: ko.confidentiality ?? "intern",
    spaceGebunden: typeof ko.spaceId === "string" && ko.spaceId.length > 0,
    quellen: ko.sources.length,
    nutzbarkeit,
  };
}

export function abschlussSicht(
  abschluss: GapAbschluss | undefined,
  zurueckweisung: {
    readonly textBerechtigt: boolean;
    readonly siehtObjekt: (koId: string) => boolean;
  } = { textBerechtigt: true, siehtObjekt: () => true },
): GapVorgangSicht["abschluss"] {
  if (!abschluss) {
    return null;
  }
  if (abschluss.art === "zurueckgewiesen") {
    const zugaenglich = abschluss.koId !== null && zurueckweisung.siehtObjekt(abschluss.koId);
    return {
      art: "zurueckgewiesen",
      at: abschluss.at,
      begruendung: zurueckweisung.textBerechtigt ? abschluss.begruendung : "",
      koId: zugaenglich ? abschluss.koId : null,
      koVersion: zugaenglich ? abschluss.koVersion : null,
    };
  }
  return abschluss.art === "fachlich"
    ? { art: "fachlich", at: abschluss.at, koVersion: abschluss.koVersion }
    : { art: "administrativ", at: abschluss.at, grund: abschluss.grund };
}

/** Die Kennung der Rückmeldung „Beanstandung zurückgewiesen" — je Vorgang genau einmal. */
export function zurueckweisungMeldungId(gapId: string): string {
  return `gaprej-${gapId}`;
}

/**
 * Die Kennung der Abschlussmeldung je Lücke, Wissenseintrag und Fassung. Sie ist DETERMINISTISCH:
 * dieselbe Lücke, derselbe Abschluss erzeugt für jeden Fragenden genau einen Eintrag — eine
 * Wiederholung, ein Neustart oder ein zweites Schliessen kann keine zweite Meldung erzeugen.
 */
export function abschlussMeldungId(gapId: string, koId: string, koVersion: number): string {
  return `gapdone-${gapId}-${koId}-v${koVersion}`;
}

/** Die Kennung der Rückfrage-Meldung — je Rückfrage genau einmal. */
export function rueckfrageMeldungId(gapId: string, rueckfrageId: string): string {
  return `gapask-${gapId}-${rueckfrageId}`;
}
