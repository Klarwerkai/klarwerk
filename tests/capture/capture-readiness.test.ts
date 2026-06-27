import { describe, expect, it } from "vitest";
import { type CaptureDraftInput, captureReadiness } from "../../apps/web/src/lib/captureReadiness";

const input = (o: Partial<CaptureDraftInput> = {}): CaptureDraftInput => ({
  title: "Ventil schließen",
  statement: "Bei Überdruck Ventil X schließen.",
  bodyHtml: "",
  category: "Anlage 1",
  type: "best_practice",
  attachmentCount: 0,
  ...o,
});

describe("SCRUM-248: captureReadiness", () => {
  it("vollständiger Entwurf → speicherbereit, keine Pflichtlücke", () => {
    const r = captureReadiness(input());
    expect(r.canSave).toBe(true);
    expect(r.missingRequired).toEqual([]);
  });

  it("fehlender Titel → nicht speicherbereit, Titel als Pflichtlücke", () => {
    const r = captureReadiness(input({ title: "   " }));
    expect(r.canSave).toBe(false);
    expect(r.missingRequired).toContain("title");
  });

  it("fehlende Aussage UND leerer Body → Inhalt fehlt (Pflicht)", () => {
    const r = captureReadiness(input({ statement: "  ", bodyHtml: "<p>   </p>" }));
    expect(r.canSave).toBe(false);
    expect(r.missingRequired).toContain("content");
  });

  it("leere Aussage, aber WYSIWYG-Body hat Inhalt → Inhalt zählt als vorhanden", () => {
    const r = captureReadiness(input({ statement: "", bodyHtml: "<p>Echte Aussage im Body.</p>" }));
    expect(r.checks.find((c) => c.key === "content")?.ok).toBe(true);
    expect(r.canSave).toBe(true);
  });

  it("Kategorie/Anhänge sind optional — fehlen blockiert nicht", () => {
    const r = captureReadiness(input({ category: "", attachmentCount: 0 }));
    expect(r.canSave).toBe(true);
    expect(r.checks.find((c) => c.key === "category")?.required).toBe(false);
    expect(r.checks.find((c) => c.key === "attachments")?.required).toBe(false);
    expect(r.checks.find((c) => c.key === "category")?.ok).toBe(false);
  });

  it("Anhänge-Check spiegelt die mitgenommene Anzahl", () => {
    expect(
      captureReadiness(input({ attachmentCount: 2 })).checks.find((c) => c.key === "attachments")
        ?.ok,
    ).toBe(true);
    expect(
      captureReadiness(input({ attachmentCount: 0 })).checks.find((c) => c.key === "attachments")
        ?.ok,
    ).toBe(false);
  });

  it("leerer Entwurf → beide Pflichtfelder fehlen", () => {
    const r = captureReadiness(input({ title: "", statement: "", bodyHtml: "" }));
    expect(r.canSave).toBe(false);
    expect(r.missingRequired).toEqual(["title", "content"]);
  });

  it("liefert genau die fünf Checks in stabiler Reihenfolge", () => {
    expect(captureReadiness(input()).checks.map((c) => c.key)).toEqual([
      "title",
      "content",
      "category",
      "type",
      "attachments",
    ]);
  });
});
