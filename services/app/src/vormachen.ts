import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  AUSFUEHRUNGSMODI,
  type Aenderung,
  type Ausfuehrungsmodus,
  type FunktionsSchritt,
  type KorrekturQuelle,
  type Zeitplan,
  siehtGeheimAus,
} from "./assistenz-lernen";
import { KORREKTUR_BEDEUTUNGEN, deuteKorrektur } from "./assistenz-lernen-korrektur";
import {
  type Ableitung,
  type AbleitungsVorschau,
  ableitungsAenderung,
  aendereBestaetigteAbleitung,
  leiteAb,
} from "./assistenz-lernen-vorfuehrungen";
import type { LoeschmarkierungsAblage } from "./loeschmarkierung-typen";
import type { PersoenlicheFunktion as BeschaffungsFunktion } from "./persoenliche-funktionsvertrag";

// ================================================================================================
// produkt:20261011:peter-p06 — VORMACHEN, ZWECKGEBUNDENES MITSCHREIBEN UND PERSÖNLICHE ROUTINE (PoC).
// ================================================================================================
//
// „Gezieltes Vormachen und zweckgebundenes Mitschreiben in ausgewähltem Host, sichtbar und sofort
// pausierbar; daraus nachvollziehbare Vorschau einer bestätigbaren persönlichen Routine. Kein
// allgemeines Bildschirm-/Mitarbeitertracking." (PETER-20261011-P06, Fragen 35 und 36: „Anwendung,
// Vorgang und Zeitraum begrenzen. Nach bestätigter Ablaufübernahme nur die benötigte Beschreibung
// dauerhaft behalten." · „zunächst ‚Ergebnis zur Prüfung' verwenden".)
//
// EIN EIGENER DATENRAUM JE KONTO, wie Gedächtnis und Klara-Gespräch (`interaktionsgedaechtnis.ts`,
// `klara-gespraech.ts`): jede Operation nimmt die Kontokennung aus der Sitzung; fremd und unbekannt
// antworten gleich (404). Drei getrennte Dinge:
//
//   · ROHBEOBACHTUNGEN — was beim Vormachen mitgeschrieben wurde, mit Rohwert. Nur für den Host
//     und die Vorgänge, die die Person beim Start AUSDRÜCKLICH gewählt hat (P06-AC01); alles andere
//     wird nicht gespeichert, nur gezählt. Nur im Zustand „lernt" (P06-AC02). Sie leben höchstens
//     `ROHDATEN_FRIST_STUNDEN` und enden spätestens mit Bestätigung oder Abbruch (P06-AC06). Sie
//     liegen BEWUSST nur im Speicher des Dienstes — ein Neustart ist die Richtung des Löschens.
//   · LERNNOTIZ — die zweckgebundene Beschreibung der Schritte OHNE Rohwerte, samt Korrekturen der
//     Person. Sie gehört zur Lernsitzung, nie zur Routine (P06-AC03).
//   · ROUTINE — erst durch die ausdrückliche Bestätigung einer Vorschau mit genau diesem Stand. Sie
//     trägt nur die benötigte Beschreibung, keine Rohwerte, läuft im Modus „Ergebnis zur Prüfung"
//     (P06-AC04) und wird DAUERHAFT gehalten (Frage 35): im Postgres-Betrieb in
//     `persoenliche_routinen` (`PgRoutinenRepo`). Ein Schritt mit Außenwirkung braucht bei JEDER
//     Ausführung eine eigene Bestätigung, gebunden an Routine, Schritt und genau diese Ausführung
//     und nach einmaliger Verwendung verbraucht (P06-AC05).
//
// WOHER BEOBACHTUNGEN KOMMEN (P06-AC01): jeder wählbare Vorgang hat eine ECHTE Quelle.
//   · `server` — ein vorhandener Arbeitsweg, den die Person tatsächlich ausführt (Entwurf anlegen,
//     speichern, einreichen, fragen; im Word-Kanal: Auswahl/Dokument übernehmen, fragen,
//     formulieren lassen). Der Server schreibt ihn nach erfolgreicher Antwort selbst mit
//     (`vormachen-arbeitswege.ts`); vom Client gemeldet wird er NICHT angenommen.
//   · `client` — allein der Seitenwechsel in Klarwerk-Web (`VormachenAnzeige`).
//
// BEWUSST NICHT HIER: kein Scheduler, keine zweite Figur, keine Workflowverwaltung, keine
// Hintergrundbeobachtung. Der Server ruft keine KI. Eine Firmenübergabe ist eine getrennte Kopie
// über den vorhandenen Entwurfsweg (`vormachen-routes.ts`) und unterliegt dort der normalen Prüfung;
// die Privatlöschung hier erreicht sie deshalb nicht (P06-AC07).

/** Die Hosts mit vorhandenem Klarwerk-Kanal: der Word-Kanal und Klarwerk-Web selbst. */
export const VORMACHEN_HOSTS = ["word", "klarwerk_web"] as const;
export type VormachenHost = (typeof VORMACHEN_HOSTS)[number];

/**
 * SICHTBARKEIT ALS BEDINGUNG (P06-AC02, Ben zu Nacharbeit 4): mitgeschrieben wird in einem Host nur,
 * solange GENAU DER beobachtete Client (dieselbe Anmeldesitzung) den Lernzustand mit Pause sichtbar
 * anzeigt und das regelmäßig meldet (`meldeSichtbar`). Ohne frische Meldung wird nichts gespeichert,
 * nur als „nicht sichtbar" gezählt — ein geschlossener Tab, ein anderes Gerät oder ein Host ohne
 * Anzeige beobachtet also NIE unsichtbar weiter.
 *
 * Eine Lernsitzung lässt sich nur für Hosts starten, die den Lernzustand anzeigen können: Klarwerk-Web
 * (`VormachenAnzeige` in der Hülle) und das Klara-Panel in Word (Block KW-VORMACHEN,
 * `apps/web/public/word-addin/vormachen.js`, meldet sich mit `?anzeige=word`).
 */
export const VORMACHEN_HOSTS_MIT_ANZEIGE: readonly VormachenHost[] = ["klarwerk_web", "word"];
/** So lange gilt eine Sichtbarkeitsmeldung; die Anzeige meldet deutlich öfter. */
export const SICHTBAR_GUELTIG_MS = 60 * 1000;

/** Der Schlüssel des beobachteten Clients: aus dem Anmeldetoken abgeleitet, nie das Token selbst. */
export function clientSchluessel(token: string | undefined | null): string | null {
  return token ? createHash("sha256").update(token).digest("hex").slice(0, 32) : null;
}

export type VorgangQuelle = "server" | "client";

interface VorgangArt {
  readonly host: VormachenHost;
  /** Folgenreiche Außenaktion: wirkt über die eigene Arbeit hinaus (etwa zur Prüfung einreichen). */
  readonly aussenwirkung: boolean;
  readonly quelle: VorgangQuelle;
}

/** Die beobachtbaren Vorgänge je Host — jeder mit seiner echten Quelle. */
export const VORMACHEN_VORGAENGE = {
  word_frage: { host: "word", aussenwirkung: false, quelle: "server" },
  word_auswahl_uebernehmen: { host: "word", aussenwirkung: false, quelle: "server" },
  word_dokument_uebernehmen: { host: "word", aussenwirkung: false, quelle: "server" },
  word_formulierung: { host: "word", aussenwirkung: false, quelle: "server" },
  seite_oeffnen: { host: "klarwerk_web", aussenwirkung: false, quelle: "client" },
  frage_stellen: { host: "klarwerk_web", aussenwirkung: false, quelle: "server" },
  entwurf_anlegen: { host: "klarwerk_web", aussenwirkung: false, quelle: "server" },
  entwurf_speichern: { host: "klarwerk_web", aussenwirkung: false, quelle: "server" },
  zur_pruefung_einreichen: { host: "klarwerk_web", aussenwirkung: true, quelle: "server" },
  // EQF-06-K02: ein Wissensobjekt als Quelle lesen (`GET /api/kos/:id`) — Kennung und Fassung als
  // Rohdaten der Lernsitzung, nie sein Inhalt.
  quelle_lesen: { host: "klarwerk_web", aussenwirkung: false, quelle: "server" },
} as const satisfies Record<string, VorgangArt>;
export type VormachenVorgang = keyof typeof VORMACHEN_VORGAENGE;

const VORGANG_NAMEN: ReadonlySet<string> = new Set(Object.keys(VORMACHEN_VORGAENGE));

export function istVorgang(wert: unknown): wert is VormachenVorgang {
  return typeof wert === "string" && VORGANG_NAMEN.has(wert);
}

/**
 * Die Regel beim Abbruch. Rohbeobachtungen werden IMMER entfernt; die Regel entscheidet nur über
 * die Lernnotiz: `alles_verwerfen` (Voreinstellung) entfernt die ganze Sitzung, `lernnotiz_behalten`
 * behält die Notiz ohne Rohwerte bis zu ihrer Frist, damit die Person später daran anknüpft.
 */
export const VORMACHEN_ABBRUCH_REGELN = ["alles_verwerfen", "lernnotiz_behalten"] as const;
export type VormachenAbbruchRegel = (typeof VORMACHEN_ABBRUCH_REGELN)[number];
export const VORMACHEN_STANDARD_ABBRUCH_REGEL: VormachenAbbruchRegel = "alles_verwerfen";

/** Höchstalter der Rohbeobachtungen; danach bricht der Dienst die Sitzung nach ihrer Regel ab. */
export const ROHDATEN_FRIST_STUNDEN = 24;
/** Frist einer behaltenen Lernnotiz — dieselbe Standardfrist wie im Gedächtnis. */
export const LERNNOTIZ_FRIST_TAGE = 90;
/** Eine angeforderte Ausführung eines Außenschritts ist so lange bestätigbar — einmal. */
export const AUSSEN_BESTAETIGUNG_GUELTIG_MS = 5 * 60 * 1000;
export const VORMACHEN_MAX_BEOBACHTUNGEN = 200;
export const VORMACHEN_MAX_TEXT = 300;
export const VORMACHEN_MAX_ROHWERT = 2_000;
export const VORMACHEN_MAX_ROUTINEN = 50;

const STUNDE_MS = 60 * 60 * 1000;
const TAG_MS = 24 * STUNDE_MS;

export type LernZustand = "lernt" | "pausiert" | "abgebrochen";

export interface Rohbeobachtung {
  readonly nr: number;
  readonly vorgang: VormachenVorgang;
  readonly beschreibung: string;
  /** Der mitgeschriebene Rohwert (etwa ein Titel). Verlässt die Lernsitzung nie. */
  readonly rohwert: string | null;
  /**
   * BPA-06: die gesetzten Felder eines angelegten Entwurfs mit Wert (Titel, Kernaussage,
   * Ordnungsangaben, Prüfer) — Rohdaten wie `rohwert`, nur für die Ableitung aus mehreren
   * Vorführungen. Verlassen die Lernsitzung nie und enden mit Bestätigung oder Abbruch.
   */
  readonly felder?: Readonly<Record<string, string>>;
  readonly am: string;
}

export interface LernKorrektur {
  readonly beschreibung?: string;
  readonly entfernt?: boolean;
}

export interface NichtAufgenommen {
  readonly host: number;
  readonly vorgang: number;
  readonly pausiert: number;
  /** Arbeitsweg des gewählten Hosts, aber ohne sichtbaren Lernzustand im beobachteten Client. */
  readonly unsichtbar: number;
}

export interface Lernsitzung {
  readonly id: string;
  readonly kontoId: string;
  readonly host: VormachenHost;
  readonly vorgaenge: readonly VormachenVorgang[];
  readonly zweck: string;
  readonly abbruchRegel: VormachenAbbruchRegel;
  readonly zustand: LernZustand;
  readonly beobachtungen: readonly Rohbeobachtung[];
  /** Je Beobachtungsnummer die Korrektur der Person — Teil der Lernnotiz. */
  readonly korrekturen: Readonly<Record<number, LernKorrektur>>;
  readonly nichtAufgenommen: NichtAufgenommen;
  /**
   * Rohdaten des Zielbezugs: welche Entwurfskennung in welchem Schritt entstand — damit ein späterer
   * Schritt „Entwurf aus Schritt n" sagen kann. Wird mit den Rohwerten entfernt.
   */
  readonly ziele: Readonly<Record<string, number>>;
  /** BPA-06: die Änderungen der Person an der Ableitung aus mehreren Vorführungen, in Folge. */
  readonly ableitungsAenderungen?: readonly Aenderung[];
  readonly angelegtAm: string;
  readonly geaendertAm: string;
  /** Bis wann Rohbeobachtungen höchstens bestehen (nach Abbruch: bis wann die Notiz besteht). */
  readonly verfallAm: string;
}

export interface LernnotizSchritt {
  readonly nr: number;
  readonly vorgang: VormachenVorgang;
  readonly beschreibung: string;
  readonly korrigiert: boolean;
  readonly entfernt: boolean;
}

/** Die zweckgebundene Lernnotiz — ausdrücklich OHNE Rohwerte. */
export interface Lernnotiz {
  readonly zweck: string;
  readonly host: VormachenHost;
  readonly schritte: readonly LernnotizSchritt[];
}

export interface VorschauSchritt {
  readonly nr: number;
  readonly vorgang: VormachenVorgang;
  readonly beschreibung: string;
  readonly aussenwirkung: boolean;
  /** Die Beobachtung, aus der der Schritt stammt — so bleibt die Vorschau nachvollziehbar. */
  readonly beleg: number;
  readonly korrigiert: boolean;
}

export interface Vorschau {
  readonly sitzungId: string;
  readonly host: VormachenHost;
  readonly zweck: string;
  readonly modus: "ergebnis_zur_pruefung";
  readonly schritte: readonly VorschauSchritt[];
  readonly beobachtet: number;
  readonly entfernt: number;
  readonly nichtAufgenommen: NichtAufgenommen;
  /**
   * BPA-06: aus zwei oder mehr Vorführungen abgeleitet — Eingaben, Schritte, Entscheidungspunkte
   * und ihre Erklärung. Fehlt bei nur einer Vorführung. Teil des Stands.
   */
  readonly ableitung?: AbleitungsVorschau;
  /** Prüfsumme genau dieser Vorschau; die Bestätigung muss sie nennen. */
  readonly stand: string;
}

export interface RoutineSchritt {
  readonly id: string;
  readonly nr: number;
  readonly vorgang: VormachenVorgang;
  readonly beschreibung: string;
  readonly aussenwirkung: boolean;
}

export interface Routine {
  readonly beschaffung?: BeschaffungsFunktion;
  readonly id: string;
  readonly kontoId: string;
  readonly titel: string;
  readonly zweck: string;
  readonly host: VormachenHost;
  readonly modus: "ergebnis_zur_pruefung";
  readonly fassung: number;
  readonly schritte: readonly RoutineSchritt[];
  readonly herkunft: {
    readonly sitzungId: string;
    readonly stand: string;
    readonly beobachtet: number;
    readonly korrigiert: number;
  };
  readonly bestaetigtAm: string;
  readonly firmenuebergabe: { readonly entwurfId: string; readonly am: string } | null;
  /**
   * produkt:20261011:assistenz-lernen-hostfortsetzung (BPA-06), additiv im JSON der Routine:
   * `pausiert` lässt keinen Lauf zu, weder von Hand noch aus einer Zeitsteuerung. Fehlt = aktiv.
   */
  readonly zustand?: RoutinenZustand;
  /** BPA-06: die Zeitplanangabe für eine Zeitsteuerung; geprüft mit `pruefeZeitplan`. */
  readonly zeitplan?: Zeitplan | null;
  /**
   * BPA-06 AC05: womit die Zeitsteuerung fällige Läufe anlegt — seit wann der Zeitplan gilt (frühere
   * Termine sind nicht versäumt), das eigene Gespräch und die Eingaben der Person. Fällt mit dem
   * Zeitplan weg.
   */
  readonly zeitplanLauf?: RoutinenZeitplanLauf | null;
  /** BPA-06: welche Laufkennung zu welchem Auftrag wurde — dauerhaft, je Routine. */
  readonly laeufe?: readonly RoutinenLauf[];
  /**
   * BPA-06: die bestätigte Ableitung aus mehreren Vorführungen — Eingaben und Schritte, keine
   * Inhalts- oder Empfängerwerte (`assistenz-lernen-vorfuehrungen.ts`).
   */
  readonly ableitung?: Ableitung;
  /**
   * BPA-06 (Nacharbeit 41): nur bei Word-Routinen — das Programm (BPA-04-Kennung `word-mac` bzw.
   * `word-web`) und die Hostfassung, an die die Person die Routine ausdrücklich gebunden hat. Ein
   * Lauf in einem anderen Programm wird abgelehnt, eine andere Hostfassung hält vor dem ersten
   * Schritt an (AC07). Fehlt sie, läuft eine Word-Routine nicht.
   */
  readonly hostbindung?: RoutinenHostbindung | null;
  /**
   * EQF-06-K10: der Fassungsverlauf nach der Bestätigung — je Korrektur Fassung, Zeitpunkt, Art der
   * Änderung und ihre Quelle (Worte der Person). Fassung 1 ist die Bestätigung selbst.
   */
  readonly versionen?: readonly RoutinenFassung[];
  /**
   * EQF-06-K06: die Übergabeart — selbstständig, Ergebnis zur Prüfung oder gemeinsam schrittweise
   * (`assistenz-lernen.ts`). Fehlt sie, läuft die Routine selbstständig wie bisher.
   */
  readonly ausfuehrung?: Ausfuehrungsmodus;
}

export interface RoutinenFassung {
  readonly fassung: number;
  readonly am: string;
  readonly art: Aenderung["art"];
  readonly quelle: KorrekturQuelle | null;
}

export interface RoutinenHostbindung {
  readonly programm: "word-mac" | "word-web";
  readonly hostVersion: string;
  /**
   * Nacharbeit 43: das Dokument (documentContextId), in dem gebunden wurde. Ein fälliger Termin
   * wird nur in GENAU diesem Dokument ohne Klick ausgeführt.
   */
  readonly objekt?: string;
  /**
   * Nacharbeit 43: die Person hat beim Binden ausdrücklich freigegeben, dass fällige Termine
   * dieser Routine in diesem Word ohne erneuten Klick laufen. Fehlt es, wartet ein Termin auf den
   * Start von Hand.
   */
  readonly zeitplanImHost?: boolean;
  readonly am: string;
}

export type RoutinenZustand = "aktiv" | "pausiert";

export interface RoutinenZeitplanLauf {
  readonly seit: string;
  readonly gespraech: string;
  readonly eingaben: Readonly<Record<string, string>>;
  /** Terminkennungen, deren Lauf abgelehnt wurde — sie werden nicht in jedem Takt neu versucht. */
  readonly abgelehnt?: readonly string[];
  /**
   * EQF-06-K05/K09 (Nacharbeit 52), nur bei „bei Ereignis“: der DAUERHAFTE Fortschritt. Jedes
   * passende eigene Ereignis mit Sequenz ≤ `ereignisseBis` ist erledigt (gelaufen, abgelehnt oder
   * in einer Pause geschehen). Ab `ereignisseAb` zählen Ereignisse — anders als `seit` rückt dieser
   * Beginn beim Fortsetzen nicht vor, damit ein Rückstand von vor der Pause nicht verloren geht.
   */
  readonly ereignisseBis?: number;
  readonly ereignisseAb?: string;
  /** Pausen dieser Routine, deren Ereignisse ausdrücklich nicht laufen (wie Termine einer Pause). */
  readonly pausen?: readonly { readonly von: string; readonly bis: string }[];
  /** Seit wann die Routine gerade pausiert ist — wird beim Fortsetzen zu einem Eintrag in `pausen`. */
  readonly pausiertSeit?: string;
}

/** So viele abgelehnte Termine merkt sich eine Routine; ältere kommen ohnehin nicht wieder. */
const ZEITPLAN_MAX_ABGELEHNT = 50;

/**
 * BPA-06: ein Lauf dieser Routine. Dieselbe Kennung mit demselben Abdruck (Fassung, Gespräch,
 * Eingaben) ist derselbe Lauf und bekommt denselben Auftrag; ein anderer Abdruck wird abgewiesen.
 * `auftragId: null` heißt reserviert, der Auftrag ist noch nicht bestätigt angelegt.
 */
export interface RoutinenLauf {
  readonly kennung: string;
  readonly fassung: number;
  readonly abdruck: string;
  readonly gespraech: string;
  readonly auftragId: string | null;
  readonly am: string;
  /**
   * BPA-06 AC05/G12 (Nacharbeit 35): die Ausführung dieses Laufs ist bestätigt abgeschlossen —
   * Ergebnis nachgelesen und geprüft oder endgültig gescheitert. Ein angelegter Auftrag allein ist
   * KEIN Abschluss; die Zeitsteuerung nimmt solche Läufe wieder auf.
   */
  readonly abgeschlossenAm?: string;
  /** Zahl der vorübergehend gescheiterten Ausführungsversuche (je Versuch ein eigener Schritt). */
  readonly versuche?: number;
  readonly reserviertVon?: string;
  readonly reserviertBis?: number;
}

/** Eine angeforderte, noch nicht bestätigte Ausführung genau eines Außenschritts. */
export interface Ausfuehrung {
  readonly id: string;
  readonly routineId: string;
  readonly schrittId: string;
  readonly fassung: number;
  readonly gueltigBis: string;
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGEN — Lernsitzungen flüchtig, Routinen dauerhaft.
// ------------------------------------------------------------------------------------------------

/** Lernsitzungen mit Rohdaten und Lernnotiz — nur im Speicher des Dienstes. */
export class LernsitzungAblage {
  private readonly s = new Map<string, Lernsitzung>();

  sitzungen(kontoId: string): Lernsitzung[] {
    const treffer = [...this.s.values()].filter((x) => x.kontoId === kontoId);
    return treffer.sort((a, b) => b.angelegtAm.localeCompare(a.angelegtAm));
  }

  sitzung(kontoId: string, id: string): Lernsitzung | null {
    const x = this.s.get(id);
    return x && x.kontoId === kontoId ? x : null;
  }

  lege(x: Lernsitzung): void {
    this.s.set(x.id, x);
  }

  entferne(kontoId: string, id: string): boolean {
    const x = this.s.get(id);
    return x !== undefined && x.kontoId === kontoId && this.s.delete(id);
  }

  entferneAlle(kontoId: string): number {
    let n = 0;
    for (const [id, x] of this.s) {
      if (x.kontoId === kontoId) {
        this.s.delete(id);
        n += 1;
      }
    }
    return n;
  }

  /** Gibt es irgendwo eine offene Sitzung? Billig — der Arbeitswege-Hook fragt das zuerst. */
  irgendeineOffen(): boolean {
    for (const x of this.s.values()) {
      if (x.zustand !== "abgebrochen") {
        return true;
      }
    }
    return false;
  }
}

export interface RoutinenRepo {
  vergleicheUndLege(r: Routine, erwartet: Routine | null): Promise<boolean>;
  routinen(kontoId: string): Promise<Routine[]>;
  routine(kontoId: string, id: string): Promise<Routine | null>;
  /** Legt an oder schreibt fort — nur innerhalb desselben Kontos. */
  lege(r: Routine): Promise<void>;
  /** Entfernt alle Routinen DIESES Kontos; liefert die Zahl. */
  entferneAlle(kontoId: string): Promise<number>;
  /**
   * RF-17: entfernt die Routinen dieses Kontos, die bis `bis` (ISO) bestätigt waren — das Nachführen
   * einer Löschmarkierung nach einem Restore (`loeschmarkierungen.ts`). Später bestätigte bleiben.
   */
  entferneBestaetigtBis(kontoId: string, bis: string): Promise<number>;
  /** BPA-06 AC05: alle Routinen ALLER Konten mit gesetztem Zeitplan — für die Zeitsteuerung. */
  mitZeitplan(): Promise<Routine[]>;
}

export class InMemoryRoutinenRepo implements RoutinenRepo {
  private readonly r = new Map<string, Routine>();

  routinen(kontoId: string): Promise<Routine[]> {
    const treffer = [...this.r.values()].filter((x) => x.kontoId === kontoId);
    return Promise.resolve(treffer.sort((a, b) => b.bestaetigtAm.localeCompare(a.bestaetigtAm)));
  }

  routine(kontoId: string, id: string): Promise<Routine | null> {
    const x = this.r.get(id);
    return Promise.resolve(x && x.kontoId === kontoId ? x : null);
  }

  vergleicheUndLege(x: Routine, erwartet: Routine | null): Promise<boolean> {
    const alt = this.r.get(x.id) ?? null;
    if (JSON.stringify(alt) !== JSON.stringify(erwartet) || (alt && alt.kontoId !== x.kontoId))
      return Promise.resolve(false);
    this.r.set(x.id, structuredClone(x));
    return Promise.resolve(true);
  }
  lege(x: Routine): Promise<void> {
    const vorher = this.r.get(x.id);
    if (!vorher || vorher.kontoId === x.kontoId) {
      this.r.set(x.id, x);
    }
    return Promise.resolve();
  }

  entferneAlle(kontoId: string): Promise<number> {
    let n = 0;
    for (const [id, x] of this.r) {
      if (x.kontoId === kontoId) {
        this.r.delete(id);
        n += 1;
      }
    }
    return Promise.resolve(n);
  }

  entferneBestaetigtBis(kontoId: string, bis: string): Promise<number> {
    const grenze = Date.parse(bis);
    let n = 0;
    for (const [id, x] of this.r) {
      if (x.kontoId === kontoId && Date.parse(x.bestaetigtAm) <= grenze) {
        this.r.delete(id);
        n += 1;
      }
    }
    return Promise.resolve(n);
  }

  mitZeitplan(): Promise<Routine[]> {
    return Promise.resolve(
      [...this.r.values()].filter(
        (x) => (x.zeitplan && x.zeitplanLauf) || x.beschaffung?.zeitauftrag,
      ),
    );
  }
}

/**
 * Eine Zeile je bestätigter Routine. REIN ADDITIV UND WIEDERHOLBAR: ein `CREATE TABLE IF NOT EXISTS`
 * und ein `CREATE INDEX IF NOT EXISTS`, kein DROP, kein Fremdschlüssel, keine Extension, kein Seed.
 * Die Routine trägt nur die Beschreibung (keine Rohwerte); sie steht als JSON in `data`.
 */
export const PERSOENLICHE_ROUTINEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS persoenliche_routinen (
  id text PRIMARY KEY,
  konto_id text NOT NULL,
  bestaetigt_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_persoenliche_routinen_konto
  ON persoenliche_routinen (konto_id, bestaetigt_am DESC);
`;

export class PgRoutinenRepo implements RoutinenRepo {
  constructor(private readonly pool: Pool) {}

  async routinen(kontoId: string): Promise<Routine[]> {
    const res = await this.pool.query<{ data: Routine }>(
      `SELECT data FROM persoenliche_routinen
        WHERE konto_id = $1
        ORDER BY bestaetigt_am DESC, id`,
      [kontoId],
    );
    return res.rows.map((z) => z.data);
  }

  async routine(kontoId: string, id: string): Promise<Routine | null> {
    const res = await this.pool.query<{ data: Routine }>(
      "SELECT data FROM persoenliche_routinen WHERE id = $1 AND konto_id = $2",
      [id, kontoId],
    );
    return res.rows[0]?.data ?? null;
  }

  async vergleicheUndLege(r: Routine, erwartet: Routine | null): Promise<boolean> {
    const res =
      erwartet === null
        ? await this.pool.query(
            "INSERT INTO persoenliche_routinen (id, konto_id, bestaetigt_am, data) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING",
            [r.id, r.kontoId, r.bestaetigtAm, JSON.stringify(r)],
          )
        : await this.pool.query(
            "UPDATE persoenliche_routinen SET data = $3 WHERE id = $1 AND konto_id = $2 AND data = $4::jsonb",
            [r.id, r.kontoId, JSON.stringify(r), JSON.stringify(erwartet)],
          );
    return (res.rowCount ?? 0) === 1;
  }
  async lege(r: Routine): Promise<void> {
    await this.pool.query(
      `INSERT INTO persoenliche_routinen (id, konto_id, bestaetigt_am, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
        WHERE persoenliche_routinen.konto_id = EXCLUDED.konto_id`,
      [r.id, r.kontoId, r.bestaetigtAm, JSON.stringify(r)],
    );
  }

  async entferneAlle(kontoId: string): Promise<number> {
    const sql = "DELETE FROM persoenliche_routinen WHERE konto_id = $1";
    const res = await this.pool.query(sql, [kontoId]);
    return res.rowCount ?? 0;
  }

  async entferneBestaetigtBis(kontoId: string, bis: string): Promise<number> {
    const sql = "DELETE FROM persoenliche_routinen WHERE konto_id = $1 AND bestaetigt_am <= $2";
    const res = await this.pool.query(sql, [kontoId, bis]);
    return res.rowCount ?? 0;
  }

  async mitZeitplan(): Promise<Routine[]> {
    const res = await this.pool.query<{ data: Routine }>(
      `SELECT data FROM persoenliche_routinen
        WHERE (jsonb_typeof(data->'zeitplan') = 'object'
          AND jsonb_typeof(data->'zeitplanLauf') = 'object')
          OR jsonb_typeof(data->'beschaffung'->'zeitauftrag') = 'object'
        ORDER BY bestaetigt_am, id`,
    );
    return res.rows.map((z) => z.data);
  }
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

export type VormachenFehlerGrund =
  | "eingabe"
  | "nicht_gefunden"
  | "host_nicht_gewaehlt"
  | "host_ohne_anzeige"
  | "nicht_sichtbar"
  | "vorgang_nicht_gewaehlt"
  | "nur_arbeitsweg"
  | "pausiert"
  | "zustand"
  | "laeuft_schon"
  | "stand_veraltet"
  | "leer"
  | "voll"
  | "bestaetigung_fehlt"
  | "bestaetigung_passt_nicht"
  | "lauf_widerspricht"
  // BPA-06 AC01: ein natürlicher Lernauftrag braucht eine Klärung (Details: `klaerung`).
  | "klaerung"
  // BPA-06 Nacharbeit 41: nur eine Word-Routine lässt sich an ein Word binden.
  | "anderer_host"
  // EQF-06-K10: eine Routine ohne abgeleitete Schritte wird durch erneutes Vormachen geändert.
  | "nicht_korrigierbar"
  // EQF-06-K06: „gemeinsam schrittweise“ braucht die Person — kein Zeitplan, kein Hostlauf.
  | "schrittweise";

/** EQF-06-K06: der Text, wenn „gemeinsam schrittweise“ und ein Zeitplan zusammenträfen. */
export const SCHRITTWEISE_OHNE_ZEITPLAN =
  "Gemeinsam schrittweise braucht dich bei jedem Schritt — dafür gibt es keinen Zeitplan. Wähle selbstständig oder Ergebnis zur Prüfung, oder entferne den Zeitplan.";

export class VormachenFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 422,
    readonly grund: VormachenFehlerGrund,
    message: string,
    /** Zusatzangaben für die Antwort (etwa die angeforderte Ausführung). */
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "VormachenFehler";
  }
}

export interface VormachenDienstDeps {
  /** Ohne Angabe im Speicher — im Postgres-Betrieb `PgRoutinenRepo`. */
  readonly routinen?: RoutinenRepo;
  /**
   * RF-17: die Ablage der Löschmarkierungen außerhalb der Datenbank (`loeschmarkierungen.ts`). Ohne
   * Angabe vermerkt die Privatlöschung nichts — ein Restore brächte gelöschte Routinen dann zurück.
   */
  readonly loeschmarkierungen?: LoeschmarkierungsAblage | undefined;
  readonly jetzt?: () => number;
  readonly neueId?: () => string;
}

export interface StartEingabe {
  host?: unknown;
  vorgaenge?: unknown;
  zweck?: unknown;
  abbruchRegel?: unknown;
}

export interface BeobachtungEingabe {
  host?: unknown;
  vorgang?: unknown;
  beschreibung?: unknown;
  rohwert?: unknown;
}

/** Was ein Arbeitsweg nach erfolgreicher Antwort meldet (`vormachen-arbeitswege.ts`). */
export interface ArbeitswegBeobachtung {
  /** `null`: der Host der Anfrage war nicht sicher bestimmbar — dann nie mitgeschrieben. */
  readonly host: VormachenHost | null;
  /** `null`: dieser Weg ist in diesem Host kein wählbarer Vorgang. */
  readonly vorgang: VormachenVorgang | null;
  /** Was getan wurde, ohne Zielbezug („Entwurf speichern"). */
  readonly beschreibung: string;
  /**
   * Die tatsächlich gesetzten Angaben, zweckgebunden: Ordnungsangaben mit Wert (Art, Kategorie,
   * Vertraulichkeit, Fachgebiet), Inhaltsfelder nur beim Namen (Titel, Aussage, Inhalt).
   */
  readonly angaben?: readonly string[];
  /** Der Entwurf, auf den sich der Schritt bezieht; `neu`: er entstand in diesem Schritt. */
  readonly ziel?: { readonly entwurfId: string; readonly neu: boolean } | null;
  readonly rohwert: string | null;
  /** BPA-06: gesetzte Entwurfsfelder mit Wert — Rohdaten, nur in der Lernsitzung. */
  readonly felder?: Readonly<Record<string, string>>;
}

export interface KorrekturEingabe {
  nr?: unknown;
  beschreibung?: unknown;
  entfernen?: unknown;
  /** BPA-06: eine Änderung an der Ableitung (`ableitungsAenderung`) statt an einer Beobachtung. */
  ableitung?: unknown;
}

export interface AussenBestaetigung {
  /** Die Kennung der zuvor angeforderten Ausführung. */
  ausfuehrung?: unknown;
}

export interface AbbruchErgebnis {
  readonly regel: VormachenAbbruchRegel;
  /** Zahl der entfernten Rohwerte. */
  readonly rohdatenEntfernt: number;
  readonly notizBehalten: boolean;
}

export type Freigabe =
  | { readonly art: "ergebnis_zur_pruefung"; readonly schritt: RoutineSchritt }
  | {
      readonly art: "aussenaktion_bestaetigt";
      readonly schritt: RoutineSchritt;
      readonly ausfuehrung: string;
    };

/** BPA-06: höchstens so viele Rohfelder je Beobachtung, je höchstens `VORMACHEN_MAX_ROHWERT`. */
const ROHFELDER_MAX = 12;

/** Die Rohfelder einer Arbeitswegbeobachtung, begrenzt — `null`, wenn keine gesetzt sind. */
function rohfelder(roh: Readonly<Record<string, string>> | null): Record<string, string> | null {
  if (roh === null) {
    return null;
  }
  const felder: Record<string, string> = {};
  for (const [k, v] of Object.entries(roh).slice(0, ROHFELDER_MAX)) {
    const t = typeof v === "string" ? v.trim().slice(0, VORMACHEN_MAX_ROHWERT) : "";
    if (
      t !== "" &&
      !/passw|kennwort|token|secret|pin|tan|otp|api.?key/i.test(k) &&
      !siehtGeheimAus(t)
    ) {
      felder[k] = t;
    }
  }
  return Object.keys(felder).length > 0 ? felder : null;
}

function text(wert: unknown, max: number): string | null {
  if (typeof wert !== "string") {
    return null;
  }
  const t = wert.trim();
  return t.length > 0 && t.length <= max && !siehtGeheimAus(t) ? t : null;
}

interface OffeneAusfuehrung extends Ausfuehrung {
  readonly kontoId: string;
  readonly bisMs: number;
}

export class VormachenDienst {
  private readonly ablage = new LernsitzungAblage();
  private readonly routinenRepo: RoutinenRepo;
  private readonly loeschmarkierungen: LoeschmarkierungsAblage | undefined;
  private readonly ausfuehrungen = new Map<string, OffeneAusfuehrung>();
  /** Je „Konto|Host|Client" bis wann der Lernzustand dort zuletzt sichtbar gemeldet wurde. */
  private readonly sichtbarBis = new Map<string, number>();
  private readonly jetzt: () => number;
  private readonly neueId: () => string;

  constructor(deps: VormachenDienstDeps = {}) {
    this.routinenRepo = deps.routinen ?? new InMemoryRoutinenRepo();
    this.loeschmarkierungen = deps.loeschmarkierungen;
    this.jetzt = deps.jetzt ?? Date.now;
    this.neueId = deps.neueId ?? randomUUID;
  }

  private iso(ms = this.jetzt()): string {
    return new Date(ms).toISOString();
  }

  /** Billige Vorfrage für den Arbeitswege-Hook: ohne offene Sitzung wird nichts aufgelöst. */
  hatOffeneSitzungen(): boolean {
    return this.ablage.irgendeineOffen();
  }

  /**
   * Die Anzeige in `host` zeigt den Lernzustand dieses Kontos JETZT sichtbar mit Pause — gemeldet
   * vom beobachteten Client selbst. Gilt `SICHTBAR_GUELTIG_MS`, danach wird nicht mehr mitgeschrieben.
   */
  meldeSichtbar(kontoId: string, host: unknown, client: string | null): boolean {
    const h = VORMACHEN_HOSTS_MIT_ANZEIGE.find((x) => x === host);
    if (h === undefined || client === null) {
      return false;
    }
    this.sichtbarBis.set(`${kontoId}|${h}|${client}`, this.jetzt() + SICHTBAR_GUELTIG_MS);
    return true;
  }

  private istSichtbar(kontoId: string, host: VormachenHost, client: string | null): boolean {
    if (client === null) {
      return false;
    }
    const bis = this.sichtbarBis.get(`${kontoId}|${host}|${client}`);
    return bis !== undefined && bis >= this.jetzt();
  }

  /**
   * Die Frist wirkt bei jedem Zugriff: eine laufende oder pausierte Sitzung, deren Rohdatenfrist
   * vorbei ist, wird nach IHRER Regel abgebrochen; eine behaltene Notiz nach ihrer Frist entfernt.
   */
  private fristen(kontoId: string): void {
    const jetzt = this.iso();
    for (const s of this.ablage.sitzungen(kontoId)) {
      if (s.verfallAm > jetzt) {
        continue;
      }
      if (s.zustand === "abgebrochen") {
        this.ablage.entferne(kontoId, s.id);
      } else {
        this.abbrechenNachRegel(s);
      }
    }
  }

  private eigeneSitzung(kontoId: string, id: string): Lernsitzung {
    this.fristen(kontoId);
    const s = this.ablage.sitzung(kontoId, id);
    if (!s) {
      throw new VormachenFehler(404, "nicht_gefunden", "Lernsitzung nicht gefunden.");
    }
    return s;
  }

  private offeneSitzung(kontoId: string, id: string): Lernsitzung {
    const s = this.eigeneSitzung(kontoId, id);
    if (s.zustand === "abgebrochen") {
      throw new VormachenFehler(409, "zustand", "Diese Lernsitzung ist abgebrochen.");
    }
    return s;
  }

  async uebersicht(kontoId: string): Promise<{ sitzungen: Lernsitzung[]; routinen: Routine[] }> {
    this.fristen(kontoId);
    return {
      sitzungen: this.ablage.sitzungen(kontoId),
      routinen: (await this.routinenRepo.routinen(kontoId)).filter((r) => !r.beschaffung),
    };
  }

  starte(kontoId: string, eingabe: StartEingabe): Lernsitzung {
    const host = VORMACHEN_HOSTS.find((h) => h === eingabe.host);
    if (host === undefined) {
      throw new VormachenFehler(
        400,
        "eingabe",
        `host muss ${VORMACHEN_HOSTS.join(" oder ")} sein.`,
      );
    }
    if (!VORMACHEN_HOSTS_MIT_ANZEIGE.includes(host)) {
      throw new VormachenFehler(
        409,
        "host_ohne_anzeige",
        "In dieser Anwendung kann der Lernzustand noch nicht sichtbar angezeigt werden — deshalb wird dort nicht mitgeschrieben.",
      );
    }
    const liste = Array.isArray(eingabe.vorgaenge) ? eingabe.vorgaenge : [];
    const vorgaenge = [...new Set(liste)];
    if (
      vorgaenge.length === 0 ||
      !vorgaenge.every((v) => istVorgang(v) && VORMACHEN_VORGAENGE[v].host === host)
    ) {
      throw new VormachenFehler(
        400,
        "eingabe",
        "vorgaenge muss mindestens einen Vorgang des gewählten Hosts nennen und nur solche.",
      );
    }
    const zweck = text(eingabe.zweck, VORMACHEN_MAX_TEXT);
    if (zweck === null) {
      throw new VormachenFehler(
        400,
        "eingabe",
        `zweck ist Pflicht und höchstens ${VORMACHEN_MAX_TEXT} Zeichen lang.`,
      );
    }
    const regel = eingabe.abbruchRegel ?? VORMACHEN_STANDARD_ABBRUCH_REGEL;
    const abbruchRegel = VORMACHEN_ABBRUCH_REGELN.find((r) => r === regel);
    if (abbruchRegel === undefined) {
      throw new VormachenFehler(
        400,
        "eingabe",
        `abbruchRegel muss ${VORMACHEN_ABBRUCH_REGELN.join(" oder ")} sein.`,
      );
    }
    this.fristen(kontoId);
    const offen = this.ablage.sitzungen(kontoId).find((s) => s.zustand !== "abgebrochen");
    if (offen) {
      throw new VormachenFehler(
        409,
        "laeuft_schon",
        "Es gibt schon eine offene Lernsitzung. Bitte zuerst bestätigen oder abbrechen.",
      );
    }
    const jetzt = this.jetzt();
    const s: Lernsitzung = {
      id: this.neueId(),
      kontoId,
      host,
      vorgaenge: vorgaenge as VormachenVorgang[],
      zweck,
      abbruchRegel,
      zustand: "lernt",
      beobachtungen: [],
      korrekturen: {},
      nichtAufgenommen: { host: 0, vorgang: 0, pausiert: 0, unsichtbar: 0 },
      ziele: {},
      angelegtAm: this.iso(jetzt),
      geaendertAm: this.iso(jetzt),
      verfallAm: this.iso(jetzt + ROHDATEN_FRIST_STUNDEN * STUNDE_MS),
    };
    this.ablage.lege(s);
    return s;
  }

  private zaehle(s: Lernsitzung, feld: keyof NichtAufgenommen): void {
    const nichtAufgenommen = { ...s.nichtAufgenommen, [feld]: s.nichtAufgenommen[feld] + 1 };
    this.ablage.lege({ ...s, nichtAufgenommen });
  }

  /**
   * Die eine Annahmeregel für beide Quellen. Angenommen wird NUR, wenn die Sitzung lernt, Host und
   * Vorgang gewählt sind UND der beobachtete Client den Lernzustand gerade sichtbar anzeigt; sonst
   * wird weder Beschreibung noch Rohwert gespeichert, nur gezählt.
   */
  private nimmAn(
    s: Lernsitzung,
    client: string | null,
    host: unknown,
    vorgang: unknown,
    beschreibungRoh: unknown,
    rohwertRoh: unknown,
    neuerEntwurf: string | null = null,
    felderRoh: Readonly<Record<string, string>> | null = null,
  ): number {
    if (s.zustand !== "lernt") {
      this.zaehle(s, "pausiert");
      throw new VormachenFehler(409, "pausiert", "Das Mitschreiben ist pausiert.");
    }
    if (host !== s.host) {
      this.zaehle(s, "host");
      throw new VormachenFehler(
        422,
        "host_nicht_gewaehlt",
        "Diese Anwendung ist für die Lernsitzung nicht gewählt.",
      );
    }
    if (!this.istSichtbar(s.kontoId, s.host, client)) {
      this.zaehle(s, "unsichtbar");
      throw new VormachenFehler(
        409,
        "nicht_sichtbar",
        "Hier ist der Lernzustand gerade nicht sichtbar — deshalb wird nicht mitgeschrieben.",
      );
    }
    if (!istVorgang(vorgang) || !s.vorgaenge.includes(vorgang)) {
      this.zaehle(s, "vorgang");
      throw new VormachenFehler(
        422,
        "vorgang_nicht_gewaehlt",
        "Dieser Vorgang ist für die Lernsitzung nicht gewählt.",
      );
    }
    const beschreibung = text(beschreibungRoh, VORMACHEN_MAX_TEXT);
    if (beschreibung === null) {
      throw new VormachenFehler(
        400,
        "eingabe",
        `beschreibung ist Pflicht und höchstens ${VORMACHEN_MAX_TEXT} Zeichen lang.`,
      );
    }
    const ohneRohwert = rohwertRoh === undefined || rohwertRoh === null;
    const geheim = typeof rohwertRoh === "string" && siehtGeheimAus(rohwertRoh);
    const rohwert = ohneRohwert || geheim ? null : text(rohwertRoh, VORMACHEN_MAX_ROHWERT);
    if (!ohneRohwert && !geheim && rohwert === null) {
      throw new VormachenFehler(400, "eingabe", "rohwert ist zu lang oder kein Text.");
    }
    if (s.beobachtungen.length >= VORMACHEN_MAX_BEOBACHTUNGEN) {
      throw new VormachenFehler(409, "voll", "Diese Lernsitzung ist voll.");
    }
    const nr = s.beobachtungen.length + 1;
    const felder = rohfelder(felderRoh);
    const b: Rohbeobachtung = {
      nr,
      vorgang,
      beschreibung,
      rohwert,
      ...(felder ? { felder } : {}),
      am: this.iso(),
    };
    const beobachtungen = [...s.beobachtungen, b];
    const ziele = neuerEntwurf === null ? s.ziele : { ...s.ziele, [neuerEntwurf]: nr };
    this.ablage.lege({ ...s, beobachtungen, ziele, geaendertAm: b.am });
    return nr;
  }

  /**
   * Die zweckgebundene Beschreibung eines Arbeitswegs: was getan wurde, an welchem Entwurf
   * („Entwurf aus Schritt n", sonst „vorhandener Entwurf") und welche Angaben dabei gesetzt wurden.
   */
  private beschreibe(s: Lernsitzung, b: ArbeitswegBeobachtung): string {
    let bezug = "";
    if (b.ziel && !b.ziel.neu) {
      const schritt = s.ziele[b.ziel.entwurfId];
      bezug =
        schritt === undefined ? " (vorhandener Entwurf)" : ` (Entwurf aus Schritt ${schritt})`;
    }
    const angaben = b.angaben && b.angaben.length > 0 ? `: ${b.angaben.join(", ")}` : "";
    return `${b.beschreibung}${bezug}${angaben}`.slice(0, VORMACHEN_MAX_TEXT);
  }

  /**
   * Eine vom CLIENT gemeldete Beobachtung — nur für Vorgänge mit Quelle `client` (Seitenwechsel).
   * Ein Arbeitsweg-Vorgang kommt ausschließlich vom Server, damit die Vorschau abbildet, was
   * wirklich ausgeführt wurde, und keine behauptete Handlung.
   */
  beobachte(
    kontoId: string,
    id: string,
    eingabe: BeobachtungEingabe,
    client: string | null,
  ): number {
    const s = this.offeneSitzung(kontoId, id);
    if (istVorgang(eingabe.vorgang) && VORMACHEN_VORGAENGE[eingabe.vorgang].quelle !== "client") {
      throw new VormachenFehler(
        422,
        "nur_arbeitsweg",
        "Dieser Vorgang wird nur beim tatsächlichen Ausführen mitgeschrieben.",
      );
    }
    const { host, vorgang, beschreibung, rohwert } = eingabe;
    return this.nimmAn(s, client, host, vorgang, beschreibung, rohwert);
  }

  /**
   * Ein tatsächlich ausgeführter Arbeitsweg dieses Kontos aus dem Client `client`. Ohne offene
   * Sitzung geschieht nichts; was nicht passt oder dort nicht sichtbar ist, wird nur gezählt.
   * Wirft nie — der Arbeitsweg selbst ist längst beantwortet.
   */
  beobachteArbeitsweg(
    kontoId: string,
    b: ArbeitswegBeobachtung,
    client: string | null,
  ): number | null {
    this.fristen(kontoId);
    const s = this.ablage.sitzungen(kontoId).find((x) => x.zustand !== "abgebrochen");
    if (!s) {
      return null;
    }
    // EQF-06-K02: dieselbe Quelle unmittelbar noch einmal gelesen (Neuladen der Seite) ist kein
    // neuer Schritt.
    const letzte = s.beobachtungen[s.beobachtungen.length - 1];
    const quelle = b.vorgang === "quelle_lesen" ? b.felder?.quelle : undefined;
    const nochmal =
      quelle !== undefined &&
      letzte?.vorgang === "quelle_lesen" &&
      letzte.felder?.quelle === quelle;
    if (nochmal && letzte) {
      return letzte.nr;
    }
    const neu = b.ziel?.neu === true ? b.ziel.entwurfId : null;
    const beschreibung = this.beschreibe(s, b);
    const felder = b.felder ?? null;
    try {
      const vorgang = b.vorgang ?? "";
      return this.nimmAn(s, client, b.host, vorgang, beschreibung, b.rohwert, neu, felder);
    } catch {
      return null;
    }
  }

  /** Pause wirkt sofort: ab der Antwort nimmt der Server keine Beobachtung mehr an. */
  setzeZustand(kontoId: string, id: string, zustand: unknown): Lernsitzung {
    if (zustand !== "lernt" && zustand !== "pausiert") {
      throw new VormachenFehler(400, "eingabe", "zustand muss lernt oder pausiert sein.");
    }
    const s = this.offeneSitzung(kontoId, id);
    const neu: Lernsitzung = { ...s, zustand, geaendertAm: this.iso() };
    this.ablage.lege(neu);
    return neu;
  }

  lernnotiz(s: Lernsitzung): Lernnotiz {
    return {
      zweck: s.zweck,
      host: s.host,
      schritte: s.beobachtungen.map((b) => {
        const k = s.korrekturen[b.nr];
        return {
          nr: b.nr,
          vorgang: b.vorgang,
          beschreibung: k?.beschreibung ?? b.beschreibung,
          korrigiert: k !== undefined,
          entfernt: k?.entfernt === true,
        };
      }),
    };
  }

  private baueVorschau(s: Lernsitzung): Vorschau {
    const notiz = this.lernnotiz(s);
    const schritte: VorschauSchritt[] = notiz.schritte
      .filter((x) => !x.entfernt)
      .map((x, i) => ({
        nr: i + 1,
        vorgang: x.vorgang,
        beschreibung: x.beschreibung,
        aussenwirkung: VORMACHEN_VORGAENGE[x.vorgang].aussenwirkung,
        beleg: x.nr,
        korrigiert: x.korrigiert,
      }));
    // BPA-06: mit mehreren Vorführungen gehört die Ableitung zum Stand — bestätigt wird genau sie.
    const ableitung = leiteAb(s, s.ableitungsAenderungen ?? []);
    const teile = [s.id, s.host, s.zweck, schritte, ...(ableitung ? [ableitung] : [])];
    const stand = createHash("sha256").update(JSON.stringify(teile)).digest("hex").slice(0, 16);
    return {
      sitzungId: s.id,
      host: s.host,
      zweck: s.zweck,
      modus: "ergebnis_zur_pruefung",
      schritte,
      beobachtet: s.beobachtungen.length,
      entfernt: notiz.schritte.length - schritte.length,
      nichtAufgenommen: s.nichtAufgenommen,
      ...(ableitung ? { ableitung } : {}),
      stand,
    };
  }

  vorschau(kontoId: string, id: string): Vorschau {
    return this.baueVorschau(this.offeneSitzung(kontoId, id));
  }

  /** Korrigiert die Beschreibung eines beobachteten Schritts oder nimmt ihn aus der Vorschau. */
  korrigiere(kontoId: string, id: string, eingabe: KorrekturEingabe): Vorschau {
    const s = this.offeneSitzung(kontoId, id);
    if (eingabe.ableitung !== undefined) {
      return this.aendereAbleitung(s, eingabe.ableitung);
    }
    const nr = eingabe.nr;
    if (typeof nr !== "number" || !s.beobachtungen.some((b) => b.nr === nr)) {
      throw new VormachenFehler(400, "eingabe", "nr muss eine beobachtete Schrittnummer sein.");
    }
    let korrektur: LernKorrektur;
    if (eingabe.entfernen === true) {
      korrektur = { ...s.korrekturen[nr], entfernt: true };
    } else {
      const beschreibung = text(eingabe.beschreibung, VORMACHEN_MAX_TEXT);
      if (beschreibung === null) {
        throw new VormachenFehler(
          400,
          "eingabe",
          `beschreibung ist Pflicht und höchstens ${VORMACHEN_MAX_TEXT} Zeichen lang.`,
        );
      }
      korrektur = { beschreibung };
    }
    const neu: Lernsitzung = {
      ...s,
      korrekturen: { ...s.korrekturen, [nr]: korrektur },
      // BPA-06: geänderte Beobachtungen ergeben eine neue Ableitung; deren Schrittnummern
      // stimmen dann nicht mehr — frühere Änderungen an ihr verfallen sichtbar.
      ...(s.ableitungsAenderungen ? { ableitungsAenderungen: [] } : {}),
      geaendertAm: this.iso(),
    };
    this.ablage.lege(neu);
    return this.baueVorschau(neu);
  }

  /**
   * BPA-06 (AC03): eine Änderung an der Ableitung aus mehreren Vorführungen vor der Bestätigung —
   * etwa einen Entscheidungspunkt herausnehmen, wenn die Person entschieden hat, oder einen Festwert
   * zur Eingabe machen. Gilt nur, wenn eine Ableitung besteht und der Schritt in ihr vorkommt.
   */
  private aendereAbleitung(s: Lernsitzung, roh: unknown): Vorschau {
    const bisher = s.ableitungsAenderungen ?? [];
    const ableitung = leiteAb(s, bisher);
    // EQF-06-K03: eine Korrektur in den Worten der Person, gedeutet und mit Quelle.
    const aenderung = ableitung ? this.ausSatzOderWahl(ableitung.schritte, roh) : null;
    if (aenderung === null || ableitung === null) {
      throw new VormachenFehler(
        400,
        "eingabe",
        "ableitung braucht eine gültige Änderung an einer Ableitung aus mehreren Vorführungen.",
      );
    }
    const nr = "nr" in aenderung ? aenderung.nr : null;
    if (nr !== null && !ableitung.schritte.some((x) => x.nr === nr)) {
      throw new VormachenFehler(400, "eingabe", "nr muss ein Schritt der Ableitung sein.");
    }
    const neu: Lernsitzung = {
      ...s,
      ableitungsAenderungen: [...bisher, aenderung],
      geaendertAm: this.iso(),
    };
    this.ablage.lege(neu);
    return this.baueVorschau(neu);
  }

  /**
   * EQF-06-K03: aus `{ nr, satz, bedeutung? }` die gedeutete Änderung samt Quelle — bei unklarer
   * Bedeutung 422 `klaerung` mit den drei Bedeutungen als Wahl; sonst die bisherige strukturierte
   * Änderung (`ableitungsAenderung`) ohne Quelle.
   */
  private ausSatzOderWahl(schritte: readonly FunktionsSchritt[], roh: unknown): Aenderung | null {
    const istObjekt = roh !== null && typeof roh === "object" && !Array.isArray(roh);
    const o: Record<string, unknown> = istObjekt ? (roh as Record<string, unknown>) : {};
    if (typeof o.satz !== "string") {
      return ableitungsAenderung(roh);
    }
    const schritt = schritte.find((x) => x.nr === o.nr);
    if (!schritt) {
      throw new VormachenFehler(400, "eingabe", "nr muss ein Schritt der Ableitung sein.");
    }
    const gewaehlt = KORREKTUR_BEDEUTUNGEN.find((b) => b === o.bedeutung);
    const deutung = deuteKorrektur(o.satz, schritt, this.iso(), gewaehlt);
    if (!deutung.ok) {
      const klaerung = { grund: deutung.grund, nr: schritt.nr, optionen: deutung.optionen };
      if (deutung.grund === "eingabe") {
        throw new VormachenFehler(400, "eingabe", deutung.text, { klaerung });
      }
      throw new VormachenFehler(422, "klaerung", deutung.text, { klaerung });
    }
    return deutung.aenderung;
  }

  /**
   * Die Bestätigung nennt den Stand der Vorschau, die die Person gesehen hat. Danach steht nur die
   * Routine mit der benötigten Beschreibung — dauerhaft; Rohbeobachtungen UND Lernnotiz sind
   * entfernt, ihr Zweck ist erfüllt.
   */
  async bestaetige(
    kontoId: string,
    id: string,
    eingabe: { stand?: unknown; titel?: unknown },
  ): Promise<Routine> {
    const s = this.offeneSitzung(kontoId, id);
    const vorschau = this.baueVorschau(s);
    if (eingabe.stand !== vorschau.stand) {
      throw new VormachenFehler(
        409,
        "stand_veraltet",
        "Die Vorschau hat sich geändert. Bitte die aktuelle Vorschau ansehen und erneut bestätigen.",
      );
    }
    if (vorschau.schritte.length === 0) {
      throw new VormachenFehler(409, "leer", "Die Vorschau enthält keinen Schritt.");
    }
    if ((await this.routinenRepo.routinen(kontoId)).length >= VORMACHEN_MAX_ROUTINEN) {
      throw new VormachenFehler(409, "voll", "Bitte zuerst ältere Routinen löschen.");
    }
    const titel = eingabe.titel === undefined ? s.zweck : text(eingabe.titel, VORMACHEN_MAX_TEXT);
    if (titel === null) {
      throw new VormachenFehler(400, "eingabe", "titel ist zu lang oder leer.");
    }
    const routine: Routine = {
      id: this.neueId(),
      kontoId,
      titel,
      zweck: s.zweck,
      host: s.host,
      modus: "ergebnis_zur_pruefung",
      fassung: 1,
      schritte: vorschau.schritte.map((x) => ({
        id: `s${x.nr}`,
        nr: x.nr,
        vorgang: x.vorgang,
        beschreibung: x.beschreibung,
        aussenwirkung: x.aussenwirkung,
      })),
      herkunft: {
        sitzungId: s.id,
        stand: vorschau.stand,
        beobachtet: vorschau.beobachtet,
        korrigiert: Object.keys(s.korrekturen).length,
      },
      bestaetigtAm: this.iso(),
      firmenuebergabe: null,
      // BPA-06: nur Eingaben und Schritte der Ableitung; die Erklärung entsteht daraus neu.
      ...(vorschau.ableitung
        ? {
            ableitung: {
              vorfuehrungen: vorschau.ableitung.vorfuehrungen,
              parameter: vorschau.ableitung.parameter,
              schritte: vorschau.ableitung.schritte,
              // EQF-06-K03: die Korrekturen der Person bleiben mit ihrer Quelle zugeordnet.
              ...(vorschau.ableitung.korrekturen
                ? { korrekturen: vorschau.ableitung.korrekturen }
                : {}),
            },
          }
        : {}),
    };
    await this.schreibeRoutine(routine, null);
    this.ablage.entferne(kontoId, s.id);
    return routine;
  }

  /**
   * EQF-06-K10: „Beachte meine heutige Korrektur künftig.“ Eine Korrektur an einer BESTÄTIGTEN
   * Routine wird eine neue, nachvollziehbare Fassung: Fassung + 1, die Änderung samt Quelle im
   * Fassungsverlauf. Bereits angelegte Läufe bleiben an ihre Fassung gebunden — vor jeder Wirkung
   * sperrt `routineSperre` eine andere Fassung („Die Routine wurde inzwischen geändert.“), und ein
   * offener Zeitplanlauf wird mit diesem Grund ausdrücklich abgeschlossen statt still umgelernt.
   * Nur Routinen mit Ableitung (aus mindestens zwei Vorführungen) tragen Schritte, die sich so
   * korrigieren lassen; jede andere wird durch erneutes Vormachen geändert.
   */
  async korrigiereRoutine(
    kontoId: string,
    id: string,
    eingabe: { fassung?: unknown; ableitung?: unknown },
  ): Promise<{ routine: Routine; aenderung: Aenderung }> {
    return this.nacheinander(`${kontoId}|${id}`, async () => {
      const r = await this.routine(kontoId, id);
      if (!r.ableitung) {
        const message =
          "Diese Routine hat keine abgeleiteten Schritte zum Korrigieren. Ändere sie, indem du sie " +
          "noch einmal vormachst.";
        throw new VormachenFehler(409, "nicht_korrigierbar", message);
      }
      if (eingabe.fassung !== r.fassung) {
        const message = `Die Routine steht jetzt auf Fassung ${r.fassung}. Bitte neu ansehen.`;
        throw new VormachenFehler(409, "stand_veraltet", message);
      }
      const aenderung = this.ausSatzOderWahl(r.ableitung.schritte, eingabe.ableitung);
      const nr = aenderung && "nr" in aenderung ? aenderung.nr : null;
      if (aenderung === null || (nr !== null && !r.ableitung.schritte.some((x) => x.nr === nr))) {
        throw new VormachenFehler(400, "eingabe", "ableitung braucht eine gültige Korrektur.");
      }
      const ableitung = aendereBestaetigteAbleitung(kontoId, r.ableitung, aenderung);
      const fassung = r.fassung + 1;
      const version: RoutinenFassung = {
        fassung,
        am: this.iso(),
        art: aenderung.art,
        quelle: aenderung.quelle ?? null,
      };
      const neu: Routine = {
        ...r,
        fassung,
        ableitung,
        versionen: [...(r.versionen ?? []), version],
      };
      await this.schreibeRoutine(neu, r);
      return { routine: neu, aenderung };
    });
  }

  private abbrechenNachRegel(s: Lernsitzung): AbbruchErgebnis {
    const mitRohdaten = (b: Rohbeobachtung) => b.rohwert !== null || b.felder !== undefined;
    const rohdatenEntfernt = s.beobachtungen.filter(mitRohdaten).length;
    if (s.abbruchRegel === "alles_verwerfen") {
      this.ablage.entferne(s.kontoId, s.id);
      return { regel: s.abbruchRegel, rohdatenEntfernt, notizBehalten: false };
    }
    const jetzt = this.jetzt();
    this.ablage.lege({
      ...s,
      zustand: "abgebrochen",
      // Die Notiz bleibt — ohne jeden Rohwert, ohne Rohfelder und ohne Entwurfskennungen.
      beobachtungen: s.beobachtungen.map(({ felder: _felder, ...b }) => ({ ...b, rohwert: null })),
      ziele: {},
      geaendertAm: this.iso(jetzt),
      verfallAm: this.iso(jetzt + LERNNOTIZ_FRIST_TAGE * TAG_MS),
    });
    return { regel: s.abbruchRegel, rohdatenEntfernt, notizBehalten: true };
  }

  brecheAb(kontoId: string, id: string): AbbruchErgebnis {
    return this.abbrechenNachRegel(this.offeneSitzung(kontoId, id));
  }

  /** Eine behaltene Lernnotiz (nach Abbruch) oder offene Sitzung gezielt löschen. */
  verwerfeNotiz(kontoId: string, id: string): void {
    this.eigeneSitzung(kontoId, id);
    this.ablage.entferne(kontoId, id);
  }

  async routine(kontoId: string, id: string): Promise<Routine> {
    const r = await this.routinenRepo.routine(kontoId, id);
    if (!r || r.beschaffung) {
      throw new VormachenFehler(404, "nicht_gefunden", "Routine nicht gefunden.");
    }
    return r;
  }

  private raeumeAusfuehrungenAuf(jetzt: number): void {
    for (const [id, a] of this.ausfuehrungen) {
      if (a.bisMs < jetzt) {
        this.ausfuehrungen.delete(id);
      }
    }
  }

  /**
   * Die Freigabe EINES Schritts im Augenblick seiner Ausführung. Ohne Außenwirkung entsteht nur ein
   * Ergebnis zur Prüfung. Mit Außenwirkung in zwei Zügen:
   *   1. ohne Bestätigung → 409 mit einer frisch angeforderten AUSFÜHRUNG (Kennung), gebunden an
   *      Konto, Routine, Fassung und genau diesen Schritt, höchstens fünf Minuten gültig;
   *   2. mit `{ ausfuehrung }` → frei, wenn die Kennung genau diesen Schritt dieser Routine dieses
   *      Kontos nennt und noch gilt. Sie ist danach VERBRAUCHT: ein zweiter Gebrauch, ein anderer
   *      Schritt, eine andere Routine oder ein anderes Konto gibt nichts frei.
   */
  async gibSchrittFrei(
    kontoId: string,
    routineId: string,
    schrittId: string,
    bestaetigung: AussenBestaetigung | undefined,
  ): Promise<Freigabe> {
    const r = await this.routine(kontoId, routineId);
    const schritt = r.schritte.find((x) => x.id === schrittId);
    if (!schritt) {
      throw new VormachenFehler(404, "nicht_gefunden", "Schritt nicht gefunden.");
    }
    if (!schritt.aussenwirkung) {
      return { art: "ergebnis_zur_pruefung", schritt };
    }
    const jetzt = this.jetzt();
    this.raeumeAusfuehrungenAuf(jetzt);
    const kennung = bestaetigung?.ausfuehrung;
    if (kennung === undefined || kennung === null) {
      const a: OffeneAusfuehrung = {
        id: this.neueId(),
        kontoId,
        routineId: r.id,
        schrittId: schritt.id,
        fassung: r.fassung,
        bisMs: jetzt + AUSSEN_BESTAETIGUNG_GUELTIG_MS,
        gueltigBis: this.iso(jetzt + AUSSEN_BESTAETIGUNG_GUELTIG_MS),
      };
      this.ausfuehrungen.set(a.id, a);
      throw new VormachenFehler(
        409,
        "bestaetigung_fehlt",
        "Dieser Schritt wirkt nach außen und braucht deine Bestätigung für genau diese Ausführung.",
        {
          ausfuehrung: {
            id: a.id,
            routineId: a.routineId,
            schrittId: a.schrittId,
            fassung: a.fassung,
            gueltigBis: a.gueltigBis,
          } satisfies Ausfuehrung,
        },
      );
    }
    const a = typeof kennung === "string" ? this.ausfuehrungen.get(kennung) : undefined;
    if (
      !a ||
      a.kontoId !== kontoId ||
      a.routineId !== r.id ||
      a.schrittId !== schritt.id ||
      a.fassung !== r.fassung ||
      a.bisMs < jetzt
    ) {
      throw new VormachenFehler(
        409,
        "bestaetigung_passt_nicht",
        "Die Bestätigung passt nicht zu dieser Ausführung, ist verbraucht oder nicht mehr gültig.",
      );
    }
    this.ausfuehrungen.delete(a.id);
    return { art: "aussenaktion_bestaetigt", schritt, ausfuehrung: a.id };
  }

  // ----------------------------------------------------------------------------------------------
  // produkt:20261011:assistenz-lernen-hostfortsetzung (BPA-06) — Zustand, Zeitplan und Läufe
  // einer bestätigten Routine. Alles steht im JSON der Routine selbst (kein zweiter Speicher); die
  // Privatlöschung entfernt es mit ihr.
  // ----------------------------------------------------------------------------------------------

  private readonly laufSperren = new Map<string, Promise<unknown>>();

  /** Arbeiten an DERSELBEN Routine nacheinander; eine zweite Anfrage sieht die erste. */
  private async nacheinander<T>(schluessel: string, f: () => Promise<T>): Promise<T> {
    const vorher = this.laufSperren.get(schluessel) ?? Promise.resolve();
    const jetzt = vorher.then(f, f);
    const gemerkt = jetzt.catch(() => undefined);
    this.laufSperren.set(schluessel, gemerkt);
    try {
      return await jetzt;
    } finally {
      if (this.laufSperren.get(schluessel) === gemerkt) {
        this.laufSperren.delete(schluessel);
      }
    }
  }

  /** BPA-06: Routine pausieren oder fortsetzen. Eine pausierte Routine läuft nicht. */
  async setzeRoutinenZustand(kontoId: string, id: string, zustand: unknown): Promise<Routine> {
    if (zustand !== "aktiv" && zustand !== "pausiert") {
      throw new VormachenFehler(400, "eingabe", "zustand muss aktiv oder pausiert sein.");
    }
    return this.nacheinander(`${kontoId}|${id}`, async () => {
      const r = await this.routine(kontoId, id);
      // AC05: Termine während einer Pause werden nach dem Fortsetzen nicht nachgeholt.
      const bisher = r.zeitplanLauf ?? null;
      const fortgesetzt = zustand === "aktiv" && r.zustand === "pausiert";
      const pausiert = zustand === "pausiert" && r.zustand !== "pausiert";
      let zeitplanLauf: RoutinenZeitplanLauf | null = bisher;
      if (bisher && fortgesetzt) {
        // EQF-06-K05: die Pause wird ein Abschnitt, dessen Ereignisse nicht laufen; Ereignisse
        // davor (Rückstand) bleiben erhalten.
        const jetzt = this.iso();
        const { pausiertSeit, ...rest } = bisher;
        const pause = pausiertSeit ? [{ von: pausiertSeit, bis: jetzt }] : [];
        const pausen = [...(bisher.pausen ?? []), ...pause];
        zeitplanLauf = { ...rest, seit: jetzt, ...(pausen.length > 0 ? { pausen } : {}) };
      } else if (bisher && pausiert && r.zeitplan?.art === "bei_ereignis") {
        // Nur Ereignisse brauchen den Abschnitt; Termine einer Pause regelt `seit`.
        zeitplanLauf = { ...bisher, pausiertSeit: this.iso() };
      }
      const neu: Routine = { ...r, zustand, ...(zeitplanLauf ? { zeitplanLauf } : {}) };
      await this.schreibeRoutine(neu, r);
      return neu;
    });
  }

  /**
   * BPA-06: Zeitplanangabe setzen oder entfernen (`null`). Geprüft wird vorher am Rand. AC05: mit
   * Zeitplan auch Gespräch und Eingaben fälliger Läufe; `seit` ist jetzt.
   */
  async setzeZeitplan(
    kontoId: string,
    id: string,
    zeitplan: Zeitplan | null,
    lauf: { gespraech: string; eingaben: Record<string, string> } | null = null,
  ): Promise<Routine> {
    return this.nacheinander(`${kontoId}|${id}`, async () => {
      const r = await this.routine(kontoId, id);
      if (zeitplan && r.ausfuehrung === "schrittweise") {
        throw new VormachenFehler(409, "schrittweise", SCHRITTWEISE_OHNE_ZEITPLAN);
      }
      // EQF-06-K05: ein Ereignis löst einen Lauf am Server aus — eine Word-Routine braucht dafür
      // das geöffnete Word mit seiner Markierung, das hinter keinem Ereignis steht.
      if (zeitplan?.art === "bei_ereignis" && r.host === "word") {
        const message =
          "Eine Word-Routine startet nicht bei einem Ereignis, nur zu Terminen in Word.";
        throw new VormachenFehler(409, "anderer_host", message);
      }
      const seit = this.iso();
      // Wird der Zeitplan während einer Pause gesetzt, beginnt die Pause für ihn jetzt.
      const ereignis =
        zeitplan?.art === "bei_ereignis"
          ? { ereignisseAb: seit, ...(r.zustand === "pausiert" ? { pausiertSeit: seit } : {}) }
          : {};
      const zeitplanLauf = zeitplan && lauf ? { ...lauf, seit, ...ereignis } : null;
      const neu: Routine = { ...r, zeitplan, zeitplanLauf };
      await this.schreibeRoutine(neu, r);
      return neu;
    });
  }

  /**
   * EQF-06-K06: die Übergabeart der eigenen Routine. „Gemeinsam schrittweise“ braucht bei jedem
   * Schritt die Person: nicht mit einem Zeitplan und nicht für Word (dort startet ein Klick den
   * ganzen Lauf am Server). Die Fassung bleibt; ein schon angelegter Lauf behält seine Art
   * (sie gehört zu seinem Abdruck).
   */
  async setzeAusfuehrung(kontoId: string, id: string, roh: unknown): Promise<Routine> {
    const ausfuehrung = AUSFUEHRUNGSMODI.find((m) => m === roh);
    if (!ausfuehrung) {
      const message = `ausfuehrung muss eine von ${AUSFUEHRUNGSMODI.join(", ")} sein.`;
      throw new VormachenFehler(400, "eingabe", message);
    }
    return this.nacheinander(`${kontoId}|${id}`, async () => {
      const r = await this.routine(kontoId, id);
      if (ausfuehrung === "schrittweise" && r.host === "word") {
        const message = "Gemeinsam schrittweise geht nur in Klarwerk im Browser, nicht in Word.";
        throw new VormachenFehler(409, "schrittweise", message);
      }
      if (ausfuehrung === "schrittweise" && r.zeitplan) {
        throw new VormachenFehler(409, "schrittweise", SCHRITTWEISE_OHNE_ZEITPLAN);
      }
      const neu: Routine = { ...r, ausfuehrung };
      await this.schreibeRoutine(neu, r);
      return neu;
    });
  }

  /**
   * BPA-06 (Nacharbeit 41): eine Word-Routine an Programm und Hostfassung binden. Nur Routinen des
   * Hosts Word; geprüft (Siegel, Ziel) wird vorher am Rand.
   */
  async setzeHostbindung(
    kontoId: string,
    id: string,
    bindung: Omit<RoutinenHostbindung, "am">,
  ): Promise<Routine> {
    return this.nacheinander(`${kontoId}|${id}`, async () => {
      const r = await this.routine(kontoId, id);
      if (r.host !== "word") {
        throw new VormachenFehler(409, "anderer_host", "Diese Routine läuft nicht in Word.");
      }
      const neu: Routine = { ...r, hostbindung: { ...bindung, am: this.iso() } };
      await this.schreibeRoutine(neu, r);
      return neu;
    });
  }

  /**
   * Schreibt die Läufe der Routine — VOLLSTÄNDIG. Eine einmal verwendete Laufkennung bleibt
   * gebunden, solange die Routine besteht (Bens Befund zu d51be62b: eine gekürzte Liste machte eine
   * verdrängte Kennung wieder „neu“ und ließ einen zweiten Bericht zu). Ein Eintrag ist klein
   * (Kennung, Fassung, Abdruck, Gespräch, Auftrag, Zeit); er endet mit der Routine.
   */
  private async schreibeRoutine(neu: Routine, alt: Routine | null): Promise<void> {
    if (!(await this.routinenRepo.vergleicheUndLege(neu, alt)))
      throw new VormachenFehler(
        409,
        "stand_veraltet",
        "Die Funktion wurde inzwischen geändert. Bitte neu laden; nichts überschrieben.",
      );
  }
  private async legeLaeufe(r: Routine, laeufe: RoutinenLauf[]): Promise<Routine> {
    const neu = { ...r, laeufe };
    await this.schreibeRoutine(neu, r);
    return neu;
  }

  /**
   * BPA-06 (G12): genau EIN Auftrag je Laufkennung. Je Routine nacheinander:
   *   · gleiche Kennung, gleicher Abdruck, Auftrag vorhanden → derselbe Auftrag (`wiederholt`);
   *   · gleiche Kennung, anderer Abdruck → 409 `lauf_widerspricht`, nichts angelegt;
   *   · neu → erst dauerhaft RESERVIEREN, dann anlegen, dann die Auftragskennung eintragen.
   * Fand ein früherer Versuch keine Zeit mehr zum Eintragen, sucht `finde` den schon angelegten
   * Auftrag, bevor ein zweiter entsteht. Scheitert das Anlegen, fällt die Reservierung weg.
   */
  async einmalJeLauf(
    kontoId: string,
    routineId: string,
    lauf: { kennung: string; fassung: number; abdruck: string; gespraech: string },
    wege: { finde: () => Promise<string | null>; erzeuge: () => Promise<string> },
  ): Promise<{ auftragId: string; gespraech: string; wiederholt: boolean }> {
    return this.nacheinander(`${kontoId}|${routineId}`, async () => {
      let r = await this.routine(kontoId, routineId);
      const bisher = [...(r.laeufe ?? [])];
      const vorhanden = bisher.find((l) => l.kennung === lauf.kennung);
      if (vorhanden && vorhanden.abdruck !== lauf.abdruck) {
        throw new VormachenFehler(
          409,
          "lauf_widerspricht",
          "Diese Laufkennung gehört zu anderen Eingaben, einer anderen Fassung oder einem anderen Gespräch.",
        );
      }
      if (vorhanden?.auftragId) {
        return { auftragId: vorhanden.auftragId, gespraech: vorhanden.gespraech, wiederholt: true };
      }
      if (vorhanden && (vorhanden.reserviertBis ?? 0) > this.jetzt()) {
        throw new VormachenFehler(
          409,
          "stand_veraltet",
          "Dieser Lauf wird bereits bearbeitet. Später unter derselben Kennung fortsetzen.",
        );
      }
      const gefunden = vorhanden ? await wege.finde() : null;
      const ohne = bisher.filter((l) => l.kennung !== lauf.kennung);
      const eintrag = (auftragId: string | null): RoutinenLauf => ({
        ...lauf,
        auftragId,
        am: this.iso(),
        ...(auftragId === null
          ? { reserviertVon: this.neueId(), reserviertBis: this.jetzt() + 120_000 }
          : {}),
      });
      if (gefunden) {
        await this.legeLaeufe(r, [...ohne, eintrag(gefunden)]);
        return { auftragId: gefunden, gespraech: lauf.gespraech, wiederholt: true };
      }
      r = await this.legeLaeufe(r, [...ohne, eintrag(null)]);
      let auftragId: string;
      try {
        auftragId = await wege.erzeuge();
      } catch (fehler) {
        await this.legeLaeufe(r, ohne);
        throw fehler;
      }
      await this.legeLaeufe(r, [...ohne, eintrag(auftragId)]);
      return { auftragId, gespraech: lauf.gespraech, wiederholt: false };
    });
  }

  /** BPA-06 AC05: die Routinen mit Zeitplan aller Konten — nur für die Zeitsteuerung des Servers. */
  routinenMitZeitplan(): Promise<Routine[]> {
    return this.routinenRepo.mitZeitplan();
  }

  /**
   * BPA-06 AC05/G12: am Laufeintrag vermerken, dass seine Ausführung abgeschlossen ist, oder einen
   * vorübergehend gescheiterten Versuch zählen. `null`, wenn es den Lauf nicht gibt.
   */
  async vermerkeLauf(
    kontoId: string,
    id: string,
    kennung: string,
    was: "abgeschlossen" | "versuch",
  ): Promise<RoutinenLauf | null> {
    return this.nacheinander(`${kontoId}|${id}`, async () => {
      const r = await this.routine(kontoId, id);
      const laeufe = [...(r.laeufe ?? [])];
      const alt = laeufe.find((l) => l.kennung === kennung);
      if (!alt) {
        return null;
      }
      const neu: RoutinenLauf =
        was === "abgeschlossen"
          ? { ...alt, abgeschlossenAm: this.iso() }
          : { ...alt, versuche: (alt.versuche ?? 0) + 1 };
      await this.legeLaeufe(
        r,
        laeufe.map((l) => (l.kennung === kennung ? neu : l)),
      );
      return neu;
    });
  }

  /** BPA-06 AC05: ein fälliger Termin wurde abgelehnt — vermerkt, damit er nicht endlos wiederkehrt. */
  async vermerkeTerminAbgelehnt(kontoId: string, id: string, kennung: string): Promise<void> {
    await this.nacheinander(`${kontoId}|${id}`, async () => {
      const r = await this.routine(kontoId, id);
      if (!r.zeitplanLauf) {
        return;
      }
      const bisher = r.zeitplanLauf.abgelehnt ?? [];
      const abgelehnt = [...bisher, kennung].slice(-ZEITPLAN_MAX_ABGELEHNT);
      await this.schreibeRoutine({ ...r, zeitplanLauf: { ...r.zeitplanLauf, abgelehnt } }, r);
    });
  }

  /**
   * EQF-06-K05/K09: Ereignisse bis einschließlich Sequenz `bis` (Zeitpunkt `am`) sind erledigt. Der
   * Stand rückt nur vor, nie zurück; Pausen, die vor `am` endeten, werden nicht mehr gebraucht.
   */
  async vermerkeEreignisStand(kontoId: string, id: string, bis: number, am: string): Promise<void> {
    await this.nacheinander(`${kontoId}|${id}`, async () => {
      const r = await this.routine(kontoId, id);
      const zl = r.zeitplanLauf;
      if (!zl || (zl.ereignisseBis ?? 0) >= bis) {
        return;
      }
      const pausen = (zl.pausen ?? []).filter((p) => p.bis > am);
      const { pausen: _alt, ...rest } = zl;
      const neu = { ...rest, ereignisseBis: bis, ...(pausen.length > 0 ? { pausen } : {}) };
      await this.schreibeRoutine({ ...r, zeitplanLauf: neu }, r);
    });
  }

  /** Vermerkt eine Übergabe an die Firma; die Kopie selbst legt der Entwurfsweg an. */
  async vermerkeFirmenuebergabe(kontoId: string, id: string, entwurfId: string): Promise<Routine> {
    const r = await this.routine(kontoId, id);
    const neu: Routine = { ...r, firmenuebergabe: { entwurfId, am: this.iso() } };
    await this.schreibeRoutine(neu, r);
    return neu;
  }

  /**
   * Privatlöschung: alle eigenen Lernsitzungen, Notizen und Routinen — sonst nichts. RF-17: ZUERST
   * die Löschmarkierung außerhalb der Datenbank; scheitert sie, wird nichts gelöscht (sonst brächte
   * der nächste Restore die Routinen unbemerkt zurück).
   */
  async privatLoeschen(kontoId: string): Promise<{ sitzungen: number; routinen: number }> {
    await this.loeschmarkierungen?.vermerke({
      art: "persoenliche_routinen",
      kontoId,
      am: this.iso(),
    });
    const sitzungen = this.ablage.entferneAlle(kontoId);
    for (const [id, a] of this.ausfuehrungen) {
      if (a.kontoId === kontoId) {
        this.ausfuehrungen.delete(id);
      }
    }
    return { sitzungen, routinen: await this.routinenRepo.entferneAlle(kontoId) };
  }
}
