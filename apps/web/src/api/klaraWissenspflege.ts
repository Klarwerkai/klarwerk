import { api } from "./client";

export type PflegeVorlage = "offene_pruefungen" | "quellaenderung" | "aktualitaet";
export interface PflegeEingabe {
  vorlage: PflegeVorlage;
  quellen: string[];
}
export interface PflegeAuftrag extends PflegeEingabe {
  bereich: "ausgewaehlte_wissensobjekte";
  ausloeser: "zeitplan" | "quellstand_polling";
  erlaubteArbeit: "pruefunterlagen";
  verantwortlich: "auftraggeber";
  empfaenger: "auftraggeber";
  ende: "zeitplan";
  ausgangsstand: { id: string; fassung: number }[];
}
export interface PflegeErgebnis {
  vorlage: PflegeVorlage;
  geprueftAm: string;
  stand: "vorbereitet" | "ohne_quellaenderung" | "ungeprueft" | "ergebnis_entfernt";
  quellen: {
    id: string;
    fassung: number | null;
    stand: "gelesen" | "ungeprueft";
    letzteErfolgreichePruefung: string | null;
  }[];
  aenderung: string | null;
}
export const wissenspflegeApi = {
  vorschau: (wissenspflege: PflegeEingabe) =>
    api.post<{
      auftrag: PflegeAuftrag;
      ergebnis: "pruefunterlagen_in_eigenen_notizen";
      wirkung: "keine";
    }>("/me/klara/erinnerungen/wissenspflege/vorschau", { wissenspflege }),
};
