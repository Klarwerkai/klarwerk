import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  applyDraftArticle,
  draftArticleHtml,
  normalizeDraftArticleLocale,
} from "../../apps/web/src/lib/captureDraftArticle";

// SCRUM-340: aus einem Capture-/Reasoner-Entwurf einen sicheren, strukturierten Body-Artikel (Vorschlag)
// erzeugen. DOM-frei, alle Eingaben escaped + sanitisiert; leere Felder ausgelassen; nicht-destruktiv.
describe("SCRUM-340: captureDraftArticle", () => {
  it("erzeugt H2/H3 + Listen aus Statement/Bedingungen/Maßnahmen (DE)", () => {
    const html = draftArticleHtml(
      {
        statement: "Vor Wartung Druck ablassen.",
        conditions: ["Anlage steht still", "Energie getrennt"],
        measures: ["Ventil schließen", "Restdruck prüfen"],
      },
      "de",
    );
    expect(html).toContain("<h2>Kernaussage</h2>");
    expect(html).toContain(
      '<div class="panel panel-info"><p>Vor Wartung Druck ablassen.</p></div>',
    );
    expect(html).toContain("<h3>Bedingungen</h3>");
    expect(html).toContain("<li>Anlage steht still</li>");
    expect(html).toContain("<h3>Maßnahmen</h3>");
    expect(html).toContain("<li>Restdruck prüfen</li>");
  });

  it("nutzt englische Überschriften je Locale", () => {
    const html = draftArticleHtml({ statement: "Release pressure first." }, "en");
    expect(html).toContain("<h2>Key statement</h2>");
  });

  it("lässt leere Felder aus und liefert '' bei leerem Entwurf", () => {
    expect(draftArticleHtml({ statement: "", conditions: [], measures: [], tags: [] })).toBe("");
    expect(draftArticleHtml({ statement: "   ", conditions: ["  ", ""] })).toBe("");
    const onlyMeasures = draftArticleHtml({ measures: ["Schritt A"] }, "de");
    expect(onlyMeasures).toContain("<h3>Maßnahmen</h3>");
    expect(onlyMeasures).not.toContain("Kernaussage");
    expect(onlyMeasures).not.toContain("Bedingungen");
  });

  it("bildet Tags als Kontext-Sektion ab", () => {
    const html = draftArticleHtml({ tags: ["presse", "wartung"] }, "de");
    expect(html).toContain("<h3>Kontext</h3>");
    expect(html).toContain("presse, wartung");
  });

  it("sanitisiert gefährliche Eingaben (kein Skript, kein Eventhandler, kein externes Bild)", () => {
    const html = draftArticleHtml(
      {
        statement: "<script>alert(1)</script>sichtbar",
        measures: ['<b onclick="evil()">Maßnahme</b>'],
        tags: ["a & b"],
      },
      "de",
    );
    // Skript/Eventhandler/externe Bilder werden entfernt; harmloser Text bleibt erhalten.
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html.toLowerCase()).not.toContain("onclick");
    expect(html.toLowerCase()).not.toContain("onerror");
    expect(html).toContain("sichtbar");
    expect(html).toContain("Maßnahme");
    // Sonderzeichen in reinem Text werden korrekt escaped (einmalig, kein Doppel-Escaping).
    expect(html).toContain("a &amp; b");
    expect(html).not.toContain("a &amp;amp; b");
  });

  it("applyDraftArticle: leer → setzen, sonst nicht-destruktiv anhängen", () => {
    const article = draftArticleHtml({ statement: "A." }, "de");
    expect(applyDraftArticle("", { statement: "A." }, "de")).toBe(article);
    expect(applyDraftArticle("<p></p>", { statement: "A." }, "de")).toBe(article);
    const appended = applyDraftArticle("<p>Bestehend</p>", { statement: "A." }, "de");
    expect(appended.startsWith("<p>Bestehend</p>")).toBe(true);
    expect(appended).toContain(article);
  });

  it("applyDraftArticle: leerer Entwurf verändert vorhandenen Body nicht", () => {
    expect(applyDraftArticle("<p>Bestehend</p>", { statement: "" }, "de")).toBe("<p>Bestehend</p>");
  });

  it("normalizeDraftArticleLocale: en-Varianten → 'en', sonst 'de'", () => {
    expect(normalizeDraftArticleLocale("en")).toBe("en");
    expect(normalizeDraftArticleLocale("en-US")).toBe("en");
    expect(normalizeDraftArticleLocale("de")).toBe("de");
    expect(normalizeDraftArticleLocale(null)).toBe("de");
  });

  it("CTA-i18n (studio.fromDraft.cta/hint) DE+EN vorhanden + ehrlich (kein Auto-Validate)", () => {
    for (const key of ["studio.fromDraft.cta", "studio.fromDraft.hint"]) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
    expect(String(i18n.getResource("de", "translation", "studio.fromDraft.hint") ?? "")).toMatch(
      /automatisch validiert/i,
    );
    expect(String(i18n.getResource("en", "translation", "studio.fromDraft.hint") ?? "")).toMatch(
      /nothing is validated automatically/i,
    );
  });
});
