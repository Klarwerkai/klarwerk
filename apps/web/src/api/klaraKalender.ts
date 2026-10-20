// produkt:20261008:klara-kalender (Klara 11, AW-17) — der Drahtvertrag der Kalenderanbindung
// (Spiegel von `services/app/src/klara-kalender-anbindung.ts` und `routes/klara-kalender-routes.ts`).
// Das Konto kommt am Server aus der Sitzung; hier steht nie eine Kontokennung und nie ein Zugang.
import { api } from "./client";

export type KalenderFeld = "titel" | "zeit" | "ort" | "beschreibung" | "teilnehmer";
export type FeldRichtung = "klara" | "kalender" | "nur_klara";
export type Konfliktstrategie = "nachfragen" | "fuehrend_mit_hinweis";
export type PrivatProjektion = "nur_belegt" | "titel" | "voll";
export type AnbindungUmfang = "nur_lesen" | "lesen_schreiben";
export type Serienart = "einzel" | "serie" | "vorkommen";
export type Umfang = "einzeltermin" | "serie";
export type Entscheidung =
  | "fortfuehren_neu_eintragen"
  | "fortfuehren_ohne_kalender"
  | "beenden"
  | "dialog_geschlossen";

export const KALENDER_FELDER: readonly KalenderFeld[] = [
  "titel",
  "zeit",
  "ort",
  "beschreibung",
  "teilnehmer",
];

export interface KalenderRechte {
  lesen: boolean;
  eigeneSchreiben: boolean;
  geteiltBearbeiten: boolean;
  einladen: boolean;
}

export interface AnbieterKonto {
  kennung: string;
  anzeige: string;
  adresse: string;
}

export interface AnbieterKalender {
  id: string;
  name: string;
  art: "eigen" | "geteilt";
  besitzer: string;
  rechte: KalenderRechte;
}

export interface FeldRegel {
  richtung: FeldRichtung;
  konflikt: Konfliktstrategie;
}

export interface KalenderAnbindung {
  id: string;
  anbieter: string;
  konto: AnbieterKonto;
  kalender: AnbieterKalender;
  umfang: AnbindungUmfang;
  rechte: KalenderRechte;
  felder: Record<KalenderFeld, FeldRegel>;
  privatProjektion: PrivatProjektion;
  entfernteAnzeige: string;
  angelegtAm: string;
}

export interface Teilnehmer {
  adresse: string;
  name: string;
  antwort: "offen" | "zugesagt" | "abgesagt" | "vorbehalt";
}

export interface KalenderInhalt {
  titel: string;
  beginn: string;
  ende: string;
  zeitzone: string;
  ort: string;
  beschreibung: string;
  teilnehmer: Teilnehmer[];
}

export interface InternerTermin {
  auftragId: string;
  ereignisId: string;
  fassung: number;
  privat: boolean;
  serienart: Serienart;
  abgesagt: boolean;
  inhalt: KalenderInhalt;
}

export interface AnbieterTermin extends KalenderInhalt {
  id: string;
  version: string;
  serienart: Serienart;
  serienId: string | null;
  abgesagt: boolean;
  organisator: string;
}

export interface Feldkonflikt {
  feld: KalenderFeld;
  klara: string;
  kalender: string;
}

export interface KalenderZuordnung {
  schluessel: string;
  anbindungId: string;
  auftragId: string;
  ereignisId: string;
  intern: InternerTermin;
  externeId: string | null;
  anbieterVersion: string | null;
  serienart: Serienart;
  stand: "ausstehend" | "projiziert" | "fehlgeschlagen" | "konflikt" | "pausiert" | "gesperrt";
  sperrmarke: { grund: string; umfang: Umfang } | null;
  entscheidung: {
    anlass: "extern_geloescht" | "extern_abgesagt" | "konflikt" | "loeschen_veraltet";
    umfaenge: Umfang[];
    konflikte: Feldkonflikt[];
  } | null;
  fehler: string | null;
  geaendertAm: string;
}

export type KalenderErgebnis =
  | { ok: true; zuordnung: KalenderZuordnung; termin: AnbieterTermin | null }
  | {
      ok: false;
      stand: "fehlgeschlagen" | "ausstehend";
      grund: string;
      meldung: string;
      zuordnung: KalenderZuordnung | null;
    };

export type KalenderAuswahl =
  | { verbunden: false; grund?: string; meldung?: string }
  | { verbunden: true; konto: AnbieterKonto; kalender: AnbieterKalender[] };

export interface VerbindenEingabe {
  kalenderId: string;
  umfang: AnbindungUmfang;
  felder: Record<KalenderFeld, FeldRegel>;
  privatProjektion: PrivatProjektion;
}

/**
 * S09: ein Eintrag des EIGENEN Kalenders, wie `GET /api/me/kalender` ihn mit heutigen Rechten zeigt —
 * nur, was die Übernahme braucht. Auftrag und Lauf sind die Kennungen der Erinnerungssteuerung.
 */
export interface EigenerKalenderEintrag {
  id: string;
  titel: string | null;
  ganztaegig: boolean;
  beginn: string;
  ende: string | null;
  zeitzone: string;
  geschuetzt: boolean;
  auftrag: { taskId: string; titel: string | null; aufgeloest: boolean } | null;
  lauf: { runId: string; status: string | null } | null;
}

/** Die Seite der Anbindung — erreichbar über Profil › „Vorhandener Kalender“. */
export const KALENDER_ANBINDUNG_PFAD = "/kalender-anbindung";

const BASIS = "/me/klara/kalender";
const enc = encodeURIComponent;

export const klaraKalenderApi = {
  uebersicht: () => api.get<{ auswahl: KalenderAuswahl; anbindungen: KalenderAnbindung[] }>(BASIS),
  verbinde: (eingabe: VerbindenEingabe) =>
    api.post<{ anbindung: KalenderAnbindung }>(`${BASIS}/anbindungen`, eingabe),
  termine: (anbindungId: string, von: string, bis: string) =>
    api.get<
      | {
          ok: true;
          termine: (AnbieterTermin & { art: "persoenlich" | "gemeinsam" | "einladung" })[];
        }
      | { ok: false; grund: string; meldung: string }
    >(`${BASIS}/anbindungen/${enc(anbindungId)}/termine?von=${enc(von)}&bis=${enc(bis)}`),
  eintragen: (
    anbindungId: string,
    termin: InternerTermin,
    teilnehmerAuftrag: { adressen: string[] } | null,
  ) =>
    api.post<KalenderErgebnis>(`${BASIS}/anbindungen/${enc(anbindungId)}/termine`, {
      termin,
      ...(teilnehmerAuftrag ? { teilnehmerAuftrag } : {}),
    }),
  /** S09: die Einträge des eigenen Kalenders (persönlich), mit heutigen Rechten gelesen. */
  eigeneEintraege: () => api.get<{ eintraege: EigenerKalenderEintrag[] }>("/me/kalender"),
  /**
   * S09: einen eigenen Kalendereintrag mit SEINER Auftrags- und Ereigniskennung eintragen — der
   * Server liest ihn selbst; hier geht nur die Kennung hinaus, nichts wird neu erfasst.
   */
  eintragenAusEigenemKalender: (anbindungId: string, eigenerEintragId: string) =>
    api.post<KalenderErgebnis>(`${BASIS}/anbindungen/${enc(anbindungId)}/termine`, {
      eigenerEintragId,
    }),
  zuordnungen: (anbindungId: string) =>
    api.get<{ zuordnungen: KalenderZuordnung[] }>(
      `${BASIS}/anbindungen/${enc(anbindungId)}/zuordnungen`,
    ),
  abgleich: (anbindungId: string) =>
    api.post<{
      ergebnisse: { schluessel: string; laufWirkung: string | null; ergebnis: KalenderErgebnis }[];
    }>(`${BASIS}/anbindungen/${enc(anbindungId)}/abgleich`, {}),
  loeschVorschau: (schluessel: string, umfang: Umfang) =>
    api.post<
      | { ok: true; umfang: Umfang; ziel: AnbieterTermin; fassung: string }
      | { ok: false; grund: string; meldung: string }
    >(`${BASIS}/zuordnungen/${enc(schluessel)}/loeschvorschau`, { umfang }),
  /** Löscht NUR mit der Fassung aus der Löschvorschau — sonst antwortet der Server mit Konflikt. */
  loesche: (schluessel: string, umfang: Umfang, fassung: string) =>
    api.post<KalenderErgebnis>(`${BASIS}/zuordnungen/${enc(schluessel)}/loeschen`, {
      umfang,
      fassung,
    }),
  entscheide: (schluessel: string, wahl: Entscheidung, umfang: Umfang | null) =>
    api.post<{ laufWirkung: string; ergebnis: KalenderErgebnis }>(
      `${BASIS}/zuordnungen/${enc(schluessel)}/entscheidung`,
      { wahl, ...(umfang ? { umfang } : {}) },
    ),
};
