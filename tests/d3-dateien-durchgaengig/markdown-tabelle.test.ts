// ================================================================================================
// JOB 4203 · D3 / T2 — DIE MARKDOWN-TABELLE WIRD ÜBERNOMMEN, NICHT ALS PIPE-ROHTEXT ABGELEGT.
// ================================================================================================
//
// AUSGANGSLAGE. `renderTextBlock` (`captureFromFile.ts:350-366`) kannte drei Fälle: eine einzelne
// Überschriftszeile → `<h2>`, ein Block aus lauter Listenpunkten → `<ul>`, alles übrige → `<p>` mit
// `<br>`. Eine GFM-Tabelle fiel damit in den `<p>`-Zweig und blieb als
// `<p>|&nbsp;Pruefschritt&nbsp;|…</p>` stehen — Rohtext mit Pipe-Zeichen, und daneben kein Hinweis,
// dass hier etwas nicht ausgelesen wurde.
//
// DIE WAHL (Auftrag §5, Weg a): die Tabelle wird ÜBERNOMMEN. Der Grund ist der Zweck des Eingangs —
// nicht ausgelesene Inhalte sollen sichtbar bleiben und nicht als vollständig übernommen gelten.
// Weg b (Tabelle bleibt Text, der Hinweis nennt sie) erfüllt nur die zweite Hälfte; Weg a erfüllt
// beide, weil die Zellen danach wirklich im Entwurf stehen. Der Verlusthinweis aus T1 bleibt und
// benennt, was WIRKLICH nicht übernommen wird (Auszeichnungen, Verweise, Bilder) — er wird durch
// diese Scheibe genauer, nicht überflüssig.
//
// DIE ABGRENZUNG IST TEIL DER ZUSAGE. Eine Tabelle ist nur, was eine Trennzeile trägt; ein Absatz
// mit Pipe-Zeichen darin ist keine. T2d misst genau diese Kante — ohne sie würde jeder Satz mit
// einem `|` zur Tabelle.
import { describe, expect, it } from "vitest";
import { wholeDocumentBodyHtml } from "../../apps/web/src/lib/captureFromFile";
import {
  MD_ABSATZ_NACH_TABELLE,
  MD_ABSATZ_ZEILEN,
  MD_ABSCHNITT_EINS,
  MD_ABSCHNITT_ZWEI,
  MD_LISTENPUNKTE,
  MD_TABELLE_KOPF,
  MD_TABELLE_MATRIX,
  MD_TABELLE_ZEILEN,
  MD_TITEL,
  MD_UEBERSCHRIFT_MIT_STRICH,
  markdownText,
} from "./referenzinhalt";
import { zellmatrixAusHtml } from "./tabellenmatrix";

function rumpf(text: string): string {
  return wholeDocumentBodyHtml({ fileName: "d3-referenz.md", text, sourceKind: "text" });
}

const REFERENZ_RUMPF = rumpf(markdownText());

describe("JOB 4203 · T2 — die Pipe-Tabelle der Markdown-Referenz", () => {
  it("T2a · wird eine echte Tabelle: Kopfzellen als th, Datenzellen als td", () => {
    expect(REFERENZ_RUMPF, "kein <table> im Rumpf").toContain("<table>");
    const kopf = MD_TABELLE_KOPF.map((z) => `<th>${z}</th>`).join("");
    expect(REFERENZ_RUMPF, "die Kopfzeile ist keine Kopfzeile geworden").toContain(
      `<thead><tr>${kopf}</tr></thead>`,
    );
    for (const zeile of MD_TABELLE_ZEILEN) {
      const tr = zeile.map((z) => `<td>${z}</td>`).join("");
      expect(REFERENZ_RUMPF, `Datenzeile fehlt: ${zeile.join(" | ")}`).toContain(`<tr>${tr}</tr>`);
    }
  });

  it("T2b · kein Pipe-Rohtext bleibt übrig — weder die Trennzeile noch eine Zellenzeile", () => {
    // Genau der Zustand, gegen den diese Scheibe steht: `<p>| Pruefschritt | Ergebnis |</p>`.
    expect(REFERENZ_RUMPF).not.toContain(`<p>| ${MD_TABELLE_KOPF.join(" | ")} |`);
    expect(REFERENZ_RUMPF, "die Trennzeile steht als Text im Entwurf").not.toContain("---");
  });

  it("T2c · Überschriften, Aufzählung und Absatz bleiben unverändert erhalten", () => {
    expect(REFERENZ_RUMPF).toContain(`<h2>${MD_TITEL}</h2>`);
    expect(REFERENZ_RUMPF).toContain(`<h2>${MD_ABSCHNITT_EINS}</h2>`);
    expect(REFERENZ_RUMPF).toContain(`<h2>${MD_ABSCHNITT_ZWEI}</h2>`);
    expect(REFERENZ_RUMPF).toContain(
      `<ul>${MD_LISTENPUNKTE.map((p) => `<li>${p}</li>`).join("")}</ul>`,
    );
    expect(REFERENZ_RUMPF).toContain(`<p>${MD_ABSATZ_ZEILEN.join("<br>")}</p>`);
  });

  it("T2d · ein Absatz mit Pipe-Zeichen ist KEINE Tabelle — ohne Trennzeile bleibt es ein Absatz", () => {
    const html = rumpf("Der Schalter | die Sicherung sind zu pruefen.\nDanach | folgt der Test.");
    expect(html).not.toContain("<table>");
    expect(html).toContain("<p>Der Schalter | die Sicherung sind zu pruefen.<br>");
  });

  it("T2e · Sonderzeichen in Zellen werden escaped — kein roher Markup-Durchschlag", () => {
    const html = rumpf(["| A | B |", "| --- | --- |", "| <b>x</b> | a & b |"].join("\n"));
    expect(html).toContain("<td>&lt;b&gt;x&lt;/b&gt;</td>");
    expect(html).toContain("<td>a &amp; b</td>");
  });

  it("T2f · eine Tabelle ohne Datenzeilen bleibt eine Tabelle mit Kopf — nichts wird erfunden", () => {
    const html = rumpf(["| A | B |", "| --- | --- |"].join("\n"));
    expect(html).toContain("<thead><tr><th>A</th><th>B</th></tr></thead>");
    expect(html, "ein leerer tbody täuscht eine Zeile vor").not.toContain("<tbody>");
  });

  // ================================================================================================
  // RUNDE 2 — DIE ZWEI KANTEN, AN DENEN BEN DIE ERSTE FASSUNG WIDERLEGT HAT.
  // ================================================================================================

  it("T2g · ZUORDNUNG: die ganze Zellmatrix stimmt — Spalte für Spalte, nicht nur Wort für Wort", () => {
    // BEN, Prüfpunkt 2: „prüft nur Zelltexte …, keine Tabellenstruktur". Eine Liste von Treffern
    // kann vollständig sein und die Zuordnung trotzdem verdrehen. Verglichen wird die MATRIX.
    expect(zellmatrixAusHtml(REFERENZ_RUMPF)).toEqual(MD_TABELLE_MATRIX.map((zeile) => [...zeile]));
  });

  it("T2h · ein GESCHÜTZTER Strich bleibt in seiner Zelle — kein Wert rutscht in die Nachbarspalte", () => {
    // Der Befund im Wortlaut (BEN, Prüfpunkt 5): „Aus `| Ventil A\\|B | bestanden |` entstehen drei
    // Zellen … Unter der Überschrift „Ergebnis" steht dadurch B statt bestanden."
    const html = rumpf(
      ["| Pruefschritt | Ergebnis |", "| --- | --- |", "| Ventil A\\|B | bestanden |"].join("\n"),
    );
    const matrix = zellmatrixAusHtml(html);
    expect(matrix, "die Tabelle hat nicht genau Kopf + eine Datenzeile").toHaveLength(2);
    expect(matrix[1], "der geschützte Strich hat die Zeile zerrissen").toEqual([
      "Ventil A|B",
      "bestanden",
    ]);
    // Und das Schutzzeichen selbst steht nicht mehr im Text — es ist Auszeichnung, kein Inhalt.
    expect(html, "das Schutzzeichen ist als Inhalt stehen geblieben").not.toContain("A\\|B");
  });

  it("T2i · eine Tabelle OHNE Leerzeile vor dem Folgeabsatz: beides wird übernommen", () => {
    // Der Befund im Wortlaut (BEN, Prüfpunkt 4): „Eine einfache Tabelle mit unmittelbar folgendem
    // Absatz bleibt vollständig Pipe-Rohtext … Der neue Hinweis behauptet dennoch ‚einfache
    // Tabellen übernommen'."
    const html = rumpf(
      ["| A | B |", "| --- | --- |", "| 1 | 2 |", "Ein Absatz direkt danach."].join("\n"),
    );
    expect(zellmatrixAusHtml(html)).toEqual([
      ["A", "B"],
      ["1", "2"],
    ]);
    expect(html, "der Absatz nach der Tabelle ist verloren gegangen").toContain(
      "<p>Ein Absatz direkt danach.</p>",
    );
    expect(html, "die Trennzeile steht als Text im Entwurf").not.toContain("---");
  });

  it("T2j · dasselbe in der Referenzdatei: Tabelle UND anschliessender Absatz stehen da", () => {
    // RUNDE 3: zwischen Tabelle und diesem Absatz steht in der Referenz jetzt die Überschrift mit
    // Strich (Kante 3). Beide bilden zusammen den Folgeblock; geprüft wird deshalb, dass der Absatz
    // ÜBERHAUPT dasteht und NICHT in einer Zelle gelandet ist — die Zuordnung misst T2q.
    expect(REFERENZ_RUMPF, "der Absatz nach der Tabelle fehlt").toContain(MD_ABSATZ_NACH_TABELLE);
    expect(REFERENZ_RUMPF, "der Absatz ist in die Tabelle geraten").not.toContain(
      `<td>${MD_ABSATZ_NACH_TABELLE}</td>`,
    );
  });

  it("T2k · ein Vorlauf-Absatz VOR der Tabelle bleibt Absatz — und die Tabelle bleibt Tabelle", () => {
    // Die Gegenrichtung derselben Kante. Ohne sie sagte T2i nur, dass irgendwo getrennt wird.
    const html = rumpf(["Erst ein Satz.", "| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n"));
    expect(html).toContain("<p>Erst ein Satz.</p>");
    expect(zellmatrixAusHtml(html)).toEqual([
      ["A", "B"],
      ["1", "2"],
    ]);
  });

  // ================================================================================================
  // RUNDE 3 — DIE DRITTE KANTE: EIN NEUER BLOCK BEENDET DIE TABELLE.
  // ================================================================================================
  //
  // Der Befund im Wortlaut (BEN zu Runde 2, Prüfpunkt 4/5): aus
  //     | Pruefschritt | Ergebnis |
  //     | --- | --- |
  //     | Ventilprobe | bestanden |
  //     ## Wartung | Sicherheit
  // wurde eine zusätzliche Tabellenzeile `["## Wartung", "Sicherheit"]` — „«Sicherheit» erscheint
  // dadurch unter «Ergebnis», obwohl es zur Überschrift gehört. Das ist eine erfundene fachliche
  // Zuordnung, kein bloßer Layoutverlust."
  //
  // Ursache: die Erkennung der Runde 2 setzte die Tabelle bei JEDER weiteren Zeile mit
  // ungeschütztem Strich fort. GFM bricht die Tabelle dagegen am Beginn eines anderen Blocks ab.
  // Geprüft wird ab jetzt für alle drei Blockarten, die BEN nennt — und Matrix und Folgeinhalt
  // werden GETRENNT gemessen (seine Promptverbesserung).

  it("T2m · eine ÜBERSCHRIFT mit Strich beendet die Tabelle — BENs Gegenbeispiel, wörtlich", () => {
    const html = rumpf(
      [
        "| Pruefschritt | Ergebnis |",
        "| --- | --- |",
        "| Ventilprobe | bestanden |",
        "## Wartung | Sicherheit",
        "Naechster Abschnitt.",
      ].join("\n"),
    );
    // (1) DIE MATRIX: genau Kopf plus EINE Datenzeile.
    expect(zellmatrixAusHtml(html), "die Überschrift ist zur Tabellenzeile geworden").toEqual([
      ["Pruefschritt", "Ergebnis"],
      ["Ventilprobe", "bestanden"],
    ]);
    // (2) DER FOLGEINHALT, getrennt gemessen: beide Zeilen stehen vollständig ausserhalb.
    const nachTabelle = html.slice(html.indexOf("</table>") + "</table>".length);
    expect(nachTabelle, "die Überschrift ist verloren gegangen").toContain(
      "## Wartung | Sicherheit",
    );
    expect(nachTabelle, "der Folgeabsatz ist verloren gegangen").toContain("Naechster Abschnitt.");
  });

  it("T2n · eine AUFZÄHLUNG mit Strich beendet die Tabelle", () => {
    const html = rumpf(
      ["| A | B |", "| --- | --- |", "| 1 | 2 |", "- Punkt | mit Strich", "Danach."].join("\n"),
    );
    expect(zellmatrixAusHtml(html)).toEqual([
      ["A", "B"],
      ["1", "2"],
    ]);
    const nachTabelle = html.slice(html.indexOf("</table>") + "</table>".length);
    expect(nachTabelle).toContain("- Punkt | mit Strich");
    expect(nachTabelle).toContain("Danach.");
  });

  it("T2o · ein BLOCKQUOTE mit Strich beendet die Tabelle", () => {
    const html = rumpf(
      ["| A | B |", "| --- | --- |", "| 1 | 2 |", "> Zitat | mit Strich", "Danach."].join("\n"),
    );
    expect(zellmatrixAusHtml(html)).toEqual([
      ["A", "B"],
      ["1", "2"],
    ]);
    const nachTabelle = html.slice(html.indexOf("</table>") + "</table>".length);
    expect(nachTabelle).toContain("&gt; Zitat | mit Strich");
    expect(nachTabelle).toContain("Danach.");
  });

  it("T2p · ein Blockanfang ist auch keine KOPFZEILE — sonst entstünde derselbe Fehler rückwärts", () => {
    // Die Gegenrichtung: `## Wartung | Sicherheit` über einer Trennzeile darf keine Tabelle öffnen.
    const html = rumpf(["## Wartung | Sicherheit", "| --- | --- |", "| 1 | 2 |"].join("\n"));
    expect(html, "eine Überschrift wurde zur Tabellenkopfzeile").not.toContain("<table>");
    expect(html).toContain("## Wartung | Sicherheit");
  });

  it("T2q · dasselbe in der Referenzdatei: die Überschrift steht ausserhalb der Tabelle", () => {
    expect(zellmatrixAusHtml(REFERENZ_RUMPF)).toEqual(MD_TABELLE_MATRIX.map((z) => [...z]));
    const nachTabelle = REFERENZ_RUMPF.slice(
      REFERENZ_RUMPF.indexOf("</table>") + "</table>".length,
    );
    expect(nachTabelle, "die Überschrift fehlt hinter der Tabelle").toContain(
      MD_UEBERSCHRIFT_MIT_STRICH,
    );
    expect(nachTabelle, "der Absatz fehlt hinter der Tabelle").toContain(MD_ABSATZ_NACH_TABELLE);
  });

  // ================================================================================================
  // RUNDE 3 — DIE ESCAPE-REGEL, EINDEUTIG FESTGELEGT UND BELEGT.
  // ================================================================================================
  //
  // Die Rückgabe der Runde 2 hat eine Gerade/Ungerade-Regel behauptet, die der Code nicht hielt:
  // `istGeschuetzt` zählte rückwärts, die Zellzerlegung konsumierte dagegen stumpf jedes `\|`.
  // BEN hat den Widerspruch gemessen: `| C:\\| bestanden |` ergab EINE Zelle statt zweier.
  //
  // DIE REGEL, ab jetzt an EINER Stelle umgesetzt (`zerlegePipeZeile`) und hier belegt:
  //   `\|`   → literaler Strich IN der Zelle      (ein Backslash schützt)
  //   `\\`   → literaler Backslash                (der Backslash schützt sich selbst)
  //   `\\|`  → literaler Backslash + TRENNER      (der Strich ist frei)
  //   `\\\|` → literaler Backslash + literaler Strich
  // Jede dieser vier Lagen bekommt ihren eigenen Fall, innen wie am Rand.

  it("T2r · EIN Backslash schützt den Strich — innen wie am Zeilenende", () => {
    expect(
      zellmatrixAusHtml(rumpf(["| A | B |", "| --- | --- |", "| x\\|y | z |"].join("\n"))),
    ).toEqual([
      ["A", "B"],
      ["x|y", "z"],
    ]);
    // Am Rand: der abschliessende Strich ist geschützt, die Zelle endet also auf `|`.
    expect(
      zellmatrixAusHtml(rumpf(["| A | B |", "| --- | --- |", "| x | z\\|"].join("\n"))),
    ).toEqual([
      ["A", "B"],
      ["x", "z|"],
    ]);
  });

  it("T2s · ZWEI Backslashes sind ein literaler Backslash — der Strich dahinter TRENNT", () => {
    // Genau BENs Gegenbeispiel: `| C:\\| bestanden |` muss ZWEI Zellen ergeben.
    expect(
      zellmatrixAusHtml(rumpf(["| A | B |", "| --- | --- |", "| C:\\\\| bestanden |"].join("\n"))),
    ).toEqual([
      ["A", "B"],
      ["C:\\", "bestanden"],
    ]);
  });

  it("T2t · DREI Backslashes sind ein literaler Backslash plus ein geschützter Strich", () => {
    expect(
      zellmatrixAusHtml(rumpf(["| A | B |", "| --- | --- |", "| C:\\\\\\|x | y |"].join("\n"))),
    ).toEqual([
      ["A", "B"],
      ["C:\\|x", "y"],
    ]);
  });

  it("T2u · die Erkennung und die Zerlegung folgen DERSELBEN Regel — kein zweiter Maßstab", () => {
    // Der eigentliche Befund der Runde 2 war nicht die Zahl der Zellen, sondern dass zwei Stellen
    // dieselbe Regel verschieden auslegten. Diese Zeile misst die Deckungsgleichheit: eine Zeile,
    // deren einziger Strich durch ZWEI Backslashes freigegeben ist, MUSS als Tabellenzeile gelten
    // (die Erkennung) UND in zwei Zellen zerfallen (die Zerlegung).
    const html = rumpf(["| A | B |", "| --- | --- |", "C:\\\\| frei"].join("\n"));
    expect(zellmatrixAusHtml(html)).toEqual([
      ["A", "B"],
      ["C:\\", "frei"],
    ]);
  });

  it("T2l · GEGENPROBE zur Trennung: ein Absatz ohne Trennzeile bleibt EIN Absatz, ungeteilt", () => {
    // Ohne diese Zeile könnte die neue Trennung jeden Absatz zerlegen, in dem ein `|` vorkommt.
    const html = rumpf("Zeile eins | mit Strich.\nZeile zwei | mit Strich.");
    expect(html).not.toContain("<table>");
    // Der Rumpf OHNE den Quelle-Blockquote ist GENAU ein Absatz — nicht zwei, nicht drei.
    expect(html.replace(/^<blockquote>[\s\S]*?<\/blockquote>/, "")).toBe(
      "<p>Zeile eins | mit Strich.<br>Zeile zwei | mit Strich.</p>",
    );
  });
});
