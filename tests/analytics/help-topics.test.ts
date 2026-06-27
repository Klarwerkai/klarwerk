import { describe, expect, it } from "vitest";
import {
  HELP_TOPICS,
  type HelpSearchItem,
  filterHelpTopics,
} from "../../apps/web/src/lib/helpTopics";

const items: HelpSearchItem[] = [
  {
    id: "capture",
    title: "Wissen erfassen",
    body: "Erstelle ein Wissensobjekt",
    tags: ["entwurf"],
  },
  { id: "ask", title: "Fragen", body: "Stelle eine Frage", tags: ["gap", "antwort"] },
  { id: "mobile", title: "Mobil", body: "Offline arbeiten", tags: ["pwa"] },
];

describe("SCRUM-219: helpTopics", () => {
  it("leere Query → alle Kapitel", () => {
    expect(filterHelpTopics(items, "").map((i) => i.id)).toEqual(["capture", "ask", "mobile"]);
    expect(filterHelpTopics(items, "   ").length).toBe(3);
  });

  it("matcht im Titel (case-insensitive)", () => {
    expect(filterHelpTopics(items, "FRAGEN").map((i) => i.id)).toEqual(["ask"]);
  });

  it("matcht im Text", () => {
    expect(filterHelpTopics(items, "offline").map((i) => i.id)).toEqual(["mobile"]);
  });

  it("matcht in Tags", () => {
    expect(filterHelpTopics(items, "pwa").map((i) => i.id)).toEqual(["mobile"]);
    expect(filterHelpTopics(items, "gap").map((i) => i.id)).toEqual(["ask"]);
  });

  it("kein Treffer → leeres Ergebnis (ehrlicher Leerzustand)", () => {
    expect(filterHelpTopics(items, "zzz-nichts")).toEqual([]);
  });

  it("HELP_TOPICS: 10 Kapitel, eindeutige IDs, nur interne Routen", () => {
    expect(HELP_TOPICS).toHaveLength(10);
    expect(new Set(HELP_TOPICS.map((t) => t.id)).size).toBe(10);
    for (const topic of HELP_TOPICS) {
      expect(topic.to.startsWith("/")).toBe(true);
      expect(topic.tags.length).toBeGreaterThan(0);
    }
  });
});
