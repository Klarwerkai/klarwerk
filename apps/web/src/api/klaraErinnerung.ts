// produkt:20261007:klara-erinnerungen-kalender (Klara 10) — der Drahtvertrag der persönlichen
// Erinnerungen (Spiegel von `services/app/src/klara-erinnerung.ts` und
// `routes/klara-erinnerung-routes.ts`). Das Konto kommt am Server aus der Sitzung.
import { api } from "./client";
import type { KlaraObjektbezug } from "./klaraGespraech";

export type ErinnerungStatus = "aktiv" | "pausiert" | "erledigt" | "abgesagt" | "beendet";
export type ErinnerungLage =
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
export type VerpasstRegel = "nachholen" | "nur_melden" | "zusammenfassen" | "ueberspringen";
export type ZeitHinweis =
  | "luecke_verschoben"
  | "luecke_ausgelassen"
  | "doppelt_erste"
  | "doppelt_zweite";
export type ErinnerungTakt = "taeglich" | "woechentlich" | "monatlich";

export type ErinnerungZeitplan =
  | { art: "einmalig"; datum: string; uhrzeit: string }
  | {
      art: "serie";
      datum: string;
      uhrzeit: string;
      wiederholung: {
        takt: ErinnerungTakt;
        intervall: number;
        wochentage: number[];
        bis: string | null;
        anzahl: number | null;
      };
    }
  | { art: "frist"; fristDatum: string; vorlaufTage: number; uhrzeit: string };

export type ErinnerungBezug =
  | { art: "frei" }
  | { art: "gespraech"; gespraechId: string; nachrichtId: string; auszug: string }
  | { art: "notiz"; notizId: string; notizTitel: string }
  | { art: "aufgabe"; aufgabeId: string; aufgabeTitel: string };

/** Was die Oberfläche beim Anlegen als Bezug schickt — der Server liest Titel und Auszug selbst. */
export type ErinnerungBezugEingabe =
  | { art: "frei" }
  | { art: "gespraech"; gespraechId: string; nachrichtId: string }
  | { art: "notiz"; notizId: string }
  | { art: "aufgabe"; aufgabeId: string };

export interface ErinnerungZeitpunkt {
  vorkommenId: string;
  schluessel: string;
  zeitpunkt: string;
  datum: string;
  uhrzeit: string;
  versatz: string;
  hinweis: ZeitHinweis | null;
  verschoben: boolean;
}

export interface ErinnerungAnzeige {
  naechste: ErinnerungZeitpunkt | null;
  kommende: ErinnerungZeitpunkt[];
  serienende:
    | { art: "einmalig" }
    | { art: "datum"; bis: string }
    | { art: "anzahl"; anzahl: number }
    | { art: "offen"; hoechstens: number };
  frist: { datum: string; vorlaufTage: number } | null;
  sommerzeitHinweise: ErinnerungZeitpunkt[];
  ziel: "glocke";
  erwartetesErgebnis:
    | "meldung"
    | "meldung_mit_aufgabenpruefung"
    | "meldung_mit_zusammenfassung"
    | "bericht_in_notizen";
}

export type ErinnerungAktion =
  | "erinnern"
  | "aufgabe_pruefen"
  | "inhalt_zusammenfassen"
  | "routine_bericht";

/** EQF-07: Abschnitte eines Routinenberichts. */
export type RoutineAbschnitt = "offene_aufgaben" | "erledigte_aufgaben" | "neue_notizen";

/** EQF-07: die versionierte Routinendefinition (Spiegel von `klara-routine.ts`). */
export interface ErinnerungRoutine {
  fassung: number;
  abschnitte: RoutineAbschnitt[];
  notizIds: string[];
  ziel: "meine_notizen";
  wirkungen: "bericht_erstellen"[];
  modus: "automatisch";
}

/** EQF-07: das tatsächliche Ergebnis eines Routinenlaufs. */
export interface RoutineErgebnis {
  status: "erstellt" | "teilweise";
  notizId: string;
  notizFassung: number;
  routineFassung: number;
  erstelltAm: string;
  quellen: { art: "aufgabe" | "notiz"; id: string; fassung: number }[];
  offen: { was: string; grund: "quelle_geloescht" | "quelle_unlesbar" }[];
  wiederholt?: boolean;
  zurueckgenommenAm?: string;
  /** EQF-07-K06: der offene Rest wird im selben Bericht fortgesetzt (Wiederaufnahme/Klärung). */
  fortsetzbar?: boolean;
  fortgesetztAm?: string;
}

export type RoutinenDeutung =
  | { art: "wochentag"; wochentag: number }
  | { art: "abschnitt_dazu" | "abschnitt_weg"; abschnitt: RoutineAbschnitt }
  | { art: "pausieren" | "fortsetzen" | "beenden" | "unklar" | "definition" };

export type ErinnerungZusammenfassung =
  | { status: "erstellt"; text: string; ki: boolean }
  | { status: "nicht_verfuegbar" };

export type LaufStatus =
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

export interface ErinnerungLauf {
  vorkommenId: string;
  geplantFuer: string;
  status: LaufStatus;
  versuch: number;
  art: "erinnerung" | "verpasst" | "sammel" | "uebersprungen";
  ergebnis: {
    zugestelltAm?: string;
    nachgeholt?: boolean;
    verspaetetMinuten?: number;
    grund?: string;
    dedupliziert?: boolean;
    pruefung?: { art: "aufgabe"; status: string };
    zusammenfassung?: ErinnerungZusammenfassung;
    empfaenger?: string;
    routine?: RoutineErgebnis;
  };
  aktualisiertAm: string;
}

export interface KlaraErinnerung {
  id: string;
  vorgang: string;
  bereich: "persoenlich";
  /** `uebergeben`: bewusst an eine andere Person übergeben (sie bekommt die Meldungen). */
  zustaendig: "selbst" | "uebergeben";
  uebergabe: { seit: string; anName: string | null } | null;
  titel: string;
  notiz: string;
  bezug: ErinnerungBezug;
  objektbezug: KlaraObjektbezug | null;
  zeitzone: string;
  zeitplan: ErinnerungZeitplan;
  sommerzeit: { luecke: "verschieben" | "auslassen"; doppelt: "erste" | "zweite" };
  verpasst: { regel: VerpasstRegel; grenzeMinuten: number };
  aktion: ErinnerungAktion;
  routine: ErinnerungRoutine | null;
  ziel: "glocke";
  status: ErinnerungStatus;
  lage: ErinnerungLage;
  anzeige: ErinnerungAnzeige;
  ausnahmen: Record<
    string,
    { art: "abgesagt" | "erledigt" | "verschoben"; datum?: string; uhrzeit?: string }
  >;
  quelleFehltAkzeptiert: boolean;
  serieVon: { erinnerungId: string; ab: string } | null;
  angelegtAm: string;
  geaendertAm: string;
  fassung: number;
  laeufe: ErinnerungLauf[];
}

export type DeutungsGrund =
  | "nicht_erkannt"
  | "datum_fehlt"
  | "uhrzeit_fehlt"
  | "tageszeit_mehrdeutig"
  | "morgen_mehrdeutig"
  | "vergangen";

export interface ErinnerungVorschau {
  deutung:
    | { art: "eindeutig"; datum: string; uhrzeit: string }
    | { art: "klaerung"; grund: DeutungsGrund; optionen: { datum: string; uhrzeit: string }[] }
    | null;
  zeitzone: string;
  zeitplan: ErinnerungZeitplan | null;
  anzeige: ErinnerungAnzeige | null;
}

export interface ErinnerungEingabe {
  titel?: string;
  notiz?: string;
  bezug: ErinnerungBezugEingabe;
  zeitzone: string;
  zeitplan: ErinnerungZeitplan;
  sommerzeit?: KlaraErinnerung["sommerzeit"];
  verpasst?: KlaraErinnerung["verpasst"];
  aktion?: KlaraErinnerung["aktion"];
  routine?: { abschnitte: RoutineAbschnitt[]; notizIds?: string[] };
}

/** Eine mir bewusst übergebene Erinnerung — nur Titel, Termine und Lage, kein persönlicher Inhalt. */
export interface UebernommeneErinnerung {
  id: string;
  titel: string;
  zeitzone: string;
  zeitplan: ErinnerungZeitplan;
  status: ErinnerungStatus;
  lage: ErinnerungLage;
  anzeige: ErinnerungAnzeige;
  seit: string | null;
  vonName: string | null;
}

/** Die Vorgaben aus dem Einrichtungsassistenten (P07). */
export interface ErinnerungEinstellungen {
  zeitzone: string | null;
  sommerzeit: KlaraErinnerung["sommerzeit"];
  verpasst: KlaraErinnerung["verpasst"];
  eingerichtetAm: string | null;
  fassung: number;
  geaendertAm: string;
}

export interface ErinnerungUeberwachung {
  rueckstau: { anzahl: number; aelteste: string | null };
  laeufe: Record<LaufStatus | "haengend", number>;
  steuerung: { taktSekunden: number | null; letzterLauf: { beginn: string; ende: string } | null };
}

const BASIS = "/me/klara/erinnerungen";
const pfad = (id: string) => `${BASIS}/${encodeURIComponent(id)}`;

export const klaraErinnerungApi = {
  liste: () =>
    api.get<{ erinnerungen: KlaraErinnerung[]; uebernommen?: UebernommeneErinnerung[] }>(BASIS),
  einstellungen: () =>
    api.get<{ einstellungen: ErinnerungEinstellungen }>(`${BASIS}/einstellungen`),
  setzeEinstellungen: (eingabe: {
    fassung: number;
    zeitzone?: string | null;
    sommerzeit?: KlaraErinnerung["sommerzeit"];
    verpasst?: KlaraErinnerung["verpasst"];
    abschliessen?: boolean;
  }) => api.put<{ einstellungen: ErinnerungEinstellungen }>(`${BASIS}/einstellungen`, eingabe),
  uebergib: (id: string, fassung: number, an: string | null) =>
    api.post<{ erinnerung: KlaraErinnerung }>(`${pfad(id)}/uebergabe`, { fassung, an }),
  gibZurueck: (id: string) =>
    api.post<{ zurueckgegeben: boolean }>(`${pfad(id)}/uebergabe/zurueckgeben`, {}),
  vorschau: (eingabe: {
    text?: string;
    zeitplan?: ErinnerungZeitplan;
    zeitzone: string;
    sommerzeit?: KlaraErinnerung["sommerzeit"];
    aktion?: KlaraErinnerung["aktion"];
  }) => api.post<ErinnerungVorschau>(`${BASIS}/vorschau`, eingabe),
  /** `vorgang` bleibt für jede Wiederholung desselben Anlegens gleich — keine Doppelerinnerung. */
  lege: (vorgang: string, eingabe: ErinnerungEingabe) =>
    api.post<{ erinnerung: KlaraErinnerung; wiederholt: boolean }>(BASIS, { ...eingabe, vorgang }),
  hole: (id: string) => api.get<{ erinnerung: KlaraErinnerung }>(pfad(id)),
  aendere: (
    id: string,
    aenderung: {
      fassung: number;
      titel?: string;
      notiz?: string;
      zeitplan?: ErinnerungZeitplan;
      zeitzone?: string;
    },
  ) => api.put<{ erinnerung: KlaraErinnerung }>(pfad(id), aenderung),
  status: (id: string, fassung: number, aktion: string) =>
    api.post<{ erinnerung: KlaraErinnerung }>(`${pfad(id)}/status`, { fassung, aktion }),
  vorkommen: (
    id: string,
    schluessel: string,
    eingabe: { fassung: number; aktion: string; datum?: string; uhrzeit?: string },
  ) =>
    api.post<{ erinnerung: KlaraErinnerung }>(
      `${pfad(id)}/vorkommen/${encodeURIComponent(schluessel)}`,
      eingabe,
    ),
  abHier: (
    id: string,
    schluessel: string,
    eingabe: { fassung: number; titel?: string; zeitplan?: ErinnerungZeitplan },
  ) =>
    api.post<{ bisher: KlaraErinnerung; neu: KlaraErinnerung }>(
      `${pfad(id)}/ab/${encodeURIComponent(schluessel)}`,
      eingabe,
    ),
  klaere: (id: string, vorkommenId: string, fassung: number, entscheidung: string) =>
    api.post<{ erinnerung: KlaraErinnerung }>(
      `${pfad(id)}/laeufe/${encodeURIComponent(vorkommenId)}/klaeren`,
      { fassung, entscheidung },
    ),
  /** EQF-07: Routine in Worten ändern; ohne `anwenden` nur deuten. */
  aendereRoutine: (id: string, fassung: number, text: string, anwenden: boolean) =>
    api.post<{ deutung: RoutinenDeutung; angewendet: boolean; erinnerung: KlaraErinnerung }>(
      `${pfad(id)}/routine`,
      { fassung, text, anwenden },
    ),
  /** EQF-07: den Bericht eines Termins zurücknehmen — nur, solange er unverändert ist. */
  nimmErgebnisZurueck: (id: string, vorkommenId: string) =>
    api.post<{ erinnerung: KlaraErinnerung }>(
      `${pfad(id)}/laeufe/${encodeURIComponent(vorkommenId)}/ergebnis-zuruecknehmen`,
      {},
    ),
  loesche: (id: string) => api.del<{ geloescht: number }>(pfad(id)),
  ueberwachung: () => api.get<ErinnerungUeberwachung>(`${BASIS}/ueberwachung`),
};
