import type { ReasonerCloudAnbieter, ReasonerZugangHerkunft } from "./types";

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
