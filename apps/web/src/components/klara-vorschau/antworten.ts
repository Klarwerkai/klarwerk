// ================================================================================================
// KLARA-VORSCHAU · DIE VORGEFERTIGTEN ANTWORTEN — rein, deterministisch, ohne Modell und ohne Netz.
// ================================================================================================
//
// Kein Satz hier entsteht durch eine KI. Für Absätze der fiktiven Artikel liegen Erklärung,
// Zusammenfassung und Umformulierung fertig in `artikel.ts`; für jeden anderen Ausschnitt gibt es
// eine ehrliche Schablone, die sagt, dass hier nur der Ablauf gezeigt wird. Jede Antwort wird im
// Gespräch als „Demo-Antwort · vorgefertigt“ gekennzeichnet (`demo: true`).
import type { TutorialFernLage } from "../../tutorial/fernsteuerung";
import { type DemoAbsatz, demoArtikel } from "./artikel";
import { type Uebersetzer, seitenErklaerung } from "./kontext";
import { type Auswahl, type Herkunft, type Vorschlag, artikelSchluessel } from "./zustand";

export interface DemoErgebnis {
  text: string;
  vorschlag?: Vorschlag;
}

export function kuerze(text: string, max: number): string {
  const sauber = text.replace(/\s+/g, " ").trim();
  return sauber.length > max ? `${sauber.slice(0, max - 1)}…` : sauber;
}

export function ersterSatz(text: string): string {
  const sauber = text.replace(/\s+/g, " ").trim();
  const ende = sauber.search(/[.!?](\s|$)/);
  return ende >= 0 ? sauber.slice(0, ende + 1) : sauber;
}

export function absatzFuer(herkunft: Herkunft): DemoAbsatz | null {
  if (!herkunft.artikelId || !herkunft.absatz) {
    return null;
  }
  return demoArtikel(herkunft.artikelId)?.absaetze.find((a) => a.nr === herkunft.absatz) ?? null;
}

/** Der Absatz, wie er gerade im Artikel steht — nach einer Übernahme also der neue Text. */
export function aktuellerAbsatzText(
  absatz: DemoAbsatz,
  artikelId: string,
  artikelText: Readonly<Record<string, string>>,
): string {
  return artikelText[artikelSchluessel(artikelId, absatz.nr)] ?? absatz.text;
}

export function antwortAufAuswahl(
  aktion: "erklaeren" | "zusammenfassen" | "umformulieren",
  auswahl: Auswahl,
  t: Uebersetzer,
  artikelText: Readonly<Record<string, string>>,
): DemoErgebnis {
  const absatz = absatzFuer(auswahl.herkunft);
  if (aktion === "erklaeren") {
    return {
      text: absatz
        ? absatz.erklaerung
        : t("klaravorschau.antwort.erklaerenAllgemein", {
            anfang: kuerze(auswahl.text, 40),
            woerter: auswahl.text.trim().split(/\s+/).length,
          }),
    };
  }
  if (aktion === "zusammenfassen") {
    return {
      text: absatz
        ? absatz.zusammenfassung
        : t("klaravorschau.antwort.zusammenfassenAllgemein", { satz: ersterSatz(auswahl.text) }),
    };
  }
  // Umformulieren: IMMER ein Vorschlag mit Original daneben — nie eine stille Änderung.
  if (absatz && auswahl.herkunft.artikelId) {
    const original = aktuellerAbsatzText(absatz, auswahl.herkunft.artikelId, artikelText);
    const neu = original === absatz.umformulierung ? absatz.text : absatz.umformulierung;
    return {
      text: t("klaravorschau.antwort.vorschlag"),
      vorschlag: {
        original,
        neu,
        artikelId: auswahl.herkunft.artikelId,
        absatz: absatz.nr,
        status: "offen",
      },
    };
  }
  const neu = kuerze(ersterSatz(auswahl.text).replace(/\s*\([^)]*\)/g, ""), 200);
  return {
    text: t("klaravorschau.antwort.umformulierenAllgemein", { text: neu }),
    vorschlag: { original: auswahl.text, neu, status: "offen" },
  };
}

export function entwurfsInhalt(auswahl: Auswahl): string {
  const absatz = absatzFuer(auswahl.herkunft);
  return absatz ? absatz.zusammenfassung : kuerze(auswahl.text, 240);
}

/** Antwort auf eine frei getippte Frage — abhängig von Seite und laufendem Tutorial. */
export function antwortAufFrage(
  frage: string,
  kontext: Herkunft,
  t: Uebersetzer,
  tutorial: TutorialFernLage | null,
): string {
  const kurz = kuerze(frage, 80);
  if (tutorial) {
    return t("klaravorschau.antwort.frageTutorial", {
      nr: tutorial.schrittIndex + 1,
      titel: tutorial.schrittTitel,
      erklaerung: ersterSatz(tutorial.schrittText),
    });
  }
  switch (kontext.seite) {
    case "artikel": {
      const artikel = demoArtikel(kontext.artikelId);
      if (artikel) {
        return t("klaravorschau.antwort.frageArtikel", {
          frage: kurz,
          titel: artikel.titel,
          kern: artikel.kurz,
        });
      }
      break;
    }
    case "fragen":
      return t("klaravorschau.antwort.frageFragen", { frage: kurz });
    case "erfassung":
      return t("klaravorschau.antwort.frageErfassung", { frage: kurz });
    case "uebersicht":
      return t("klaravorschau.antwort.frageAndere", {
        frage: kurz,
        seite: kontext.seitenName,
        erklaerung: t("klaravorschau.vorschauseite.intro"),
      });
    default:
      break;
  }
  return t("klaravorschau.antwort.frageAndere", {
    frage: kurz,
    seite: kontext.seitenName,
    erklaerung: seitenErklaerung(kontext.pfad, t) ?? "",
  });
}
