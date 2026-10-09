// ================================================================================================
// ADMIN-02 — EIN STATUSMODELL FÜR ANBINDUNGEN. FÄHIGKEIT, FREISCHALTUNG, ANGABEN, TEST, HISTORIE.
// ================================================================================================
//
// DER BEFUND (UI-Beobachtung 09.10.2026): Die Systemkachel „SharePoint" sagte „aktiv", während der
// Zugangsbereich derselben Seite „in dieser Installation nicht eingeschaltet" meldete. Zwei Aussagen
// über dieselbe Anbindung, und die Kachel war die falsche: sie war ein festes Datenmodell und
// wusste nichts von dieser Installation.
//
// DIE REGEL: Jede Fläche, die über den Zustand einer Anbindung spricht, leitet ihn HIER ab — aus
// der Zugangsauskunft des Servers (`ImportAccessService`) und nichts sonst. Fünf Zustände, und
// jeder hängt an einer eigenen, getrennt sichtbaren Tatsache:
//
//   "ausgeschaltet"       die Installation hat den Import nicht freigeschaltet (Schalter)
//   "nicht-eingerichtet"  freigeschaltet, aber die nötigen Angaben fehlen oder taugen nicht
//   "konfiguriert"        Angaben stehen — ob die Gegenstelle sie annimmt, ist NICHT geprüft
//   "geprueft"            der letzte Verbindungstest hat eine Antwort der Gegenstelle bekommen
//   "fehlgeschlagen"      der letzte Verbindungstest ist gescheitert (Grund im Testergebnis)
//
// „Verfügbar" ist KEIN Zustand dieser Installation, sondern die Fähigkeit des Produkts — die
// Galerie zeigt ihn nur, solange noch keine Auskunft vorliegt (`importSourceGallery.ts`).
//
// WAS HIER BEWUSST NICHT ZÄHLT: ein alter erfolgreicher Import (`lastConnectedAt`). Er ist ein
// historischer Nachweis und kein Verbindungsnachweis — er wird daneben als solcher gezeigt, macht
// aber keinen Zustand „geprüft". Hinterlegte Angaben allein ebenso wenig: sie ergeben „konfiguriert".
import { importAccessState } from "./importAccessState";

export type IntegrationStatus =
  | "ausgeschaltet"
  | "nicht-eingerichtet"
  | "konfiguriert"
  | "geprueft"
  | "fehlgeschlagen";

/** Die Ergebniswörter des Servers (`VerbindungstestErgebnis`, import-access-service.ts). */
export type VerbindungstestErgebnis =
  | "erreichbar"
  | "ausgeschaltet"
  | "nicht-eingerichtet"
  | "anmeldung-abgewiesen"
  | "keine-berechtigung"
  | "nicht-gefunden"
  | "zeitueberschreitung"
  | "nicht-erreichbar";

export interface Verbindungsnachweis {
  geprueftAm: string;
  /** `bibliothek-lesen` = SharePoint, `space-lesen` = Confluence; `konfiguration` = ohne Abruf. */
  umfang: "konfiguration" | "bibliothek-lesen" | "space-lesen";
  ergebnis: VerbindungstestErgebnis;
  dauerMs: number | null;
}

export interface IntegrationFacts {
  enabled: boolean;
  credentialsUsable: boolean;
  letzterVerbindungstest?: Verbindungsnachweis | null;
}

/**
 * Die Ableitung. Schalter und Angaben gehen VOR dem Testergebnis: ein grüner Test von gestern macht
 * eine heute ausgeschaltete oder unvollständige Anbindung nicht nutzbar.
 */
export function integrationStatus(facts: IntegrationFacts): IntegrationStatus {
  const zugang = importAccessState(facts);
  if (zugang === "disabled") {
    return "ausgeschaltet";
  }
  if (zugang === "no-credentials") {
    return "nicht-eingerichtet";
  }
  const test = facts.letzterVerbindungstest;
  // Ein Test, der nur die Konfiguration sah (damals aus/ohne Angaben), sagt über den heutigen,
  // eingerichteten Stand nichts — er zählt wie „noch nicht geprüft".
  if (!test || test.umfang === "konfiguration") {
    return "konfiguriert";
  }
  return test.ergebnis === "erreichbar" ? "geprueft" : "fehlgeschlagen";
}

/** Je Zustand ein Kurztext (Abzeichen) — Text, nicht nur Farbe. */
export const INTEGRATION_STATUS_TEXT: Record<
  IntegrationStatus,
  { key: string; tone: "pos" | "warn" | "neutral" }
> = {
  ausgeschaltet: { key: "integrationen.status.ausgeschaltet", tone: "neutral" },
  "nicht-eingerichtet": { key: "integrationen.status.nichtEingerichtet", tone: "warn" },
  konfiguriert: { key: "integrationen.status.konfiguriert", tone: "neutral" },
  geprueft: { key: "integrationen.status.geprueft", tone: "pos" },
  fehlgeschlagen: { key: "integrationen.status.fehlgeschlagen", tone: "warn" },
};

/** Je Testergebnis das Wort UND der konkrete nächste Schritt. Keiner geteilt, keiner geliehen. */
export const VERBINDUNGSTEST_TEXT: Record<
  VerbindungstestErgebnis,
  { ergebnisKey: string; schrittKey: string }
> = {
  erreichbar: {
    ergebnisKey: "integrationen.test.ergebnis.erreichbar",
    schrittKey: "integrationen.test.schritt.erreichbar",
  },
  ausgeschaltet: {
    ergebnisKey: "integrationen.test.ergebnis.ausgeschaltet",
    schrittKey: "integrationen.test.schritt.ausgeschaltet",
  },
  "nicht-eingerichtet": {
    ergebnisKey: "integrationen.test.ergebnis.nichtEingerichtet",
    schrittKey: "integrationen.test.schritt.nichtEingerichtet",
  },
  "anmeldung-abgewiesen": {
    ergebnisKey: "integrationen.test.ergebnis.anmeldungAbgewiesen",
    schrittKey: "integrationen.test.schritt.anmeldungAbgewiesen",
  },
  "keine-berechtigung": {
    ergebnisKey: "integrationen.test.ergebnis.keineBerechtigung",
    schrittKey: "integrationen.test.schritt.keineBerechtigung",
  },
  "nicht-gefunden": {
    ergebnisKey: "integrationen.test.ergebnis.nichtGefunden",
    schrittKey: "integrationen.test.schritt.nichtGefunden",
  },
  zeitueberschreitung: {
    ergebnisKey: "integrationen.test.ergebnis.zeitueberschreitung",
    schrittKey: "integrationen.test.schritt.zeitueberschreitung",
  },
  "nicht-erreichbar": {
    ergebnisKey: "integrationen.test.ergebnis.nichtErreichbar",
    schrittKey: "integrationen.test.schritt.nichtErreichbar",
  },
};

/** Was der Test geprüft hat — in Worten, nicht als Kürzel. */
export const VERBINDUNGSTEST_UMFANG_TEXT: Record<Verbindungsnachweis["umfang"], string> = {
  konfiguration: "integrationen.test.umfang.konfiguration",
  "bibliothek-lesen": "integrationen.test.umfang.bibliothekLesen",
  "space-lesen": "integrationen.test.umfang.spaceLesen",
};

// ================================================================================================
// ADMIN-02 (Nacharbeit 2) — CONFLUENCE AM SELBEN MODELL. EIGENE SCHRITTE, DIESELBE ABLEITUNG.
// ================================================================================================
//
// Ergebniswörter und Zustände sind quellneutral und werden geteilt. Die NÄCHSTEN SCHRITTE sind es
// nicht: sie nennen die Umgebungsvariablen und Begriffe des jeweiligen Systems (Bibliothek gegen
// Space, Token gegen Benutzer+Token). Ein SharePoint-Satz unter Confluence schickte den Menschen
// an die falsche Stellschraube.
type ConfluenceSchrittFall = VerbindungstestErgebnis | "konfiguriert" | "betreiberAus";

const CONFLUENCE_SCHRITT: Record<ConfluenceSchrittFall, string> = {
  erreichbar: "integrationen.confluence.schritt.erreichbar",
  ausgeschaltet: "integrationen.confluence.schritt.ausgeschaltet",
  "nicht-eingerichtet": "integrationen.confluence.schritt.nichtEingerichtet",
  "anmeldung-abgewiesen": "integrationen.confluence.schritt.anmeldungAbgewiesen",
  "keine-berechtigung": "integrationen.confluence.schritt.keineBerechtigung",
  "nicht-gefunden": "integrationen.confluence.schritt.nichtGefunden",
  zeitueberschreitung: "integrationen.confluence.schritt.zeitueberschreitung",
  "nicht-erreichbar": "integrationen.confluence.schritt.nichtErreichbar",
  konfiguriert: "integrationen.confluence.schritt.konfiguriert",
  betreiberAus: "integrationen.confluence.schritt.betreiberAus",
};

export type IntegrationSystem = "sharepoint" | "confluence";

/**
 * Der konkrete nächste Schritt — zu JEDEM Zustand einer. Geprüfte und gescheiterte Stände folgen
 * ihrem Testergebnis, alle anderen ihrem Zustand. `betreiberAus` (nur Confluence): freigegeben, aber
 * vom Betreiber ausgeschaltet — dann führt der Schritt zum Knopf, nicht zum Server.
 */
export function naechsterSchrittKey(
  system: IntegrationSystem,
  status: IntegrationStatus,
  test: Verbindungsnachweis | null,
  betreiberAus = false,
): string {
  const mitTest = (status === "geprueft" || status === "fehlgeschlagen") && test !== null;
  if (system === "confluence") {
    if (betreiberAus) {
      return CONFLUENCE_SCHRITT.betreiberAus;
    }
    if (mitTest) {
      return CONFLUENCE_SCHRITT[test.ergebnis];
    }
    return status === "ausgeschaltet"
      ? CONFLUENCE_SCHRITT.ausgeschaltet
      : status === "nicht-eingerichtet"
        ? CONFLUENCE_SCHRITT["nicht-eingerichtet"]
        : CONFLUENCE_SCHRITT.konfiguriert;
  }
  if (mitTest) {
    return VERBINDUNGSTEST_TEXT[test.ergebnis].schrittKey;
  }
  return INTEGRATION_SCHRITT_OHNE_TEST[
    status as Exclude<IntegrationStatus, "geprueft" | "fehlgeschlagen">
  ];
}

/** Der nächste Schritt für einen Zustand OHNE Testergebnis (ausgeschaltet, ohne Angaben, ungeprüft). */
export const INTEGRATION_SCHRITT_OHNE_TEST: Record<
  Exclude<IntegrationStatus, "geprueft" | "fehlgeschlagen">,
  string
> = {
  ausgeschaltet: "integrationen.test.schritt.ausgeschaltet",
  "nicht-eingerichtet": "integrationen.test.schritt.nichtEingerichtet",
  konfiguriert: "integrationen.schritt.konfiguriert",
};

/** Der jüngere von zwei Nachweisen — für „gerade geprüft" gegen „aus der Auskunft gelesen". */
export function juengererNachweis(
  a: Verbindungsnachweis | null | undefined,
  b: Verbindungsnachweis | null | undefined,
): Verbindungsnachweis | null {
  if (!a || !b) {
    return a ?? b ?? null;
  }
  return Date.parse(a.geprueftAm) >= Date.parse(b.geprueftAm) ? a : b;
}
