import type { Confidentiality } from "../../knowledge-object";

/** Schutzstufe eines Kontextteils; `null` (unbekannt) gilt wie die höchste Stufe (G05). */
export type KontextSchutz = "oeffentlich" | Confidentiality;

export interface Ergebnisform {
  readonly art: "trefferliste" | "entwurf";
  /** Die einzigen Felder, die aus einer Werkzeugantwort übernommen werden. */
  readonly felder: readonly string[];
  /** `true`: ein Eintrag ohne gültige http(s)-Adresse im Feld `url` wird verworfen. */
  readonly quellenPflicht: boolean;
}

export type VoraussetzungArt =
  | "registrierung"
  | "adapter"
  | "adapterfassung"
  | "deaktiviert"
  | "credential"
  | "budget"
  | "freigabe_extern"
  | "anbieter"
  | "eingabe"
  | "routine"
  | "fassung_geaendert"
  | "kontext_geaendert"
  | "keine_ki"
  | "vertraulich"
  | "kontextrecht";

export interface Voraussetzung {
  readonly art: VoraussetzungArt;
  readonly text: string;
}

export interface Faehigkeitsbindung {
  readonly auftragId: string;
  readonly mandant: string;
  readonly nutzer: string;
  readonly sitzung: string;
  readonly arbeitsbereich: string | null;
  readonly zweck: string;
  readonly ausloeser: "nutzerauftrag" | "routine";
  readonly faehigkeitId: string;
  readonly fassung: string;
  readonly vertragsFingerabdruck: string;
  readonly adapterFassung: string;
  readonly eingabe: Readonly<Record<string, string>>;
  readonly aktionen: readonly string[];
  readonly datenweg: string;
  readonly ergebnisform: Ergebnisform;
  readonly kontext: readonly {
    readonly kennung: string;
    readonly fassung: string;
    readonly schutz: KontextSchutz | null;
  }[];
  readonly gebundenAm: string;
}

export type AusfuehrungsStand =
  | "erfolgreich"
  | "teilweise"
  | "fehlgeschlagen"
  | "gesperrt"
  | "voraussetzung_fehlt"
  | "unverfuegbar"
  | "abgebrochen"
  | "laeuft";

export interface Faehigkeitsergebnis {
  readonly auftragId: string;
  readonly stand: AusfuehrungsStand;
  readonly faehigkeitId: string | null;
  readonly fassung: string | null;
  readonly vertragsFingerabdruck: string | null;
  readonly eintraege: readonly Readonly<Record<string, string>>[];
  /** Einträge, die die Ergebnisform verletzten (z. B. Quelle fehlt) und nicht übernommen wurden. */
  readonly verworfen: number;
  /** Übernommene Einträge mit Anweisungstext — bleiben Daten, werden nie ausgeführt. */
  readonly fremdeAnweisungen: number;
  readonly meldung: string;
  readonly voraussetzungen: readonly Voraussetzung[];
  readonly verbrauchCent: number | null;
  readonly transport: "echt" | "ersatz" | null;
  readonly wirkungKennung: string | null;
  readonly ruecklink: { readonly arbeitsbereich: string | null; readonly auftragId: string };
  readonly wiederholt: boolean;
  readonly versuch: number;
  readonly abgeschlossenAm: string | null;
}

export type AuftragsZustand = "wartet" | "laeuft" | "fertig";

/**
 * Ein Auftrag in der dauerhaften Ablage: Bindung, Zustand, Versuch und Ergebnis. Die Kennung ist je
 * Konto die Auftrags- UND Wirkungsidentität — ein Wiederanlauf nach Neustart läuft unter derselben
 * Kennung, und ein schreibender Adapter erhält sie als Idempotenzschlüssel (`kontext.auftragId`).
 */
export interface AuftragsEintrag {
  readonly auftragId: string;
  readonly fingerabdruck: string;
  readonly bindung: Faehigkeitsbindung;
  readonly zustand: AuftragsZustand;
  readonly versuch: number;
  /** Der Prozess, der gerade ausführt (`laeuft`); sonst `null`. */
  readonly instanz: string | null;
  readonly seit: string;
  readonly ergebnis: Faehigkeitsergebnis | null;
  /**
   * Der Nutzer hat den Auftrag abgebrochen. Dauerhaft: ein wartender Auftrag startet danach nicht
   * mehr, ein laufender startet keinen abhängigen Unterschritt — auch in einem anderen Prozess.
   */
  readonly abbruch?: boolean;
  /**
   * Ergebnisinhalt und Eingabe sind nach der Aufbewahrungsgrenze entfernt. Die Auftrags- und
   * Wirkungsidentität (Kennung, Fingerabdruck, Stand, Wirkungskennung) bleibt erhalten — eine
   * Wiederholung derselben Kennung löst deshalb keine zweite Wirkung aus.
   */
  readonly gekuerzt?: boolean;
}

export interface FaehigkeitsVormerkung {
  readonly faehigkeitId: string;
  readonly art: "favorit" | "routine";
  readonly zweck: string | null;
  readonly fassung: string;
  readonly vertragsFingerabdruck: string;
  readonly bestaetigtAm: string | null;
  readonly aktiv: boolean;
  readonly gespeichertAm: string;
}
