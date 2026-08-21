// ================================================================================================
// JOB 1612 · D1 (M-6, Anker D44) — DIE GLIEDERUNG STIMMT MIT DEM DOKUMENT UEBEREIN.
// ================================================================================================
//
// D44: „Ein langes Dokument pruefen, ohne durch 13.288 Pixel zu scrollen." Die Leiste tut das
// ueber Sprungmarken — und die haengen an einer Zusage, die man leicht uebersieht:
//
//   **Der n-te Eintrag der Leiste muss die n-te Ueberschrift im Editor treffen.**
//
// Gesprungen wird ueber die POSITION in `querySelectorAll("h2, h3")`, nicht ueber eine Kennung.
// Jede Abweichung zwischen „was `d44Gliederung` zaehlt" und „was der Browser zaehlt" ist ein
// Sprung auf den falschen Absatz — ein STILLER: es sieht aus, als haette die Leiste funktioniert.
//
// UND: KEINE MINDESTZAHL. `BEN-PRUEFUNG-JOB-1521-D1.md:3` hat eine Drei-Ueberschriften-Schwelle
// mit ROT zurueckgewiesen, weil sie „gerade bei einem sehr langen Dokument mit nur zwei
// Abschnitten" die Leiste unterdrueckt. Die Faelle S1–S3 halten das fest.
import { describe, expect, it } from "vitest";
import {
  D44_GLIEDERUNG_GRENZE,
  d44Gliederung,
  d44LeisteZeigen,
  d44SichtbareEintraege,
} from "../../apps/web/src/components/d44Struktur";

/**
 * Zaehlt die Ueberschriften so, wie der Browser sie zaehlen wuerde — schlicht ueber die Tags.
 * Bewusst NICHT mit derselben Regex wie das Produkt: sonst pruefte der Test seine eigene Annahme.
 */
function wieDerBrowserZaehlt(html: string): number {
  return (html.match(/<h[23]\b/gi) ?? []).length;
}

/** Ein Dokument ueber mehrere Bildschirmhoehen mit GENAU ZWEI Ueberschriften — BENs Abnahmefall. */
const LANG_MIT_ZWEI = [
  "<h2>Konstruktion</h2>",
  "<p>Absatz</p>".repeat(200),
  "<h2>Pruefung</h2>",
  "<p>Absatz</p>".repeat(200),
].join("");

describe("D44 · P — Leiste und Dokument zaehlen gleich", () => {
  it("P1 · jede Ueberschrift bekommt genau einen Eintrag", () => {
    const html = "<h2>Eins</h2><p>x</p><h3>Zwei</h3><p>x</p><h2>Drei</h2>";
    const eintraege = d44Gliederung(html);
    expect(eintraege).toHaveLength(wieDerBrowserZaehlt(html));
    expect(eintraege.map((e) => e.text)).toEqual(["Eins", "Zwei", "Drei"]);
    expect(eintraege.map((e) => e.position)).toEqual([0, 1, 2]);
  });

  it("P2 · eine LEERE Ueberschrift zaehlt mit — sonst springt alles danach falsch", () => {
    // Der Fall, an dem diese Datei haengt. Ein Import erzeugt leicht ein `<h3></h3>`; der Browser
    // zaehlt es mit. Wer es hier wegwirft, verschiebt jedes folgende Sprungziel um eins.
    const html = "<h2>Eins</h2><h3></h3><h2>Drei</h2>";
    const eintraege = d44Gliederung(html);
    expect(eintraege).toHaveLength(wieDerBrowserZaehlt(html));
    expect(eintraege[1]?.text).toBe("");
    // „Drei" ist die DRITTE Ueberschrift im DOM — also Position 2, nicht 1.
    expect(eintraege[2]).toEqual({ ebene: 2, text: "Drei", position: 2 });
    expect(D44_GLIEDERUNG_GRENZE.leereZaehlenMit).toBe(true);
  });

  it("P3 · die leere Ueberschrift wird NICHT angezeigt, obwohl sie zaehlt", () => {
    // Zwei verschiedene Mengen, und sie muessen verschieden bleiben: gezaehlt wird alles,
    // gezeigt wird, was Text hat. Die Positionen der gezeigten bleiben die des Dokuments.
    const sichtbar = d44SichtbareEintraege(d44Gliederung("<h2>Eins</h2><h3></h3><h2>Drei</h2>"));
    expect(sichtbar.map((e) => e.text)).toEqual(["Eins", "Drei"]);
    expect(sichtbar.map((e) => e.position)).toEqual([0, 2]);
  });

  it("P4 · Attribute an der Ueberschrift verschieben die Zaehlung nicht", () => {
    // Der Import hinterlaesst Attribute (`<h2 id="_Toc123">`, Klassen, style).
    const html = '<h2 id="_Toc1">Eins</h2><h3 class="x" style="color:red">Zwei</h3>';
    expect(d44Gliederung(html)).toHaveLength(wieDerBrowserZaehlt(html));
    expect(d44Gliederung(html).map((e) => e.text)).toEqual(["Eins", "Zwei"]);
  });
});

describe("D44 · S — keine Mindestzahl von Ueberschriften", () => {
  it("S1 · ein langes Dokument mit GENAU ZWEI Ueberschriften zeigt die Leiste", () => {
    // BENs Abnahmesatz, woertlich: „Ein ueber mehrere Viewport-Hoehen langes Dokument mit genau
    // zwei Ueberschriften zeigt die Leiste."
    const eintraege = d44Gliederung(LANG_MIT_ZWEI);
    expect(eintraege).toHaveLength(2);
    expect(d44LeisteZeigen(eintraege)).toBe(true);
    expect(LANG_MIT_ZWEI.length).toBeGreaterThan(2000); // mehrere Bildschirmhoehen
  });

  it("S2 · und der zweite Eintrag zeigt auf die zweite Ueberschrift", () => {
    // Die Positionszusage fuer BENs Klickfall — hier an der Zaehlung, im mounted-Test am Baum.
    const eintraege = d44SichtbareEintraege(d44Gliederung(LANG_MIT_ZWEI));
    expect(eintraege[1]).toEqual({ ebene: 2, text: "Pruefung", position: 1 });
  });

  it("S3 · schon EINE Ueberschrift genuegt", () => {
    expect(d44LeisteZeigen(d44Gliederung("<h2>Allein</h2>"))).toBe(true);
    expect(D44_GLIEDERUNG_GRENZE.mindestzahl).toBe(0);
  });

  it("S4 · ohne Ueberschrift keine Leiste — es gaebe nichts anzuspringen", () => {
    expect(d44LeisteZeigen(d44Gliederung("<p>Nur Text</p>"))).toBe(false);
    expect(d44LeisteZeigen(d44Gliederung("<h2></h2><h3></h3>"))).toBe(false);
  });
});

describe("D44 · B — die Beschriftung ist lesbar und ist Text", () => {
  it("B1 · Auszeichnung im Titel wird zu Text, nicht zu Markup", () => {
    const eintraege = d44Gliederung("<h2>Der <strong>wichtige</strong> Teil</h2>");
    expect(eintraege[0]?.text).toBe("Der wichtige Teil");
    expect(eintraege[0]?.text).not.toContain("<");
    expect(D44_GLIEDERUNG_GRENZE.gibtMarkupAus).toBe(false);
  });

  it("B2 · Entities werden aufgeloest — durch die kanonische Reduktion des Hauses", () => {
    // `htmlToPlainText` (lib/richText.ts:433), nicht eine eigene Wandlung: eine zweite waere eine
    // zweite Wahrheit, und `mega85-suchtext-formatierung` fuehrt genau darueber Buch.
    expect(d44Gliederung("<h2>Pr&uuml;fung &amp; Abnahme</h2>")[0]?.text).toBe("Prüfung & Abnahme");
  });

  it("B3 · Zeilenumbrueche werden zu einem Leerzeichen", () => {
    expect(d44Gliederung("<h2>Erste\n   Zeile</h2>")[0]?.text).toBe("Erste Zeile");
  });

  it("B4 · die Ebene wird unterschieden", () => {
    expect(d44Gliederung("<h2>Oben</h2><h3>Darunter</h3>").map((e) => e.ebene)).toEqual([2, 3]);
  });

  it("B5 · h1 und h4 kommen nicht vor und werden auch nicht gelesen", () => {
    // `mapDocxHeadings` (lib/docx.ts:55) bildet sie vorher auf h2/h3 ab. Taeuchte hier ein h1 auf,
    // waere das ein Fehler weiter vorn — die Leiste soll ihn nicht kaschieren.
    expect(d44Gliederung("<h1>Titel</h1><h4>Klein</h4>")).toEqual([]);
  });

  it("B6 · leerer oder unpassender Eingang stuerzt nicht ab", () => {
    expect(d44Gliederung("")).toEqual([]);
    expect(d44Gliederung(undefined as unknown as string)).toEqual([]);
    expect(d44Gliederung(null as unknown as string)).toEqual([]);
  });

  it("B7 · zwei Aufrufe liefern dasselbe", () => {
    // Eine globale Regex traegt `lastIndex`. Mit `exec` in einer Schleife liefert der zweite
    // Aufruf weniger Treffer als der erste.
    expect(d44Gliederung(LANG_MIT_ZWEI)).toEqual(d44Gliederung(LANG_MIT_ZWEI));
  });
});
