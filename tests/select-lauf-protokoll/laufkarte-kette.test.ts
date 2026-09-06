// ================================================================================================
// JOB 3127 · MR-SELECT-1 — DER NEUE LAUF KOMMT IN DER LAUFKARTE AN, OHNE EINE ZEILE OBERFLÄCHE.
// ================================================================================================
//
// Die Anzeige ist FERTIG und wird von diesem Auftrag NICHT geändert: `Stufe2.tsx:1182` zeigt jede
// Laufart als `t(\`mrun.task.${r.task}\`)`, und `select` steht seit JOB 3069 in `REASONER_TASKS`,
// zählt also in `summarizeModelRuns` mit. Was fehlte, war ausschließlich ein DATENSATZ.
//
// DIESE DATEI MISST DIE ANZEIGEKETTE, NICHT DAS SCHREIBEN. Sie ruft den Reasoner bewusst NICHT:
// nimmt man die neue Protokollzeile in `deriveImportCriteria` wieder heraus (die Gegenprobe dieses
// Auftrags), bleibt diese Datei GRÜN — sie sagt aus, was mit einem select-Datensatz in der Karte
// GESCHIEHT, nicht ob einer entsteht.
//
// DIE ANDERE HÄLFTE DER KETTE, damit hier kein frei erfundener Wert gemessen wird: dass der
// geschriebene Datensatz WIRKLICH `task: "select"` trägt, hält `laufprotokoll.test.ts` (R1) am
// echten Service fest und `route-einstieg.test.ts` (A1/A2) am produktiven HTTP-Einstieg. Zusammen
// ergibt das: geschrieben wird „select" — und „select" ist in der Karte eine bekannte, übersetzte
// Art.
//
// WAS HIER NICHT GEMESSEN WIRD: die gemountete Karte (das tut `tests/ki-aufgabenarten/
// aufgabenart-an-der-flaeche.test.tsx` für alle acht Arten) und die Lesbarkeit im Browser.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ModelRunRecord } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { istBekannteAufgabenart, summarizeModelRuns } from "../../apps/web/src/lib/modelRuns";

const WURZEL = join(__dirname, "..", "..");
const STUFE2 = join(WURZEL, "apps/web/src/pages/Stufe2.tsx");

// Ein select-Lauf in der Form, die der Server jetzt schreibt (Feld für Feld aus
// `services/model-runs/src/types.ts`) — so, wie ihn `/api/model-runs` an die Karte gibt.
const SELECT_LAUF: ModelRunRecord = {
  id: "r-select-1",
  task: "select",
  provider: "anthropic:auswahl-modell",
  model: "auswahl-modell",
  demo: false,
  fallback: false,
  locale: "de",
  startedAt: "2026-09-06T07:35:00.000Z",
  finishedAt: "2026-09-06T07:35:01.200Z",
  status: "success",
};

describe("JOB 3127: der geschriebene select-Lauf ist in der Laufkarte eine BEKANNTE Art", () => {
  it("K1 die Aufgabenart-Wache der Oberfläche kennt sie — der Lauf fällt nicht unter „unbekannt“", () => {
    expect(istBekannteAufgabenart(SELECT_LAUF.task)).toBe(true);
  });

  it("K2 die Zählung der Karte schlägt ihn der Art select zu (nicht den unbekannten Arten)", () => {
    const zusammenfassung = summarizeModelRuns([SELECT_LAUF]);

    expect(zusammenfassung.byTask.select).toBe(1);
    expect(zusammenfassung.unbekannteArten).toBe(0);
    expect(zusammenfassung.total).toBe(1);
  });

  it("K3 die Liste der Laufkarte übersetzt die Art über `mrun.task.<art>` (Stufe2.tsx)", () => {
    // Der Anker der Kette: die Karte bildet den Anzeigeschlüssel aus der Art des Datensatzes.
    expect(readFileSync(STUFE2, "utf8")).toContain("mrun.task.${r.task}");
  });

  it.each([
    ["de", "Auswählen"],
    ["en", "Select"],
    ["nl", "Selecteren"],
  ])("K4 %s: der Schlüssel trägt ein Wort, keinen Programmschlüssel", (sprache, wort) => {
    const uebersetzt = i18n.getFixedT(sprache)(`mrun.task.${SELECT_LAUF.task}`);

    expect(uebersetzt).toBe(wort);
    expect(uebersetzt).not.toContain("mrun.task.");
  });
});
