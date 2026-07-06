import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  applyBodyAssistSection,
  bodyAssistStructuredActions,
} from "../../apps/web/src/lib/bodyAiAssist";
import { applyBodyTemplate } from "../../apps/web/src/lib/bodyTemplates";
import {
  knowledgeStudioState,
  studioSaveConfidence,
} from "../../apps/web/src/lib/editorApplySafety";
import { studioPreviewState } from "../../apps/web/src/lib/knowledgeStudioPreview";

// SCRUM-347: Bedienbarkeits-Smoke als DOM-freier Flow-Test. Es existiert kein Browser-/jsdom-Harness
// (vitest läuft im Node-Env; kein @testing-library/Playwright) und das Ticket verbietet, einen neuen
// einzuführen. Daher wird die ECHTE Helfer-Kette, die KnowledgeInputStudio + Capture/KO-Detail im
// Studio-Flow aufrufen, in der gleichen Reihenfolge durchgespielt und der nutzersichtbare Zustand
// (Dirty-Badge, Vorschau-Zustand, Save-Confidence) abgesichert — als dauerhafte Regression.

describe("SCRUM-347: Knowledge-Studio Flow-Smoke (Capture-Einstieg)", () => {
  it("open(leer) → Vorlage → KI-Abschnitt → Vorschau hat Blöcke → dirty → Apply → Save-Confidence=capture", () => {
    // 1) Studio öffnet aus Capture mit leerem Body. Interner Entwurf = bodyHtml (leer).
    const applied = ""; // bereits in den Seiten-State übernommener Body
    let draft = applied;

    // Beim Öffnen ist nichts unübernommen.
    expect(knowledgeStudioState(draft, applied).dirty).toBe(false);

    // Vorschau eines leeren Entwurfs → ehrlicher Leer-Hinweis, keine Blöcke.
    const emptyPreview = studioPreviewState(draft);
    expect(emptyPreview.hasBody).toBe(false);
    expect(emptyPreview.emptyHintKey).toBe("studio.preview.empty");

    // 2) Nutzer wendet eine Vorlage an (BodyTemplateChooser → onApply=setDraft).
    draft = applyBodyTemplate(draft, "procedure", "de");
    expect(draft.length).toBeGreaterThan(0);
    // Jetzt gibt es unübernommene Änderungen → Dirty-Badge sichtbar.
    expect(knowledgeStudioState(draft, applied).dirty).toBe(true);

    // 3) Nutzer übernimmt einen KI-Vorschlag als strukturierten Abschnitt (AiAssistBox extra action).
    const actions = bodyAssistStructuredActions(draft);
    const sectionAction = actions.find((a) => a.labelKey === "capture.ai.applyAs.section");
    expect(sectionAction).toBeDefined();
    // Der erste strukturierte Modus ist „als Abschnitt".
    expect(actions[0]?.labelKey).toBe("capture.ai.applyAs.section");
    draft = applyBodyAssistSection(draft, "Sicherheitshinweis\nVor Wartung Druck ablassen.");
    expect(draft).toContain("<h3>Sicherheitshinweis</h3>");

    // 4) Vorschau prüfen: Body vorhanden, kein Leer-Hinweis.
    const preview = studioPreviewState(draft);
    expect(preview.hasBody).toBe(true);
    expect(preview.emptyHintKey).toBeNull();

    // 5) Apply schreibt den Entwurf in den Seiten-State (onApply(draft)); danach studioApplied=true.
    const newApplied = draft;
    expect(knowledgeStudioState(newApplied, newApplied).dirty).toBe(false);

    // 6) Save-Confidence im Capture-Kontext (vor dem Einreichen): ehrlich, nicht validiert.
    const conf = studioSaveConfidence("capture");
    expect(conf).toMatchObject({
      titleKey: "studio.save.capture.title",
      nextStepKey: "studio.save.capture.next",
      tone: "warn",
    });
  });
});

describe("SCRUM-347: Knowledge-Studio Flow-Smoke (KO-Detail-Einstieg)", () => {
  it("open(vorhandener Body) → Vorschau hat Body → Bearbeiten → dirty → Apply → Save-Confidence=revision", () => {
    // 1) Studio öffnet aus KO-Detail-Edit mit vorhandenem Body (Panel-Block).
    const applied = '<div class="panel panel-info"><p>Bestehender Hinweis</p></div>';
    let draft = applied;
    expect(knowledgeStudioState(draft, applied).dirty).toBe(false);

    // Vorschau eines vorhandenen Bodys → Body + Blöcke erkannt, kein Leer-Hinweis.
    const preview = studioPreviewState(draft);
    expect(preview.hasBody).toBe(true);
    expect(preview.hasBlocks).toBe(true);
    expect(preview.emptyHintKey).toBeNull();

    // 2) Nutzer ergänzt einen KI-Abschnitt → unübernommene Änderung.
    draft = applyBodyAssistSection(draft, "Ergänzung\nNeue Erkenntnis aus der Revision.");
    expect(knowledgeStudioState(draft, applied).dirty).toBe(true);
    expect(draft).toContain("Bestehender Hinweis"); // nicht-destruktiv angehängt

    // 3) Apply übernimmt in den KO-Detail-Edit-State.
    const newApplied = draft;
    expect(knowledgeStudioState(newApplied, newApplied).dirty).toBe(false);

    // 4) Save-Confidence im Revisions-Kontext: neue Version + erneute Prüfung, keine Auto-Freigabe.
    const conf = studioSaveConfidence("revision");
    expect(conf).toMatchObject({
      titleKey: "studio.save.revision.title",
      nextStepKey: "studio.save.revision.next",
      tone: "warn",
    });
  });
});

// SCRUM-458 Stufe 1 (Berater-Konzept, Sackgasse schließen): Aus dem Studio führt immer ein
// offensichtlicher, verlässlicher Ausgang. „Einfach ↔ Strukturiert"-Schalter + Esc; die
// Verwerfen-Rückfrage erscheint direkt am Klick. Getestet: die Ausgangs-Entscheidung (dirty →
// Rückfrage, sauber → direkt) und die neuen Anzeige-Texte (DE/EN).
describe("SCRUM-458 Stufe 1: Studio-Ausgang ist nie eine Sackgasse", () => {
  it("Esc/Einfach-Schalter: sauberer Stand schließt direkt, ungespeichert fragt erst (kein stiller Verlust)", () => {
    expect(knowledgeStudioState("<p>x</p>", "<p>x</p>").dirty).toBe(false);
    expect(knowledgeStudioState("<p>neu</p>", "<p>alt</p>").dirty).toBe(true);
  });

  it("Ansicht-Schalter + Verwerfen-Rückfrage lösen in DE und EN auf (keine rohen Keys im Header)", () => {
    const keys = [
      "studio.viewSimple",
      "studio.viewStructured",
      "studio.viewSwitch",
      "studio.confirmDiscard.q",
      "studio.confirmDiscard.keep",
      "studio.confirmDiscard.discard",
    ];
    for (const lng of ["de", "en"]) {
      for (const key of keys) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
