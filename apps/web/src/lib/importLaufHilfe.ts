// ================================================================================================
// ADMIN-02 (Nacharbeit 2) — DIE IMPORTLISTE: STATUS, ZEITRAUM UND FEHLERHILFE JE LAUF.
// ================================================================================================
//
// REIN UND OHNE DOM, damit die Ableitung ohne montierte Fläche prüfbar ist: Lauf hinein,
// i18n-Schlüssel heraus. Gelesen wird ausschliesslich, was der Lauf selbst führt (Status,
// Zeitpunkte, Fehlercode) — kein zweiter Leser, keine geratene Ursache.
//
// DIE REGEL FÜR UNBEKANNTES: Ein Fehlercode ohne eigenen Satz bekommt den Satz „nicht näher
// erklärt" MIT dem Code — er ist der Suchbegriff für den Betrieb. Ein unbekannter Status heisst
// „Zustand unbekannt", nie „abgeschlossen".
import type { ImportRunRecord } from "../api/types";

/** Die Läufe, die noch arbeiten — für sie gilt „läuft", nicht „hängt" oder „fertig". */
const LAUFEND = new Set([
  "QUEUED",
  "FETCHING",
  "PERSISTING_SOURCE",
  "EXTRACTING",
  "CREATING_KNOWLEDGE",
  "ANALYZING",
]);

const BEKANNTE_STATUS = new Set([...LAUFEND, "COMPLETED", "PARTIAL", "FAILED"]);

/** Fehlercode des Laufs → konkreter nächster Schritt. Nur Codes mit eindeutiger Bedeutung. */
const CODE_HILFE: Record<string, string> = {
  IMPORT_UNAVAILABLE: "integrationen.liste.hilfe.nichtEingerichtet",
  IMPORT_SWITCHED_OFF: "integrationen.liste.hilfe.ausgeschaltet",
  SHAREPOINT_FORBIDDEN: "integrationen.liste.hilfe.keineBerechtigung",
  SHAREPOINT_NOT_FOUND: "integrationen.liste.hilfe.nichtGefunden",
  SHAREPOINT_UNREACHABLE: "integrationen.liste.hilfe.nichtErreichbar",
  CONFLUENCE_TIMEOUT: "integrationen.liste.hilfe.zeitueberschreitung",
  CONFLUENCE_BUDGET: "integrationen.liste.hilfe.zeitueberschreitung",
  CONFLUENCE_RESPONSE_TOO_LARGE: "integrationen.liste.hilfe.zuGross",
  SHAREPOINT_CONTENT_TOO_LARGE: "integrationen.liste.hilfe.zuGross",
};

export interface LaufHilfe {
  /** i18n-Schlüssel des Satzes. */
  key: string;
  /** Der Fehlercode, wenn der Satz ihn nennt (unbekannte Codes). */
  code: string | null;
}

/** Die Fehlerhilfe — zu JEDEM Lauf ein Satz, nie ein leeres Feld. */
export function laufHilfe(run: Pick<ImportRunRecord, "status" | "failureCode">): LaufHilfe {
  if (LAUFEND.has(run.status)) {
    return { key: "integrationen.liste.hilfe.laeuft", code: null };
  }
  if (run.status === "COMPLETED") {
    return { key: "integrationen.liste.hilfe.fertig", code: null };
  }
  if (run.status === "PARTIAL" || run.status === "FAILED") {
    const code = run.failureCode;
    if (code && CODE_HILFE[code]) {
      return { key: CODE_HILFE[code] as string, code: null };
    }
    if (code) {
      return { key: "integrationen.liste.hilfe.unbekannterCode", code };
    }
    return {
      key:
        run.status === "PARTIAL"
          ? "integrationen.liste.hilfe.teilweise"
          : "integrationen.liste.hilfe.fehlgeschlagen",
      code: null,
    };
  }
  return { key: "integrationen.liste.hilfe.zustandUnbekannt", code: null };
}

/** Der Statustext — der vorhandene Satz je Laufstatus, sonst „Zustand unbekannt". */
export function laufStatusKey(status: string): string {
  return BEKANNTE_STATUS.has(status) ? `w2.run.status.${status}` : "w2.run.status.unknown";
}

export function laeuftNoch(status: string): boolean {
  return LAUFEND.has(status);
}

/** Der Anzeigename einer Quelle — die vorhandenen Galerienamen; Unbekanntes bleibt sein Schlüssel. */
export const QUELLE_NAME: Record<string, string> = {
  confluence: "imp.gallery.src.confluence",
  sharepoint: "imp.gallery.src.sharepoint",
  jira: "imp.gallery.src.jira",
  json: "imp.gallery.src.jsonImport",
};
