import { describe, expect, it } from "vitest";
import { type CreateKoInput, InMemoryKoRepo, KoService } from "../../knowledge-object";
import {
  DECKEL_JE_SIGNAL,
  VORSCHLAG_GEWICHTE,
  type VorschlagsEingabe,
  prueferVorschlag,
} from "./pruefer-vorschlag";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "./repo";
import { ValidationService } from "./service";

// R-0265: „Das System schlägt vor, wer ein neues Wissensobjekt prüfen sollte — abgeleitet aus
// Autorenschaft, früheren Prüfungen und der Nähe im Wissensnetz."

function eingabe(teil: Partial<VorschlagsEingabe>): VorschlagsEingabe {
  return {
    ziel: { category: "Hydraulik", tags: [] },
    ausgeschlossen: ["autor"],
    kandidaten: ["anna", "bert", "cora", "dirk", "autor"],
    bestand: [],
    bewertungen: [],
    nachbarn: new Set(),
    ...teil,
  };
}

describe("R-0265 · prueferVorschlag (rein, deterministisch)", () => {
  it("V1 · Autorenschaft: wer zur selben Kategorie schreibt, wird vorgeschlagen", () => {
    const v = prueferVorschlag(
      eingabe({
        bestand: [
          { id: "k1", author: "anna", category: "hydraulik " },
          { id: "k2", author: "bert", category: "Elektrik" },
        ],
      }),
    );
    expect(v).toEqual([
      { userId: "anna", punkte: VORSCHLAG_GEWICHTE.autorschaft, gruende: ["autorschaft"] },
    ]);
  });

  it("V2 · Frühere Prüfungen: wer ein Objekt mit gemeinsamem Schlagwort bewertet hat", () => {
    const v = prueferVorschlag(
      eingabe({
        ziel: { category: "", tags: ["Ventil"] },
        bestand: [{ id: "k1", author: "dirk", category: "X", tags: ["ventil", "druck"] }],
        bewertungen: [{ koId: "k1", userId: "bert" }],
      }),
    );
    expect(v.map((s) => [s.userId, s.gruende])).toEqual([
      ["bert", ["pruefungen"]],
      ["dirk", ["autorschaft"]],
    ]);
  });

  it("V3 · Netznähe: Autor und Prüfer eines direkt verbundenen Objekts, auch themenfremd", () => {
    const v = prueferVorschlag(
      eingabe({
        ziel: { id: "ziel", category: "Hydraulik", tags: [] },
        bestand: [
          { id: "ziel", author: "autor", category: "Hydraulik" },
          { id: "nachbar", author: "cora", category: "Elektrik" },
        ],
        bewertungen: [{ koId: "nachbar", userId: "anna" }],
        nachbarn: new Set(["nachbar"]),
      }),
    );
    expect(v).toEqual([
      { userId: "anna", punkte: VORSCHLAG_GEWICHTE.netznaehe, gruende: ["netznaehe"] },
      { userId: "cora", punkte: VORSCHLAG_GEWICHTE.netznaehe, gruende: ["netznaehe"] },
    ]);
  });

  it("V4 · Autor und Fragender werden nie vorgeschlagen; Nicht-Kandidaten auch nicht", () => {
    const v = prueferVorschlag(
      eingabe({
        ausgeschlossen: ["autor", "anna"],
        bestand: [
          { id: "k1", author: "autor", category: "Hydraulik" },
          { id: "k2", author: "anna", category: "Hydraulik" },
          { id: "k3", author: "geloescht", category: "Hydraulik" },
        ],
        bewertungen: [{ koId: "k1", userId: "autor" }],
      }),
    );
    expect(v).toEqual([]);
  });

  it("V5 · je Signal zählen höchstens DECKEL_JE_SIGNAL Objekte; Signale addieren sich", () => {
    const viele = Array.from({ length: 6 }, (_, i) => ({
      id: `a${i}`,
      author: "anna",
      category: "Hydraulik",
    }));
    const v = prueferVorschlag(
      eingabe({
        bestand: [...viele, { id: "b1", author: "bert", category: "Hydraulik" }],
        bewertungen: [{ koId: "b1", userId: "bert" }],
      }),
    );
    expect(v[0]).toEqual({
      userId: "anna",
      punkte: DECKEL_JE_SIGNAL * VORSCHLAG_GEWICHTE.autorschaft,
      gruende: ["autorschaft"],
    });
    expect(v[1]).toEqual({
      userId: "bert",
      punkte: VORSCHLAG_GEWICHTE.autorschaft + VORSCHLAG_GEWICHTE.pruefungen,
      gruende: ["autorschaft", "pruefungen"],
    });
  });

  it("V6 · ohne Thema und ohne Beziehung gibt es keinen Vorschlag", () => {
    const v = prueferVorschlag(
      eingabe({
        ziel: { category: "  ", tags: [] },
        bestand: [{ id: "k1", author: "anna", category: "" }],
      }),
    );
    expect(v).toEqual([]);
  });

  it("V7 · Gleichstand wird nach Kennung geordnet; `anzahl` begrenzt", () => {
    const bestand = ["dirk", "bert", "cora", "anna"].map((author, i) => ({
      id: `k${i}`,
      author,
      category: "Hydraulik",
    }));
    expect(prueferVorschlag(eingabe({ bestand })).map((s) => s.userId)).toEqual([
      "anna",
      "bert",
      "cora",
      "dirk",
    ]);
    expect(prueferVorschlag(eingabe({ bestand, anzahl: 2 })).map((s) => s.userId)).toEqual([
      "anna",
      "bert",
    ]);
  });
});

describe("R-0265 · ValidationService.prueferVorschlagFuer", () => {
  function koInput(overrides: Partial<CreateKoInput>): CreateKoInput {
    return {
      title: "Aussage",
      statement: "Inhalt.",
      type: "best_practice",
      category: "Hydraulik",
      author: "anna",
      neededValidations: 2,
      ...overrides,
    };
  }

  it("S1 · stützt sich nur auf sichtbare Objekte und zählt echte Bewertungen", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const service = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments: new InMemoryAssignmentRepo(),
    });
    const offen = await koService.create(koInput({ author: "anna" }));
    const verborgen = await koService.create(koInput({ author: "cora", title: "Verborgen" }));
    await service.rate(offen.id, "bert", "up");
    await service.rate(verborgen.id, "dirk", "up");

    const v = await service.prueferVorschlagFuer({
      ziel: { category: "Hydraulik", tags: [] },
      ausgeschlossen: ["autor"],
      kandidaten: ["anna", "bert", "cora", "dirk"],
      nachbarn: new Set(),
      sichtbar: (ko) => ko.id !== verborgen.id,
    });
    expect(v.map((s) => [s.userId, s.gruende])).toEqual([
      ["anna", ["autorschaft"]],
      ["bert", ["pruefungen"]],
    ]);
  });
});
