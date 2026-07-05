import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { filterArticlesByTitle } from "../../apps/web/src/lib/appendToArticle";

// Nur der Titel wird für die Auswahl gelesen — schlanke Fixtures (Doppel-Cast) genügen.
const kos = [
  { id: "1", title: "Pumpe entlüften" },
  { id: "2", title: "Ventil schließen" },
  { id: "3", title: "Große Pumpe warten" },
] as unknown as KnowledgeObject[];

describe("SCRUM-435: filterArticlesByTitle", () => {
  it("leere Suche → alle Artikel", () => {
    expect(filterArticlesByTitle(kos, "")).toHaveLength(3);
    expect(filterArticlesByTitle(kos, "   ")).toHaveLength(3);
  });

  it("filtert nach Titel-Teilstring, groß-/kleinunabhängig", () => {
    expect(filterArticlesByTitle(kos, "pumpe").map((k) => k.id)).toEqual(["1", "3"]);
    expect(filterArticlesByTitle(kos, "VENTIL").map((k) => k.id)).toEqual(["2"]);
  });

  it("kein Treffer → leere Liste", () => {
    expect(filterArticlesByTitle(kos, "Kantine")).toHaveLength(0);
  });
});
