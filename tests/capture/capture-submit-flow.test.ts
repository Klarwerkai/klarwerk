import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("KW-PROD-27: Capture Submit Flow", () => {
  it("aktualisiert fortgesetzte Studio-Drafts vor dem Promote", () => {
    const source = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    const updateIndex = source.indexOf("await endpoints.drafts.update(draftId, payload)");
    const promoteIndex = source.indexOf("endpoints.drafts.promote(");

    expect(updateIndex).toBeGreaterThan(0);
    expect(promoteIndex).toBeGreaterThan(updateIndex);
    expect(source).toContain("setSavedKoId(ko.id)");
    expect(source).toContain('qc.invalidateQueries({ queryKey: ["validation"] })');
  });

  it("zeigt nach erfolgreichem Einreichen echte naechste Schritte statt Berichtverlust", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );
    const successSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/captureSuccess.ts"),
      "utf8",
    );

    expect(captureSource).toContain("captureNextSteps(savedKoId)");
    expect(successSource).toContain("capture.savedValidate");
    expect(successSource).toContain("validationOriginHref");
    expect(successSource).toContain("`/wissen/${koId}`");
  });
});

describe("KW-PROD-29: Frontdoor Save/Submit State", () => {
  it("zeigt den aus der Vordertuer gespeicherten Draft auf /erfassen als klare Statuskarte", () => {
    const source = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");

    expect(source).toContain("frontDoorDraftSavedFromState");
    expect(source).toContain("frontDoorDraftSaved");
    expect(source).toContain("Entwurf gespeichert");
    expect(source).toContain("Entwurf fortsetzen");
    expect(source).toContain("Neuer leerer Eintrag");
    expect(source).toContain("useLocation");
    expect(source).toContain('navigate("/erfassen", { replace: true, state: null })');
  });

  it("sperrt wiederholte Frontdoor-Save- und Submit-Ausloesungen lokal", () => {
    const source = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );

    expect(source).toContain("saveRequestedRef");
    expect(source).toContain("submitRequestedRef");
    expect(source).toContain("if (!canSave || saveRequestedRef.current)");
    expect(source).toContain("if (!canSubmit || submitRequestedRef.current)");
    expect(source).toContain("saveRequestedRef.current = true");
    expect(source).toContain("submitRequestedRef.current = true");
    expect(source).toContain("!submittedKo");
  });
});
