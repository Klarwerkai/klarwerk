// ================================================================================================
// AUFTRAG-BASIC-W2-RESULTAT-VIEW-KERN-23 — DER REINE KERN: ABBILDEN, NICHT ABLEITEN.
// ================================================================================================
//
// WAS DIESER TEST PRUEFT: dass `importResultView` genau das anzeigt, was der Vertrag geliefert hat
// — und dass er bei allem, was fehlt, einen sichtbaren Mangel benennt statt einer Behauptung.
//
// DREI ENTSCHEIDUNGEN, DIE IHN VOM NACHERZAEHLEN UNTERSCHEIDEN:
//
//  1. DER ZUSTANDSRAUM STEHT GETRENNT VOM CODE. Die neun Laufzustaende sind hier eigenstaendig aus
//     `KW-W2-17` uebernommen und werden gegen die Konstante der lib geprueft — eine Aenderung an
//     der lib allein macht den Test rot. Die Herkunft und die bewusste Grenze dieser Uebernahme
//     stehen bei `STATUS_AUS_KW_W2_17` (das Blatt liegt ausserhalb des Repositories).
//
//  2. „KEINE CLIENTSEITIGE FACHLOGIK" WIRD AM CODE GEMESSEN, nicht behauptet: die lib-Quelle wird
//     gelesen und auf Sortierung und Statusherleitung abgesucht (Auftrag §7).
//
//  3. FAIL-CLOSED. Fehlt die Quelle oder schrumpft die Zustandsliste, ist der Test rot — ein
//     gruener Nichtlauf waere schlimmer als ein roter Lauf.
//
// R-1349 (Aufnahme gesamt-aufruferwaechter, Nacharbeit 10): die Bloecke B bis D massen die
// Ableitungen der alten Resultatflaeche (`sourceBlockView`, `knowledgeBlockView`,
// `importResultView`). Die Flaeche wurde nie montiert; geliefert ist der Weg R-0142 als
// `components/bibliothek/ImportErgebnis.tsx` (gesamt-confluence-import, 1.0.0-beta.1.723). Fläche,
// Ableitungen und diese drei Bloecke sind entfernt. Block A (die Laufzustaende, die der gelieferte
// Weg ueber `RunStateBanner` weiter zeigt) und Block E (keine Fachlogik im Kern) gelten unveraendert.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IMPORT_RUN_STATUS,
  type ImportRunStatus,
  importRunStateView,
  isImportRunStatus,
} from "../../apps/web/src/lib/importResultView";

const LIB = "apps/web/src/lib/importResultView.ts";
const LIB_SRC = readFileSync(resolve(process.cwd(), LIB), "utf8");

/**
 * Die neun Zustaende, wortwoertlich aus `KW-W2-17`, Abschnitt „Persistenter Importvertrag":
 *
 *   Status: `QUEUED`, `FETCHING`, `PERSISTING_SOURCE`, `EXTRACTING`, `CREATING_KNOWLEDGE`,
 *   `ANALYZING`, `COMPLETED`, `PARTIAL`, `FAILED`.
 *
 * BENANNTE GRENZE: das Architekturblatt liegt AUSSERHALB dieses Repositories
 * (`/Users/peterkohnert/Documents/Projekt_klarwerk/03_AUFTRAEGE/entscheidung/`). Es zur Laufzeit zu
 * lesen haette die Testsuite an einen Pfad ausserhalb des Repos gebunden — auf jedem anderen
 * Rechner waere `tools/check` daran gescheitert. Die Liste steht deshalb HIER, mit ihrer Herkunft,
 * und wird gegen die Konstante der lib geprueft: eine Abweichung zwischen Blatt und Code faellt
 * damit an genau einer Stelle auf, statt an keiner.
 */
const STATUS_AUS_KW_W2_17 = [
  "QUEUED",
  "FETCHING",
  "PERSISTING_SOURCE",
  "EXTRACTING",
  "CREATING_KNOWLEDGE",
  "ANALYZING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
];

// ================================================================================================
// BLOCK A — die neun Laufzustaende
// ================================================================================================
describe("AUFTRAG-23 BLOCK A: die Laufzustaende kommen aus dem Vertrag", () => {
  it("die Zustandsliste der lib ist die Zustandsliste von KW-W2-17", () => {
    expect([...IMPORT_RUN_STATUS]).toEqual(STATUS_AUS_KW_W2_17);
    // Fail-closed: genau neun, nicht „mindestens".
    expect(IMPORT_RUN_STATUS.length).toBe(9);
  });

  it("jeder der neun Zustaende ist zuordenbar und traegt eigene Text-Schluessel", () => {
    const labels = new Set<string>();
    const hints = new Set<string>();
    for (const status of IMPORT_RUN_STATUS) {
      const view = importRunStateView(status);
      expect(view.unknown, `${status} faellt in den Unbekannt-Zweig`).toBe(false);
      expect(view.labelKey).toBe(`w2.run.status.${status}`);
      expect(view.hintKey).toBe(`w2.run.hint.${status}`);
      labels.add(view.labelKey);
      hints.add(view.hintKey);
    }
    // Neun eigene Namen — kein Sammelzustand, der zwei Laeufe gleich aussehen liesse.
    expect(labels.size).toBe(9);
    expect(hints.size).toBe(9);
  });

  it("die sechs laufenden Zustaende sind laufend und KEIN Erfolg", () => {
    const laufend: ImportRunStatus[] = [
      "QUEUED",
      "FETCHING",
      "PERSISTING_SOURCE",
      "EXTRACTING",
      "CREATING_KNOWLEDGE",
      "ANALYZING",
    ];
    for (const status of laufend) {
      const view = importRunStateView(status);
      expect(view.running, `${status} muss laufend sein`).toBe(true);
      expect(view.success, `${status} darf kein Erfolg sein`).toBe(false);
    }
  });

  it("NUR COMPLETED ist ein Erfolg — PARTIAL und FAILED nie", () => {
    expect(importRunStateView("COMPLETED").success).toBe(true);
    expect(importRunStateView("PARTIAL").success).toBe(false);
    expect(importRunStateView("FAILED").success).toBe(false);
    // Und sie sind auch nicht „noch unterwegs" — sie sind fertig und nicht gut.
    expect(importRunStateView("PARTIAL").running).toBe(false);
    expect(importRunStateView("FAILED").running).toBe(false);
    // Eigener Ton je Ausgang: Erfolg, Teilfehler und Fehlschlag sind drei Sachen.
    expect(importRunStateView("COMPLETED").tone).toBe("ok");
    expect(importRunStateView("PARTIAL").tone).toBe("warn");
    expect(importRunStateView("FAILED").tone).toBe("error");
  });

  it("ein unbekannter Zustand wird benannt und gilt nie als Erfolg", () => {
    for (const wert of [undefined, null, "", "DONE", "completed", 7, {}]) {
      const view = importRunStateView(wert);
      expect(view.unknown, `${String(wert)} muesste unbekannt sein`).toBe(true);
      expect(view.success).toBe(false);
      expect(view.running).toBe(false);
      expect(view.labelKey).toBe("w2.run.status.unknown");
    }
    // Positive Kontrolle — sonst waere der Erkenner blind.
    expect(isImportRunStatus("COMPLETED")).toBe(true);
    expect(importRunStateView("COMPLETED").unknown).toBe(false);
  });
});

// ================================================================================================
// BLOCK E — keine clientseitige Fachlogik, am Code gemessen
// ================================================================================================
describe("AUFTRAG-23 BLOCK E: der View-Kern rechnet nichts aus", () => {
  /** Nur der Code, ohne Erklaerungen — ein Kommentar, der eine Sortierung ausschliesst, darf die
   *  Gegenprobe nicht ausloesen. */
  function ohneKommentare(quelltext: string): string {
    return quelltext.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }

  it("die lib sortiert nicht und dreht nichts um", () => {
    const code = ohneKommentare(LIB_SRC);
    for (const eintrag of [".sort(", ".reverse(", "localeCompare"]) {
      expect(code, `${eintrag} waere eine clientseitige Sortierung`).not.toContain(eintrag);
    }
  });

  it("die lib leitet keinen Status ab und ruft nichts ab", () => {
    const code = ohneKommentare(LIB_SRC);
    for (const eintrag of ["fetch(", "useQuery", "axios", "XMLHttpRequest"]) {
      expect(code, `${eintrag} waere ein Abruf im View-Kern`).not.toContain(eintrag);
    }
    // Kein Erfolgsbegriff, der NICHT am gelieferten COMPLETED haengt.
    expect(code).toContain('success: status === "COMPLETED"');
  });

  it("die lib kennt keine Fixture- und keine Demo-Wahrheit", () => {
    const code = ohneKommentare(LIB_SRC).toLowerCase();
    for (const eintrag of ["confluence", "example.com", "demo", "lorem", "musterfirma"]) {
      expect(code, `„${eintrag}" waere eine erfundene Fachwahrheit im Produktcode`).not.toContain(
        eintrag,
      );
    }
  });

  it("der View-Kern ist DOM-frei — er importiert kein React", () => {
    expect(LIB_SRC).not.toContain('from "react"');
    expect(LIB_SRC).not.toContain("JSX.Element");
  });
});
