import { describe, expect, it } from "vitest";
import { DEFAULT_TOP_K, rankCandidates, selectCandidates, statusTrustBoost } from "./provider";
import type { KnowledgeRef } from "./types";

// SCRUM-360 / AG-03 / FR-ASK-02 / NFR-PERF-03: begrenzte, status-/trust-bewusste Top-K-Kandidaten-
// auswahl. Relevanz (Keyword-Überschneidung) ist der dominante Gate; Status/Trust ordnen nur GLEICH
// relevante Kandidaten. Irrelevante Störer steigen nie auf; die Menge ist auf topK begrenzt.
function ko(overrides: Partial<KnowledgeRef> & Pick<KnowledgeRef, "id">): KnowledgeRef {
  return {
    title: "",
    statement: "",
    status: "offen",
    trust: 0,
    ...overrides,
  };
}

describe("SCRUM-360: statusTrustBoost", () => {
  it("bleibt strikt unter 1, damit Relevanz immer dominiert", () => {
    expect(statusTrustBoost({ status: "validiert", trust: 100 })).toBeLessThan(1);
    expect(statusTrustBoost({ status: "validiert", trust: 99 })).toBeLessThan(1);
  });

  it("bevorzugt validiert über offen und höheren Trust über niedrigeren", () => {
    expect(statusTrustBoost({ status: "validiert", trust: 0 })).toBeGreaterThan(
      statusTrustBoost({ status: "offen", trust: 0 }),
    );
    expect(statusTrustBoost({ status: "validiert", trust: 90 })).toBeGreaterThan(
      statusTrustBoost({ status: "validiert", trust: 10 }),
    );
  });

  it("klemmt negativen/überhöhten Trust robust (kein NaN, kein Bonus ≥ 1)", () => {
    expect(statusTrustBoost({ status: "offen", trust: -50 })).toBe(0);
    expect(statusTrustBoost({ status: "validiert", trust: 999 })).toBeLessThan(1);
  });
});

describe("SCRUM-360: rankCandidates / selectCandidates", () => {
  it("Relevanz-Gate: nur KOs mit echter Token-Überschneidung kommen durch (Störer raus)", () => {
    const cands = [
      ko({ id: "ventil", title: "Ventil bei Überdruck", statement: "Ventil schließen." }),
      ko({ id: "pumpe", title: "Pumpe schmieren", statement: "Alle 200h fetten." }),
    ];
    const ids = selectCandidates("Was tun bei Überdruck am Ventil?", cands).map((c) => c.id);
    expect(ids).toEqual(["ventil"]);
  });

  it("Relevanz dominiert: ein offenes KO mit MEHR Überschneidung schlägt ein validiertes mit weniger", () => {
    const cands = [
      // validiert + hoher Trust, aber nur 1 Token-Treffer („ventil")
      ko({
        id: "weak-validated",
        title: "Ventil reinigen",
        statement: "Ventil reinigen.",
        status: "validiert",
        trust: 99,
      }),
      // offen + Trust 0, aber 3 Token-Treffer (ventil/überdruck/schließen)
      ko({
        id: "strong-open",
        title: "Ventil bei Überdruck schließen",
        statement: "Bei Überdruck das Ventil schließen.",
        status: "offen",
        trust: 0,
      }),
    ];
    const ids = selectCandidates("Ventil bei Überdruck schließen", cands).map((c) => c.id);
    expect(ids[0]).toBe("strong-open"); // mehr Relevanz gewinnt, trotz Status/Trust der Alternative
  });

  it("Status/Trust ordnet GLEICH relevante Kandidaten: validiert/ready + höherer Trust zuerst", () => {
    const cands = [
      ko({
        id: "open-low",
        title: "Ventil Überdruck",
        statement: "Ventil Überdruck.",
        status: "offen",
        trust: 10,
      }),
      ko({
        id: "validated-high",
        title: "Ventil Überdruck",
        statement: "Ventil Überdruck.",
        status: "validiert",
        trust: 90,
      }),
    ];
    // identische Tokens → gleiche Keyword-Relevanz → Status/Trust entscheidet.
    const ranked = rankCandidates("Ventil Überdruck", cands);
    expect(ranked[0]?.keywordScore).toBe(ranked[1]?.keywordScore); // wirklich gleich relevant
    expect(ranked.map((r) => r.ref.id)).toEqual(["validated-high", "open-low"]);
  });

  it("begrenzt die Kandidatenmenge auf topK (Default und explizit)", () => {
    const many: KnowledgeRef[] = Array.from({ length: 50 }, (_, i) =>
      ko({
        id: `ko-${i}`,
        title: "Ventil Überdruck",
        statement: `Ventil Überdruck Variante ${i}.`,
        status: i % 2 === 0 ? "validiert" : "offen",
        trust: i,
      }),
    );
    expect(selectCandidates("Ventil Überdruck", many)).toHaveLength(DEFAULT_TOP_K);
    expect(selectCandidates("Ventil Überdruck", many, 3)).toHaveLength(3);
    // Unter den Top-K stehen die validierten/höher vertrauten Varianten vorne (gleiche Relevanz).
    const top = selectCandidates("Ventil Überdruck", many, 3);
    expect(top.every((c) => c.status === "validiert")).toBe(true);
  });

  it("leeres Ergebnis bleibt leer (kein Raten), wenn nichts matcht", () => {
    const cands = [ko({ id: "x", title: "Pumpe", statement: "Pumpe schmieren." })];
    expect(selectCandidates("Aktienkurs heute?", cands)).toEqual([]);
  });
});
