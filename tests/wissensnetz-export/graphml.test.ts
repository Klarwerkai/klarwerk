// ================================================================================================
// R-0711 · DAS WISSENSNETZ IN EINEM OFFENEN, HERSTELLERNEUTRALEN FORMAT — DIE DATEI SELBST.
// ================================================================================================
//
// Node-rein (der Root-Typcheck hat keine DOM-Bibliothek): hier stehen die Zusagen, die sich am
// Text der Datei ablesen lassen. Dass ein XML-Parser die Datei liest und jede Kante zwischen
// vorhandenen Knoten steht, prüft `export-am-graphen.test.tsx` an der Datei, die die Seite
// tatsächlich herunterlädt.
import { describe, expect, it } from "vitest";
import type { Graph } from "../../apps/web/src/api/types";
import {
  WISSENSNETZ_EXPORT_DATEI,
  WISSENSNETZ_EXPORT_TYP,
  wissensnetzAlsGraphml,
  wissensnetzExportGekuerzt,
} from "../../apps/web/src/lib/wissensnetzExport";

function vollerGraph(): Graph {
  return {
    nodes: [
      { id: "g1", title: "Kaltstart: Vorwärmung aktivieren" },
      { id: "g2", title: 'Vorwärmung <nicht> nötig & "sicher"' },
      { id: "g3", title: "Wartungsplan Halle 2" },
    ],
    edges: [
      { a: "g1", b: "g2", via: "kaltstart" },
      { a: "g2", b: "g3", via: "wartung" },
    ],
    totalEdges: 2,
    truncated: false,
    edgeLimit: 5000,
    excludedTags: ["pilot-demo"],
    kuratierteKanten: [
      {
        a: "g1",
        b: "g2",
        art: "widerspricht",
        richtung: "gerichtet",
        status: "aktiv",
        herkunft: "kuratiert",
      },
      {
        a: "g1",
        b: "g3",
        art: "gehoert_zu",
        richtung: "ungerichtet",
        status: "aktiv",
        herkunft: "kuratiert",
      },
    ],
    kuratierteKantenGesamt: 2,
    kuratierteKantenGekuerzt: false,
  };
}

const zeileMit = (text: string, teil: string): string =>
  text.split("\n").find((z) => z.includes(teil)) ?? "";

describe("R-0711 · GraphML aus der /api/graph-Antwort (Text)", () => {
  it("T1 · GraphML-Namensraum, Dateiname und Medientyp des offenen Formats", () => {
    const text = wissensnetzAlsGraphml(vollerGraph());
    expect(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(text).toContain('<graphml xmlns="http://graphml.graphdrawing.org/xmlns"');
    expect(text).toContain('<graph id="wissensnetz" edgedefault="undirected">');
    expect(WISSENSNETZ_EXPORT_DATEI).toBe("klarwerk-wissensnetz.graphml");
    expect(WISSENSNETZ_EXPORT_TYP.startsWith("application/graphml+xml")).toBe(true);
  });

  it("T2 · Sonderzeichen werden maskiert, nicht abgeschnitten", () => {
    const text = wissensnetzAlsGraphml(vollerGraph());
    expect(text).toContain(
      '<data key="n_titel">Vorwärmung &lt;nicht&gt; nötig &amp; &quot;sicher&quot;</data>',
    );
    expect(text).not.toContain("<nicht>");
  });

  it("T3 · nur die gerichtete Fachbeziehung ist gerichtet; beide Mengen tragen ihre Herkunft", () => {
    const text = wissensnetzAlsGraphml(vollerGraph());
    const gerichtet = zeileMit(text, '<edge id="k1"');
    expect(gerichtet).toContain('source="g1" target="g2" directed="true"');
    expect(gerichtet).toContain('<data key="e_herkunft">kuratiert</data>');
    expect(gerichtet).toContain('<data key="e_art">widerspricht</data>');
    expect(zeileMit(text, '<edge id="k2"')).not.toContain("directed=");
    const schlagwort = zeileMit(text, '<edge id="s1"');
    expect(schlagwort).toContain('<data key="e_herkunft">schlagwort</data>');
    expect(schlagwort).toContain('<data key="e_schlagwort">kaltstart</data>');
    expect(schlagwort).not.toContain("directed=");
  });

  it("T4 · ohne Grenzfelder und ohne kuratierte Menge steht keine erfundene Aussage in der Datei", () => {
    const g = vollerGraph();
    const text = wissensnetzAlsGraphml({ nodes: g.nodes, edges: g.edges });
    for (const schluessel of [
      "g_schlagwortkantenGesamt",
      "g_schlagwortkantenGekuerzt",
      "g_kantenDeckel",
      "g_uebergangeneSchlagwoerter",
      "g_fachbeziehungenGesamt",
      "g_fachbeziehungenGekuerzt",
    ]) {
      expect(text, schluessel).not.toContain(`<data key="${schluessel}">`);
    }
    expect(text).not.toContain('<edge id="k1"');
  });

  it("T5 · ein Steuerzeichen im Titel fällt weg, der Rest bleibt", () => {
    const text = wissensnetzAlsGraphml({
      nodes: [{ id: "x1", title: "Ventil\u0007 V2\u0000 prüfen \u{1F527}" }],
      edges: [],
    });
    expect(text).toContain('<data key="n_titel">Ventil V2 prüfen \u{1F527}</data>');
  });

  it("T6 · deterministisch, und die Kürzungsauskunft liest nur, was der Server sagt", () => {
    expect(wissensnetzAlsGraphml(vollerGraph())).toBe(wissensnetzAlsGraphml(vollerGraph()));
    expect(wissensnetzExportGekuerzt(vollerGraph())).toBe(false);
    expect(wissensnetzExportGekuerzt({ ...vollerGraph(), truncated: true })).toBe(true);
    expect(wissensnetzExportGekuerzt({ ...vollerGraph(), kuratierteKantenGekuerzt: true })).toBe(
      true,
    );
    expect(wissensnetzExportGekuerzt({ nodes: [], edges: [] })).toBe(false);
  });
});
