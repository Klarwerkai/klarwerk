// WP-IC-PAKET-1 (Teil 1, Pedis Screenshot &uuml;/&auml;/&middot;): HTML-Entities in Import-Texten.
// Getestet: der Server-Decoder an der QUELLE (services/structure — läuft im Confluence-Import über
// htmlToPlainText), der Client-Spiegel für die ALTBESTAND-Anzeige (htmlEntities.ts), Parität beider,
// die Doppel-Dekodier-Falle (&amp;uuml; → EINMAL → „&uuml;" als Literal, nie ü), XSS-Neutralität
// (Ergebnis ist immer nur ein String; die Anzeige rendert Text, nie HTML) und die Verdrahtung der
// Anzeige-Stellen (Queue-Karten, Vorschau, Erkundungs-Chips).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeHtmlEntities as clientDecode } from "../../apps/web/src/lib/htmlEntities";
import { htmlToPlainText as clientHtmlToPlainText } from "../../apps/web/src/lib/richText";
import {
  decodeHtmlEntities as serverDecode,
  htmlToPlainText as serverHtmlToPlainText,
} from "../../services/structure";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("WP-IC-PAKET-1 Teil 1: decodeHtmlEntities (Server)", () => {
  it("dekodiert benannte Entities (Umlaute, Satzzeichen, Basis-Set)", () => {
    expect(serverDecode("K&uuml;hlung &auml;ndern &middot; T&Auml;GLICH")).toBe(
      "Kühlung ändern · TÄGLICH",
    );
    expect(serverDecode("Ma&szlig; &ndash; Grad&deg; &euro;5")).toBe("Maß – Grad° €5");
    expect(serverDecode("A &amp; B &lt;x&gt; &quot;q&quot; &apos;a&apos;")).toBe(
      `A & B <x> "q" 'a'`,
    );
  });

  it("dekodiert numerische Entities (dezimal + hex, Groß-/Klein-x)", () => {
    expect(serverDecode("&#228;&#246;&#252;")).toBe("äöü");
    expect(serverDecode("&#xE4;&#xF6;&#xFC;")).toBe("äöü");
    expect(serverDecode("&#XE4;")).toBe("ä");
    expect(serverDecode("&#8226; Punkt")).toBe("• Punkt");
  });

  it("DOPPEL-FALLE: dekodiert EINMAL — &amp;uuml; wird zum Literal &uuml;, nie zu ü", () => {
    expect(serverDecode("&amp;uuml;")).toBe("&uuml;");
    expect(serverDecode("&amp;amp;")).toBe("&amp;");
    expect(serverDecode("&amp;#228;")).toBe("&#228;");
    // Bereits korrekter Text bleibt unverändert (keine Muster → keine Ersetzung).
    expect(serverDecode("Kühlung & Wärme")).toBe("Kühlung & Wärme");
  });

  it("Unbekanntes/Ungültiges bleibt ehrlich stehen (fail-closed, nichts raten)", () => {
    expect(serverDecode("&foobar123;")).toBe("&foobar123;");
    expect(serverDecode("&uuml ohne Semikolon")).toBe("&uuml ohne Semikolon");
    // Steuerzeichen / Surrogate / jenseits Unicode → Roh-Text behalten.
    expect(serverDecode("&#2;")).toBe("&#2;");
    expect(serverDecode("&#xD800;")).toBe("&#xD800;");
    expect(serverDecode("&#1114112;")).toBe("&#1114112;");
  });

  it("XSS-neutral: dekodierte Tags sind nur ein STRING (kein HTML-Kontext in diesem Modul)", () => {
    const out = serverDecode("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).toBe("<script>alert(1)</script>");
    expect(typeof out).toBe("string");
  });
});

describe("WP-IC-PAKET-1 Teil 1: htmlToPlainText dekodiert an der QUELLE (Import-Pfad)", () => {
  it("Confluence-Storage-typische Entities landen als echte Zeichen im Klartext", () => {
    const html = "<p>Onboarding-Guide f&uuml;r neue Mitarbeiter &middot; T&auml;tigkeiten</p>";
    expect(serverHtmlToPlainText(html)).toBe("Onboarding-Guide für neue Mitarbeiter · Tätigkeiten");
    expect(clientHtmlToPlainText(html)).toBe("Onboarding-Guide für neue Mitarbeiter · Tätigkeiten");
  });

  it("die ALTE Doppel-Dekodier-Kette ist repariert: &amp;lt; wird zu &lt; (Literal), nicht zu <", () => {
    // Vorher wurde &amp; ZUERST ersetzt → aus &amp;lt; wurde erst &lt;, dann fälschlich <.
    expect(serverHtmlToPlainText("<p>&amp;lt;</p>")).toBe("&lt;");
    expect(clientHtmlToPlainText("<p>&amp;lt;</p>")).toBe("&lt;");
  });

  it("bestehendes Verhalten bleibt: Tags gestrippt, &nbsp; → Leerraum, Whitespace geglättet", () => {
    expect(serverHtmlToPlainText("<h2>A</h2><p>B&nbsp;&amp;&nbsp;C</p>")).toBe("A B & C");
  });
});

describe("WP-IC-PAKET-1 Teil 1: Client-Spiegel ist byte-gleich zum Server-Decoder (Parität)", () => {
  it("identische Ergebnisse auf allen Fixture-Klassen", () => {
    const fixtures = [
      "K&uuml;hlung &auml;ndern &middot; t&auml;glich",
      "&#228;&#xE4;&#XE4;",
      "&amp;uuml; &amp;amp; &amp;#228;",
      "&foobar; &uuml &#2; &#xD800;",
      "&lt;b&gt;kein HTML&lt;/b&gt;",
      "Schon korrekt: Kühlung & Wärme — 100 %",
      "",
    ];
    for (const fx of fixtures) {
      expect(clientDecode(fx), fx).toBe(serverDecode(fx));
    }
  });
});

describe("WP-IC-PAKET-1 Teil 1: Altbestand-ANZEIGE dekodiert — und rendert weiterhin nur TEXT", () => {
  it("Queue-Karten (Stufe2), Vorschau (ImportSelect) und Erkundungs-Chips (ImportExplore) dekodieren", () => {
    const stufe2 = read("apps/web/src/pages/Stufe2.tsx");
    expect(stufe2).toContain("decodeHtmlEntities(c.item.title)");
    expect(stufe2).toContain("decodeHtmlEntities(c.item.statement)");
    const select = read("apps/web/src/components/ImportSelect.tsx");
    expect(select).toContain("decodeHtmlEntities(entry.title)");
    expect(select).toContain("decodeHtmlEntities(entry.author)");
    const explore = read("apps/web/src/components/ImportExplore.tsx");
    expect(explore).toContain("decodeHtmlEntities(name)");
  });

  it("KEINE der Anzeige-Stellen rendert den dekodierten Text als HTML (kein dangerouslySetInnerHTML)", () => {
    for (const rel of [
      "apps/web/src/pages/Stufe2.tsx",
      "apps/web/src/components/ImportSelect.tsx",
      "apps/web/src/components/ImportExplore.tsx",
      "apps/web/src/lib/htmlEntities.ts",
    ]) {
      expect(read(rel), rel).not.toContain("dangerouslySetInnerHTML");
    }
  });
});
