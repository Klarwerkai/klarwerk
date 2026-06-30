import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { editorContentQuality } from "../../apps/web/src/lib/editorContentQuality";
import {
  STUDIO_GUIDE_STEPS,
  type StudioGuideStepId,
  studioContribution,
  studioGuideActiveStep,
  studioGuideStepLabelKey,
  studioGuideSteps,
} from "../../apps/web/src/lib/knowledgeStudioGuide";

// SCRUM-353: geführter Studio-Arbeitsraum + leichtgewichtiger Beitragswert/Qualität (DOM-frei).
describe("SCRUM-353: knowledgeStudioGuide — geführte Schritte", () => {
  it("liefert die Schrittfolge in fester Reihenfolge (strukturieren → KI → vorschau → übernehmen)", () => {
    expect(studioGuideSteps()).toBe(STUDIO_GUIDE_STEPS);
    expect(STUDIO_GUIDE_STEPS.map((s) => s.id)).toEqual<StudioGuideStepId[]>([
      "structure",
      "assist",
      "preview",
      "apply",
    ]);
  });

  it("label/hint folgen dem stabilen Schema studio.guide.<id>.{label,hint}", () => {
    for (const step of STUDIO_GUIDE_STEPS) {
      expect(step.labelKey).toBe(`studio.guide.${step.id}.label`);
      expect(step.hintKey).toBe(`studio.guide.${step.id}.hint`);
      expect(studioGuideStepLabelKey(step.id)).toBe(step.labelKey);
    }
  });

  it("markiert genau einen aktiven Orientierungsschritt je Studio-Ansicht", () => {
    expect(studioGuideActiveStep("edit")).toBe("structure");
    expect(studioGuideActiveStep("preview")).toBe("preview");
  });

  it("i18n: Schritt-Labels/Hints + thenSave sind DE und EN vorhanden", () => {
    const keys = [
      "studio.guide.thenSave",
      ...STUDIO_GUIDE_STEPS.flatMap((s) => [s.labelKey, s.hintKey]),
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });
});

describe("SCRUM-353: studioContribution — Beitragswert/Qualität ohne Score", () => {
  it("leerer Entwurf → level empty, neutral, keine Stärken/Hinweise", () => {
    const c = studioContribution(editorContentQuality({ bodyHtml: "" }));
    expect(c.level).toBe("empty");
    expect(c.tone).toBe("neutral");
    expect(c.strengths).toHaveLength(0);
    expect(c.suggestions).toHaveLength(0);
    expect(c.levelLabelKey).toBe("studio.contrib.level.empty.label");
  });

  it("dünner Fließtext ohne Struktur → level draft + Hinweise (Detail/Überschriften/Schritte)", () => {
    const c = studioContribution(editorContentQuality({ bodyHtml: "<p>kurz</p>" }));
    expect(c.level).toBe("draft");
    expect(c.tone).toBe("warn");
    const sug = c.suggestions.map((s) => s.id);
    expect(sug).toContain("detail");
    expect(sug).toContain("headings");
    expect(sug).toContain("steps");
  });

  it("strukturierter Body (Überschrift + Liste + Block + Text) → level solid + Stärken", () => {
    const body =
      "<h2>Vorgehen</h2><p>Hier steht ausreichend ausführlicher Erfahrungstext, der die Lage gut und nachvollziehbar beschreibt.</p>" +
      "<ul><li>Schritt eins</li><li>Schritt zwei</li></ul>" +
      '<div class="panel panel-info"><p>Wichtiger Hinweis</p></div>';
    const c = studioContribution(editorContentQuality({ bodyHtml: body }));
    expect(c.level).toBe("solid");
    expect(c.tone).toBe("pos");
    const str = c.strengths.map((s) => s.id);
    expect(str).toEqual(expect.arrayContaining(["text", "headings", "steps", "highlights"]));
  });

  it("Items tragen stabile i18n-Keys (Schema strength/suggestion) + Texte DE/EN vorhanden", () => {
    const body = "<p>kurz</p>";
    const c = studioContribution(editorContentQuality({ bodyHtml: body }));
    for (const item of [...c.strengths, ...c.suggestions]) {
      expect(item.labelKey).toMatch(/^studio\.contrib\.(strength|suggestion)\./);
    }
    const keys = [
      "studio.contrib.title",
      "studio.contrib.strengthsTitle",
      "studio.contrib.suggestionsTitle",
      "studio.contrib.valueNote",
      "studio.contrib.level.empty.label",
      "studio.contrib.level.draft.label",
      "studio.contrib.level.solid.label",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: Wertbeitrag-Note verspricht keine sofortige Gültigkeit (erst nach Prüfung) (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", "studio.contrib.valueNote") ?? "")).toMatch(
      /nach der Prüfung|gesichert/i,
    );
    expect(String(i18n.getResource("en", "translation", "studio.contrib.valueNote") ?? "")).toMatch(
      /after colleagues review|secured/i,
    );
  });
});
