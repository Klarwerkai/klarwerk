// ================================================================================================
// R-1656 · „DU SOLLTEST AUCH WISSEN…" — DIE REINEN REGELN.
// ================================================================================================
//
//   R1  Mehrere Gründe an derselben Gegenseite werden zusammengeführt, nicht doppelt gelistet.
//   R2  Reihenfolge: Konflikt vorn, dann mehr Gründe, dann häufiger gelesen, dann mehr Schlagwörter.
//   R3  Zentrum und unbekannte (= unsichtbare) Gegenseiten erscheinen nie; Deckel ehrlich beziffert.
//   R4  Der Zähler liefert Partner erst ab der Schwelle; die Kontosperre verfällt nach ihrer Frist.
//   R5  Die Lesespur meldet ein Paar nur aus derselben Lesesitzung und je Tab nur einmal.
import { describe, expect, it } from "vitest";
import { LESESITZUNG_MS, type Lesespur, naechsteLesespur } from "../../apps/web/src/lib/lesespur";
import {
  InMemoryMitgelesenRepo,
  MITGELESEN_MINDESTENS,
  MITGELESEN_SPERRE_MS,
  WissensempfehlungDienst,
  bildeEmpfehlungen,
} from "../../services/app/src/wissensempfehlung";

const ko = (id: string, title = id) => ({ id, title, status: "offen" as const });

function bestand(...ids: string[]) {
  return new Map(ids.map((id) => [id, ko(id, `Titel ${id}`)]));
}

describe("R1–R3 · bildeEmpfehlungen", () => {
  it("führt Gründe je Gegenseite zusammen und ordnet sie fest", () => {
    const ergebnis = bildeEmpfehlungen(
      "z",
      {
        thema: [
          { id: "b", via: ["pumpe"] },
          { id: "c", via: ["pumpe", "wartung"] },
          { id: "d", via: ["pumpe"] },
        ],
        konflikte: [{ koA: "e", koB: "z", status: "offen" }],
        mitgelesen: [
          { koId: "b", anzahl: 4 },
          { koId: "f", anzahl: 9 },
        ],
      },
      bestand("b", "c", "d", "e", "f"),
    );
    expect(ergebnis.empfehlungen.map((e) => e.id)).toEqual(["e", "b", "f", "c", "d"]);
    expect(ergebnis.empfehlungen[1]?.gruende).toEqual([
      { art: "mitgelesen", anzahl: 4 },
      { art: "thema", schlagwoerter: ["pumpe"] },
    ]);
    expect(ergebnis.total).toBe(5);
    expect(ergebnis.truncated).toBe(false);
  });

  it("lässt Zentrum und unbekannte Gegenseiten weg und deckelt ehrlich", () => {
    const ergebnis = bildeEmpfehlungen(
      "z",
      {
        thema: ["a", "b", "c", "d", "e", "f", "z"].map((id) => ({ id, via: ["t"] })),
        konflikte: [{ koA: "z", koB: "unsichtbar", status: "offen" }],
        mitgelesen: [{ koId: "unsichtbar", anzahl: 50 }],
      },
      bestand("a", "b", "c", "d", "e", "f"),
      5,
    );
    expect(ergebnis.empfehlungen.map((e) => e.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(ergebnis.total).toBe(6);
    expect(ergebnis.truncated).toBe(true);
    expect(JSON.stringify(ergebnis)).not.toContain("unsichtbar");
  });

  it("ein gelöster Konflikt heisst „entschieden“", () => {
    const ergebnis = bildeEmpfehlungen(
      "z",
      { thema: [], konflikte: [{ koA: "z", koB: "a", status: "geloest" }], mitgelesen: [] },
      bestand("a"),
    );
    expect(ergebnis.empfehlungen[0]?.gruende).toEqual([{ art: "konflikt", stand: "entschieden" }]);
  });
});

describe("R4 · Zähler, Schwelle und Kontosperre", () => {
  it("Partner erst ab der Schwelle, in beiden Richtungen", async () => {
    const repo = new InMemoryMitgelesenRepo();
    for (let i = 0; i < MITGELESEN_MINDESTENS - 1; i++) {
      await repo.zaehle("b", "a");
    }
    expect(await repo.partner("a", MITGELESEN_MINDESTENS, 10)).toEqual([]);
    await repo.zaehle("a", "b");
    expect(await repo.partner("a", MITGELESEN_MINDESTENS, 10)).toEqual([
      { koId: "b", anzahl: MITGELESEN_MINDESTENS },
    ]);
    expect(await repo.partner("b", MITGELESEN_MINDESTENS, 10)).toEqual([
      { koId: "a", anzahl: MITGELESEN_MINDESTENS },
    ]);
  });

  it("dasselbe Konto zählt ein Paar einmal je Sperrfrist; danach wieder", async () => {
    let jetzt = 1_000_000;
    const repo = new InMemoryMitgelesenRepo();
    const dienst = new WissensempfehlungDienst({
      repo,
      ko: { get: async () => undefined },
      thema: async () => [],
      konflikte: { unresolved: async () => [], vorrangFuerKo: async () => [] },
      jetzt: () => jetzt,
    });
    expect(await dienst.mitgelesen("konto-1", "a", "b")).toBe(true);
    expect(await dienst.mitgelesen("konto-1", "b", "a")).toBe(false);
    expect(await dienst.mitgelesen("konto-2", "a", "b")).toBe(true);
    jetzt += MITGELESEN_SPERRE_MS + 1;
    expect(await dienst.mitgelesen("konto-1", "a", "b")).toBe(true);
    expect(await repo.partner("a", 1, 10)).toEqual([{ koId: "b", anzahl: 3 }]);
  });
});

describe("R5 · die Lesespur im Tab", () => {
  const t0 = 5_000_000;

  it("erster Eintrag und derselbe Eintrag melden nichts", () => {
    const erster = naechsteLesespur(null, "a", t0);
    expect(erster.zuvor).toBeUndefined();
    expect(naechsteLesespur(erster.spur, "a", t0 + 1000).zuvor).toBeUndefined();
  });

  it("A dann B meldet A — dasselbe Paar danach nicht noch einmal", () => {
    const a = naechsteLesespur(null, "a", t0).spur;
    const b = naechsteLesespur(a, "b", t0 + 60_000);
    expect(b.zuvor).toBe("a");
    const wiederA = naechsteLesespur(b.spur, "a", t0 + 120_000);
    expect(wiederA.zuvor).toBeUndefined();
    const c = naechsteLesespur(wiederA.spur, "c", t0 + 180_000);
    expect(c.zuvor).toBe("a");
  });

  it("nach dem Ende der Lesesitzung oder bei verstellter Uhr kein Paar", () => {
    const a: Lesespur = { letzte: "a", am: t0, gemeldet: [] };
    expect(naechsteLesespur(a, "b", t0 + LESESITZUNG_MS + 1).zuvor).toBeUndefined();
    expect(naechsteLesespur(a, "b", t0 - 1).zuvor).toBeUndefined();
  });
});
