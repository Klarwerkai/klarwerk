// @vitest-environment jsdom
// ================================================================================================
// FIRMENWÖRTERBUCH IM EDITOR · K4 — übernommen wird GENAU die gewählte Stelle.
// ================================================================================================
//
// Der Editor speichert HTML. Geprüft wird je Textknoten; übernommen wird, indem genau dieser
// Knoten an genau dieser Stelle seinen Text ändert. Diese Fälle messen am echten DOM-Parser
// (jsdom), dass Auszeichnung, Links, Listen, Bilder und alle anderen Textteile Zeichen für Zeichen
// bleiben — und dass ein inzwischen geänderter Text NICHT auf Verdacht ersetzt wird.
import { describe, expect, it } from "vitest";
import {
  fundumgebung,
  hatPruefbarenText,
  hinweisUebernehmen,
  segmenteAusHtml,
} from "./begriffshinweise";

const HTML =
  '<h2>Kundenaccount anlegen</h2><p>Im <strong>Kundenaccount</strong> steht das <em>Kundenaccount</em>-Kürzel.</p><ul><li>Kundenaccount prüfen</li></ul><figure data-image-id="i-1"><img src="/api/objects/o-1" alt="Bild"><figcaption>Kundenaccount im Bild</figcaption></figure><p><a href="https://example.invalid/x">Link</a> danach Kundenaccount.</p>';

function hinweisAn(segmente: string[], segment: number, gefunden: string, vorzug: string) {
  const start = (segmente[segment] ?? "").indexOf(gefunden);
  expect(start, `„${gefunden}“ steht nicht in Segment ${segment}`).toBeGreaterThanOrEqual(0);
  return { segment, start, ende: start + gefunden.length, gefunden, vorzug };
}

describe("K4 · Segmente sind die Textknoten des Editor-HTML", () => {
  it("jede Formatierung trennt Segmente; Reihenfolge ist die des Dokuments", () => {
    expect(segmenteAusHtml(HTML)).toEqual([
      "Kundenaccount anlegen",
      "Im ",
      "Kundenaccount",
      " steht das ",
      "Kundenaccount",
      "-Kürzel.",
      "Kundenaccount prüfen",
      "Kundenaccount im Bild",
      "Link",
      " danach Kundenaccount.",
    ]);
    expect(hatPruefbarenText(segmenteAusHtml("<p> </p><p></p>"))).toBe(false);
    expect(hatPruefbarenText(segmenteAusHtml(HTML))).toBe(true);
  });
});

describe("K4 · Übernehmen ändert genau eine Stelle", () => {
  it("die fett gesetzte Stelle wird ersetzt und bleibt fett; alles andere bleibt bytegleich", () => {
    const segmente = segmenteAusHtml(HTML);
    const ergebnis = hinweisUebernehmen(
      HTML,
      hinweisAn(segmente, 2, "Kundenaccount", "Kundenkonto"),
      segmente,
    );
    expect(ergebnis.lage).toBe("uebernommen");
    const neu = ergebnis.lage === "uebernommen" ? ergebnis.html : "";
    expect(neu).toBe(
      HTML.replace("<strong>Kundenaccount</strong>", "<strong>Kundenkonto</strong>"),
    );
    // Die übrigen fünf Vorkommen stehen unverändert da.
    expect(neu.match(/Kundenaccount/g)).toHaveLength(5);
  });

  it("innerhalb eines Textknotens bleibt der Text vor und nach der Fundstelle erhalten", () => {
    const segmente = segmenteAusHtml(HTML);
    const ergebnis = hinweisUebernehmen(
      HTML,
      hinweisAn(segmente, 9, "Kundenaccount", "Kundenkonto"),
      segmente,
    );
    expect(ergebnis).toEqual({
      lage: "uebernommen",
      html: HTML.replace("</a> danach Kundenaccount.", "</a> danach Kundenkonto."),
    });
  });

  it("eine Bildunterschrift ist ein eigenes Segment — Bild, Kennung und Attribute bleiben", () => {
    const segmente = segmenteAusHtml(HTML);
    const ergebnis = hinweisUebernehmen(
      HTML,
      hinweisAn(segmente, 7, "Kundenaccount", "Kundenkonto"),
      segmente,
    );
    const neu = ergebnis.lage === "uebernommen" ? ergebnis.html : "";
    expect(neu).toContain(
      '<figure data-image-id="i-1"><img src="/api/objects/o-1" alt="Bild"><figcaption>Kundenkonto im Bild</figcaption></figure>',
    );
    expect(neu).toBe(HTML.replace("Kundenaccount im Bild", "Kundenkonto im Bild"));
  });

  it("Verwerfen heisst: es wird nichts übernommen — der Text bleibt, wie er ist", () => {
    // Verwerfen ist im Editor eine reine Ausblendung (`Begriffshinweise.tsx`); es gibt keinen
    // Schreibweg dafür. Gemessen wird hier, dass ein NICHT übernommener Hinweis nichts verändert:
    // der Ausgangstext wird von keiner Funktion dieses Moduls angefasst.
    const segmente = segmenteAusHtml(HTML);
    expect(segmenteAusHtml(HTML)).toEqual(segmente);
    expect(fundumgebung(segmente[6] ?? "", 0, 13)).toEqual({
      vor: "",
      fund: "Kundenaccount",
      nach: " prüfen",
    });
  });
});

describe("K4 · nie auf Verdacht", () => {
  it("wurde der Knoten inzwischen geändert, wird NICHTS ersetzt", () => {
    const segmente = segmenteAusHtml(HTML);
    const hinweis = hinweisAn(segmente, 2, "Kundenaccount", "Kundenkonto");
    const geaendert = HTML.replace("<strong>Kundenaccount</strong>", "<strong>Konto</strong>");
    expect(hinweisUebernehmen(geaendert, hinweis, segmente)).toEqual({ lage: "veraltet" });
  });

  it("verschiebt eine Einfügung die Knotenfolge, wird NICHTS ersetzt", () => {
    const segmente = segmenteAusHtml(HTML);
    const hinweis = hinweisAn(segmente, 2, "Kundenaccount", "Kundenkonto");
    const verschoben = `<p>Neuer erster Absatz.</p>${HTML}`;
    expect(hinweisUebernehmen(verschoben, hinweis, segmente)).toEqual({ lage: "veraltet" });
  });

  it("passt der Text an der Stelle nicht mehr, wird NICHTS ersetzt", () => {
    const segmente = segmenteAusHtml(HTML);
    const falsch = { segment: 9, start: 0, ende: 5, gefunden: "Kunde", vorzug: "Kundin" };
    expect(hinweisUebernehmen(HTML, falsch, segmente)).toEqual({ lage: "veraltet" });
  });
});
