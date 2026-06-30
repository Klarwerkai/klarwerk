import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../knowledge-object";
import { DEFAULT_TOP_K, Reasoner } from "../../reasoner";
import { InMemoryGapRepo } from "./repo";
import { AskService } from "./service";

// SCRUM-360 / AG-03 / FR-ASK-02 / NFR-PERF-03: Scale-Smoke (kein 100k-Lasttest — der bleibt Team 5).
// Ask reicht nicht mehr blind alle KOs durch: bei vielen KOs + Störern + ähnlichen Begriffen bevorzugt
// die begrenzte, status-/trust-bewusste Top-K-Auswahl validierte/relevante Quellen; Störer steigen
// nicht auf; ohne Treffer entsteht eine ehrliche Wissenslücke.
async function setup() {
  const koRepo = new InMemoryKoRepo();
  const koService = new KoService({ repo: koRepo });
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService,
    gaps: new InMemoryGapRepo(),
    audit,
  });
  return { ask, koService, audit };
}

async function createKo(
  koService: KoService,
  title: string,
  statement: string,
  validated: boolean,
): Promise<KnowledgeObject> {
  const ko = await koService.create({
    title,
    statement,
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
  });
  if (validated) {
    return koService.setValidationState(ko.id, { trust: 90, status: "validiert" });
  }
  return ko;
}

describe("SCRUM-360: Ask Top-K Retrieval (Scale-Smoke)", () => {
  it("bei großem Bestand bleibt die Kandidatenmenge begrenzt und die Antwort quellengebunden auf das relevante, validierte KO", async () => {
    const { ask, koService, audit } = await setup();

    // ~220 thematisch unpassende Störer-KOs (sollen NIE als Quelle erscheinen).
    for (let i = 0; i < 220; i += 1) {
      await createKo(
        koService,
        `Schmierplan Pumpe ${i}`,
        `Pumpe ${i} alle 200 Stunden schmieren und Lager prüfen.`,
        i % 2 === 0,
      );
    }
    // Ein paar lose Treffer (teilen nur das schwache Token „ventil"), aber NICHT das Thema HZ7.
    await createKo(koService, "Ventil reinigen", "Ventil regelmäßig reinigen.", true);

    // Das eigentliche Zielwissen: validiert + zweite, inhaltsgleiche OFFENE Variante.
    const target = await createKo(
      koService,
      "Hydraulikzylinder HZ7 entlüften",
      "Vor dem Entlüften des Hydraulikzylinders HZ7 den Systemdruck ablassen.",
      true,
    );
    await createKo(
      koService,
      "Hydraulikzylinder HZ7 entlüften",
      "Vor dem Entlüften des Hydraulikzylinders HZ7 den Systemdruck ablassen.",
      false, // gleiche Relevanz, aber offen → darf das validierte KO nicht verdrängen
    );

    const { result, gap } = await ask.ask("Wie wird der Hydraulikzylinder HZ7 entlüftet?");

    // Antwort ist quellengebunden auf das relevante, VALIDIERTE KO (nicht die offene Variante, kein Störer).
    expect(result.answered).toBe(true);
    expect(result.knowledgeClass).toBe("gesichert");
    expect(result.sources).toEqual([target.id]);
    expect(gap).toBeNull();

    // SCRUM-361: Begrenzung ist auditierbar. Der Prefilter (findCandidates) liefert nur die
    // thematisch passenden KOs (kein All-Pool mehr): hier die HZ7-KOs, NICHT die ~220 Störer.
    // Die finale Kandidatenmenge ist ≤ topK; Retrieval-Modus ist dokumentiert.
    const queries = await audit.list({ action: "ask.query" });
    const last = queries.at(-1);
    expect(last?.payload.retrievalMode).toBe("prefilter");
    expect((last?.payload.prefilterCount as number) ?? 0).toBeGreaterThan(0);
    expect((last?.payload.prefilterCount as number) ?? 999).toBeLessThan(50); // nur Treffer, nicht alle ~220
    expect((last?.payload.candidateCount as number) ?? 999).toBeLessThanOrEqual(DEFAULT_TOP_K);
    expect(last?.payload.topK).toBe(DEFAULT_TOP_K);
  });

  it("ohne thematischen Treffer entsteht trotz großem Bestand eine ehrliche Wissenslücke (kein Raten)", async () => {
    const { ask, koService } = await setup();
    for (let i = 0; i < 120; i += 1) {
      await createKo(
        koService,
        `Filter F${i} wechseln`,
        `Filter F${i} vierteljährlich tauschen.`,
        true,
      );
    }
    const { result, gap } = await ask.ask("Wie hoch ist der aktuelle Wechselkurs?");
    expect(result.answered).toBe(false);
    expect(result.sources).toEqual([]);
    expect(gap).not.toBeNull();
  });
});
