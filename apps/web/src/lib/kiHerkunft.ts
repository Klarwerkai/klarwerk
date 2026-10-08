// ================================================================================================
// R-0625 / R-1020 / R-1695 — HERKUNFT UND STUFE EINES ERGEBNISSES, EINMAL ABGELEITET.
// ================================================================================================
//
// HERKUNFT IST DREIWERTIG, nicht ja/nein (R-0625, Ben Nacharbeit 2):
//   · "ki"         — die Servermarke ist da und gültig (`istKiKennzeichnung`, G24). Belegt.
//   · "ohne-ki"    — der Server hat den modellfreien Rückfall ausdrücklich gemeldet (`demo: true`)
//                    und GAR KEINE Marke mitgeschickt. Belegt — und nur dieser Fall darf eine
//                    Kennzeichnung AUSSCHALTEN.
//   · "unbekannt"  — alles andere: keine Marke bei `demo !== true` (alter Server, abgeschnittener
//                    Körper) oder eine ungültige Marke — auch neben `demo: true`, denn dann
//                    widersprechen sich die Angaben. Unbekannt bleibt unbekannt: nichts wird als
//                    „keine KI" behauptet, und nichts als „von KI erzeugt".
//
// STUFE (R-1695, Grundsatz G-3 „kein KI=Wahrheit") — genau drei Werte, für jede Ergebnisfläche:
//   · "entwurf"    — von einem Modell erzeugt: „Reasoner-Entwurf, nicht validiert" (R-1020).
//   · "empfehlung" — ohne Modell oder mit unbekannter Herkunft abgeleitet, aber NICHT als gesichert
//                    belegt: ein Hinweis, kein geprüftes Wissen.
//   · "validiert"  — ausschliesslich bei belegt modellfreier Herkunft UND belegter Einstufung
//                    „gesichert" (Grad `verified`). Ein Modelltext wird nie „validiert", auch wenn
//                    seine Quellen es sind — sonst wäre es genau „KI=Wahrheit".
import { istKiKennzeichnung } from "./wordAddin";

export type KiHerkunft = "ki" | "ohne-ki" | "unbekannt";

export function kiHerkunftAus(ergebnis: { aiGenerated?: unknown; demo?: unknown }): KiHerkunft {
  if (istKiKennzeichnung(ergebnis.aiGenerated)) {
    return "ki";
  }
  // Ben Nacharbeit 4: „ohne-ki" NUR bei der eindeutigen Rückfallkonstellation — `demo: true` UND
  // gar keine Marke. Steht daneben irgendeine Marke, die die Prüfung nicht anerkennt (z. B.
  // `{ aiGenerated: true, demo: true }`), widersprechen sich die Angaben: das bleibt unbekannt,
  // schaltet keine Exportkennzeichnung ab und kann nie „validiert" ergeben.
  if (ergebnis.demo === true && ergebnis.aiGenerated === undefined) {
    return "ohne-ki";
  }
  return "unbekannt";
}

export type ErgebnisStufe = "entwurf" | "empfehlung" | "validiert";

/** Stufe einer Antwort: aus belegter Herkunft und belegter Einstufung, nie aus einer allein. */
export function ergebnisStufeFuerAntwort(
  herkunft: KiHerkunft,
  belegtGesichert: boolean,
): ErgebnisStufe {
  if (herkunft === "ki") {
    return "entwurf";
  }
  return herkunft === "ohne-ki" && belegtGesichert ? "validiert" : "empfehlung";
}

/**
 * Stufe eines VORSCHLAGS (Struktur, Umformulierung, Bildbeschreibung, Hilfe, Anreicherung): er ist
 * nie validiert. Vom Modell erzeugt → Entwurf; regelbasiert abgeleitet → Empfehlung.
 */
export function ergebnisStufeFuerVorschlag(modellErzeugt: boolean): ErgebnisStufe {
  return modellErzeugt ? "entwurf" : "empfehlung";
}

/** Die Textschlüssel der drei Stufen — EIN Ort, den Fläche, Tests und Sammler lesen. */
export const ERGEBNIS_STUFE_TEXT: Readonly<Record<ErgebnisStufe, string>> = {
  entwurf: "ergebnisStufe.entwurf",
  empfehlung: "ergebnisStufe.empfehlung",
  validiert: "ergebnisStufe.validiert",
};

/**
 * R-1020: die Entwurfsfläche — violetter gestrichelter Rahmen, violette Fläche. Dieselben Token
 * wie `ReasonerDraft` (`border-ai-dashed`, `bg-ai-surface-2`), damit es EINE Entwurfsoptik gibt.
 */
export const REASONER_ENTWURF_FLAECHE = "border border-dashed border-ai-dashed bg-ai-surface-2";
