import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { libraryMaturity } from "../../apps/web/src/lib/libraryMaturity";
import { type UseReadiness, useReadiness } from "../../apps/web/src/lib/useReadiness";

// SCRUM-293: EINE konsistente Use-Readiness-Sprache für KO-Detail + Library (+ Ask-Bezug).
describe("SCRUM-293: useReadiness", () => {
  it("bildet jede Usability auf ein kanonisches Label/Hint/Tone ab", () => {
    expect(useReadiness("ready")).toMatchObject({
      labelKey: "use.ready.label",
      hintKey: "use.ready.hint",
      tone: "pos",
    });
    expect(useReadiness("in-review")).toMatchObject({
      labelKey: "use.review.label",
      hintKey: "use.review.hint",
      tone: "warn",
    });
    expect(useReadiness("needs-work")).toMatchObject({
      labelKey: "use.open.label",
      hintKey: "use.open.hint",
      tone: "neutral",
    });
  });

  const ko = (over: Partial<KnowledgeObject>): KnowledgeObject =>
    ({
      id: "ko-1",
      title: "Ventil X bei Überdruck manuell schließen.",
      statement: "…",
      type: "best_practice",
      category: "Anlage",
      tags: [],
      status: "offen",
      trust: 0,
      version: 1,
      author: "u-1",
      originalAuthor: "u-1",
      assignments: [],
      sources: [],
      attachments: [],
      ...over,
    }) as KnowledgeObject;

  it("Konsistenz: Library-Plakette nutzt exakt dasselbe Label wie KO-Detail (useReadiness)", () => {
    for (const k of [
      ko({ status: "validiert", trust: 100 }),
      ko({ status: "offen", assignments: ["u-2"] }),
      ko({ status: "offen", assignments: [] }),
    ]) {
      const usability = koOverview(k).usability;
      expect(libraryMaturity(k).labelKey).toBe(useReadiness(usability).labelKey);
    }
  });

  const text = (lng: string, key: string) =>
    String(i18n.getResource(lng, "translation", key) ?? "").toLowerCase();

  it("i18n DE/EN: alle Labels/Hints vorhanden und nicht leer", () => {
    const all: UseReadiness[] = (["ready", "in-review", "needs-work"] as const).map(useReadiness);
    for (const lng of ["de", "en"]) {
      for (const r of all) {
        expect(text(lng, r.labelKey).length).toBeGreaterThan(0);
        expect(text(lng, r.hintKey).length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: ready = validiert/nutzbar, offen = prüfen, in-review nicht-als-gesichert", () => {
    expect(text("de", "use.ready.hint")).toContain("validiert");
    expect(text("de", "use.open.hint")).toContain("prüf");
    expect(text("de", "use.review.hint")).toContain("noch nicht als gesichert");
    expect(text("en", "use.ready.hint")).toContain("validated");
    expect(text("en", "use.open.hint")).toContain("review");
  });
});
