// ================================================================================================
// R-1631 / R-1647 / R-2174 (aufnahme:20260922:gesamt-anlagenzugang) — DIE ADRESSE EINER ANLAGE.
// ================================================================================================
//
// „Ein Techniker scannt den QR-Code an der Maschine — KLARWERK öffnet automatisch das für DIESE
// Maschine relevante Wissen." Der Bezug zwischen Wissen und Anlage liegt schon am Objekt:
// `KnowledgeObject.asset` ist seit JOB 593 (Ownerentscheidung 13.08.2026) die KANONISCHE
// Anlagenkennung, normalisiert an genau einer Stelle (`services/knowledge-object/src/asset.ts`).
//
// KEIN ZWEITER LESEWEG: Die Adresse öffnet die vorhandene Bibliothek mit der Facette „Anlage"
// (`BibliothekFlaeche.tsx`). Damit gelten dort dieselben Rechte (Server-Trim der Suche), dieselbe
// Wertprüfung des Adresskeims und dieselben Kontextfilter (Bereich, Fachgebiet, Schlagwort, Reife,
// Art …), die der Mensch nach dem Scan weiter eingrenzen kann. Gelesen wird stets die geltende
// Fassung eines Objekts. Eine Anmeldung zwischen Scan und Ansicht verliert die Adresse nicht: das
// Anmeldetor zeigt seine Maske AN der aufgerufenen Adresse (`App.tsx`, `Gate`).
//
// Der Parametername ist der Facettenschlüssel (`libraryUrlFilters.ts`: ein Parameter je Dimension,
// benannt wie der Schlüssel) — kurz und lesbar, weil er auf einem Etikett steht.
export const ANLAGE_FACETTE = "anlage";

/** Die Kennung, wie sie am Objekt gespeichert ist — dieselbe Normalform wie `normalizeAsset`. */
export function anlagenKennung(wert: string | null | undefined): string | null {
  if (typeof wert !== "string") {
    return null;
  }
  const normalisiert = wert.normalize("NFC").replace(/\s+/g, " ").trim();
  return normalisiert.length > 0 ? normalisiert : null;
}

/** Die Facettenwerte der Achse „Anlage": genau die eine Kennung oder keine. */
export function anlagenWerte(wert: string | null | undefined): string[] {
  const kennung = anlagenKennung(wert);
  return kennung ? [kennung] : [];
}

/** Der Pfad innerhalb der Anwendung, der das Wissen dieser Anlage öffnet. */
export function anlagenPfad(kennung: string): string {
  const p = new URLSearchParams();
  p.set(ANLAGE_FACETTE, kennung);
  return `/bibliothek?${p.toString()}`;
}

/** Die vollständige Adresse für den QR-Code — der Ursprung ist der, unter dem KLARWERK läuft. */
export function anlagenAdresse(ursprung: string, kennung: string): string {
  return `${ursprung.replace(/\/+$/, "")}${anlagenPfad(kennung)}`;
}
