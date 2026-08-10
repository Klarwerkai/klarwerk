// AUFTRAG-mega84 Block B — FETT, KURSIV, ZEILENUMBRUCH IN DER BILDBESCHREIBUNG.
//
// Pedis Wort ist „formatieren" (seit 20.07. mehrfach gestellt), sein entschiedener Umfang vom
// 31.07., 13:30: fett, kursiv, Zeilenumbruch — mehr nicht.
//
// Der Auftrag sagt zu diesem Block ausdrücklich: die Verträge tragen das bereits, „belege das,
// statt es zu glauben". Genau das tut diese Datei. Sie prüft an den ECHTEN Bausteinen, nicht an
// einer Nacherzählung:
//   · der Client-Sanitizer (`lib/richText.ts`) und der autoritative Server-Sanitizer
//     (`services/structure`) lassen dieselben drei Tags durch und werfen dasselbe weg,
//   · Galerie (`lib/bodyImages.ts`), Suche (`lib/librarySearch.ts` + der Server-Spiegel
//     `services/structure/captions.ts`) und Export (`htmlToPlainText`) lesen die Fußnote als
//     KLARTEXT — Formatierung kann sie also nicht beschädigen,
//   · die Zeichengrenze zählt Klartext und nicht Markup.
import { describe, expect, it } from "vitest";
import { extractBodyImages } from "../../apps/web/src/lib/bodyImages";
import {
  MAX_CAPTION_TEXT_CHARS,
  applyCaptionSuggestionToHtml,
} from "../../apps/web/src/lib/captionAiSuggest";
import { imageCaptionTexts } from "../../apps/web/src/lib/librarySearch";
import {
  capCaptionHtml,
  captionPlainText,
  htmlToPlainText,
  sanitizeCaptionHtml,
  sanitizeHtml,
} from "../../apps/web/src/lib/richText";
import {
  htmlToPlainText as serverPlainText,
  sanitizeHtml as serverSanitize,
} from "../../services/structure";
import { imageCaptionTexts as serverCaptionTexts } from "../../services/structure/src/captions";

// Dieselbe Beschreibung einmal MIT und einmal OHNE Auszeichnung — die Klartext-Leser dürfen die
// beiden nicht unterscheiden können.
const MIT = "Der <strong>Dichtring</strong> am <em>Ventil V2</em>,<br>sichtbar gerissen.";
const OHNE = "Der Dichtring am Ventil V2, sichtbar gerissen.";

function figur(caption: string): string {
  return `<figure><img src="/api/objects/x/raw" data-image-id="kw-a"><figcaption data-image-id="kw-a">${caption}</figcaption></figure>`;
}

describe("mega84 Block B: die drei erlaubten Auszeichnungen überleben beide Sanitizer", () => {
  it("fett, kursiv und Zeilenumbruch bleiben — auf dem Client wie auf dem Server", () => {
    const client = sanitizeCaptionHtml(MIT);
    expect(client).toContain("<strong>Dichtring</strong>");
    expect(client).toContain("<em>Ventil V2</em>");
    expect(client).toContain("<br>");

    // Der autoritative Server-Sanitizer sieht die Fußnote im ganzen Body — und lässt sie stehen.
    const gespeichert = serverSanitize(figur(client));
    expect(gespeichert).toContain("<strong>Dichtring</strong>");
    expect(gespeichert).toContain("<em>Ventil V2</em>");
    expect(gespeichert).toContain("<br>");
    expect(gespeichert).toContain('<figcaption data-image-id="kw-a">');
  });

  it("`b`/`i` aus dem Browser werden auf `strong`/`em` abgebildet, nicht verworfen", () => {
    // Was `document.execCommand("bold")` erzeugt, ist browserabhängig — deshalb darf die
    // Formatierung nicht davon abhängen, welche der beiden Schreibweisen herauskommt.
    const client = sanitizeCaptionHtml("Der <b>Dichtring</b> am <i>Ventil</i>");
    expect(client).toBe("Der <strong>Dichtring</strong> am <em>Ventil</em>");
    expect(serverSanitize(figur("Der <b>x</b> <i>y</i>"))).toContain(
      "<strong>x</strong> <em>y</em>",
    );
  });

  it("alles ANDERE überlebt nicht — auch das, was der Body sonst tragen dürfte", () => {
    const eingeschleust = [
      "<script>alert(1)</script>",
      '<img src="/api/objects/y/raw">',
      '<a href="https://example.invalid">Link</a>',
      '<div class="panel">Block</div>',
      "<h2>Überschrift</h2>",
      "<u>unterstrichen</u>",
      '<span style="font-size:99px">groß</span>',
    ];
    for (const roh of eingeschleust) {
      const client = sanitizeCaptionHtml(`Text ${roh}`);
      // Die Fußnote ist eine Bildunterschrift, kein zweiter Body: nur die drei Tags, nichts sonst.
      expect(client, roh).not.toMatch(/<(?!\/?(?:strong|em|br)>)/);
      expect(client, roh).not.toContain("style");
      expect(client, roh).not.toContain("class");
      expect(client, roh).not.toContain("alert(1)");
    }
  });

  it("Attribute an den erlaubten Tags werden abgestreift (kein style, keine Klassen, kein Handler)", () => {
    const client = sanitizeCaptionHtml(
      '<strong class="x" style="color:red" onclick="steal()">fett</strong>',
    );
    expect(client).toBe("<strong>fett</strong>");
  });
});

describe("mega84 Block B: Galerie, Suche und Export lesen Klartext — Formatierung kann nichts beschädigen", () => {
  const formatiert = serverSanitize(figur(sanitizeCaptionHtml(MIT)));
  const schlicht = serverSanitize(figur(OHNE));

  it("die Galerie liefert für beide DENSELBEN Fußnotentext", () => {
    const a = extractBodyImages(formatiert);
    const b = extractBodyImages(schlicht);
    expect(a).toHaveLength(1);
    expect(a[0]?.caption).toBe(b[0]?.caption);
    expect(a[0]?.caption).toBe(OHNE);
  });

  it("die Suche (Client UND ihr Server-Spiegel) liefert für beide DENSELBEN Text", () => {
    expect(imageCaptionTexts(formatiert)).toEqual(imageCaptionTexts(schlicht));
    expect(serverCaptionTexts(formatiert)).toEqual(serverCaptionTexts(schlicht));
    expect(imageCaptionTexts(formatiert)).toEqual([OHNE]);
  });

  it("der Export-Klartext ist für beide gleich (Client und Server)", () => {
    expect(htmlToPlainText(formatiert)).toBe(htmlToPlainText(schlicht));
    expect(serverPlainText(formatiert)).toBe(serverPlainText(schlicht));
  });
});

describe("mega84 Block B: die Zeichengrenze zählt KLARTEXT, nicht Markup", () => {
  it("Auszeichnung kostet den Nutzer nichts von seinen Zeichen", () => {
    // 17 Zeichen Markup, 4 Zeichen Text — gezählt werden die vier.
    expect(captionPlainText("<strong>fett</strong>")).toBe("fett");
    expect(captionPlainText("<strong>fett</strong>").length).toBe(4);
  });

  it("die Kappung schneidet Text, nicht Markup — und zerreißt die Verschachtelung nicht", () => {
    const lang = `<strong>${"a".repeat(500)}</strong>`;
    const gekappt = capCaptionHtml(lang, MAX_CAPTION_TEXT_CHARS);
    expect(captionPlainText(gekappt).length).toBe(MAX_CAPTION_TEXT_CHARS);
    // Das Tag lebt noch und ist geschlossen — ein roher slice() hätte es mitten im Wort abgehackt
    // und ein offenes <strong> hinterlassen, das den restlichen Body fett gefärbt hätte.
    expect(gekappt.startsWith("<strong>")).toBe(true);
    expect(gekappt.endsWith("</strong>")).toBe(true);
    expect(sanitizeCaptionHtml(gekappt)).toBe(gekappt);
  });

  it("ein Zeilenumbruch bezahlt sein Zeichen mit — die Grenze bleibt eine Obergrenze", () => {
    const viele = `${"a".repeat(MAX_CAPTION_TEXT_CHARS)}${"<br>".repeat(50)}`;
    expect(
      captionPlainText(capCaptionHtml(viele, MAX_CAPTION_TEXT_CHARS)).length,
    ).toBeLessThanOrEqual(MAX_CAPTION_TEXT_CHARS);
  });

  it("ein übernommener Vorschlag wird escaped eingefügt und kann keine Formatierung einschleusen", () => {
    // Das Modell liefert Klartext. Käme daraus einmal etwas Tag-Ähnliches, darf es Text bleiben.
    const ergebnis = applyCaptionSuggestionToHtml(
      "",
      "Ein <strong>Trick</strong> & mehr",
      "replace",
    );
    expect(ergebnis).not.toContain("<strong>");
    expect(captionPlainText(ergebnis)).toBe("Ein <strong>Trick</strong> & mehr");
  });

  it("Anhängen erhält die bereits gesetzte Formatierung des Nutzers", () => {
    const ergebnis = applyCaptionSuggestionToHtml(
      "<strong>Ventil</strong>",
      "V2 gerissen",
      "append",
    );
    expect(ergebnis).toBe("<strong>Ventil</strong> V2 gerissen");
    expect(captionPlainText(ergebnis)).toBe("Ventil V2 gerissen");
  });

  it("auch ein langer Vorschlag läuft nicht über die sichtbar ausgewiesene Grenze", () => {
    const ergebnis = applyCaptionSuggestionToHtml(
      "",
      "x".repeat(MAX_CAPTION_TEXT_CHARS + 120),
      "replace",
    );
    expect(captionPlainText(ergebnis).length).toBe(MAX_CAPTION_TEXT_CHARS);
  });
});

describe("mega84 Block B: der Fußnoten-Sanitizer ist eine VERENGUNG des vorhandenen, keine zweite Allowlist", () => {
  it("was der Fußnoten-Sanitizer durchlässt, lässt auch der Body-Sanitizer durch", () => {
    // Die Richtung ist der Punkt: es kann nichts durch die Fußnote hereinkommen, was der Body
    // nicht ohnehin trüge. Eine zweite, breitere Allowlist wäre genau der Weg, auf dem sich
    // Sicherheitsgrenzen auseinanderentwickeln.
    for (const probe of [MIT, "<b>x</b>", "<i>y</i>", "a<br>b", "&amp; &lt;"]) {
      const eng = sanitizeCaptionHtml(probe);
      expect(sanitizeHtml(eng), probe).toBe(eng);
      expect(serverSanitize(figur(eng)), probe).toContain(eng);
    }
  });
});
