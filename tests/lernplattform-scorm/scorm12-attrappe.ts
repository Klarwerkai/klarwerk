// produkt:wettbewerb:20261003:lernplattform — EINE SCORM-1.2-LAUFZEITSEITE FÜR DEN TEST.
//
// WAS DAS IST: die LMS-Seite der SCORM-1.2-Laufzeit (RTE 1.2, `window.API` mit den acht
// `LMS…`-Funktionen), so schmal wie möglich und so streng wie nötig: Aufrufe vor `LMSInitialize`
// oder nach `LMSFinish` scheitern (301), unbekannte Elemente scheitern (201), `lesson_status` nimmt
// nur die sechs Werte des Standards an (405). Gespeichert gilt — wie in einem LMS — nur, was bis
// zum letzten `LMSCommit`/`LMSFinish` übergeben wurde.
//
// WAS DAS NICHT IST: ein Lernmanagementsystem. Ob Moodle 4.5 das Paket importiert und anzeigt, belegt
// diese Attrappe NICHT; das bleibt die offene Abnahme am echten Referenzsystem
// (docs/lernplattform-scorm.md, Abschnitt „Abnahme am Referenzsystem").
//
// SCHMALE STRUKTUR-TYPEN STATT DOM-LIB: der Gate-tsc läuft Node-rein, `@types/jsdom` gibt es hier
// nicht — dieselbe Bauform wie `tests/klara-zerlegung/panel-lauf.ts`.
import { createRequire } from "node:module";

export interface ElementLike {
  readonly textContent: string | null;
  hidden: boolean;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  click(): void;
}

export interface DokumentLike {
  readonly documentElement: { lang: string };
  getElementById(id: string): ElementLike | null;
  querySelectorAll(auswahl: string): ArrayLike<ElementLike>;
  getElementsByTagName(name: string): ArrayLike<ElementLike>;
  readonly body: ElementLike;
}

export interface FensterLike {
  readonly document: DokumentLike;
  API?: unknown;
  eval(code: string): unknown;
  dispatchEvent(e: unknown): boolean;
  Event: new (typ: string) => unknown;
  DOMParser: new () => {
    parseFromString(text: string, typ: string): DokumentLike;
  };
  close(): void;
}

interface JsdomModul {
  JSDOM: new (html: string, opts?: Record<string, unknown>) => { window: FensterLike };
}

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom") as JsdomModul;

export function fenster(html: string): FensterLike {
  return new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: false }).window;
}

export function xml(text: string): DokumentLike {
  return new (fenster("<!DOCTYPE html><html></html>").DOMParser)().parseFromString(
    text,
    "application/xml",
  );
}

const LESSON_STATUS = new Set([
  "passed",
  "completed",
  "failed",
  "incomplete",
  "browsed",
  "not attempted",
]);

const SCHREIBBAR = new Set([
  "cmi.core.lesson_status",
  "cmi.core.lesson_location",
  "cmi.core.exit",
  "cmi.core.session_time",
  "cmi.suspend_data",
]);

const LESBAR = new Set([
  "cmi.core.lesson_status",
  "cmi.core.lesson_location",
  "cmi.suspend_data",
  "cmi.core.entry",
  "cmi.core.student_id",
  "cmi.core.student_name",
]);

export class Scorm12Attrappe {
  /** Was der Lernende in dieser Sitzung gerade setzt (noch nicht gespeichert). */
  private arbeit: Record<string, string>;
  /** Was die „Plattform" gespeichert hat — der Stand nach dem letzten Commit/Finish. */
  gespeichert: Record<string, string>;
  readonly aufrufe: string[] = [];
  private zustand: "neu" | "laeuft" | "beendet" = "neu";
  private fehler = "0";
  finishZahl = 0;
  /** Elemente, deren Schreiben die Plattform ablehnt (simulierter Plattformfehler). */
  readonly abgelehnt = new Set<string>();
  /**
   * Netzunterbrechung (Moodle-Befund, nacharbeit-3): `LMSSetValue` gelingt im Browser, aber das
   * Speichern beim Server scheitert — `LMSCommit` liefert "false", nichts wird gespeichert. Der
   * Fehlercode bleibt dabei bewusst "0": genau so hat das Paket im Moodle-Referenzlauf trotzdem
   * „gemeldet" angezeigt. Nur die Rückgabe von `LMSCommit` verrät den Ausfall.
   */
  netzGetrennt = false;

  constructor(vorher: Record<string, string> = {}) {
    this.gespeichert = {
      "cmi.core.lesson_status": "not attempted",
      "cmi.core.lesson_location": "",
      "cmi.suspend_data": "",
      "cmi.core.entry": "ab-initio",
      "cmi.core.student_id": "beispiel-lernende",
      "cmi.core.student_name": "Lernende, Beispiel",
      ...vorher,
    };
    this.arbeit = { ...this.gespeichert };
  }

  LMSInitialize(arg: string): string {
    this.aufrufe.push(`LMSInitialize(${arg})`);
    if (arg !== "" || this.zustand !== "neu") {
      this.fehler = "101";
      return "false";
    }
    this.zustand = "laeuft";
    this.fehler = "0";
    return "true";
  }

  LMSGetValue(el: string): string {
    this.aufrufe.push(`LMSGetValue(${el})`);
    if (this.zustand !== "laeuft") {
      this.fehler = "301";
      return "";
    }
    if (!LESBAR.has(el)) {
      this.fehler = "201";
      return "";
    }
    this.fehler = "0";
    return this.arbeit[el] ?? "";
  }

  LMSSetValue(el: string, wert: string): string {
    this.aufrufe.push(`LMSSetValue(${el},${wert})`);
    if (this.zustand !== "laeuft") {
      this.fehler = "301";
      return "false";
    }
    if (!SCHREIBBAR.has(el)) {
      this.fehler = "201";
      return "false";
    }
    if (el === "cmi.core.lesson_status" && !LESSON_STATUS.has(wert)) {
      this.fehler = "405";
      return "false";
    }
    if (el === "cmi.core.exit" && !["", "time-out", "suspend", "logout"].includes(wert)) {
      this.fehler = "405";
      return "false";
    }
    if (el === "cmi.core.session_time" && !/^\d{2,4}:\d{2}:\d{2}(\.\d{1,2})?$/.test(wert)) {
      this.fehler = "405";
      return "false";
    }
    if (this.abgelehnt.has(el)) {
      this.fehler = "351";
      return "false";
    }
    this.arbeit[el] = wert;
    this.fehler = "0";
    return "true";
  }

  LMSCommit(arg: string): string {
    this.aufrufe.push(`LMSCommit(${arg})`);
    if (this.zustand !== "laeuft") {
      this.fehler = "301";
      return "false";
    }
    if (this.netzGetrennt) {
      this.fehler = "0";
      return "false";
    }
    this.gespeichert = { ...this.arbeit };
    this.fehler = "0";
    return "true";
  }

  LMSFinish(arg: string): string {
    this.aufrufe.push(`LMSFinish(${arg})`);
    if (this.zustand !== "laeuft") {
      this.fehler = "301";
      return "false";
    }
    this.gespeichert = { ...this.arbeit };
    this.zustand = "beendet";
    this.finishZahl += 1;
    this.fehler = "0";
    return "true";
  }

  LMSGetLastError(): string {
    return this.fehler;
  }

  LMSGetErrorString(code: string): string {
    return `Fehler ${code}`;
  }

  LMSGetDiagnostic(code: string): string {
    return `Diagnose ${code}`;
  }

  /** Ob irgendwann in dieser Sitzung „completed" oder „passed" gesetzt wurde. */
  abschlussJeGesetzt(): boolean {
    return this.aufrufe.some(
      (a) =>
        a === "LMSSetValue(cmi.core.lesson_status,completed)" ||
        a === "LMSSetValue(cmi.core.lesson_status,passed)",
    );
  }
}

/** Wartet, bis das SCO gestartet ist (jsdom feuert DOMContentLoaded nach der Konstruktion). */
export async function gestartet(w: FensterLike): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    if (w.document.body.hasAttribute("data-kw-lms")) {
      return;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("SCO ist nicht gestartet.");
}
