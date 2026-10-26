import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { mitModellKontext } from "../../reasoner";
import type { KlaraAufgabeRepo } from "./klara-aufgabe";
import {
  type LokaleZeit,
  SOMMERZEIT_VORGABE,
  type SommerzeitRegel,
  VORKOMMEN_HOECHSTENS,
  type Wiederholung,
  type Wochentag,
  type ZeitHinweis,
  type Zeitplan,
  deuteZeitangabe,
  istDatum,
  istUhrzeit,
  istZeitzone,
  loeseMitRegel,
  lokalVon,
  nominaleVorkommen,
  plusTage,
  vorkommenId,
  wochentagVon,
} from "./klara-erinnerung-zeit";
import type { KlaraGespraechRepo, KlaraObjektbezug } from "./klara-gespraech";
import type { NormFolgeversuch, NormVorbereitung } from "./klara-normvorbereitung-typen";
import {
  type KlaraNotiz,
  type KlaraNotizAenderung,
  type KlaraNotizEingabe,
  KlaraNotizFehler,
  type KlaraNotizRepo,
  type NotizSchreibbedingung,
} from "./klara-notiz";
import {
  type BerichtQuelle,
  type BerichtTeil,
  FESTE_NOTIZEN_TITEL,
  type KlaraRoutine,
  type KlaraRoutineErgebnis,
  ROUTINE_EINTRAEGE_MAX,
  ROUTINE_RUECKBLICK_TAGE,
  RoutineEingabeFehler,
  type RoutinenAenderung,
  abschnittTitel,
  abschnittVonTitel,
  berichtText,
  deuteRoutinenAenderung,
  ergebnisAusBericht,
  ergebnisVorgang,
  notizEintrag,
  routineAus,
} from "./klara-routine";
import {
  type GelesenePflegeQuelle,
  type PflegeErgebnis,
  type PflegeLeser,
  bereiteWissenspflegeVor,
  pflegeAusgangsstand,
  pflegeVorgang,
} from "./klara-wissenspflege";

// ================================================================================================
// produkt:20261007:klara-erinnerungen-kalender (Klara 10 · AW-18) — PERSÖNLICHE ERINNERUNGEN, DIE
// AUCH OHNE OFFENES GESPRÄCH ANKOMMEN.
// ================================================================================================
//
// DREI ABLAGEN, EINE STEUERUNG AUSSERHALB DES MODELLS:
//   · `klara_erinnerungen`        — der versionierte Auftrag (Ziel, Zeitplan, IANA-Zeitzone,
//                                   Sommerzeit- und Verpasst-Regel, Bezug, Status, Ausnahmen je
//                                   Vorkommen) samt Steuerstand: bis wohin bearbeitet, nächste
//                                   Fälligkeit. Der Steuerstand ist KEIN Teil der Fassung — die
//                                   Steuerung schreibt ihn, ohne eine Bearbeitung zu überschreiben.
//   · `klara_erinnerung_laeufe`   — genau eine Zeile je Vorkommen (`vorkommen_id` = Erinnerung +
//                                   nominale lokale Zeit) mit Status, Versuch, Besitzer und
//                                   befristeter Laufberechtigung (`lease_bis`). Die Übernahme ist
//                                   EIN Datenbankbefehl: wer die Zeile nicht bekommt, wirkt nicht.
//   · `klara_erinnerung_meldungen`— die tatsächliche Wirkung: die Meldung in der Glocke der Person,
//                                   mit FESTER Kennung je Vorkommen. Sie wird angelegt oder nicht —
//                                   nie zweimal.
//
// ABSTURZ ZWISCHEN WIRKUNG UND BESTÄTIGUNG (AW18-K06): Wer einen Lauf ein zweites Mal übernimmt
// (Versuch > 1), liest ZUERST zurück, ob die Meldung schon da ist. Ist sie da, wird der Lauf mit
// diesem Beleg abgeschlossen — keine zweite Meldung. Lässt sich das nicht feststellen, bleibt der
// Lauf `unklar` und wartet auf eine Entscheidung der Person; es gibt kein unbelegtes „genau einmal".
//
// RECHTE VOR JEDER WIRKUNG (AW18-K08/K09, Nacharbeit 2): Unmittelbar vor JEDER Meldung — auch jeder
// Sammelmeldung und jedem wiederaufgenommenen Lauf — liest die Steuerung die Erinnerung NEU
// (Status, Ausnahme des Termins, Fassung), das Konto der empfangenden Person HEUTE (vorhanden,
// freigegeben, Zugang nicht abgelaufen) und — solange nicht bewusst anders entschieden — ob die
// eigene Quelle noch besteht. Es gibt keinen gespeicherten Diensttoken. Die Meldung wird dann NUR
// geschrieben, wenn die Erinnerung in genau dieser Fassung noch aktiv ist (`schreibe` mit
// Bedingung; in PostgreSQL ein Befehl mit `FOR SHARE` auf die Erinnerungszeile). Eine Pause, Absage,
// Erledigung oder Terminänderung, die vorher bestätigt wurde, verhindert die Wirkung damit
// zuverlässig — auch wenn sie zwischen zwei Zustellungen desselben Takts oder unmittelbar vor dem
// Schreiben kam. Fehlt die Quelle, wartet NUR dieser Lauf auf „fortführen" oder „beenden" (Peters
// P07); das Schließen eines Dialogs ist keine Entscheidung.
//
// PERSÖNLICH: Jede Erinnerung gehört genau einem Konto (Eigentümer). Fremd und unbekannt antworten
// gleich (404), auch für Administratoren. Eine BEWUSSTE ÜBERGABE (AW18-K08) macht eine andere,
// heute aktive Person zur Zuständigen und Empfängerin — nur für reine Erinnerungen (Aktion
// `erinnern`): sie sieht Titel und Termin, nie Notiz, Bezug oder Quellinhalt. Ihre Rechte gelten
// HEUTE, vor jeder Wirkung.
//
// BESTELLTE ZUSAMMENFASSUNG (AW-18 Nutzerfall): Aktion `inhalt_zusammenfassen` fasst zum Termin die
// EIGENE Quelle (Notiz, Aufgabe, Gesprächsnachricht) über den vorhandenen KI-Weg zusammen
// (`ReasonerService.assistText`, vertraulich — die zentrale KI-Freigabe entscheidet über den
// Anbieter). Das Ergebnis steht dauerhaft an Meldung und Lauf. Fällt die KI aus, kommt die
// Erinnerung trotzdem — der Lauf ist dann `teilweise` (AW18-K07).
//
// BEWUSST NICHT HIER: Kalenderprojektion (eigene folgende Lieferung), E-Mail/Push als Ziel.
//
// KALENDERSPERRE JE VORKOMMEN (produkt:20261008:klara-kalender, P07-AC05/AC06, AW17-K05): Die
// Kalenderanbindung führt je Vorkommen (`vorkommen_id` = Auftrag + nominale Zeit) eine dauerhafte
// Sperre — etwa nach externer Löschung bis zur ausdrücklichen Entscheidung. Die Steuerung fragt sie
// (`vorkommenSperre`) unmittelbar vor JEDER Wirkung ab, in derselben Prüfung wie Konto und Quelle.
// `pausiert`: NUR dieser Lauf wartet („unklar“, Grund `kalender_pausiert`) — andere Vorkommen und
// der Status der Erinnerung bleiben unberührt. `beendet`: dieser Lauf endet ohne Wirkung. Nicht
// lesbar: keine Wirkung, der Lauf scheitert sichtbar und wird begrenzt wieder aufgenommen.

export const KLARA_ERINNERUNG_BEREICH = "persoenlich" as const;
/** Der einzige Benachrichtigungsweg dieser Lieferung: die vorhandene Glocke (`/api/notifications`). */
export const KLARA_ERINNERUNG_ZIEL = "glocke" as const;

export type KlaraErinnerungStatus = "aktiv" | "pausiert" | "erledigt" | "abgesagt" | "beendet";
export type VerpasstRegel = "nachholen" | "nur_melden" | "zusammenfassen" | "ueberspringen";
export type KlaraErinnerungAktion =
  | "erinnern"
  | "aufgabe_pruefen"
  | "inhalt_zusammenfassen"
  /** EQF-07: eine persönliche Routine — legt zum Termin einen Bericht in „Meine Notizen“ an. */
  | "routine_bericht";

export const VERPASST_REGELN: readonly VerpasstRegel[] = [
  "nachholen",
  "nur_melden",
  "zusammenfassen",
  "ueberspringen",
];
const AKTIONEN: readonly KlaraErinnerungAktion[] = [
  "erinnern",
  "aufgabe_pruefen",
  "inhalt_zusammenfassen",
  "routine_bericht",
];

/** Höchstlänge des Quelltexts, der in eine bestellte Zusammenfassung geht. */
export const KLARA_ERINNERUNG_ZUSAMMENFASSUNG_QUELLE_MAX = 8_000;
/** Höchstlänge der gespeicherten Zusammenfassung. */
export const KLARA_ERINNERUNG_ZUSAMMENFASSUNG_MAX = 4_000;

/** Wem eine Erinnerung bewusst übergeben wurde (AW18-K08). */
export interface KlaraErinnerungZustaendig {
  readonly kontoId: string;
  readonly seit: string;
  /** Wer übergeben hat — der Eigentümer. */
  readonly von: string;
}

/** Das Ergebnis einer bestellten Zusammenfassung — dauerhaft an Meldung und Lauf. */
export interface ErinnerungQuellenStand {
  readonly art: "notiz" | "aufgabe" | "gespraech";
  readonly kontoId: string;
  readonly id: string;
  readonly fassung: number;
}

export type KlaraErinnerungZusammenfassung = (
  | { readonly status: "erstellt"; readonly text: string; readonly ki: boolean }
  | { readonly status: "nicht_verfuegbar" }
) & { readonly quelleStand?: ErinnerungQuellenStand };

export type KlaraErinnerungBezug =
  | { readonly art: "frei" }
  | {
      readonly art: "gespraech";
      readonly gespraechId: string;
      readonly nachrichtId: string;
      readonly auszug: string;
    }
  | { readonly art: "notiz"; readonly notizId: string; readonly notizTitel: string }
  | { readonly art: "aufgabe"; readonly aufgabeId: string; readonly aufgabeTitel: string };

export type KlaraErinnerungAusnahme =
  | { readonly art: "abgesagt"; readonly am: string }
  | { readonly art: "erledigt"; readonly am: string }
  | {
      readonly art: "verschoben";
      readonly datum: string;
      readonly uhrzeit: string;
      readonly am: string;
    };

export interface KlaraErinnerungVerpasst {
  readonly regel: VerpasstRegel;
  /** Bis zu so vielen Minuten nach dem Termin gilt eine Zustellung als rechtzeitig (Grenzzeit). */
  readonly grenzeMinuten: number;
}

export interface KlaraErinnerung {
  readonly id: string;
  /** Eigentümer — und Empfänger, solange nicht bewusst übergeben. */
  readonly kontoId: string;
  /** Bewusste Übergabe: zuständige Person und Empfängerin der Meldungen (sonst der Eigentümer). */
  readonly zustaendig?: KlaraErinnerungZustaendig | null;
  readonly vorgang: string;
  readonly bereich: typeof KLARA_ERINNERUNG_BEREICH;
  readonly titel: string;
  readonly notiz: string;
  readonly bezug: KlaraErinnerungBezug;
  readonly objektbezug: KlaraObjektbezug | null;
  /** Bei Quellenbezug: [] = geprüft frei, fehlend = ungeprüfter Altstand; keine Rollenfreigabe. */
  readonly wissensQuellen?: readonly string[];
  readonly zeitzone: string;
  readonly zeitplan: Zeitplan;
  readonly sommerzeit: SommerzeitRegel;
  readonly verpasst: KlaraErinnerungVerpasst;
  readonly aktion: KlaraErinnerungAktion;
  /** EQF-07: die versionierte Funktionsdefinition — nur bei `routine_bericht`. */
  readonly routine?: KlaraRoutine | null;
  readonly ziel: typeof KLARA_ERINNERUNG_ZIEL;
  readonly status: KlaraErinnerungStatus;
  /** Je nominalem Vorkommen (`YYYY-MM-DDTHH:MM`) die Einzeländerung. */
  readonly ausnahmen: Readonly<Record<string, KlaraErinnerungAusnahme>>;
  /** Die Person hat bewusst entschieden, trotz fehlender Quelle fortzufahren. */
  readonly quelleFehltAkzeptiert: boolean;
  /** Bei „diese und folgende Termine ändern": woraus diese Serie hervorging. */
  readonly serieVon: { readonly erinnerungId: string; readonly ab: string } | null;
  readonly angelegtAm: string;
  readonly geaendertAm: string;
  readonly fassung: number;
}

/** Der Steuerstand — nur von Dienst (bei Bearbeitung) und Steuerung geschrieben, nie vom Browser. */
export interface KlaraErinnerungSteuer {
  /** Alle Vorkommen bis einschließlich dieses Zeitpunkts sind bearbeitet (ms) — oder `null`. */
  readonly bearbeitetBis: number | null;
  /** Die nächste noch nicht bearbeitete Fälligkeit (ms) — oder `null`, wenn keine mehr kommt. */
  readonly naechste: number | null;
}

export interface KlaraErinnerungEintrag {
  readonly erinnerung: KlaraErinnerung;
  readonly steuer: KlaraErinnerungSteuer;
}

export type KlaraErinnerungLaufStatus =
  | "laeuft"
  | "zugestellt"
  | "teilweise"
  | "verpasst_gemeldet"
  | "zusammengefasst"
  | "uebersprungen"
  | "fehlgeschlagen"
  | "unklar"
  | "gestoppt"
  | "abgebrochen";

export type KlaraErinnerungLaufArt = "erinnerung" | "verpasst" | "sammel" | "uebersprungen";

export interface KlaraErinnerungLauf {
  readonly vorkommenId: string;
  readonly erinnerungId: string;
  readonly kontoId: string;
  /** Der wirksame Zeitpunkt des Vorkommens (ISO). */
  readonly geplantFuer: string;
  readonly status: KlaraErinnerungLaufStatus;
  readonly versuch: number;
  readonly besitzer: string | null;
  readonly leaseBis: string | null;
  readonly aktualisiertAm: string;
  readonly art: KlaraErinnerungLaufArt;
  /** Die feste Kennung der Meldung, die dieser Lauf erzeugt (oder erzeugt hat). */
  readonly meldungId: string;
  readonly ergebnis: {
    readonly zugestelltAm?: string;
    readonly nachgeholt?: boolean;
    readonly verspaetetMinuten?: number;
    readonly pruefung?: KlaraErinnerungPruefung;
    readonly grund?: KlaraErinnerungLaufGrund;
    readonly dedupliziert?: boolean;
    readonly hinweis?: ZeitHinweis;
    readonly zusammenfassung?: KlaraErinnerungZusammenfassung;
    /** Wer die Meldung bekommen hat — gesetzt, wenn es nicht der Eigentümer war (Übergabe). */
    readonly empfaenger?: string;
    /** EQF-07: das tatsächliche Ergebnis der Routine (Bericht, Fassungen, offener Rest). */
    readonly routine?: KlaraRoutineErgebnis;
    readonly wissenspflege?: PflegeErgebnis;
    /** Vor einer Pflegewirkung festgehaltene echte Readback-Schlüssel, kein Erfolgssiegel. */
    readonly pflegeNotizVorgang?: string;
    readonly pflegeMeldungId?: string;
    readonly pflegeRoutineFassung?: number;
  };
}

export type KlaraErinnerungLaufGrund =
  | "konto_gesperrt"
  | "quelle_geloescht"
  | "quelle_unlesbar"
  | "zustellung_gescheitert"
  | "readback_unmoeglich"
  | "abbruch"
  | "verworfen"
  /** Die Erinnerung wurde vor der Wirkung pausiert, abgesagt, erledigt, beendet oder gelöscht. */
  | "status_geaendert"
  /** Dieser Termin wurde vor der Wirkung abgesagt, erledigt oder aus dem Zeitplan genommen. */
  | "termin_geaendert"
  /** EQF-07: eine gelesene Routinenquelle wurde vor dem Schreiben geändert oder gelöscht. */
  | "quelle_geaendert"
  /** EQF-07: der Bericht wurde inzwischen von der Person bearbeitet — er wird nicht überschrieben. */
  | "bericht_geaendert"
  /** Klara 11: dieses Vorkommen ist in der Kalenderanbindung bis zur Entscheidung pausiert. */
  | "kalender_pausiert"
  /** Klara 11: dieses Vorkommen wurde in der Kalenderanbindung ausdrücklich beendet. */
  | "kalender_beendet"
  /** Klara 11: die Sperre der Kalenderanbindung war nicht lesbar — keine Wirkung. */
  | "kalender_unlesbar";

/** Klara 11: die Sperre eines Vorkommens aus der Kalenderanbindung (`vorkommenSperre`). */
export type KlaraErinnerungVorkommenSperre = "frei" | "pausiert" | "beendet";

export type KlaraErinnerungPruefung =
  | { readonly art: "aufgabe"; readonly status: "offen" | "erledigt" | "nicht_gefunden" }
  | { readonly art: "aufgabe"; readonly status: "nicht_verfuegbar" };

export type KlaraErinnerungMeldungArt =
  | "erinnerung"
  | "verpasst"
  | "zusammenfassung"
  | "uebersprungen"
  /** EQF-07-K09: eine Routine kam nicht zum Ergebnis — Handlung bzw. Klärung nötig. */
  | "handlung";

/** Die tatsächliche Wirkung: eine Meldung in der Glocke genau dieses Kontos. */
export interface KlaraErinnerungMeldung {
  readonly id: string;
  readonly kontoId: string;
  readonly erinnerungId: string;
  readonly art: KlaraErinnerungMeldungArt;
  readonly titel: string;
  readonly zugestelltAm: string;
  /** Die geplanten Zeitpunkte der erfassten Vorkommen (ISO). */
  readonly vorkommen: readonly string[];
  readonly nachgeholt: boolean;
  readonly pruefung: KlaraErinnerungPruefung | null;
  /** Bestellte Zusammenfassung — fehlt bei älteren Meldungen und anderen Aktionen. */
  readonly zusammenfassung?: KlaraErinnerungZusammenfassung | null;
  /** EQF-07: das tatsächliche Routinenergebnis — die Meldung zeigt es, nicht den geplanten Lauf. */
  readonly routine?: KlaraRoutineErgebnis | null;
  /** Nur bei `handlung`: warum kein Ergebnis entstand. */
  readonly grund?: KlaraErinnerungLaufGrund;
  /** Der Laufstatus, mit dem ein Readback den Lauf abschließt. */
  readonly laufStatus: KlaraErinnerungLaufStatus;
}

/** Heutige vorhandene Quellrechte, niemals eine gespeicherte Freigabe. */
export interface ErinnerungQuellfreigabe extends NotizSchreibbedingung {
  readonly koIds: readonly string[];
  /** Positiv geprüfte freie Herkunft, nicht bloß eine leere Liste bekannter KO-IDs. */
  readonly quelleFrei?: true;
  readonly nochAktuell: () => Promise<boolean>;
}

export type ErinnerungQuellschutz = (
  erinnerung: KlaraErinnerung,
  betrachterId: string,
  meldung?: KlaraErinnerungMeldung,
) => Promise<ErinnerungQuellfreigabe | null>;

/** Ein vorhandener Sammelbeleg gilt nur für die tatsächlich darin gespeicherten Vorkommen. */
function umfasstMeldung(beleg: KlaraErinnerungMeldung, neu: KlaraErinnerungMeldung): boolean {
  return (
    beleg.kontoId === neu.kontoId &&
    beleg.erinnerungId === neu.erinnerungId &&
    beleg.art === neu.art &&
    neu.vorkommen.every((v) => beleg.vorkommen.includes(v))
  );
}

/** Ergebnis eines bedingten Schreibens der Meldung. */
export type MeldungSchreibergebnis =
  /** Neu angelegt — die Erinnerung war in genau dieser Fassung aktiv. */
  | "geschrieben"
  /** Die Meldung mit dieser Kennung gab es schon (Dedup); nichts geschrieben. */
  | "vorhanden"
  /** Die Erinnerung ist nicht mehr in dieser Fassung aktiv; nichts geschrieben. */
  | "veraltet";

/** Die persönlichen Vorgaben aus dem Einrichtungsassistenten (P07: Zeitzonenwahl, erneut aufrufbar). */
export interface KlaraErinnerungEinstellungen {
  readonly kontoId: string;
  /** Die eigene IANA-Zeitzone — `null`: noch nicht gewählt (Vorschlag ist die des Geräts). */
  readonly zeitzone: string | null;
  readonly sommerzeit: SommerzeitRegel;
  readonly verpasst: KlaraErinnerungVerpasst;
  /** Wann der Assistent zuletzt abgeschlossen wurde — `null`: nie (freiwillig). */
  readonly eingerichtetAm: string | null;
  readonly fassung: number;
  readonly geaendertAm: string;
}

export const KLARA_ERINNERUNG_TITEL_MAX = 200;
export const KLARA_ERINNERUNG_NOTIZ_MAX = 5_000;
export const KLARA_ERINNERUNG_MAX_JE_KONTO = 500;
export const KLARA_ERINNERUNG_GRENZE_VORGABE = 30;
export const KLARA_ERINNERUNG_GRENZE_MAX = 1_440;
/** Befristete Laufberechtigung: so lange gehört ein Lauf dem Prozess, der ihn übernommen hat. */
export const KLARA_ERINNERUNG_LEASE_MS = 120_000;
export const KLARA_ERINNERUNG_MAX_VERSUCHE = 5;
/** Höchstens so viele Vorkommen je Erinnerung und Lauf — der Rest folgt im nächsten Takt. */
export const KLARA_ERINNERUNG_JE_LAUF = 500;
const VORGANG_RE = /^[A-Za-z0-9_-]{8,100}$/;
const ID_RE = /^[A-Za-z0-9_.:@-]{1,200}$/;

export function nominalSchluessel(l: LokaleZeit): string {
  return `${l.datum}T${l.uhrzeit}`;
}

function lokalAusSchluessel(s: string): LokaleZeit | null {
  const [datum, uhrzeit] = s.split("T");
  return istDatum(datum) && istUhrzeit(uhrzeit) ? { datum, uhrzeit } : null;
}

// ------------------------------------------------------------------------------------------------
// VORKOMMEN — nominal, mit Ausnahme und Sommerzeitregel aufgelöst.
// ------------------------------------------------------------------------------------------------

export interface KlaraErinnerungVorkommen {
  readonly id: string;
  readonly schluessel: string;
  /** Der wirksame Zeitpunkt (ms) — `null`, wenn ausgelassen (Sommerzeitlücke, Regel „auslassen"). */
  readonly ms: number | null;
  readonly lokal: LokaleZeit;
  readonly hinweis: ZeitHinweis | null;
  readonly ausnahme: KlaraErinnerungAusnahme | null;
}

/** Was die Vorkommensrechnung von einer Erinnerung braucht (auch für die Vorschau ohne Ablage). */
export type KlaraErinnerungPlan = Pick<
  KlaraErinnerung,
  "id" | "zeitplan" | "zeitzone" | "sommerzeit" | "ausnahmen"
>;

const ZWEI_TAGE_MS = 2 * 86_400_000;

function aufgeloest(e: KlaraErinnerungPlan, nominal: LokaleZeit): KlaraErinnerungVorkommen {
  const schluessel = nominalSchluessel(nominal);
  const ausnahme = e.ausnahmen[schluessel] ?? null;
  const lokal =
    ausnahme?.art === "verschoben" ? { datum: ausnahme.datum, uhrzeit: ausnahme.uhrzeit } : nominal;
  const r = loeseMitRegel(lokal, e.zeitzone, e.sommerzeit);
  return {
    id: vorkommenId(e.id, nominal),
    schluessel,
    ms: r.ms,
    lokal,
    hinweis: r.hinweis,
    ausnahme,
  };
}

/**
 * Die Vorkommen in nominaler Reihenfolge. `von`: Vorkommen deutlich davor (mehr als zwei Tage)
 * werden gar nicht erst aufgelöst. `stoppNach` + `kuenftig`: nach so vielen regulären Vorkommen
 * hinter `stoppNach` endet die Rechnung — einzeln verschobene Termine dahinter kommen trotzdem mit.
 */
export function vorkommenVon(
  e: KlaraErinnerungPlan,
  o: { von?: number | null; stoppNach?: number | null; kuenftig?: number } = {},
): KlaraErinnerungVorkommen[] {
  const vonDatum =
    o.von === undefined || o.von === null
      ? null
      : new Date(o.von - ZWEI_TAGE_MS).toISOString().slice(0, 10);
  const stopp = o.stoppNach ?? null;
  const kuenftig = o.kuenftig ?? Number.POSITIVE_INFINITY;
  const aus: KlaraErinnerungVorkommen[] = [];
  let dahinter = 0;
  let abgebrochenNach: string | null = null;
  for (const nominal of nominaleVorkommen(e.zeitplan)) {
    const schluessel = nominalSchluessel(nominal);
    const ausnahme = e.ausnahmen[schluessel];
    const datum = ausnahme?.art === "verschoben" ? ausnahme.datum : nominal.datum;
    if (vonDatum !== null && datum < vonDatum) {
      continue;
    }
    const v = aufgeloest(e, nominal);
    aus.push(v);
    if (stopp !== null && v.ms !== null && v.ms > stopp && v.ausnahme === null) {
      dahinter += 1;
      if (dahinter >= kuenftig) {
        abgebrochenNach = schluessel;
        break;
      }
    }
  }
  if (abgebrochenNach !== null) {
    for (const [schluessel, a] of Object.entries(e.ausnahmen)) {
      const lokal = lokalAusSchluessel(schluessel);
      if (a.art === "verschoben" && schluessel > abgebrochenNach && lokal) {
        aus.push(aufgeloest(e, lokal));
      }
    }
  }
  return aus;
}

/** Ein Vorkommen über seinen nominalen Schlüssel — ohne die übrigen aufzulösen. */
export function findeVorkommen(
  e: KlaraErinnerungPlan,
  schluessel: string,
): { vorkommen: KlaraErinnerungVorkommen; index: number } | null {
  let index = 0;
  for (const nominal of nominaleVorkommen(e.zeitplan)) {
    if (nominalSchluessel(nominal) === schluessel) {
      return { vorkommen: aufgeloest(e, nominal), index };
    }
    if (nominal.datum > schluessel.slice(0, 10)) {
      return null;
    }
    index += 1;
  }
  return null;
}

/** Zu bearbeiten ist, was einen Zeitpunkt hat und weder abgesagt noch einzeln erledigt ist. */
function istZuBearbeiten(
  v: KlaraErinnerungVorkommen,
): v is KlaraErinnerungVorkommen & { ms: number } {
  return v.ms !== null && v.ausnahme?.art !== "abgesagt" && v.ausnahme?.art !== "erledigt";
}

/** Die nächste noch nicht bearbeitete Fälligkeit nach `bearbeitetBis`. */
export function naechsteFaelligkeit(
  e: KlaraErinnerungPlan,
  bearbeitetBis: number | null,
): number | null {
  let best: number | null = null;
  for (const v of vorkommenVon(e, { von: bearbeitetBis, stoppNach: bearbeitetBis, kuenftig: 1 })) {
    if (istZuBearbeiten(v) && (bearbeitetBis === null || v.ms > bearbeitetBis)) {
      if (best === null || v.ms < best) {
        best = v.ms;
      }
    }
  }
  return best;
}

/**
 * Nacharbeit 12: der Zeitplan einer Serie, die VOR dem Termin `ab` endet (Serienteilung) — oder
 * `null`, wenn die Serie diesen Termin nicht (mehr) hat, also schon begrenzt ist.
 */
function serieBisVor(e: KlaraErinnerung, ab: string): Zeitplan | null {
  if (e.zeitplan.art !== "serie") {
    return null;
  }
  const lokal = lokalAusSchluessel(ab);
  const treffer = findeVorkommen(e, ab);
  if (!lokal || !treffer) {
    return null;
  }
  const w = e.zeitplan.wiederholung;
  return {
    ...e.zeitplan,
    wiederholung: {
      ...w,
      bis: plusTage(lokal.datum, -1),
      anzahl: w.anzahl === null ? null : treffer.index,
    },
  };
}

/** Eine Darstellung unabhängig von der Schlüsselreihenfolge (PostgreSQL-`jsonb` ordnet um). */
function stabil(x: unknown): string {
  if (Array.isArray(x)) {
    return `[${x.map(stabil).join(",")}]`;
  }
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stabil(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(x) ?? "null";
}

/**
 * Nacharbeit 16 (Ben): ist die bisherige Serie TATSÄCHLICH durch diese Teilung begrenzt? Nachweis
 * über den gespeicherten Plan: er muss genau der Plan sein, den die Teilung (bzw. die Steuerung,
 * die sie nachholt) aus der gesehenen Serie schreibt. Ein Schlüssel, der nur durch eine FREMDE
 * Planänderung (z. B. andere Uhrzeit) entfallen ist, ist kein Nachweis, sondern ein Konflikt.
 */
function durchTeilungBegrenzt(
  gesehen: KlaraErinnerung,
  jetzt: KlaraErinnerung,
  schluessel: string,
): boolean {
  const erwartet = serieBisVor(gesehen, schluessel);
  return erwartet !== null && stabil(jetzt.zeitplan) === stabil(erwartet);
}

/**
 * Nacharbeit 13 (Ben, AW18-K09): die Einzelzustände (abgesagt, erledigt, verschoben) der Termine
 * AB `ab` einer Serie, übertragen auf einen neuen Zeitplan. Eindeutige Zuordnung über die Reihenfolge:
 * der k-te Termin ab `ab` der bisherigen Serie entspricht dem k-ten Termin des neuen Plans — bei
 * unverändertem Rhythmus also demselben Termin. Ein Termin, den der neue Plan nicht mehr hat, hat
 * auch keinen Einzelzustand mehr. `e` ist die Serie VOR ihrer Begrenzung. `planAb`: gezählt wird im
 * neuen Plan erst ab diesem Schlüssel (Folgeserie: von Anfang an).
 */
function folgeAusnahmen(
  e: KlaraErinnerung,
  ab: string,
  plan: Zeitplan,
  planAb = "",
): Record<string, KlaraErinnerungAusnahme> {
  const schluessel = Object.keys(e.ausnahmen)
    .filter((k) => k >= ab)
    .sort();
  const letzter = schluessel[schluessel.length - 1];
  if (letzter === undefined || e.zeitplan.art !== "serie") {
    return {};
  }
  const jeRang = new Map<number, KlaraErinnerungAusnahme>();
  let rang = 0;
  for (const nominal of nominaleVorkommen(e.zeitplan)) {
    const s = nominalSchluessel(nominal);
    if (s > letzter) {
      break;
    }
    if (s >= ab) {
      const a = e.ausnahmen[s];
      if (a) {
        jeRang.set(rang, a);
      }
      rang += 1;
    }
  }
  const hoechster = Math.max(-1, ...jeRang.keys());
  const ergebnis: Record<string, KlaraErinnerungAusnahme> = {};
  let k = 0;
  for (const nominal of nominaleVorkommen(plan)) {
    if (k > hoechster) {
      break;
    }
    const s = nominalSchluessel(nominal);
    if (s < planAb) {
      continue;
    }
    const a = jeRang.get(k);
    if (a) {
      ergebnis[s] = a;
    }
    k += 1;
  }
  return ergebnis;
}

function steuerNach(e: KlaraErinnerung, bearbeitetBis: number | null): KlaraErinnerungSteuer {
  return {
    bearbeitetBis,
    naechste: e.status === "aktiv" ? naechsteFaelligkeit(e, bearbeitetBis) : null,
  };
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGEN
// ------------------------------------------------------------------------------------------------

export interface KlaraErinnerungRepo {
  hole(kontoId: string, id: string): Promise<KlaraErinnerungEintrag | null>;
  /** Nur für die Steuerung: ohne Kontofilter. */
  holeSystem(id: string): Promise<KlaraErinnerungEintrag | null>;
  zuVorgang(kontoId: string, vorgang: string): Promise<KlaraErinnerungEintrag | null>;
  liste(kontoId: string, limit: number): Promise<KlaraErinnerungEintrag[]>;
  anzahl(kontoId: string): Promise<number>;
  lege(e: KlaraErinnerung, s: KlaraErinnerungSteuer): Promise<boolean>;
  /** Schreibt `e` samt Steuerstand, wenn die gespeicherte Fassung `e.fassung - 1` ist. */
  ersetze(e: KlaraErinnerung, s: KlaraErinnerungSteuer): Promise<boolean>;
  /** Schreibt NUR den Steuerstand, wenn die Fassung noch `fassung` ist. */
  setzeSteuer(id: string, fassung: number, s: KlaraErinnerungSteuer): Promise<boolean>;
  entferne(kontoId: string, id: string): Promise<boolean>;
  /**
   * Nacharbeit 16: entfernt EINEN Schritt bedingt — nur, wenn die Erinnerung noch die Fassung
   * `fassung` trägt und kein Lauf zu ihr besteht. `false`: geändert oder schon gewirkt — sie bleibt.
   */
  entferneBedingt(kontoId: string, id: string, fassung: number): Promise<boolean>;
  /** Aktive Erinnerungen mit Fälligkeit ≤ `jetzt`, älteste zuerst. */
  faellige(jetzt: number, limit: number): Promise<KlaraErinnerungEintrag[]>;
  /** Rückstau: Zahl und älteste Fälligkeit aktiver, fälliger Erinnerungen (optional je Konto). */
  rueckstau(
    jetzt: number,
    kontoId: string | null,
    erinnerungIds?: readonly string[],
  ): Promise<{ anzahl: number; aelteste: number | null }>;
  /** Erinnerungen, die diesem Konto BEWUSST ÜBERGEBEN wurden (es ist zuständig, nicht Eigentümer). */
  uebernommene(kontoId: string, limit: number): Promise<KlaraErinnerungEintrag[]>;
  /**
   * Nacharbeit 12/13: die früheste Folgeserie (`serieVon`), die diese Serie ab `ab` fortführt —
   * oder `null`. Die Folgeserie ist die dauerhafte Teilungsabsicht.
   */
  nachfolger(
    erinnerungId: string,
  ): Promise<{ readonly id: string; readonly vorgang: string; readonly ab: string } | null>;
}

/** Die persönlichen Vorgaben aus dem Einrichtungsassistenten — eine Zeile je Konto. */
export interface KlaraErinnerungEinstellungRepo {
  hole(kontoId: string): Promise<KlaraErinnerungEinstellungen | null>;
  /** Schreibt, wenn die gespeicherte Fassung `e.fassung - 1` ist (0 = noch keine Zeile). */
  schreibe(e: KlaraErinnerungEinstellungen): Promise<boolean>;
}

export interface LaufUebernahme {
  readonly vorkommenId: string;
  readonly erinnerungId: string;
  readonly kontoId: string;
  readonly geplantFuer: number;
  readonly besitzer: string;
  readonly jetzt: number;
  readonly leaseMs: number;
  readonly art: KlaraErinnerungLaufArt;
  readonly meldungId: string;
}

export interface KlaraErinnerungLaufRepo {
  /**
   * ATOMAR: legt den Lauf an — oder übernimmt ihn, wenn seine Laufberechtigung abgelaufen ist bzw.
   * er gescheitert ist und noch Versuche hat. Sonst `null` (ein anderer Prozess hält ihn, oder er
   * ist abgeschlossen). Bei einer Übernahme bleiben Art und Meldungskennung des ersten Versuchs.
   */
  uebernimm(u: LaufUebernahme): Promise<KlaraErinnerungLauf | null>;
  hole(vorkommenId: string): Promise<KlaraErinnerungLauf | null>;
  /** Schließt einen Lauf ab, den `besitzer` noch hält (Status `laeuft`). */
  schliesse(
    vorkommenId: string,
    besitzer: string,
    status: KlaraErinnerungLaufStatus,
    ergebnis: KlaraErinnerungLauf["ergebnis"],
    jetzt: number,
  ): Promise<boolean>;
  /**
   * Nacharbeit 11: hält am Lauf, den `besitzer` gerade hält (Status `laeuft`), ein Zwischenergebnis
   * fest — Status und Laufberechtigung bleiben. `false`: der Lauf wird nicht (mehr) gehalten.
   */
  vermerke(
    vorkommenId: string,
    besitzer: string,
    ergebnis: KlaraErinnerungLauf["ergebnis"],
    jetzt: number,
  ): Promise<boolean>;
  /** Setzt den Status, wenn der Lauf gerade einen der Status `von` hat (Entscheidung der Person). */
  setze(
    vorkommenId: string,
    von: readonly KlaraErinnerungLaufStatus[],
    status: KlaraErinnerungLaufStatus,
    ergebnis: KlaraErinnerungLauf["ergebnis"] | null,
    versuch: number | null,
    jetzt: number,
  ): Promise<boolean>;
  fuerErinnerung(erinnerungId: string, limit: number): Promise<KlaraErinnerungLauf[]>;
  /** Läufe, die eine Übernahme brauchen: abgelaufene Laufberechtigung oder gescheitert mit Rest. */
  wiederaufzunehmen(
    jetzt: number,
    maxVersuche: number,
    limit: number,
  ): Promise<KlaraErinnerungLauf[]>;
  /** Zahlen je Status (optional je Konto); `haengend` = `laeuft` mit abgelaufener Berechtigung. */
  zaehle(
    kontoId: string | null,
    jetzt: number,
    erinnerungIds?: readonly string[],
  ): Promise<Record<KlaraErinnerungLaufStatus | "haengend", number>>;
  entferneFuerErinnerung(erinnerungId: string): Promise<void>;
  /**
   * Gibt einen Lauf frei, den `besitzer` hält, ohne ihn abzuschließen (Zeile entfernt) — für einen
   * Termin, der vor der Wirkung in die Zukunft verlegt wurde: er wird zu seiner neuen Zeit wieder
   * fällig.
   */
  gibFrei(vorkommenId: string, besitzer: string): Promise<boolean>;
}

/**
 * Die Bedingung einer Wirkung: die Erinnerung ist in genau dieser Fassung noch aktiv — und
 * (Nacharbeit 4) das Konto der Empfängerin ist nicht gesperrt oder abgelaufen und die eigene Quelle
 * besteht noch. Konto- und Quellenänderungen ändern die Fassung der Erinnerung nicht; deshalb stehen
 * sie hier eigens.
 */
export interface LaufBedingung {
  readonly id: string;
  readonly besitzer: string;
  readonly status: readonly KlaraErinnerungLaufStatus[];
}

export interface MeldungBedingung {
  readonly erinnerungId: string;
  readonly fassung: number;
  /**
   * Konto der Empfängerin und der Zeitpunkt, zu dem sein Zugang noch gelten muss. In PostgreSQL
   * muss die Kontozeile vorhanden, freigegeben und nicht abgelaufen sein (positiv, `FOR SHARE`).
   */
  readonly empfaenger?: { readonly kontoId: string; readonly jetzt: number };
  /** Die eigene Quelle, die noch bestehen muss — `null`/fehlend: keine (frei oder bewusst akzeptiert). */
  readonly quelle?: MeldungQuelle | null;
  /**
   * EQF-07 (Nacharbeit 9): die Quellen eines Routinenberichts in GENAU der gelesenen Fassung. Ändert
   * oder löscht jemand eine davon vor dem Schreiben, entsteht nichts — die Steuerung entscheidet neu.
   */
  readonly quellenStand?: readonly ErinnerungQuellenStand[];
  /** Genau die gehaltenen Läufe: Abbruch oder Übernahme durch einen anderen Prozess sperrt die Wirkung. */
  readonly laeufe?: readonly LaufBedingung[];
  /** Nur ausdrücklich beauftragte Pflege: aktuelle zusätzliche Quellenfakten im selben INSERT. */
  readonly pflegeQuelle?: NotizSchreibbedingung;
  /** AW04: bestehende aktuelle Quellrechte im selben Meldungs-INSERT halten. */
  readonly quellschutz?: ErinnerungQuellfreigabe;
}

/**
 * Die Bedingung einer Wirkung als SQL für DENSELBEN Befehl wie das Schreiben (Meldung oder
 * Routinenbericht): Erinnerung aktiv in dieser Fassung, Kontozeile vorhanden und berechtigt,
 * eigene Quelle vorhanden, gelesene Quellen unverändert — jeweils mit `FOR SHARE` gehalten.
 * `start` ist der nächste freie Parameterindex.
 */
export function bedingungSql(
  b: MeldungBedingung,
  start: number,
): { und: string[]; params: unknown[] } {
  const params: unknown[] = [b.erinnerungId, b.fassung];
  const p = (): number => start + params.length - 1;
  const und: string[] = [
    `EXISTS (SELECT 1 FROM klara_erinnerungen
              WHERE id = $${p() - 1}::text AND status = 'aktiv' AND fassung = $${p()}::int FOR SHARE)`,
  ];
  if (b.empfaenger) {
    params.push(b.empfaenger.kontoId, new Date(b.empfaenger.jetzt).toISOString());
    const k = p() - 1;
    const t = p();
    // Nacharbeit 5 (Ben): POSITIV — es muss eine HEUTE berechtigte Kontozeile geben, und GENAU
    // DIESE wird mit FOR SHARE gehalten. Eine fehlende (gelöschte) Zeile verhindert die Wirkung.
    // Eine gleichzeitige Sperre oder Löschung wartet auf diesen Befehl — oder dieser auf sie; dann
    // prüft PostgreSQL die Bedingung an der NEUEN Zeilenfassung erneut (bzw. findet keine Zeile).
    und.push(
      `EXISTS (SELECT 1 FROM users
                WHERE id = $${k}::text
                  AND approved
                  AND CASE WHEN COALESCE(access_expires_at, '') = '' THEN true
                           ELSE access_expires_at::timestamptz > $${t}::timestamptz
                      END
                FOR SHARE)`,
    );
  }
  const q = b.quelle;
  if (q) {
    params.push(q.id, q.kontoId);
    const i = p() - 1;
    const k = p();
    if (q.art === "notiz") {
      und.push(
        `EXISTS (SELECT 1 FROM klara_notizen WHERE id = $${i}::text AND konto_id = $${k}::text
                  FOR SHARE)`,
      );
    } else if (q.art === "aufgabe") {
      und.push(
        `EXISTS (SELECT 1 FROM klara_aufgaben WHERE id = $${i}::text AND konto_id = $${k}::text
                  FOR SHARE)`,
      );
    } else {
      params.push(q.nachrichtId);
      const n = p();
      und.push(
        `EXISTS (SELECT 1 FROM klara_gespraeche
                  WHERE id = $${i}::text AND konto_id = $${k}::text
                    AND data->'nachrichten' @> jsonb_build_array(jsonb_build_object('id', $${n}::text))
                  FOR SHARE)`,
      );
    }
  }
  for (const s of b.quellenStand ?? []) {
    params.push(s.id, s.kontoId, s.fassung);
    const i = p() - 2;
    const k = p() - 1;
    const f = p();
    const tabelle =
      s.art === "notiz"
        ? "klara_notizen"
        : s.art === "aufgabe"
          ? "klara_aufgaben"
          : "klara_gespraeche";
    und.push(
      `EXISTS (SELECT 1 FROM ${tabelle}
                WHERE id = $${i}::text AND konto_id = $${k}::text AND fassung = $${f}::int
                FOR SHARE)`,
    );
  }
  for (const l of b.laeufe ?? []) {
    params.push(l.id, b.erinnerungId, l.besitzer, [...l.status]);
    und.push(`EXISTS (SELECT 1 FROM klara_erinnerung_laeufe
      WHERE vorkommen_id = $${p() - 3}::text AND erinnerung_id = $${p() - 2}::text
        AND besitzer = $${p() - 1}::text AND status = ANY($${p()}::text[]) FOR SHARE)`);
  }
  for (const quelle of [b.quellschutz, b.pflegeQuelle]) {
    const bedingung = quelle?.sql?.(start + params.length);
    if (bedingung) {
      und.push(...bedingung.und);
      params.push(...bedingung.params);
    }
  }
  return { und, params };
}

export type MeldungQuelle =
  | { readonly art: "notiz"; readonly kontoId: string; readonly id: string }
  | { readonly art: "aufgabe"; readonly kontoId: string; readonly id: string }
  | {
      readonly art: "gespraech";
      readonly kontoId: string;
      readonly id: string;
      readonly nachrichtId: string;
    };

/** Welche eigene Quelle eine Wirkung voraussetzt — keine bei freiem Bezug oder bewusster Fortführung. */
export function quelleFuerBedingung(e: KlaraErinnerung): MeldungQuelle | null {
  if (e.quelleFehltAkzeptiert) {
    return null;
  }
  const b = e.bezug;
  if (b.art === "notiz") {
    return { art: "notiz", kontoId: e.kontoId, id: b.notizId };
  }
  if (b.art === "aufgabe") {
    return { art: "aufgabe", kontoId: e.kontoId, id: b.aufgabeId };
  }
  if (b.art === "gespraech") {
    return { art: "gespraech", kontoId: e.kontoId, id: b.gespraechId, nachrichtId: b.nachrichtId };
  }
  return null;
}

export interface KlaraErinnerungMeldungRepo {
  /**
   * Legt die Meldung an. Mit `bedingung` NUR, wenn die Erinnerung in genau dieser Fassung noch aktiv
   * ist — in EINEM Schritt mit dem Schreiben (PostgreSQL: ein Befehl, die Erinnerungszeile mit
   * `FOR SHARE` gesperrt). Gibt es die Meldung mit dieser Kennung schon: `vorhanden`.
   */
  schreibe(
    m: KlaraErinnerungMeldung,
    bedingung?: MeldungBedingung,
  ): Promise<MeldungSchreibergebnis>;
  hole(id: string): Promise<KlaraErinnerungMeldung | null>;
  fuerKonto(kontoId: string, limit: number): Promise<KlaraErinnerungMeldung[]>;
  /** Entfernt ALLE Meldungen dieser Erinnerung — auch die an eine übergebene Zuständige. */
  entferneFuerErinnerung(erinnerungId: string): Promise<void>;
}

export interface KlaraErinnerungAblage {
  readonly erinnerungen: KlaraErinnerungRepo;
  readonly laeufe: KlaraErinnerungLaufRepo;
  readonly meldungen: KlaraErinnerungMeldungRepo;
  readonly einstellungen: KlaraErinnerungEinstellungRepo;
  /** Produktablagen löschen Auftrag, Läufe und Meldungen als eine atomare Wirkung. */
  readonly entferneKomplett?: (kontoId: string, id: string) => Promise<boolean>;
  /** Ein aktiver eigener Lauf, atomar gegen neue Wirkungen; Serie und vorhandene Ergebnisse bleiben. */
  readonly brecheLaufAb?: (
    kontoId: string,
    id: string,
    vorkommenId: string,
    fassung: number,
    jetzt: number,
    notizen?: Pick<KlaraNotizRepo, "zuVorgang">,
  ) => Promise<boolean>;
}

function leereZaehlung(): Record<KlaraErinnerungLaufStatus | "haengend", number> {
  return {
    laeuft: 0,
    zugestellt: 0,
    teilweise: 0,
    verpasst_gemeldet: 0,
    zusammengefasst: 0,
    uebersprungen: 0,
    fehlgeschlagen: 0,
    unklar: 0,
    gestoppt: 0,
    abgebrochen: 0,
    haengend: 0,
  };
}

export class InMemoryKlaraErinnerungRepo implements KlaraErinnerungRepo {
  private readonly eintraege = new Map<string, KlaraErinnerungEintrag>();

  hole(kontoId: string, id: string): Promise<KlaraErinnerungEintrag | null> {
    const e = this.eintraege.get(id);
    return Promise.resolve(e?.erinnerung.kontoId === kontoId ? e : null);
  }

  holeSystem(id: string): Promise<KlaraErinnerungEintrag | null> {
    return Promise.resolve(this.eintraege.get(id) ?? null);
  }

  zuVorgang(kontoId: string, vorgang: string): Promise<KlaraErinnerungEintrag | null> {
    for (const e of this.eintraege.values()) {
      if (e.erinnerung.kontoId === kontoId && e.erinnerung.vorgang === vorgang) {
        return Promise.resolve(e);
      }
    }
    return Promise.resolve(null);
  }

  liste(kontoId: string, limit: number): Promise<KlaraErinnerungEintrag[]> {
    return Promise.resolve(
      [...this.eintraege.values()]
        .filter((e) => e.erinnerung.kontoId === kontoId)
        .sort((a, b) => b.erinnerung.geaendertAm.localeCompare(a.erinnerung.geaendertAm))
        .slice(0, limit),
    );
  }

  anzahl(kontoId: string): Promise<number> {
    return Promise.resolve(
      [...this.eintraege.values()].filter((e) => e.erinnerung.kontoId === kontoId).length,
    );
  }

  lege(e: KlaraErinnerung, s: KlaraErinnerungSteuer): Promise<boolean> {
    for (const x of this.eintraege.values()) {
      if (x.erinnerung.kontoId === e.kontoId && x.erinnerung.vorgang === e.vorgang) {
        return Promise.resolve(false);
      }
    }
    this.eintraege.set(e.id, { erinnerung: e, steuer: s });
    return Promise.resolve(true);
  }

  ersetze(e: KlaraErinnerung, s: KlaraErinnerungSteuer): Promise<boolean> {
    const alt = this.eintraege.get(e.id);
    if (!alt || alt.erinnerung.kontoId !== e.kontoId || alt.erinnerung.fassung !== e.fassung - 1) {
      return Promise.resolve(false);
    }
    this.eintraege.set(e.id, { erinnerung: e, steuer: s });
    return Promise.resolve(true);
  }

  setzeSteuer(id: string, fassung: number, s: KlaraErinnerungSteuer): Promise<boolean> {
    const alt = this.eintraege.get(id);
    if (!alt || alt.erinnerung.fassung !== fassung) {
      return Promise.resolve(false);
    }
    this.eintraege.set(id, { erinnerung: alt.erinnerung, steuer: s });
    return Promise.resolve(true);
  }

  entferne(kontoId: string, id: string): Promise<boolean> {
    const e = this.eintraege.get(id);
    if (!e || e.erinnerung.kontoId !== kontoId) {
      return Promise.resolve(false);
    }
    return Promise.resolve(this.eintraege.delete(id));
  }

  /** Nacharbeit 17: synchron — für die Laufübernahme derselben Ablage. */
  existiert(id: string): boolean {
    return this.eintraege.has(id);
  }

  /** Nacharbeit 16: die Laufablage DESSELBEN Bestands — für die bedingte Löschung. */
  private laeufe: {
    hatLauf(erinnerungId: string): boolean;
    gilt?(b: LaufBedingung): boolean;
  } | null = null;

  verbindeLaeufe(laeufe: {
    hatLauf(erinnerungId: string): boolean;
    gilt?(b: LaufBedingung): boolean;
  }): void {
    this.laeufe = laeufe;
  }

  entferneBedingt(kontoId: string, id: string, fassung: number): Promise<boolean> {
    // Zwischen Prüfung und Löschen liegt kein `await`: im Speicher so unteilbar wie der eine
    // PostgreSQL-Befehl.
    const e = this.eintraege.get(id);
    if (
      !e ||
      e.erinnerung.kontoId !== kontoId ||
      e.erinnerung.fassung !== fassung ||
      this.laeufe?.hatLauf(id) === true
    ) {
      return Promise.resolve(false);
    }
    return Promise.resolve(this.eintraege.delete(id));
  }

  nachfolger(erinnerungId: string): Promise<{ id: string; vorgang: string; ab: string } | null> {
    let folge: { id: string; vorgang: string; ab: string } | null = null;
    for (const x of this.eintraege.values()) {
      const s = x.erinnerung.serieVon;
      if (s && s.erinnerungId === erinnerungId && (folge === null || s.ab < folge.ab)) {
        folge = { id: x.erinnerung.id, vorgang: x.erinnerung.vorgang, ab: s.ab };
      }
    }
    return Promise.resolve(folge);
  }

  faellige(jetzt: number, limit: number): Promise<KlaraErinnerungEintrag[]> {
    return Promise.resolve(
      faireErinnerungen(
        [...this.eintraege.values()]
          .filter(
            (e) =>
              e.erinnerung.status === "aktiv" &&
              e.steuer.naechste !== null &&
              e.steuer.naechste <= jetzt,
          )
          .sort((a, b) => (a.steuer.naechste ?? 0) - (b.steuer.naechste ?? 0)),
      ).slice(0, limit),
    );
  }

  async rueckstau(
    jetzt: number,
    kontoId: string | null,
    erinnerungIds?: readonly string[],
  ): Promise<{ anzahl: number; aelteste: number | null }> {
    const faellig = (await this.faellige(jetzt, Number.MAX_SAFE_INTEGER)).filter(
      (e) =>
        (kontoId === null || e.erinnerung.kontoId === kontoId) &&
        (erinnerungIds === undefined || erinnerungIds.includes(e.erinnerung.id)),
    );
    return { anzahl: faellig.length, aelteste: faellig[0]?.steuer.naechste ?? null };
  }

  uebernommene(kontoId: string, limit: number): Promise<KlaraErinnerungEintrag[]> {
    return Promise.resolve(
      [...this.eintraege.values()]
        .filter((e) => e.erinnerung.zustaendig?.kontoId === kontoId)
        .sort((a, b) => b.erinnerung.geaendertAm.localeCompare(a.erinnerung.geaendertAm))
        .slice(0, limit),
    );
  }

  /**
   * SYNCHRON: aktiv in genau dieser Fassung? — für das bedingte Schreiben der Speicher-Meldungsablage
   * (zwischen Prüfung und Schreiben liegt dort kein `await`).
   */
  aktivInFassung(id: string, fassung: number): boolean {
    const e = this.eintraege.get(id);
    return e !== undefined && e.erinnerung.status === "aktiv" && e.erinnerung.fassung === fassung;
  }
  eigeneFassung(kontoId: string, id: string, fassung: number): boolean {
    const e = this.eintraege.get(id)?.erinnerung;
    return e?.kontoId === kontoId && e.fassung === fassung;
  }
  laufBedingungen(b: readonly LaufBedingung[]): boolean {
    return b.every((l) => this.laeufe?.gilt?.(l) === true);
  }
}

/**
 * EQF-07-K06 (Nacharbeit 9): ein Teilbericht, dessen offener Rest nachholbar ist — die vorhandene
 * Wiederaufnahme übernimmt ihn wie einen gescheiterten Lauf (gleiche Versuchsgrenze).
 */
function fortsetzbarerTeil(l: KlaraErinnerungLauf): boolean {
  return l.status === "teilweise" && l.ergebnis.routine?.fortsetzbar === true;
}

/** Dieselbe Regel in SQL (Tabellenalias `l` bzw. ohne). */
function fortsetzbarSql(alias: string): string {
  const routine = `${alias}data->'ergebnis'->'routine'`;
  return `(${alias}status = 'teilweise' AND ${routine}->>'fortsetzbar' = 'true')`;
}

export class InMemoryKlaraErinnerungLaufRepo implements KlaraErinnerungLaufRepo {
  private readonly laeufe = new Map<string, KlaraErinnerungLauf>();

  /**
   * Nacharbeit 17: die Erinnerungsablage DESSELBEN Bestands. Übernommen wird nur, solange die
   * Erinnerung besteht — ohne `await` zwischen Prüfung und Eintrag, so unteilbar wie die
   * PostgreSQL-Fassung (`FOR SHARE` auf ihrer Zeile).
   */
  private erinnerungen: { existiert(id: string): boolean } | null = null;

  verbindeErinnerungen(e: { existiert(id: string): boolean }): void {
    this.erinnerungen = e;
  }

  /** Nacharbeit 16: synchron — für die bedingte Löschung der Erinnerungsablage. */
  hatLauf(erinnerungId: string): boolean {
    for (const l of this.laeufe.values()) {
      if (l.erinnerungId === erinnerungId) {
        return true;
      }
    }
    return false;
  }

  uebernimm(u: LaufUebernahme): Promise<KlaraErinnerungLauf | null> {
    if (this.erinnerungen && !this.erinnerungen.existiert(u.erinnerungId)) {
      return Promise.resolve(null);
    }
    const jetztIso = new Date(u.jetzt).toISOString();
    const leaseBis = new Date(u.jetzt + u.leaseMs).toISOString();
    const alt = this.laeufe.get(u.vorkommenId);
    if (!alt) {
      const neu: KlaraErinnerungLauf = {
        vorkommenId: u.vorkommenId,
        erinnerungId: u.erinnerungId,
        kontoId: u.kontoId,
        geplantFuer: new Date(u.geplantFuer).toISOString(),
        status: "laeuft",
        versuch: 1,
        besitzer: u.besitzer,
        leaseBis,
        aktualisiertAm: jetztIso,
        art: u.art,
        meldungId: u.meldungId,
        ergebnis: {},
      };
      this.laeufe.set(u.vorkommenId, neu);
      return Promise.resolve(neu);
    }
    const abgelaufen = alt.status === "laeuft" && (alt.leaseBis ?? "") < jetztIso;
    const nochmal =
      (alt.status === "fehlgeschlagen" || fortsetzbarerTeil(alt)) &&
      alt.versuch < KLARA_ERINNERUNG_MAX_VERSUCHE;
    if (!abgelaufen && !nochmal) {
      return Promise.resolve(null);
    }
    const neu: KlaraErinnerungLauf = {
      ...alt,
      status: "laeuft",
      versuch: alt.versuch + 1,
      besitzer: u.besitzer,
      leaseBis,
      aktualisiertAm: jetztIso,
    };
    this.laeufe.set(u.vorkommenId, neu);
    return Promise.resolve(neu);
  }

  gilt(b: LaufBedingung): boolean {
    const l = this.laeufe.get(b.id);
    return !!l && l.besitzer === b.besitzer && b.status.includes(l.status);
  }
  /** Synchroner Abbruch: den aktuellen Ergebnisstand im selben Schritt erhalten. */
  brecheAktivAb(
    kontoId: string,
    erinnerungId: string,
    id: string,
    jetzt: number,
  ): KlaraErinnerungLauf | null {
    const l = this.laeufe.get(id);
    if (!l || l.kontoId !== kontoId || l.erinnerungId !== erinnerungId || l.status !== "laeuft")
      return null;
    this.laeufe.set(id, {
      ...l,
      status: "abgebrochen",
      leaseBis: null,
      aktualisiertAm: new Date(jetzt).toISOString(),
      ergebnis: { ...l.ergebnis, grund: "abbruch" },
    });
    return l;
  }

  hole(vorkommenId: string): Promise<KlaraErinnerungLauf | null> {
    return Promise.resolve(this.laeufe.get(vorkommenId) ?? null);
  }

  schliesse(
    vorkommenId: string,
    besitzer: string,
    status: KlaraErinnerungLaufStatus,
    ergebnis: KlaraErinnerungLauf["ergebnis"],
    jetzt: number,
  ): Promise<boolean> {
    const alt = this.laeufe.get(vorkommenId);
    if (!alt || alt.status !== "laeuft" || alt.besitzer !== besitzer) {
      return Promise.resolve(false);
    }
    this.laeufe.set(vorkommenId, {
      ...alt,
      status,
      ergebnis,
      leaseBis: null,
      aktualisiertAm: new Date(jetzt).toISOString(),
    });
    return Promise.resolve(true);
  }

  vermerke(
    vorkommenId: string,
    besitzer: string,
    ergebnis: KlaraErinnerungLauf["ergebnis"],
    jetzt: number,
  ): Promise<boolean> {
    const alt = this.laeufe.get(vorkommenId);
    if (!alt || alt.status !== "laeuft" || alt.besitzer !== besitzer) {
      return Promise.resolve(false);
    }
    this.laeufe.set(vorkommenId, {
      ...alt,
      ergebnis,
      aktualisiertAm: new Date(jetzt).toISOString(),
    });
    return Promise.resolve(true);
  }

  setze(
    vorkommenId: string,
    von: readonly KlaraErinnerungLaufStatus[],
    status: KlaraErinnerungLaufStatus,
    ergebnis: KlaraErinnerungLauf["ergebnis"] | null,
    versuch: number | null,
    jetzt: number,
  ): Promise<boolean> {
    const alt = this.laeufe.get(vorkommenId);
    if (!alt || !von.includes(alt.status)) {
      return Promise.resolve(false);
    }
    this.laeufe.set(vorkommenId, {
      ...alt,
      status,
      ergebnis: ergebnis ?? alt.ergebnis,
      versuch: versuch ?? alt.versuch,
      leaseBis: null,
      aktualisiertAm: new Date(jetzt).toISOString(),
    });
    return Promise.resolve(true);
  }

  fuerErinnerung(erinnerungId: string, limit: number): Promise<KlaraErinnerungLauf[]> {
    return Promise.resolve(
      [...this.laeufe.values()]
        .filter((l) => l.erinnerungId === erinnerungId)
        .sort((a, b) => b.geplantFuer.localeCompare(a.geplantFuer))
        .slice(0, limit),
    );
  }

  wiederaufzunehmen(
    jetzt: number,
    maxVersuche: number,
    limit: number,
  ): Promise<KlaraErinnerungLauf[]> {
    const jetztIso = new Date(jetzt).toISOString();
    return Promise.resolve(
      faireReihenfolge(
        [...this.laeufe.values()]
          .filter(
            (l) =>
              (l.status === "laeuft" && (l.leaseBis ?? "") < jetztIso) ||
              ((l.status === "fehlgeschlagen" || fortsetzbarerTeil(l)) && l.versuch < maxVersuche),
          )
          .sort((a, b) => a.geplantFuer.localeCompare(b.geplantFuer)),
        (l) => l.kontoId,
      ).slice(0, limit),
    );
  }

  zaehle(
    kontoId: string | null,
    jetzt: number,
    erinnerungIds?: readonly string[],
  ): Promise<Record<KlaraErinnerungLaufStatus | "haengend", number>> {
    const z = leereZaehlung();
    const jetztIso = new Date(jetzt).toISOString();
    for (const l of this.laeufe.values()) {
      if (
        (kontoId !== null && l.kontoId !== kontoId) ||
        (erinnerungIds !== undefined && !erinnerungIds.includes(l.erinnerungId))
      ) {
        continue;
      }
      z[l.status] += 1;
      if (l.status === "laeuft" && (l.leaseBis ?? "") < jetztIso) {
        z.haengend += 1;
      }
    }
    return Promise.resolve(z);
  }

  entferneFuerErinnerung(erinnerungId: string): Promise<void> {
    for (const [k, l] of this.laeufe) {
      if (l.erinnerungId === erinnerungId) {
        this.laeufe.delete(k);
      }
    }
    return Promise.resolve();
  }

  gibFrei(vorkommenId: string, besitzer: string): Promise<boolean> {
    const l = this.laeufe.get(vorkommenId);
    if (!l || l.status !== "laeuft" || l.besitzer !== besitzer) {
      return Promise.resolve(false);
    }
    return Promise.resolve(this.laeufe.delete(vorkommenId));
  }
}

/** Was die Speicher-Meldungsablage für das bedingte Schreiben braucht — synchron. */
export interface AktivPruefer {
  aktivInFassung(id: string, fassung: number): boolean;
  laufBedingungen?(b: readonly LaufBedingung[]): boolean;
}

export class InMemoryKlaraErinnerungMeldungRepo implements KlaraErinnerungMeldungRepo {
  private readonly meldungen = new Map<string, KlaraErinnerungMeldung>();

  /**
   * `erinnerungen`: die Erinnerungsablage DESSELBEN Bestands. Nach der Quellrechte-Nachlese folgen
   * die bisherigen synchronen Lauf-/Fassungsbedingungen und das Schreiben ohne weiteres `await`.
   * PostgreSQL hält die zusätzlichen Quellbedingungen im selben INSERT.
   * Ohne sie gilt jede Bedingung als erfüllt (nur für Attrappen ohne Erinnerungsablage).
   */
  constructor(private readonly erinnerungen?: AktivPruefer) {}

  async schreibe(
    m: KlaraErinnerungMeldung,
    bedingung?: MeldungBedingung,
  ): Promise<MeldungSchreibergebnis> {
    if (bedingung?.quellschutz && !(await bedingung.quellschutz.nochAktuell())) return "veraltet";
    const alt = this.meldungen.get(m.id);
    if (alt && umfasstMeldung(alt, m)) {
      return Promise.resolve("vorhanden");
    }
    if (
      bedingung &&
      this.erinnerungen &&
      (!this.erinnerungen.aktivInFassung(bedingung.erinnerungId, bedingung.fassung) ||
        bedingung.pflegeQuelle?.gilt?.() === false ||
        (bedingung.laeufe !== undefined &&
          this.erinnerungen.laufBedingungen?.(bedingung.laeufe) !== true))
    ) {
      return Promise.resolve("veraltet");
    }
    if (alt) {
      if (
        alt.kontoId !== m.kontoId ||
        alt.erinnerungId !== m.erinnerungId ||
        alt.art !== m.art ||
        !["zusammenfassung", "uebersprungen"].includes(m.art)
      ) {
        return Promise.resolve("veraltet");
      }
      this.meldungen.set(m.id, {
        ...alt,
        vorkommen: [...new Set([...alt.vorkommen, ...m.vorkommen])].sort(),
      });
    } else {
      this.meldungen.set(m.id, m);
    }
    return Promise.resolve("geschrieben");
  }

  hole(id: string): Promise<KlaraErinnerungMeldung | null> {
    return Promise.resolve(this.meldungen.get(id) ?? null);
  }

  fuerKonto(kontoId: string, limit: number): Promise<KlaraErinnerungMeldung[]> {
    return Promise.resolve(
      [...this.meldungen.values()]
        .filter((m) => m.kontoId === kontoId)
        .sort((a, b) => b.zugestelltAm.localeCompare(a.zugestelltAm))
        .slice(0, limit),
    );
  }

  entferneFuerErinnerung(erinnerungId: string): Promise<void> {
    for (const [k, m] of this.meldungen) {
      if (m.erinnerungId === erinnerungId) {
        this.meldungen.delete(k);
      }
    }
    return Promise.resolve();
  }
}

export class InMemoryKlaraErinnerungEinstellungRepo implements KlaraErinnerungEinstellungRepo {
  private readonly zeilen = new Map<string, KlaraErinnerungEinstellungen>();

  hole(kontoId: string): Promise<KlaraErinnerungEinstellungen | null> {
    return Promise.resolve(this.zeilen.get(kontoId) ?? null);
  }

  schreibe(e: KlaraErinnerungEinstellungen): Promise<boolean> {
    const alt = this.zeilen.get(e.kontoId);
    if ((alt?.fassung ?? 0) !== e.fassung - 1) {
      return Promise.resolve(false);
    }
    this.zeilen.set(e.kontoId, e);
    return Promise.resolve(true);
  }
}

function abbruchErgebnis(
  lauf: KlaraErinnerungLauf,
  meldung: KlaraErinnerungMeldung | null,
  notiz: KlaraNotiz | null,
): KlaraErinnerungLauf["ergebnis"] {
  const beleg = meldung?.vorkommen.includes(lauf.geplantFuer) ? meldung : null;
  const routine = notiz
    ? {
        ...ergebnisAusBericht(notiz),
        ...(lauf.ergebnis.wissenspflege
          ? {
              wissenspflege: lauf.ergebnis.wissenspflege,
              routineFassung: lauf.ergebnis.pflegeRoutineFassung ?? 0,
            }
          : {}),
      }
    : lauf.ergebnis.routine;
  return {
    ...lauf.ergebnis,
    ...(beleg
      ? {
          zugestelltAm: beleg.zugestelltAm,
          nachgeholt: beleg.nachgeholt,
          ...(beleg.pruefung ? { pruefung: beleg.pruefung } : {}),
          ...(beleg.zusammenfassung ? { zusammenfassung: beleg.zusammenfassung } : {}),
        }
      : {}),
    ...(routine ? { routine: { ...routine, fortsetzbar: false, meldungAusstehend: false } } : {}),
    grund: "abbruch",
  };
}

export function inMemoryErinnerungAblage(): KlaraErinnerungAblage {
  const erinnerungen = new InMemoryKlaraErinnerungRepo();
  const laeufe = new InMemoryKlaraErinnerungLaufRepo();
  erinnerungen.verbindeLaeufe(laeufe);
  laeufe.verbindeErinnerungen(erinnerungen);
  const meldungen = new InMemoryKlaraErinnerungMeldungRepo(erinnerungen);
  return {
    erinnerungen,
    laeufe,
    meldungen,
    einstellungen: new InMemoryKlaraErinnerungEinstellungRepo(),
    async brecheLaufAb(kontoId, id, vorkommenId, fassung, jetzt, notizen) {
      if (!erinnerungen.eigeneFassung(kontoId, id, fassung)) return false;
      const lauf = laeufe.brecheAktivAb(kontoId, id, vorkommenId, jetzt);
      if (!lauf) return false;
      // Ab hier verhindern dieselben Laufbedingungen neue Meldungen/Berichte. Vorherige Wirkungen nachlesen.
      try {
        const meldung = await meldungen.hole(lauf.ergebnis.pflegeMeldungId ?? lauf.meldungId);
        const notiz = notizen
          ? await notizen.zuVorgang(
              kontoId,
              lauf.ergebnis.pflegeNotizVorgang ?? ergebnisVorgang(vorkommenId),
            )
          : null;
        await laeufe.setze(
          vorkommenId,
          ["abgebrochen"],
          "abgebrochen",
          abbruchErgebnis(lauf, meldung, notiz),
          null,
          jetzt,
        );
      } catch {
        await laeufe.setze(
          vorkommenId,
          ["abgebrochen"],
          "abgebrochen",
          { ...lauf.ergebnis, grund: "readback_unmoeglich" },
          null,
          jetzt,
        );
      }
      return true;
    },
    async entferneKomplett(kontoId, id) {
      if (!(await erinnerungen.entferne(kontoId, id))) return false;
      await laeufe.entferneFuerErinnerung(id);
      await meldungen.entferneFuerErinnerung(id);
      return true;
    },
  };
}

/**
 * Vier Tabellen. REIN ADDITIV UND WIEDERHOLBAR: vier `CREATE TABLE IF NOT EXISTS`, ein `CREATE
 * UNIQUE INDEX IF NOT EXISTS` (Vorgang je Konto — keine Doppelerinnerung) und drei `CREATE INDEX IF
 * NOT EXISTS`; kein DROP, kein Fremdschlüssel, keine Extension, kein Seed. Der Primärschlüssel der
 * Läufe ist die Vorkommenskennung — er trägt die atomare Übernahme. Die Einstellungen
 * (Nacharbeit 2) tragen die Vorgaben des Einrichtungsassistenten je Konto.
 */
export const KLARA_ERINNERUNG_SCHEMA = `
CREATE TABLE IF NOT EXISTS klara_erinnerungen (
  id text PRIMARY KEY,
  konto_id text NOT NULL,
  vorgang text NOT NULL,
  fassung integer NOT NULL,
  status text NOT NULL,
  geaendert_am timestamptz NOT NULL,
  bearbeitet_bis timestamptz,
  naechste_faelligkeit timestamptz,
  data jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_klara_erinnerungen_vorgang
  ON klara_erinnerungen (konto_id, vorgang);
CREATE INDEX IF NOT EXISTS idx_klara_erinnerungen_faellig
  ON klara_erinnerungen (status, naechste_faelligkeit);
CREATE TABLE IF NOT EXISTS klara_erinnerung_laeufe (
  vorkommen_id text PRIMARY KEY,
  erinnerung_id text NOT NULL,
  konto_id text NOT NULL,
  geplant_fuer timestamptz NOT NULL,
  status text NOT NULL,
  versuch integer NOT NULL,
  besitzer text,
  lease_bis timestamptz,
  aktualisiert_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_klara_erinnerung_laeufe_erinnerung
  ON klara_erinnerung_laeufe (erinnerung_id, geplant_fuer DESC);
CREATE INDEX IF NOT EXISTS idx_klara_erinnerung_laeufe_offen
  ON klara_erinnerung_laeufe (status, lease_bis);
CREATE TABLE IF NOT EXISTS klara_erinnerung_meldungen (
  id text PRIMARY KEY,
  konto_id text NOT NULL,
  erinnerung_id text NOT NULL,
  zugestellt_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_klara_erinnerung_meldungen_konto
  ON klara_erinnerung_meldungen (konto_id, zugestellt_am DESC);
CREATE TABLE IF NOT EXISTS klara_erinnerung_einstellungen (
  konto_id text PRIMARY KEY,
  fassung integer NOT NULL,
  geaendert_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
`;

type ErinnerungZeile = {
  data: KlaraErinnerung;
  bearbeitet_bis: Date | null;
  naechste_faelligkeit: Date | null;
};

function eintragAus(z: ErinnerungZeile): KlaraErinnerungEintrag {
  return {
    erinnerung: z.data,
    steuer: {
      bearbeitetBis: z.bearbeitet_bis ? z.bearbeitet_bis.getTime() : null,
      naechste: z.naechste_faelligkeit ? z.naechste_faelligkeit.getTime() : null,
    },
  };
}

function alsDatum(ms: number | null): Date | null {
  return ms === null ? null : new Date(ms);
}

const ERINNERUNG_SPALTEN = "data, bearbeitet_bis, naechste_faelligkeit";

export class PgKlaraErinnerungRepo implements KlaraErinnerungRepo {
  constructor(private readonly pool: Pool) {}

  async hole(kontoId: string, id: string): Promise<KlaraErinnerungEintrag | null> {
    const res = await this.pool.query<ErinnerungZeile>(
      `SELECT ${ERINNERUNG_SPALTEN} FROM klara_erinnerungen WHERE id = $1 AND konto_id = $2`,
      [id, kontoId],
    );
    return res.rows[0] ? eintragAus(res.rows[0]) : null;
  }

  async holeSystem(id: string): Promise<KlaraErinnerungEintrag | null> {
    const res = await this.pool.query<ErinnerungZeile>(
      `SELECT ${ERINNERUNG_SPALTEN} FROM klara_erinnerungen WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? eintragAus(res.rows[0]) : null;
  }

  async zuVorgang(kontoId: string, vorgang: string): Promise<KlaraErinnerungEintrag | null> {
    const res = await this.pool.query<ErinnerungZeile>(
      `SELECT ${ERINNERUNG_SPALTEN} FROM klara_erinnerungen WHERE konto_id = $1 AND vorgang = $2`,
      [kontoId, vorgang],
    );
    return res.rows[0] ? eintragAus(res.rows[0]) : null;
  }

  async liste(kontoId: string, limit: number): Promise<KlaraErinnerungEintrag[]> {
    const res = await this.pool.query<ErinnerungZeile>(
      `SELECT ${ERINNERUNG_SPALTEN} FROM klara_erinnerungen WHERE konto_id = $1
        ORDER BY geaendert_am DESC, id DESC LIMIT $2`,
      [kontoId, limit],
    );
    return res.rows.map(eintragAus);
  }

  async anzahl(kontoId: string): Promise<number> {
    const res = await this.pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM klara_erinnerungen WHERE konto_id = $1",
      [kontoId],
    );
    return res.rows[0]?.n ?? 0;
  }

  async lege(e: KlaraErinnerung, s: KlaraErinnerungSteuer): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO klara_erinnerungen
         (id, konto_id, vorgang, fassung, status, geaendert_am, bearbeitet_bis, naechste_faelligkeit, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (konto_id, vorgang) DO NOTHING`,
      [
        e.id,
        e.kontoId,
        e.vorgang,
        e.fassung,
        e.status,
        e.geaendertAm,
        alsDatum(s.bearbeitetBis),
        alsDatum(s.naechste),
        JSON.stringify(e),
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async ersetze(e: KlaraErinnerung, s: KlaraErinnerungSteuer): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE klara_erinnerungen
          SET fassung = $3, status = $4, geaendert_am = $5, bearbeitet_bis = $6,
              naechste_faelligkeit = $7, data = $8
        WHERE id = $1 AND konto_id = $2 AND fassung = $9`,
      [
        e.id,
        e.kontoId,
        e.fassung,
        e.status,
        e.geaendertAm,
        alsDatum(s.bearbeitetBis),
        alsDatum(s.naechste),
        JSON.stringify(e),
        e.fassung - 1,
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async setzeSteuer(id: string, fassung: number, s: KlaraErinnerungSteuer): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE klara_erinnerungen SET bearbeitet_bis = $3, naechste_faelligkeit = $4
        WHERE id = $1 AND fassung = $2`,
      [id, fassung, alsDatum(s.bearbeitetBis), alsDatum(s.naechste)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async entferne(kontoId: string, id: string): Promise<boolean> {
    const res = await this.pool.query(
      "DELETE FROM klara_erinnerungen WHERE id = $1 AND konto_id = $2",
      [id, kontoId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async entferneBedingt(kontoId: string, id: string, fassung: number): Promise<boolean> {
    // Nacharbeit 17 (Ben): Löschen und Laufübernahme gehen über DIESELBE Sperre — die Zeile der
    // Erinnerung. Erst `FOR UPDATE` (wartet auf eine laufende Übernahme, die die Zeile mit
    // `FOR SHARE` hält), DANACH in einem neuen Befehl — also mit neuem Lesestand — Fassung und
    // Laufbestand prüfen. Eine Übernahme, die nach uns kommt, wartet auf unsere Sperre und findet die
    // Erinnerung danach nicht mehr (`uebernimm` prüft ihre Existenz unter `FOR SHARE`).
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const gesperrt = await c.query<{ fassung: number }>(
        "SELECT fassung FROM klara_erinnerungen WHERE id = $1 AND konto_id = $2 FOR UPDATE",
        [id, kontoId],
      );
      const lauf = await c.query(
        "SELECT 1 FROM klara_erinnerung_laeufe WHERE erinnerung_id = $1 LIMIT 1",
        [id],
      );
      if (gesperrt.rows[0]?.fassung !== fassung || (lauf.rowCount ?? 0) > 0) {
        await c.query("ROLLBACK");
        return false;
      }
      const res = await c.query("DELETE FROM klara_erinnerungen WHERE id = $1 AND konto_id = $2", [
        id,
        kontoId,
      ]);
      await c.query("COMMIT");
      return (res.rowCount ?? 0) > 0;
    } catch (fehler) {
      await c.query("ROLLBACK").catch(() => undefined);
      throw fehler;
    } finally {
      c.release();
    }
  }

  async nachfolger(
    erinnerungId: string,
  ): Promise<{ id: string; vorgang: string; ab: string } | null> {
    const res = await this.pool.query<{ id: string; vorgang: string; ab: string }>(
      `SELECT id, vorgang, data->'serieVon'->>'ab' AS ab FROM klara_erinnerungen
        WHERE data->'serieVon'->>'erinnerungId' = $1
        ORDER BY data->'serieVon'->>'ab', id LIMIT 1`,
      [erinnerungId],
    );
    return res.rows[0] ?? null;
  }

  async faellige(jetzt: number, limit: number): Promise<KlaraErinnerungEintrag[]> {
    const res = await this.pool.query<ErinnerungZeile>(
      `WITH kandidaten AS (
          SELECT ${ERINNERUNG_SPALTEN}, id, row_number() OVER (PARTITION BY konto_id ORDER BY naechste_faelligkeit, id) AS konto_rang
          FROM klara_erinnerungen
          WHERE status = 'aktiv' AND naechste_faelligkeit IS NOT NULL AND naechste_faelligkeit <= $1
        )
        SELECT ${ERINNERUNG_SPALTEN} FROM kandidaten ORDER BY konto_rang, naechste_faelligkeit, id LIMIT $2`,
      [new Date(jetzt), limit],
    );
    return res.rows.map(eintragAus);
  }

  async rueckstau(
    jetzt: number,
    kontoId: string | null,
    erinnerungIds?: readonly string[],
  ): Promise<{ anzahl: number; aelteste: number | null }> {
    const res = await this.pool.query<{ n: number; aelteste: Date | null }>(
      `SELECT count(*)::int AS n, min(naechste_faelligkeit) AS aelteste FROM klara_erinnerungen
        WHERE status = 'aktiv' AND naechste_faelligkeit IS NOT NULL AND naechste_faelligkeit <= $1
          AND ($2::text IS NULL OR konto_id = $2)
          AND ($3::text[] IS NULL OR id = ANY($3::text[]))`,
      [new Date(jetzt), kontoId, erinnerungIds ?? null],
    );
    const z = res.rows[0];
    return { anzahl: z?.n ?? 0, aelteste: z?.aelteste ? z.aelteste.getTime() : null };
  }

  async uebernommene(kontoId: string, limit: number): Promise<KlaraErinnerungEintrag[]> {
    const res = await this.pool.query<ErinnerungZeile>(
      `SELECT ${ERINNERUNG_SPALTEN} FROM klara_erinnerungen
        WHERE data->'zustaendig'->>'kontoId' = $1
        ORDER BY geaendert_am DESC, id DESC LIMIT $2`,
      [kontoId, limit],
    );
    return res.rows.map(eintragAus);
  }
}

type LaufZeile = {
  vorkommen_id: string;
  erinnerung_id: string;
  konto_id: string;
  geplant_fuer: Date;
  status: KlaraErinnerungLaufStatus;
  versuch: number;
  besitzer: string | null;
  lease_bis: Date | null;
  aktualisiert_am: Date;
  data: {
    art: KlaraErinnerungLaufArt;
    meldungId: string;
    ergebnis: KlaraErinnerungLauf["ergebnis"];
  };
};

function laufAus(z: LaufZeile): KlaraErinnerungLauf {
  return {
    vorkommenId: z.vorkommen_id,
    erinnerungId: z.erinnerung_id,
    kontoId: z.konto_id,
    geplantFuer: z.geplant_fuer.toISOString(),
    status: z.status,
    versuch: z.versuch,
    besitzer: z.besitzer,
    leaseBis: z.lease_bis ? z.lease_bis.toISOString() : null,
    aktualisiertAm: z.aktualisiert_am.toISOString(),
    art: z.data.art,
    meldungId: z.data.meldungId,
    ergebnis: z.data.ergebnis ?? {},
  };
}

const LAUF_SPALTEN =
  "vorkommen_id, erinnerung_id, konto_id, geplant_fuer, status, versuch, besitzer, lease_bis, aktualisiert_am, data";

export class PgKlaraErinnerungLaufRepo implements KlaraErinnerungLaufRepo {
  constructor(private readonly pool: Pool) {}

  async uebernimm(u: LaufUebernahme): Promise<KlaraErinnerungLauf | null> {
    // EIN Befehl: anlegen, oder — nur bei abgelaufener Berechtigung bzw. gescheitertem Lauf mit
    // Restversuchen — übernehmen. Zwei Prozesse, die gleichzeitig kommen, bekommen höchstens
    // einmal eine Zeile zurück (Zeilensperre der Konfliktbehandlung).
    // Nacharbeit 17: nur, solange die Erinnerung BESTEHT — geprüft unter `FOR SHARE` auf ihrer
    // Zeile, derselben Sperre, die `entferneBedingt` mit `FOR UPDATE` nimmt. Wurde sie gerade
    // gelöscht, entsteht kein verwaister Lauf (keine Zeile zurück = nicht übernommen).
    const res = await this.pool.query<LaufZeile>(
      `INSERT INTO klara_erinnerung_laeufe AS l (${LAUF_SPALTEN})
       SELECT $1::text, $2::text, $3::text, $4::timestamptz, 'laeuft', 1, $5::text,
              $6::timestamptz, $7::timestamptz, $8::jsonb
        WHERE EXISTS (SELECT 1 FROM klara_erinnerungen WHERE id = $2::text FOR SHARE)
       ON CONFLICT (vorkommen_id) DO UPDATE
         SET status = 'laeuft', versuch = l.versuch + 1, besitzer = EXCLUDED.besitzer,
             lease_bis = EXCLUDED.lease_bis, aktualisiert_am = EXCLUDED.aktualisiert_am
       WHERE (l.status = 'laeuft' AND l.lease_bis < $7)
          OR ((l.status = 'fehlgeschlagen' OR ${fortsetzbarSql("l.")}) AND l.versuch < $9)
       RETURNING ${LAUF_SPALTEN.split(", ")
         .map((s) => `l.${s}`)
         .join(", ")}`,
      [
        u.vorkommenId,
        u.erinnerungId,
        u.kontoId,
        new Date(u.geplantFuer),
        u.besitzer,
        new Date(u.jetzt + u.leaseMs),
        new Date(u.jetzt),
        JSON.stringify({ art: u.art, meldungId: u.meldungId, ergebnis: {} }),
        KLARA_ERINNERUNG_MAX_VERSUCHE,
      ],
    );
    return res.rows[0] ? laufAus(res.rows[0]) : null;
  }

  async hole(vorkommenId: string): Promise<KlaraErinnerungLauf | null> {
    const res = await this.pool.query<LaufZeile>(
      `SELECT ${LAUF_SPALTEN} FROM klara_erinnerung_laeufe WHERE vorkommen_id = $1`,
      [vorkommenId],
    );
    return res.rows[0] ? laufAus(res.rows[0]) : null;
  }

  async schliesse(
    vorkommenId: string,
    besitzer: string,
    status: KlaraErinnerungLaufStatus,
    ergebnis: KlaraErinnerungLauf["ergebnis"],
    jetzt: number,
  ): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE klara_erinnerung_laeufe
          SET status = $3, lease_bis = NULL, aktualisiert_am = $4,
              data = jsonb_set(data, '{ergebnis}', $5::jsonb)
        WHERE vorkommen_id = $1 AND status = 'laeuft' AND besitzer = $2`,
      [vorkommenId, besitzer, status, new Date(jetzt), JSON.stringify(ergebnis)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async vermerke(
    vorkommenId: string,
    besitzer: string,
    ergebnis: KlaraErinnerungLauf["ergebnis"],
    jetzt: number,
  ): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE klara_erinnerung_laeufe
          SET aktualisiert_am = $3, data = jsonb_set(data, '{ergebnis}', $4::jsonb)
        WHERE vorkommen_id = $1 AND status = 'laeuft' AND besitzer = $2`,
      [vorkommenId, besitzer, new Date(jetzt), JSON.stringify(ergebnis)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async setze(
    vorkommenId: string,
    von: readonly KlaraErinnerungLaufStatus[],
    status: KlaraErinnerungLaufStatus,
    ergebnis: KlaraErinnerungLauf["ergebnis"] | null,
    versuch: number | null,
    jetzt: number,
  ): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE klara_erinnerung_laeufe
          SET status = $3, lease_bis = NULL, aktualisiert_am = $4,
              versuch = COALESCE($5::int, versuch),
              data = CASE WHEN $6::jsonb IS NULL THEN data ELSE jsonb_set(data, '{ergebnis}', $6::jsonb) END
        WHERE vorkommen_id = $1 AND status = ANY($2::text[])`,
      [
        vorkommenId,
        [...von],
        status,
        new Date(jetzt),
        versuch,
        ergebnis === null ? null : JSON.stringify(ergebnis),
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async fuerErinnerung(erinnerungId: string, limit: number): Promise<KlaraErinnerungLauf[]> {
    const res = await this.pool.query<LaufZeile>(
      `SELECT ${LAUF_SPALTEN} FROM klara_erinnerung_laeufe WHERE erinnerung_id = $1
        ORDER BY geplant_fuer DESC LIMIT $2`,
      [erinnerungId, limit],
    );
    return res.rows.map(laufAus);
  }

  async wiederaufzunehmen(
    jetzt: number,
    maxVersuche: number,
    limit: number,
  ): Promise<KlaraErinnerungLauf[]> {
    const res = await this.pool.query<LaufZeile>(
      `WITH kandidaten AS (
          SELECT ${LAUF_SPALTEN},
             row_number() OVER (PARTITION BY konto_id ORDER BY geplant_fuer, vorkommen_id) AS konto_rang
          FROM klara_erinnerung_laeufe
          WHERE (status = 'laeuft' AND lease_bis < $1)
             OR ((status = 'fehlgeschlagen' OR ${fortsetzbarSql("")}) AND versuch < $2)
        ) SELECT ${LAUF_SPALTEN} FROM kandidaten ORDER BY konto_rang, geplant_fuer LIMIT $3`,
      [new Date(jetzt), maxVersuche, limit],
    );
    return res.rows.map(laufAus);
  }

  async zaehle(
    kontoId: string | null,
    jetzt: number,
    erinnerungIds?: readonly string[],
  ): Promise<Record<KlaraErinnerungLaufStatus | "haengend", number>> {
    const res = await this.pool.query<{ status: KlaraErinnerungLaufStatus; n: number; h: number }>(
      `SELECT status, count(*)::int AS n,
              count(*) FILTER (WHERE status = 'laeuft' AND lease_bis < $2)::int AS h
         FROM klara_erinnerung_laeufe WHERE ($1::text IS NULL OR konto_id = $1)
          AND ($3::text[] IS NULL OR erinnerung_id = ANY($3::text[])) GROUP BY status`,
      [kontoId, new Date(jetzt), erinnerungIds ?? null],
    );
    const z = leereZaehlung();
    for (const r of res.rows) {
      z[r.status] = r.n;
      z.haengend += r.h;
    }
    return z;
  }

  async entferneFuerErinnerung(erinnerungId: string): Promise<void> {
    await this.pool.query("DELETE FROM klara_erinnerung_laeufe WHERE erinnerung_id = $1", [
      erinnerungId,
    ]);
  }

  async gibFrei(vorkommenId: string, besitzer: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM klara_erinnerung_laeufe
        WHERE vorkommen_id = $1 AND status = 'laeuft' AND besitzer = $2`,
      [vorkommenId, besitzer],
    );
    return (res.rowCount ?? 0) > 0;
  }
}

export class PgKlaraErinnerungMeldungRepo implements KlaraErinnerungMeldungRepo {
  constructor(private readonly pool: Pool) {}

  async schreibe(
    m: KlaraErinnerungMeldung,
    bedingung?: MeldungBedingung,
  ): Promise<MeldungSchreibergebnis> {
    const werte = [m.id, m.kontoId, m.erinnerungId, m.zugestelltAm, JSON.stringify(m)];
    // Verschiedene Ausführer können disjunkte Teile desselben Stapels halten. Der gemeinsame
    // dauerhafte Sammelbeleg vereinigt diese Mengen unter der Konfliktsperre der Meldungszeile.
    const konflikt = ["zusammenfassung", "uebersprungen"].includes(m.art)
      ? `ON CONFLICT (id) DO UPDATE SET data = jsonb_set(
           klara_erinnerung_meldungen.data, '{vorkommen}',
           (SELECT jsonb_agg(v ORDER BY v) FROM (
             SELECT DISTINCT v FROM jsonb_array_elements(
               (klara_erinnerung_meldungen.data->'vorkommen') || (EXCLUDED.data->'vorkommen')) AS x(v)
           ) AS alle))
         WHERE klara_erinnerung_meldungen.konto_id = EXCLUDED.konto_id
           AND klara_erinnerung_meldungen.erinnerung_id = EXCLUDED.erinnerung_id
           AND klara_erinnerung_meldungen.data->>'art' = EXCLUDED.data->>'art'
           AND NOT ((klara_erinnerung_meldungen.data->'vorkommen') @> (EXCLUDED.data->'vorkommen'))`
      : "ON CONFLICT (id) DO NOTHING";
    // Mit Bedingung EIN Befehl: die Erinnerungszeile wird mit FOR SHARE gelesen. Eine gleichzeitige
    // Bearbeitung (Pause, Absage, Terminänderung — `UPDATE … WHERE fassung`) wartet bis hierher oder
    // war vorher fertig; im zweiten Fall sieht die Prüfung die neue Fassung und schreibt nichts.
    // Nacharbeit 4: ebenso die Kontozeile der Empfängerin (gesperrt/abgelaufen → nichts) und die
    // eigene Quelle (gelöscht → nichts). Eine Sperre oder Löschung wartet bis hierher oder war vorher
    // fertig; dann ist die Meldung nicht geschrieben (`veraltet`), und `wirke` liest neu.
    if (!bedingung) {
      return this.ergebnis(
        await this.pool.query(
          `INSERT INTO klara_erinnerung_meldungen (id, konto_id, erinnerung_id, zugestellt_am, data)
           VALUES ($1, $2, $3, $4, $5) ${konflikt}`,
          werte,
        ),
        m,
      );
    }
    // Dieselbe Bedingung wie für den Routinenbericht (`bedingungSql`), in DIESEM Befehl.
    const { und, params } = bedingungSql(bedingung, werte.length + 1);
    const res = await this.pool.query(
      `INSERT INTO klara_erinnerung_meldungen (id, konto_id, erinnerung_id, zugestellt_am, data)
       SELECT $1::text, $2::text, $3::text, $4::timestamptz, $5::jsonb
        WHERE ${und.join("\n          AND ")}
       ${konflikt}`,
      [...werte, ...params],
    );
    return this.ergebnis(res, m);
  }

  private async ergebnis(
    res: { rowCount: number | null },
    m: KlaraErinnerungMeldung,
  ): Promise<MeldungSchreibergebnis> {
    if ((res.rowCount ?? 0) > 0) {
      return "geschrieben";
    }
    const beleg = await this.hole(m.id);
    return beleg && umfasstMeldung(beleg, m) ? "vorhanden" : "veraltet";
  }

  async hole(id: string): Promise<KlaraErinnerungMeldung | null> {
    const res = await this.pool.query<{ data: KlaraErinnerungMeldung }>(
      "SELECT data FROM klara_erinnerung_meldungen WHERE id = $1",
      [id],
    );
    return res.rows[0]?.data ?? null;
  }

  async fuerKonto(kontoId: string, limit: number): Promise<KlaraErinnerungMeldung[]> {
    const res = await this.pool.query<{ data: KlaraErinnerungMeldung }>(
      `SELECT data FROM klara_erinnerung_meldungen WHERE konto_id = $1
        ORDER BY zugestellt_am DESC, id DESC LIMIT $2`,
      [kontoId, limit],
    );
    return res.rows.map((r) => r.data);
  }

  async entferneFuerErinnerung(erinnerungId: string): Promise<void> {
    await this.pool.query("DELETE FROM klara_erinnerung_meldungen WHERE erinnerung_id = $1", [
      erinnerungId,
    ]);
  }
}

export class PgKlaraErinnerungEinstellungRepo implements KlaraErinnerungEinstellungRepo {
  constructor(private readonly pool: Pool) {}

  async hole(kontoId: string): Promise<KlaraErinnerungEinstellungen | null> {
    const res = await this.pool.query<{ data: KlaraErinnerungEinstellungen }>(
      "SELECT data FROM klara_erinnerung_einstellungen WHERE konto_id = $1",
      [kontoId],
    );
    return res.rows[0]?.data ?? null;
  }

  async schreibe(e: KlaraErinnerungEinstellungen): Promise<boolean> {
    const res =
      e.fassung === 1
        ? await this.pool.query(
            `INSERT INTO klara_erinnerung_einstellungen (konto_id, fassung, geaendert_am, data)
             VALUES ($1, $2, $3, $4) ON CONFLICT (konto_id) DO NOTHING`,
            [e.kontoId, e.fassung, e.geaendertAm, JSON.stringify(e)],
          )
        : await this.pool.query(
            `UPDATE klara_erinnerung_einstellungen SET fassung = $2, geaendert_am = $3, data = $4
              WHERE konto_id = $1 AND fassung = $5`,
            [e.kontoId, e.fassung, e.geaendertAm, JSON.stringify(e), e.fassung - 1],
          );
    return (res.rowCount ?? 0) > 0;
  }
}

export function pgErinnerungAblage(pool: Pool): KlaraErinnerungAblage {
  return {
    erinnerungen: new PgKlaraErinnerungRepo(pool),
    laeufe: new PgKlaraErinnerungLaufRepo(pool),
    meldungen: new PgKlaraErinnerungMeldungRepo(pool),
    einstellungen: new PgKlaraErinnerungEinstellungRepo(pool),
    async brecheLaufAb(kontoId, id, vorkommenId, fassung, jetzt) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const e = await client.query(
          `SELECT id FROM klara_erinnerungen
          WHERE id = $1 AND konto_id = $2 AND fassung = $3 FOR SHARE`,
          [id, kontoId, fassung],
        );
        if (e.rowCount !== 1) {
          await client.query("ROLLBACK");
          return false;
        }
        const r = await client.query<LaufZeile>(
          `SELECT ${LAUF_SPALTEN} FROM klara_erinnerung_laeufe
          WHERE vorkommen_id = $1 AND erinnerung_id = $2 AND konto_id = $3 AND status = 'laeuft' FOR UPDATE`,
          [vorkommenId, id, kontoId],
        );
        const lauf = r.rows[0] ? laufAus(r.rows[0]) : null;
        if (!lauf) {
          await client.query("ROLLBACK");
          return false;
        }
        // Die exklusive Laufsperre wartet auf bereits begonnene bedingte Wirkungen. Ein FRISCHER
        // Befehl nach dem Sperren sieht deren echten Ausgang; neue Wirkungen warten und scheitern.
        const m = await client.query<{ data: KlaraErinnerungMeldung }>(
          "SELECT data FROM klara_erinnerung_meldungen WHERE id = $1",
          [lauf.ergebnis.pflegeMeldungId ?? lauf.meldungId],
        );
        const n = await client.query<{ data: KlaraNotiz }>(
          "SELECT data FROM klara_notizen WHERE konto_id = $1 AND vorgang = $2",
          [kontoId, lauf.ergebnis.pflegeNotizVorgang ?? ergebnisVorgang(vorkommenId)],
        );
        await client.query(
          `UPDATE klara_erinnerung_laeufe SET status = 'abgebrochen', lease_bis = NULL,
          aktualisiert_am = $2, data = jsonb_set(data, '{ergebnis}', $3::jsonb)
          WHERE vorkommen_id = $1`,
          [
            vorkommenId,
            new Date(jetzt),
            JSON.stringify(abbruchErgebnis(lauf, m.rows[0]?.data ?? null, n.rows[0]?.data ?? null)),
          ],
        );
        await client.query("COMMIT");
        return true;
      } catch (fehler) {
        await client.query("ROLLBACK");
        throw fehler;
      } finally {
        client.release();
      }
    },
    async entferneKomplett(kontoId, id) {
      // Ein Statement bleibt auch am gated-pool eine Transaktion. Die Elternzeile sperrt
      // gleichzeitig Übernahmen und bedingte Meldungen; ein Fehler in einem DELETE rollt alles zurück.
      const r = await pool.query<{ geloescht: boolean }>(
        `WITH auftrag AS (
           DELETE FROM klara_erinnerungen WHERE id = $1 AND konto_id = $2 RETURNING id
         ), laeufe AS (
           DELETE FROM klara_erinnerung_laeufe WHERE erinnerung_id IN (SELECT id FROM auftrag)
         ), meldungen AS (
           DELETE FROM klara_erinnerung_meldungen WHERE erinnerung_id IN (SELECT id FROM auftrag)
         ) SELECT EXISTS (SELECT 1 FROM auftrag) AS geloescht`,
        [id, kontoId],
      );
      return r.rows[0]?.geloescht ?? false;
    },
  };
}

// ------------------------------------------------------------------------------------------------
// DIE SICHT — Anzeige und Lage aus Plan UND tatsächlichen Läufen (AW18-K01, AW18-K10).
// ------------------------------------------------------------------------------------------------

export type KlaraErinnerungLage =
  | "geplant"
  | "faellig"
  | "laeuft"
  | "wartet_auf_klaerung"
  | "teilweise_erledigt"
  | "abgeschlossen"
  | "fehlgeschlagen"
  | "gestoppt"
  | "pausiert"
  | "erledigt"
  | "abgesagt"
  | "beendet";

export interface KlaraErinnerungZeitpunkt {
  readonly vorkommenId: string;
  readonly schluessel: string;
  readonly zeitpunkt: string;
  readonly datum: string;
  readonly uhrzeit: string;
  readonly versatz: string;
  readonly hinweis: ZeitHinweis | null;
  readonly verschoben: boolean;
}

export type KlaraErinnerungSerienende =
  | { readonly art: "einmalig" }
  | { readonly art: "datum"; readonly bis: string }
  | { readonly art: "anzahl"; readonly anzahl: number }
  | { readonly art: "offen"; readonly hoechstens: number };

export interface KlaraErinnerungAnzeige {
  readonly naechste: KlaraErinnerungZeitpunkt | null;
  readonly kommende: readonly KlaraErinnerungZeitpunkt[];
  readonly serienende: KlaraErinnerungSerienende;
  /** Nur bei Frist-Vorlauf: die ganztägige Frist als DATUM im Geltungsbereich der Zeitzone. */
  readonly frist: { readonly datum: string; readonly vorlaufTage: number } | null;
  /** Ausgelassene oder umgelegte Vorkommen wegen Sommerzeit — sichtbar, nie still. */
  readonly sommerzeitHinweise: readonly KlaraErinnerungZeitpunkt[];
  readonly ziel: typeof KLARA_ERINNERUNG_ZIEL;
  readonly erwartetesErgebnis:
    | "meldung"
    | "meldung_mit_aufgabenpruefung"
    | "meldung_mit_zusammenfassung"
    /** EQF-07: ein Bericht in „Meine Notizen“ je Termin, dazu eine Meldung mit dem Ergebnis. */
    | "bericht_in_notizen";
}

function zeitpunktVon(v: KlaraErinnerungVorkommen, zone: string): KlaraErinnerungZeitpunkt | null {
  if (v.ms === null) {
    return null;
  }
  const l = lokalVon(v.ms, zone);
  return {
    vorkommenId: v.id,
    schluessel: v.schluessel,
    zeitpunkt: new Date(v.ms).toISOString(),
    datum: l.datum,
    uhrzeit: l.uhrzeit,
    versatz: l.versatz,
    hinweis: v.hinweis,
    verschoben: v.ausnahme?.art === "verschoben",
  };
}

function hinweisOhneZeit(v: KlaraErinnerungVorkommen): KlaraErinnerungZeitpunkt {
  return {
    vorkommenId: v.id,
    schluessel: v.schluessel,
    zeitpunkt: "",
    datum: v.lokal.datum,
    uhrzeit: v.lokal.uhrzeit,
    versatz: "",
    hinweis: v.hinweis,
    verschoben: false,
  };
}

export function anzeigeVon(
  e: KlaraErinnerungPlan & Pick<KlaraErinnerung, "aktion">,
  ab: number,
): KlaraErinnerungAnzeige {
  const alle = vorkommenVon(e, { von: ab, stoppNach: ab, kuenftig: 10 });
  const kommend = alle
    .filter((v) => istZuBearbeiten(v) && v.ms > ab)
    .sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0));
  const kommende = kommend
    .slice(0, 5)
    .map((v) => zeitpunktVon(v, e.zeitzone))
    .filter((z): z is KlaraErinnerungZeitpunkt => z !== null);
  const sommerzeitHinweise = alle
    .filter((v) => v.hinweis !== null && (v.ms === null || v.ms > ab))
    .slice(0, 10)
    .map((v) => zeitpunktVon(v, e.zeitzone) ?? hinweisOhneZeit(v));
  const p = e.zeitplan;
  const serienende: KlaraErinnerungSerienende =
    p.art !== "serie"
      ? { art: "einmalig" }
      : p.wiederholung.bis !== null
        ? { art: "datum", bis: p.wiederholung.bis }
        : p.wiederholung.anzahl !== null
          ? { art: "anzahl", anzahl: p.wiederholung.anzahl }
          : { art: "offen", hoechstens: VORKOMMEN_HOECHSTENS };
  return {
    naechste: kommende[0] ?? null,
    kommende,
    serienende,
    frist: p.art === "frist" ? { datum: p.fristDatum, vorlaufTage: p.vorlaufTage } : null,
    sommerzeitHinweise,
    ziel: KLARA_ERINNERUNG_ZIEL,
    erwartetesErgebnis:
      e.aktion === "aufgabe_pruefen"
        ? "meldung_mit_aufgabenpruefung"
        : e.aktion === "inhalt_zusammenfassen"
          ? "meldung_mit_zusammenfassung"
          : e.aktion === "routine_bericht"
            ? "bericht_in_notizen"
            : "meldung",
  };
}

const ABGESCHLOSSEN: readonly KlaraErinnerungLaufStatus[] = [
  "zugestellt",
  "verpasst_gemeldet",
  "zusammengefasst",
  "uebersprungen",
];

/** Die Lage aus Status, Steuerstand und den tatsächlichen Läufen — nie aus der Uhrzeit allein. */
export function lageVon(
  eintrag: KlaraErinnerungEintrag,
  laeufe: readonly KlaraErinnerungLauf[],
  jetzt: number,
): KlaraErinnerungLage {
  const e = eintrag.erinnerung;
  if (e.status !== "aktiv") {
    return e.status;
  }
  if (laeufe.some((l) => l.status === "laeuft")) {
    return "laeuft";
  }
  if (laeufe.some((l) => l.status === "unklar")) {
    return "wartet_auf_klaerung";
  }
  if (laeufe.some((l) => l.status === "fehlgeschlagen")) {
    return "fehlgeschlagen";
  }
  if (eintrag.steuer.naechste !== null && eintrag.steuer.naechste <= jetzt) {
    return "faellig";
  }
  if (eintrag.steuer.naechste !== null) {
    const juengster = laeufe[0];
    return juengster?.status === "teilweise" ? "teilweise_erledigt" : "geplant";
  }
  // Keine Fälligkeit mehr: abgeschlossen ist nur, was ein Lauf belegt.
  const zuBearbeiten = vorkommenVon(e).filter(istZuBearbeiten);
  if (zuBearbeiten.length === 0) {
    return "abgeschlossen";
  }
  const nachId = new Map(laeufe.map((l) => [l.vorkommenId, l]));
  const ohneLauf = zuBearbeiten.filter((v) => !nachId.has(v.id));
  if (ohneLauf.some((v) => v.ms <= jetzt)) {
    return "faellig";
  }
  if (ohneLauf.length > 0) {
    return "geplant";
  }
  if (laeufe.some((l) => l.status === "gestoppt")) {
    return "gestoppt";
  }
  if (laeufe.some((l) => l.status === "teilweise")) {
    return "teilweise_erledigt";
  }
  return laeufe.every((l) => ABGESCHLOSSEN.includes(l.status) || l.status === "abgebrochen")
    ? "abgeschlossen"
    : "geplant";
}

// ------------------------------------------------------------------------------------------------
// DER DIENST — die Bedienung der Person.
// ------------------------------------------------------------------------------------------------

export type KlaraErinnerungGrund =
  | "eingabe"
  | "unbekannt"
  | "quelle_unbekannt"
  | "vorgang_belegt"
  | "voll"
  | "konflikt"
  | "vergangen"
  | "zustand"
  | "klaerung"
  | "empfaenger"
  /** EQF-07: verlangte Wirkung (Versand, Export …) ist nicht beauftragt. */
  | "wirkung_nicht_beauftragt"
  /** EQF-07: die Ergebnisnotiz wurde inzwischen geändert — Rücknahme würde fremde Arbeit löschen. */
  | "fremd_geaendert";

export class KlaraErinnerungFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: KlaraErinnerungGrund,
    message: string,
  ) {
    super(message);
    this.name = "KlaraErinnerungFehler";
  }
}

function eingabeFehler(message: string): KlaraErinnerungFehler {
  return new KlaraErinnerungFehler(400, "eingabe", message);
}

function wahl<T extends string>(wert: unknown, erlaubt: readonly T[], feld: string): T | null {
  if (wert === undefined || wert === null) {
    return null;
  }
  if (typeof wert !== "string" || !(erlaubt as readonly string[]).includes(wert)) {
    throw eingabeFehler(`${feld} muss einer der Werte ${erlaubt.join(", ")} sein.`);
  }
  return wert as T;
}

function ganzzahl(wert: unknown, min: number, max: number, feld: string): number {
  if (typeof wert !== "number" || !Number.isSafeInteger(wert) || wert < min || wert > max) {
    throw eingabeFehler(`${feld} ist eine ganze Zahl von ${min} bis ${max}.`);
  }
  return wert;
}

function objekt(roh: unknown, feld: string): Record<string, unknown> {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    throw eingabeFehler(`${feld} ist Pflicht.`);
  }
  return roh as Record<string, unknown>;
}

function datumAus(wert: unknown, feld: string): string {
  if (!istDatum(wert)) {
    throw eingabeFehler(`${feld} ist ein Datum JJJJ-MM-TT.`);
  }
  return wert;
}

function uhrzeitAus(wert: unknown, feld: string): string {
  if (!istUhrzeit(wert)) {
    throw eingabeFehler(`${feld} ist eine Uhrzeit HH:MM.`);
  }
  return wert;
}

export function zeitzoneAus(wert: unknown): string {
  if (!istZeitzone(wert)) {
    throw eingabeFehler("zeitzone ist eine IANA-Zeitzone wie Europe/Berlin.");
  }
  return wert;
}

export function zeitplanAus(roh: unknown): Zeitplan {
  const o = objekt(roh, "zeitplan");
  const art = wahl(o.art, ["einmalig", "serie", "frist"] as const, "zeitplan.art");
  if (art === "einmalig") {
    return {
      art,
      datum: datumAus(o.datum, "zeitplan.datum"),
      uhrzeit: uhrzeitAus(o.uhrzeit, "zeitplan.uhrzeit"),
    };
  }
  if (art === "frist") {
    return {
      art,
      fristDatum: datumAus(o.fristDatum, "zeitplan.fristDatum"),
      vorlaufTage: ganzzahl(o.vorlaufTage, 0, 365, "zeitplan.vorlaufTage"),
      uhrzeit: uhrzeitAus(o.uhrzeit, "zeitplan.uhrzeit"),
    };
  }
  if (art === "serie") {
    const w = objekt(o.wiederholung, "zeitplan.wiederholung");
    const takt = wahl(
      w.takt,
      ["taeglich", "woechentlich", "monatlich"] as const,
      "wiederholung.takt",
    );
    if (takt === null) {
      throw eingabeFehler("wiederholung.takt ist Pflicht.");
    }
    const tage = w.wochentage === undefined ? [] : w.wochentage;
    if (
      !Array.isArray(tage) ||
      tage.length > 7 ||
      tage.some((t) => typeof t !== "number" || !Number.isInteger(t) || t < 1 || t > 7)
    ) {
      throw eingabeFehler("wiederholung.wochentage sind Zahlen 1 (Montag) bis 7 (Sonntag).");
    }
    if (takt !== "woechentlich" && tage.length > 0) {
      throw eingabeFehler("wiederholung.wochentage gehören nur zum Takt woechentlich.");
    }
    const bis = w.bis === undefined || w.bis === null ? null : datumAus(w.bis, "wiederholung.bis");
    const anzahl =
      w.anzahl === undefined || w.anzahl === null
        ? null
        : ganzzahl(w.anzahl, 1, VORKOMMEN_HOECHSTENS, "wiederholung.anzahl");
    const datum = datumAus(o.datum, "zeitplan.datum");
    if (bis !== null && bis < datum) {
      throw eingabeFehler("wiederholung.bis liegt vor dem Beginn.");
    }
    const wiederholung: Wiederholung = {
      takt,
      intervall:
        w.intervall === undefined ? 1 : ganzzahl(w.intervall, 1, 52, "wiederholung.intervall"),
      wochentage: [...new Set(tage as Wochentag[])].sort(),
      bis,
      anzahl,
    };
    return { art, datum, uhrzeit: uhrzeitAus(o.uhrzeit, "zeitplan.uhrzeit"), wiederholung };
  }
  throw eingabeFehler("zeitplan.art ist Pflicht: einmalig, serie oder frist.");
}

function sommerzeitAus(roh: unknown, vorgabe: SommerzeitRegel): SommerzeitRegel {
  if (roh === undefined) {
    return vorgabe;
  }
  const o = objekt(roh, "sommerzeit");
  return {
    luecke:
      wahl(o.luecke, ["verschieben", "auslassen"] as const, "sommerzeit.luecke") ?? vorgabe.luecke,
    doppelt: wahl(o.doppelt, ["erste", "zweite"] as const, "sommerzeit.doppelt") ?? vorgabe.doppelt,
  };
}

function verpasstAus(roh: unknown, vorgabe: KlaraErinnerungVerpasst): KlaraErinnerungVerpasst {
  if (roh === undefined) {
    return vorgabe;
  }
  const o = objekt(roh, "verpasst");
  return {
    regel: wahl(o.regel, VERPASST_REGELN, "verpasst.regel") ?? vorgabe.regel,
    grenzeMinuten:
      o.grenzeMinuten === undefined
        ? vorgabe.grenzeMinuten
        : ganzzahl(o.grenzeMinuten, 0, KLARA_ERINNERUNG_GRENZE_MAX, "verpasst.grenzeMinuten"),
  };
}

function titelAus(wert: unknown): string {
  if (
    typeof wert !== "string" ||
    wert.trim().length === 0 ||
    wert.length > KLARA_ERINNERUNG_TITEL_MAX
  ) {
    throw eingabeFehler(
      `titel ist Pflicht und höchstens ${KLARA_ERINNERUNG_TITEL_MAX} Zeichen lang.`,
    );
  }
  return wert.trim();
}

function notizAus(wert: unknown): string {
  if (wert === undefined) {
    return "";
  }
  if (typeof wert !== "string" || wert.length > KLARA_ERINNERUNG_NOTIZ_MAX) {
    throw eingabeFehler(`notiz ist höchstens ${KLARA_ERINNERUNG_NOTIZ_MAX} Zeichen lang.`);
  }
  return wert;
}

function kurz(text: string, max: number): string {
  const flach = text.trim().replace(/\s+/g, " ");
  return [...flach].length > max ? `${[...flach].slice(0, max - 1).join("")}…` : flach;
}

function kennung(wert: unknown, feld: string): string {
  if (typeof wert !== "string" || !ID_RE.test(wert)) {
    throw eingabeFehler(`${feld} ist Pflicht.`);
  }
  return wert;
}

export interface KlaraErinnerungEingabe {
  vorgang?: unknown;
  bereich?: unknown;
  titel?: unknown;
  notiz?: unknown;
  bezug?: unknown;
  zeitzone?: unknown;
  zeitplan?: unknown;
  sommerzeit?: unknown;
  verpasst?: unknown;
  aktion?: unknown;
  ziel?: unknown;
  /** EQF-07: Routinendefinition (Abschnitte, feste Notizen, Wirkungen) bei `routine_bericht`. */
  routine?: unknown;
}

/** EQF-07: Änderung einer Routine — in Worten (`text`) oder als neue Definition (`routine`). */
export interface KlaraRoutinenAenderungEingabe {
  fassung?: unknown;
  text?: unknown;
  routine?: unknown;
  /** `false`: nur deuten und zeigen, nichts ändern. */
  anwenden?: unknown;
}

export interface KlaraErinnerungAenderung {
  fassung?: unknown;
  titel?: unknown;
  notiz?: unknown;
  zeitzone?: unknown;
  zeitplan?: unknown;
  sommerzeit?: unknown;
  verpasst?: unknown;
}

export type KlaraErinnerungStatusAktion =
  | "pausieren"
  | "fortsetzen"
  | "erledigen"
  | "absagen"
  | "zuruecknehmen"
  | "beenden";

export type KlaraErinnerungVorkommenAktion =
  | "absagen"
  | "erledigen"
  | "verschieben"
  | "zuruecknehmen";
export type KlaraErinnerungEntscheidung = "fortfuehren" | "verwerfen" | "beenden";

export interface KlaraErinnerungDienstDeps {
  readonly ablage: KlaraErinnerungAblage;
  readonly quellschutz?: ErinnerungQuellschutz;
  /** `entferne` braucht nur die Rücknahme eines Routinenberichts (EQF-07). */
  readonly notizen?: Pick<KlaraNotizRepo, "hole"> &
    Partial<Pick<KlaraNotizRepo, "entferne" | "zuVorgang">>;
  readonly aufgaben?: Pick<KlaraAufgabeRepo, "hole">;
  readonly gespraeche?: Pick<KlaraGespraechRepo, "hole">;
  readonly wissenspflege?: PflegeLeser;
  /**
   * Die vorhandenen Konten — für die bewusste Übergabe (Empfängerin per Adresse, ihr Zugang HEUTE).
   * In `buildApp` ist das `AuthService`; ohne sie ist keine Übergabe möglich (409).
   */
  readonly personen?: {
    kontoPerAdresse(email: string): Promise<PersonLage | undefined>;
    kontoLesen(id: string): Promise<PersonLage | undefined>;
  };
  readonly jetzt?: () => number;
  readonly neueId?: () => string;
}

/** Was die Übergabe von einem Konto braucht — strukturell wie `PublicUser`. */
export interface PersonLage {
  readonly id: string;
  readonly name: string;
  readonly approved: boolean;
  readonly accessExpiresAt?: string;
}

/** Heute aktiv: vorhanden, freigegeben, Zugang nicht abgelaufen (wie `zugangsstand` = aktiv/befristet). */
export function kontoHeuteAktiv(
  k: { readonly approved: boolean; readonly accessExpiresAt?: string } | undefined,
  jetzt: number,
): boolean {
  if (!k || !k.approved) {
    return false;
  }
  return !(k.accessExpiresAt && Date.parse(k.accessExpiresAt) <= jetzt);
}

export interface KlaraErinnerungVorschau {
  readonly deutung: ReturnType<typeof deuteZeitangabe> | null;
  readonly zeitzone: string;
  readonly zeitplan: Zeitplan | null;
  readonly anzeige: KlaraErinnerungAnzeige | null;
}

export class KlaraErinnerungDienst {
  private readonly ablage: KlaraErinnerungAblage;
  private readonly deps: KlaraErinnerungDienstDeps;
  private readonly jetzt: () => number;
  private readonly neueId: () => string;

  constructor(deps: KlaraErinnerungDienstDeps) {
    this.deps = deps;
    this.ablage = deps.ablage;
    this.jetzt = deps.jetzt ?? Date.now;
    this.neueId = deps.neueId ?? randomUUID;
  }

  uhr(): number {
    return this.jetzt();
  }

  /**
   * Die Vorschau VOR dem Anlegen: eine Freitextangabe wird gedeutet (oder ihre Klärung verlangt),
   * ein Zeitplan wird mit Datum, lokaler Uhrzeit, Zeitzone, nächsten Ausführungen, Serienende,
   * Sommerzeitlage, Ziel und erwartetem Ergebnis gezeigt. Es wird nichts gespeichert.
   */
  vorschau(eingabe: {
    text?: unknown;
    zeitzone?: unknown;
    zeitplan?: unknown;
    sommerzeit?: unknown;
    aktion?: unknown;
  }): KlaraErinnerungVorschau {
    const zeitzone = zeitzoneAus(eingabe.zeitzone);
    const jetzt = this.jetzt();
    let zeitplan: Zeitplan | null = null;
    let deutung: KlaraErinnerungVorschau["deutung"] = null;
    if (eingabe.zeitplan !== undefined) {
      zeitplan = zeitplanAus(eingabe.zeitplan);
    } else {
      if (
        typeof eingabe.text !== "string" ||
        eingabe.text.length === 0 ||
        eingabe.text.length > 500
      ) {
        throw eingabeFehler("text (höchstens 500 Zeichen) oder zeitplan ist Pflicht.");
      }
      deutung = deuteZeitangabe(eingabe.text, jetzt, zeitzone);
      if (deutung.art === "eindeutig") {
        zeitplan = { art: "einmalig", datum: deutung.datum, uhrzeit: deutung.uhrzeit };
      }
    }
    const aktion = wahl(eingabe.aktion, AKTIONEN, "aktion") ?? "erinnern";
    const anzeige = zeitplan
      ? anzeigeVon(
          {
            id: "vorschau",
            zeitplan,
            zeitzone,
            sommerzeit: sommerzeitAus(eingabe.sommerzeit, SOMMERZEIT_VORGABE),
            ausnahmen: {},
            aktion,
          },
          jetzt,
        )
      : null;
    return { deutung, zeitzone, zeitplan, anzeige };
  }

  async eintrag(kontoId: string, id: string): Promise<KlaraErinnerungEintrag> {
    const e = await this.ablage.erinnerungen.hole(kontoId, id);
    if (!e || !(await this.lesbar(e, kontoId))) {
      throw new KlaraErinnerungFehler(404, "unbekannt", "Erinnerung nicht gefunden.");
    }
    return e;
  }

  async liste(kontoId: string): Promise<KlaraErinnerungEintrag[]> {
    return this.sichtbare(
      await this.ablage.erinnerungen.liste(kontoId, KLARA_ERINNERUNG_MAX_JE_KONTO),
      kontoId,
    );
  }

  private async lesbar(e: KlaraErinnerungEintrag, kontoId: string): Promise<boolean> {
    return !this.deps.quellschutz || (await this.deps.quellschutz(e.erinnerung, kontoId)) !== null;
  }

  private async sichtbare(es: KlaraErinnerungEintrag[], kontoId: string) {
    const erlaubt = await Promise.all(es.map((e) => this.lesbar(e, kontoId)));
    return es.filter((_, i) => erlaubt[i]);
  }

  /** Erinnerungen, die diesem Konto bewusst übergeben wurden — nur reduziert sichtbar (Route). */
  async uebernommene(kontoId: string): Promise<KlaraErinnerungEintrag[]> {
    return this.sichtbare(
      await this.ablage.erinnerungen.uebernommene(kontoId, KLARA_ERINNERUNG_MAX_JE_KONTO),
      kontoId,
    );
  }

  // ----------------------------------------------------------------------------------------------
  // P07 · DER FREIWILLIGE, ERNEUT AUFRUFBARE EINRICHTUNGSASSISTENT — Zeitzone und Vorgaben.
  // ----------------------------------------------------------------------------------------------

  /** Die eigenen Vorgaben — ohne gespeicherte Zeile die Werkvorgaben (Zeitzone noch offen). */
  async einstellungen(kontoId: string): Promise<KlaraErinnerungEinstellungen> {
    const e = await this.ablage.einstellungen.hole(kontoId);
    return (
      e ?? {
        kontoId,
        zeitzone: null,
        sommerzeit: SOMMERZEIT_VORGABE,
        verpasst: { regel: "nachholen", grenzeMinuten: KLARA_ERINNERUNG_GRENZE_VORGABE },
        eingerichtetAm: null,
        fassung: 0,
        geaendertAm: new Date(0).toISOString(),
      }
    );
  }

  /**
   * Speichert die Vorgaben aus dem Assistenten. `abschliessen: true` vermerkt den Abschluss; der
   * Assistent bleibt trotzdem jederzeit erneut aufrufbar und ändert nie bestehende Erinnerungen.
   */
  async setzeEinstellungen(
    kontoId: string,
    eingabe: {
      fassung?: unknown;
      zeitzone?: unknown;
      sommerzeit?: unknown;
      verpasst?: unknown;
      abschliessen?: unknown;
    },
  ): Promise<KlaraErinnerungEinstellungen> {
    const alt = await this.einstellungen(kontoId);
    if (
      typeof eingabe.fassung !== "number" ||
      !Number.isSafeInteger(eingabe.fassung) ||
      eingabe.fassung < 0
    ) {
      throw eingabeFehler("fassung ist Pflicht (0 beim ersten Speichern).");
    }
    if (eingabe.fassung !== alt.fassung) {
      throw this.konflikt();
    }
    const jetztIso = new Date(this.jetzt()).toISOString();
    const neu: KlaraErinnerungEinstellungen = {
      kontoId,
      zeitzone:
        eingabe.zeitzone === undefined
          ? alt.zeitzone
          : eingabe.zeitzone === null
            ? null
            : zeitzoneAus(eingabe.zeitzone),
      sommerzeit: sommerzeitAus(eingabe.sommerzeit, alt.sommerzeit),
      verpasst: verpasstAus(eingabe.verpasst, alt.verpasst),
      eingerichtetAm: eingabe.abschliessen === true ? jetztIso : alt.eingerichtetAm,
      fassung: alt.fassung + 1,
      geaendertAm: jetztIso,
    };
    if (!(await this.ablage.einstellungen.schreibe(neu))) {
      throw this.konflikt();
    }
    return neu;
  }

  // ----------------------------------------------------------------------------------------------
  // AW18-K08 · BEWUSSTE ÜBERGABE an eine heute aktive Person.
  // ----------------------------------------------------------------------------------------------

  /**
   * Übergibt die Erinnerung bewusst an eine andere, HEUTE aktive Person (per Adresse) — oder nimmt
   * die Übergabe zurück (`an: null`). Nur für reine Erinnerungen (`erinnern`): Prüf- und
   * Zusammenfassungsaufträge lesen persönliche Inhalte und bleiben beim Eigentümer. Die Empfängerin
   * sieht Titel und Termine, nie Notiz, Bezug oder Quellinhalt. Unbekannt und nicht aktiv antworten
   * gleich — die Antwort verrät nichts über fremde Konten.
   */
  async uebergib(
    kontoId: string,
    id: string,
    eingabe: { fassung?: unknown; an?: unknown },
  ): Promise<{ eintrag: KlaraErinnerungEintrag; an: PersonLage | null }> {
    const alt = await this.mitFassung(kontoId, id, eingabe.fassung);
    if (eingabe.an === null) {
      return { eintrag: await this.schreibe(alt, { zustaendig: null }, false), an: null };
    }
    if (typeof eingabe.an !== "string" || eingabe.an.length === 0 || eingabe.an.length > 320) {
      throw eingabeFehler("an ist die E-Mail-Adresse der Person, die übernimmt (oder null).");
    }
    if (alt.erinnerung.aktion !== "erinnern") {
      throw new KlaraErinnerungFehler(
        409,
        "zustand",
        "Nur reine Erinnerungen lassen sich übergeben — Prüfungen und Zusammenfassungen lesen persönliche Inhalte.",
      );
    }
    const person = this.deps.personen
      ? await this.deps.personen.kontoPerAdresse(eingabe.an.trim().toLowerCase())
      : undefined;
    if (!person || !kontoHeuteAktiv(person, this.jetzt()) || person.id === kontoId) {
      throw new KlaraErinnerungFehler(
        409,
        "empfaenger",
        "An diese Adresse kann die Erinnerung nicht übergeben werden.",
      );
    }
    const zustaendig: KlaraErinnerungZustaendig = {
      kontoId: person.id,
      seit: new Date(this.jetzt()).toISOString(),
      von: kontoId,
    };
    if (
      this.deps.quellschutz &&
      (await this.deps.quellschutz(alt.erinnerung, person.id)) === null
    ) {
      throw new KlaraErinnerungFehler(
        409,
        "empfaenger",
        "An diese Adresse kann die Erinnerung nicht übergeben werden.",
      );
    }
    return { eintrag: await this.schreibe(alt, { zustaendig }, false), an: person };
  }

  /** Die Zuständige gibt eine übergebene Erinnerung bewusst an den Eigentümer zurück. */
  async gibZurueck(kontoId: string, id: string): Promise<void> {
    const e = await this.ablage.erinnerungen.holeSystem(id);
    if (!e || e.erinnerung.zustaendig?.kontoId !== kontoId) {
      throw new KlaraErinnerungFehler(404, "unbekannt", "Erinnerung nicht gefunden.");
    }
    await this.schreibe(e, { zustaendig: null }, false);
  }

  // ----------------------------------------------------------------------------------------------
  // EQF-07 · PERSÖNLICHE ROUTINEN — Definition, Änderung in Worten, Rücknahme eines Ergebnisses.
  // ----------------------------------------------------------------------------------------------

  /** Prüft eine Routinendefinition; feste Quellen müssen EIGENE, vorhandene Notizen sein. */
  private async routineGeprueft(
    kontoId: string,
    roh: unknown,
    fassung: number,
  ): Promise<KlaraRoutine> {
    let routine: KlaraRoutine;
    try {
      routine = routineAus(roh, fassung);
    } catch (fehler) {
      if (fehler instanceof RoutineEingabeFehler) {
        throw new KlaraErinnerungFehler(400, fehler.grund, fehler.message);
      }
      throw fehler;
    }
    for (const id of routine.notizIds) {
      const n = this.deps.notizen ? await this.deps.notizen.hole(kontoId, id) : null;
      if (!n) {
        throw new KlaraErinnerungFehler(
          404,
          "quelle_unbekannt",
          `routine.notizIds: die Notiz ${id} gibt es in den eigenen Notizen nicht.`,
        );
      }
    }
    if (routine.wissenspflege) {
      if (!this.deps.wissenspflege)
        throw new KlaraErinnerungFehler(
          409,
          "zustand",
          "Wissenspflege ist hier nicht angeschlossen.",
        );
      try {
        return {
          ...routine,
          wissenspflege: await pflegeAusgangsstand(
            routine.wissenspflege,
            kontoId,
            this.deps.wissenspflege,
          ),
        };
      } catch {
        throw new KlaraErinnerungFehler(
          404,
          "quelle_unbekannt",
          "Eine ausgewählte Wissensquelle ist aktuell nicht lesbar.",
        );
      }
    }
    return routine;
  }

  async wissenspflegeVorschau(kontoId: string, roh: unknown) {
    const routine = await this.routineGeprueft(kontoId, { wissenspflege: roh }, 1);
    return {
      auftrag: routine.wissenspflege,
      ergebnis: "pruefunterlagen_in_eigenen_notizen",
      wirkung: "keine",
    } as const;
  }

  /**
   * Ändert eine Routine — in Worten (`text`: „künftig montags“, „nimm die erledigten Aufgaben
   * dazu“, „pausieren“, „beenden“, „fortsetzen“) oder als neue Definition (`routine`). Ohne
   * `anwenden: true` wird nur gedeutet und gezeigt. Unklares ändert nichts.
   */
  async aendereRoutine(
    kontoId: string,
    id: string,
    eingabe: KlaraRoutinenAenderungEingabe,
  ): Promise<{
    deutung: RoutinenAenderung | { art: "definition" };
    angewendet: boolean;
    eintrag: KlaraErinnerungEintrag;
  }> {
    const alt = await this.mitFassung(kontoId, id, eingabe.fassung);
    const e = alt.erinnerung;
    if (e.aktion !== "routine_bericht" || !e.routine) {
      throw new KlaraErinnerungFehler(409, "zustand", "Diese Erinnerung ist keine Routine.");
    }
    const anwenden = eingabe.anwenden === true;
    if (eingabe.routine !== undefined) {
      const neu = await this.routineGeprueft(kontoId, eingabe.routine, e.routine.fassung + 1);
      if (!anwenden) {
        return { deutung: { art: "definition" }, angewendet: false, eintrag: alt };
      }
      return {
        deutung: { art: "definition" },
        angewendet: true,
        eintrag: await this.schreibe(alt, { routine: neu }, false),
      };
    }
    const text = eingabe.text;
    if (typeof text !== "string" || text.length === 0 || text.length > 500) {
      throw eingabeFehler("text (höchstens 500 Zeichen) oder routine ist Pflicht.");
    }
    const deutung = deuteRoutinenAenderung(text);
    if (!anwenden || deutung.art === "unklar") {
      return { deutung, angewendet: false, eintrag: alt };
    }
    const fassung = e.fassung;
    switch (deutung.art) {
      case "pausieren":
      case "fortsetzen":
      case "beenden":
        return {
          deutung,
          angewendet: true,
          eintrag: await this.status(kontoId, id, { fassung, aktion: deutung.art }),
        };
      case "abschnitt_dazu":
      case "abschnitt_weg": {
        if (e.routine.wissenspflege)
          throw new KlaraErinnerungFehler(
            409,
            "zustand",
            "Die Wissenspflegevorlage wird mit ihren ausdrücklich gewählten Quellen geändert.",
          );
        const abschnitte =
          deutung.art === "abschnitt_dazu"
            ? [...new Set([...e.routine.abschnitte, deutung.abschnitt])]
            : e.routine.abschnitte.filter((a) => a !== deutung.abschnitt);
        if (abschnitte.length === 0) {
          throw new KlaraErinnerungFehler(
            409,
            "zustand",
            "Eine Routine braucht mindestens einen Abschnitt — „beenden“ beendet sie.",
          );
        }
        const routine: KlaraRoutine = {
          ...e.routine,
          abschnitte,
          fassung: e.routine.fassung + 1,
        };
        return { deutung, angewendet: true, eintrag: await this.schreibe(alt, { routine }, false) };
      }
      case "wochentag": {
        const p = e.zeitplan;
        if (p.art !== "serie" || p.wiederholung.takt !== "woechentlich") {
          throw new KlaraErinnerungFehler(
            409,
            "zustand",
            "„künftig <Wochentag>“ gilt für eine wöchentliche Serie.",
          );
        }
        // „Künftig“: ab dem nächsten passenden Tag in der Zone der Routine; Vergangenes bleibt.
        const heute = lokalVon(this.jetzt(), e.zeitzone).datum;
        let datum = heute;
        for (let i = 0; i < 7 && wochentagVon(datum) !== deutung.wochentag; i += 1) {
          datum = plusTage(datum, 1);
        }
        const zeitplan: Zeitplan = {
          ...p,
          datum,
          wiederholung: { ...p.wiederholung, wochentage: [deutung.wochentag] },
        };
        const geaendert = await this.aendere(kontoId, id, { fassung, zeitplan });
        return { deutung, angewendet: true, eintrag: geaendert };
      }
    }
  }

  /**
   * Nimmt den Bericht eines Laufs zurück (entfernt die Ergebnisnotiz) — nur, solange niemand sie
   * geändert hat: eine geänderte Notiz ist fremde bzw. spätere Arbeit und bleibt (409). Ein Abbruch
   * der Routine („beenden“) nimmt dagegen nichts zurück.
   */
  async nimmRoutineErgebnisZurueck(
    kontoId: string,
    id: string,
    vorkommenId: string,
  ): Promise<KlaraErinnerungLauf> {
    await this.eintrag(kontoId, id);
    const lauf = await this.ablage.laeufe.hole(vorkommenId);
    const r = lauf?.erinnerungId === id ? lauf.ergebnis.routine : undefined;
    if (!lauf || !r) {
      throw new KlaraErinnerungFehler(404, "unbekannt", "Zu diesem Termin gibt es keinen Bericht.");
    }
    if (r.zurueckgenommenAm) {
      return lauf;
    }
    const notizen = this.deps.notizen;
    if (!notizen?.entferne) {
      throw new KlaraErinnerungFehler(409, "zustand", "Die Notizablage ist nicht verfügbar.");
    }
    const n = await notizen.hole(kontoId, r.notizId);
    if (n && n.fassung !== r.notizFassung) {
      throw new KlaraErinnerungFehler(
        409,
        "fremd_geaendert",
        "Der Bericht wurde inzwischen bearbeitet — er bleibt, damit diese Arbeit nicht verloren geht.",
      );
    }
    if (n) {
      await notizen.entferne(kontoId, r.notizId);
    }
    const ergebnis = {
      ...lauf.ergebnis,
      routine: { ...r, zurueckgenommenAm: new Date(this.jetzt()).toISOString() },
    };
    const jetzt = this.jetzt();
    await this.ablage.laeufe.setze(vorkommenId, [lauf.status], lauf.status, ergebnis, null, jetzt);
    return { ...lauf, ergebnis };
  }

  laeufe(erinnerungId: string): Promise<KlaraErinnerungLauf[]> {
    return this.ablage.laeufe.fuerErinnerung(erinnerungId, 50);
  }

  private async bezugAus(
    kontoId: string,
    roh: unknown,
  ): Promise<{ bezug: KlaraErinnerungBezug; objektbezug: KlaraObjektbezug | null; titel: string }> {
    if (roh === undefined) {
      return { bezug: { art: "frei" }, objektbezug: null, titel: "" };
    }
    const o = objekt(roh, "bezug");
    const art = wahl(o.art, ["frei", "gespraech", "notiz", "aufgabe"] as const, "bezug.art");
    if (art === "frei" || art === null) {
      return { bezug: { art: "frei" }, objektbezug: null, titel: "" };
    }
    if (art === "notiz") {
      const id = kennung(o.notizId, "bezug.notizId");
      const n = this.deps.notizen ? await this.deps.notizen.hole(kontoId, id) : null;
      if (!n) {
        throw new KlaraErinnerungFehler(404, "quelle_unbekannt", "Notiz nicht gefunden.");
      }
      return {
        bezug: { art: "notiz", notizId: n.id, notizTitel: n.titel },
        objektbezug: n.objektbezug,
        titel: kurz(n.titel || n.inhalt, KLARA_ERINNERUNG_TITEL_MAX),
      };
    }
    if (art === "aufgabe") {
      const id = kennung(o.aufgabeId, "bezug.aufgabeId");
      const a = this.deps.aufgaben ? await this.deps.aufgaben.hole(kontoId, id) : null;
      if (!a) {
        throw new KlaraErinnerungFehler(404, "quelle_unbekannt", "Aufgabe nicht gefunden.");
      }
      return {
        bezug: { art: "aufgabe", aufgabeId: a.id, aufgabeTitel: a.titel },
        objektbezug: a.objektbezug,
        titel: a.titel,
      };
    }
    const gespraechId = kennung(o.gespraechId, "bezug.gespraechId");
    const nachrichtId = kennung(o.nachrichtId, "bezug.nachrichtId");
    const g = this.deps.gespraeche ? await this.deps.gespraeche.hole(kontoId, gespraechId) : null;
    const n = g?.nachrichten.find((x) => x.id === nachrichtId);
    if (!g || !n) {
      throw new KlaraErinnerungFehler(
        404,
        "quelle_unbekannt",
        "Gesprächsnachricht nicht gefunden.",
      );
    }
    return {
      bezug: { art: "gespraech", gespraechId, nachrichtId, auszug: kurz(n.text, 160) },
      objektbezug: n.objektbezug,
      titel: kurz(n.text, 80),
    };
  }

  private pruefeZukunft(e: KlaraErinnerung, ab: number): void {
    if (e.status === "aktiv" && naechsteFaelligkeit(e, ab) === null) {
      throw new KlaraErinnerungFehler(
        400,
        "vergangen",
        "Dieser Zeitplan hat keinen Termin in der Zukunft. Bitte Datum oder Uhrzeit wählen.",
      );
    }
  }

  /**
   * Legt eine Erinnerung an. Verlangt einen EINDEUTIGEN Zeitplan (Datum UND Uhrzeit, IANA-Zone) —
   * eine relative Angabe wird vorher über `vorschau` geklärt. Derselbe Vorgang legt nichts Zweites an.
   */
  async lege(
    kontoId: string,
    eingabe: KlaraErinnerungEingabe,
    // Nacharbeit 12: nur aus `abHier` — die Folgeserie trägt ihre Herkunft im SELBEN Schreibvorgang.
    // Nacharbeit 13: ebenso die übertragenen Einzelzustände der folgenden Termine.
    intern: {
      serieVon?: { erinnerungId: string; ab: string };
      ausnahmen?: Readonly<Record<string, KlaraErinnerungAusnahme>>;
      wissensQuellen?: readonly string[];
    } = {},
  ): Promise<{ eintrag: KlaraErinnerungEintrag; wiederholt: boolean }> {
    if (typeof eingabe.vorgang !== "string" || !VORGANG_RE.test(eingabe.vorgang)) {
      throw eingabeFehler("vorgang ist Pflicht (8–100 Zeichen aus Buchstaben, Ziffern, - und _).");
    }
    if (eingabe.bereich !== undefined && eingabe.bereich !== KLARA_ERINNERUNG_BEREICH) {
      throw eingabeFehler("Hier entstehen nur persönliche Erinnerungen.");
    }
    if (eingabe.ziel !== undefined && eingabe.ziel !== KLARA_ERINNERUNG_ZIEL) {
      throw eingabeFehler(
        "ziel: In dieser Fassung kommt eine Erinnerung als Meldung in der Glocke an.",
      );
    }
    const vorgang = eingabe.vorgang;
    // P07: die im Einrichtungsassistenten gewählten Vorgaben gelten, wo die Eingabe nichts sagt.
    const vorgaben = await this.einstellungen(kontoId);
    const zeitzone =
      eingabe.zeitzone === undefined && vorgaben.zeitzone !== null
        ? vorgaben.zeitzone
        : zeitzoneAus(eingabe.zeitzone);
    const zeitplan = zeitplanAus(eingabe.zeitplan);
    const { bezug, objektbezug, titel: vorgabeTitel } = await this.bezugAus(kontoId, eingabe.bezug);
    const titel =
      eingabe.titel === undefined && vorgabeTitel ? vorgabeTitel : titelAus(eingabe.titel);
    const aktion = wahl(eingabe.aktion, AKTIONEN, "aktion") ?? "erinnern";
    if (aktion === "aufgabe_pruefen" && bezug.art !== "aufgabe") {
      throw eingabeFehler("aufgabe_pruefen braucht den Bezug zu einer eigenen Aufgabe.");
    }
    if (aktion === "inhalt_zusammenfassen" && bezug.art === "frei") {
      throw eingabeFehler(
        "inhalt_zusammenfassen braucht eine eigene Quelle: Notiz, Aufgabe oder Gesprächsnachricht.",
      );
    }
    // EQF-07: eine Routine trägt ihre Quellen in der eigenen Definition, nicht im Bezug.
    let routine: KlaraRoutine | null = null;
    if (aktion === "routine_bericht") {
      if (bezug.art !== "frei") {
        throw eingabeFehler("Eine Routine liest ihre Quellen aus der Definition (bezug frei).");
      }
      routine = await this.routineGeprueft(kontoId, eingabe.routine, 1);
    } else if (eingabe.routine !== undefined && eingabe.routine !== null) {
      throw eingabeFehler("routine gehört nur zur Aktion routine_bericht.");
    }
    const vorher = await this.ablage.erinnerungen.zuVorgang(kontoId, vorgang);
    if (vorher) {
      await this.eintrag(kontoId, vorher.erinnerung.id);
      if (vorher.erinnerung.fassung === 1 && vorher.erinnerung.titel !== titel) {
        throw new KlaraErinnerungFehler(
          409,
          "vorgang_belegt",
          "Dieser Vorgang hat bereits eine andere Erinnerung angelegt.",
        );
      }
      return { eintrag: vorher, wiederholt: true };
    }
    if ((await this.ablage.erinnerungen.anzahl(kontoId)) >= KLARA_ERINNERUNG_MAX_JE_KONTO) {
      throw new KlaraErinnerungFehler(
        409,
        "voll",
        `Es sind höchstens ${KLARA_ERINNERUNG_MAX_JE_KONTO} Erinnerungen gespeichert.`,
      );
    }
    const jetzt = this.jetzt();
    const jetztIso = new Date(jetzt).toISOString();
    let e: KlaraErinnerung = {
      id: this.neueId(),
      kontoId,
      vorgang,
      bereich: KLARA_ERINNERUNG_BEREICH,
      titel,
      notiz: notizAus(eingabe.notiz),
      bezug,
      objektbezug,
      zeitzone,
      zeitplan,
      sommerzeit: sommerzeitAus(eingabe.sommerzeit, vorgaben.sommerzeit),
      verpasst: verpasstAus(eingabe.verpasst, vorgaben.verpasst),
      aktion,
      routine,
      ziel: KLARA_ERINNERUNG_ZIEL,
      status: "aktiv",
      ausnahmen: intern.ausnahmen ?? {},
      zustaendig: null,
      quelleFehltAkzeptiert: false,
      serieVon: intern.serieVon ?? null,
      angelegtAm: jetztIso,
      geaendertAm: jetztIso,
      fassung: 1,
      ...(intern.wissensQuellen ? { wissensQuellen: intern.wissensQuellen } : {}),
    };
    if (this.deps.quellschutz) {
      const frei = await this.deps.quellschutz(e, kontoId);
      if (!frei) throw new KlaraErinnerungFehler(404, "quelle_unbekannt", "Quelle nicht gefunden.");
      if (
        frei.koIds.length > 0 ||
        (frei.quelleFrei &&
          (bezug.art === "notiz" || bezug.art === "aufgabe" || bezug.art === "gespraech"))
      ) {
        e = { ...e, wissensQuellen: frei.koIds };
      }
    }
    this.pruefeZukunft(e, jetzt);
    const steuer = steuerNach(e, jetzt);
    if (await this.ablage.erinnerungen.lege(e, steuer)) {
      return { eintrag: { erinnerung: e, steuer }, wiederholt: false };
    }
    const parallel = await this.ablage.erinnerungen.zuVorgang(kontoId, vorgang);
    if (!parallel) {
      throw new KlaraErinnerungFehler(
        409,
        "konflikt",
        "Die Erinnerung konnte nicht angelegt werden.",
      );
    }
    return { eintrag: await this.eintrag(kontoId, parallel.erinnerung.id), wiederholt: true };
  }

  private fassungAus(wert: unknown): number {
    if (typeof wert !== "number" || !Number.isSafeInteger(wert) || wert < 1) {
      throw eingabeFehler("fassung ist Pflicht (die zuletzt gesehene Fassung).");
    }
    return wert;
  }

  private konflikt(): KlaraErinnerungFehler {
    return new KlaraErinnerungFehler(
      409,
      "konflikt",
      "Die Erinnerung wurde inzwischen an anderer Stelle geändert. Bitte neu laden und erneut ändern.",
    );
  }

  /** Schreibt die neue Fassung; Vergangenes wird dabei nie wiederbelebt (bearbeitet bis jetzt). */
  private async schreibe(
    alt: KlaraErinnerungEintrag,
    felder: Partial<Omit<KlaraErinnerung, "id" | "kontoId" | "vorgang" | "fassung">>,
    // `true` (Zeitplan, Status, Termine): Vergangenes wird nicht wiederbelebt — bearbeitet bis jetzt.
    // `false` (Titel, Übergabe, Klärung): ein schon fälliger, noch nicht bearbeiteter Termin bleibt
    // fällig — eine Änderung ohne Zeitbezug darf keine Zustellung verschlucken.
    zeitWirksam = true,
  ): Promise<KlaraErinnerungEintrag> {
    const jetzt = this.jetzt();
    const neu: KlaraErinnerung = {
      ...alt.erinnerung,
      ...felder,
      geaendertAm: new Date(jetzt).toISOString(),
      fassung: alt.erinnerung.fassung + 1,
    };
    const bis = zeitWirksam
      ? Math.max(alt.steuer.bearbeitetBis ?? 0, jetzt)
      : alt.steuer.bearbeitetBis;
    const steuer = steuerNach(neu, bis);
    if (!(await this.ablage.erinnerungen.ersetze(neu, steuer))) {
      throw this.konflikt();
    }
    return { erinnerung: neu, steuer };
  }

  private async mitFassung(
    kontoId: string,
    id: string,
    fassung: unknown,
  ): Promise<KlaraErinnerungEintrag> {
    const f = this.fassungAus(fassung);
    const alt = await this.eintrag(kontoId, id);
    if (alt.erinnerung.fassung !== f) {
      throw this.konflikt();
    }
    return alt;
  }

  /** Ändert die GANZE Erinnerung bzw. Serie (Titel, Notiz, Zeitplan, Zone, Regeln). */
  async aendere(
    kontoId: string,
    id: string,
    a: KlaraErinnerungAenderung,
  ): Promise<KlaraErinnerungEintrag> {
    const alt = await this.mitFassung(kontoId, id, a.fassung);
    const e = alt.erinnerung;
    const zeitplan = a.zeitplan === undefined ? e.zeitplan : zeitplanAus(a.zeitplan);
    const zeitzone = a.zeitzone === undefined ? e.zeitzone : zeitzoneAus(a.zeitzone);
    // Ein neuer Zeitplan hat neue Vorkommen. Nacharbeit 13 (AW18-K09): Absagen, Erledigungen und
    // Verschiebungen KOMMENDER Termine einer Serie gehen dabei nicht verloren — sie werden der
    // Reihenfolge nach den kommenden Terminen des neuen Plans zugeordnet (Vergangenes bleibt, wie
    // es ist). Eine Einzelerinnerung hat keine folgenden Termine.
    const jetzt = this.jetzt();
    const ausnahmen =
      a.zeitplan === undefined
        ? e.ausnahmen
        : zeitplan.art === "serie" && e.zeitplan.art === "serie"
          ? folgeAusnahmen(
              e,
              nominalSchluessel(lokalVon(jetzt, e.zeitzone)),
              zeitplan,
              nominalSchluessel(lokalVon(jetzt, zeitzone)),
            )
          : {};
    const felder = {
      titel: a.titel === undefined ? e.titel : titelAus(a.titel),
      notiz: a.notiz === undefined ? e.notiz : notizAus(a.notiz),
      zeitzone,
      zeitplan,
      sommerzeit: sommerzeitAus(a.sommerzeit, e.sommerzeit),
      verpasst: verpasstAus(a.verpasst, e.verpasst),
      ausnahmen,
    };
    if (a.zeitplan !== undefined || a.zeitzone !== undefined) {
      this.pruefeZukunft({ ...e, ...felder }, this.jetzt());
    }
    const zeitWirksam =
      a.zeitplan !== undefined || a.zeitzone !== undefined || a.sommerzeit !== undefined;
    return this.schreibe(alt, felder, zeitWirksam);
  }

  /** Pausieren, Fortsetzen, Erledigen, Absagen, Rücknahme und aktiver Abbruch — getrennt. */
  async status(
    kontoId: string,
    id: string,
    eingabe: { fassung?: unknown; aktion?: unknown },
  ): Promise<KlaraErinnerungEintrag> {
    const aktion = wahl(
      eingabe.aktion,
      ["pausieren", "fortsetzen", "erledigen", "absagen", "zuruecknehmen", "beenden"] as const,
      "aktion",
    );
    if (aktion === null) {
      throw eingabeFehler("aktion ist Pflicht.");
    }
    const alt = await this.mitFassung(kontoId, id, eingabe.fassung);
    const s = alt.erinnerung.status;
    const erlaubt: Record<KlaraErinnerungStatusAktion, readonly KlaraErinnerungStatus[]> = {
      pausieren: ["aktiv"],
      fortsetzen: ["pausiert"],
      erledigen: ["aktiv", "pausiert"],
      absagen: ["aktiv", "pausiert"],
      zuruecknehmen: ["abgesagt", "erledigt"],
      beenden: ["aktiv", "pausiert"],
    };
    if (!erlaubt[aktion].includes(s)) {
      throw new KlaraErinnerungFehler(409, "zustand", `„${aktion}" passt nicht zum Status ${s}.`);
    }
    const ziel: Record<KlaraErinnerungStatusAktion, KlaraErinnerungStatus> = {
      pausieren: "pausiert",
      fortsetzen: "aktiv",
      erledigen: "erledigt",
      absagen: "abgesagt",
      zuruecknehmen: "aktiv",
      beenden: "beendet",
    };
    const neu = { ...alt.erinnerung, status: ziel[aktion] };
    if (neu.status === "aktiv") {
      // Fortsetzen und Rücknahme wirken nur für KOMMENDE Termine.
      this.pruefeZukunft(neu, this.jetzt());
    }
    const ergebnis = await this.schreibe(alt, { status: ziel[aktion] });
    if (aktion === "beenden") {
      // Aktiver Abbruch: was gerade läuft, gescheitert ist oder auf Klärung wartet, endet hier.
      for (const l of await this.ablage.laeufe.fuerErinnerung(id, 500)) {
        await this.ablage.laeufe.setze(
          l.vorkommenId,
          ["laeuft", "fehlgeschlagen", "unklar"],
          "abgebrochen",
          { ...l.ergebnis, grund: "abbruch" },
          null,
          this.jetzt(),
        );
      }
    }
    return ergebnis;
  }

  /** Aktive Arbeit GENAU dieses eigenen Laufs stoppen; keine Pause/Beendigung der Serie. */
  async laufAbbrechen(
    kontoId: string,
    id: string,
    laufId: string,
    fassung: unknown,
  ): Promise<boolean> {
    await this.mitFassung(kontoId, id, fassung);
    if (!laufId.startsWith(`${id}@`)) return false;
    if (!this.ablage.brecheLaufAb)
      throw new KlaraErinnerungFehler(409, "zustand", "Einzellaufabbruch ist nicht angeschlossen.");
    const notizen = this.deps.notizen;
    return this.ablage.brecheLaufAb(
      kontoId,
      id,
      laufId,
      this.fassungAus(fassung),
      this.jetzt(),
      notizen?.zuVorgang ? { zuVorgang: notizen.zuVorgang.bind(notizen) } : undefined,
    );
  }

  /**
   * Ein Vorkommen, das noch nicht bearbeitet ist. Was schon gelaufen ist oder dessen Zeit die
   * Steuerung schon hinter sich hat, bleibt, wie es ist — es wird nie wiederbelebt.
   */
  private async offenesVorkommen(
    alt: KlaraErinnerungEintrag,
    schluessel: string,
  ): Promise<KlaraErinnerungVorkommen & { index: number }> {
    const treffer = findeVorkommen(alt.erinnerung, schluessel);
    if (!treffer) {
      throw new KlaraErinnerungFehler(404, "unbekannt", "Diesen Termin hat die Erinnerung nicht.");
    }
    const v = treffer.vorkommen;
    const lauf = await this.ablage.laeufe.hole(v.id);
    const grenze = Math.max(alt.steuer.bearbeitetBis ?? 0, this.jetzt());
    if (lauf !== null || (v.ms !== null && v.ms <= grenze)) {
      throw new KlaraErinnerungFehler(
        409,
        "zustand",
        "Dieser Termin ist schon vorbei oder bearbeitet und bleibt, wie er ist.",
      );
    }
    return { ...v, index: treffer.index };
  }

  /**
   * Nacharbeit 13: ein Termin ab dem Beginn einer Folgeserie gehört DORT hin — auch wenn die
   * Begrenzung dieser Serie noch aussteht. Sein Einzelzustand wird nur an der Folgeserie geändert.
   */
  private async nichtInFolgeserie(e: KlaraErinnerung, schluessel: string): Promise<void> {
    const folge = await this.ablage.erinnerungen.nachfolger(e.id);
    if (folge && schluessel >= folge.ab) {
      throw new KlaraErinnerungFehler(
        409,
        "zustand",
        "Dieser Termin gehört zur fortgeführten Serie — bitte dort ändern.",
      );
    }
  }

  /** EIN Vorkommen absagen, erledigen, verschieben oder die Einzeländerung zurücknehmen. */
  async vorkommen(
    kontoId: string,
    id: string,
    schluessel: string,
    eingabe: { fassung?: unknown; aktion?: unknown; datum?: unknown; uhrzeit?: unknown },
  ): Promise<KlaraErinnerungEintrag> {
    const aktion = wahl(
      eingabe.aktion,
      ["absagen", "erledigen", "verschieben", "zuruecknehmen"] as const,
      "aktion",
    );
    if (aktion === null) {
      throw eingabeFehler("aktion ist Pflicht.");
    }
    const alt = await this.mitFassung(kontoId, id, eingabe.fassung);
    const e = alt.erinnerung;
    await this.offenesVorkommen(alt, schluessel);
    await this.nichtInFolgeserie(e, schluessel);
    const jetzt = this.jetzt();
    const am = new Date(jetzt).toISOString();
    const ausnahmen = { ...e.ausnahmen };
    if (aktion === "zuruecknehmen") {
      delete ausnahmen[schluessel];
    } else if (aktion === "verschieben") {
      const ziel = {
        datum: datumAus(eingabe.datum, "datum"),
        uhrzeit: uhrzeitAus(eingabe.uhrzeit, "uhrzeit"),
      };
      const r = loeseMitRegel(ziel, e.zeitzone, e.sommerzeit);
      if (r.ms === null || r.ms <= jetzt) {
        throw new KlaraErinnerungFehler(
          400,
          "vergangen",
          "Der neue Termin liegt nicht in der Zukunft.",
        );
      }
      ausnahmen[schluessel] = { art: "verschoben", ...ziel, am };
    } else {
      ausnahmen[schluessel] = { art: aktion === "absagen" ? "abgesagt" : "erledigt", am };
    }
    return this.schreibe(alt, { ausnahmen });
  }

  /**
   * „Diesen und alle folgenden Termine ändern": die bisherige Serie endet VOR diesem Termin, eine
   * neue beginnt mit ihm — mit den geänderten Angaben. Vergangene Termine bleiben unberührt.
   */
  async abHier(
    kontoId: string,
    id: string,
    schluessel: string,
    a: KlaraErinnerungAenderung & { vorgang?: unknown },
  ): Promise<{ bisher: KlaraErinnerungEintrag; neu: KlaraErinnerungEintrag }> {
    const alt = await this.mitFassung(kontoId, id, a.fassung);
    const e = alt.erinnerung;
    if (e.zeitplan.art !== "serie") {
      throw new KlaraErinnerungFehler(409, "zustand", "Nur eine Serie hat folgende Termine.");
    }
    const lokal = lokalAusSchluessel(schluessel);
    if (!lokal) {
      throw new KlaraErinnerungFehler(404, "unbekannt", "Diesen Termin hat die Erinnerung nicht.");
    }
    const { index } = await this.offenesVorkommen(alt, schluessel);
    if (index === 0) {
      // Ab dem ersten Termin ist es die ganze Serie.
      return { bisher: await this.aendere(kontoId, id, a), neu: await this.eintrag(kontoId, id) };
    }
    const w = e.zeitplan.wiederholung;
    // Ein Serienende nach Anzahl zählt ab hier nur noch die restlichen Termine.
    const rest = w.anzahl === null ? null : Math.max(1, w.anzahl - index);
    const gewuenscht = a.zeitplan === undefined ? null : zeitplanAus(a.zeitplan);
    const neuerPlan: Zeitplan =
      gewuenscht === null
        ? {
            art: "serie",
            datum: lokal.datum,
            uhrzeit: e.zeitplan.uhrzeit,
            wiederholung: { ...w, anzahl: rest },
          }
        : gewuenscht.art === "serie" && gewuenscht.wiederholung.anzahl === w.anzahl
          ? { ...gewuenscht, wiederholung: { ...gewuenscht.wiederholung, anzahl: rest } }
          : gewuenscht;
    const vorgang =
      typeof a.vorgang === "string" && VORGANG_RE.test(a.vorgang)
        ? a.vorgang
        : `${e.vorgang}-ab-${schluessel.replace(/[^0-9]/g, "")}`.slice(0, 100);
    // Nacharbeit 13: eine schon bestehende Folgeserie ab diesem oder einem früheren Termin wird nicht
    // verdoppelt — erlaubt ist nur die Wiederholung GENAU dieser Teilung (derselbe Vorgang).
    const bestehend = await this.ablage.erinnerungen.nachfolger(e.id);
    if (
      bestehend &&
      schluessel >= bestehend.ab &&
      (bestehend.vorgang !== vorgang || bestehend.ab !== schluessel)
    ) {
      throw new KlaraErinnerungFehler(
        409,
        "zustand",
        "Ab diesem Termin wird die Serie bereits fortgeführt — bitte dort ändern.",
      );
    }
    // Nacharbeit 12 (Ben, AW18-K06/K09, EQF-07-K03/K05): ERSTER Schreibvorgang ist die Folgeserie
    // MIT ihrer Herkunft (`serieVon`) — sie ist die dauerhafte Teilungsabsicht. Ab ihrem Termin
    // `ab` wirkt die bisherige Serie nicht mehr, auch wenn der Prozess vor deren Begrenzung stirbt:
    // die Steuerung prüft vor jedem Termin auf eine Folgeserie und holt die Begrenzung nach.
    // Wiederholt mit demselben Vorgang ist der Schritt idempotent.
    const { eintrag: neu, wiederholt } = await this.lege(
      kontoId,
      {
        vorgang,
        titel: a.titel === undefined ? e.titel : a.titel,
        notiz: a.notiz === undefined ? e.notiz : a.notiz,
        bezug: bezugEingabe(e.bezug),
        zeitzone: a.zeitzone === undefined ? e.zeitzone : a.zeitzone,
        zeitplan: neuerPlan,
        sommerzeit: a.sommerzeit === undefined ? e.sommerzeit : a.sommerzeit,
        verpasst: a.verpasst === undefined ? e.verpasst : a.verpasst,
        aktion: e.aktion,
        // EQF-07: die neue Serie führt dieselbe Routinendefinition fort.
        ...(e.routine
          ? {
              routine: {
                abschnitte: e.routine.abschnitte,
                notizIds: e.routine.notizIds,
                wirkungen: e.routine.wirkungen,
                ...(e.routine.wissenspflege ? { wissenspflege: e.routine.wissenspflege } : {}),
              },
            }
          : {}),
      },
      {
        serieVon: { erinnerungId: e.id, ab: schluessel },
        ...(e.wissensQuellen ? { wissensQuellen: e.wissensQuellen } : {}),
        // Nacharbeit 13 (AW18-K09): Absagen, Erledigungen und Verschiebungen der folgenden Termine
        // gehen mit — im SELBEN Schreibvorgang, also auch nach Absturz und Wiederanlauf erhalten.
        ausnahmen: folgeAusnahmen(e, schluessel, zeitplanAus(neuerPlan)),
      },
    );
    const herkunft = neu.erinnerung.serieVon;
    if (!herkunft || herkunft.erinnerungId !== e.id || herkunft.ab !== schluessel) {
      // Derselbe Vorgang gehört schon einer anderen Erinnerung — nichts geteilt.
      throw new KlaraErinnerungFehler(
        409,
        "vorgang_belegt",
        "Dieser Vorgang hat bereits eine andere Erinnerung angelegt.",
      );
    }
    // Zweiter Schreibvorgang: die bisherige Serie endet vor diesem Termin (bedingt auf ihre Fassung).
    const plan = serieBisVor(e, schluessel);
    if (!plan) {
      return { bisher: alt, neu };
    }
    try {
      return { bisher: await this.schreibe(alt, { zeitplan: plan }), neu };
    } catch (fehler) {
      return this.teilungNachFehler(kontoId, alt, schluessel, neu, wiederholt, fehler);
    }
  }

  /**
   * Nacharbeit 13 (Ben): die Begrenzung der bisherigen Serie ist gescheitert ODER ihr Ausgang ist
   * unbekannt (Antwort verloren). Erst den TATSÄCHLICHEN Teilungszustand zurücklesen:
   *  · bisherige Serie endet schon vor dem Termin (eigene Begrenzung angekommen oder von der
   *    Steuerung nachgeholt) → die Teilung ist vollzogen, Ergebnis übernehmen;
   *  · nicht lesbar, bisherige Serie fehlt oder unverändert in der gesehenen Fassung → Ausgang offen
   *    bzw. Begrenzung nur nicht geschrieben: die Folgeserie (Teilungsabsicht) BLEIBT; die Steuerung
   *    holt die Begrenzung nach, eine Wiederholung ist idempotent;
   *  · nachweislich ANDERSWO geändert (neue Fassung, nicht begrenzt) → Abbruch der Teilung: die
   *    Folgeserie wird nur entfernt, wenn DIESER Aufruf sie angelegt hat und sie seitdem weder
   *    geändert wurde noch einen Lauf (Wirkung) hat. Sonst bleibt sie.
   */
  private async teilungNachFehler(
    kontoId: string,
    alt: KlaraErinnerungEintrag,
    schluessel: string,
    neu: KlaraErinnerungEintrag,
    wiederholt: boolean,
    fehler: unknown,
  ): Promise<{ bisher: KlaraErinnerungEintrag; neu: KlaraErinnerungEintrag }> {
    let jetzt: KlaraErinnerungEintrag | null;
    try {
      jetzt = await this.ablage.erinnerungen.hole(kontoId, alt.erinnerung.id);
    } catch {
      throw fehler; // Ausgang unklar: Teilungsabsicht bleibt erhalten.
    }
    // Nacharbeit 16: vollzogen nur, wenn der GESPEICHERTE Plan genau die Begrenzung dieser Teilung
    // ist — nicht schon, weil der Teilungstermin fehlt (fremde Planänderung = Konflikt).
    if (jetzt && durchTeilungBegrenzt(alt.erinnerung, jetzt.erinnerung, schluessel)) {
      return { bisher: jetzt, neu };
    }
    if (!jetzt || jetzt.erinnerung.fassung === alt.erinnerung.fassung || wiederholt) {
      throw fehler;
    }
    // Nachweislicher Konflikt: die eben angelegte Folgeserie nur entfernen, wenn sie BEIM LÖSCHEN
    // (ein bedingter Schritt) noch in ihrer ersten Fassung steht und keinen Lauf hat — sonst bleibt
    // sie, und der Konflikt wird gemeldet.
    if ((await this.ablage.laeufe.fuerErinnerung(neu.erinnerung.id, 1)).length === 0) {
      await this.ablage.erinnerungen.entferneBedingt(
        kontoId,
        neu.erinnerung.id,
        neu.erinnerung.fassung,
      );
    }
    throw fehler;
  }

  /** Die Entscheidung der Person zu EINEM Lauf, der auf Klärung wartet oder gescheitert ist. */
  async klaere(
    kontoId: string,
    id: string,
    vorkommenId: string,
    eingabe: { entscheidung?: unknown; fassung?: unknown },
  ): Promise<KlaraErinnerungEintrag> {
    const entscheidung = wahl(
      eingabe.entscheidung,
      ["fortfuehren", "verwerfen", "beenden"] as const,
      "entscheidung",
    );
    if (entscheidung === null) {
      throw new KlaraErinnerungFehler(
        400,
        "klaerung",
        "entscheidung ist Pflicht: fortfuehren, verwerfen oder beenden.",
      );
    }
    const alt = await this.mitFassung(kontoId, id, eingabe.fassung);
    const lauf = await this.ablage.laeufe.hole(vorkommenId);
    const r = lauf?.ergebnis.routine;
    // EQF-07-K06 (Nacharbeit 9): auch ein Teilbericht mit offenem Rest ist über die Klärung
    // fortführbar (bzw. bewusst abzuschließen).
    // Nacharbeit 12: ebenso eine ausstehende Fortsetzungsmeldung (Bericht fertig).
    const teilbericht =
      lauf?.status === "teilweise" &&
      r !== undefined &&
      (r.offen.length > 0 || r.meldungAusstehend === true) &&
      r.teile !== undefined;
    if (
      !lauf ||
      lauf.erinnerungId !== id ||
      (!teilbericht && !["unklar", "fehlgeschlagen"].includes(lauf.status))
    ) {
      throw new KlaraErinnerungFehler(404, "unbekannt", "Kein offener Lauf zu dieser Erinnerung.");
    }
    const jetzt = this.jetzt();
    if (teilbericht && r) {
      // Fortführen: die Wiederaufnahme setzt den offenen Rest in DENSELBEN Bericht fort (neue
      // Versuchsreihe). Verwerfen/Beenden: der Teilbericht bleibt, wie er ist; nichts wird
      // nachgetragen. Nichts davon löscht ein fertiges Ergebnis.
      const fortsetzen = entscheidung === "fortfuehren";
      await this.ablage.laeufe.setze(
        vorkommenId,
        ["teilweise"],
        "teilweise",
        { ...lauf.ergebnis, routine: { ...r, fortsetzbar: fortsetzen } },
        fortsetzen ? 1 : null,
        jetzt,
      );
      if (entscheidung === "beenden" && alt.erinnerung.status !== "beendet") {
        return this.schreibe(alt, { status: "beendet" });
      }
      return alt;
    }
    if (entscheidung === "fortfuehren") {
      // Neuer Versuch MIT Readback (Versuch > 1): eine schon erfolgte Meldung wird nicht verdoppelt.
      await this.ablage.laeufe.setze(
        vorkommenId,
        ["unklar", "fehlgeschlagen"],
        "fehlgeschlagen",
        null,
        1,
        jetzt,
      );
      if (lauf.ergebnis.grund === "quelle_geloescht" && !alt.erinnerung.quelleFehltAkzeptiert) {
        return this.schreibe(alt, { quelleFehltAkzeptiert: true }, false);
      }
      return alt;
    }
    await this.ablage.laeufe.setze(
      vorkommenId,
      ["unklar", "fehlgeschlagen"],
      "abgebrochen",
      { ...lauf.ergebnis, grund: "verworfen" },
      null,
      jetzt,
    );
    if (entscheidung === "beenden" && alt.erinnerung.status !== "beendet") {
      return this.schreibe(alt, { status: "beendet" });
    }
    return alt;
  }

  /** Löschen wirkt auf Erinnerung, Läufe UND die zugestellten Meldungen dieser Erinnerung. */
  async loesche(kontoId: string, id: string): Promise<boolean> {
    if (!this.ablage.entferneKomplett)
      throw new Error("Atomare Erinnerungslöschung nicht angebunden.");
    return this.ablage.entferneKomplett(kontoId, id);
  }

  /** Die eigenen Meldungen für die Glocke (nur dieses Konto). */
  async meldungenFuer(kontoId: string): Promise<KlaraErinnerungMeldung[]> {
    const ms = await this.ablage.meldungen.fuerKonto(kontoId, 100);
    const quellschutz = this.deps.quellschutz;
    if (!quellschutz) return ms;
    const erlaubt = await Promise.all(
      ms.map(async (m) => {
        try {
          const e = await this.ablage.erinnerungen.holeSystem(m.erinnerungId);
          return e && (await quellschutz(e.erinnerung, kontoId, m)) !== null;
        } catch {
          return false;
        }
      }),
    );
    return ms.filter((_, i) => erlaubt[i]);
  }

  /** AW18-K11: fällige, verpasste, gescheiterte und unklare Läufe dieses Kontos, mit Rückstau. */
  async ueberwachung(kontoId: string): Promise<{
    rueckstau: { anzahl: number; aelteste: string | null };
    laeufe: Record<KlaraErinnerungLaufStatus | "haengend", number>;
  }> {
    const jetzt = this.jetzt();
    const sichtbar = this.deps.quellschutz
      ? (await this.liste(kontoId)).map((e) => e.erinnerung.id)
      : undefined;
    const [r, z] = await Promise.all([
      this.ablage.erinnerungen.rueckstau(jetzt, kontoId, sichtbar),
      this.ablage.laeufe.zaehle(kontoId, jetzt, sichtbar),
    ]);
    return {
      rueckstau: {
        anzahl: r.anzahl,
        aelteste: r.aelteste === null ? null : new Date(r.aelteste).toISOString(),
      },
      laeufe: z,
    };
  }
}

function bezugEingabe(b: KlaraErinnerungBezug): Record<string, string> {
  if (b.art === "notiz") {
    return { art: "notiz", notizId: b.notizId };
  }
  if (b.art === "aufgabe") {
    return { art: "aufgabe", aufgabeId: b.aufgabeId };
  }
  if (b.art === "gespraech") {
    return { art: "gespraech", gespraechId: b.gespraechId, nachrichtId: b.nachrichtId };
  }
  return { art: "frei" };
}

// ------------------------------------------------------------------------------------------------
// DIE STEUERUNG — persistente Fälligkeit, atomare Übernahme, Wirkung, Readback (AW18-K04…K12).
// ------------------------------------------------------------------------------------------------

/** Das Konto, wie es HEUTE ist — gelesen vor jedem Schritt, kein gespeicherter Diensttoken. */
export type KontoLage =
  | { readonly approved: boolean; readonly accessExpiresAt?: string }
  | undefined;

export interface KlaraErinnerungSteuerungDeps {
  readonly ablage: KlaraErinnerungAblage;
  readonly quellschutz?: ErinnerungQuellschutz;
  readonly konto: (kontoId: string) => Promise<KontoLage>;
  /** `liste` liest der Routinenabschnitt „neue Notizen“ (EQF-07). */
  readonly notizen?: Pick<KlaraNotizRepo, "hole"> & Partial<Pick<KlaraNotizRepo, "liste">>;
  /** `liste` lesen die Routinenabschnitte „offene/erledigte Aufgaben“ (EQF-07). */
  readonly aufgaben?: Pick<KlaraAufgabeRepo, "hole"> & Partial<Pick<KlaraAufgabeRepo, "liste">>;
  readonly gespraeche?: Pick<KlaraGespraechRepo, "hole">;
  readonly wissenspflege?: PflegeLeser & {
    unterQuellschutz<T>(arbeit: () => Promise<T>): Promise<T>;
  };
  /** Enger ausdrücklich bestellter Normbeleg-Zusatz am selben gehaltenen D-Lauf. */
  readonly normereignisse?: (
    kontoId: string,
    quellen: readonly string[],
    bedingung: NotizSchreibbedingung,
    folge?: NormFolgeversuch,
  ) => Promise<NormVorbereitung>;
  /**
   * EQF-07: die Ergebnisablage einer Routine — „Meine Notizen“ (`KlaraNotizDienst` samt Readback
   * über den Vorgangsschlüssel). Fehlt sie, schlägt der Routinenlauf sichtbar fehl.
   */
  readonly ergebnisablage?: {
    zuVorgang(kontoId: string, vorgang: string): Promise<KlaraNotiz | null>;
    /**
     * Nacharbeit 9 (Ben): mit `bedingung` — Routine aktiv in dieser Fassung, Konto berechtigt,
     * gelesene Quellen unverändert — beim tatsächlichen Speichern. Gilt sie nicht (mehr), wirft der
     * Notizdienst `KlaraNotizFehler` mit Grund `bedingung`; es entsteht nichts.
     */
    lege(
      kontoId: string,
      eingabe: KlaraNotizEingabe,
      bedingung?: NotizSchreibbedingung,
    ): Promise<{ notiz: KlaraNotiz; wiederholt: boolean }>;
    /** Fortsetzung des offenen Rests in DENSELBEN Bericht — nur in der gelesenen Fassung. */
    aendere?(
      kontoId: string,
      id: string,
      eingabe: KlaraNotizAenderung,
      bedingung?: NotizSchreibbedingung,
    ): Promise<{ notiz: KlaraNotiz; wiederholt: boolean }>;
    hole?(kontoId: string, id: string): Promise<KlaraNotiz | null>;
  };
  readonly jetzt?: () => number;
  /** Die Kennung dieses Prozesses — Besitzer der übernommenen Läufe. */
  readonly besitzer?: string;
  readonly leaseMs?: number;
  /**
   * Der vorhandene KI-Weg für bestellte Zusammenfassungen (`ReasonerService.assistText`,
   * vertraulich). `ki`: ein Modell hat geantwortet (nicht der gekennzeichnete Ersatz). Fehlt er oder
   * scheitert er, ist die Zusammenfassung `nicht_verfuegbar` — die Erinnerung kommt trotzdem.
   */
  readonly zusammenfassen?: (
    text: string,
    kontoId: string,
  ) => Promise<{ text: string; ki: boolean }>;
  /**
   * Klara 11 (P07-AC05): die dauerhafte Sperre GENAU EINES Vorkommens aus der Kalenderanbindung —
   * gelesen unmittelbar vor jeder Wirkung. Fehlt sie, gibt es keine Kalendersperre.
   */
  readonly vorkommenSperre?: (
    kontoId: string,
    erinnerungId: string,
    vorkommenId: string,
  ) => Promise<KlaraErinnerungVorkommenSperre>;
}

export interface KlaraErinnerungLaufbericht {
  readonly beginn: string;
  readonly ende: string;
  readonly faelligeErinnerungen: number;
  readonly zugestellt: number;
  readonly nachgeholt: number;
  readonly verpasstGemeldet: number;
  readonly zusammengefasst: number;
  readonly uebersprungen: number;
  readonly dedupliziert: number;
  readonly teilweise: number;
  readonly fehlgeschlagen: number;
  readonly unklar: number;
  readonly gestoppt: number;
  /** Vor der Wirkung pausiert, abgesagt, erledigt oder geändert — nichts geschrieben. */
  readonly abgebrochen: number;
  readonly belegt: number;
  readonly fehler: number;
}

type Zaehler = { -readonly [K in keyof KlaraErinnerungLaufbericht]: KlaraErinnerungLaufbericht[K] };

type FaelligesVorkommen = KlaraErinnerungVorkommen & { ms: number };

/** Die gelesenen Quellen eines Berichts mit Fassung. */
/** SHA-256 eines Berichtsinhalts — Readback der eigenen Fortsetzung (Nacharbeit 11). */
function pruefsumme(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function quellenVon(teile: readonly BerichtTeil[]): KlaraRoutineErgebnis["quellen"] {
  return teile.flatMap((t) =>
    t.eintraege.map((q) => ({ art: q.art, id: q.id, fassung: q.fassung })),
  );
}

/** EQF-07: ein gelesener, noch nicht geschriebener Routinenbericht. */
interface RoutineEntwurf {
  readonly art: "neu";
  readonly vorgang: string;
  readonly titel: string;
  readonly inhalt: string;
  readonly quellen: KlaraRoutineErgebnis["quellen"];
  readonly offen: KlaraRoutineErgebnis["offen"];
  readonly teile: readonly BerichtTeil[];
  readonly termin: string;
  readonly wissenspflege?: PflegeErgebnis;
  readonly pflegeQuellen?: readonly GelesenePflegeQuelle[];
}

/** Runde je tatsächlichem Konto; keine zusätzliche Queue und keine parallele Wirkung. */
function faireReihenfolge<T>(eintraege: readonly T[], kontoVon: (e: T) => string): T[] {
  const konten = new Map<string, T[]>();
  for (const e of eintraege) {
    const konto = kontoVon(e);
    const gruppe = konten.get(konto) ?? [];
    gruppe.push(e);
    konten.set(konto, gruppe);
  }
  const runden = [...konten.values()].map((gruppe) => ({ gruppe, index: 0 }));
  const result: T[] = [];
  for (let i = 0; i < runden.length; i++) {
    const runde = runden[i];
    if (!runde) continue;
    const e = runde.gruppe[runde.index++];
    if (e !== undefined) result.push(e);
    if (runde.index < runde.gruppe.length) runden.push(runde);
  }
  return result;
}
function faireErinnerungen(eintraege: readonly KlaraErinnerungEintrag[]): KlaraErinnerungEintrag[] {
  return faireReihenfolge(eintraege, (e) => e.erinnerung.kontoId);
}

export class KlaraErinnerungSteuerung {
  private readonly deps: KlaraErinnerungSteuerungDeps;
  private readonly jetzt: () => number;
  readonly besitzer: string;
  private readonly leaseMs: number;
  private letzter: KlaraErinnerungLaufbericht | null = null;
  private laeuftGerade = false;

  constructor(deps: KlaraErinnerungSteuerungDeps) {
    this.deps = deps;
    this.jetzt = deps.jetzt ?? Date.now;
    this.besitzer = deps.besitzer ?? `prozess-${randomUUID()}`;
    this.leaseMs = deps.leaseMs ?? KLARA_ERINNERUNG_LEASE_MS;
  }

  letzterBericht(): KlaraErinnerungLaufbericht | null {
    return this.letzter;
  }

  /** EIN Takt: fällige Erinnerungen bearbeiten, dann hängende und gescheiterte Läufe übernehmen. */
  async lauf(): Promise<KlaraErinnerungLaufbericht> {
    const beginn = this.jetzt();
    const z: Zaehler = {
      beginn: new Date(beginn).toISOString(),
      ende: "",
      faelligeErinnerungen: 0,
      zugestellt: 0,
      nachgeholt: 0,
      verpasstGemeldet: 0,
      zusammengefasst: 0,
      uebersprungen: 0,
      dedupliziert: 0,
      teilweise: 0,
      fehlgeschlagen: 0,
      unklar: 0,
      gestoppt: 0,
      abgebrochen: 0,
      belegt: 0,
      fehler: 0,
    };
    if (this.laeuftGerade) {
      // Derselbe Prozess startet keinen zweiten Takt neben dem laufenden.
      return { ...z, ende: z.beginn };
    }
    this.laeuftGerade = true;
    try {
      const faellig = await this.deps.ablage.erinnerungen.faellige(beginn, 200);
      z.faelligeErinnerungen = faellig.length;
      const jeKonto = new Map<string, number>();
      const fair = faireErinnerungen(faellig).sort(
        (a, b) =>
          Number(a.erinnerung.aktion === "inhalt_zusammenfassen") -
          Number(b.erinnerung.aktion === "inhalt_zusammenfassen"),
      );
      for (const eintrag of fair) {
        const konto = eintrag.erinnerung.kontoId;
        const anzahl = jeKonto.get(konto) ?? 0;
        if (anzahl >= 5) continue;
        jeKonto.set(konto, anzahl + 1);
        try {
          await mitModellKontext({ actor: konto }, () => this.bearbeite(eintrag, z));
        } catch {
          z.fehler += 1;
        }
      }
      const offen = await this.deps.ablage.laeufe.wiederaufzunehmen(
        this.jetzt(),
        KLARA_ERINNERUNG_MAX_VERSUCHE,
        200,
      );
      for (const lauf of faireReihenfolge(offen, (l) => l.kontoId)) {
        const anzahl = jeKonto.get(lauf.kontoId) ?? 0;
        if (anzahl >= 5) continue;
        jeKonto.set(lauf.kontoId, anzahl + 1);
        try {
          await mitModellKontext({ actor: lauf.kontoId }, () => this.nimmWiederAuf(lauf, z));
        } catch {
          z.fehler += 1;
        }
      }
    } finally {
      this.laeuftGerade = false;
    }
    z.ende = new Date(this.jetzt()).toISOString();
    this.letzter = z;
    return z;
  }

  private async kontoAktiv(kontoId: string): Promise<boolean> {
    const k = await this.deps.konto(kontoId);
    if (!k || !k.approved) {
      return false;
    }
    return !(k.accessExpiresAt && Date.parse(k.accessExpiresAt) <= this.jetzt());
  }

  /** Besteht die eigene Quelle noch? `null` = nicht feststellbar (Ablage nicht lesbar). */
  private async quelleDa(e: KlaraErinnerung): Promise<boolean | null> {
    const b = e.bezug;
    try {
      if (b.art === "notiz") {
        return this.deps.notizen
          ? (await this.deps.notizen.hole(e.kontoId, b.notizId)) !== null
          : true;
      }
      if (b.art === "aufgabe") {
        return this.deps.aufgaben
          ? (await this.deps.aufgaben.hole(e.kontoId, b.aufgabeId)) !== null
          : true;
      }
      if (b.art === "gespraech") {
        if (!this.deps.gespraeche) {
          return true;
        }
        const g = await this.deps.gespraeche.hole(e.kontoId, b.gespraechId);
        return g?.nachrichten.some((n) => n.id === b.nachrichtId) ?? false;
      }
      return true;
    } catch {
      return null;
    }
  }

  private async pruefung(e: KlaraErinnerung): Promise<KlaraErinnerungPruefung | null> {
    if (e.aktion !== "aufgabe_pruefen" || e.bezug.art !== "aufgabe" || !this.deps.aufgaben) {
      return null;
    }
    try {
      const a = await this.deps.aufgaben.hole(e.kontoId, e.bezug.aufgabeId);
      return { art: "aufgabe", status: a ? a.status : "nicht_gefunden" };
    } catch {
      // Die abhängige Prüfung fällt aus — die zugesagte Erinnerung kommt trotzdem (AW18-K07).
      return { art: "aufgabe", status: "nicht_verfuegbar" };
    }
  }

  private async bearbeite(eintrag: KlaraErinnerungEintrag, z: Zaehler): Promise<void> {
    let e = eintrag.erinnerung;
    const jetzt = this.jetzt();
    const bisher = eintrag.steuer.bearbeitetBis;
    if (e.status !== "aktiv") {
      await this.deps.ablage.erinnerungen.setzeSteuer(e.id, e.fassung, {
        bearbeitetBis: bisher,
        naechste: null,
      });
      return;
    }
    // Nacharbeit 12 (Ben, AW18-K06/K09): gibt es eine Folgeserie (Teilung „diesen und alle
    // folgenden“), wirkt diese Serie ab deren erstem Termin NICHT mehr — auch wenn die Teilung vor
    // der Begrenzung abbrach. Die Begrenzung wird hier bedingt nachgeholt (Fassung wie gelesen);
    // gelingt das nicht (fremde Änderung), gilt die Grenze trotzdem für jede Wirkung.
    const folge =
      e.zeitplan.art === "serie" ? await this.deps.ablage.erinnerungen.nachfolger(e.id) : null;
    const folgeAb = folge?.ab ?? null;
    if (folgeAb !== null) {
      const plan = serieBisVor(e, folgeAb);
      if (plan) {
        const begrenzt: KlaraErinnerung = {
          ...e,
          zeitplan: plan,
          geaendertAm: new Date(jetzt).toISOString(),
          fassung: e.fassung + 1,
        };
        if (await this.deps.ablage.erinnerungen.ersetze(begrenzt, steuerNach(begrenzt, bisher))) {
          e = begrenzt;
        }
      }
    }
    const faellig: FaelligesVorkommen[] = vorkommenVon(e, {
      von: bisher,
      stoppNach: jetzt,
      kuenftig: 1,
    })
      .filter(istZuBearbeiten)
      .filter((v) => folgeAb === null || v.schluessel < folgeAb)
      .filter((v) => (bisher === null || v.ms > bisher) && v.ms <= jetzt)
      .sort((a, b) => a.ms - b.ms)
      .slice(0, KLARA_ERINNERUNG_JE_LAUF);
    if (faellig.length > 0) {
      await this.bearbeiteVorkommen(e, faellig, jetzt, z);
    }
    const neuBis = faellig.reduce((m, v) => Math.max(m, v.ms), bisher ?? 0);
    // Scheitert das (die Person hat inzwischen geändert), rechnet der nächste Takt neu — die Läufe
    // stehen schon und verhindern jede zweite Wirkung.
    await this.deps.ablage.erinnerungen.setzeSteuer(e.id, e.fassung, steuerNach(e, neuBis));
  }

  private async bearbeiteVorkommen(
    e: KlaraErinnerung,
    faellig: readonly FaelligesVorkommen[],
    jetzt: number,
    z: Zaehler,
  ): Promise<void> {
    // Vorprüfung für den ganzen Stapel (spart Arbeit). Verbindlich ist die Prüfung in `wirke`
    // unmittelbar vor JEDER Meldung — sie sieht, was sich zwischen zwei Zustellungen ändert.
    if (!(await this.kontoAktiv(this.empfaengerVon(e)))) {
      await this.pausiereWissenspflege(e);
      for (const v of faellig) {
        await this.ohneWirkung(e, v, "erinnerung", "gestoppt", { grund: "konto_gesperrt" }, z);
      }
      return;
    }
    if (e.bezug.art !== "frei" && !e.quelleFehltAkzeptiert) {
      const da = await this.quelleDa(e);
      if (da !== true) {
        for (const v of faellig) {
          await this.ohneWirkung(
            e,
            v,
            "erinnerung",
            da === false ? "unklar" : "fehlgeschlagen",
            { grund: da === false ? "quelle_geloescht" : "quelle_unlesbar" },
            z,
          );
        }
        return;
      }
    }
    const grenzeMs = e.verpasst.grenzeMinuten * 60_000;
    const rechtzeitig = faellig.filter((v) => jetzt - v.ms <= grenzeMs);
    const verpasst = faellig.filter((v) => jetzt - v.ms > grenzeMs);
    for (const v of rechtzeitig) {
      await this.zustellen(e, v, "erinnerung", false, z);
    }
    if (verpasst.length === 0) {
      return;
    }
    switch (e.verpasst.regel) {
      case "nachholen":
        for (const v of verpasst) {
          await this.zustellen(e, v, "erinnerung", true, z);
        }
        return;
      case "nur_melden":
        for (const v of verpasst) {
          await this.zustellen(e, v, "verpasst", true, z);
        }
        return;
      case "zusammenfassen":
        await this.gesammelt(e, verpasst, "sammel", z);
        return;
      case "ueberspringen":
        await this.gesammelt(e, verpasst, "uebersprungen", z);
        return;
    }
  }

  private uebernahme(
    e: KlaraErinnerung,
    v: FaelligesVorkommen,
    art: KlaraErinnerungLaufArt,
    meldungId: string,
  ): Promise<KlaraErinnerungLauf | null> {
    return this.deps.ablage.laeufe.uebernimm({
      vorkommenId: v.id,
      erinnerungId: e.id,
      kontoId: e.kontoId,
      geplantFuer: v.ms,
      besitzer: this.besitzer,
      jetzt: this.jetzt(),
      leaseMs: this.leaseMs,
      art,
      meldungId,
    });
  }

  private async ohneWirkung(
    e: KlaraErinnerung,
    v: FaelligesVorkommen,
    art: KlaraErinnerungLaufArt,
    status: KlaraErinnerungLaufStatus,
    ergebnis: KlaraErinnerungLauf["ergebnis"],
    z: Zaehler,
  ): Promise<void> {
    const lauf = await this.uebernahme(e, v, art, `ke-${v.id}`);
    if (!lauf) {
      z.belegt += 1;
      return;
    }
    await this.deps.ablage.laeufe.schliesse(v.id, this.besitzer, status, ergebnis, this.jetzt());
    if (status === "gestoppt") {
      z.gestoppt += 1;
    } else if (status === "unklar") {
      z.unklar += 1;
    } else {
      z.fehlgeschlagen += 1;
    }
  }

  /**
   * Readback nach einer Übernahme: gibt es die Meldung schon, wird der Lauf mit DIESEM Beleg
   * abgeschlossen (`true`). Ist es nicht feststellbar, bleibt der Lauf `unklar` (`true`). Nur wenn
   * sicher keine Meldung existiert, geht es mit der Wirkung weiter (`false`).
   */
  private async readback(lauf: KlaraErinnerungLauf, z: Zaehler): Promise<boolean> {
    if (lauf.versuch <= 1) {
      return false;
    }
    let vorhanden: KlaraErinnerungMeldung | null;
    try {
      vorhanden = await this.deps.ablage.meldungen.hole(
        lauf.ergebnis.pflegeMeldungId ?? lauf.meldungId,
      );
    } catch {
      await this.deps.ablage.laeufe.schliesse(
        lauf.vorkommenId,
        this.besitzer,
        "unklar",
        { ...lauf.ergebnis, grund: "readback_unmoeglich" },
        this.jetzt(),
      );
      z.unklar += 1;
      return true;
    }
    if (!vorhanden || !vorhanden.vorkommen.includes(lauf.geplantFuer)) {
      return false;
    }
    await this.deps.ablage.laeufe.schliesse(
      lauf.vorkommenId,
      this.besitzer,
      vorhanden.laufStatus,
      {
        // Der Beleg ist die vorhandene Meldung — ein Fehlergrund des abgebrochenen Versuchs gilt nicht.
        ...(lauf.ergebnis.hinweis ? { hinweis: lauf.ergebnis.hinweis } : {}),
        zugestelltAm: vorhanden.zugestelltAm,
        nachgeholt: vorhanden.nachgeholt,
        ...(vorhanden.pruefung ? { pruefung: vorhanden.pruefung } : {}),
        ...(vorhanden.zusammenfassung ? { zusammenfassung: vorhanden.zusammenfassung } : {}),
        ...(vorhanden.routine ? { routine: vorhanden.routine } : {}),
        dedupliziert: true,
      },
      this.jetzt(),
    );
    z.dedupliziert += 1;
    return true;
  }

  private async zustellen(
    e: KlaraErinnerung,
    v: FaelligesVorkommen,
    art: "erinnerung" | "verpasst",
    nachgeholt: boolean,
    z: Zaehler,
  ): Promise<void> {
    const meldungId = `ke-${v.id}`;
    const lauf = await this.uebernahme(e, v, art, meldungId);
    if (!lauf) {
      z.belegt += 1;
      return;
    }
    if (await this.readback(lauf, z)) {
      return;
    }
    await this.wirke(
      e.id,
      [{ lauf, hinweis: v.hinweis }],
      art === "verpasst" ? "verpasst" : "erinnerung",
      nachgeholt,
      z,
    );
  }

  /** Empfänger einer Wirkung: die bewusst Zuständige — sonst der Eigentümer. */
  private empfaengerVon(e: KlaraErinnerung): string {
    return e.zustaendig?.kontoId ?? e.kontoId;
  }

  /**
   * Warum dieser Lauf (Termin) HEUTE nicht mehr wirken darf — oder `null`, wenn er darf. `verlegt`:
   * der Termin wurde vor der Wirkung in die Zukunft verschoben; der Lauf wird freigegeben.
   */
  private terminGrund(
    e: KlaraErinnerung,
    lauf: KlaraErinnerungLauf,
    jetzt: number,
  ): KlaraErinnerungLaufGrund | "verlegt" | null {
    if (e.status !== "aktiv") {
      return "status_geaendert";
    }
    const treffer = findeVorkommen(e, lauf.vorkommenId.split("@").pop() ?? "");
    const v = treffer?.vorkommen;
    if (!v || v.id !== lauf.vorkommenId || !istZuBearbeiten(v)) {
      return "termin_geaendert";
    }
    return v.ms > jetzt ? "verlegt" : null;
  }

  /** Der Text der EIGENEN Quelle für eine bestellte Zusammenfassung — `null`: nicht lesbar. */
  private async quelltext(
    e: KlaraErinnerung,
  ): Promise<{ text: string; stand: ErinnerungQuellenStand } | null> {
    const b = e.bezug;
    try {
      if (b.art === "notiz" && this.deps.notizen) {
        const n = await this.deps.notizen.hole(e.kontoId, b.notizId);
        return n
          ? {
              text: `${n.titel}\n\n${n.inhalt}`,
              stand: { art: "notiz", kontoId: e.kontoId, id: n.id, fassung: n.fassung },
            }
          : null;
      }
      if (b.art === "aufgabe" && this.deps.aufgaben) {
        const a = await this.deps.aufgaben.hole(e.kontoId, b.aufgabeId);
        return a
          ? {
              text: `${a.titel}\n\n${a.inhalt}`,
              stand: { art: "aufgabe", kontoId: e.kontoId, id: a.id, fassung: a.fassung },
            }
          : null;
      }
      if (b.art === "gespraech" && this.deps.gespraeche) {
        const g = await this.deps.gespraeche.hole(e.kontoId, b.gespraechId);
        const text = g?.nachrichten.find((n) => n.id === b.nachrichtId)?.text;
        return g && text !== undefined
          ? { text, stand: { art: "gespraech", kontoId: e.kontoId, id: g.id, fassung: g.fassung } }
          : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Die bestellte Zusammenfassung (AW-18): über den vorhandenen KI-Weg, aus der EIGENEN Quelle des
   * Eigentümers. Fällt die KI oder die Quelle aus, ist das Ergebnis `nicht_verfuegbar` — die
   * Erinnerung kommt trotzdem (AW18-K07).
   */
  private async zusammenfassung(
    e: KlaraErinnerung,
  ): Promise<KlaraErinnerungZusammenfassung | null> {
    if (e.aktion !== "inhalt_zusammenfassen") {
      return null;
    }
    const nichtVerfuegbar: KlaraErinnerungZusammenfassung = { status: "nicht_verfuegbar" };
    if (!this.deps.zusammenfassen) {
      return nichtVerfuegbar;
    }
    const quelle = await this.quelltext(e);
    if (quelle === null || quelle.text.trim().length === 0) {
      return nichtVerfuegbar;
    }
    try {
      const r = await this.deps.zusammenfassen(
        quelle.text.slice(0, KLARA_ERINNERUNG_ZUSAMMENFASSUNG_QUELLE_MAX),
        e.kontoId,
      );
      const ergebnis = r.text.trim();
      if (ergebnis.length === 0) {
        return nichtVerfuegbar;
      }
      return {
        status: "erstellt",
        text: ergebnis.slice(0, KLARA_ERINNERUNG_ZUSAMMENFASSUNG_MAX),
        ki: r.ki,
        quelleStand: quelle.stand,
      };
    } catch {
      return nichtVerfuegbar;
    }
  }

  private async zusammenfassungsQuelleAktuell(
    e: KlaraErinnerung,
    stand: ErinnerungQuellenStand,
  ): Promise<boolean> {
    const jetzt = await this.quelltext(e);
    return (
      jetzt !== null &&
      jetzt.stand.art === stand.art &&
      jetzt.stand.id === stand.id &&
      jetzt.stand.fassung === stand.fassung
    );
  }

  /**
   * Klara 11 (P07-AC05/AC06): die Kalendersperre JEDES Vorkommens, so wie sie JETZT gespeichert ist.
   * `pausiert` → NUR dieser Lauf wartet („unklar“, `kalender_pausiert`); `beendet` → dieser Lauf
   * endet ohne Wirkung („abgebrochen“, `kalender_beendet`); nicht lesbar → keine Wirkung
   * („fehlgeschlagen“, `kalender_unlesbar`, begrenzt wieder aufgenommen). Gesperrte Läufe werden aus
   * `gueltig` entfernt; die übrigen wirken wie bisher. `true`: kein Lauf ist mehr frei.
   */
  private async kalenderGesperrt(
    e: KlaraErinnerung,
    gueltig: { lauf: KlaraErinnerungLauf; hinweis: ZeitHinweis | null }[],
    z: Zaehler,
    extra: KlaraErinnerungLauf["ergebnis"],
  ): Promise<boolean> {
    const sperre = this.deps.vorkommenSperre;
    if (!sperre) {
      return false;
    }
    const frei: typeof gueltig = [];
    for (const x of gueltig) {
      let stand: KlaraErinnerungVorkommenSperre;
      try {
        stand = await sperre(e.kontoId, e.id, x.lauf.vorkommenId);
      } catch {
        await this.schliesseAlle([x], "fehlgeschlagen", "kalender_unlesbar", extra);
        z.fehlgeschlagen += 1;
        continue;
      }
      if (stand === "pausiert") {
        await this.schliesseAlle([x], "unklar", "kalender_pausiert", extra);
        z.unklar += 1;
      } else if (stand === "beendet") {
        await this.schliesseAlle([x], "abgebrochen", "kalender_beendet", extra);
        z.abgebrochen += 1;
      } else {
        frei.push(x);
      }
    }
    gueltig.splice(0, gueltig.length, ...frei);
    return frei.length === 0;
  }

  /**
   * Konto der Empfängerin und eigene Quelle, so wie sie JETZT sind. Gesperrt/abgelaufen → Läufe
   * „gestoppt“; Quelle gelöscht → „unklar“ (wartet auf die Entscheidung der Person); Quelle nicht
   * lesbar → „fehlgeschlagen“. `true`: es darf nichts geschrieben werden, die Läufe sind geschlossen.
   * Klara 11: zuerst die Kalendersperre je Vorkommen — gesperrte Läufe verlassen `gueltig`.
   */
  private async gesperrt(
    e: KlaraErinnerung,
    empfaenger: string,
    gueltig: { lauf: KlaraErinnerungLauf; hinweis: ZeitHinweis | null }[],
    z: Zaehler,
    extra: KlaraErinnerungLauf["ergebnis"] = {},
  ): Promise<boolean> {
    if (await this.kalenderGesperrt(e, gueltig, z, extra)) {
      return true;
    }
    if (!(await this.kontoAktiv(empfaenger))) {
      await this.pausiereWissenspflege(e);
      await this.schliesseAlle(gueltig, "gestoppt", "konto_gesperrt", extra);
      z.gestoppt += gueltig.length;
      return true;
    }
    if (this.deps.quellschutz) {
      try {
        if ((await this.deps.quellschutz(e, empfaenger)) === null) {
          await this.schliesseAlle(gueltig, "gestoppt", "quelle_unlesbar", extra);
          z.gestoppt += gueltig.length;
          return true;
        }
      } catch {
        // Ein ausgefallener Leser ist kein positiver Entzugsbeleg und erlaubt keine Wirkung.
        await this.schliesseAlle(gueltig, "fehlgeschlagen", "quelle_unlesbar", extra);
        z.fehlgeschlagen += gueltig.length;
        return true;
      }
    }
    if (e.bezug.art === "frei" || e.quelleFehltAkzeptiert) {
      return false;
    }
    const da = await this.quelleDa(e);
    if (da === true) {
      return false;
    }
    await this.schliesseAlle(
      gueltig,
      da === false ? "unklar" : "fehlgeschlagen",
      da === false ? "quelle_geloescht" : "quelle_unlesbar",
      extra,
    );
    if (da === false) {
      z.unklar += gueltig.length;
    } else {
      z.fehlgeschlagen += gueltig.length;
    }
    return true;
  }

  private async schliesseAlle(
    eintraege: readonly { lauf: KlaraErinnerungLauf; hinweis: ZeitHinweis | null }[],
    status: KlaraErinnerungLaufStatus,
    grund: KlaraErinnerungLaufGrund,
    // EQF-07: ein schon angelegter Bericht bleibt am Lauf sichtbar, auch ohne Erfolgssiegel.
    extra: KlaraErinnerungLauf["ergebnis"] = {},
  ): Promise<void> {
    for (const x of eintraege) {
      await this.deps.ablage.laeufe.schliesse(
        x.lauf.vorkommenId,
        this.besitzer,
        status,
        { ...extra, grund, ...(x.hinweis ? { hinweis: x.hinweis } : {}) },
        this.jetzt(),
      );
    }
  }

  // ----------------------------------------------------------------------------------------------
  // EQF-07 · DER ROUTINENSCHRITT — Teil DESSELBEN Laufs, keine zweite Zeitsteuerung.
  // ----------------------------------------------------------------------------------------------

  /**
   * Phase 1: Gibt es den Bericht dieses Vorkommens schon (zweiter Ausführer, verlorene Antwort,
   * Wiederanlauf)? Dann gilt er (Readback). Sonst werden die Quellen JETZT gelesen. Ist das Lesen
   * des Bestands selbst unmöglich, bleibt der Ausgang `unklar` — kein blinder zweiter Bericht.
   */
  private async routineVorbereiten(
    e: KlaraErinnerung,
    lauf: KlaraErinnerungLauf,
  ): Promise<
    | {
        art: "vorhanden";
        ergebnis: KlaraRoutineErgebnis;
        pflegeQuellen?: readonly GelesenePflegeQuelle[];
      }
    | RoutineEntwurf
    | { art: "fehlgeschlagen"; grund: KlaraErinnerungLaufGrund }
    | { art: "unklar" }
    | { art: "pflege_ohne_wirkung"; ergebnis: PflegeErgebnis }
  > {
    const ablage = this.deps.ergebnisablage;
    const routine = e.routine;
    if (!ablage || !routine) {
      return { art: "fehlgeschlagen", grund: "zustellung_gescheitert" };
    }
    if (routine.wissenspflege) return this.pflegeVorbereiten(e, lauf);
    const vorgang = ergebnisVorgang(lauf.vorkommenId);
    let vorhanden: KlaraNotiz | null;
    try {
      vorhanden = await ablage.zuVorgang(e.kontoId, vorgang);
    } catch {
      return { art: "unklar" };
    }
    if (vorhanden) {
      return { art: "vorhanden", ergebnis: { ...ergebnisAusBericht(vorhanden), wiederholt: true } };
    }
    const geplant = Date.parse(lauf.geplantFuer);
    const seit = geplant - ROUTINE_RUECKBLICK_TAGE * 86_400_000;
    const teile: BerichtTeil[] = [];
    const offen: { was: string; grund: "quelle_geloescht" | "quelle_unlesbar" }[] = [];
    // Wie viele Quellen tatsächlich gelesen werden konnten (auch „gelöscht“ ist ein gelesener Stand).
    let gelesen = 0;
    for (const a of routine.abschnitte) {
      const titel = abschnittTitel(a);
      try {
        const eintraege = await this.routineAbschnitt(e, a, seit, geplant);
        teile.push({ titel, eintraege, fehlt: null });
        gelesen += 1;
      } catch {
        teile.push({ titel, eintraege: [], fehlt: "quelle_unlesbar" });
        offen.push({ was: titel, grund: "quelle_unlesbar" });
      }
    }
    if (routine.notizIds.length > 0) {
      const eintraege: BerichtQuelle[] = [];
      for (const id of routine.notizIds) {
        try {
          const n = this.deps.notizen ? await this.deps.notizen.hole(e.kontoId, id) : null;
          gelesen += 1;
          if (n) {
            eintraege.push(notizEintrag(n));
          } else {
            offen.push({ was: `Notiz ${id}`, grund: "quelle_geloescht" });
          }
        } catch {
          offen.push({ was: `Notiz ${id}`, grund: "quelle_unlesbar" });
        }
      }
      teile.push({ titel: FESTE_NOTIZEN_TITEL, eintraege, fehlt: null });
    }
    if (gelesen === 0) {
      // Nichts lesbar: kein leerer Bericht mit Erfolgssiegel — der Lauf scheitert sichtbar und wird
      // (begrenzt) wieder aufgenommen.
      return { art: "fehlgeschlagen", grund: "quelle_unlesbar" };
    }
    const l = lokalVon(geplant, e.zeitzone);
    const termin = `${l.datum} ${l.uhrzeit} (${e.zeitzone})`;
    return {
      art: "neu",
      vorgang,
      titel: `${e.titel} · ${l.datum}`.slice(0, 200),
      inhalt: berichtText({
        titel: e.titel,
        termin,
        routineFassung: routine.fassung,
        teile,
        offen,
      }).slice(0, 20_000),
      quellen: quellenVon(teile),
      offen,
      teile,
      termin,
    };
  }

  private async pflegeVorbereiten(
    e: KlaraErinnerung,
    lauf: KlaraErinnerungLauf,
  ): Promise<
    | RoutineEntwurf
    | {
        art: "vorhanden";
        ergebnis: KlaraRoutineErgebnis;
        pflegeQuellen?: readonly GelesenePflegeQuelle[];
      }
    | { art: "fehlgeschlagen"; grund: KlaraErinnerungLaufGrund }
    | { art: "pflege_ohne_wirkung"; ergebnis: PflegeErgebnis }
    | { art: "unklar" }
  > {
    const routine = e.routine;
    const leser = this.deps.wissenspflege;
    const ablage = this.deps.ergebnisablage;
    if (!routine?.wissenspflege || !leser || !ablage || this.empfaengerVon(e) !== e.kontoId)
      return { art: "fehlgeschlagen", grund: "quelle_unlesbar" };
    const laeufe = await this.deps.ablage.laeufe.fuerErinnerung(e.id, 30);
    const vorher = laeufe.find(
      (l) =>
        l.vorkommenId !== lauf.vorkommenId &&
        (l.ergebnis.wissenspflege || l.ergebnis.routine?.wissenspflege),
    );
    let entwurf = await bereiteWissenspflegeVor(
      routine.wissenspflege,
      e.kontoId,
      leser,
      new Date(this.jetzt()).toISOString(),
      lauf.ergebnis.wissenspflege ??
        vorher?.ergebnis.wissenspflege ??
        vorher?.ergebnis.routine?.wissenspflege ??
        null,
    );
    if (routine.wissenspflege.normbekanntmachungen === "belege_vorbereiten") {
      let stand: NonNullable<PflegeErgebnis["normbekanntmachungen"]>["stand"] = "ungeprueft";
      let folgepruefung: NonNullable<PflegeErgebnis["normbekanntmachungen"]>["folgepruefung"];
      const folge: NormFolgeversuch | undefined =
        routine.wissenspflege.folgepruefung === "persoenliche_normpruefaufgabe"
          ? {
              erinnerungId: e.id,
              erinnerungFassung: e.fassung,
              routineFassung: routine.fassung,
              vorkommenId: lauf.vorkommenId,
              besitzer: this.besitzer,
              pruefeAktuell: async () => {
                const jetzt = await this.deps.ablage.erinnerungen.hole(e.kontoId, e.id);
                const l = await this.deps.ablage.laeufe.hole(lauf.vorkommenId);
                const r = jetzt?.erinnerung;
                if (
                  !r ||
                  r.status !== "aktiv" ||
                  r.fassung !== e.fassung ||
                  r.routine?.fassung !== routine.fassung ||
                  r.routine.wissenspflege?.normbekanntmachungen !== "belege_vorbereiten" ||
                  r.routine.wissenspflege?.folgepruefung !== "persoenliche_normpruefaufgabe" ||
                  this.empfaengerVon(r) !== e.kontoId ||
                  !l ||
                  l.erinnerungId !== e.id ||
                  l.kontoId !== e.kontoId ||
                  l.vorkommenId !== lauf.vorkommenId ||
                  l.besitzer !== this.besitzer ||
                  l.status !== "laeuft"
                )
                  throw new Error(
                    "Die aktuelle eigene Normfolgeprüfbestellung oder der gehaltene Lauf gilt nicht mehr.",
                  );
              },
            }
          : undefined;
      if (entwurf.ergebnis.stand !== "ungeprueft") {
        const vorbereiten = this.deps.normereignisse;
        if (!vorbereiten) return { art: "fehlgeschlagen", grund: "quelle_unlesbar" };
        if (!(await Promise.all(entwurf.gelesen.map((q) => q.nochAktuell()))).every(Boolean))
          return { art: "fehlgeschlagen", grund: "quelle_geaendert" };
        try {
          const n = await vorbereiten(
            e.kontoId,
            routine.wissenspflege.quellen,
            this.notizBedingung(e, [], lauf, entwurf.gelesen),
            folge,
          );
          if (folge) folgepruefung = n.folgepruefung ?? { stand: "nicht_verfuegbar" };
          stand = n.ungeprueft.length
            ? "ungeprueft"
            : n.ereignisse.length
              ? "belege_vorbereitet"
              : "keine_erkannten_belege";
        } catch {
          return { art: "fehlgeschlagen", grund: "quelle_geaendert" };
        }
      }
      entwurf = {
        ...entwurf,
        ergebnis: {
          ...entwurf.ergebnis,
          normbekanntmachungen: {
            stand,
            ...(folge ? { folgepruefung: folgepruefung ?? { stand: "nicht_verfuegbar" } } : {}),
          },
        },
      };
    }
    if (entwurf.ergebnis.stand !== "vorbereitet") {
      if (entwurf.ergebnis.stand === "ungeprueft") {
        // Keine frühere Quellberechtigung fortschreiben. Nur diesen Auftrag über seine normale CAS pausieren.
        await this.pausiereWissenspflege(e);
      }
      return { art: "pflege_ohne_wirkung", ergebnis: entwurf.ergebnis };
    }
    const vorgang = pflegeVorgang(e.id, routine.fassung, lauf.vorkommenId, entwurf.ergebnis);
    if (
      !(await this.deps.ablage.laeufe.vermerke(
        lauf.vorkommenId,
        this.besitzer,
        {
          ...lauf.ergebnis,
          wissenspflege: entwurf.ergebnis,
          pflegeNotizVorgang: vorgang,
          pflegeMeldungId: entwurf.ergebnis.aenderung ? `ke-${vorgang}` : lauf.meldungId,
          pflegeRoutineFassung: routine.fassung,
        },
        this.jetzt(),
      ))
    )
      return { art: "fehlgeschlagen", grund: "abbruch" };
    let vorhanden: KlaraNotiz | null;
    try {
      vorhanden = await ablage.zuVorgang(e.kontoId, vorgang);
    } catch {
      return { art: "unklar" };
    }
    if (!vorhanden && entwurf.ergebnis.aenderung) {
      const frueherEntfernt = laeufe.some(
        (l) =>
          l.ergebnis.wissenspflege?.aenderung === entwurf.ergebnis.aenderung &&
          l.ergebnis.wissenspflege.stand === "ergebnis_entfernt",
      );
      const fruehererBericht = laeufe.some(
        (l) => l.ergebnis.routine?.wissenspflege?.aenderung === entwurf.ergebnis.aenderung,
      );
      const fruehereMeldung = await this.deps.ablage.meldungen.hole(`ke-${vorgang}`);
      if (
        frueherEntfernt ||
        fruehererBericht ||
        fruehereMeldung?.routine?.wissenspflege?.aenderung === entwurf.ergebnis.aenderung
      )
        return {
          art: "pflege_ohne_wirkung",
          ergebnis: { ...entwurf.ergebnis, stand: "ergebnis_entfernt" },
        };
    }
    if (vorhanden) {
      if (vorhanden.inhalt !== entwurf.inhalt)
        return {
          art: "fehlgeschlagen",
          grund: vorhanden.fassung > 1 ? "bericht_geaendert" : "quelle_geaendert",
        };
      return {
        art: "vorhanden",
        pflegeQuellen: entwurf.gelesen,
        ergebnis: {
          ...ergebnisAusBericht(vorhanden),
          routineFassung: routine.fassung,
          wissenspflege: entwurf.ergebnis,
          wiederholt: true,
        },
      };
    }
    const l = lokalVon(Date.parse(lauf.geplantFuer), e.zeitzone);
    return {
      art: "neu",
      vorgang,
      titel: entwurf.titel,
      inhalt: entwurf.inhalt,
      quellen: [],
      offen: [],
      teile: [],
      termin: `${l.datum} ${l.uhrzeit} (${e.zeitzone})`,
      wissenspflege: entwurf.ergebnis,
      pflegeQuellen: entwurf.gelesen,
    };
  }

  private async pausiereWissenspflege(e: KlaraErinnerung): Promise<void> {
    if (!e.routine?.wissenspflege) return;
    const heute = await this.deps.ablage.erinnerungen.holeSystem(e.id);
    if (heute?.erinnerung.fassung !== e.fassung || heute.erinnerung.status !== "aktiv") return;
    const pausiert: KlaraErinnerung = {
      ...heute.erinnerung,
      status: "pausiert",
      fassung: e.fassung + 1,
      geaendertAm: new Date(this.jetzt()).toISOString(),
    };
    await this.deps.ablage.erinnerungen.ersetze(
      pausiert,
      steuerNach(pausiert, heute.steuer.bearbeitetBis),
    );
  }

  private pflegeBedingung(quellen: readonly GelesenePflegeQuelle[]): NotizSchreibbedingung {
    return {
      gilt: () => quellen.every((q) => q.bedingung.gilt?.() !== false),
      sql: (start) => {
        const und: string[] = [];
        const params: unknown[] = [];
        for (const q of quellen) {
          const b = q.bedingung.sql?.(start + params.length);
          if (!b) throw new Error("Wissenspflegequelle ohne Schreibbedingung");
          und.push(...b.und);
          params.push(...b.params);
        }
        return { und, params };
      },
    };
  }

  /**
   * Nacharbeit 9 (Ben, EQF-07-K07): Sind die gelesenen Quellen JETZT noch in genau der gelesenen
   * Fassung vorhanden? Nein (geändert, gelöscht, nicht lesbar) → die Steuerung liest neu und
   * entscheidet neu; der Bericht entsteht nie aus einem überholten Stand.
   */
  private async routineQuellenAktuell(
    e: KlaraErinnerung,
    quellen: KlaraRoutineErgebnis["quellen"],
  ): Promise<boolean> {
    try {
      for (const q of quellen) {
        const jetzt =
          q.art === "notiz"
            ? await this.deps.notizen?.hole(e.kontoId, q.id)
            : await this.deps.aufgaben?.hole(e.kontoId, q.id);
        if (!jetzt || jetzt.fassung !== q.fassung) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  private laufBedingungen(
    laeufe: readonly KlaraErinnerungLauf[],
    status: readonly KlaraErinnerungLaufStatus[] = ["laeuft"],
  ): LaufBedingung[] {
    return laeufe.map((l) => ({ id: l.vorkommenId, besitzer: this.besitzer, status }));
  }

  /**
   * Die Bedingung, unter der ein Routinenbericht geschrieben werden darf — beim tatsächlichen
   * Speichern: Routine aktiv in dieser Fassung, Konto berechtigt, gelesene Quellen unverändert.
   * PostgreSQL: dieselbe Bedingung wie das Meldungsschreiben (`bedingungSql`) im Notizbefehl;
   * Speicherablage: Routine aktiv in dieser Fassung, synchron vor dem Schreiben.
   */
  private notizBedingung(
    e: KlaraErinnerung,
    quellen: KlaraRoutineErgebnis["quellen"],
    lauf: KlaraErinnerungLauf,
    pflegeQuellen?: readonly GelesenePflegeQuelle[],
  ): NotizSchreibbedingung {
    const b: MeldungBedingung = {
      erinnerungId: e.id,
      fassung: e.fassung,
      empfaenger: { kontoId: e.kontoId, jetzt: this.jetzt() },
      quellenStand: quellen.map((q) => ({ ...q, kontoId: e.kontoId })),
      laeufe: this.laufBedingungen([lauf]),
      ...(pflegeQuellen ? { pflegeQuelle: this.pflegeBedingung(pflegeQuellen) } : {}),
    };
    const er = this.deps.ablage.erinnerungen as Partial<AktivPruefer>;
    const pruefer = typeof er.aktivInFassung === "function" ? er : null;
    return {
      ...(pruefer?.aktivInFassung
        ? {
            gilt: () =>
              pruefer.aktivInFassung?.(b.erinnerungId, b.fassung) === true &&
              pruefer.laufBedingungen?.(b.laeufe ?? []) === true &&
              b.pflegeQuelle?.gilt?.() !== false,
          }
        : {}),
      sql: (start) => bedingungSql(b, start),
    };
  }

  /**
   * EQF-07-K09 (Nacharbeit 9): kam eine Routine nicht zum Ergebnis, sagt die Glocke es — mit Grund
   * und ohne Erfolgssiegel. Eine Meldung je Termin (feste Kennung): Wiederholungen verdoppeln sie
   * nicht. Bedingt wie jede Wirkung (Routine aktiv, Konto berechtigt).
   */
  private async meldeHandlung(
    e: KlaraErinnerung,
    eintraege: readonly { lauf: KlaraErinnerungLauf }[],
    laufStatus: "fehlgeschlagen" | "unklar",
    grund: KlaraErinnerungLaufGrund,
  ): Promise<void> {
    if (e.aktion !== "routine_bericht") {
      return;
    }
    for (const x of eintraege) {
      try {
        await this.deps.ablage.meldungen.schreibe(
          {
            id: `ke-handlung-${x.lauf.vorkommenId}`,
            kontoId: e.kontoId,
            erinnerungId: e.id,
            art: "handlung",
            titel: e.titel,
            zugestelltAm: new Date(this.jetzt()).toISOString(),
            vorkommen: [x.lauf.geplantFuer],
            nachgeholt: false,
            pruefung: null,
            grund,
            laufStatus,
          },
          {
            erinnerungId: e.id,
            fassung: e.fassung,
            empfaenger: { kontoId: e.kontoId, jetzt: this.jetzt() },
            laeufe: this.laufBedingungen([x.lauf], [laufStatus]),
          },
        );
      } catch {
        // Die Lage des Laufs bleibt der Beleg; die Meldung folgt beim nächsten Versuch.
      }
    }
  }

  /** Ein Berichtsabschnitt aus den EIGENEN Ablagen — wirft, wenn die Ablage nicht lesbar ist. */
  private async routineAbschnitt(
    e: KlaraErinnerung,
    a: KlaraRoutine["abschnitte"][number],
    seit: number,
    bis: number,
  ): Promise<BerichtQuelle[]> {
    const imZeitraum = (iso: string | null): boolean => {
      const ms = iso ? Date.parse(iso) : Number.NaN;
      return ms > seit && ms <= bis;
    };
    if (a === "neue_notizen") {
      const liste = this.deps.notizen?.liste;
      if (!liste) {
        throw new Error("Notizablage nicht verfügbar");
      }
      const alle = await liste.call(this.deps.notizen, e.kontoId, {
        woerter: [],
        art: null,
        limit: 200,
      });
      return alle
        .filter((n) => !n.vorgang.startsWith("routine-") && imZeitraum(n.geaendertAm))
        .slice(0, ROUTINE_EINTRAEGE_MAX)
        .map(notizEintrag);
    }
    const liste = this.deps.aufgaben?.liste;
    if (!liste) {
      throw new Error("Aufgabenablage nicht verfügbar");
    }
    if (a === "offene_aufgaben") {
      const offen = await liste.call(this.deps.aufgaben, e.kontoId, "offen", ROUTINE_EINTRAEGE_MAX);
      return offen.map((t) => ({
        art: "aufgabe" as const,
        id: t.id,
        fassung: t.fassung,
        titel: t.titel,
        zusatz: `Priorität ${t.prioritaet}`,
      }));
    }
    const erledigt = await liste.call(this.deps.aufgaben, e.kontoId, "erledigt", 200);
    return erledigt
      .filter((t) => imZeitraum(t.erledigtAm))
      .slice(0, ROUTINE_EINTRAEGE_MAX)
      .map((t) => ({
        art: "aufgabe" as const,
        id: t.id,
        fassung: t.fassung,
        titel: t.titel,
        zusatz: `erledigt am ${(t.erledigtAm ?? "").slice(0, 10)}`,
      }));
  }

  /**
   * Phase 2: den Bericht in „Meine Notizen“ anlegen — mit dem festen Vorgangsschlüssel dieses
   * Vorkommens, also höchstens einmal, und (Nacharbeit 9) NUR, wenn beim tatsächlichen Speichern
   * Routine, Konto und gelesene Quellen noch gelten (`notizBedingung`). `veraltet`: es entstand
   * nichts, die Steuerung entscheidet neu. `fehler`: Ausgang offen — die Wiederaufnahme klärt per
   * Readback über den Vorgangsschlüssel, ob der Bericht doch angekommen ist.
   */
  private async routineSchreiben(
    e: KlaraErinnerung,
    v: RoutineEntwurf,
    lauf: KlaraErinnerungLauf,
  ): Promise<
    { art: "ok"; ergebnis: KlaraRoutineErgebnis } | { art: "veraltet" } | { art: "fehler" }
  > {
    const ablage = this.deps.ergebnisablage;
    const routine = e.routine;
    if (!ablage || !routine) {
      return { art: "fehler" };
    }
    try {
      const lege = async () => {
        if (
          v.pflegeQuellen &&
          !(await Promise.all(v.pflegeQuellen.map((q) => q.nochAktuell()))).every(Boolean)
        )
          throw new KlaraNotizFehler(
            409,
            "bedingung",
            "Die Pflegequelle wurde vor dem Schreiben geändert.",
          );
        return ablage.lege(
          e.kontoId,
          {
            vorgang: v.vorgang,
            weg: "geschrieben",
            art: "notiz",
            titel: v.titel,
            inhalt: v.inhalt,
            objektbezug: {
              pfad: `/aufgaben?erinnerung=${encodeURIComponent(e.id)}`,
              seitenName: "Meine Erinnerungen",
              objekt: e.titel.slice(0, 300),
            },
          },
          this.notizBedingung(e, v.quellen, lauf, v.pflegeQuellen),
        );
      };
      const { notiz, wiederholt } =
        v.pflegeQuellen && this.deps.wissenspflege
          ? await this.deps.wissenspflege.unterQuellschutz(lege)
          : await lege();
      if (wiederholt) {
        return {
          art: "ok",
          ergebnis: {
            ...ergebnisAusBericht(notiz),
            wiederholt: true,
            ...(v.wissenspflege
              ? { wissenspflege: v.wissenspflege, routineFassung: routine.fassung }
              : {}),
          },
        };
      }
      return {
        art: "ok",
        ergebnis: {
          status: v.offen.length > 0 ? "teilweise" : "erstellt",
          notizId: notiz.id,
          notizFassung: notiz.fassung,
          routineFassung: routine.fassung,
          erstelltAm: notiz.angelegtAm,
          quellen: v.quellen,
          offen: v.offen,
          teile: v.teile,
          termin: v.termin,
          fortsetzbar: v.offen.some((o) => o.grund === "quelle_unlesbar"),
          ...(v.wissenspflege ? { wissenspflege: v.wissenspflege } : {}),
        },
      };
    } catch (fehler) {
      if (fehler instanceof KlaraNotizFehler && fehler.grund === "bedingung") {
        return { art: "veraltet" };
      }
      return { art: "fehler" };
    }
  }

  private async pflegeMeldung(
    m: KlaraErinnerungMeldung,
    b: MeldungBedingung,
    e: KlaraErinnerung,
    ergebnis: KlaraRoutineErgebnis,
    urspruenglicheQuellen?: readonly GelesenePflegeQuelle[],
  ): Promise<MeldungSchreibergebnis> {
    const leser = this.deps.wissenspflege;
    if (!leser || !ergebnis.wissenspflege) return "veraltet";
    return leser.unterQuellschutz(async () => {
      if (
        urspruenglicheQuellen &&
        !(await Promise.all(urspruenglicheQuellen.map((q) => q.nochAktuell()))).every(Boolean)
      )
        return "veraltet";
      const quellen: GelesenePflegeQuelle[] = [];
      for (const stand of ergebnis.wissenspflege?.quellen ?? []) {
        const q = await leser.lies(e.kontoId, stand.id);
        if (!q || q.quelle.fassung !== stand.fassung) return "veraltet";
        quellen.push(q);
      }
      if (!(await Promise.all(quellen.map((q) => q.nochAktuell()))).every(Boolean))
        return "veraltet";
      const schonDa = (alt: KlaraErinnerungMeldung | null): boolean =>
        Boolean(
          alt &&
            alt.kontoId === m.kontoId &&
            alt.erinnerungId === m.erinnerungId &&
            alt.routine?.notizId === ergebnis.notizId &&
            alt.routine.wissenspflege?.aenderung === ergebnis.wissenspflege?.aenderung,
        );
      // Ein weiteres Polling desselben belegten Quellstands ist keine zweite Zustellung.
      if (ergebnis.wissenspflege?.aenderung && schonDa(await this.deps.ablage.meldungen.hole(m.id)))
        return "vorhanden";
      const geschrieben = await this.deps.ablage.meldungen.schreibe(m, {
        ...b,
        pflegeQuelle: this.pflegeBedingung(quellen),
      });
      if (
        geschrieben === "veraltet" &&
        ergebnis.wissenspflege?.aenderung &&
        schonDa(await this.deps.ablage.meldungen.hole(m.id))
      )
        return "vorhanden";
      return geschrieben;
    });
  }

  /**
   * EQF-07-K06 (Nacharbeit 9): den offenen Rest eines Teilberichts in DENSELBEN Bericht nachtragen.
   * Fertige Abschnitte bleiben unverändert; nur unlesbare Abschnitte und unlesbare feste Notizen
   * werden JETZT gelesen. Geschrieben wird nur in der zuletzt geschriebenen Fassung der Notiz — hat
   * die Person den Bericht bearbeitet, bleibt er, wie er ist (`bericht_geaendert`) — und nur unter
   * derselben Bedingung wie beim Anlegen. Kein zweiter Bericht.
   */
  private async routineFortsetzen(
    e: KlaraErinnerung,
    lauf: KlaraErinnerungLauf,
    z: Zaehler,
  ): Promise<void> {
    // Nacharbeit 11: eine vor der Berichtsänderung festgehaltene Fortsetzung (Absturzfenster) —
    // getrennt vom Ergebnis davor, das ohne sie weitergetragen wird.
    const vorher = lauf.ergebnis.routine;
    const offeneFortsetzung = vorher?.fortsetzung;
    const r: KlaraRoutineErgebnis | undefined = vorher
      ? (({ fortsetzung: _f, ...rest }) => rest)(vorher)
      : undefined;
    const schliesse = (
      status: KlaraErinnerungLaufStatus,
      routine: KlaraRoutineErgebnis,
      grund?: KlaraErinnerungLaufGrund,
    ) => {
      const { grund: _alt, ...rest } = lauf.ergebnis;
      return this.deps.ablage.laeufe.schliesse(
        lauf.vorkommenId,
        this.besitzer,
        status,
        { ...rest, routine, ...(grund ? { grund } : {}) },
        this.jetzt(),
      );
    };
    if (!r) {
      return;
    }
    if (r.meldungAusstehend) {
      // Nacharbeit 12 (Ben, EQF-07-K09): der Bericht ist fertig fortgesetzt — NUR die ausstehende
      // Meldung nachholen (Readback über die feste Kennung). Keine erneute Berichtsänderung.
      await this.meldungUndAbschluss(
        e,
        lauf,
        r,
        r.offen.length > 0 ? "teilweise" : "zugestellt",
        schliesse,
        z,
      );
      return;
    }
    const ablage = this.deps.ergebnisablage;
    if (e.status !== "aktiv" || e.aktion !== "routine_bericht") {
      await schliesse("teilweise", { ...r, fortsetzbar: false }, "status_geaendert");
      return;
    }
    if (!(await this.kontoAktiv(e.kontoId))) {
      await schliesse("teilweise", { ...r, fortsetzbar: false }, "konto_gesperrt");
      return;
    }
    if (!ablage?.aendere || !ablage.hole || !r.teile || !r.termin) {
      await schliesse("teilweise", { ...r, fortsetzbar: false });
      return;
    }
    let bericht: KlaraNotiz | null;
    try {
      bericht = await ablage.hole(e.kontoId, r.notizId);
    } catch {
      // Ablage gerade nicht lesbar: bleibt fortsetzbar, der nächste Versuch kommt wieder. Eine
      // festgehaltene, noch unbestätigte Fortsetzung bleibt stehen — ihr Ausgang ist unklar.
      await schliesse(
        "teilweise",
        offeneFortsetzung ? { ...r, fortsetzung: offeneFortsetzung } : r,
        offeneFortsetzung ? "readback_unmoeglich" : undefined,
      );
      return;
    }
    if (bericht && bericht.fassung !== r.notizFassung) {
      // Readback (Nacharbeit 11): war es die EIGENE Fortsetzung, deren Abschluss verloren ging
      // (Absturz nach der Berichtsänderung, vor Meldung und Laufabschluss)? Erkannt an der VOR der
      // Änderung festgehaltenen Zielfassung und Inhaltsprüfsumme — nicht an der Meldung. Dann gilt
      // deren Ergebnis; nichts wird ein zweites Mal geschrieben.
      const f = offeneFortsetzung;
      if (
        f &&
        f.vonFassung === r.notizFassung &&
        f.nachFassung === bericht.fassung &&
        f.inhaltHash === pruefsumme(bericht.inhalt)
      ) {
        // Die Berichtswirkung ist bestätigt; die Meldung folgt getrennt (ggf. ausstehend).
        z.dedupliziert += 1;
        await this.meldungUndAbschluss(e, lauf, f.ergebnis, f.laufStatus, schliesse, null);
        return;
      }
      // Älterer Weg: die eigene Fortsetzungsmeldung derselben Fassung.
      const eigene = await this.deps.ablage.meldungen
        .hole(`${lauf.meldungId}-fortgesetzt-${bericht.fassung}`)
        .catch(() => null);
      if (eigene?.routine && eigene.routine.notizFassung === bericht.fassung) {
        await schliesse(eigene.laufStatus, eigene.routine);
        z.dedupliziert += 1;
        return;
      }
    }
    if (!bericht || bericht.fassung !== r.notizFassung) {
      // Fremde (bzw. eigene, spätere) Arbeit am Bericht wird nicht überschrieben.
      await schliesse("teilweise", { ...r, fortsetzbar: false }, "bericht_geaendert");
      return;
    }
    const geplant = Date.parse(lauf.geplantFuer);
    const seit = geplant - ROUTINE_RUECKBLICK_TAGE * 86_400_000;
    const teile: BerichtTeil[] = [];
    // Nacharbeit 11 (Ben, EQF-07-K06): JETZT gelesene Quellen des offenen Rests — nur sie werden
    // vor der Wirkung auf ihre Fassung geprüft. Fertige Abschnitte sind historische Belege ihres
    // Laufs: sie bleiben, wie sie sind, auch wenn sich ihre Quelle seitdem geändert hat.
    const frisch: BerichtQuelle[] = [];
    let nachgeholt = 0;
    for (const t of r.teile) {
      const a = t.fehlt ? abschnittVonTitel(t.titel) : null;
      if (!a) {
        teile.push(t);
        continue;
      }
      try {
        const eintraege = await this.routineAbschnitt(e, a, seit, geplant);
        teile.push({ titel: t.titel, eintraege, fehlt: null });
        frisch.push(...eintraege);
        nachgeholt += 1;
      } catch {
        teile.push(t);
      }
    }
    const offen: { was: string; grund: "quelle_geloescht" | "quelle_unlesbar" }[] = [];
    for (const o of r.offen) {
      const notizId = o.grund === "quelle_unlesbar" ? /^Notiz (.+)$/.exec(o.was)?.[1] : undefined;
      if (o.grund === "quelle_unlesbar" && abschnittVonTitel(o.was)) {
        // Abschnitt: bleibt offen, solange er oben nicht gelesen werden konnte.
        if (teile.some((t) => t.titel === o.was && t.fehlt)) {
          offen.push(o);
        }
        continue;
      }
      if (!notizId) {
        offen.push(o);
        continue;
      }
      try {
        const n = this.deps.notizen ? await this.deps.notizen.hole(e.kontoId, notizId) : null;
        if (!n) {
          // Jetzt lesbar, aber gelöscht: der Rest bleibt offen — mit dem tatsächlichen Grund.
          offen.push({ was: o.was, grund: "quelle_geloescht" });
          nachgeholt += 1;
          continue;
        }
        nachgeholt += 1;
        const i = teile.findIndex((t) => t.titel === FESTE_NOTIZEN_TITEL);
        const fest = i >= 0 ? teile[i] : undefined;
        const eintrag = notizEintrag(n);
        frisch.push(eintrag);
        const neu: BerichtTeil = {
          titel: FESTE_NOTIZEN_TITEL,
          eintraege: [...(fest?.eintraege ?? []), eintrag],
          fehlt: null,
        };
        if (i >= 0) {
          teile[i] = neu;
        } else {
          teile.push(neu);
        }
      } catch {
        offen.push(o);
      }
    }
    if (nachgeholt === 0) {
      // Nichts nachholbar in diesem Versuch: Teilbericht bleibt, die Versuchsgrenze zählt.
      await schliesse("teilweise", r);
      return;
    }
    // Alle Quellen des Berichts (Ergebnis) — geprüft werden nur die JETZT gelesenen. Heutige Rechte
    // (Routine aktiv in dieser Fassung, Konto berechtigt) und die Zielfassung des Berichts gelten
    // weiterhin für die ganze Wirkung.
    const quellen = quellenVon(teile);
    const frischeQuellen = quellenVon([{ titel: "", eintraege: frisch, fehlt: null }]);
    if (!(await this.routineQuellenAktuell(e, frischeQuellen))) {
      // Eine gerade gelesene Quelle hat sich geändert: nichts nachtragen, der nächste Versuch liest neu.
      await schliesse("teilweise", r);
      return;
    }
    const inhalt = berichtText({
      titel: e.titel,
      termin: r.termin,
      routineFassung: r.routineFassung,
      teile,
      offen,
    }).slice(0, 20_000);
    const status: "zugestellt" | "teilweise" = offen.length > 0 ? "teilweise" : "zugestellt";
    const geplanteFassung = r.notizFassung + 1;
    const neu: KlaraRoutineErgebnis = {
      ...r,
      status: offen.length > 0 ? "teilweise" : "erstellt",
      notizFassung: geplanteFassung,
      quellen,
      offen,
      teile,
      fortsetzbar: offen.some((o) => o.grund === "quelle_unlesbar"),
      fortgesetztAm: new Date(this.jetzt()).toISOString(),
    };
    // Nacharbeit 11 (Ben, AW18-K06): die Fortsetzung VOR der Berichtsänderung am gehaltenen Lauf
    // festhalten. Ein Absturz unmittelbar nach der Änderung lässt so ein Readback zu, das die eigene
    // Wirkung erkennt — ohne die nachgelagerte Meldung. Wird der Lauf nicht mehr gehalten (z. B.
    // aktiv beendet), wird nichts geschrieben.
    const fortsetzung = {
      vonFassung: r.notizFassung,
      nachFassung: geplanteFassung,
      inhaltHash: pruefsumme(inhalt),
      ergebnis: neu,
      laufStatus: status,
    };
    if (
      !(await this.deps.ablage.laeufe.vermerke(
        lauf.vorkommenId,
        this.besitzer,
        { ...lauf.ergebnis, routine: { ...r, fortsetzung } },
        this.jetzt(),
      ))
    ) {
      return;
    }
    let notiz: KlaraNotiz;
    try {
      ({ notiz } = await ablage.aendere(
        e.kontoId,
        r.notizId,
        { fassung: r.notizFassung, inhalt },
        this.notizBedingung(e, frischeQuellen, lauf),
      ));
    } catch (fehler) {
      if (fehler instanceof KlaraNotizFehler && fehler.grund === "bedingung") {
        // Nichts geschrieben (Routine, Konto oder eine gerade gelesene Quelle hat sich geändert):
        // die Absicht verfällt, später neu versuchen.
        await schliesse("teilweise", r);
        return;
      }
      if (fehler instanceof KlaraNotizFehler && fehler.grund === "konflikt") {
        await schliesse("teilweise", { ...r, fortsetzbar: false }, "bericht_geaendert");
        return;
      }
      // Ausgang UNKLAR (z. B. Antwort verloren): die festgehaltene Fortsetzung bleibt am Lauf, der
      // nächste Versuch liest den Bericht zurück und erkennt die eigene Fassung — kein blinder
      // zweiter Schreibversuch über eine womöglich schon geschehene Wirkung.
      await schliesse("teilweise", { ...r, fortsetzung }, "zustellung_gescheitert");
      return;
    }
    const ergebnis: KlaraRoutineErgebnis = { ...neu, notizFassung: notiz.fassung };
    await this.meldungUndAbschluss(e, lauf, ergebnis, status, schliesse, z);
  }

  /**
   * Nacharbeit 12 (Ben, EQF-07-K09, AW18-K06/K10): Berichtswirkung und Meldungswirkung GETRENNT.
   * Zuerst wird am gehaltenen Lauf festgehalten „Bericht fertig, Meldung ausstehend“ — ein Absturz
   * danach führt in die Wiederaufnahme, die nur noch die Meldung nachholt. Dann: Readback über die
   * feste Meldungskennung, sonst bedingt schreiben. Abgeschlossen als zugestellt/teilweise wird erst,
   * wenn die Meldung tatsächlich da ist. `veraltet`: heutige Lage lesen — Routine nicht mehr aktiv
   * oder Konto nicht berechtigt → keine Meldung, Lauf mit Grund abgeschlossen (der Bericht bleibt);
   * nur die Fassung geändert → einmal mit der heutigen Fassung neu versuchen. Fehler bzw. unklarer
   * Ausgang → Meldung bleibt ausstehend, begrenzt durch die Versuchsgrenze der Wiederaufnahme.
   */
  private async meldungUndAbschluss(
    e: KlaraErinnerung,
    lauf: KlaraErinnerungLauf,
    bericht: KlaraRoutineErgebnis,
    laufStatus: "zugestellt" | "teilweise",
    schliesse: (
      status: KlaraErinnerungLaufStatus,
      routine: KlaraRoutineErgebnis,
      grund?: KlaraErinnerungLaufGrund,
    ) => Promise<boolean>,
    z: Zaehler | null,
  ): Promise<void> {
    const { meldungAusstehend: _m, fortsetzung: _f, ...fertig }: KlaraRoutineErgebnis = bericht;
    const ausstehend: KlaraRoutineErgebnis = {
      ...fertig,
      meldungAusstehend: true,
      fortsetzbar: true,
    };
    if (
      !(await this.deps.ablage.laeufe.vermerke(
        lauf.vorkommenId,
        this.besitzer,
        { ...lauf.ergebnis, routine: ausstehend },
        this.jetzt(),
      ))
    ) {
      // Der Lauf wird nicht mehr gehalten (z. B. aktiv beendet): nichts weiter.
      return;
    }
    const meldungId = `${lauf.meldungId}-fortgesetzt-${fertig.notizFassung}`;
    // Abgeschlossenes Ergebnis: `fortsetzbar` nur, wenn noch ein unlesbarer Rest offen ist.
    const abgeschlossen: KlaraRoutineErgebnis = {
      ...fertig,
      fortsetzbar: fertig.offen.some((o) => o.grund === "quelle_unlesbar"),
    };
    let aktuell: KlaraErinnerung = e;
    for (let runde = 0; runde < 2; runde += 1) {
      const m = await this.meldeFortsetzung(aktuell, lauf, meldungId, abgeschlossen, laufStatus);
      if (m === "geschrieben" || m === "vorhanden") {
        await schliesse(laufStatus, abgeschlossen);
        if (z) {
          if (laufStatus === "zugestellt") {
            z.nachgeholt += 1;
          } else {
            z.teilweise += 1;
          }
        }
        return;
      }
      if (m === "fehler") {
        break;
      }
      // `veraltet`: was gilt HEUTE?
      const heute = (await this.deps.ablage.erinnerungen.holeSystem(e.id))?.erinnerung;
      const grund: KlaraErinnerungLaufGrund | null =
        !heute || heute.status !== "aktiv"
          ? "status_geaendert"
          : !(await this.kontoAktiv(this.empfaengerVon(heute)))
            ? "konto_gesperrt"
            : null;
      if (grund) {
        // Keine Meldung gegen Pause, Ende, Löschung oder Rechteentzug — der Bericht bleibt.
        await schliesse("teilweise", { ...abgeschlossen, fortsetzbar: false }, grund);
        if (z) {
          z.abgebrochen += 1;
        }
        return;
      }
      aktuell = heute ?? aktuell;
    }
    // Fehler, unklarer Ausgang oder wiederholt veraltet: Meldung bleibt AUSSTEHEND — die vorhandene
    // Wiederaufnahme liest beim nächsten Takt über die feste Kennung zurück und holt sie nach.
    await schliesse("teilweise", ausstehend, "zustellung_gescheitert");
    if (z) {
      z.fehlgeschlagen += 1;
    }
  }

  /**
   * Die Glocke zeigt das tatsächliche neue Ergebnis — je Berichtsfassung EINE Meldung (feste
   * Kennung). Zuerst Readback; `fehler`: Ausgang unklar (Ablage nicht erreichbar).
   */
  private async meldeFortsetzung(
    e: KlaraErinnerung,
    lauf: KlaraErinnerungLauf,
    meldungId: string,
    ergebnis: KlaraRoutineErgebnis,
    laufStatus: "zugestellt" | "teilweise",
  ): Promise<MeldungSchreibergebnis | "fehler"> {
    try {
      if (await this.deps.ablage.meldungen.hole(meldungId)) {
        return "vorhanden";
      }
      return await this.deps.ablage.meldungen.schreibe(
        {
          id: meldungId,
          kontoId: this.empfaengerVon(e),
          erinnerungId: e.id,
          art: "erinnerung",
          titel: e.titel,
          zugestelltAm: new Date(this.jetzt()).toISOString(),
          vorkommen: [lauf.geplantFuer],
          nachgeholt: true,
          pruefung: null,
          routine: ergebnis,
          laufStatus,
        },
        {
          erinnerungId: e.id,
          fassung: e.fassung,
          empfaenger: { kontoId: this.empfaengerVon(e), jetzt: this.jetzt() },
          laeufe: this.laufBedingungen([lauf]),
        },
      );
    } catch {
      return "fehler";
    }
  }

  /**
   * DIE EINE WIRKUNG — für Einzel-, Sammel- und wiederaufgenommene Läufe. Unmittelbar davor wird
   * gelesen, was HEUTE gilt: die Erinnerung (Status, Ausnahme jedes Termins, Fassung), das Konto der
   * Empfängerin und die eigene Quelle. Geschrieben wird nur, wenn die Erinnerung in genau dieser
   * Fassung noch aktiv ist (`schreibe` mit Bedingung). Kam eine Änderung dazwischen (`veraltet`),
   * wird neu gelesen und neu entschieden — höchstens dreimal, danach nichts geschrieben.
   */
  private async wirke(
    erinnerungId: string,
    eintraege: readonly { lauf: KlaraErinnerungLauf; hinweis: ZeitHinweis | null }[],
    art: KlaraErinnerungMeldungArt,
    nachgeholt: boolean,
    z: Zaehler,
  ): Promise<void> {
    let offen = [...eintraege];
    // EQF-07: ein in diesem Lauf schon angelegter Routinenbericht — jeder Abschluss trägt ihn mit.
    let routineStand: KlaraRoutineErgebnis | null = null;
    let letztePflegeNotiz: KlaraRoutineErgebnis | null =
      eintraege.map((x) => x.lauf.ergebnis.routine).find((r) => r?.wissenspflege !== undefined) ??
      null;
    let pflegeQuellenOriginal: readonly GelesenePflegeQuelle[] | undefined;
    const mitRoutine = (): KlaraErinnerungLauf["ergebnis"] => {
      const gespeichert = routineStand ?? letztePflegeNotiz;
      return gespeichert ? { routine: gespeichert } : {};
    };
    // Warum nach drei Runden nichts geschrieben wurde (Nacharbeit 9: auch geänderte Quellen).
    let letzterGrund: KlaraErinnerungLaufGrund = "status_geaendert";
    let letzteErinnerung: KlaraErinnerung | null = null;
    for (let runde = 0; runde < 3 && offen.length > 0; runde += 1) {
      const jetzt = this.jetzt();
      const eintrag = await this.deps.ablage.erinnerungen.holeSystem(erinnerungId);
      const gueltig: typeof offen = [];
      for (const x of offen) {
        const gehalten = await this.deps.ablage.laeufe.hole(x.lauf.vorkommenId);
        if (!gehalten || gehalten.status !== "laeuft" || gehalten.besitzer !== this.besitzer)
          continue;
        const grund = eintrag
          ? this.terminGrund(eintrag.erinnerung, x.lauf, jetzt)
          : "status_geaendert";
        if (grund === null) {
          gueltig.push(x);
        } else if (grund === "verlegt" && !routineStand) {
          await this.deps.ablage.laeufe.gibFrei(x.lauf.vorkommenId, this.besitzer);
        } else {
          // Ein schon angelegter Bericht wird nicht still freigegeben: der Lauf endet sichtbar.
          const abbruch = grund === "verlegt" ? "termin_geaendert" : grund;
          await this.schliesseAlle([x], "abgebrochen", abbruch, mitRoutine());
          z.abgebrochen += 1;
        }
      }
      if (!eintrag || gueltig.length === 0) {
        return;
      }
      const e = eintrag.erinnerung;
      letzteErinnerung = e;
      const empfaenger = this.empfaengerVon(e);
      // Vor den abhängigen Schritten: kein Modellaufruf für ein gesperrtes Konto oder eine fehlende
      // Quelle.
      if (await this.gesperrt(e, empfaenger, gueltig, z, mitRoutine())) {
        return;
      }
      const kopf = gueltig[0];
      if (!kopf) {
        return;
      }
      const pruefung =
        art === "erinnerung" || art === "zusammenfassung" ? await this.pruefung(e) : null;
      const zusammenfassung = art === "erinnerung" ? await this.zusammenfassung(e) : null;
      // EQF-07: Routine — zuerst Readback (gibt es den Bericht dieses Termins schon?), sonst die
      // Quellen JETZT lesen. Geschrieben wird erst nach der erneuten Rechte-/Quellenprüfung unten.
      let routineEntwurf: RoutineEntwurf | null = null;
      if (art === "erinnerung" && e.aktion === "routine_bericht" && !routineStand) {
        const v = await this.routineVorbereiten(e, kopf.lauf);
        if (v.art === "vorhanden") {
          routineStand = v.ergebnis;
          if (v.ergebnis.wissenspflege) letztePflegeNotiz = v.ergebnis;
          pflegeQuellenOriginal = v.pflegeQuellen;
        } else if (v.art === "neu") {
          routineEntwurf = v;
          pflegeQuellenOriginal = v.pflegeQuellen;
        } else if (v.art === "pflege_ohne_wirkung") {
          const status = v.ergebnis.stand === "ungeprueft" ? "gestoppt" : "uebersprungen";
          for (const x of gueltig)
            await this.deps.ablage.laeufe.schliesse(
              x.lauf.vorkommenId,
              this.besitzer,
              status,
              {
                wissenspflege: v.ergebnis,
                ...(status === "gestoppt" ? { grund: "quelle_unlesbar" as const } : {}),
              },
              this.jetzt(),
            );
          if (status === "gestoppt") z.gestoppt += gueltig.length;
          else z.uebersprungen += gueltig.length;
          return;
        } else if (v.art === "unklar") {
          // Ob der Bericht schon angelegt ist, lässt sich nicht feststellen: kein blinder zweiter.
          await this.schliesseAlle(gueltig, "unklar", "readback_unmoeglich", mitRoutine());
          z.unklar += gueltig.length;
          await this.meldeHandlung(e, gueltig, "unklar", "readback_unmoeglich");
          return;
        } else {
          await this.schliesseAlle(gueltig, "fehlgeschlagen", v.grund, mitRoutine());
          z.fehlgeschlagen += 1;
          await this.meldeHandlung(e, gueltig, "fehlgeschlagen", v.grund);
          return;
        }
      }
      // Nacharbeit 4 (Ben): die abhängigen Schritte (Aufgabenstand, Modellaufruf, Quellen der
      // Routine) können dauern. Danach gelten Konto und Quelle erneut, so wie sie JETZT sind — und
      // das Schreiben unten hält beides zusätzlich in derselben Bedingung fest (PostgreSQL).
      if (await this.gesperrt(e, empfaenger, gueltig, z, mitRoutine())) {
        return;
      }
      for (let i = gueltig.length - 1; i >= 0; i -= 1) {
        const x = gueltig[i];
        if (!x) continue;
        const l = await this.deps.ablage.laeufe.hole(x.lauf.vorkommenId);
        if (!l || l.status !== "laeuft" || l.besitzer !== this.besitzer) gueltig.splice(i, 1);
      }
      if (gueltig.length === 0) return;
      if (
        zusammenfassung?.quelleStand &&
        !(await this.zusammenfassungsQuelleAktuell(e, zusammenfassung.quelleStand))
      ) {
        // Die existierende Quelle wurde während der Modellantwort geändert. Kein alter Text
        // als aktuelles Ergebnis; die bestehende begrenzte Wiederaufnahme liest die neue Fassung.
        await this.schliesseAlle(gueltig, "unklar", "quelle_geaendert");
        z.unklar += gueltig.length;
        return;
      }
      if (routineEntwurf) {
        // Nacharbeit 9 (Ben, EQF-07-K07): die gelesenen Quellen müssen JETZT noch in der gelesenen
        // Fassung bestehen — sonst wird neu gelesen und neu entschieden (nächste Runde).
        if (!(await this.routineQuellenAktuell(e, routineEntwurf.quellen))) {
          letzterGrund = "quelle_geaendert";
          offen = gueltig;
          continue;
        }
        const r = await this.routineSchreiben(e, routineEntwurf, kopf.lauf);
        if (r.art === "veraltet") {
          // Beim tatsächlichen Speichern galt die Bedingung nicht mehr (Pause, Ende, Löschung,
          // Rechteentzug, Quellenänderung): nichts entstanden — neu lesen, neu entscheiden.
          letzterGrund = "quelle_geaendert";
          offen = gueltig;
          continue;
        }
        if (r.art === "fehler") {
          // Ob er doch ankam, klärt die Wiederaufnahme per Readback über den Vorgangsschlüssel.
          await this.schliesseAlle(
            gueltig,
            "fehlgeschlagen",
            "zustellung_gescheitert",
            mitRoutine(),
          );
          z.fehlgeschlagen += 1;
          // Der Bericht kann trotzdem angekommen sein — gemeldet wird erst, wenn auch der letzte
          // automatische Versuch scheitert (sonst klärt der Readback, ohne falschen Alarm).
          await this.meldeHandlung(
            e,
            gueltig.filter((x) => x.lauf.versuch >= KLARA_ERINNERUNG_MAX_VERSUCHE),
            "fehlgeschlagen",
            "zustellung_gescheitert",
          );
          return;
        }
        routineStand = r.ergebnis;
        if (r.ergebnis.wissenspflege) letztePflegeNotiz = r.ergebnis;
      }
      const teilweise =
        pruefung?.status === "nicht_verfuegbar" ||
        zusammenfassung?.status === "nicht_verfuegbar" ||
        routineStand?.status === "teilweise";
      const laufStatus: KlaraErinnerungLaufStatus =
        art === "verpasst"
          ? "verpasst_gemeldet"
          : art === "zusammenfassung"
            ? "zusammengefasst"
            : art === "uebersprungen"
              ? "uebersprungen"
              : teilweise
                ? "teilweise"
                : "zugestellt";
      const zugestelltAm = new Date(this.jetzt()).toISOString();
      const quellschutz = await this.deps.quellschutz?.(e, empfaenger);
      if (quellschutz === null) {
        await this.schliesseAlle(gueltig, "gestoppt", "quelle_unlesbar", mitRoutine());
        z.gestoppt += gueltig.length;
        return;
      }
      const meldung: KlaraErinnerungMeldung = {
        id: routineStand?.wissenspflege?.aenderung
          ? `ke-${pflegeVorgang(e.id, routineStand.routineFassung, kopf.lauf.vorkommenId, routineStand.wissenspflege)}`
          : kopf.lauf.meldungId,
        kontoId: empfaenger,
        erinnerungId: e.id,
        art,
        titel: e.titel,
        zugestelltAm,
        vorkommen: gueltig.map((x) => x.lauf.geplantFuer),
        nachgeholt,
        pruefung,
        zusammenfassung,
        ...(routineStand ? { routine: routineStand } : {}),
        laufStatus,
      };
      let ergebnisSchreiben: MeldungSchreibergebnis;
      try {
        const bedingung: MeldungBedingung = {
          erinnerungId: e.id,
          fassung: e.fassung,
          empfaenger: { kontoId: empfaenger, jetzt: this.jetzt() },
          quelle: quelleFuerBedingung(e),
          laeufe: this.laufBedingungen(gueltig.map((x) => x.lauf)),
          ...(quellschutz ? { quellschutz } : {}),
          ...(zusammenfassung?.quelleStand ? { quellenStand: [zusammenfassung.quelleStand] } : {}),
        };
        ergebnisSchreiben = routineStand?.wissenspflege
          ? await this.pflegeMeldung(meldung, bedingung, e, routineStand, pflegeQuellenOriginal)
          : await this.deps.ablage.meldungen.schreibe(meldung, bedingung);
      } catch {
        // Ob die Meldung trotzdem angekommen ist, klärt der nächste Versuch per Readback.
        await this.schliesseAlle(gueltig, "fehlgeschlagen", "zustellung_gescheitert", mitRoutine());
        z.fehlgeschlagen += 1;
        return;
      }
      if (ergebnisSchreiben === "veraltet") {
        // Zwischen Lesen und Schreiben wurde die Erinnerung geändert: neu lesen, neu entscheiden.
        offen = gueltig;
        if (routineStand?.wissenspflege) {
          routineStand = null;
          pflegeQuellenOriginal = undefined;
          letzterGrund = "quelle_geaendert";
        }
        continue;
      }
      const neuGeschrieben = ergebnisSchreiben === "geschrieben";
      const geplant = Date.parse(kopf.lauf.geplantFuer);
      for (const x of gueltig) {
        const ergebnis: KlaraErinnerungLauf["ergebnis"] = {
          zugestelltAm,
          nachgeholt,
          verspaetetMinuten: Math.max(0, Math.round((Date.parse(zugestelltAm) - geplant) / 60_000)),
          ...(pruefung ? { pruefung } : {}),
          ...(zusammenfassung ? { zusammenfassung } : {}),
          ...(x.hinweis ? { hinweis: x.hinweis } : {}),
          ...(empfaenger !== e.kontoId ? { empfaenger } : {}),
          ...(neuGeschrieben ? {} : { dedupliziert: true }),
          ...mitRoutine(),
        };
        await this.deps.ablage.laeufe.schliesse(
          x.lauf.vorkommenId,
          this.besitzer,
          laufStatus,
          ergebnis,
          this.jetzt(),
        );
      }
      this.zaehle(z, laufStatus, neuGeschrieben, nachgeholt, gueltig.length);
      return;
    }
    if (offen.length > 0) {
      // Dreimal kam eine Änderung dazwischen: NICHTS geschrieben. Die Wiederaufnahme entscheidet neu.
      await this.schliesseAlle(offen, "fehlgeschlagen", letzterGrund, mitRoutine());
      z.fehlgeschlagen += 1;
      if (letzteErinnerung && !routineStand) {
        await this.meldeHandlung(letzteErinnerung, offen, "fehlgeschlagen", letzterGrund);
      }
    }
  }

  private zaehle(
    z: Zaehler,
    laufStatus: KlaraErinnerungLaufStatus,
    neuGeschrieben: boolean,
    nachgeholt: boolean,
    n: number,
  ): void {
    if (!neuGeschrieben) {
      z.dedupliziert += n;
    } else if (laufStatus === "teilweise") {
      z.teilweise += 1;
    } else if (laufStatus === "verpasst_gemeldet") {
      z.verpasstGemeldet += 1;
    } else if (laufStatus === "zusammengefasst") {
      z.zusammengefasst += n;
    } else if (laufStatus === "uebersprungen") {
      z.uebersprungen += n;
    } else if (nachgeholt) {
      z.nachgeholt += 1;
    } else {
      z.zugestellt += 1;
    }
  }

  /** Mehrere verpasste Vorkommen: EINE Sammel- bzw. Übersprungen-Meldung, jeder Lauf mit Beleg. */
  private async gesammelt(
    e: KlaraErinnerung,
    verpasst: readonly FaelligesVorkommen[],
    art: "sammel" | "uebersprungen",
    z: Zaehler,
  ): Promise<void> {
    const erstes = verpasst[0];
    if (!erstes) {
      return;
    }
    const meldungId = `ke-${art}-${erstes.id}`;
    const uebernommen: { lauf: KlaraErinnerungLauf; v: FaelligesVorkommen }[] = [];
    for (const v of verpasst) {
      const lauf = await this.uebernahme(e, v, art, meldungId);
      if (!lauf) {
        z.belegt += 1;
        continue;
      }
      if (await this.readback(lauf, z)) {
        continue;
      }
      uebernommen.push({ lauf, v });
    }
    if (uebernommen.length === 0) {
      return;
    }
    // Auch die Sammelmeldung prüft JEDEN erfassten Termin unmittelbar vor dem Schreiben.
    await this.wirke(
      e.id,
      uebernommen.map((x) => ({ lauf: x.lauf, hinweis: null })),
      art === "sammel" ? "zusammenfassung" : "uebersprungen",
      true,
      z,
    );
  }

  /** Ein hängender oder gescheiterter Lauf: übernehmen, zurücklesen, ggf. wirken. */
  private async nimmWiederAuf(alt: KlaraErinnerungLauf, z: Zaehler): Promise<void> {
    const eintrag = await this.deps.ablage.erinnerungen.holeSystem(alt.erinnerungId);
    if (!eintrag) {
      return;
    }
    const e = eintrag.erinnerung;
    const v = findeVorkommen(e, alt.vorkommenId.split("@").pop() ?? "")?.vorkommen;
    const ms = Date.parse(alt.geplantFuer);
    const vorkommen: FaelligesVorkommen =
      v && v.ms !== null
        ? { ...v, ms: v.ms }
        : {
            id: alt.vorkommenId,
            schluessel: alt.vorkommenId.split("@")[1] ?? "",
            ms,
            lokal: lokalVon(ms, e.zeitzone),
            hinweis: null,
            ausnahme: null,
          };
    const lauf = await this.uebernahme(e, vorkommen, alt.art, alt.meldungId);
    if (!lauf) {
      z.belegt += 1;
      return;
    }
    // EQF-07-K06 (Nacharbeit 9): ein Teilbericht mit nachholbarem Rest wird FORTGESETZT — derselbe
    // Bericht, fertige Abschnitte unverändert. Kein Readback-Abschluss, kein zweiter Bericht.
    // Auch eine Fortsetzung, deren Prozess abbrach (Berechtigung abgelaufen), läuft hier weiter.
    if (
      (alt.status === "teilweise" || (alt.status === "laeuft" && alt.versuch > 1)) &&
      lauf.ergebnis.routine?.fortsetzbar === true
    ) {
      await this.routineFortsetzen(e, lauf, z);
      return;
    }
    if (await this.readback(lauf, z)) {
      return;
    }
    // Keine Meldung vorhanden: Status, Termin, Rechte und Quelle gelten wie beim ersten Mal — HEUTE,
    // geprüft in `wirke` unmittelbar vor dem bedingten Schreiben.
    const art: KlaraErinnerungMeldungArt =
      alt.art === "verpasst"
        ? "verpasst"
        : alt.art === "sammel"
          ? "zusammenfassung"
          : alt.art === "uebersprungen"
            ? "uebersprungen"
            : "erinnerung";
    await this.wirke(
      e.id,
      [{ lauf, hinweis: vorkommen.hinweis }],
      art,
      alt.art !== "erinnerung",
      z,
    );
  }
}
