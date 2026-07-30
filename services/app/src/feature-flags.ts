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
  /** AUFTRAG-mega61 Block A: die beiden Rechtsseiten /impressum und /datenschutz. */
  rechtsseiten: "KLARWERK_RECHTSSEITEN",
  /**
   * AUFTRAG-mega61 Block B: der Hinweis zu Endgerätespeicher und KI-Transparenz.
   *
   * AUFTRAG-mega62 Block A: Er hat ZWEI Flächen — den Banner in der Anwendungshülle (mit
   * Kenntnisnahme am Konto) und denselben Text ohne Knöpfe auf der Anmeldemaske. Dieser Schalter
   * deckt BEIDE. Bis mega61 deckte er nur die erste, womit die Auskunft „Notausschalter dieser
   * Pflichtfläche" nur für die Hälfte stimmte; der GEMOUNTETE Beleg über die Anmeldemaske steht in
   * apps/web/src/legal/mega62-hinweis-ein-schalter.test.tsx.
   */
  hinweisbanner: "KLARWERK_HINWEISBANNER",
  /**
   * AUFTRAG-mega64 Block A: das Laden der Demodaten (`POST /api/admin/demo-seed`).
   *
   * WARUM DIESES WERKZEUG EINEN SCHALTER BRAUCHT: Es legt Konten an — bis mega64 mit im Quelltext
   * festgeschriebenen Kennwörtern, ab mega64 mit Einmalkennwörtern. Die Route war in JEDER App
   * bedingungslos registriert (Befund ben, BERICHT-ben-sammel61-mega63.md, Finding 1) und hatte als
   * einzige Hürde `users.manage`. Ein Werkzeug, das Konten anlegt, gehört nicht zur normalen
   * Ausstattung eines Betriebs, sondern ist eine ausdrücklich eingeschaltete Vorführhilfe.
   *
   * WARUM VORGABE AUS, OHNE AUSNAHME — und das ist der Grund, aus dem er NICHT in
   * `SCHALTER_VORGABE_AN` steht, obwohl die zwei Schalter darüber es sind: Die Vorgabe AN ist die
   * richtige Richtung für eine PFLICHTANGABE, deren stilles Fehlen der Schaden wäre. Hier ist es
   * genau umgekehrt — der Schaden ist die stille ANWESENHEIT. Ein Werkzeug, das Konten anlegt, darf
   * nicht dadurch scharf sein, dass niemand widersprochen hat.
   *
   * Er steht ebenso NICHT in `SCHALTER_VOR_ANMELDUNG`: welche Werkzeuge ein Betrieb freigeschaltet
   * hat, geht einen Unangemeldeten nichts an, und diese Fläche liegt ohnehin hinter `users.manage`.
   */
  demodaten: "KLARWERK_DEMO_SEED",
} as const;

export type SchalterName = keyof typeof SCHALTER_REGISTRY;

/** Alle registrierten Schalternamen — Grundlage für Auskunft und Sammler. */
export const SCHALTER_NAMEN = Object.keys(SCHALTER_REGISTRY) as readonly SchalterName[];

// ================================================================================================
// AUFTRAG-mega61 — DIE ZWEITE AUSWERTUNGSART: NOTAUSSCHALTER STATT SPERRE.
// ================================================================================================
//
// Bis mega60 hatte jeder Schalter dieselbe Richtung: Vorgabe AUS, ein ausdrückliches `1`/`true`
// schaltet scharf. Das ist die richtige Vorgabe für eine FÄHIGKEIT, die noch niemand freigegeben
// hat — ein Vertipper verbirgt sie, statt sie versehentlich zu öffnen.
//
// Die beiden Flächen aus mega61 sind keine Fähigkeit, sondern eine PFLICHTANGABE (Impressum,
// Datenschutzerklärung, Transparenzhinweis). Für sie ist dieselbe Vorgabe falsch herum: eine
// Rechtsseite, die nach einem Konfigurationsfehler still fehlt, ist genau der Zustand, den man
// nicht haben will. Pedis Entscheidung vom 30.07.2026: sie sind SICHTBAR, und der Schalter ist ein
// Notausschalter für den Fall, dass eine Fläche im Betrieb stört — keine Freigabesperre.
//
// Die Regel bleibt trotzdem STRENG in ihrer Richtung: nur ein ausdrückliches `0` oder `false`
// schaltet ab. „nein", „off", „no" oder ein leerer Wert gelten NICHT — wer abschalten will, muss
// es genauso eindeutig sagen wie sonst jemand, der einschalten will.
const SCHALTER_VORGABE_AN = new Set<SchalterName>(["rechtsseiten", "hinweisbanner"]);

/** Steht dieser Schalter ohne gesetzte Umgebungsvariable auf AN? (Nachweis für Tests und Bericht.) */
export function vorgabeAn(name: SchalterName): boolean {
  return SCHALTER_VORGABE_AN.has(name);
}

// ================================================================================================
// AUFTRAG-mega61 Block A — WELCHE SCHALTER SCHON VOR DER ANMELDUNG BEANTWORTET WERDEN.
// ================================================================================================
//
// Die Begründung in features-routes.ts für `requireUser` lautete: „die Oberfläche braucht sie erst
// NACH dem Anmelden (vorher gibt es nur die Anmeldemaske)". Diese Prämisse gilt seit mega61 nicht
// mehr — /impressum und /datenschutz sind ohne Anmeldung erreichbar (sie MÜSSEN es sein, weil die
// Datenschutzerklärung vor der ersten Datenerhebung verfügbar sein muss), und der Fußbereich mit
// ihren Links steht auf der Anmeldemaske.
//
// Statt eine zweite Route zu bauen (das wäre die zweite Wahrheit, die mega46 gerade beseitigt hat),
// antwortet DIESELBE Auskunft ohne Sitzung mit dieser TEILMENGE. Alles andere bleibt hinter der
// Anmeldung — welche Fähigkeiten ein Betrieb freigeschaltet hat, geht einen Unangemeldeten nichts an.
const SCHALTER_VOR_ANMELDUNG = new Set<SchalterName>(["rechtsseiten", "hinweisbanner"]);

/**
 * DIE EINE AUSWERTUNGSREGEL. Zwei Richtungen, je nach Art des Schalters, und beide fail-safe in die
 * Richtung, die für ihre Art richtig ist:
 *
 *   · Fähigkeit (Vorgabe AUS): nur `1` oder `true` schaltet scharf. Ein vertippter Schalter lässt
 *     die Fläche verborgen, statt sie versehentlich zu öffnen.
 *   · Pflichtangabe (Vorgabe AN, s. SCHALTER_VORGABE_AN): nur `0` oder `false` schaltet ab. Ein
 *     vertippter Schalter lässt die Angabe stehen, statt sie versehentlich verschwinden zu lassen.
 *
 * Pro Aufruf gelesen (nicht beim Modulladen zwischengespeichert), damit Tests beide Zustände im
 * selben Lauf festhalten können — dieselbe Zusage, die `provenanceEnabled()` schon gab.
 */
export function schalterAn(name: SchalterName): boolean {
  const wert = process.env[SCHALTER_REGISTRY[name]];
  if (SCHALTER_VORGABE_AN.has(name)) {
    return !(wert === "0" || wert === "false");
  }
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

/**
 * AUFTRAG-mega61 Block A: derselbe Zustand für einen UNANGEMELDETEN Aufrufer — beschränkt auf die
 * Schalter, deren Fläche vor der Anmeldung überhaupt erreichbar ist (SCHALTER_VOR_ANMELDUNG).
 *
 * Bewusst eine TEILMENGE derselben Abbildung und kein eigener Vertrag: Der Leser in der Oberfläche
 * (`FeatureGate`) wertet einen fehlenden Schlüssel wie „aus" aus (`?? false`) — ein Unangemeldeter
 * sieht damit für jede andere Fläche genau das, was er sehen soll, ohne dass hier eine zweite
 * Auswertungsregel entsteht.
 */
export function schalterZustandVorAnmeldung(): Partial<Record<SchalterName, boolean>> {
  const zustand: Partial<Record<SchalterName, boolean>> = {};
  for (const name of SCHALTER_NAMEN) {
    if (SCHALTER_VOR_ANMELDUNG.has(name)) {
      zustand[name] = schalterAn(name);
    }
  }
  return zustand;
}
