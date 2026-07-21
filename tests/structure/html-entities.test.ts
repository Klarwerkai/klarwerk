// WP-IC-PAKET-1 (Teil 1, Pedis Screenshot &uuml;/&auml;/&middot;): HTML-Entities in Import-Texten.
// Getestet: der Server-Decoder an der QUELLE (services/structure — läuft im Confluence-Import über
// htmlToPlainText), der Client-Spiegel für die ALTBESTAND-Anzeige (htmlEntities.ts), Parität beider,
// die Doppel-Dekodier-Falle (&amp;uuml; → EINMAL → „&uuml;" als Literal, nie ü), XSS-Neutralität
// (Ergebnis ist immer nur ein String; die Anzeige rendert Text, nie HTML) und die Verdrahtung der
// Anzeige-Stellen (Queue-Karten, Vorschau, Erkundungs-Chips).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NAMED_HTML_ENTITIES as CLIENT_NAMED,
  decodeHtmlEntities as clientDecode,
} from "../../apps/web/src/lib/htmlEntities";
import { htmlToPlainText as clientHtmlToPlainText } from "../../apps/web/src/lib/richText";
import {
  decodeHtmlEntities as serverDecode,
  htmlToPlainText as serverHtmlToPlainText,
} from "../../services/structure";
// White-box (wie reasoner-Tests auf src): die benannte Map fuer die GENERIERTE Paritaets-Matrix.
import { NAMED_HTML_ENTITIES as SERVER_NAMED } from "../../services/structure/src/sanitize";

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

  // WP-IC-PAKET-1b (bens GELB-1): auch DEL (U+007F) und die C1-Steuerzeichen (U+0080..U+009F) bleiben
  // fail-closed roh stehen — wie die C0-Zeichen.
  it("DEL + C1-Steuerzeichen werden NICHT dekodiert (fail-closed wie C0)", () => {
    for (const decode of [serverDecode, clientDecode]) {
      expect(decode("&#127;")).toBe("&#127;");
      expect(decode("&#x7F;")).toBe("&#x7F;");
      expect(decode("&#x80;")).toBe("&#x80;");
      expect(decode("&#128;")).toBe("&#128;");
      expect(decode("&#159;")).toBe("&#159;");
      expect(decode("&#x9F;")).toBe("&#x9F;");
      // Die Grenz-Nachbarn bleiben normal dekodierbar (U+007E Tilde, U+00A0 NBSP).
      expect(decode("&#126;")).toBe("~");
      expect(decode("&#160;")).toBe("\u00A0");
    }
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

// WP-IC-PAKET-1b (bens GELB-1): Parität als GENERIERTE Matrix statt endlicher Fixture-Liste —
// deterministisch (keine Zufallsquelle): (1) die Map-Schlüssel BEIDER Seiten sind identisch, (2) jede
// benannte Entity läuft durch beide Decoder, (3) numerische Codepoints in festen Stichproben-Schritten
// über den GESAMTEN Bereich 0..0x110000 (dez + hex) plus alle Kantenwerte (C0/Tab/LF/CR, DEL,
// C1-Grenzen, Surrogat-Grenzen, BMP-/Unicode-Maximum, jenseits des Maximums).
describe("WP-IC-PAKET-1 Teil 1/1b: Client-Spiegel ist byte-gleich zum Server-Decoder (generierte Matrix)", () => {
  it("die benannten Maps beider Seiten sind identisch", () => {
    expect(Object.keys(CLIENT_NAMED).sort()).toEqual(Object.keys(SERVER_NAMED).sort());
    for (const [name, value] of Object.entries(SERVER_NAMED)) {
      expect(CLIENT_NAMED[name], name).toBe(value);
    }
  });

  it("JEDE benannte Entity der Map dekodiert beidseitig identisch (inkl. Kontext-Varianten)", () => {
    for (const name of Object.keys(SERVER_NAMED)) {
      for (const probe of [`&${name};`, `x&${name};y`, `&amp;${name};`, `&${name}`]) {
        expect(clientDecode(probe), probe).toBe(serverDecode(probe));
      }
    }
  });

  it("numerische Codepoints: Stichproben-Schritte über 0..0x110000 + alle Kantenwerte, dez und hex", () => {
    const samples: number[] = [];
    // Fester Stichproben-Schritt über den gesamten Bereich (deterministisch, kein Zufall).
    for (let code = 0; code <= 0x110000; code += 3557) {
      samples.push(code);
    }
    // Kantenwerte: C0-Grenzen + erlaubte Whitespaces, DEL, C1-Grenzen, Surrogate, Maxima.
    samples.push(
      0,
      8,
      9,
      10,
      11,
      13,
      14,
      31,
      32,
      126,
      127,
      128,
      159,
      160,
      0xd7ff,
      0xd800,
      0xdfff,
      0xe000,
      0xfffd,
      0xffff,
      0x10000,
      0x10ffff,
      0x110000,
      0x110001,
    );
    for (const code of samples) {
      for (const probe of [
        `&#${code};`,
        `&#x${code.toString(16)};`,
        `&#X${code.toString(16).toUpperCase()};`,
      ]) {
        expect(clientDecode(probe), probe).toBe(serverDecode(probe));
      }
    }
  });

  it("gemischte/kaputte Muster bleiben paritätisch (Doppel-Falle, Unbekanntes, leer)", () => {
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
