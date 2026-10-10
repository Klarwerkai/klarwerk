import { describe, expect, it } from "vitest";
import { emptyStateActions } from "../../apps/web/src/lib/emptyStateActions";

describe("SCRUM-181: emptyStateActions", () => {
  it("start (admin, stufe2) bietet Erfassen/Import/Admin", () => {
    const a = emptyStateActions("start", "admin", true).map((x) => x.labelKey);
    expect(a).toEqual(["empty.cta.capture", "empty.cta.import", "empty.cta.admin"]);
  });

  it("viewer sieht KEIN Erfassen (ko.create-Rolle nötig) und kein Admin", () => {
    const a = emptyStateActions("start", "viewer", true).map((x) => x.labelKey);
    expect(a).not.toContain("empty.cta.capture");
    expect(a).not.toContain("empty.cta.admin");
  });

  it("Import ist Stufe-2 + Admin: nur mit aktivem Stufe-2 angeboten", () => {
    const withS2 = emptyStateActions("library", "admin", true).map((x) => x.labelKey);
    const noS2 = emptyStateActions("library", "admin", false).map((x) => x.labelKey);
    expect(withS2).toContain("empty.cta.import");
    expect(noS2).not.toContain("empty.cta.import");
    expect(noS2).toContain("empty.cta.capture"); // Erfassen bleibt verfügbar
  });

  it("validation: Experte bekommt Erfassen + Aufgaben", () => {
    const a = emptyStateActions("validation", "experte", false).map((x) => x.labelKey);
    expect(a).toEqual(["empty.cta.capture", "aufgaben.zumBereich"]);
  });

  // R-0956: die leere Risikoliste nennt Erfassen (und mit Stufe 2 den Import) als nächsten Schritt.
  it("risk (admin, stufe2) bietet Erfassen/Import; ohne Stufe 2 nur Erfassen", () => {
    const withS2 = emptyStateActions("risk", "admin", true).map((x) => x.labelKey);
    const noS2 = emptyStateActions("risk", "admin", false).map((x) => x.labelKey);
    expect(withS2).toEqual(["empty.cta.capture", "empty.cta.import"]);
    expect(noS2).toEqual(["empty.cta.capture"]);
  });

  // R-0956: die leere Nachbarschaft führt ins Wissensnetz; Erfassen nur, wer erfassen darf.
  it("neighborhood: Wissensnetz für jeden Leser, Erfassen nur mit Erfassungsrecht", () => {
    const viewer = emptyStateActions("neighborhood", "viewer", false).map((x) => x.labelKey);
    const experte = emptyStateActions("neighborhood", "experte", false).map((x) => x.labelKey);
    expect(viewer).toEqual(["empty.cta.wissensnetz"]);
    expect(experte).toEqual(["empty.cta.wissensnetz", "empty.cta.capture"]);
  });

  // R-0956 (Nacharbeit 4): das leere Audit-Protokoll füllt sich durch Erfassen und Prüfen.
  it("audit (admin) bietet Erfassen und Validierung", () => {
    const a = emptyStateActions("audit", "admin", false).map((x) => x.labelKey);
    expect(a).toEqual(["empty.cta.capture", "empty.cta.validation"]);
  });

  // R-0956 (Bestandsabgleich, Nacharbeit 4): Lücken, Lebenszyklus, Dubletten.
  it("gaps/lifecycle/duplicates (controller) nennen ihre nächsten Schritte", () => {
    const keys = (k: "gaps" | "lifecycle" | "duplicates") =>
      emptyStateActions(k, "controller", false).map((x) => x.labelKey);
    expect(keys("gaps")).toEqual(["empty.cta.ask", "empty.cta.capture"]);
    expect(keys("lifecycle")).toEqual(["empty.cta.tasks", "empty.cta.library"]);
    expect(keys("duplicates")).toEqual(["empty.cta.validation", "empty.cta.library"]);
  });

  it("liefert echte Navigationspfade (kein Fremd-Link)", () => {
    for (const action of emptyStateActions("tasks", "admin", true)) {
      expect(action.to.startsWith("/")).toBe(true);
    }
  });
});
