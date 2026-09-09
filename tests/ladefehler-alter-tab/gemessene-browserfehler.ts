// ================================================================================================
// JOB 3423 · NAVIGATION-CHUNK-STAND — DIE GEMESSENEN FEHLEROBJEKTE DES ECHTEN BROWSERS.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT. Der vorhandene Fall A3 in `ladefehler-zeigt-neue-version.test.tsx`
// stellt den echten WEG nach (`lazy()` → `<Suspense>` → Fehlergrenze), wirft darin aber ein
// Fehlerobjekt, das der Test selbst BAUT — einen `TypeError` mit der Chrome-Formulierung. Damit
// misst er den Weg und nicht den Fehler: was der Browser wirklich wirft, wenn ein Chunk nach einer
// Veröffentlichung weg ist, stand nirgends. Pedis Fall vom 09.09. ist genau durch diese Lücke
// gefallen.
//
// DIE PAARE UNTEN SIND GEMESSEN, NICHT ERINNERT. Sie stammen aus einem echten Chromium:
// `echter-ladefehler-chromium.test.ts` lädt eine Seite, lässt sie `import(...)` auf Adressen
// fahren, die genau so antworten, wie Codex es am 09.09. 20:47 an `app.klarwerk.ai` gemessen hat
// (`Duplicates-CIbJ3zEu.js` → HTTP 404, `text/plain`), und liest `name` und `message` des
// abgelehnten Wertes aus. Derselbe Test PINT diese Liste: ändert ein Browser-Update seinen
// Wortlaut, wird er rot, statt dass die Erkennung still danebengreift.
//
// GENUTZT WIRD SIE ZWEIMAL: dort als Sollwert der Messung, und in
// `ladefehler-zeigt-neue-version.test.tsx` (A8) als das Objekt, das durch den echten Weg geworfen
// wird. Eine Liste, zwei Messpunkte — kein abgeschriebener Wortlaut an zwei Stellen.

/** Ein im Browser gemessenes Fehlerobjekt, reduziert auf das, was die Erkennung liest. */
export interface Browserfehler {
  /** Kurzname der Lage — steht in den Testmeldungen. */
  readonly lage: string;
  /** Wie der Server geantwortet hat (Beleg, kein Anzeigetext). */
  readonly antwort: string;
  /** `error.name`, wie ihn Chromium gesetzt hat. */
  readonly name: string;
  /** `error.message`, wörtlich — die Chunk-Adresse ist durch `<ADRESSE>` ersetzt. */
  readonly message: string;
}

/**
 * Die Adresse, die in den gemessenen Meldungen steht. Der Messtest setzt sie ein, die Nachbauten
 * ebenso — so steht der Platzhalter nur an EINER Stelle.
 */
export const MESSADRESSE = "http://localhost/assets/Duplicates-CIbJ3zEu.js";

/** Platzhalter für die Chunk-Adresse in `message` (die Adresse unterscheidet die Fälle). */
export const ADRESSE_PLATZHALTER = "<ADRESSE>";

/**
 * DIE MESSUNG (siehe `echter-ladefehler-chromium.test.ts`, dort steht die Chromium-Version des
 * Laufs in der Fehlermeldung). Vier Antworten, die ein Server nach einer Veröffentlichung wirklich
 * gibt — und die zwei verschiedenen Fehlerobjekte, die daraus entstehen.
 */
export const GEMESSENE_LADEFEHLER: readonly Browserfehler[] = [
  {
    lage: "404 text/plain — Codex' Messung an app.klarwerk.ai",
    antwort: "HTTP 404, content-type: text/plain",
    name: "TypeError",
    message: `Failed to fetch dynamically imported module: ${ADRESSE_PLATZHALTER}`,
  },
  {
    lage: "404 text/html",
    antwort: "HTTP 404, content-type: text/html",
    name: "TypeError",
    message: `Failed to fetch dynamically imported module: ${ADRESSE_PLATZHALTER}`,
  },
  {
    lage: "SPA-Rückfall: 200 mit index.html statt des Stücks",
    antwort: "HTTP 200, content-type: text/html",
    name: "TypeError",
    message: `Failed to fetch dynamically imported module: ${ADRESSE_PLATZHALTER}`,
  },
  {
    lage: "Verbindung bricht ab (Funkloch/Serverausfall)",
    antwort: "abgebrochen (ERR_FAILED)",
    name: "TypeError",
    message: `Failed to fetch dynamically imported module: ${ADRESSE_PLATZHALTER}`,
  },
];

/** Ein Nachbau des gemessenen Objekts: dieselbe Klasse, derselbe `name`, dieselbe `message`. */
export function nachbau(fehler: Browserfehler, adresse = MESSADRESSE): Error {
  const gebaut = new TypeError(fehler.message.replace(ADRESSE_PLATZHALTER, adresse));
  gebaut.name = fehler.name;
  return gebaut;
}
