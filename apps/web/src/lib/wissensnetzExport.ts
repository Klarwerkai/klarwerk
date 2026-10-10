// ================================================================================================
// R-0711 · DAS WISSENSNETZ IN EINEM OFFENEN, HERSTELLERNEUTRALEN FORMAT.
// ================================================================================================
//
// DAS FORMAT: GraphML (http://graphml.graphdrawing.org/), ein offenes XML-Austauschformat für
// Graphen. Es gehört keinem Hersteller und wird ohne Umweg von Gephi, yEd, Cytoscape, NetworkX und
// igraph gelesen. Die Quelle (R-0711, Herkunft „OKF-Export (SCRUM-549)") nennt kein bestimmtes
// Format, nur „offen, herstellerneutral"; was „OKF" ausgeschrieben heisst, belegt sie nicht.
//
// DIE GRUNDLAGE IST DIE ANTWORT, DIE DIE SEITE SCHON HAT: `GET /api/graph`. Damit gilt für die
// Datei genau die Sichtbarkeitsentscheidung des Servers (`sichtbarkeitsfilterFuer`, `ko.read`) —
// es gibt keinen zweiten Leseweg und keine zweite Rechteprüfung, die auseinanderlaufen könnten.
// Exportiert wird die UNGEKÜRZTE Antwort (`raw`), nicht der 60-Knoten-Ausschnitt des Bildes.
//
// WAS DIE DATEI TRÄGT, und was sie auseinanderhält:
//   · Knoten: Kennung und Titel jedes sichtbaren Wissensobjekts.
//   · Schlagwortkanten (`herkunft = schlagwort`): abgeleitete Nähe, ungerichtet, mit dem Schlagwort.
//   · Gesetzte Fachbeziehungen (`herkunft = kuratiert`): mit Art und Richtung; bei `gerichtet` ist
//     die Kante gerichtet (Quelle → Ziel). Beide Mengen stehen in EINER Datei, aber nie ohne ihre
//     Herkunft — dieselbe Trennung wie im Bild (Vertrag Nr. 6, JOB 4153).
//   · Die Grenzen der Antwort als Graphdaten: Gesamtzahl und Kürzung beider Kantenmengen, der
//     Deckel und die wegen Allgegenwart übergangenen Schlagwörter. Fehlt ein Feld in der Antwort,
//     fehlt es auch in der Datei.
import type { Graph } from "../api/types";

export const WISSENSNETZ_EXPORT_DATEI = "klarwerk-wissensnetz.graphml";
export const WISSENSNETZ_EXPORT_TYP = "application/graphml+xml;charset=utf-8";

/**
 * XML 1.0 erlaubt nur Tab, Zeilenumbruch, Wagenrücklauf und die Bereiche ab U+0020 ohne
 * Ersatzzeichen und ohne U+FFFE/U+FFFF. Ein Titel mit einem solchen Steuerzeichen machte die ganze
 * Datei unlesbar; das Zeichen fällt deshalb weg, der Rest des Titels bleibt.
 */
function xmlErlaubt(cp: number): boolean {
  return (
    cp === 0x9 ||
    cp === 0xa ||
    cp === 0xd ||
    (cp >= 0x20 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) ||
    (cp >= 0x10000 && cp <= 0x10ffff)
  );
}

function xml(wert: string): string {
  let sauber = "";
  for (const zeichen of wert) {
    const cp = zeichen.codePointAt(0) ?? 0;
    if (xmlErlaubt(cp)) {
      sauber += zeichen;
    }
  }
  return sauber
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function daten(schluessel: string, wert: string | number | boolean): string {
  return `<data key="${schluessel}">${xml(String(wert))}</data>`;
}

/** Die Graphdaten, die nur stehen, wenn der Server das zugehörige Feld gesendet hat. */
function grenzdaten(g: Graph): string[] {
  const zeilen: string[] = [];
  if (typeof g.totalEdges === "number") {
    zeilen.push(daten("g_schlagwortkantenGesamt", g.totalEdges));
  }
  if (typeof g.truncated === "boolean") {
    zeilen.push(daten("g_schlagwortkantenGekuerzt", g.truncated));
  }
  if (typeof g.edgeLimit === "number") {
    zeilen.push(daten("g_kantenDeckel", g.edgeLimit));
  }
  if (Array.isArray(g.excludedTags)) {
    zeilen.push(daten("g_uebergangeneSchlagwoerter", JSON.stringify(g.excludedTags)));
  }
  // BEIDE ODER KEINES, wie am Zählsatz der Seite: ohne gelieferte Menge keine Aussage über sie.
  if (g.kuratierteKanten && typeof g.kuratierteKantenGesamt === "number") {
    zeilen.push(daten("g_fachbeziehungenGesamt", g.kuratierteKantenGesamt));
  }
  if (g.kuratierteKanten && typeof g.kuratierteKantenGekuerzt === "boolean") {
    zeilen.push(daten("g_fachbeziehungenGekuerzt", g.kuratierteKantenGekuerzt));
  }
  return zeilen;
}

const SCHLUESSEL = [
  '<key id="g_quelle" for="graph" attr.name="quelle" attr.type="string"/>',
  '<key id="g_schlagwortkantenGesamt" for="graph" attr.name="schlagwortkantenGesamt" attr.type="int"/>',
  '<key id="g_schlagwortkantenGekuerzt" for="graph" attr.name="schlagwortkantenGekuerzt" attr.type="boolean"/>',
  '<key id="g_kantenDeckel" for="graph" attr.name="kantenDeckel" attr.type="int"/>',
  '<key id="g_uebergangeneSchlagwoerter" for="graph" attr.name="uebergangeneSchlagwoerter" attr.type="string"/>',
  '<key id="g_fachbeziehungenGesamt" for="graph" attr.name="fachbeziehungenGesamt" attr.type="int"/>',
  '<key id="g_fachbeziehungenGekuerzt" for="graph" attr.name="fachbeziehungenGekuerzt" attr.type="boolean"/>',
  '<key id="n_titel" for="node" attr.name="titel" attr.type="string"/>',
  '<key id="e_herkunft" for="edge" attr.name="herkunft" attr.type="string"/>',
  '<key id="e_schlagwort" for="edge" attr.name="schlagwort" attr.type="string"/>',
  '<key id="e_art" for="edge" attr.name="art" attr.type="string"/>',
  '<key id="e_richtung" for="edge" attr.name="richtung" attr.type="string"/>',
];

/**
 * Das Wissensnetz einer `/api/graph`-Antwort als GraphML-Dokument. Rein und deterministisch:
 * dieselbe Antwort ergibt Zeichen für Zeichen dieselbe Datei (die Reihenfolge ist die des Servers).
 */
export function wissensnetzAlsGraphml(g: Graph): string {
  const zeilen: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">',
    ...SCHLUESSEL.map((k) => `  ${k}`),
    '  <graph id="wissensnetz" edgedefault="undirected">',
    `    ${daten("g_quelle", "Klarwerk Wissensnetz")}`,
    ...grenzdaten(g).map((d) => `    ${d}`),
  ];
  for (const n of g.nodes) {
    zeilen.push(`    <node id="${xml(n.id)}">${daten("n_titel", n.title)}</node>`);
  }
  let s = 0;
  for (const e of g.edges) {
    s += 1;
    const herkunft = daten("e_herkunft", "schlagwort");
    zeilen.push(
      `    <edge id="s${s}" source="${xml(e.a)}" target="${xml(e.b)}">${herkunft}${daten("e_schlagwort", e.via)}</edge>`,
    );
  }
  let k = 0;
  for (const kante of g.kuratierteKanten ?? []) {
    k += 1;
    // GraphML erlaubt die Richtung je Kante; nur eine gerichtete Fachbeziehung trägt sie.
    const gerichtet = kante.richtung === "gerichtet" ? ' directed="true"' : "";
    const inhalt = `${daten("e_herkunft", "kuratiert")}${daten("e_art", kante.art)}${daten("e_richtung", kante.richtung)}`;
    zeilen.push(
      `    <edge id="k${k}" source="${xml(kante.a)}" target="${xml(kante.b)}"${gerichtet}>${inhalt}</edge>`,
    );
  }
  zeilen.push("  </graph>", "</graphml>", "");
  return zeilen.join("\n");
}

/**
 * Ob die Datei weniger Kanten trägt, als der Server sichtbar gezählt hat. Gelesen wird nur, was
 * der Server sagt — fehlt die Auskunft, wird keine Kürzung behauptet.
 */
export function wissensnetzExportGekuerzt(g: Graph): boolean {
  const fachbeziehungenGekuerzt =
    g.kuratierteKanten !== undefined && g.kuratierteKantenGekuerzt === true;
  return g.truncated === true || fachbeziehungenGekuerzt;
}
