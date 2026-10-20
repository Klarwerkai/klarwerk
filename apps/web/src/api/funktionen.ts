// produkt:20261011:peter-p06:beschaffungsroutine (BES-07) · „Meine Funktionen" — der Draht zu
// `services/app/src/routes/persoenliche-funktionen-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/app/src/persoenliche-funktionen.ts`); sie steht hier ein
// zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { api } from "./client";

export type FunktionsStand = "vorschlag" | "aktiv" | "pausiert" | "deaktiviert";
export type ParameterName = "produkt" | "menge" | "termin" | "ansprechpartner" | "ausnahme";
export type Eingabeweg = "text" | "sprache";

export interface FunktionsParameter {
  name: ParameterName;
  bezeichnung: string;
  pflicht: boolean;
  hinweis: string;
}

export interface Faehigkeit {
  id: string;
  titel: string;
  erfuellt: boolean;
  grund: string;
}

export type FunktionsHerkunft =
  | { art: "eingabe" }
  | {
      art: "assistenzgespraech";
      gespraechId: string;
      gespraechFassung: number;
      abschnitt: string;
    };

export interface FunktionsFassung {
  version: number;
  herkunft: FunktionsHerkunft;
  name: string;
  zweck: string;
  thema: string;
  ausgangstext: string;
  eingabeweg: Eingabeweg;
  parameter: FunktionsParameter[];
  quellen: string[];
  erlaubteSchritte: string[];
  aussenaktionen: Record<string, string>;
  empfaengerregel: string;
  ergebnis: string;
  fehlerregel: string;
  stopregel: string;
  angelegtAm: string;
}

export interface Zeitauftrag {
  rhythmus: "woechentlich" | "monatlich";
  beginn: string;
  ende: string | null;
  uhrzeit: string;
  zeitzone: string;
  nachholen: "einmal" | "nie";
  eingerichtetAm: string;
  ausfuehrung: "vorbereitung";
}

export interface VorschauTermin {
  datum: string;
  zeitpunkt: string;
  hinweis: "sommerzeit_verschoben" | "winterzeit_doppelt" | "monatsende" | null;
}

export interface FunktionsLauf {
  id: string;
  fassung: number;
  ausgeloestAm: string;
  parameterwerte: Partial<Record<ParameterName, string>>;
  rechte: { rolle: string; geprueftAm: string };
  quellen: Array<{
    koId: string;
    zustand: "gelesen" | "nicht_zugaenglich" | "geloescht" | "nicht_erreichbar";
    fassung: number | null;
    status: string | null;
  }>;
  stand: "klaerung_noetig" | "wartet_auf_faehigkeit";
  klaerung: Klaerung[];
  offen: string[];
  aussenwirkung: "keine";
}

export interface Klaerung {
  art:
    | "parameter_fehlen"
    | "keine_quelle"
    | "quelle_geloescht"
    | "quelle_nicht_zugaenglich"
    | "quelle_nicht_erreichbar";
  koId: string | null;
  hinweis: string;
}

export interface PersoenlicheFunktion {
  id: string;
  art: "favorit" | "vorschlag";
  stand: FunktionsStand;
  aktuell: FunktionsFassung;
  fassungen: FunktionsFassung[];
  zeitauftrag: Zeitauftrag | null;
  vorschau: VorschauTermin[];
  /** Neueste zuerst. */
  laeufe: FunktionsLauf[];
  rev: number;
  angelegtAm: string;
  geaendertAm: string;
  ausfuehrbar: boolean;
  offeneFaehigkeiten: Faehigkeit[];
  zeitauftragFaehigkeit: Faehigkeit;
}

export interface FunktionsEntwurf {
  name: string;
  zweck: string;
  thema: string;
  ausgangstext: string;
  eingabeweg: Eingabeweg;
  parameter: FunktionsParameter[];
  erlaubteSchritte: string[];
  aussenaktionen: Record<string, string>;
  empfaengerregel: string;
  ergebnis: string;
  fehlerregel: string;
  stopregel: string;
  beispielwerte: Array<{ parameter: ParameterName; wert: string }>;
  wiederholungErwaehnt: boolean;
}

export type Beispielwert = { parameter: ParameterName; wert: string };
export type SerienEingabe = Pick<
  Zeitauftrag,
  "rhythmus" | "beginn" | "ende" | "uhrzeit" | "nachholen"
>;
export type Laufwerte = Partial<Record<ParameterName, string>>;

/** Der übernommene Vorgang: das zuletzt geführte Assistenzgespräch — oder keiner. */
export type Vorgang = "letztes" | null;

/** Was „Bearbeiten" ändern kann; jede inhaltliche Änderung ergibt serverseitig eine neue Fassung. */
export interface Aenderung {
  stand?: FunktionsStand;
  name?: string;
  zweck?: string;
  quellen?: string[];
  gespraech?: "letztes";
  abschnitt?: string;
}

/** Ein Beschaffungsfall im Gespräch — zur Auswahl, wenn es mehrere gibt. */
export interface VorgangsAbschnitt {
  abschnitt: string;
  text: string;
  angelegtAm: string;
}

/** Was die Vorschau bindet; das Speichern schickt genau das zurück (Nacharbeit 4). */
export interface VorgangsBindung {
  gespraechId: string;
  gespraechFassung: number;
  abschnitt: string;
}

type EntwurfAntwort = {
  entwurf: FunktionsEntwurf;
  herkunft: FunktionsHerkunft;
  bindung: VorgangsBindung | null;
  quellen: string[];
  nichtUebernommen: number;
  offeneFaehigkeiten: Faehigkeit[];
};
type SpeichernAntwort = {
  funktion: PersoenlicheFunktion;
  beispielwerte: Beispielwert[];
  nichtUebernommen: number;
};
type FunktionAntwort = { funktion: PersoenlicheFunktion };
type LaufAntwort = { funktion: PersoenlicheFunktion; lauf: FunktionsLauf };

const BASIS = "/me/funktionen";

function pfad(id: string, rest = ""): string {
  return `${BASIS}/${encodeURIComponent(id)}${rest}`;
}

export const FUNKTIONEN_KEY = ["me", "funktionen"] as const;

/** Das zuletzt geführte Assistenzgespräch — nur, was die Übernahme anzeigt. */
export interface LetztesGespraech {
  id: string;
  objektbezug: { seitenName: string; objekt: string };
}

export const LETZTES_GESPRAECH_KEY = ["me", "klara", "gespraech"] as const;

export const funktionenApi = {
  liste: () => api.get<{ funktionen: PersoenlicheFunktion[] }>(BASIS),
  // Dieselbe Tür, aus der das Assistenzgespräch sich fortsetzt (`klara-gespraech-routes.ts`).
  letztesGespraech: () => api.get<{ gespraech: LetztesGespraech | null }>("/me/klara/gespraech"),
  // Die VORSCHAU löst „letztes" auf (und den gewählten Fall, wenn das Gespräch mehrere hat);
  // welches Gespräch das ist und welche Quellen das Konto sehen darf, entscheidet der Server.
  entwurf: (text: string, eingabeweg: Eingabeweg, vorgang: Vorgang, abschnitt: string | null) =>
    api.post<EntwurfAntwort>(`${BASIS}/entwurf`, {
      text,
      eingabeweg,
      ...(vorgang ? { gespraech: vorgang } : {}),
      ...(vorgang && abschnitt ? { abschnitt } : {}),
    }),
  // Das SPEICHERN schickt die Bindung der Vorschau zurück: Kennung (nicht „letztes"), Fassung,
  // Fall und die gezeigten Quellen. Hat sich etwas geändert, antwortet der Server 409.
  speichern: (
    text: string,
    eingabeweg: Eingabeweg,
    art: "favorit" | "vorschlag",
    vorschau: {
      bindung: VorgangsBindung | null;
      quellen: string[];
      name: string | null;
      ausgangstext: string | null;
    },
  ) =>
    api.post<SpeichernAntwort>(BASIS, {
      text,
      eingabeweg,
      art,
      // Nacharbeit 5: die angezeigte Definition — weicht das Gespeicherte davon ab, 409.
      ...(vorschau.name !== null && vorschau.ausgangstext !== null
        ? { vorschauName: vorschau.name, vorschauAusgangstext: vorschau.ausgangstext }
        : {}),
      ...(vorschau.bindung
        ? {
            gespraech: vorschau.bindung.gespraechId,
            gespraechFassung: vorschau.bindung.gespraechFassung,
            abschnitt: vorschau.bindung.abschnitt,
            vorschauQuellen: vorschau.quellen,
          }
        : {}),
    }),
  aendern: (id: string, rev: number, aenderung: Aenderung) =>
    api.put<FunktionAntwort>(pfad(id), { rev, ...aenderung }),
  serie: (id: string, rev: number, serie: SerienEingabe) =>
    api.put<FunktionAntwort>(pfad(id, "/zeitauftrag"), { rev, ...serie }),
  serieEntfernen: (id: string, rev: number) =>
    api.del<FunktionAntwort>(pfad(id, `/zeitauftrag?rev=${rev}`)),
  lauf: (id: string, parameter: Laufwerte) =>
    api.post<LaufAntwort>(pfad(id, "/laeufe"), { parameter }),
};
