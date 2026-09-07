// ================================================================================================
// JOB 3190 · UX-18 · R1 — DER ZUSTAND DER DATEIKACHELN KOMMT AUS DER WEICHE, NICHT AUS EINEM
// ZWEITEN HANDTISCH.
// ================================================================================================
//
// DER BEFUND (heute, `main`): `/import` sagt für Word und PDF „bald". Dieselbe Datei wird im
// Erfassen längst eingelesen — der Dateidialog dort trägt `.docx` und `.pdf` ausdrücklich
// (`apps/web/src/lib/captureFromFile.ts:64-65`), und die Kachelmenge des Erfassens leitet ihren
// Zustand aus der ECHTEN Importweiche `detectFileKind` ab. Zwei Wahrheiten für denselben Dateityp,
// und die pessimistischere stand auf der Fläche, auf der ein Mensch nach dem Weg sucht.
//
// WAS DIESER FALL FESTHÄLT: die Fläche `/import` trägt für messbare Dateitypen den Zustand
// `elsewhere` — „auf dieser Fläche nicht, aber im Erfassen wirklich einlesbar". Nicht `active`
// (auf `/import` selbst importiert weiter nur JSON), nicht `soon` (es GIBT die Funktion).
//
// UND WAS ER GENAUSO FESTHÄLT: die zwei Wahrheiten, die die Weiche gar nicht messen kann, bleiben
// unangetastet. Excel ist wirklich ohne Extraktionsweg (`planned`); das Audio-/Video-Transkript ist
// gebaut, aber ohne hinterlegten Dienst (`unconfigured`) — diese Unterscheidung wurde einmal
// ausdrücklich erkämpft (SCRUM-382) und darf hier nicht verschwimmen.
//
// VORHER (gemessen, 07.09.2026): rot — `expected 'soon' to be 'elsewhere'` für `docx` und `pdf`.
import { describe, expect, it } from "vitest";
import {
  type GallerySource,
  type SourceState,
  fileSourcesForSurface,
} from "../../apps/web/src/lib/importSourceGallery";

function zustaende(surface: "capture" | "import"): Map<string, SourceState> {
  return new Map(fileSourcesForSurface(surface).map((s) => [s.id, s.state]));
}

/** Die Rangordnung, in der die Galerie sortiert — aktiv zuerst, geplant zuletzt. */
const RANG: Record<SourceState, number> = {
  active: 0,
  elsewhere: 1,
  unconfigured: 2,
  soon: 3,
  planned: 4,
};

function istGeordnet(quellen: readonly GallerySource[]): boolean {
  for (let i = 1; i < quellen.length; i++) {
    const vorher = quellen[i - 1];
    const jetzt = quellen[i];
    if (vorher && jetzt && RANG[vorher.state] > RANG[jetzt.state]) {
      return false;
    }
  }
  return true;
}

describe("JOB 3190 · R1 — /import nennt den wirklichen Einstieg", () => {
  it("Word und PDF tragen `elsewhere` — die Funktion GIBT es, nur nicht hier", () => {
    const importZustand = zustaende("import");
    expect(importZustand.get("docx"), "docx").toBe("elsewhere");
    expect(importZustand.get("pdf"), "pdf").toBe("elsewhere");
  });

  it("PowerPoint, Text/CSV und OCR ebenso — die Weiche misst sie, also sagt die Kachel es", () => {
    const importZustand = zustaende("import");
    for (const id of ["pptx", "csv", "ocr"]) {
      expect(importZustand.get(id), id).toBe("elsewhere");
    }
  });

  it("JSON bleibt `active`: auf DIESER Fläche importiert genau dieser Typ wirklich", () => {
    expect(zustaende("import").get("json-file")).toBe("active");
  });

  it("Excel bleibt `planned` — dort gibt es wirklich keinen Extraktionsweg", () => {
    expect(zustaende("import").get("xlsx")).toBe("planned");
  });

  it("das Audio-/Video-Transkript bleibt `unconfigured` — auf BEIDEN Oberflächen", () => {
    for (const surface of ["capture", "import"] as const) {
      expect(zustaende(surface).get("avtranscript"), surface).toBe("unconfigured");
    }
  });

  it("keine einzige Dateikachel sagt auf `/import` noch „bald“", () => {
    const states = fileSourcesForSurface("import").map((s) => s.state);
    expect(states, states.join(",")).not.toContain("soon");
  });

  it("das Erfassen bleibt unberührt: dort sind Word und PDF weiterhin `active`", () => {
    const capture = zustaende("capture");
    expect(capture.get("docx"), "docx").toBe("active");
    expect(capture.get("pdf"), "pdf").toBe("active");
    expect(capture.get("xlsx"), "xlsx").toBe("planned");
  });

  // Prüflücke 6(a) des Auftrags: der neue Rang darf die Reihenfolge nicht zerlegen.
  it("die Reihenfolge bleibt aktiv → anderswo → nicht konfiguriert → bald → geplant", () => {
    for (const surface of ["capture", "import"] as const) {
      expect(istGeordnet(fileSourcesForSurface(surface)), surface).toBe(true);
    }
    const ids = fileSourcesForSurface("import").map((s) => s.id);
    // Der aktive JSON-Eintrag steht vor jeder `elsewhere`-Kachel, diese vor dem Transkript.
    expect(ids.indexOf("json-file")).toBeLessThan(ids.indexOf("docx"));
    expect(ids.indexOf("docx")).toBeLessThan(ids.indexOf("avtranscript"));
    expect(ids.indexOf("avtranscript")).toBeLessThan(ids.indexOf("xlsx"));
  });
});
