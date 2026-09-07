// ================================================================================================
// JOB 3190 · UX-18 · R2 — DIE OBERMENGEN-PROBE: WAS DIE WEICHE MISST, DARF DIE FLÄCHE NICHT
// PESSIMISTISCHER BEHAUPTEN.
// ================================================================================================
//
// R1 nennt Kacheln beim Namen. Dieser Fall ist die STRUKTURPRÜFUNG daneben: er läuft über die
// VOLLSTÄNDIGE Definitionsliste und nicht über eine Handvoll IDs. Die Regel lautet:
//
//     Ist eine Dateikachel im Erfassen wirklich einlesbar, dann steht sie auf `/import` entweder
//     als `active` (hier importiert sie selbst) oder als `elsewhere` (dort drüben importiert sie)
//     — niemals als `soon` oder `planned`.
//
// WARUM ÜBER DIE ERFASSEN-FLÄCHE UND NICHT ÜBER EINEN NEUEN EXPORT: das Erfassen leitet seinen
// Zustand aus GENAU der Weiche ab, um die es geht (`detectFileKind` plus „gibt es einen
// Importweg?"). Eine Kachel, die dort `active` ist, IST die messbare Wahrheit. Ein zusätzlicher
// Export von `captureSupports` allein für diesen Test wäre ein Ausfuhrweg ohne Aufrufer außerhalb
// der Tests — genau das, was `tests/capture/aufrufer-waechter.test.ts` verbietet.
//
// DIESER FALL FÄNGT AUCH KÜNFTIGE HANDEINTRÄGE: wer morgen `docx: "soon"` wieder in die
// Handtabelle schreibt, macht ihn rot, ohne dass jemand den Test anfassen müsste.
//
// VORHER (gemessen, 07.09.2026): rot — `docx: im Erfassen einlesbar, auf /import aber "soon"`.
import { describe, expect, it } from "vitest";
import {
  type SourceState,
  fileSourcesForSurface,
} from "../../apps/web/src/lib/importSourceGallery";

/** Zustände, die „diese Fähigkeit gibt es" sagen — hier selbst oder nachweislich anderswo. */
const EHRLICH_VORHANDEN: readonly SourceState[] = ["active", "elsewhere"];

const ERFASSEN = fileSourcesForSurface("capture");
const IMPORT = new Map(fileSourcesForSurface("import").map((s) => [s.id, s.state]));

describe("JOB 3190 · R2 — die Fläche ist nie pessimistischer als die Weiche", () => {
  it("beide Oberflächen führen dieselben Kacheln (sonst prüfte die Obermenge nur einen Teil)", () => {
    const erfassenIds = [...ERFASSEN.map((s) => s.id)].sort();
    const importIds = [...IMPORT.keys()].sort();
    expect(importIds).toEqual(erfassenIds);
    // Kalibrierung: eine leere oder einelementige Liste würde alles Weitere still bedeutungslos
    // machen.
    expect(erfassenIds.length).toBeGreaterThanOrEqual(5);
  });

  it("jede im Erfassen einlesbare Kachel ist auf `/import` `active` oder `elsewhere`", () => {
    const verletzungen: string[] = [];
    for (const quelle of ERFASSEN) {
      if (quelle.state !== "active") {
        continue;
      }
      const importZustand = IMPORT.get(quelle.id);
      if (importZustand === undefined || !EHRLICH_VORHANDEN.includes(importZustand)) {
        verletzungen.push(
          `${quelle.id}: im Erfassen einlesbar, auf /import aber "${importZustand}"`,
        );
      }
    }
    expect(verletzungen, verletzungen.join(" · ")).toEqual([]);
  });

  it("die Probe hat wirklich etwas zu prüfen — mehrere Kacheln sind im Erfassen einlesbar", () => {
    const einlesbar = ERFASSEN.filter((s) => s.state === "active").map((s) => s.id);
    expect(einlesbar.length, einlesbar.join(",")).toBeGreaterThanOrEqual(4);
  });

  it("umgekehrt wird nichts optimistischer: was die Weiche NICHT misst, bleibt `planned`/`unconfigured`", () => {
    for (const quelle of ERFASSEN) {
      if (quelle.state === "active") {
        continue;
      }
      const importZustand = IMPORT.get(quelle.id);
      expect(
        EHRLICH_VORHANDEN.includes(importZustand as SourceState),
        `${quelle.id} behauptet auf /import "${importZustand}", obwohl die Weiche nichts misst`,
      ).toBe(false);
    }
  });
});
