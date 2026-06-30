import { describe, expect, it } from "vitest";
import { InMemoryKoRepo } from "./repo";
import { type CreateKoInput, KoService } from "./service";

// SCRUM-361 / AG-03 / FR-ASK-02 / NFR-PERF-03: datenquellennahe, begrenzte Kandidaten-Vorauswahl für
// Ask. ODER-Treffer über Inhaltstoken, gedeckelt auf `limit`, mit validiert-/Trust-Bias — relevante
// validierte Treffer bleiben unter dem Limit erhalten; irrelevante KOs (Score 0) fallen raus.
function koInput(overrides: Partial<CreateKoInput> = {}): CreateKoInput {
  return {
    title: "Titel",
    statement: "Inhalt.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
    ...overrides,
  };
}

async function svc() {
  return new KoService({ repo: new InMemoryKoRepo() });
}

describe("SCRUM-361: KoService.findCandidates (InMemory)", () => {
  it("liefert nur thematisch passende KOs (ODER-Treffer über Inhaltstoken), Störer fallen raus", async () => {
    const service = await svc();
    const ventil = await service.create(
      koInput({
        title: "Ventil bei Überdruck schließen",
        statement: "Bei Überdruck Ventil schließen.",
      }),
    );
    await service.create(
      koInput({ title: "Pumpe schmieren", statement: "Pumpe alle 200h fetten." }),
    );

    const ids = (await service.findCandidates({ terms: ["ventil"], limit: 10 })).map((k) => k.id);
    expect(ids).toContain(ventil.id);
    expect(ids).toHaveLength(1); // Pumpe teilt kein Token „ventil"
  });

  it("respektiert das Limit (Top-Kandidaten bleiben erhalten)", async () => {
    const service = await svc();
    for (let i = 0; i < 20; i += 1) {
      await service.create(koInput({ title: `Ventil ${i}`, statement: `Ventil Variante ${i}.` }));
    }
    expect(await service.findCandidates({ terms: ["ventil"], limit: 5 })).toHaveLength(5);
  });

  it("bevorzugt bei gleichem Term validierte/höher vertrauenswürdige KOs (bleiben unter dem Limit)", async () => {
    const service = await svc();
    // 5 offene + 1 validiertes KO mit demselben Token; Limit 1 → das validierte muss überleben.
    for (let i = 0; i < 5; i += 1) {
      await service.create(
        koInput({ title: `Ventil offen ${i}`, statement: `Ventil offen ${i}.` }),
      );
    }
    const validated = await service.create(
      koInput({ title: "Ventil validiert", statement: "Ventil validiert." }),
    );
    await service.setValidationState(validated.id, { trust: 90, status: "validiert" });

    const top = await service.findCandidates({ terms: ["ventil"], limit: 1 });
    expect(top).toHaveLength(1);
    expect(top[0]?.id).toBe(validated.id);
  });

  it("leere Terme oder kein Treffer → leere Kandidatenliste (kein All-Pool, kein Raten)", async () => {
    const service = await svc();
    await service.create(koInput({ title: "Ventil", statement: "Ventil schließen." }));
    expect(await service.findCandidates({ terms: [], limit: 10 })).toEqual([]);
    expect(await service.findCandidates({ terms: ["aktienkurs"], limit: 10 })).toEqual([]);
  });

  it("findet auch über Tags/Kategorie (Vorauswahl ist bewusst breit)", async () => {
    const service = await svc();
    const ko = await service.create(
      koInput({
        title: "Wartung",
        statement: "Routinewartung.",
        tags: ["hydraulik"],
        category: "Presse 7",
      }),
    );
    expect(
      (await service.findCandidates({ terms: ["hydraulik"], limit: 10 })).map((k) => k.id),
    ).toContain(ko.id);
    expect(
      (await service.findCandidates({ terms: ["presse"], limit: 10 })).map((k) => k.id),
    ).toContain(ko.id);
  });
});
