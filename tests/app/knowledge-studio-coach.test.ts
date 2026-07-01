import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { editorContentQuality } from "../../apps/web/src/lib/editorContentQuality";
import { STUDIO_COACH_KEYS, studioNextStep } from "../../apps/web/src/lib/knowledgeStudioCoach";
import { STUDIO_GUIDE_STEPS } from "../../apps/web/src/lib/knowledgeStudioGuide";

// SCRUM-376 / AG-12 / AG-13 / KG-UX: First-Run-/Coaching-Signal für das Knowledge Studio (DOM-frei).
// Der Helfer empfiehlt aus vorhandenen Signalen (Inhaltszustand + Ansicht) genau EINEN nächsten Schritt
// aus der bestehenden Schrittfolge und markiert den leeren Ersteinstieg. Kein Score, keine Validierung.

const SOLID_BODY =
  "<h2>Vorgehen</h2><p>Hier steht ausreichend ausführlicher Erfahrungstext, der die Lage gut und nachvollziehbar beschreibt.</p>" +
  "<ul><li>Schritt eins</li><li>Schritt zwei</li></ul>";

const STEP_IDS = STUDIO_GUIDE_STEPS.map((s) => s.id);

describe("SCRUM-376: studioNextStep — content-/ansichtsbewusster nächster Schritt", () => {
  it("leerer Entwurf im Bearbeiten-View → First-Run 'Strukturieren' (Start hier)", () => {
    const step = studioNextStep(editorContentQuality({ bodyHtml: "" }), "edit");
    expect(step.stepId).toBe("structure");
    expect(step.isFirstRun).toBe(true);
    expect(step.reasonKey).toBe("studio.coach.reason.start");
    expect(step.stepLabelKey).toBe("studio.guide.structure.label");
  });

  it("dünner/roher Entwurf ohne Struktur → 'KI prüfen' (kein First-Run)", () => {
    const step = studioNextStep(editorContentQuality({ bodyHtml: "<p>kurz</p>" }), "edit");
    expect(step.stepId).toBe("assist");
    expect(step.isFirstRun).toBe(false);
    expect(step.reasonKey).toBe("studio.coach.reason.improve");
  });

  it("solider, strukturierter Entwurf im Bearbeiten-View → 'Vorschau'", () => {
    const step = studioNextStep(editorContentQuality({ bodyHtml: SOLID_BODY }), "edit");
    expect(step.stepId).toBe("preview");
    expect(step.isFirstRun).toBe(false);
    expect(step.reasonKey).toBe("studio.coach.reason.preview");
  });

  it("Vorschau-View → 'Übernehmen' unabhängig vom Inhalt (auch leer)", () => {
    expect(studioNextStep(editorContentQuality({ bodyHtml: "" }), "preview").stepId).toBe("apply");
    expect(studioNextStep(editorContentQuality({ bodyHtml: SOLID_BODY }), "preview").stepId).toBe(
      "apply",
    );
    const step = studioNextStep(editorContentQuality({ bodyHtml: SOLID_BODY }), "preview");
    expect(step.reasonKey).toBe("studio.coach.reason.apply");
    expect(step.isFirstRun).toBe(false);
  });

  it("empfohlener Schritt ist immer ein gültiger Schritt der bestehenden Schrittfolge", () => {
    const bodies = ["", "<p>kurz</p>", SOLID_BODY];
    for (const bodyHtml of bodies) {
      for (const view of ["edit", "preview"] as const) {
        expect(STEP_IDS).toContain(studioNextStep(editorContentQuality({ bodyHtml }), view).stepId);
      }
    }
  });
});

describe("SCRUM-376: Coach-/Story-Copy ist ehrlich und in DE/EN vorhanden", () => {
  it("alle Coach-Keys (Story, First-Run, Präfix, Gründe) in DE und EN vorhanden", () => {
    const keys = [
      ...Object.values(STUDIO_COACH_KEYS),
      "studio.coach.reason.start",
      "studio.coach.reason.improve",
      "studio.coach.reason.preview",
      "studio.coach.reason.apply",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: Story verspricht keine Auto-Freigabe — Prüfung sichert (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", STUDIO_COACH_KEYS.story) ?? "")).toMatch(
      /Prüfung|gesichert/i,
    );
    expect(String(i18n.getResource("en", "translation", STUDIO_COACH_KEYS.story) ?? "")).toMatch(
      /review|secured/i,
    );
  });
});
