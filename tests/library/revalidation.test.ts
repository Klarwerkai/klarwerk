import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  canRevalidate,
  revalidationCta,
  revalidationNextSteps,
  revalidationView,
} from "../../apps/web/src/lib/revalidation";

// SCRUM-136: Re-Validierung aus der Bibliothek nur für validierte Objekte.
describe("SCRUM-136: canRevalidate", () => {
  it("erlaubt Re-Validierung nur für validierte KOs", () => {
    expect(canRevalidate("validiert")).toBe(true);
    expect(canRevalidate("offen")).toBe(false);
  });
});

function ko(o: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: `Titel ${o.id}`,
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    ...o,
  } as KnowledgeObject;
}

describe("SCRUM-254: revalidationView", () => {
  it("löst ID auf Titel/Asset/Status auf; validiert → review", () => {
    const v = revalidationView("k1", [ko({ id: "k1", title: "Ventil X", asset: "Anlage 7" })]);
    expect(v.found).toBe(true);
    expect(v.title).toBe("Ventil X");
    expect(v.asset).toBe("Anlage 7");
    expect(v.status).toBe("validiert");
    expect(v.nextStep).toBe("review");
  });

  it("offenes (nicht freigegebenes) Objekt → validate", () => {
    const v = revalidationView("k2", [ko({ id: "k2", status: "offen" })]);
    expect(v.nextStep).toBe("validate");
  });

  it("nicht auflösbare ID → ehrlicher Fallback (found=false, openKo, ID als Titel)", () => {
    const v = revalidationView("missing", [ko({ id: "k1" })]);
    expect(v.found).toBe(false);
    expect(v.title).toBe("missing");
    expect(v.asset).toBeNull();
    expect(v.status).toBeNull();
    expect(v.nextStep).toBe("openKo");
  });
});

describe("SCRUM-268: revalidationCta", () => {
  it("review (validiert) → CTA in den Validierungsfluss", () => {
    expect(revalidationCta({ nextStep: "review" })).toEqual({
      labelKey: "lcy.revalCta.review",
      href: "/validierung",
    });
  });

  it("validate (offen) → CTA in den Validierungsfluss, nicht zur Auto-Bestätigung", () => {
    expect(revalidationCta({ nextStep: "validate" })).toEqual({
      labelKey: "lcy.revalCta.validate",
      href: "/validierung",
    });
  });

  it("openKo (nicht auflösbar) → KEINE CTA (kein Fake-Review-Link)", () => {
    expect(revalidationCta({ nextStep: "openKo" })).toBeNull();
  });
});

describe("SCRUM-278: revalidationNextSteps", () => {
  const done = { id: "ko-9", title: "Filter F3 monatlich auf Verschmutzung prüfen." };

  it("auflösbares KO (found): KO ansehen + Wissen nutzen (Ask mit KO-Titel)", () => {
    const steps = revalidationNextSteps({ ...done, found: true });
    expect(steps.map((s) => s.labelKey)).toEqual(["lcy.nextViewKo", "lcy.nextUse"]);
    expect(steps[0]?.to).toBe("/wissen/ko-9");
    expect(steps[1]?.to.startsWith("/fragen?q=")).toBe(true);
    expect(steps[1]?.to).toContain(encodeURIComponent(done.title));
  });

  it("nicht auflösbares KO (found=false): nur KO ansehen, kein Use-Schritt", () => {
    const steps = revalidationNextSteps({ ...done, found: false });
    expect(steps).toHaveLength(1);
    expect(steps[0]?.labelKey).toBe("lcy.nextViewKo");
    expect(steps[0]?.to).toBe("/wissen/ko-9");
  });
});
