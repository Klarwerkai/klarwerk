import type {
  ReasonerCloudAnbieter,
  ReasonerModellWissensstand,
  ReasonerZugangHerkunft,
} from "./types";

// ================================================================================================
// R-0702 · DIE HERKUNFT JE KI-ZUGANG STEHT HIER, NICHT IM BROWSER.
// ================================================================================================
//
// Bis hierher riet `apps/web/src/lib/kiOrigin.ts` das Herkunftsland aus der MODELLKENNUNG
// („claude" → USA, „mistral" → Frankreich, …). Das war als Zwischenlösung benannt („SPÄTER: das
// Herkunftsland übermittelt zentral die KI-Zugangs-Steuerung"). Diese Datei ist der zentrale Ort:
// geschlüsselt nach dem ZUGANG, den der Server selbst verdrahtet (`REASONER_CLOUD_ANBIETER` und der
// lokale Server), nicht nach einem Namen, den man deuten müsste.
//
// WAS HIER STEHT UND WAS NICHT. Für die beiden externen Anbieter steht ihr Firmensitz — eine
// Angabe des Anbieters über sich selbst. KLARWERK prüft sie nicht, deshalb `behauptet`. Sie sagt
// NICHTS über Verarbeitungsort, Auftragsverarbeitung, Unterauftragnehmer oder Trainingsausschluss;
// dafür gibt es in dieser Installation keinen hinterlegten Nachweis, und die Oberfläche führt sie
// als offene Prüfung. `geprueft` vergibt diese Tabelle für keinen Zugang.
//
// Der lokale Server ist eine frei konfigurierte Adresse (`KLARWERK_LOCAL_LLM_URL`). Weder wer ihn
// betreibt noch welches Modell dort läuft, ist dem Code bekannt — also `unbekannt`, ohne Land.
const ZUGANG_HERKUNFT: Readonly<Record<ReasonerCloudAnbieter | "local", ReasonerZugangHerkunft>> = {
  openai: { land: "us", nachweis: "behauptet" },
  anthropic: { land: "us", nachweis: "behauptet" },
  local: { land: null, nachweis: "unbekannt" },
};

/** Die Herkunft aller KI-Zugänge dieser Installation — eine Kopie, damit niemand die Tabelle ändert. */
export function zugangHerkunft(): Record<ReasonerCloudAnbieter | "local", ReasonerZugangHerkunft> {
  return {
    openai: { ...ZUGANG_HERKUNFT.openai },
    anthropic: { ...ZUGANG_HERKUNFT.anthropic },
    local: { ...ZUGANG_HERKUNFT.local },
  };
}

// ================================================================================================
// R-0299 · BIS WANN REICHT DAS WISSEN DES MODELLS? NUR AUS BELEGTEN ANGABEN.
// ================================================================================================
//
// Die Karte „Betreiber und Wissensstand" soll in der Vorführung keine falsche Aktualität
// suggerieren. Der Wissensstand eines Modells (der Stichtag seiner Trainingsdaten) ist eine Angabe
// des HERSTELLERS je Modellkennung — er lässt sich weder aus dem Namen ableiten noch erfragen.
//
// DESHALB GIBT ES HIER NUR EINE TABELLE BELEGTER ANGABEN, geschlüsselt nach der EXAKTEN
// Modellkennung, wie sie der Client meldet. Jeder Eintrag trägt seinen Beleg (Dokument/Fundstelle
// des Herstellers) und das Abrufdatum. HEUTE IST SIE LEER: für die angebotenen Modelle liegt in
// diesem Bestand keine belegte Herstellerangabe vor, und eine aus dem Gedächtnis eingetragene Zahl
// wäre genau die falsche Aktualität, gegen die die Karte gebaut ist. Fehlt der Eintrag, sagt die
// Auskunft ehrlich „unbekannt" und nennt, WELCHE Quelle fehlt (`quellenbedarf`).
interface BelegterWissensstand {
  /** Stichtag der Trainingsdaten, wie der Hersteller ihn nennt (ISO-Monat oder -Datum). */
  readonly stand: string;
  /** Fundstelle des Herstellers (Modellkarte, Dokumentationsseite) — nie eine Vermutung. */
  readonly quelle: string;
  /** Wann die Fundstelle gelesen wurde (ISO-Datum). */
  readonly abgerufen: string;
}

const BELEGTE_WISSENSSTAENDE: Readonly<Record<string, BelegterWissensstand>> = {};

/**
 * Der Wissensstand eines Modells — belegt aus der Tabelle oben, sonst ausdrücklich unbekannt mit
 * benanntem Quellenbedarf. `modell` ist die Kennung, die der Client meldet (z. B. `gpt-4o-mini`);
 * fehlt sie, gibt es nichts nachzuschlagen.
 */
export function modellWissensstand(modell: string | null | undefined): ReasonerModellWissensstand {
  const kennung = (modell ?? "").trim();
  const beleg = kennung ? BELEGTE_WISSENSSTAENDE[kennung] : undefined;
  if (beleg) {
    return { stand: beleg.stand, nachweis: "belegt", quelle: beleg.quelle, quellenbedarf: null };
  }
  return {
    stand: null,
    nachweis: "unbekannt",
    quelle: null,
    quellenbedarf: kennung
      ? `Herstellerangabe zum Trainingsdaten-Stichtag des Modells „${kennung}" (Modellkarte oder Dokumentation des Anbieters, mit Fundstelle und Abrufdatum).`
      : "Keine Modellkennung gemeldet — ohne sie lässt sich kein Stichtag belegen.",
  };
}
