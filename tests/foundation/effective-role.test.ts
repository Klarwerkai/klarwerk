import { describe, expect, it } from "vitest";
import { effectiveRole, effectiveStufe2 } from "../../apps/web/src/lib/effectiveRole";

// SCRUM-150: Navigation/Routing nutzen die echte Session-Rolle, nicht den Dev-Schalter.
describe("SCRUM-150: effektive Rolle", () => {
  it("Session-Rolle gewinnt gegen lokalen Preview-Wert", () => {
    expect(effectiveRole("controller", "experte")).toBe("controller");
    expect(effectiveRole("admin", "viewer")).toBe("admin");
  });

  it("ohne Session greift der Preview-/Fallback-Wert", () => {
    expect(effectiveRole(null, "experte")).toBe("experte");
    expect(effectiveRole(undefined, "viewer")).toBe("viewer");
  });

  it("Stufe-2 nur bei effektiver Admin-Rolle", () => {
    expect(effectiveStufe2("admin", true)).toBe(true);
    expect(effectiveStufe2("admin", false)).toBe(false);
    expect(effectiveStufe2("experte", true)).toBe(false);
    // Eingeloggter viewer überschreibt einen lokalen preview-„admin" → Stufe-2 bleibt aus.
    expect(effectiveStufe2(effectiveRole("viewer", "admin"), true)).toBe(false);
  });
});
