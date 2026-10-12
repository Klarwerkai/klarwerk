// produkt:20261011:assistenz-ki-arbeitsbegleitung (BPA-13) — der Drahtvertrag des KI-Arbeitswegs
// am eigenen Klara-Gespräch (Spiegel von `services/app/src/routes/ki-arbeitsbegleitung-routes.ts`).
// Entscheidungen — Rechte, Freigaben, Anbieter, Paketprüfung — fallen ausschliesslich am Server.
import { api } from "./client";

export type KiFaehigkeit = "prompt_manuell" | "api" | "browser_begleitung" | "codex_auftrag";
export type KiErgebnisformat = "stichpunkte" | "fliesstext" | "tabelle" | "code_aenderung";

export interface KiFaehigkeitsanzeige {
  faehigkeit: KiFaehigkeit;
  status: "verfuegbar" | "verbunden" | "ungeprueft" | "nur_simulation" | "nicht_eingerichtet";
  anbieter: string | null;
  version: string | null;
  text: string;
}

export interface KiFaehigkeiten {
  faehigkeiten: KiFaehigkeitsanzeige[];
  fremdeChatsteuerung: "nicht_vorhanden";
  mcpText: string;
  lage: {
    keineKi: boolean;
    oeffentlicheKiFreigegeben: boolean;
    vertraulichFreigegeben: boolean;
    erlaubteAnbieter: string[];
  };
}

export interface KiJob {
  jobId: string;
  paketId: string;
  anbieter: string;
  faehigkeit: KiFaehigkeit;
  status:
    | "vorbereitet"
    | "gesendet"
    | "unterbrochen"
    | "antwort_erhalten"
    | "fehler"
    | "gestoppt"
    | "ersetzt";
  sendungen: number;
  offenePunkte: string[];
  teilergebnis?: string;
  fehler?: string;
  ersetztDurch?: string;
}

export interface KiAuftragSicht {
  job: KiJob;
  auftrag: { ziel: string; ergebnisformat: KiErgebnisformat; offenePunkte: string[] };
  quellen: string[];
  freigegebeneQuellen: string[];
  geschlosseneQuellen: string[];
  paketId: string;
  quellenstand: { quelleId: string; fassung: string; abschnittIds: string[] }[];
  ausgelassen: { quelleId: string; titel: string; grund: string; abschnittId?: string }[];
  paketAktuell: boolean;
  paketGruende: { quelleId: string; grund: string }[];
  prompt: string | null;
  /** Sperrsatz des aktuellen Wegs (z. B. „Keine KI“) — `null`, solange der Weg offen ist. */
  wegGesperrt: string | null;
  /** Eine Quelle ist entzogen: Antworttexte und Teilergebnis werden nicht ausgeliefert. */
  inhalteZurueckgehalten: boolean;
  antworten: {
    am: string;
    inhalt: string | null;
    anbieter: string;
    modell: string | null;
    weg: "api" | "manuell";
    anwendbar: boolean;
    hinweis: string | null;
  }[];
  belege: {
    am: string;
    klasse: "promptentwurf" | "manuelle_uebergabe" | "simulation" | "realer_adapterlauf";
    text: string;
  }[];
  codexWirkungen: {
    am: string;
    geschrieben: { pfad: string; art: string; bytes: number; sha256: string }[];
    abgelehnt: { pfad: string; grund: string }[];
    abgelehnteAktionen: string[];
  }[];
}

export interface KiAuftragEingabe {
  ziel: string;
  ergebnisformat: KiErgebnisformat;
  offenePunkte: string[];
  anbieter: string;
  faehigkeit: KiFaehigkeit;
  quellen: string[];
  freigegebeneQuellen: string[];
}

const G = "/me/klara/gespraeche";
const j = (gid: string, jobId: string) =>
  `${G}/${encodeURIComponent(gid)}/ki-auftraege/${encodeURIComponent(jobId)}`;

export const kiArbeitswegApi = {
  faehigkeiten: () => api.get<KiFaehigkeiten>("/me/klara/ki-faehigkeiten"),
  liste: (gid: string) =>
    api.get<{ auftraege: KiAuftragSicht[] }>(`${G}/${encodeURIComponent(gid)}/ki-auftraege`),
  bereite: (gid: string, eingabe: KiAuftragEingabe) =>
    api.post<{ auftrag: KiAuftragSicht }>(`${G}/${encodeURIComponent(gid)}/ki-auftraege`, eingabe),
  uebergib: (gid: string, jobId: string, erneutSendenBestaetigt = false) =>
    api.post<{ sicht: KiAuftragSicht; gesendet: boolean; text: string; prompt: string | null }>(
      `${j(gid, jobId)}/uebergabe`,
      { erneutSendenBestaetigt },
    ),
  ergebnis: (gid: string, jobId: string, inhalt: string, anbieter: string) =>
    api.post<{ auftrag: KiAuftragSicht }>(`${j(gid, jobId)}/ergebnis`, { inhalt, anbieter }),
  unterbrich: (gid: string, jobId: string) =>
    api.post<{ auftrag: KiAuftragSicht }>(`${j(gid, jobId)}/unterbrechen`, {}),
  stoppe: (gid: string, jobId: string) =>
    api.post<{ auftrag: KiAuftragSicht; text: string }>(`${j(gid, jobId)}/stopp`, {}),
  schliesseFreigabe: (gid: string, jobId: string, quelleId: string) =>
    api.post<{ auftrag: KiAuftragSicht }>(`${j(gid, jobId)}/freigabe-schliessen`, { quelleId }),
  bindeNeu: (gid: string, jobId: string) =>
    api.post<{ auftrag: KiAuftragSicht }>(`${j(gid, jobId)}/neu-binden`, {}),
};
