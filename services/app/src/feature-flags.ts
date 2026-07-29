// ================================================================================================
// AUFTRAG-mega46 BLOCK F — DIE EINE WAHRHEIT ÜBER DIE BETRIEBSSCHALTER.
// ================================================================================================
//
// Bis hierher las jede Stelle ihren Schalter selbst: `provenanceEnabled()` in provenance-routes,
// `confluenceImportEnabled()` in library-routes, dieselbe Prüfung noch einmal inline in
// build-app.ts, `expertMatchingEnabled()` daneben. Vier Leser, viermal dieselbe Regel abgeschrieben.
// Solange nur der Server sie las, war das lästig; sobald die OBERFLÄCHE danach fragt (F1), wird es
// gefährlich: Weicht die Auskunft von der Registrierungsentscheidung ab, zeigt die Anwendung eine
// Fläche, deren Route es nicht gibt — oder verbirgt eine, die da ist. Die Auskunft würde lügen.
//
// Deshalb liest AB HIER genau diese Datei die Schalter, und alle anderen fragen sie. Der Sammler
// `tests/app/mega46-schalter-eine-wahrheit.test.ts` hält das fest: Greift künftig jemand am
// Registry vorbei direkt auf `process.env.KLARWERK_...` eines registrierten Schalters zu, wird er
// rot — ohne dass jemand daran denken muss.
//
// WAS HIER NICHT HINEINGEHÖRT: Schalter, die WERTE tragen (URLs, Schlüssel, Grenzen, Zeitspannen).
// Das Registry führt ausschließlich JA/NEIN-Schalter, denn nur solche dürfen die Oberfläche je
// erfahren (F1: keine Werte, keine Umgebungsvariablen, keine Pfade, keine Versionen).

/**
 * DAS REGISTRY: öffentlicher Schaltername → Umgebungsvariable.
 *
 * Der öffentliche Name ist bewusst ein FACHNAME und nicht der Variablenname: Über den Draht geht
 * `herkunft`, nicht `KLARWERK_PROVENANCE_ENABLED`. Wer die Antwort abfängt, erfährt damit nichts
 * über die Umgebung, sondern nur, welche fachliche Fläche dieser Betrieb freigeschaltet hat.
 */
export const SCHALTER_REGISTRY = {
  /** AUFTRAG-mega45: die Herkunftskette eines Wissensobjekts (Route + Fläche). */
  herkunft: "KLARWERK_PROVENANCE_ENABLED",
  /** SCRUM-510: der Confluence-Space-Import (Admin-Trigger + Erkundungs-Fluss). */
  confluenceImport: "KLARWERK_CONFLUENCE_IMPORT",
  /** Consultant-System: Thema→Personen-Matching, vor BR/DSB-Freigabe unsichtbar. */
  expertMatching: "KLARWERK_EXPERT_MATCHING",
} as const;

export type SchalterName = keyof typeof SCHALTER_REGISTRY;

/** Alle registrierten Schalternamen — Grundlage für Auskunft und Sammler. */
export const SCHALTER_NAMEN = Object.keys(SCHALTER_REGISTRY) as readonly SchalterName[];

/**
 * DIE EINE AUSWERTUNGSREGEL. Vorgabe AUS, und nur ein ausdrückliches `1` oder `true` schaltet
 * scharf — „ja", „on", „yes" oder ein leerer Wert gelten NICHT. Fail-closed: Ein vertippter
 * Schalter lässt die Fläche verborgen, statt sie versehentlich zu öffnen.
 *
 * Pro Aufruf gelesen (nicht beim Modulladen zwischengespeichert), damit Tests beide Zustände im
 * selben Lauf festhalten können — dieselbe Zusage, die `provenanceEnabled()` schon gab.
 */
export function schalterAn(name: SchalterName): boolean {
  const wert = process.env[SCHALTER_REGISTRY[name]];
  return wert === "1" || wert === "true";
}

/**
 * Der Zustand ALLER registrierten Schalter als reine Ja/Nein-Abbildung — die Nutzlast der Auskunft
 * aus F1. Ein nicht gesetzter Schalter erscheint als `false`, nicht als fehlender Schlüssel: Der
 * Vertrag bleibt damit stabil, und „aus" ist von „kenne ich nicht" unterscheidbar, ohne dass
 * irgendetwas über die Umgebung verraten wird.
 */
export function schalterZustand(): Record<SchalterName, boolean> {
  const zustand = {} as Record<SchalterName, boolean>;
  for (const name of SCHALTER_NAMEN) {
    zustand[name] = schalterAn(name);
  }
  return zustand;
}
