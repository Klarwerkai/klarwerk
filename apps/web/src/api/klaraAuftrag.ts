// produkt:20261008:klara-aktionen (Klara 05) — der Drahtvertrag der Ausführungsaufträge im eigenen
// Klara-Gespräch (Spiegel von `services/app/src/klara-auftrag.ts` und der Auftragstüren in
// `routes/klara-gespraech-routes.ts`). Die Grenze steht am Server; ausgeführt wird über die
// vorhandenen Produktwege (`endpoints.drafts`, `endpoints.ko`), die ihre Rechte selbst prüfen.
import { api } from "./client";

export type KlaraAktion =
  | "oeffnen"
  | "entwurf_erstellen"
  | "entwurf_bearbeiten"
  | "aufgabe_bearbeiten";
export type KlaraZielArt = "wissensobjekt" | "entwurf" | "aufgabe" | "neuer_entwurf";
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
  art: "wissensobjekt" | "entwurf" | "aufgabe";
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
  begonnenAm: string;
  geaendertAm: string;
}

export interface KlaraAuftragGrenze {
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
  | "auftrag_abgeschlossen";

export interface KlaraAuftrag extends KlaraAuftragGrenze {
  id: string;
  quelle: KlaraAuftragsQuelle;
  wortlaut: string;
  ziel: string;
  verantwortlich: string;
  stand: KlaraAuftragStand;
  abgebrochenAm: string | null;
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
}

export interface KlaraKorrekturEingabe {
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
  abbrechen: (gespraechId: string, auftragId: string) =>
    api.put<{ auftrag: KlaraAuftrag }>(
      pfad(gespraechId, `/${encodeURIComponent(auftragId)}/abbruch`),
      {},
    ),
};
