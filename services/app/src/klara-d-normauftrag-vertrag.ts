import type { KlaraAuftrag, KlaraAuftragSchritt } from "./klara-auftrag";
import type { NotizSchreibbedingung } from "./klara-notiz";

/** Ausschließlich serverseitiger D→G-Port. Quelltext und Browserfelder erteilen keine Befugnis. */
export interface KlaraDNormAuftragsEingabe {
  readonly kontoId: string;
  /** D bindet diesen eigenen Eingang vor dem G-Aufruf per bestehendem Norm-Ereignis-CAS. */
  readonly gespraechId: string;
  readonly erinnerungId: string;
  readonly erinnerungFassung: number;
  readonly routineFassung: number;
  readonly normId: string;
  readonly ereignisId: string;
  /** Bestehender stabiler Sachvorgang; keine neue Identität je Lauf, Kopie oder Zustellversuch. */
  readonly pruefVorgang: string;
  /** Wirklich gespeicherter eigener D-Bericht, kein fingierter menschlicher Gesprächsbeitrag. */
  readonly notiz: { readonly id: string; readonly fassung: number };
  readonly titel: string;
}

export interface KlaraDNormAuftragsReferenz {
  readonly gespraechId: string;
  readonly auftragId: string;
  readonly nr: 1;
  readonly schluessel: string;
}

export interface KlaraDNormAuftragsPruefung {
  readonly phase: "lesen" | "anlegen" | "wirken";
  readonly eingabe: KlaraDNormAuftragsEingabe;
  /** Vom G-Adapter selbst aus dem normalisierten begrenzten Inhalt berechnet. */
  readonly abdruck: string;
  readonly original: KlaraAuftrag | null;
}

export interface KlaraDNormAuftragsKontext {
  readonly vorkommenId: string;
  readonly besitzer: string;
  /**
   * Tatsächliche bestehende D-Bedingung: aktuelle ausdrückliche Prüfaufgabenbestellung,
   * Erinnerungs-/Routinenfassung, gehaltener Lauf/Besitzer, Konto, Quell-/Care-/Normrechte und
   * kanonischer Ereignis-/Eingangsbezug. Am wirklichen INSERT als SQL-Bedingung komponieren;
   * ein vor dem POST gelesener boolescher Wert ersetzt sie nicht. Kein Clientheader/Body-Grant.
   */
  readonly bedingung: NotizSchreibbedingung;
  /**
   * D liest die echten eigenen Zustände JETZT. Für neue Anlage/Wirkung muss zusätzlich die
   * sichtbare ausdrückliche persönliche Prüfaufgabenbestellung gespeichert und gültig sein.
   * belege_vorbereiten allein reicht nie. Bei fehlender Befugnis wirft diese Funktion;
   * der G-Adapter liefert keinen wirkenden Ersatz. Reines Originallesen bleibt gesondert.
   */
  pruefe(pruefung: KlaraDNormAuftragsPruefung): Promise<void>;
}

export interface KlaraDNormAuftragsAntwort {
  /** Nur diese Referenz gehört in D; Ausführungsstand/Ergebnis bleiben im vorhandenen G-Journal. */
  readonly referenz: KlaraDNormAuftragsReferenz;
  readonly auftrag: KlaraAuftrag;
  readonly schritt: KlaraAuftragSchritt | null;
  readonly wiederholt: boolean;
}

/** Optionaler Dep in D: fehlt er, wird keine Prüfaufgabe angelegt und der alte Watch bleibt gültig. */
export interface KlaraDNormAuftragsPort {
  /** Tatsächlichen gebundenen Vorgang lesen; null ist kein Beweis einer fehlenden Fachwirkung. */
  original(
    eingabe: KlaraDNormAuftragsEingabe,
    kontext: KlaraDNormAuftragsKontext,
  ): Promise<KlaraDNormAuftragsAntwort | null>;
  /** Vor Neuanlage Original lesen/CAS; gleicher Inhalt liefert Original, anderer Inhalt Konflikt. */
  ausfuehren(
    eingabe: KlaraDNormAuftragsEingabe,
    kontext: KlaraDNormAuftragsKontext,
  ): Promise<KlaraDNormAuftragsAntwort>;
}
