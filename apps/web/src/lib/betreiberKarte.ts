// R-0299 (Ben nacharbeit-2) · DIE KARTE „BETREIBER UND WISSENSSTAND DES MODELLS".
//
// Sie macht sichtbar, wer das gerade antwortende Modell betreibt und bis wann sein Wissen reicht —
// damit in der Vorführung keine falsche Aktualität suggeriert wird. Die Angaben kommen aus der
// Serverauskunft (`configStatus().betreiber`, `Reasoner.betreiberKarte()`); der Wissensstand ist der
// vom Hersteller veröffentlichte „knowledge cutoff" (nicht das Trainingsdatenende), NUR aus belegten
// Herstellerangaben (`services/reasoner/src/anbieter-herkunft.ts`) — mit Quelle und Abrufdatum.
// Fehlt der Beleg, steht „unbekannt" UND die konkret fehlende Quelle da — nie eine Zahl aus dem
// Gedächtnis.
//
// DOM-frei und testbar — die Karte rendert nur das Ergebnis.
import type { ReasonerBetreiberKarte } from "../api/types";
import { type KiHerkunftAnzeige, kiHerkunftAnzeige } from "./kiHeaderStatus";

export const BETREIBER_KARTE_TEXT = {
  titel: "kilage.karte.titel",
  betreiber: "kilage.karte.betreiber",
  betreiberServer: "kilage.karte.betreiberServer",
  modell: "kilage.karte.modell",
  modellUnbekannt: "kilage.karte.modellUnbekannt",
  herkunft: "kilage.karte.herkunft",
  wissensstand: "kilage.karte.wissensstand",
  wissensstandBelegt: "kilage.karte.wissensstandBelegt",
  wissensstandUnbekannt: "kilage.karte.wissensstandUnbekannt",
  quellenbedarf: "kilage.karte.quellenbedarf",
  keinModell: "kilage.karte.keinModell",
  hinweis: "kilage.karte.hinweis",
  verfuegbarkeit: "kilage.karte.verfuegbarkeit",
  verfuegbarErreichbar: "kilage.verfuegbarkeit.erreichbar",
  verfuegbarUngeprueft: "kilage.verfuegbarkeit.ungeprueft",
  verfuegbarUnerreichbar: "kilage.verfuegbarkeit.unerreichbar",
} as const;

/** Ein Satz der Karte: Schlüssel und Einsetzwerte, oder ein wörtlicher Wert (Name, Kennung). */
export type KartenWert =
  | { readonly key: string; readonly params?: Record<string, string> }
  | { readonly wortlaut: string };

export interface BetreiberKartenAnzeige {
  /** `false`: kein Modell arbeitet — die Karte sagt nur das, ohne Betreiber und Wissensstand. */
  modellArbeitet: boolean;
  /**
   * Ben nacharbeit-7: arbeitet kein Modell, WEIL das eingerichtete zuletzt nicht antwortete, sagt
   * die Karte genau das (statt „kein Modell"); arbeitet eins, steht hier, ob es zuletzt antwortete
   * oder noch ungeprüft ist.
   */
  verfuegbarkeit: KartenWert | null;
  betreiber: KartenWert | null;
  modell: KartenWert | null;
  herkunft: KiHerkunftAnzeige | null;
  wissensstand: KartenWert | null;
  /** Nur bei unbekanntem Wissensstand: welche Quelle fehlt. */
  quellenbedarf: KartenWert | null;
}

export function betreiberKartenAnzeige(karte: ReasonerBetreiberKarte): BetreiberKartenAnzeige {
  const verfuegbarkeit: KartenWert | null =
    karte.verfuegbarkeit === "erreichbar"
      ? { key: BETREIBER_KARTE_TEXT.verfuegbarErreichbar }
      : karte.verfuegbarkeit === "ungeprueft"
        ? { key: BETREIBER_KARTE_TEXT.verfuegbarUngeprueft }
        : karte.verfuegbarkeit === "unerreichbar"
          ? { key: BETREIBER_KARTE_TEXT.verfuegbarUnerreichbar }
          : null;
  if (karte.zugang === null) {
    return {
      modellArbeitet: false,
      verfuegbarkeit,
      betreiber: null,
      modell: null,
      herkunft: null,
      wissensstand: null,
      quellenbedarf: null,
    };
  }
  const betreiber: KartenWert = karte.betreiber
    ? { wortlaut: karte.betreiber }
    : { key: BETREIBER_KARTE_TEXT.betreiberServer };
  const modell: KartenWert = karte.modell
    ? { wortlaut: karte.modell }
    : { key: BETREIBER_KARTE_TEXT.modellUnbekannt };
  const belegt =
    karte.wissensstand?.nachweis === "belegt" && karte.wissensstand.stand
      ? karte.wissensstand
      : null;
  return {
    modellArbeitet: true,
    verfuegbarkeit,
    betreiber,
    modell,
    herkunft: kiHerkunftAnzeige(karte.herkunft ?? undefined),
    wissensstand: belegt
      ? {
          key: BETREIBER_KARTE_TEXT.wissensstandBelegt,
          params: {
            stand: belegt.stand ?? "",
            quelle: belegt.quelle ?? "",
            abgerufen: belegt.abgerufen ?? "",
          },
        }
      : { key: BETREIBER_KARTE_TEXT.wissensstandUnbekannt },
    quellenbedarf: belegt
      ? null
      : {
          key: BETREIBER_KARTE_TEXT.quellenbedarf,
          params: { modell: karte.modell ?? "—" },
        },
  };
}
