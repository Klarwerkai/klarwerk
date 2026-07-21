// WP-SHIP8-FIX (bens F4, ROT): VERSIONSBEWUSSTE Quell-Id-Dedupe. Bei einer Kollision derselben
// Kandidaten-Id gewinnt als INHALT immer der Eintrag mit der höchsten gültigen sourceVersion
// (reihenfolgeunabhängig — vorher konnte eine restriktive ALTE Fassung die neue verdrängen);
// die VERTRAULICHKEIT wird davon GETRENNT als restriktivste über ALLE Kollisionen gemergt
// (fail-safe bleibt fail-safe). Gleiche Version → erster Eintrag (deterministisch).
import { describe, expect, it } from "vitest";
import { dedupeSelectedItems } from "../../services/library-analytics";
import type { ImportItem } from "../../services/library-analytics";

function item(over: Partial<ImportItem> = {}): ImportItem {
  return {
    title: "Pumpe warten",
    statement: "Inhalt.",
    type: "best_practice",
    category: "Wartung",
    externalId: "p1",
    ...over,
  };
}

describe("WP-SHIP8-FIX F4: dedupeSelectedItems ist versionsbewusst", () => {
  it("v1/v2 in BEIDEN Reihenfolgen → immer der v2-INHALT (sourceVersion 2 bleibt erhalten)", () => {
    const v1 = item({ sourceVersion: 1, title: "Alte Fassung", confidentiality: "intern" });
    const v2 = item({ sourceVersion: 2, title: "Neue Fassung", confidentiality: "intern" });
    for (const order of [
      [v1, v2],
      [v2, v1],
    ]) {
      const [winner] = dedupeSelectedItems(order);
      expect(winner?.title).toBe("Neue Fassung");
      // sourceNewer speist sich stromabwärts aus GENAU dieser Version — sie bleibt erhalten.
      expect(winner?.sourceVersion).toBe(2);
    }
  });

  it("alte Fassung UNKLAR + neue intern → v2-INHALT, aber Vertraulichkeit als Union angehoben", () => {
    const oldUnclear = item({ sourceVersion: 1, title: "Alte Fassung" }); // kein Signal → fail-safe
    const newIntern = item({ sourceVersion: 2, title: "Neue Fassung", confidentiality: "intern" });
    for (const order of [
      [oldUnclear, newIntern],
      [newIntern, oldUnclear],
    ]) {
      const [winner] = dedupeSelectedItems(order);
      expect(winner?.title).toBe("Neue Fassung");
      expect(winner?.sourceVersion).toBe(2);
      // Union-Entscheid: die unklare Kollision zieht den Gewinner explizit auf „vertraulich" hoch.
      expect(winner?.confidentiality).toBe("vertraulich");
    }
  });

  it("streng_vertrauliche Kollision hebt auch einen intern-Gewinner auf streng_vertraulich", () => {
    const [winner] = dedupeSelectedItems([
      item({ sourceVersion: 3, confidentiality: "intern", title: "Gewinner" }),
      item({ sourceVersion: 1, confidentiality: "streng_vertraulich", title: "Alt" }),
    ]);
    expect(winner?.title).toBe("Gewinner");
    expect(winner?.confidentiality).toBe("streng_vertraulich");
  });

  it("gleiche Version → der ERSTE Eintrag gewinnt (deterministisch); fehlende Version zählt wie 1", () => {
    const [same] = dedupeSelectedItems([
      item({ sourceVersion: 2, title: "Erster" }),
      item({ sourceVersion: 2, title: "Zweiter" }),
    ]);
    expect(same?.title).toBe("Erster");
    const [noVersion] = dedupeSelectedItems([
      item({ title: "Ohne Version" }),
      item({ sourceVersion: 1, title: "Explizit v1" }),
    ]);
    expect(noVersion?.title).toBe("Ohne Version"); // beide zählen als 1 → erster Eintrag
    const [upgraded] = dedupeSelectedItems([
      item({ title: "Ohne Version" }),
      item({ sourceVersion: 2, title: "Explizit v2" }),
    ]);
    expect(upgraded?.title).toBe("Explizit v2"); // 2 > implizite 1
  });

  it("ankerlose Items (row-N) bleiben eigenständig; Reihenfolge der Ids bleibt stabil", () => {
    const result = dedupeSelectedItems([
      item({ externalId: "a", sourceVersion: 1, title: "A alt" }),
      item({ externalId: "b", sourceVersion: 1, title: "B" }),
      item({ externalId: "a", sourceVersion: 2, title: "A neu" }),
    ]);
    expect(result.map((r) => r.title)).toEqual(["A neu", "B"]);
  });
});
