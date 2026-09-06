// ================================================================================================
// JOB 3103 (UX-07) — DAS LAYOUT ENTZERRT DIE BESCHRIFTUNGEN, DOM-FREI UND DETERMINISTISCH.
// ================================================================================================
// `layoutGraph` (apps/web/src/lib/graphLayout.ts) liefert seit UX-07 zu jedem Knoten die sichtbare
// Beschriftung samt ihrem Rechteck. Diese Datei prüft die Rechnung selbst, ohne Browser: am
// dokumentierten 28-Knoten-Bestand (R1, R2), an einer Namensfamilie, die sich erst tief hinten
// unterscheidet, und an der Obergrenze der Anzeige (MAX_GRAPH_NODES = 60, Stufe2.tsx). Was die
// Schätzung der Textbreite gegen gerenderte Schrift taugt, misst graph-treffer-chromium.test.tsx.
import { describe, expect, it } from "vitest";
import type { Graph } from "../../apps/web/src/api/types";
import { layoutGraph, textbreite } from "../../apps/web/src/lib/graphLayout";
import { GRAPH, TITEL } from "./bestand";

const KNOTEN_RADIUS = 7; // Stufe2.tsx GraphView: <circle r={7}>

interface Rechteck {
  x: number;
  y: number;
  w: number;
  h: number;
}
const schneidet = (a: Rechteck, b: Rechteck): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const graphAus = (titel: readonly string[]): Graph => ({
  nodes: titel.map((title, i) => ({ id: `k${String(i + 1).padStart(3, "0")}`, title })),
  edges: [],
});

function ueberlappungen(g: Graph, opts?: { width?: number; height?: number }): string[] {
  const l = layoutGraph(g, opts);
  const fehl: string[] = [];
  for (let i = 0; i < l.nodes.length; i++) {
    for (let j = i + 1; j < l.nodes.length; j++) {
      const a = l.nodes[i] as (typeof l.nodes)[number];
      const b = l.nodes[j] as (typeof l.nodes)[number];
      if (schneidet(a.labelBox, b.labelBox)) {
        fehl.push(`„${a.label}" × „${b.label}"`);
      }
      const kreisB = { x: b.x - KNOTEN_RADIUS, y: b.y - KNOTEN_RADIUS, w: 14, h: 14 };
      const kreisA = { x: a.x - KNOTEN_RADIUS, y: a.y - KNOTEN_RADIUS, w: 14, h: 14 };
      if (schneidet(a.labelBox, kreisB)) {
        fehl.push(`„${a.label}" über Kreis ${b.id}`);
      }
      if (schneidet(b.labelBox, kreisA)) {
        fehl.push(`„${b.label}" über Kreis ${a.id}`);
      }
    }
  }
  return fehl;
}

describe("UX-07 · R1 (Layout): kein Beschriftungsrechteck schneidet ein anderes", () => {
  it("am dokumentierten 28-Knoten-Bestand: keine Überlappung, alles innerhalb der Fläche", () => {
    const l = layoutGraph(GRAPH);
    expect(l.nodes.length).toBe(TITEL.length);
    expect(ueberlappungen(GRAPH)).toEqual([]);
    for (const n of l.nodes) {
      expect(n.labelBox.x, `${n.id} links`).toBeGreaterThanOrEqual(0);
      expect(n.labelBox.y, `${n.id} oben`).toBeGreaterThanOrEqual(0);
      expect(n.labelBox.x + n.labelBox.w, `${n.id} rechts`).toBeLessThanOrEqual(l.width);
      expect(n.labelBox.y + n.labelBox.h, `${n.id} unten`).toBeLessThanOrEqual(l.height);
      // Das Rechteck umschließt die geschätzte Schrift: Breite ≥ Schätzung, Höhe ≥ Schriftgrad.
      expect(n.labelBox.w).toBeGreaterThanOrEqual(textbreite(n.label, l.labelFontSize));
      expect(n.labelBox.h).toBeGreaterThanOrEqual(l.labelFontSize);
    }
  });

  it("an der Anzeigeobergrenze (60 Knoten mit langen Namen): keine Überlappung, Fläche wächst mit", () => {
    const titel = Array.from({ length: 60 }, (_, i) => `${TITEL[i % TITEL.length]} (${i + 1})`);
    const g = graphAus(titel);
    expect(ueberlappungen(g)).toEqual([]);
    const l = layoutGraph(g);
    expect(l.height, "mehr Zeilen brauchen mehr Höhe — die Breite bleibt").toBeGreaterThan(440);
    expect(l.width).toBe(640);
  });

  it("die Beschriftung läuft von der Mitte weg und beginnt außerhalb des eigenen Kreises", () => {
    const l = layoutGraph(GRAPH);
    for (const n of l.nodes) {
      const rechts = n.x > l.width / 2;
      expect(n.labelAnchor, n.id).toBe(rechts ? "start" : "end");
      if (rechts) {
        expect(n.labelX, n.id).toBeGreaterThan(n.x + KNOTEN_RADIUS);
      } else {
        expect(n.labelX, n.id).toBeLessThan(n.x - KNOTEN_RADIUS);
      }
    }
  });
});

describe("UX-07 · R2 (Layout): verschiedene Namen bleiben sichtbar verschieden", () => {
  it("die 28 Labels des Bestands sind paarweise verschieden und jedes ist Teil seines Titels", () => {
    const l = layoutGraph(GRAPH);
    const labels = l.nodes.map((n) => n.label);
    expect(new Set(labels).size).toBe(TITEL.length);
    for (const n of l.nodes) {
      // Jedes Fenster zwischen Auslassungen ist ein Stück des Titels — nichts ist erfunden.
      for (const fenster of n.label.split("…")) {
        expect(n.title.includes(fenster), `„${n.label}" stammt aus „${n.title}"`).toBe(true);
      }
    }
  });

  it("eine Familie, die sich erst hinter dem gemeinsamen Anfang unterscheidet, bekommt 31 verschiedene Labels", () => {
    // Der Fall aus der Themenkarte (Wissensnetz.tsx, Runde 8): 30 Segmente mit langem gemeinsamem
    // Anfang plus ein Sonderzweig, der früh abweicht.
    const familie = Array.from(
      { length: 30 },
      (_, i) =>
        `Ventilanlage Produktionsbereich Segment Gemeinsamer Unterscheidungsblock ${String(i + 1).padStart(2, "0")} Endstück`,
    );
    const titel = [...familie, "Ventilanlage Sektor Sonderzweig mit eigenem langen Namen"];
    const l = layoutGraph(graphAus(titel));
    const labels = l.nodes.map((n) => n.label);
    expect(new Set(labels).size, labels.join(" | ")).toBe(titel.length);
    // Das Unterscheidende — die Nummer — ist in jedem Segment-Label sichtbar.
    for (const n of l.nodes) {
      const nr = n.title.match(/block (\d\d)/)?.[1];
      if (nr) {
        expect(n.label, `${n.title} → ${n.label}`).toContain(nr);
      }
    }
  });

  // Runde 3 (BEN, Gegenbeispiel 1): zwei Familien mit gleicher Endung. Nach dem Auflösen der
  // Kollision INNERHALB einer Familie (Variante 1/2) darf die Kollision ZWISCHEN den Familien
  // (Nord/Sued, beide „…1") nicht übrig bleiben — der Kopf muss stehen bleiben oder die
  // Verzweigungsstelle sichtbar werden. Einmal so, dass der Familienname im sichtbaren Kopf liegt,
  // einmal so weit hinten, dass er es nicht tut.
  it("zwei Namensfamilien mit gleichen Endungen bekommen vier verschiedene Labels (Familienname vorn)", () => {
    const titel = ["Nord", "Sued"].flatMap((ort) =>
      [1, 2].map(
        (v) => `Produktionsanlage ${ort} gemeinsamer sehr langer Namensanfang Variante ${v}`,
      ),
    );
    const labels = layoutGraph(graphAus(titel)).nodes.map((n) => n.label);
    expect(new Set(labels).size, labels.join(" | ")).toBe(4);
  });

  it("zwei Namensfamilien mit gleichen Endungen bekommen vier verschiedene Labels (Familienname weit hinten)", () => {
    const titel = ["Nord", "Sued"].flatMap((ort) =>
      [1, 2].map(
        (v) =>
          `Wartungsanweisung für die Produktionsanlage im Werk ${ort}, gemeinsamer Namensteil, Variante ${v}`,
      ),
    );
    const l = layoutGraph(graphAus(titel));
    const labels = l.nodes.map((n) => n.label);
    expect(new Set(labels).size, labels.join(" | ")).toBe(4);
    for (const n of l.nodes) {
      // Der Familienname und die Variante sind beide sichtbar — nicht nur irgendwie verschieden.
      const ort = n.title.includes("Nord") ? "Nord" : "Sued";
      expect(n.label, n.title).toContain(ort);
      expect(n.label, n.title).toContain(n.title.slice(-1));
    }
  });

  // Runde 3 (BEN, Gegenbeispiel 2): ein VOLLER Titel, der zufällig so aussieht wie die Kürzung
  // eines anderen. Volle Titel nehmen an der Kollisionsprüfung teil; geändert wird nur der gekürzte.
  it("ein voller Titel und eine Kürzung, die gleich aussehen, werden unterschieden — der volle bleibt", () => {
    const voll = "Wartungsanweisung Produktion…";
    const lang = "Wartungsanweisung Produktionsanlage Nord mit weiteren Einzelheiten";
    const l = layoutGraph(graphAus([lang, voll]));
    const labelVoll = l.nodes.find((n) => n.title === voll)?.label;
    const labelLang = l.nodes.find((n) => n.title === lang)?.label;
    expect(labelVoll).toBe(voll);
    expect(labelLang).not.toBe(voll);
  });

  // Runde 4 (BEN): die Unterscheidungsstelle verschwindet beim Zusammensetzen — ein Leerzeichen
  // wird neben der Auslassung weggetrimmt („A B" gegen „AB"), ein originales Auslassungszeichen am
  // Titelende verschmilzt mit der gesetzten Auslassung („…Einzelheiten" gegen „…Einzelheiten…").
  // Geprüft wird am FERTIGEN Label; ein vorhandener Anker genügt nicht.
  it("Anlage A B und Anlage AB bekommen verschiedene Labels — das Leerzeichen bleibt sichtbar", () => {
    const titel = [
      "Wartungsanweisung Produktionsanlage A B",
      "Wartungsanweisung Produktionsanlage AB",
    ];
    const labels = layoutGraph(graphAus(titel)).nodes.map((n) => n.label);
    expect(new Set(labels).size, labels.join(" | ")).toBe(2);
    expect(
      labels.some((l) => l.endsWith("A B")),
      labels.join(" | "),
    ).toBe(true);
    expect(
      labels.some((l) => l.endsWith("AB")),
      labels.join(" | "),
    ).toBe(true);
  });

  it("ein langer Titel mit und ohne originales Auslassungszeichen am Ende bekommt verschiedene Labels", () => {
    const lang = "Wartungsanweisung Produktionsanlage Nord mit weiteren Einzelheiten";
    const labels = layoutGraph(graphAus([lang, `${lang}…`])).nodes.map((n) => n.label);
    expect(new Set(labels).size, labels.join(" | ")).toBe(2);
  });

  it("eine variierte Titelmenge ist nach Trimmen und Auslassungsnormalisierung bei vier Breiten eindeutig", () => {
    const lang = "Wartungsanweisung Produktionsanlage Nord mit weiteren Einzelheiten";
    const titel = [
      "Wartungsanweisung Produktionsanlage A B",
      "Wartungsanweisung Produktionsanlage AB",
      "Wartungsanweisung Produktionsanlage A  B",
      "Wartungsanweisung Produktionsanlage A B.",
      lang,
      `${lang}…`,
      `${lang} …`,
      `${lang}.`,
      `${lang} und noch mehr Text dahinter`,
      "Wartungsanweisung Produktion…",
      "Wartungsanweisung Produktion",
      "Produktionsanlage Nord gemeinsamer sehr langer Namensanfang Variante 1",
      "Produktionsanlage Sued gemeinsamer sehr langer Namensanfang Variante 1",
      "Produktionsanlage Nord gemeinsamer sehr langer Namensanfang Variante 2",
    ];
    // Über `width` wandert die Zeilenbreite: 500 → 53 px, 560 → 113 px, 640 → 153 px, 800 → 233 px.
    for (const width of [500, 560, 640, 800]) {
      const labels = layoutGraph(graphAus(titel), { width }).nodes.map((n) => n.label);
      expect(new Set(labels).size, `Breite ${width}: ${labels.join(" | ")}`).toBe(titel.length);
    }
  });

  it("zwei identische Titel bleiben ehrlich identisch — es wird nichts erfunden", () => {
    const l = layoutGraph(
      graphAus(["Gleicher Titel, zweimal im Bestand", "Gleicher Titel, zweimal im Bestand"]),
    );
    expect(l.nodes[0]?.label).toBe(l.nodes[1]?.label);
  });
});

describe("UX-07 · Layout bleibt deterministisch und verträglich mit den alten Zusagen", () => {
  it("gleiche Eingabe → gleiche Koordinaten und Labels", () => {
    expect(layoutGraph(GRAPH)).toEqual(layoutGraph(GRAPH));
  });

  it("die Zeichen- und damit Tab-Reihenfolge folgt dem Bild: rechts von oben nach unten, links von unten nach oben", () => {
    const l = layoutGraph(GRAPH);
    const cx = l.width / 2;
    const rechts = l.nodes.filter((n) => n.x > cx);
    const links = l.nodes.filter((n) => n.x < cx);
    expect(rechts.length + links.length).toBe(l.nodes.length);
    expect(l.nodes.slice(0, rechts.length).map((n) => n.id)).toEqual(rechts.map((n) => n.id));
    for (let i = 1; i < rechts.length; i++) {
      expect((rechts[i] as { y: number }).y).toBeGreaterThan((rechts[i - 1] as { y: number }).y);
    }
    for (let i = 1; i < links.length; i++) {
      expect((links[i] as { y: number }).y).toBeLessThan((links[i - 1] as { y: number }).y);
    }
  });

  it("ein einzelner Knoten sitzt mittig, seine Beschriftung darüber", () => {
    const l = layoutGraph(graphAus(["Einzelknoten"]), { width: 600, height: 400 });
    expect(l.nodes[0]).toMatchObject({ x: 300, y: 200, labelAnchor: "middle" });
    expect(l.nodes[0]?.labelY ?? 0).toBeLessThan(200);
  });
});
