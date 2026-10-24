import type { KlaraAuftragsnotiz } from "./klara-auftragsnotiz-typen";
import type { WissensZiel } from "./klara-wissensziel";

export const KLARA_AKTIONEN = [
  "oeffnen",
  "entwurf_erstellen",
  "entwurf_bearbeiten",
  "aufgabe_bearbeiten",
  "persoenliche_aufgabe_anlegen",
  "erinnerung_anlegen",
  "wissen_uebernehmen",
] as const;

export type KlaraAktion = (typeof KLARA_AKTIONEN)[number];

export const KLARA_ZIELARTEN = [
  "wissensobjekt",
  "entwurf",
  "aufgabe",
  "neuer_entwurf",
  "neuer_wissensbeitrag",
  "neue_persoenliche_aufgabe",
  "persoenliche_aufgabe",
] as const;

export type KlaraZielArt = (typeof KLARA_ZIELARTEN)[number];

/** Ein Ziel, wie die Person es auf dem Bildschirm gewählt hat. `neuer_entwurf` hat noch keine Kennung. */
export interface KlaraAuftragZiel {
  readonly art: KlaraZielArt;
  readonly id: string | null;
  readonly titel: string;
  /** Der beim Planen gesehene Stand (Fassung bzw. Änderungszeit) — Anzeige, keine Erlaubnis. */
  readonly stand: string | null;
  /** Wo das Ziel in der Anwendung steht (interner Pfad), sofern es schon eines gibt. */
  readonly pfad: string | null;
}

export type KlaraAenderung =
  | { readonly art: "ergaenzen"; readonly text: string }
  | { readonly art: "umbenennen"; readonly titel: string };

/**
 * Nacharbeit 4 (Ben): was Klara an einer verfügbaren Aufgabe TUT — jeweils eine vorhandene Aktion
 * ihres Fachwegs. Lücke: Priorität setzen (`PUT /api/gaps/:id`) oder zuweisen (ebenda, `expertId`);
 * Konflikt: eskalieren (`POST /api/conflicts/:id/escalate`). `nur_oeffnen`: ausdrücklich nur öffnen.
 * Fehlt die Angabe, klärt Klara sie VOR dem Auftrag; ohne sie wird kein Plan angenommen.
 */
export type KlaraAufgabenaktion =
  | { readonly art: "nur_oeffnen" }
  | { readonly art: "prioritaet"; readonly wert: "hoch" | "mittel" | "niedrig" }
  | { readonly art: "zuweisen"; readonly personId: string; readonly personName: string }
  | { readonly art: "eskalieren" };

export interface KlaraWissensAuftragsbindung {
  readonly notizId: string;
  readonly fassung: number;
  readonly ziel: WissensZiel;
  readonly stempel: string;
  readonly bewusst: true;
}

export interface KlaraPlanSchritt {
  /** Interner Anfrageentwurf bezieht sich auf das echte Anforderungsergebnis. */
  readonly anforderungAusSchritt?: number;
  readonly wissen?: KlaraWissensAuftragsbindung;
  readonly notizQuelle?: KlaraAuftragsnotiz;
  readonly nr: number;
  readonly aktion: KlaraAktion;
  readonly ziel: KlaraAuftragZiel | null;
  readonly ausSchritt: number | null;
  readonly inhalt: string | null;
  readonly aenderung: KlaraAenderung | null;
  /** Nacharbeit 4: nur bei `aufgabe_bearbeiten` — die geklärte Aktion an der Aufgabe. */
  readonly aufgabenaktion?: KlaraAufgabenaktion | null;
  /**
   * BPA-06: nur bei `entwurf_erstellen` — Ordnungsfelder, die der neue Entwurf STRUKTURIERT
   * bekommt (nicht als Text). Nach dem Anlegen wird jedes Feld einzeln nachgelesen.
   */
  readonly felder?: KlaraEntwurfsfelder;
  /**
   * BPA-06 Nacharbeit 45: nur bei `entwurf_erstellen` — der VOLLTEXT des neuen Entwurfs (Klartext,
   * Absätze durch Zeilenumbruch). Er wird wie beim Word-Ganzdokumentweg als Körper (`bodyHtml`)
   * gespeichert, die Kernaussage bleibt ein Satz (`kernaussageAusKlartext`). Nachgelesen wird er.
   */
  readonly koerper?: string;
  /**
   * EQF-06-K02: nur bei `entwurf_erstellen` — Wissensobjekte, aus denen der Entwurf entsteht, in
   * ihrer Reihenfolge. Die Ausführung liest jedes JETZT über den vorhandenen Leseweg (Rechte der
   * Person, aktuelle Fassung) und übernimmt Titel, Fassung, Ort und Kernaussage in den Körper.
   */
  readonly quellen?: readonly string[];
  readonly erinnerung?: {
    readonly datum: string;
    readonly uhrzeit: string;
    readonly zeitzone: string;
  };
}

/** BPA-06: die Ordnungsfelder eines neuen Entwurfs, die der Aktionskern setzen kann. */
export const KLARA_ENTWURFSFELDER = ["type", "category", "confidentiality", "domain"] as const;

export type KlaraEntwurfsfeld = (typeof KLARA_ENTWURFSFELDER)[number];

export type KlaraEntwurfsfelder = Readonly<Partial<Record<KlaraEntwurfsfeld, string>>>;

export type KlaraAuftragGrund =
  | "eingabe"
  | "auftrag_unbekannt"
  | "abgebrochen"
  | "abgeschlossen"
  | "fassung_veraltet"
  | "ausserhalb_auftrag"
  | "erweiterung"
  | "uebergang"
  | "schluessel_belegt"
  | "voll"
  | "nur_server"
  | "nicht_geprueft"
  | "ohne_plan"
  | "geaendert"
  | "nicht_ruecknehmbar"
  | "ziel_fehlt"
  | "herkunft_gesperrt"
  | "unterbrochen"
  | "quelle_geaendert"
  | "quelle_unbekannt";

export class KlaraAuftragFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: KlaraAuftragGrund,
    message: string,
  ) {
    super(message);
    this.name = "KlaraAuftragFehler";
  }
}
