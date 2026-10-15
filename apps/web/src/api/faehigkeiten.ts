// produkt:20261011:assistenz-skills-werkzeuge — der Drahtvertrag der Fähigkeiten der eigenen
// Assistenz (Spiegel von `services/app/src/routes/assistenz-faehigkeiten-routes.ts`). Das Konto
// bestimmt allein die Sitzung; der Client schickt nie eine Kontokennung mit.
import { api } from "./client";

export interface FaehigkeitsVoraussetzung {
  art: string;
  text: string;
}

export interface FaehigkeitsEintrag {
  id: string;
  name: string;
  beschreibung: string;
  fassung: string;
  zwecke: string[];
  datenempfaenger:
    | { art: "intern" }
    | { art: "extern"; anbieter: string; anbieterName: string; host: string };
  wirkung: "lesen" | "entwurf_schreiben";
  modell: boolean;
  eingaben: { name: string; maxLaenge: number; pflicht: boolean }[];
  grenzen: { maxTreffer: number; zeitlimitMs: number; kostenJeAufrufCent: number | null };
  zugang: string | null;
  ruecknahme: "keine_wirkung" | "entwurf_verwerfen";
  verfuegbar: boolean;
  voraussetzungen: FaehigkeitsVoraussetzung[];
}

export interface FaehigkeitsVormerkungSicht {
  vormerkung: {
    faehigkeitId: string;
    art: "favorit" | "routine";
    zweck: string | null;
    fassung: string;
    bestaetigtAm: string | null;
    aktiv: boolean;
    gespeichertAm: string;
  };
  gueltig: boolean;
  hinweis: string;
}

export interface FaehigkeitenAntwort {
  faehigkeiten: FaehigkeitsEintrag[];
  vormerkungen: FaehigkeitsVormerkungSicht[];
}

export interface FaehigkeitsErgebnis {
  auftragId: string;
  stand: string;
  faehigkeitId: string | null;
  fassung: string | null;
  eintraege: Record<string, string>[];
  verworfen: number;
  fremdeAnweisungen: number;
  meldung: string;
  voraussetzungen: FaehigkeitsVoraussetzung[];
  verbrauchCent: number | null;
  transport: "echt" | "ersatz" | null;
  wirkungKennung: string | null;
  ruecklink: { arbeitsbereich: string | null; auftragId: string };
  wiederholt: boolean;
  versuch: number;
  abgeschlossenAm: string | null;
}

export type FaehigkeitsVorbereitung =
  | { art: "gebunden"; vorschau: string; bindung: { faehigkeitId: string; auftragId: string } }
  | {
      art: "offen";
      stand: string;
      erklaerung: string;
      voraussetzungen: FaehigkeitsVoraussetzung[];
      kandidaten: string[];
    };

export interface FaehigkeitsAuftragEingabe {
  zweck: string;
  gewaehlt?: string | null;
  eingabe: Record<string, string>;
  kontext?: string[];
  arbeitsbereich?: string | null;
}

export const faehigkeitenApi = {
  lesen: (): Promise<FaehigkeitenAntwort> => api.get<FaehigkeitenAntwort>("/me/faehigkeiten"),
  vormerken: (v: {
    faehigkeitId: string;
    art: "favorit" | "routine";
    zweck?: string | null;
    bestaetigt?: boolean;
  }): Promise<{ vormerkungen: FaehigkeitsVormerkungSicht[] }> =>
    api.post("/me/faehigkeiten/vormerkungen", v),
  deaktivieren: (faehigkeitId: string): Promise<{ vormerkungen: FaehigkeitsVormerkungSicht[] }> =>
    api.post(`/me/faehigkeiten/vormerkungen/${encodeURIComponent(faehigkeitId)}/deaktivieren`),
  vorschau: (
    a: FaehigkeitsAuftragEingabe & { auftragId: string },
  ): Promise<{
    vorbereitung: FaehigkeitsVorbereitung;
    auftragId: string;
    fingerabdruck: string | null;
  }> => api.post("/me/faehigkeiten/vorschau", a),
  /** Der gespeicherte Stand eines eigenen Auftrags (404, wenn er nie angekommen ist). */
  auftrag: (
    auftragId: string,
  ): Promise<{
    auftrag: { auftragId: string; zustand: string; ergebnis: FaehigkeitsErgebnis | null };
  }> => api.get(`/me/faehigkeiten/auftraege/${encodeURIComponent(auftragId)}`),
  /** Führt GENAU die angezeigte Vorschau aus; weicht die Bindung ab, antwortet der Server 409. */
  ausfuehren: (
    a: FaehigkeitsAuftragEingabe & { auftragId: string; vorschauFingerabdruck: string },
  ): Promise<{ vorbereitung: FaehigkeitsVorbereitung; ergebnis: FaehigkeitsErgebnis | null }> =>
    api.post("/me/faehigkeiten/auftraege", { ...a, bestaetigt: true }),
};
