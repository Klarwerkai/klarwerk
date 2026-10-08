import { describe, expect, it } from "vitest";
import {
  type CreateKoInput,
  InMemoryKoRepo,
  KoService,
  type KoSource,
  TRUTH_CONFLICT_TRUST_PENALTY,
} from "../../services/knowledge-object";
import {
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  type KonfliktArt,
  PRUEFER_ERFAHRUNG_AB,
  PRUEFER_GEWICHT,
  QUELLEN_TRUST_WIRKUNG,
  type Rating,
  TRUST_MAX,
  ValidationService,
  computeOutcome,
  prueferStufe,
  quellenArtVon,
} from "../../services/validation";

// Aufnahme gesamt-peer-validierung, Nacharbeit 1 (Ben):
//  · R-0254 — erfahrene Prüfer zählen mehr (Gewicht je Prüferstufe, Erfahrung aus dem Bestand).
//  · R-0256 — eigene Gewichte je Quellenart (Aufschlag der stärksten Belegstelle).
//  · Wettlauf — ein Wahrheitskonflikt, der WÄHREND einer laufenden Bewertung entsteht, wird von
//    deren Schreibvorgang nicht mehr mit „validiert, 99" überschrieben.

function eingabe(overrides: Partial<CreateKoInput> = {}): CreateKoInput {
  return {
    title: "Aussage",
    statement: "Inhalt.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
    neededValidations: 3,
    ...overrides,
  };
}

function quelle(overrides: Partial<KoSource> = {}): KoSource {
  return {
    id: "q1",
    label: "Wartungshandbuch",
    url: null,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    author: "anna",
    at: "2026-10-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("R-0254 · Prüferstufe und Gewicht", () => {
  it("Stufen an den Schwellen 10 und 50 früherer Bewertungen", () => {
    expect(PRUEFER_ERFAHRUNG_AB).toEqual({ erfahren: 10, sehr_erfahren: 50 });
    expect(prueferStufe(0)).toBe("neu");
    expect(prueferStufe(9)).toBe("neu");
    expect(prueferStufe(10)).toBe("erfahren");
    expect(prueferStufe(49)).toBe("erfahren");
    expect(prueferStufe(50)).toBe("sehr_erfahren");
    expect(PRUEFER_GEWICHT).toEqual({ neu: 1, erfahren: 1.25, sehr_erfahren: 1.5 });
  });

  it("eine erfahrene Freigabe hebt mehr, eine erfahrene Ablehnung senkt mehr", () => {
    expect(computeOutcome(["up"], 3).trust).toBe(33);
    expect(computeOutcome([{ verdict: "up", gewicht: 1.5 }], 3).trust).toBe(50);
    expect(computeOutcome(["up", "up", "down"], 3).trust).toBe(33);
    expect(computeOutcome(["up", "up", { verdict: "down", gewicht: 1.5 }], 3).trust).toBe(17);
  });

  it("der Status zählt weiter Personen: zwei erfahrene Freigaben ersetzen keine dritte", () => {
    const zwei = computeOutcome(
      [
        { verdict: "up", gewicht: 1.5 },
        { verdict: "up", gewicht: 1.5 },
      ],
      3,
    );
    expect(zwei.trust).toBe(TRUST_MAX);
    expect(zwei.up).toBe(2);
    expect(zwei.status).toBe("offen");
  });
});

describe("R-0256 · Quellenart und Gewicht", () => {
  it("die Quellenart folgt dem, was die Belegstelle nachweislich trägt", () => {
    expect(quellenArtVon(quelle({ objectId: "obj-1" }))).toBe("beleg_anhang");
    expect(quellenArtVon(quelle({ externalId: "4711" }))).toBe("quellsystem");
    expect(quellenArtVon(quelle({ attachmentOf: "4711" }))).toBe("quellsystem");
    expect(quellenArtVon(quelle({ url: "https://example.org/x" }))).toBe("extern");
    const geloescht = quelle({ externalId: "4711", sourceRemovedAt: "2026-10-02" });
    expect(quellenArtVon(geloescht)).toBeNull();
    expect(QUELLEN_TRUST_WIRKUNG).toEqual({ beleg_anhang: 5, quellsystem: 3, extern: 0 });
  });

  it("es zählt die stärkste Quellenart, nicht die Summe; externe Links wirken nicht", () => {
    expect(computeOutcome(["up"], 3, { quellenArten: ["extern"] }).trust).toBe(33);
    expect(computeOutcome(["up"], 3, { quellenArten: ["quellsystem"] }).trust).toBe(36);
    const alle = computeOutcome(["up"], 3, {
      quellenArten: ["quellsystem", "beleg_anhang", "extern"],
    });
    expect(alle.trust).toBe(38);
    expect(computeOutcome(["up"], 3, { quellenArten: [null] }).trust).toBe(33);
  });

  it("ohne positive Prüfstimme kein Aufschlag; der Deckel 99 bleibt; Status unberührt", () => {
    expect(computeOutcome([], 3, { quellenArten: ["beleg_anhang"] }).trust).toBe(0);
    expect(computeOutcome(["down"], 1, { quellenArten: ["beleg_anhang"] }).trust).toBe(0);
    const voll = computeOutcome(["up"], 1, { quellenArten: ["beleg_anhang"] });
    expect(voll.trust).toBe(TRUST_MAX);
    expect(computeOutcome(["up"], 3, { quellenArten: ["beleg_anhang"] }).status).toBe("offen");
  });

  it("Konfliktwirkung kommt nach dem Quellenaufschlag", () => {
    const mitBeidem = computeOutcome(["up", "up"], 3, {
      quellenArten: ["beleg_anhang"],
      offeneKonflikte: ["role"],
    });
    expect(mitBeidem.trust).toBe(67 + 5 - 5);
  });
});

describe("R-0254 / R-0256 · am Bewertungsweg mit echter Datenanbindung", () => {
  function wired() {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const ratings = new InMemoryRatingRepo();
    const service = new ValidationService({
      koService,
      ratings,
      assignments: new InMemoryAssignmentRepo(),
    });
    return { koService, ratings, service };
  }

  it("Erfahrung wird aus den Bewertungen an ANDEREN Objekten gezählt", async () => {
    const { koService, ratings, service } = wired();
    for (let i = 0; i < PRUEFER_ERFAHRUNG_AB.erfahren; i++) {
      const fremd = await koService.create(eingabe({ title: `Früher ${i}`, neededValidations: 1 }));
      await service.rate(fremd.id, "erfahren", "up");
    }
    const ziel = await koService.create(eingabe());
    const erfahrung = await ratings.fruehereBewertungen(["erfahren", "neu"], ziel.id);
    expect(erfahrung.get("erfahren")).toBe(PRUEFER_ERFAHRUNG_AB.erfahren);
    expect(erfahrung.has("neu")).toBe(false);

    const vonErfahren = await service.rate(ziel.id, "erfahren", "up");
    expect(vonErfahren.trust).toBe(42); // 1,25 / 3
    expect(vonErfahren.status).toBe("offen");

    // GEGENPROBE: dieselbe Lage durch eine Person ohne frühere Bewertung.
    const zweites = await koService.create(eingabe({ title: "Gegenprobe" }));
    expect((await service.rate(zweites.id, "neu", "up")).trust).toBe(33);
  });

  it("die eigene Bewertung am selben Objekt zählt nicht als Erfahrung", async () => {
    const { koService, ratings, service } = wired();
    const ko = await koService.create(eingabe());
    await service.rate(ko.id, "p1", "warn");
    await service.rate(ko.id, "p1", "up");
    expect((await ratings.fruehereBewertungen(["p1"], ko.id)).get("p1")).toBeUndefined();
  });

  it("die Belegstelle am Objekt hebt den Wert nach ihrer Art", async () => {
    const { koService, service } = wired();
    const confluence = quelle({ externalId: "4711", spaceKey: "WART" });
    const mitQuelle = await koService.create(
      eingabe({ title: "Mit Quelle", sources: [confluence] }),
    );
    const ohneQuelle = await koService.create(eingabe({ title: "Ohne Quelle" }));
    expect((await service.rate(mitQuelle.id, "p1", "up")).trust).toBe(33 + 3);
    expect((await service.rate(ohneQuelle.id, "p1", "up")).trust).toBe(33);
  });
});

describe("Ben Nacharbeit 1 · Wahrheitskonflikt während einer laufenden Bewertung", () => {
  // Hält die Bewertungsklammer an genau der Stelle an, an der sie unter dem KO-Lock die Stimmen
  // liest — so ist die Lücke zwischen „Bewertung begonnen" und „Bewertung geschrieben" offen.
  class AngehalteneBewertungen extends InMemoryRatingRepo {
    private halt: Promise<void> | null = null;
    private angekommen: () => void = () => undefined;

    anhalten(): { erreicht: Promise<void>; freigeben: () => void } {
      let freigeben: () => void = () => undefined;
      this.halt = new Promise<void>((r) => {
        freigeben = r;
      });
      const erreicht = new Promise<void>((r) => {
        this.angekommen = r;
      });
      return { erreicht, freigeben };
    }

    override async listByKo(koId: string): Promise<Rating[]> {
      const halt = this.halt;
      if (halt) {
        this.halt = null;
        this.angekommen();
        await halt;
      }
      return super.listByKo(koId);
    }
  }

  it("der Konflikt entsteht in der Lücke: kein „validiert, 99“ über der Wahrheitsstrafe", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const ratings = new AngehalteneBewertungen();
    const konflikte: KonfliktArt[] = [];
    const service = new ValidationService({
      koService,
      ratings,
      assignments: new InMemoryAssignmentRepo(),
      offeneKonfliktArten: async () => [...konflikte],
    });
    const ko = await koService.create(eingabe({ neededValidations: 1 }));
    expect((await service.rate(ko.id, "p1", "up")).trust).toBe(TRUST_MAX);

    const { erreicht, freigeben } = ratings.anhalten();
    const laufend = service.rate(ko.id, "p2", "up");
    await erreicht; // die Bewertung steht jetzt unter dem KO-Lock, noch nichts geschrieben

    // So legt die Route einen Wahrheitskonflikt an: erst der Konflikt, dann seine Folge.
    konflikte.push("truth");
    const folge = koService.markTruthConflictReview(ko.id, "controller");

    freigeben();
    await laufend;
    await folge;

    const danach = await koService.get(ko.id);
    // Vorher: die Folge sah das Objekt sofort, setzte „offen, 87" — und die Bewertung schrieb
    // danach mit ihrem alten, leeren Konfliktbestand „validiert, 99" darüber.
    expect(danach?.status).toBe("offen");
    expect(danach?.trust).toBeLessThanOrEqual(TRUST_MAX - TRUTH_CONFLICT_TRUST_PENALTY);
  });
});
