// ================================================================================================
// AUFTRAG-mega67 BLOCK D — ZUSTÄNDE MIT EIGENEN TEXTEN, KEINER BEHAUPTET MEHR ALS ABLESBAR.
// AUFTRAG-mega69 BLOCK B3 (bens sammel65-Auflage 3) — EHRLICH AUF DREI ZUSTÄNDE VERENGT.
// ================================================================================================
//
// „Freigabe" heißt im Bestand etwas sehr Konkretes: `KLARWERK_CONFLUENCE_IMPORT` entscheidet, ob die
// Import-Routen überhaupt REGISTRIERT werden (build-app.ts:1043) — steht der Schalter aus, existiert
// die Route nicht. Diese Ableitung zeigt das an, statt es zu verbergen.
//
// WARUM DREI UND NICHT MEHR VIER: mega67 definierte zusätzlich „not-built" (Quelle: der
// Kachel-Zustand „soon"/„planned" der Galerie). bens Befund (BERICHT-ben-sammel65-mega67, 3.2): die
// EINZIGE Produktionsaufrufstelle übergab fest "active" — „not-built" war in der realen Fläche
// unerreichbar, und der Test „die vier Texte" erzeugte nur drei Fälle. Diese Fläche beschreibt
// bewusst nur den GEBAUTEN Confluence-Adapter; ein Vertrag über Zustände, die sie nie zeigen kann,
// ist eine Behauptung ohne Beleg. Wenn eines Tages eine Fläche den Zugangszustand eines NICHT
// gebauten Systems zeigen soll, gehört der Zustand mit ihr zusammen (wieder) eingeführt — samt
// gemountetem Fall, der ihn erreicht.
//
// DIE DREI ZUSTÄNDE:
//   "ready"           eingeschaltet UND die Zugangsdaten stehen
//   "no-credentials"  eingeschaltet, aber ohne (vollständige/brauchbare) Zugangsdaten
//   "disabled"        in DIESER Installation nicht eingeschaltet
//
// ================================================================================================
// ZWEI WORTE, DIE HIER BEWUSST NICHT FALLEN.
// ================================================================================================
//
// (1) NICHT „vorübergehend nicht verfügbar" für `disabled`. Bei uns heißt ausgeschaltet WÖRTLICH,
//     dass die Route nicht existiert — das ist kein vorübergehender Betriebszustand, sondern eine
//     Entscheidung dieser Installation. „Vorübergehend" verspräche, dass es von selbst wiederkommt.
//
// (2) NICHT „verbunden" für `ready`. Der Entwurf nannte diesen Zustand „eingeschaltet und
//     verbunden" — aber VERBUNDEN kann niemand wissen, ohne Confluence anzurufen, und genau das
//     verbietet Block C („Kein Aufruf an das Fremdsystem, um den Zustand zu bestimmen"). Ablesbar
//     ist: der Schalter steht, und die vier Variablen stehen. Ob die Zugangsdaten GÜLTIG sind,
//     zeigt erst der erste echte Import — und der Text sagt das auch.
//     Das ist dieselbe Klasse wie die 24-Stunden-Zusage aus mega65: lieber die schmalere wahre
//     Aussage als die breitere, für die es keinen Beleg gibt.

export type ImportAccessState = "ready" | "no-credentials" | "disabled";

export interface ImportAccessFacts {
  /** Der Schalter dieses Systems — steht er aus, existieren seine Routen nicht. */
  enabled: boolean;
  /** Kämen mit den hinterlegten Variablen Zugangsdaten zustande? (Nicht: sind sie gültig.) */
  credentialsUsable: boolean;
}

// `facts` ist PFLICHT und bewusst nicht optional: „noch keine Auskunft" ist KEINER dieser drei
// Zustände, und diese Funktion soll ihn auch nicht erfinden können. Wer keine Auskunft hat, zeigt
// gar nichts — das entscheidet die Fläche (components/ImportAccessPanel.tsx), bevor sie hier fragt.
export function importAccessState(facts: ImportAccessFacts): ImportAccessState {
  if (!facts.enabled) {
    return "disabled";
  }
  return facts.credentialsUsable ? "ready" : "no-credentials";
}

/** Je Zustand ein EIGENER, benannter Text — keiner geliehen, keiner geteilt. */
export const IMPORT_ACCESS_TEXT: Record<
  ImportAccessState,
  { titleKey: string; bodyKey: string; tone: "pos" | "warn" | "neutral" }
> = {
  ready: {
    titleKey: "imp.access.ready.title",
    bodyKey: "imp.access.ready.body",
    tone: "pos",
  },
  "no-credentials": {
    titleKey: "imp.access.noCredentials.title",
    bodyKey: "imp.access.noCredentials.body",
    tone: "warn",
  },
  disabled: {
    titleKey: "imp.access.disabled.title",
    bodyKey: "imp.access.disabled.body",
    tone: "neutral",
  },
};

/**
 * Der Zusatzgrund, wenn alle Variablen stehen und es TROTZDEM nicht geht. Ohne ihn wäre dieser Fall
 * von „eine Variable fehlt" ununterscheidbar — und die Fläche hätte genau die Frage nicht
 * beantwortet, für die sie gebaut ist.
 */
export const IMPORT_ACCESS_BLOCKER_TEXT: Record<string, string> = {
  missing: "imp.access.blocker.missing",
  "insecure-base-url": "imp.access.blocker.insecureBaseUrl",
};

// ================================================================================================
// R-0134 / R-1005 / R-0159 — DER SCHALTER WIRKT AUF DIE BEDIENUNG, UND FEHLER HABEN WORTE.
// ================================================================================================
//
// Bis hierher las nur der Zugangskasten den Schalter. Der Startknopf der Lauf-Karte stand auch bei
// ausgeschaltetem Import da; ein Klick lief gegen eine Route, die es nicht gibt (404), und der
// Mensch las „Fehler". Ab hier liest die Lauf-Karte DENSELBEN Zustand (`importAccessState`) und
// sperrt den Start mit Grund, solange er nicht „ready" ist — kein zweiter Schalterleser.

/** Warum der Start gesperrt ist — `null` heißt: nicht gesperrt. Je Grund ein eigener Text. */
export const IMPORT_START_GESPERRT_TEXT: Record<Exclude<ImportAccessState, "ready">, string> = {
  disabled: "w2.run.gesperrt.disabled",
  "no-credentials": "w2.run.gesperrt.noCredentials",
};

/**
 * Der Text zu einer abgelehnten Startanfrage — aus Status und Code der Antwort, nie aus ihrem
 * Wortlaut (der ist deutsch und kann sich ändern). Unbekanntes bleibt beim allgemeinen Fehlertext:
 * lieber „Fehler" als eine Erklärung, die nicht belegt ist.
 *
 *   404  die Route existiert nicht ⇒ der Schalter steht (inzwischen) aus
 *   403  das Recht fehlt
 *   503  `IMPORT_UNAVAILABLE` — eingeschaltet, aber ohne brauchbare Zugangsdaten
 *   504  `CONFLUENCE_TIMEOUT` / `CONFLUENCE_BUDGET` — Confluence hat nicht rechtzeitig geantwortet
 */
export function importStartFehlerKey(status: number, code: string): string {
  if (code === "CONFLUENCE_TIMEOUT" || code === "CONFLUENCE_BUDGET") {
    return "w2.run.startFehler.zeitlimit";
  }
  if (code === "IMPORT_UNAVAILABLE") {
    return "w2.run.startFehler.nichtKonfiguriert";
  }
  if (status === 404) {
    return "w2.run.startFehler.ausgeschaltet";
  }
  if (status === 403) {
    return "w2.run.startFehler.keinRecht";
  }
  return "state.error";
}

/**
 * Die verständliche Erklärung zu einem Fehlercode eines Laufs. Der Code selbst bleibt sichtbar
 * (er ist der Suchbegriff für den Betrieb); dies ist der Satz daneben, in der Sprache der Fläche.
 * Nur Codes mit EINDEUTIGER Bedeutung stehen hier — `IMPORT_FAILED` etwa kann vieles heißen.
 */
export const IMPORT_FAILURE_CODE_TEXT: Record<string, string> = {
  CONFLUENCE_TIMEOUT: "w2.run.failureText.CONFLUENCE_TIMEOUT",
  CONFLUENCE_BUDGET: "w2.run.failureText.CONFLUENCE_BUDGET",
  CONFLUENCE_RESPONSE_TOO_LARGE: "w2.run.failureText.CONFLUENCE_RESPONSE_TOO_LARGE",
  IMPORT_UNAVAILABLE: "w2.run.failureText.IMPORT_UNAVAILABLE",
};
