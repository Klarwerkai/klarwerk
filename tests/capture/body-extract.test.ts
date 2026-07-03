import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  BODY_EXTRACT_TEXT,
  appendExtractSections,
  appendablePoints,
  extractSectionsHtml,
  normalizeExtractLocale,
} from "../../apps/web/src/lib/bodyExtract";

// SCRUM-405 (Pedi 03.07.): „Aus Dokument ergänzen" — ausgewählte Extraktions-Punkte werden
// als Abschnitte an den BESTEHENDEN Artikel angehängt. Getestet wird die DOM-freie Logik:
// G-2-Gate (ohne Belegstelle keine Übernahme), Anhängen statt Ersetzen, sichtbarer
// Quellenvermerk je Punkt, sanitisiertes HTML, aufgelöste DE+EN-Texte.
const POINT = {
  title: "Dosierwert nach Schichtwechsel prüfen",
  summary: "Nach jedem Schichtwechsel weicht der Dosierwert an Linie L4 ab.",
  sourceExcerpt: "Protokoll 12.05.: Dosierwert L4 nach Übergabe um 0,3 bar erhöht.",
};

describe("SCRUM-405: Extract-Punkte an den Artikel anhängen", () => {
  it("lässt nur Punkte mit Titel UND Belegstelle durch (G-2: ohne Beleg keine Übernahme)", () => {
    const ok = { ...POINT };
    const noExcerpt = { ...POINT, sourceExcerpt: "   " };
    const noTitle = { ...POINT, title: "" };
    expect(appendablePoints([ok, noExcerpt, noTitle])).toEqual([ok]);
    expect(extractSectionsHtml([noExcerpt, noTitle], "doku.pdf")).toBe("");
  });

  it("baut je Punkt einen Abschnitt mit Titel, Kurzfassung und Belegstellen-Zitat samt Datei", () => {
    const html = extractSectionsHtml([POINT], "wartung-l4.pdf", "de");
    expect(html).toContain("<h3>");
    expect(html).toContain(POINT.title);
    expect(html).toContain(POINT.summary);
    expect(html).toContain("<blockquote>");
    expect(html).toContain(POINT.sourceExcerpt);
    expect(html).toContain("Quelle: wartung-l4.pdf");
    const en = extractSectionsHtml([POINT], "wartung-l4.pdf", "en");
    expect(en).toContain("Source: wartung-l4.pdf");
  });

  it("hängt an bestehenden Inhalt AN und ersetzt nichts; leerer Body wird gesetzt", () => {
    const base = "<h2>Bestehendes Wissen</h2><p>bleibt stehen</p>";
    const next = appendExtractSections(base, [POINT], "doku.pdf");
    expect(next.startsWith(base)).toBe(true);
    expect(next.length).toBeGreaterThan(base.length);
    expect(appendExtractSections("", [POINT], "doku.pdf")).toContain(POINT.title);
    // Keine übernahmefähigen Punkte ⇒ Body bleibt unangetastet.
    expect(appendExtractSections(base, [{ ...POINT, sourceExcerpt: "" }], "doku.pdf")).toBe(base);
  });

  it("sanitisiert das Fragment (keine Skripte/Handler aus Dokumentinhalten)", () => {
    const evil = {
      title: "Titel <script>alert(1)</script>",
      summary: '<img src=x onerror="alert(1)">Zusammenfassung',
      sourceExcerpt: 'Beleg <b onclick="x()">fett</b>',
    };
    const html = extractSectionsHtml([evil], "doku.pdf");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("onclick");
  });

  it("normalisiert die Locale wie der Draft-Artikel (en* → en, sonst de)", () => {
    expect(normalizeExtractLocale("en-US")).toBe("en");
    expect(normalizeExtractLocale("de-DE")).toBe("de");
    expect(normalizeExtractLocale(undefined)).toBe("de");
  });

  it("löst alle Panel-Texte in DE und EN auf", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of Object.values(BODY_EXTRACT_TEXT)) {
        expect(i18n.t(key), `${lng}:${key}`).not.toBe(key);
      }
      expect(i18n.t(BODY_EXTRACT_TEXT.helpBody).length).toBeGreaterThan(120);
    }
  });
});
