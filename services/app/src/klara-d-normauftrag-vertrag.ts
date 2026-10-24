import type { KlaraAuftrag, KlaraAuftragSchritt } from "./klara-auftrag";
import type { KlaraDNormAuftragsEingabe } from "./klara-d-normauftrag-eingabe";
import type { NotizSchreibbedingung } from "./klara-notiz-schreibbedingung";

export type { KlaraDNormAuftragsEingabe };

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
  /** Einmaliger eigener G-Eingang je Sachereignis; D bindet ihn im anlegen-Guard vor dem Schreiben. */
  eingang(
    eingabe: Omit<KlaraDNormAuftragsEingabe, "gespraechId">,
    kontext: KlaraDNormAuftragsKontext,
  ): Promise<KlaraDNormAuftragsEingabe>;
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
