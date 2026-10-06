// @vitest-environment jsdom
// ================================================================================================
// FIRMENWÖRTERBUCH IM EDITOR · K4 — übernommen wird GENAU die gewählte Stelle.
// ================================================================================================
//
// Der Editor speichert HTML. Geprüft wird je zusammenhängendem Textlauf (Block, über
// Inline-Formatierungen hinweg); übernommen wird, indem genau die Textknoten der Fundstelle an
// genau dieser Stelle ihren Text ändern. Diese Fälle messen am echten DOM-Parser (jsdom), dass
// Auszeichnung, Links, Listen, Bilder und alle anderen Textteile Zeichen für Zeichen bleiben —
// und dass ein inzwischen geänderter Text NICHT auf Verdacht ersetzt wird.
//
// Nacharbeit 3 (Bens Befund zu K2/K3): bis hierher war JEDER Textknoten ein Segment, und der
// erste Fall unten schrieb genau das fest. „Konto <b>Plus</b>" wurde so als unerwünschtes „Konto"
// beanstandet und „Kunden<b>account</b>" nie gefunden. Die Erwartung ist auf Textläufe
// umgestellt; die Gegenproben dazu stehen unter „Formatierungsgrenzen".
import { describe, expect, it } from "vitest";
import {
  fundumgebung,
  hatPruefbarenText,
  hinweisUebernehmen,
  segmenteAusHtml,
  sichtbareHinweise,
  verwerfKennung,
} from "./begriffshinweise";

const HTML =
  '<h2>Kundenaccount anlegen</h2><p>Im <strong>Kundenaccount</strong> steht das <em>Kundenaccount</em>-Kürzel.</p><ul><li>Kundenaccount prüfen</li></ul><figure data-image-id="i-1"><img src="/api/objects/o-1" alt="Bild"><figcaption>Kundenaccount im Bild</figcaption></figure><p><a href="https://example.invalid/x">Link</a> danach Kundenaccount.</p>';

function hinweisAn(segmente: string[], segment: number, gefunden: string, vorzug: string) {
  const start = (segmente[segment] ?? "").indexOf(gefunden);
  expect(start, `„${gefunden}“ steht nicht in Segment ${segment}`).toBeGreaterThanOrEqual(0);
  return { segment, start, ende: start + gefunden.length, gefunden, vorzug };
}

describe("K4 · Segmente sind die zusammenhängenden Textläufe des Editor-HTML", () => {
  it("Blöcke trennen, Inline-Formatierung nicht; Reihenfolge ist die des Dokuments", () => {
    expect(segmenteAusHtml(HTML)).toEqual([
      "Kundenaccount anlegen",
      "Im Kundenaccount steht das Kundenaccount-Kürzel.",
      "Kundenaccount prüfen",
      "Kundenaccount im Bild",
      "Link danach Kundenaccount.",
    ]);
    expect(hatPruefbarenText(segmenteAusHtml("<p> </p><p></p>"))).toBe(false);
    expect(hatPruefbarenText(segmenteAusHtml(HTML))).toBe(true);
  });

  it("Zeilenumbruch, Bild und innere Blöcke beenden einen Lauf", () => {
    expect(segmenteAusHtml("<p>Konto<br>Plus</p>")).toEqual(["Konto", "Plus"]);
    expect(segmenteAusHtml('<p>Konto<img src="/x.png" alt="">Plus</p>')).toEqual(["Konto", "Plus"]);
    expect(segmenteAusHtml("<div>a<p>b</p>c</div>")).toEqual(["a", "b", "c"]);
    expect(segmenteAusHtml("<ul><li>Konto</li><li>Plus</li></ul>")).toEqual(["Konto", "Plus"]);
  });
});

describe("K2/K3/K4 · Formatierungsgrenzen", () => {
  it("„Konto <b>Plus</b>“ ist EIN Lauf — das zugelassene Synonym bleibt zusammen", () => {
    expect(segmenteAusHtml("<p>Das Konto <b>Plus</b> ist gebucht.</p>")).toEqual([
      "Das Konto Plus ist gebucht.",
    ]);
  });

  it("„Kunden<b>account</b>“ ist EIN Wort — und wird über die Grenze hinweg übernommen", () => {
    const html = "<p>Das Kunden<b>account</b> ist <i>neu</i>.</p>";
    const segmente = segmenteAusHtml(html);
    expect(segmente).toEqual(["Das Kundenaccount ist neu."]);
    const ergebnis = hinweisUebernehmen(
      html,
      hinweisAn(segmente, 0, "Kundenaccount", "Kundenkonto"),
      segmente,
    );
    // Nacharbeit 4 (Bens Befund K4): ersetzt wird nur „account" → „konto", und zwar dort, wo es
    // stand — das <b> bleibt fett, „Kunden" bleibt ungefettet, das kursive „neu" bleibt.
    expect(ergebnis).toEqual({
      lage: "uebernommen",
      html: "<p>Das Kunden<b>konto</b> ist <i>neu</i>.</p>",
    });
  });

  it("beginnt der Fund in einer Formatierung, wird sie NICHT auf den Rest ausgeweitet", () => {
    const html = "<p>Das <b>Kunden</b>account ist <i>neu</i>.</p>";
    const segmente = segmenteAusHtml(html);
    const ergebnis = hinweisUebernehmen(
      html,
      hinweisAn(segmente, 0, "Kundenaccount", "Kundenkonto"),
      segmente,
    );
    expect(ergebnis).toEqual({
      lage: "uebernommen",
      html: "<p>Das <b>Kunden</b>konto ist <i>neu</i>.</p>",
    });
  });

  it("Links an der Fundstelle bleiben mit Ziel und Inhalt erhalten", () => {
    // Der gemeinsame Anfang steht im Link und bleibt dort; nur der fette Teil ändert sich.
    const geteilt = '<p>Siehe <a href="https://example.invalid/k">Kunden</a><b>account</b>.</p>';
    const s1 = segmenteAusHtml(geteilt);
    const e1 = hinweisUebernehmen(geteilt, hinweisAn(s1, 0, "Kundenaccount", "Kundenkonto"), s1);
    expect(e1).toEqual({
      lage: "uebernommen",
      html: '<p>Siehe <a href="https://example.invalid/k">Kunden</a><b>konto</b>.</p>',
    });
    // Beginnt der geänderte Teil im Link, steht der neue Teil im Link; der Link bleibt bestehen.
    const imLink = '<p><a href="https://example.invalid/k">Kundenac</a>count bleibt.</p>';
    const s2 = segmenteAusHtml(imLink);
    const e2 = hinweisUebernehmen(imLink, hinweisAn(s2, 0, "Kundenaccount", "Kundenkonto"), s2);
    expect(e2).toEqual({
      lage: "uebernommen",
      html: '<p><a href="https://example.invalid/k">Kundenkonto</a> bleibt.</p>',
    });
    // Gleiches Ende bleibt ebenso stehen: nur der abweichende Anfang wird ersetzt.
    const ende = "<p>Das <i>Alt</i><b>konto</b> ist offen.</p>";
    const s3 = segmenteAusHtml(ende);
    const e3 = hinweisUebernehmen(ende, hinweisAn(s3, 0, "Altkonto", "Kundenkonto"), s3);
    expect(e3).toEqual({
      lage: "uebernommen",
      html: "<p>Das <i>Kunden</i><b>konto</b> ist offen.</p>",
    });
  });
});

describe("K4 · Übernehmen ändert genau eine Stelle", () => {
  it("die fett gesetzte Stelle wird ersetzt und bleibt fett; alles andere bleibt bytegleich", () => {
    const segmente = segmenteAusHtml(HTML);
    const ergebnis = hinweisUebernehmen(
      HTML,
      hinweisAn(segmente, 1, "Kundenaccount", "Kundenkonto"),
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
      hinweisAn(segmente, 4, "Kundenaccount", "Kundenkonto"),
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
      hinweisAn(segmente, 3, "Kundenaccount", "Kundenkonto"),
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
    expect(fundumgebung(segmente[2] ?? "", 0, 13)).toEqual({
      vor: "",
      fund: "Kundenaccount",
      nach: " prüfen",
    });
  });
});

describe("K4 · Verwerfen trifft genau eine Fundstelle — auch bei gleichlautenden Absätzen", () => {
  const ZWEI = "<p>Das Kundenaccount ist neu.</p><p>Das Kundenaccount ist neu.</p>";

  function hinweiseFuer(segmente: string[]) {
    return segmente.map((_, segment) => ({
      begriffId: "b-1",
      ...hinweisAn(segmente, segment, "Kundenaccount", "Kundenkonto"),
    }));
  }

  it("zwei identische Absätze: ein Verwerfen lässt genau den anderen Hinweis und den Text stehen", () => {
    const segmente = segmenteAusHtml(ZWEI);
    expect(segmente).toEqual(["Das Kundenaccount ist neu.", "Das Kundenaccount ist neu."]);
    const hinweise = hinweiseFuer(segmente);
    const erster = hinweise[0]!;
    const zweiter = hinweise[1]!;
    const kennungEins = verwerfKennung(erster, segmente[0] ?? "");
    expect(kennungEins).not.toBe(verwerfKennung(zweiter, segmente[1] ?? ""));

    const verworfen = new Set([kennungEins]);
    expect(sichtbareHinweise(hinweise, segmente, verworfen)).toEqual([zweiter]);
    // Verwerfen schreibt nicht: der Text ist derselbe, beide Stellen stehen unverändert da.
    expect(segmenteAusHtml(ZWEI)).toEqual(segmente);

    // Eine erneute Prüfung desselben Textes liefert dieselben Hinweise — der fremde bleibt.
    const neuGeprueft = hinweiseFuer(segmenteAusHtml(ZWEI));
    expect(sichtbareHinweise(neuGeprueft, segmenteAusHtml(ZWEI), verworfen)).toEqual([zweiter]);
  });
});

describe("K4 · nie auf Verdacht", () => {
  it("wurde der Knoten inzwischen geändert, wird NICHTS ersetzt", () => {
    const segmente = segmenteAusHtml(HTML);
    const hinweis = hinweisAn(segmente, 1, "Kundenaccount", "Kundenkonto");
    const geaendert = HTML.replace("<strong>Kundenaccount</strong>", "<strong>Konto</strong>");
    expect(hinweisUebernehmen(geaendert, hinweis, segmente)).toEqual({ lage: "veraltet" });
  });

  it("verschiebt eine Einfügung die Knotenfolge, wird NICHTS ersetzt", () => {
    const segmente = segmenteAusHtml(HTML);
    const hinweis = hinweisAn(segmente, 1, "Kundenaccount", "Kundenkonto");
    const verschoben = `<p>Neuer erster Absatz.</p>${HTML}`;
    expect(hinweisUebernehmen(verschoben, hinweis, segmente)).toEqual({ lage: "veraltet" });
  });

  it("passt der Text an der Stelle nicht mehr, wird NICHTS ersetzt", () => {
    const segmente = segmenteAusHtml(HTML);
    const falsch = { segment: 4, start: 0, ende: 5, gefunden: "Kunde", vorzug: "Kundin" };
    expect(hinweisUebernehmen(HTML, falsch, segmente)).toEqual({ lage: "veraltet" });
  });
});
