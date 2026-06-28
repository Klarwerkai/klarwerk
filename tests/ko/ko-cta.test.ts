import { describe, expect, it } from "vitest";
import { koCta } from "../../apps/web/src/lib/koCta";
import type { KoNextAction } from "../../apps/web/src/lib/koOverview";

// SCRUM-259: Die nächste Handlung wird zu einer ehrlichen CTA auf vorhandene Routen/Bereiche.
describe("SCRUM-259: koCta", () => {
  it("offene/zu prüfende KOs führen zur Validierung", () => {
    expect(koCta("validate")).toMatchObject({
      href: "/validierung",
      kind: "route",
      tone: "primary",
    });
    expect(koCta("review")).toMatchObject({ href: "/validierung", kind: "route", tone: "primary" });
  });

  it("validierte KOs führen zum Nutzungsfluss (Fragen) — ohne KO-Kontext neutral /fragen", () => {
    expect(koCta("use")).toMatchObject({ href: "/fragen", kind: "route", tone: "primary" });
  });

  // SCRUM-273: mit KO-Kontext befüllt „use" die Ask-Startfrage (kein Auto-Submit).
  it("use + KO-Kontext → /fragen?q=… mit URL-encodierter KO-spezifischer Startfrage", () => {
    const title = "Ventil X bei Überdruck manuell schließen.";
    const cta = koCta("use", { title });
    expect(cta.kind).toBe("route");
    expect(cta.tone).toBe("primary");
    expect(cta.href.startsWith("/fragen?q=")).toBe(true);
    expect(cta.href).toContain(encodeURIComponent(title));
  });

  it("review/validate bleiben /validierung; addSource bleibt #ko-sources — auch mit KO-Kontext", () => {
    const ko = { title: "Ventil X bei Überdruck manuell schließen." };
    expect(koCta("review", ko).href).toBe("/validierung");
    expect(koCta("validate", ko).href).toBe("/validierung");
    expect(koCta("addSource", ko).href).toBe("#ko-sources");
  });

  it("Quelle ergänzen bleibt lokale Orientierung (Anker), kein neuer Workflow", () => {
    const cta = koCta("addSource");
    expect(cta.kind).toBe("anchor");
    expect(cta.href).toBe("#ko-sources");
    expect(cta.tone).toBe("neutral");
  });

  it("jede nächste Handlung hat eine CTA mit nicht-leerem Label und Ziel", () => {
    const actions: KoNextAction[] = ["use", "review", "addSource", "validate"];
    for (const a of actions) {
      const cta = koCta(a);
      expect(cta.labelKey.length).toBeGreaterThan(0);
      expect(cta.href.length).toBeGreaterThan(0);
    }
  });
});
