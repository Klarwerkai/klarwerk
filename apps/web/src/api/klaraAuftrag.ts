// produkt:20261008:klara-aktionen (Klara 05) — der Drahtvertrag der Ausführungsaufträge im eigenen
// Klara-Gespräch (Spiegel von `services/app/src/klara-auftrag.ts` und der Auftragstüren in
// `routes/klara-gespraech-routes.ts`). Die Grenze steht am Server; ausgeführt wird über die
// vorhandenen Produktwege (`endpoints.drafts`, `endpoints.ko`), die ihre Rechte selbst prüfen.
import { api } from "./client";

// produkt:20261008:klara-aufgaben (Klara 07): `persoenliche_aufgabe_anlegen` mit dem Ziel
// `neue_persoenliche_aufgabe` und dem Ergebnis `persoenliche_aufgabe` (`/api/me/klara/aufgaben`).
export type KlaraAktion =
  | "oeffnen"
  | "entwurf_erstellen"
  | "entwurf_bearbeiten"
  | "aufgabe_bearbeiten"
  | "persoenliche_aufgabe_anlegen"
  | "erinnerung_anlegen";
export type KlaraZielArt =
  | "wissensobjekt"
  | "entwurf"
  | "aufgabe"
  | "neuer_entwurf"
  | "neue_persoenliche_aufgabe"
  | "persoenliche_aufgabe";
export type KlaraAuftragsQuelle = "getippt" | "gesprochen";

export type KlaraAuftragStand =
  | "vorgeschlagen"
  | "laeuft"
  | "abgeschlossen"
  | "teilweise"
  | "fehlgeschlagen"
  | "abgebrochen";

export type KlaraSchrittStand =
  | "begonnen"
  | "gespeichert"
  | "abgeschlossen"
  | "fehlgeschlagen"
  | "zurueckgenommen";

export interface KlaraAuftragZiel {
  art: KlaraZielArt;
  id: string | null;
  titel: string;
  stand: string | null;
  pfad: string | null;
}

export interface KlaraAuftragErgebnis {
  art: "wissensobjekt" | "entwurf" | "aufgabe" | "persoenliche_aufgabe" | "erinnerung";
  id: string;
  titel: string;
  stand: string | null;
  pfad: string;
}

export interface KlaraAuftragSchritt {
  schluessel: string;
  nr: number;
  aktion: KlaraAktion;
  ziel: KlaraAuftragZiel;
  auftragFassung: number;
  stand: KlaraSchrittStand;
  ergebnis: KlaraAuftragErgebnis | null;
  ruecknehmbar: boolean;
  grund: string | null;
  /** Nacharbeit 2: Grundschlüssel eines am Server gescheiterten Schritts. */
  fehlerCode?: string | null;
  /** Nacharbeit 2: das am Server bestätigte Ziel eines Öffnens. */
  geprueft?: KlaraAuftragErgebnis | null;
  ausgangUnklar?: boolean;
  /** Nacharbeit 4: bestätigte Schreibwirkung, deren Nachlesen noch aussteht (Schritt ungeklärt). */
  schreibwirkung?: {
    art: "entwurf" | "aufgabe" | "persoenliche_aufgabe" | "erinnerung";
    id: string;
    pfad: string;
    /** Nacharbeit 5: der vom Schreibweg bestätigte eigene Stand (`null`: keiner bestätigt). */
    stand?: string | null;
  } | null;
  /** PV-02: Stand des Ziels vor der Wirkung bzw. nach der Rücknahme (vom Server gelesen). */
  vorherStand?: string | null;
  ruecknahmeStand?: string | null;
  /** PV-02-03: Felder eines Entwurfs vor bzw. nach der Wirkung — nur im eigenen Gespräch. */
  vorher?: { title: string; statement: string } | null;
  nachher?: { title: string; statement: string } | null;
  /** PV-02: Aktionskennung (= Vorgangsschlüssel), Vertrag und was eine Rücknahme jetzt hindert. */
  aktionskennung?: string;
  vertrag?: KlaraVertragsSchluessel;
  ruecknahmeHinderung?: KlaraRuecknahmeHinderung | null;
  begonnenAm: string;
  geaendertAm: string;
}

export type KlaraRuecknahmeHinderung =
  | "nicht_ruecknehmbar"
  | "fremdstand"
  | "nicht_gespeichert"
  | "zurueckgenommen";

/** PV-02-01: Spiegel von `KlaraVertragsSchluessel` in `services/app/src/klara-aktionsverlauf.ts`. */
export type KlaraVertragsSchluessel =
  | "oeffnen"
  | "entwurf_erstellen"
  | "entwurf_bearbeiten"
  | "aufgabe_oeffnen"
  | "aufgabe_prioritaet"
  | "aufgabe_zuweisen"
  | "aufgabe_eskalieren"
  | "persoenliche_aufgabe_anlegen"
  | "erinnerung_anlegen";

/** PV-02-02: Spiegel von `KlaraErgebnisstand` — dazu `entwurf`, solange der Plan nur hier steht. */
export type KlaraErgebnisstand =
  | "entwurf"
  | "vorschlag"
  | "laeuft"
  | "unklar"
  | "ausgefuehrt"
  | "teilweise"
  | "fehlgeschlagen"
  | "zurueckgenommen"
  | "teilweise_zurueckgenommen"
  | "abgebrochen";

/** PV-02-03: ein Eintrag der vorhandenen Prüfprotokollkette zu einem eigenen Auftrag. */
export interface KlaraProtokollEintrag {
  seq: number;
  at: string;
  action: string;
  payload: Record<string, unknown>;
}

/** Nacharbeit 2: ein Schritt des gebundenen Plans — der Server führt nur aus, was hier steht. */
export interface KlaraAuftragsnotiz {
  id: string;
  fassung: number;
  titel?: string;
  gespraechId?: string;
  nachrichtId?: string;
}

export interface KlaraPlanSchritt {
  notizQuelle?: KlaraAuftragsnotiz;
  aktion: KlaraAktion;
  ziel: KlaraAuftragZiel | null;
  ausSchritt: number | null;
  nr?: number;
  inhalt?: string | null;
  aenderung?: { art: "ergaenzen"; text: string } | { art: "umbenennen"; titel: string } | null;
  /** Nacharbeit 4: bei `aufgabe_bearbeiten` die geklärte Aktion (Pflicht). */
  aufgabenaktion?: KlaraAufgabenaktion | null;
  erinnerung?: { datum: string; uhrzeit: string; zeitzone: string };
}

/** Nacharbeit 4: Spiegel von `KlaraAufgabenaktion` in `services/app/src/klara-auftrag.ts`. */
export type KlaraAufgabenaktion =
  | { art: "nur_oeffnen" }
  | { art: "prioritaet"; wert: "hoch" | "mittel" | "niedrig" }
  | { art: "zuweisen"; personId: string; personName: string }
  | { art: "eskalieren" };

export interface KlaraAuftragGrenze {
  plan?: KlaraPlanSchritt[];
  fassung: number;
  erlaubteAktionen: KlaraAktion[];
  erlaubteZiele: KlaraAuftragZiel[];
  erlaubteQuellen: string[];
  ergebnis: string;
  geplanteSchritte: number;
  grund: string | null;
  am: string;
}

export type KlaraAuftragEreignis =
  | "vorgeschlagen"
  | "begonnen"
  | "gespeichert"
  | "abgeschlossen"
  | "fehlgeschlagen"
  | "zurueckgenommen"
  | "abgebrochen"
  | "korrigiert"
  | "auftrag_abgeschlossen"
  | "unterbrochen"
  | "fortgesetzt";

export interface KlaraAuftrag extends KlaraAuftragGrenze {
  id: string;
  quelle: KlaraAuftragsQuelle;
  wortlaut: string;
  ziel: string;
  verantwortlich: string;
  stand: KlaraAuftragStand;
  /** PV-02-02: abgeleitet am Server aus den festgehaltenen Schritten. */
  ergebnisstand?: Exclude<KlaraErgebnisstand, "entwurf">;
  abgebrochenAm: string | null;
  unterbrochenAm?: string | null;
  plan?: KlaraPlanSchritt[];
  schritte: KlaraAuftragSchritt[];
  fassungen: KlaraAuftragGrenze[];
  verlauf: { ereignis: KlaraAuftragEreignis; am: string; nr: number | null; fassung: number }[];
  angelegtAm: string;
  geaendertAm: string;
}

export interface KlaraAuftragEingabe {
  quelle: KlaraAuftragsQuelle;
  wortlaut: string;
  ziel: string;
  erlaubteAktionen: KlaraAktion[];
  erlaubteZiele: KlaraAuftragZiel[];
  erlaubteQuellen: string[];
  ergebnis: string;
  geplanteSchritte: number;
  plan: KlaraPlanSchritt[];
}

export interface KlaraKorrekturEingabe {
  plan?: KlaraPlanSchritt[];
  auftragFassung?: number;
  erlaubteAktionen: KlaraAktion[];
  erlaubteZiele: KlaraAuftragZiel[];
  geplanteSchritte: number;
  grund: string;
}

export interface KlaraSchrittEingabe {
  nr: number;
  aktion: KlaraAktion;
  ziel: KlaraAuftragZiel;
  auftragFassung: number;
  stand: KlaraSchrittStand;
  ergebnis?: KlaraAuftragErgebnis;
  ruecknehmbar?: boolean;
  grund?: string;
}

const BASIS = "/me/klara/gespraeche";

function pfad(gespraechId: string, rest = ""): string {
  return `${BASIS}/${encodeURIComponent(gespraechId)}/auftraege${rest}`;
}

export const klaraAuftragApi = {
  unterbrechen: (gespraechId: string, auftragId: string, auftragFassung: number) =>
    api.post<{ auftrag: KlaraAuftrag }>(
      pfad(gespraechId, `/${encodeURIComponent(auftragId)}/unterbrechen`),
      { auftragFassung },
    ),
  fortsetzen: (gespraechId: string, auftragId: string, auftragFassung: number) =>
    api.post<{ auftrag: KlaraAuftrag }>(
      pfad(gespraechId, `/${encodeURIComponent(auftragId)}/fortsetzen`),
      { auftragFassung },
    ),

  liste: (gespraechId: string) => api.get<{ auftraege: KlaraAuftrag[] }>(pfad(gespraechId)),
  lege: (gespraechId: string, eingabe: KlaraAuftragEingabe) =>
    api.post<{ auftrag: KlaraAuftrag }>(pfad(gespraechId), eingabe),
  korrigiere: (gespraechId: string, auftragId: string, eingabe: KlaraKorrekturEingabe) =>
    api.post<{ auftrag: KlaraAuftrag }>(
      pfad(gespraechId, `/${encodeURIComponent(auftragId)}/fassungen`),
      eingabe,
    ),
  schritt: (
    gespraechId: string,
    auftragId: string,
    schluessel: string,
    eingabe: KlaraSchrittEingabe,
  ) =>
    api.put<{ auftrag: KlaraAuftrag; schritt: KlaraAuftragSchritt; wiederholt: boolean }>(
      pfad(
        gespraechId,
        `/${encodeURIComponent(auftragId)}/schritte/${encodeURIComponent(schluessel)}`,
      ),
      eingabe,
    ),
  /** Nacharbeit 2: der Server führt den Planschritt `nr` aus, liest nach und meldet den Stand. */
  fuehreAus: (
    gespraechId: string,
    auftragId: string,
    schluessel: string,
    eingabe: { nr: number; auftragFassung: number },
  ) =>
    api.post<{ auftrag: KlaraAuftrag; schritt: KlaraAuftragSchritt; wiederholt: boolean }>(
      pfad(
        gespraechId,
        `/${encodeURIComponent(auftragId)}/schritte/${encodeURIComponent(schluessel)}/ausfuehrung`,
      ),
      eingabe,
    ),
  /** Nacharbeit 2: Rückgängig am Server — mit Standvergleich am vorhandenen Weg. */
  nimmZurueck: (gespraechId: string, auftragId: string, schluessel: string) =>
    api.post<{ auftrag: KlaraAuftrag; schritt: KlaraAuftragSchritt; wiederholt: boolean }>(
      pfad(
        gespraechId,
        `/${encodeURIComponent(auftragId)}/schritte/${encodeURIComponent(schluessel)}/ruecknahme`,
      ),
      {},
    ),
  abbrechen: (gespraechId: string, auftragId: string) =>
    api.put<{ auftrag: KlaraAuftrag }>(
      pfad(gespraechId, `/${encodeURIComponent(auftragId)}/abbruch`),
      {},
    ),
  /** PV-02-03: die eigenen Einträge der vorhandenen Prüfprotokollkette zu diesem Auftrag. */
  protokoll: (gespraechId: string, auftragId: string) =>
    api.get<{ auftrag: string; aktionskennungen: string[]; eintraege: KlaraProtokollEintrag[] }>(
      pfad(gespraechId, `/${encodeURIComponent(auftragId)}/protokoll`),
    ),
};
