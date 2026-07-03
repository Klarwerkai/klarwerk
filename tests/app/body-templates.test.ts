import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  BODY_TEMPLATES,
  BODY_TEMPLATE_IDS,
  applyBodyTemplate,
  bodyTemplateHtml,
  normalizeBodyTemplateLocale,
} from "../../apps/web/src/lib/bodyTemplates";

describe("SCRUM-319: bodyTemplates", () => {
  it("liefert sechs stabile Templates mit i18n-Keys (SCRUM-404: + Checkliste/Übergabe/Entscheidung)", () => {
    expect(BODY_TEMPLATE_IDS).toEqual([
      "procedure",
      "troubleshooting",
      "safety",
      "checklist",
      "handover",
      "decision",
    ]);
    expect(BODY_TEMPLATES.map((t) => t.id)).toEqual(BODY_TEMPLATE_IDS);

    for (const template of BODY_TEMPLATES) {
      expect(template.labelKey).toBe(`editor.template.${template.id}.label`);
      expect(template.descriptionKey).toBe(`editor.template.${template.id}.description`);
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", template.labelKey) ?? "")).not.toBe("");
        expect(
          String(i18n.getResource(lng, "translation", template.descriptionKey) ?? ""),
        ).not.toBe("");
      }
    }
  });

  it("normalisiert die Locale defensiv", () => {
    expect(normalizeBodyTemplateLocale("en-US")).toBe("en");
    expect(normalizeBodyTemplateLocale("de-DE")).toBe("de");
    expect(normalizeBodyTemplateLocale("fr")).toBe("de");
    expect(normalizeBodyTemplateLocale(undefined)).toBe("de");
  });

  it("erzeugt sicheres, sanitizables HTML mit bestehenden Blockklassen", () => {
    expect(bodyTemplateHtml("procedure", "de")).toContain("<h2>Vorgehen</h2>");
    expect(bodyTemplateHtml("procedure", "de")).toContain('class="panel panel-info"');
    expect(bodyTemplateHtml("troubleshooting", "de")).toContain('class="panel panel-warning"');
    expect(bodyTemplateHtml("safety", "de")).toContain('class="panel panel-success"');

    for (const id of BODY_TEMPLATE_IDS) {
      const html = bodyTemplateHtml(id, "de");
      expect(html).not.toMatch(/\son[a-z]+\s*=/i);
      expect(html).not.toContain("style=");
      expect(html).not.toContain("<script");
      expect(html).not.toContain('class="not-');
    }
  });

  it("unterstützt EN-Template-Text ohne Strukturbruch", () => {
    const html = bodyTemplateHtml("procedure", "en");
    expect(html).toContain("<h2>Procedure</h2>");
    expect(html).toContain("<ol>");
    expect(html).toContain('class="panel panel-info"');
  });

  it("wendet Templates bewusst an: leerer Body setzt, vorhandener Body hängt an", () => {
    const emptyApplied = applyBodyTemplate("", "procedure", "de");
    expect(emptyApplied).toBe(bodyTemplateHtml("procedure", "de"));

    const existing = "<p>Bestehend</p>";
    const appended = applyBodyTemplate(existing, "safety", "de");
    expect(appended.startsWith(existing)).toBe(true);
    expect(appended).toContain("<h2>Sicherheitsrelevantes Wissen</h2>");
  });

  // SCRUM-342: jede Vorlage liefert eine nicht-leere, sanitisierte Vorschau (für die Preview-Anzeige).
  it("jede Vorlage hat eine nicht-leere, sanitisierte Vorschau in DE und EN", () => {
    for (const id of BODY_TEMPLATE_IDS) {
      for (const locale of ["de", "en"] as const) {
        const html = bodyTemplateHtml(id, locale);
        expect(html.length).toBeGreaterThan(0);
        expect(html).not.toMatch(/\son[a-z]+\s*=/i);
        expect(html.toLowerCase()).not.toContain("<script");
      }
    }
  });

  // SCRUM-342: Preview-&-Apply-i18n (Auswahl/Vorschau/Übernehmen/Hinweis) DE+EN vorhanden + ehrlich.
  it("Preview-&-Apply-i18n (selected/preview/apply/hint) DE+EN vorhanden", () => {
    // SCRUM-404: der Übernehmen-Knopf sagt konkret, was passiert (einsetzen vs. unten anfügen)
    // und hat eine ?-Hilfe (applyHelp).
    const keys = [
      "editor.template.selected",
      "editor.template.preview",
      "editor.template.applySet",
      "editor.template.applyAppend",
      "editor.template.applyHelp",
      "editor.template.hint",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
    expect(String(i18n.getResource("de", "translation", "editor.template.hint") ?? "")).toMatch(
      /nicht ersetzt|automatisch/i,
    );
    expect(String(i18n.getResource("en", "translation", "editor.template.hint") ?? "")).toMatch(
      /not replaced|automatically/i,
    );
  });
});
