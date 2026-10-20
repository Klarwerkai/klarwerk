// produkt:20261011:peter-p06 — der Drahtvertrag von Vormachen und persönlicher Routine (Spiegel von
// `services/app/src/routes/vormachen-routes.ts`). Das Konto bestimmt allein die Sitzung; der Client
// schickt nie eine Kontokennung mit.
import { ApiError, api } from "./client";

export type VormachenHost = "word" | "klarwerk_web";
export type VormachenAbbruchRegel = "alles_verwerfen" | "lernnotiz_behalten";
export type LernZustand = "lernt" | "pausiert" | "abgebrochen";

export interface NichtAufgenommen {
  host: number;
  vorgang: number;
  pausiert: number;
  unsichtbar: number;
}

export interface LernnotizSchritt {
  nr: number;
  vorgang: string;
  beschreibung: string;
  korrigiert: boolean;
  entfernt: boolean;
}

export interface Lernsitzung {
  id: string;
  host: VormachenHost;
  vorgaenge: string[];
  zweck: string;
  abbruchRegel: VormachenAbbruchRegel;
  zustand: LernZustand;
  beobachtet: number;
  rohwerte: number;
  nichtAufgenommen: NichtAufgenommen;
  lernnotiz: { zweck: string; host: VormachenHost; schritte: LernnotizSchritt[] };
  angelegtAm: string;
  verfallAm: string;
}

export interface VorschauSchritt {
  nr: number;
  vorgang: string;
  beschreibung: string;
  aussenwirkung: boolean;
  beleg: number;
  korrigiert: boolean;
}

export interface Vorschau {
  sitzungId: string;
  host: VormachenHost;
  zweck: string;
  modus: "ergebnis_zur_pruefung";
  schritte: VorschauSchritt[];
  beobachtet: number;
  entfernt: number;
  nichtAufgenommen: NichtAufgenommen;
  /** BPA-06: mit zwei oder mehr Vorführungen die Ableitung samt Erklärung — Teil des Stands. */
  ableitung?: RoutinenAbleitung & { erklaerung: { ueberschrift: string; zeilen: string[] }[] };
  stand: string;
}

/** Eine Beobachtung korrigieren — oder (BPA-06) einen Schritt der Ableitung herausnehmen. */
export type KorrekturEingabe =
  | { nr: number; beschreibung?: string; entfernen?: boolean }
  | { ableitung: { art: "schritt_entfernen"; nr: number } }
  | { ableitung: KorrekturSatz };

/** EQF-06-K03: eine Korrektur in eigenen Worten zu Schritt `nr` — oder die gewählte Bedeutung. */
export interface KorrekturSatz {
  nr: number;
  satz: string;
  bedeutung?: KorrekturBedeutung;
}

export type KorrekturBedeutung = "einmaligkeit" | "regel" | "entscheidungspunkt";

/** EQF-06-K03: Quelle einer Korrektur — Bedeutung, Worte der Person, Zeitpunkt, Schritt. */
export interface KorrekturQuelle {
  bedeutung: KorrekturBedeutung;
  wortlaut: string;
  am: string;
  schritt: string;
  nr: number;
}

/** EQF-06-K10: ein Eintrag des Fassungsverlaufs einer Routine. */
export interface RoutinenFassung {
  fassung: number;
  am: string;
  art: string;
  quelle: KorrekturQuelle | null;
}

/** EQF-06-K03: die Rückfrage, wenn die Bedeutung einer Korrektur offen ist. */
export interface KorrekturKlaerung {
  grund: "unklar" | "nicht_moeglich" | "eingabe";
  nr: number;
  optionen: KorrekturBedeutung[];
}

/** Die Rückfrage aus einem Fehler des Korrekturwegs (422 `klaerung`) — sonst `null`. */
export function korrekturKlaerung(fehler: unknown): KorrekturKlaerung | null {
  if (!(fehler instanceof ApiError) || fehler.status !== 422) {
    return null;
  }
  const k = fehler.details.klaerung as KorrekturKlaerung | undefined;
  return k && Array.isArray(k.optionen) ? k : null;
}

export interface RoutineSchritt {
  id: string;
  nr: number;
  vorgang: string;
  beschreibung: string;
  aussenwirkung: boolean;
}

export interface Routine {
  id: string;
  titel: string;
  zweck: string;
  host: VormachenHost;
  modus: "ergebnis_zur_pruefung";
  fassung: number;
  schritte: RoutineSchritt[];
  herkunft: { sitzungId: string; stand: string; beobachtet: number; korrigiert: number };
  bestaetigtAm: string;
  firmenuebergabe: { entwurfId: string; am: string } | null;
  /** BPA-06: Zustand der Routine — pausiert läuft sie nicht. */
  zustand?: RoutinenZustand;
  /** BPA-06: Zeitplanangabe; fällige Läufe führt die vorhandene Zeitsteuerung des Servers aus. */
  zeitplan?: RoutinenZeitplan | null;
  /** BPA-06: aus mehreren Vorführungen abgeleitet — die Eingaben jedes Laufs und die Schritte. */
  ableitung?: RoutinenAbleitung | null;
  /** BPA-06 Nacharbeit 41: nur Word — Programm und Hostfassung, an die die Routine gebunden ist. */
  hostbindung?: { programm: string; hostVersion: string; am: string } | null;
  /** EQF-06-K10: Fassungsverlauf nach Korrekturen. */
  versionen?: RoutinenFassung[];
  /** EQF-06-K06: die Übergabeart; fehlt sie, läuft die Routine selbstständig. */
  ausfuehrung?: Ausfuehrungsmodus;
}

/** EQF-06-K06: selbstständig, Ergebnis zur Prüfung oder gemeinsam schrittweise. */
export const AUSFUEHRUNGSMODI = ["selbststaendig", "zur_pruefung", "schrittweise"] as const;
export type Ausfuehrungsmodus = (typeof AUSFUEHRUNGSMODI)[number];

export interface RoutinenParameter {
  name: string;
  beschriftung: string;
  art: "text" | "empfaenger" | "datum" | "zahl";
}

export interface RoutinenAbleitung {
  vorfuehrungen: number;
  parameter: RoutinenParameter[];
  schritte: { nr: number; art: string; frage?: string; ziel?: { name: string } }[];
  /** EQF-06-K03: Korrekturen der Person mit Quelle. */
  korrekturen?: KorrekturQuelle[];
}

export type RoutinenZustand = "aktiv" | "pausiert";

export type RoutinenZeitplan =
  | { art: "sofort" }
  | { art: "ab_datum"; start: string; zeitzone: string }
  | {
      art: "woechentlich";
      wochentag: number;
      uhrzeit: string;
      ab?: string;
      zeitzone: string;
      nachholen: "einmal_nachholen" | "auslassen";
    }
  // EQF-06-K05: bei einem eigenen Ereignis — gewählt (`ereignis`) oder in Worten (`beschreibung`),
  // die der Server nur bei eindeutiger Bedeutung übernimmt, sonst fragt er nach.
  | { art: "bei_ereignis"; ereignis?: RoutinenEreignis; beschreibung?: string };

export type RoutinenEreignis = "wissen_angelegt" | "wissen_ueberarbeitet";

/** EQF-06-K05: die Rückfrage des Servers (422), wenn das Ereignis nicht eindeutig ist. */
export interface EreignisKlaerung {
  message: string;
  optionen: { ereignis: RoutinenEreignis; text: string }[];
}

export function ereignisKlaerung(fehler: unknown): EreignisKlaerung | null {
  if (!(fehler instanceof ApiError) || fehler.status !== 422) {
    return null;
  }
  const optionen = fehler.details.optionen as EreignisKlaerung["optionen"] | undefined;
  return Array.isArray(optionen) ? { message: fehler.message, optionen } : null;
}

/** BPA-06: der Lauf einer Routine mit den Eingaben dieses Laufs. */
export interface RoutinenLaufEingabe {
  /** Das eigene Klara-Gespräch, in dem der Auftrag angelegt wird. */
  gespraech: string;
  /** Kennung dieses Laufs — eine Wiederholung mit derselben Kennung legt nichts doppelt an. */
  lauf: string;
  fassung: number;
  /** Titel und Kernaussage; bei abgeleiteten Routinen zusätzlich deren weitere Eingaben. */
  eingaben: { titel: string; inhalt: string } & Record<string, string>;
}

/** Antwort des Laufs: der gebundene Auftrag des Aktionskerns (Klara 05). */
export interface RoutinenLaufAntwort {
  auftrag: {
    id: string;
    fassung: number;
    geplanteSchritte: number;
    /** EQF-06-K06: die Planschritte des Aktionskerns (Anlegen; je nach Art danach Öffnen). */
    plan?: { nr: number; aktion: string; ausSchritt: number | null }[];
  };
  wiederholt: boolean;
}

export interface VormachenKatalog {
  hosts: VormachenHost[];
  /** Hosts, die den Lernzustand sichtbar anzeigen — nur sie sind startbar. */
  hostsMitAnzeige: VormachenHost[];
  sichtbarGueltigSekunden: number;
  vorgaenge: Record<
    string,
    { host: VormachenHost; aussenwirkung: boolean; quelle: "server" | "client" }
  >;
  abbruchRegeln: VormachenAbbruchRegel[];
  rohdatenFristStunden: number;
  bestaetigungGueltigSekunden: number;
}

export interface VormachenUebersicht {
  sitzungen: Lernsitzung[];
  routinen: Routine[];
  /** Ob die Sichtbarkeitsmeldung dieses Abrufs angenommen wurde. */
  sichtbar: boolean;
  katalog: VormachenKatalog;
}

export interface Freigabe {
  art: "ergebnis_zur_pruefung" | "aussenaktion_bestaetigt";
  schritt: RoutineSchritt;
  ausfuehrung?: string;
}

/** Eine angeforderte Ausführung genau eines Außenschritts (nur einmal bestätigbar). */
export interface Ausfuehrung {
  id: string;
  routineId: string;
  schrittId: string;
  fassung: number;
  gueltigBis: string;
}

const PFAD = "/me/vormachen";
const sitzung = (id: string) => `${PFAD}/${encodeURIComponent(id)}`;

/** BPA-06 AC01: die Rückfrage des Servers zu einem natürlichen Lernauftrag. */
export interface LernauftragKlaerung {
  art: "kein_lernauftrag" | "anwendung_nicht_freigegeben" | "anwendung_unklar" | "vorgang_unklar";
  frage: string;
  optionen: { beschriftung: string; host: VormachenHost; vorgaenge: string[] }[];
}

/** Die Klärung aus einer abgewiesenen Lernauftragsanfrage — `null`, wenn es keine ist. */
export function lernauftragKlaerung(fehler: unknown): LernauftragKlaerung | null {
  if (!(fehler instanceof ApiError) || fehler.status !== 422) {
    return null;
  }
  const k = fehler.details.klaerung as LernauftragKlaerung | undefined;
  return k && typeof k.frage === "string" ? k : null;
}

export const vormachenApi = {
  /**
   * Die eigene Übersicht. Mit `anzeige` meldet die sichtbare Lernanzeige dieses Clients zugleich,
   * dass der Lernzustand hier gerade angezeigt wird — nur dann schreibt der Server hier mit.
   */
  uebersicht: (anzeige?: VormachenHost): Promise<VormachenUebersicht> =>
    api.get<VormachenUebersicht>(anzeige ? `${PFAD}?anzeige=${anzeige}` : PFAD),
  starte: (eingabe: {
    host: VormachenHost;
    vorgaenge: string[];
    zweck: string;
    abbruchRegel: VormachenAbbruchRegel;
  }): Promise<{ sitzung: Lernsitzung }> => api.post(PFAD, eingabe),
  /**
   * BPA-06 AC01: Lernen aus einem natürlichen Lernauftrag. Der Server bestimmt Anwendung und
   * Vorgänge; braucht er eine Klärung, antwortet er 422 mit `klaerung` (`lernauftragKlaerung`).
   * `wahl`: die in der Rückfrage gewählte Option.
   */
  starteAusLernauftrag: (
    auftrag: string,
    wahl?: { host: VormachenHost; vorgaenge: readonly string[] },
  ): Promise<{ sitzung: Lernsitzung }> => api.post(PFAD, { auftrag, ...(wahl ?? {}) }),
  beobachte: (
    id: string,
    eingabe: { host: VormachenHost; vorgang: string; beschreibung: string; rohwert?: string },
  ): Promise<{ nr: number }> => api.post(`${sitzung(id)}/beobachtungen`, eingabe),
  setzeZustand: (id: string, zustand: "lernt" | "pausiert"): Promise<{ sitzung: Lernsitzung }> =>
    api.put(`${sitzung(id)}/zustand`, { zustand }),
  vorschau: (id: string): Promise<{ vorschau: Vorschau }> => api.get(`${sitzung(id)}/vorschau`),
  korrigiere: (id: string, eingabe: KorrekturEingabe): Promise<{ vorschau: Vorschau }> =>
    api.put(`${sitzung(id)}/korrektur`, eingabe),
  bestaetige: (id: string, stand: string): Promise<{ routine: Routine }> =>
    api.post(`${sitzung(id)}/bestaetigung`, { stand }),
  brecheAb: (id: string): Promise<{ regel: VormachenAbbruchRegel; notizBehalten: boolean }> =>
    api.post(`${sitzung(id)}/abbruch`),
  verwerfeNotiz: (id: string): Promise<{ geloescht: number }> => api.del(sitzung(id)),
  /**
   * Gibt einen Schritt frei. Für einen Außenschritt zuerst OHNE `ausfuehrung` aufrufen: der Server
   * antwortet 409 und nennt in `details.ausfuehrung` die angeforderte Ausführung (`Ausfuehrung`);
   * deren Kennung bestätigt dann genau diese eine Ausführung.
   */
  gibFrei: (
    routine: Routine,
    schritt: RoutineSchritt,
    ausfuehrung?: string,
  ): Promise<{ freigabe: Freigabe }> =>
    api.post(
      `${PFAD}/routinen/${encodeURIComponent(routine.id)}/schritte/${encodeURIComponent(schritt.id)}/freigabe`,
      ausfuehrung === undefined ? {} : { bestaetigung: { ausfuehrung } },
    ),
  uebergib: (routineId: string): Promise<{ routine: Routine; neu: boolean }> =>
    api.post(`${PFAD}/routinen/${encodeURIComponent(routineId)}/firmenuebergabe`),
  /**
   * BPA-06: die Routine laufen lassen. Der Server prüft Zustand, Fassung, Eingaben und Recht und legt
   * einen gebundenen Klara-Auftrag an; ausgeführt wird er über `klaraAuftragApi.fuehreAus`.
   */
  laufe: (routineId: string, eingabe: RoutinenLaufEingabe): Promise<RoutinenLaufAntwort> =>
    api.post(`${PFAD}/routinen/${encodeURIComponent(routineId)}/lauf`, eingabe),
  /** EQF-06-K10: Korrektur einer bestätigten Routine — die nächste Fassung mit Quelle. */
  korrigiereRoutine: (
    routineId: string,
    fassung: number,
    korrektur: KorrekturSatz,
  ): Promise<{ routine: Pick<Routine, "id" | "fassung">; korrektur: KorrekturQuelle | null }> =>
    api.post(`${PFAD}/routinen/${encodeURIComponent(routineId)}/korrektur`, {
      fassung,
      ableitung: korrektur,
    }),
  setzeRoutinenZustand: (
    routineId: string,
    zustand: RoutinenZustand,
  ): Promise<{ routine: Pick<Routine, "id" | "fassung" | "zustand" | "zeitplan"> }> =>
    api.put(`${PFAD}/routinen/${encodeURIComponent(routineId)}/zustand`, { zustand }),
  /** EQF-06-K06: die Übergabeart der eigenen Routine. */
  setzeAusfuehrung: (
    routineId: string,
    ausfuehrung: Ausfuehrungsmodus,
  ): Promise<{ routine: Pick<Routine, "id" | "fassung" | "ausfuehrung"> }> =>
    api.put(`${PFAD}/routinen/${encodeURIComponent(routineId)}/ausfuehrung`, { ausfuehrung }),
  /** AC05: mit Zeitplan auch die Eingaben, mit denen die Zeitsteuerung fällige Läufe anlegt. */
  setzeZeitplan: (
    routineId: string,
    zeitplan: RoutinenZeitplan | null,
    eingaben: Record<string, string> = {},
  ): Promise<{ routine: Pick<Routine, "id" | "fassung" | "zustand" | "zeitplan"> }> =>
    api.put(`${PFAD}/routinen/${encodeURIComponent(routineId)}/zeitplan`, { zeitplan, eingaben }),
  privatLoeschen: (): Promise<{ geloescht: { sitzungen: number; routinen: number } }> =>
    api.del(PFAD),
};
