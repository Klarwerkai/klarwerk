// R-1662 · GEFÜHRTER WEG VOM PROBLEM ZUR LÖSUNG — die Ableitung ohne DOM.
//
// Geprüft wird, was das Addendum verlangt und was die Antwort tatsächlich trägt: Negativwissen
// wird „Was vermeiden", die erste tragende Lösungsquelle wird „Quelle öffnen", Autor und
// Originalautor der tragenden Quellen werden Ansprechpersonen, und die Rahmung sagt „validiert"
// nur bei belegter Einstufung. Im Lückenfall gibt es keinen Lösungsweg.
import { describe, expect, it } from "vitest";
import { problemloesungsweg } from "../../apps/web/src/lib/problemloesungsweg";

const kos = new Map([
  ["k1", { type: "best_practice" as const, author: "u1", originalAuthor: "u1" }],
  ["k2", { type: "negativwissen" as const, author: "u2", originalAuthor: "u3" }],
  ["k3", { type: "technik" as const, author: "u4", originalAuthor: "u4" }],
]);

const q = (id: string, carrying: boolean) => ({ id, label: `Titel ${id}`, carrying });

describe("R-1662 · problemloesungsweg", () => {
  it("trennt Negativwissen als „Was vermeiden“ von den Lösungsansätzen", () => {
    const quellen = [q("k2", true), q("k1", true), q("k3", false)];
    const weg = problemloesungsweg("unverified", quellen, kos);
    expect(weg?.vermeiden.map((s) => s.id)).toEqual(["k2"]);
    // Die erste TRAGENDE Quelle, die kein Negativwissen ist — nicht einfach die erste der Liste.
    expect(weg?.oeffnen?.id).toBe("k1");
  });

  it("nennt Autor und Originalautor der tragenden Quellen, jede Person einmal", () => {
    const quellen = [q("k1", true), q("k2", true), q("k3", false)];
    const weg = problemloesungsweg("verified", quellen, kos);
    expect(weg?.personen).toEqual([
      { ref: "u1", quellen: ["Titel k1"] },
      { ref: "u2", quellen: ["Titel k2"] },
      { ref: "u3", quellen: ["Titel k2"] },
    ]);
  });

  it("ohne tragende Quelle: Personen der herangezogenen Quellen, Öffnen der ersten Lösungsquelle", () => {
    const weg = problemloesungsweg("unverified", [q("k3", false), q("k1", false)], kos);
    expect(weg?.personen.map((p) => p.ref)).toEqual(["u4", "u1"]);
    expect(weg?.oeffnen?.id).toBe("k3");
  });

  it("eine Quelle ohne Wissensobjekt im Bestand erfindet keine Person und kein Negativwissen", () => {
    const weg = problemloesungsweg("unverified", [q("fremd", true)], kos);
    expect(weg?.personen).toEqual([]);
    expect(weg?.vermeiden).toEqual([]);
    expect(weg?.oeffnen?.id).toBe("fremd");
  });

  it("die Rahmung sagt „validiert“ nur bei belegter Einstufung", () => {
    expect(problemloesungsweg("verified", [q("k1", true)], kos)?.hinweisKey).toBe(
      "loesungsweg.hinweis.geprueft",
    );
    expect(problemloesungsweg("unverified", [q("k1", true)], kos)?.hinweisKey).toBe(
      "loesungsweg.hinweis.ungeprueft",
    );
  });

  it("Lückenfall oder keine Quelle: kein Lösungsweg", () => {
    expect(problemloesungsweg("gap", [q("k1", false)], kos)).toBeNull();
    expect(problemloesungsweg("unverified", [], kos)).toBeNull();
  });

  it("nur Negativwissen: nichts zu öffnen als Lösung, die Warnung bleibt", () => {
    const weg = problemloesungsweg("unverified", [q("k2", true)], kos);
    expect(weg?.oeffnen).toBeNull();
    expect(weg?.vermeiden.map((s) => s.id)).toEqual(["k2"]);
  });
});
