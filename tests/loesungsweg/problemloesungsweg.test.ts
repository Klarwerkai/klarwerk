// R-1662 · GEFÜHRTER WEG VOM PROBLEM ZUR LÖSUNG — die Ableitung ohne DOM.
//
// Geprüft wird, was das Addendum verlangt und was die Antwort tatsächlich trägt: Negativwissen
// wird „Was vermeiden", die erste tragende Lösungsquelle wird „Quelle öffnen", Autor und
// Originalautor der tragenden Quellen werden Ansprechpersonen, und die Rahmung sagt „validiert"
// nur bei belegter Einstufung. Im Lückenfall gibt es keinen Lösungsweg.
import { describe, expect, it } from "vitest";
import type { Conflict } from "../../apps/web/src/api/types";
import {
  fruehereRevalidierungen,
  geloesteKonflikte,
  problemloesungsweg,
  revalidierungsfaelle,
  wegAbrufAus,
} from "../../apps/web/src/lib/problemloesungsweg";

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

// Ben, Nacharbeit 2 — Prüfpunkte 5 (gelöste Konflikte) und 6 (alte Revalidierungsfälle).
const titel = new Map([
  ["k1", { title: "Titel k1" }],
  ["k9", { title: "Bestand k9" }],
]);

function konflikt(teil: Partial<Conflict> & Pick<Conflict, "id" | "koA" | "koB">): Conflict {
  return {
    type: "truth",
    description: "",
    status: "geloest",
    secondOpinion: null,
    decidedBy: "u9",
    decision: "A gilt.",
    resolutionReason: "decided",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...teil,
  };
}

describe("R-1662 · geloesteKonflikte", () => {
  it("ordnet einen gelösten Konflikt der Quelle zu und nennt Gegenseite und Entscheidung", () => {
    const befund = geloesteKonflikte([q("k1", true)], titel, {
      stand: "da",
      daten: [konflikt({ id: "c1", koA: "k9", koB: "k1" })],
    });
    expect(befund).toEqual({
      stand: "da",
      eintraege: [
        {
          id: "c1",
          quelle: q("k1", true),
          gegen: { id: "k9", label: "Bestand k9" },
          ausgang: "entschieden",
          entscheidung: "A gilt.",
          zurueckgehalten: false,
        },
      ],
    });
  });

  it("Fehlalarm, Redaktion und unbekannte Gegenseite: nichts wird erfunden", () => {
    const befund = geloesteKonflikte([q("k1", true)], titel, {
      stand: "da",
      daten: [
        konflikt({ id: "c2", koA: "k1", koB: "unbekannt", resolutionReason: "dismissed" }),
        konflikt({ id: "c3", koA: "k1", koB: "k9", decision: "", redacted: true }),
      ],
    });
    expect(befund.stand === "da" && befund.eintraege).toEqual([
      expect.objectContaining({
        id: "c2",
        ausgang: "fehlalarm",
        gegen: { id: "unbekannt", label: "unbekannt" },
      }),
      expect.objectContaining({ id: "c3", entscheidung: null, zurueckgehalten: true }),
    ]);
  });

  it("ein OFFENER Konflikt und ein Konflikt ohne Quellenbezug zählen nicht", () => {
    const befund = geloesteKonflikte([q("k1", true)], titel, {
      stand: "da",
      daten: [
        konflikt({ id: "c4", koA: "k1", koB: "k9", status: "offen" }),
        konflikt({ id: "c5", koA: "x", koB: "y" }),
      ],
    });
    expect(befund).toEqual({ stand: "da", eintraege: [] });
  });

  it("Laden und Fehler bleiben eigene Zustände — nie „keine gelösten Konflikte“", () => {
    expect(geloesteKonflikte([q("k1", true)], titel, { stand: "laedt" })).toEqual({
      stand: "laedt",
    });
    expect(geloesteKonflikte([q("k1", true)], titel, { stand: "fehler" })).toEqual({
      stand: "fehler",
    });
    // Eine Antwort, die keine Liste ist, ist keine Auskunft.
    const keineListe = { stand: "da", daten: {} as unknown as Conflict[] } as const;
    expect(geloesteKonflikte([q("k1", true)], titel, keineListe)).toEqual({ stand: "fehler" });
  });
});

// Ben, Nacharbeit 5 — frühere, schon BESTÄTIGTE Revalidierungen, getrennt von offenen Fällen.
describe("R-1662 · fruehereRevalidierungen", () => {
  it("je Quelle die jüngste Bestätigung mit Fassung und Anzahl, in der Ordnung der Quellen", () => {
    const quellen = [q("k1", true), q("k3", false), q("k2", false)];
    const befund = fruehereRevalidierungen(quellen, {
      stand: "da",
      daten: [
        { koId: "k3", am: "2026-03-01T08:00:00.000Z", version: 4 },
        { koId: "k3", am: "2026-05-01T08:00:00.000Z", version: 6 },
        { koId: "k1", am: "2026-02-01T08:00:00.000Z", version: null },
        { koId: "fremd", am: "2026-06-01T08:00:00.000Z", version: 9 },
      ],
    });
    expect(befund).toEqual({
      stand: "da",
      eintraege: [
        { quelle: q("k1", true), zuletztAm: "2026-02-01T08:00:00.000Z", version: null, anzahl: 1 },
        { quelle: q("k3", false), zuletztAm: "2026-05-01T08:00:00.000Z", version: 6, anzahl: 2 },
      ],
    });
  });

  it("keine Bestätigung heisst „keine“; Laden und Fehler bleiben eigene Zustände", () => {
    expect(fruehereRevalidierungen([q("k1", true)], { stand: "da", daten: [] })).toEqual({
      stand: "da",
      eintraege: [],
    });
    expect(fruehereRevalidierungen([q("k1", true)], { stand: "fehler" })).toEqual({
      stand: "fehler",
    });
    expect(fruehereRevalidierungen([q("k1", true)], { stand: "laedt" })).toEqual({
      stand: "laedt",
    });
  });
});

describe("R-1662 · revalidierungsfaelle", () => {
  it("nennt genau die Quellen der Antwort, die zur Revalidierung vorgemerkt sind", () => {
    const quellen = [q("k1", true), q("k3", false)];
    expect(revalidierungsfaelle(quellen, { stand: "da", daten: ["k3", "fremd"] })).toEqual({
      stand: "da",
      eintraege: [q("k3", false)],
    });
    expect(revalidierungsfaelle(quellen, { stand: "da", daten: [] })).toEqual({
      stand: "da",
      eintraege: [],
    });
  });

  it("Laden und Fehler bleiben eigene Zustände", () => {
    expect(revalidierungsfaelle([q("k1", true)], { stand: "fehler" })).toEqual({
      stand: "fehler",
    });
    expect(wegAbrufAus({ data: undefined, isError: false })).toEqual({ stand: "laedt" });
    expect(wegAbrufAus({ data: ["k1"], isError: true })).toEqual({ stand: "fehler" });
    expect(wegAbrufAus({ data: ["k1"], isError: false })).toEqual({ stand: "da", daten: ["k1"] });
  });
});
