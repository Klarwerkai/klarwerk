import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { DraftPayload } from "../../apps/web/src/api/types";
import { originForSave, resumeTargetForDraft } from "../../apps/web/src/lib/captureResume";

// SCRUM-457 (Pedi/VIP 06.07.): „Fortsetzen" öffnet den Entwurf dort, wo er gespeichert wurde —
// über einen gespeicherten Herkunfts-Marker statt einer Inhalts-Heuristik. Alt-Entwürfe ohne
// Marker fallen ehrlich auf die frühere Heuristik zurück.
describe("SCRUM-457: originForSave — Herkunft beim Speichern", () => {
  it("Experten-Formular gewinnt immer", () => {
    expect(originForSave({ expert: true, wizStep: "tell" })).toBe("expert");
    expect(originForSave({ expert: true, wizStep: "refine" })).toBe("expert");
  });

  it("ohne Experten-Modus entscheidet der Wizard-Schritt", () => {
    expect(originForSave({ expert: false, wizStep: "refine" })).toBe("studio");
    expect(originForSave({ expert: false, wizStep: "tell" })).toBe("tell");
  });
});

describe("SCRUM-457: resumeTargetForDraft — gespeicherter Marker gilt exakt", () => {
  it("honoriert einen gültigen Marker — auch gegen den Inhalt", () => {
    // dünner Studio-Entwurf (kein bodyHtml) würde die alte Heuristik nach „tell" schicken —
    // der Marker hält ihn korrekt im Studio.
    expect(resumeTargetForDraft({ statement: "kurz", origin: "studio" })).toBe("studio");
    // strukturierter Entwurf, aber als Erzähl-Einstieg gespeichert → bleibt „tell".
    expect(resumeTargetForDraft({ bodyHtml: "<p>viel Inhalt</p>", origin: "tell" })).toBe("tell");
    expect(resumeTargetForDraft({ statement: "x", origin: "expert" })).toBe("expert");
    expect(resumeTargetForDraft({ bodyHtml: "<p>Frontdoor</p>", origin: "frontdoor" })).toBe(
      "frontdoor",
    );
  });

  it("Alt-Entwürfe ohne Marker: Rückfall-Heuristik (strukturiert → studio, sonst tell)", () => {
    expect(resumeTargetForDraft({ statement: "nur ein Satz" })).toBe("tell");
    expect(resumeTargetForDraft({ bodyHtml: "<p>Text</p>" })).toBe("studio");
    expect(resumeTargetForDraft({ conditions: ["Bedingung"] })).toBe("studio");
    expect(resumeTargetForDraft({ measures: ["Maßnahme"] })).toBe("studio");
    expect(resumeTargetForDraft({})).toBe("tell");
  });

  it("ignoriert einen ungültigen Marker und fällt auf die Heuristik zurück", () => {
    const bad = { statement: "x", origin: "quatsch" } as unknown as DraftPayload;
    expect(resumeTargetForDraft(bad)).toBe("tell");
  });

  it("Fortsetzen scrollt nach dem Laden sichtbar in den Arbeitsbereich", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );

    expect(captureSource).toContain("workAreaRef");
    expect(captureSource).toContain("scrollIntoView");
    expect(captureSource).toContain("ref={workAreaRef}");
  });

  it("Vordertuer-Entwuerfe werden aus der alten Liste zur Vordertuer geroutet", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );

    expect(captureSource).toContain('target === "frontdoor"');
    expect(captureSource).toContain("CAPTURE_FRONT_DOOR_ROUTE");
    expect(captureSource).toContain("navigate(");
  });

  it("Vordertuer-Resume bleibt auf bodyHtml und kann Bild-Skalierung erhalten", () => {
    const payload = {
      bodyHtml: '<p><img src="/api/objects/img-1/raw" data-kw-scale="25"></p>',
      origin: "frontdoor",
    } satisfies DraftPayload;

    expect(resumeTargetForDraft(payload)).toBe("frontdoor");
    expect(payload.bodyHtml).toContain('data-kw-scale="25"');
  });
});
