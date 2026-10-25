import { describe, expect, it, vi } from "vitest";
import { InMemoryKoRepo } from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "../../services/validation/src/repo";
import { ValidationService } from "../../services/validation/src/service";

async function aufbau() {
  const repo = new InMemoryKoRepo();
  const koService = new KoService({ repo, genId: () => "vorlage", now: () => 0 });
  const vorlage = await koService.create({
    title: "Wartung",
    statement: "Ventil prüfen.",
    type: "best_practice",
    category: "Board",
    author: "anna",
  });
  await repo.delete(vorlage.id);
  const ratings = new InMemoryRatingRepo();
  const assignments = new InMemoryAssignmentRepo();
  const service = new ValidationService({ koService, ratings, assignments });
  return { repo, koService, vorlage, ratings, assignments, service };
}

describe("Validierungsboard: Bewertungen als Menge", () => {
  it("lädt 10.001 offene Objekte einmal und erhält ihre Boarddaten", async () => {
    const { repo, koService, vorlage, ratings, assignments, service } = await aufbau();
    const faelle = [
      {
        version: 2,
        ratings: [
          { userId: "aktuell-gruen", verdict: "up", koVersion: 2 },
          { userId: "aktuell-gelb", verdict: "warn", koVersion: 2 },
          { userId: "alt-rot", verdict: "down", koVersion: 1 },
        ],
        reviewVotes: { up: 1, warn: 1, down: 0 },
        staleVotes: 1,
      },
      {
        version: 1,
        ratings: [{ userId: "legacy-rot", verdict: "down" }],
        reviewVotes: { up: 0, warn: 0, down: 1 },
        staleVotes: 0,
      },
      {
        version: 2,
        ratings: [{ userId: "legacy-gruen", verdict: "up" }],
        reviewVotes: { up: 0, warn: 0, down: 0 },
        staleVotes: 1,
      },
      {
        version: 1,
        ratings: [],
        reviewVotes: { up: 0, warn: 0, down: 0 },
        staleVotes: 0,
      },
    ] as const;
    const erwartet: KnowledgeObject[] = [];
    for (let index = 0; index < 10_001; index += 1) {
      const fall = faelle[index % faelle.length];
      if (!fall) {
        throw new Error("Stimmenfall fehlt.");
      }
      const ko: KnowledgeObject = {
        ...vorlage,
        id: `ko-${10_001 - index}`,
        title: `Objekt ${index}`,
        status: "offen",
        version: fall.version,
        tags: [`tag-${index}`],
        assignments: [`bestehend-${index}`],
      };
      await repo.insert(ko);
      for (const rating of fall.ratings) {
        await ratings.upsert({ ...rating, koId: ko.id, createdAt: "2026-10-25T00:00:00Z" });
      }
      await assignments.create({ koId: ko.id, userId: "erledigt", status: "done" });
      const offen = [`offen-a-${index}`, `offen-b-${index}`];
      if (index % 2 === 0) {
        for (const userId of offen) {
          await assignments.create({ koId: ko.id, userId, status: "open" });
        }
      }
      erwartet.push({
        ...ko,
        assignments: index % 2 === 0 ? offen : ko.assignments,
        reviewVotes: fall.reviewVotes,
        staleVotes: fall.staleVotes,
      });
    }
    await repo.insert({ ...vorlage, id: "schon-validiert", status: "validiert" });
    await repo.insert({ ...vorlage, id: "andere-kategorie", status: "offen", category: "Andere" });
    await ratings.upsert({
      koId: "schon-validiert",
      userId: "fremd",
      verdict: "down",
      koVersion: 1,
      createdAt: "2026-10-25T00:00:00Z",
    });
    await assignments.create({ koId: "andere-kategorie", userId: "fremd", status: "open" });
    const ids = erwartet.map((ko) => ko.id);
    const gelistet = await koService.list({ category: "Board", status: "offen" });
    expect(gelistet.map((ko) => ko.id)).toEqual(ids);
    const vorher = structuredClone({
      kos: await repo.list({}),
      ratings: await ratings.listByKos([...ids, "schon-validiert", "andere-kategorie"]),
      assignments: await assignments.all(),
    });
    const mengenRead = vi.spyOn(ratings, "listByKos");
    const einzelRead = vi.spyOn(ratings, "listByKo");

    const board = await service.board({ category: "Board" });

    expect(mengenRead).toHaveBeenCalledTimes(1);
    expect(mengenRead).toHaveBeenCalledWith(ids);
    expect(einzelRead).not.toHaveBeenCalled();
    expect(board).toHaveLength(10_001);
    expect(board).toEqual(erwartet);
    mengenRead.mockRestore();
    einzelRead.mockRestore();
    expect(await repo.list({})).toEqual(vorher.kos);
    expect(await ratings.listByKos([...ids, "schon-validiert", "andere-kategorie"])).toEqual(
      vorher.ratings,
    );
    expect(await assignments.all()).toEqual(vorher.assignments);
  });

  it("gibt die Ablehnung des Mengenabrufs unverändert weiter", async () => {
    const { repo, vorlage, ratings, service } = await aufbau();
    await repo.insert({ ...vorlage, id: "offen", status: "offen" });
    const fehler = new Error("Bewertungsquelle nicht verfügbar.");
    const mengenRead = vi.spyOn(ratings, "listByKos").mockRejectedValueOnce(fehler);
    const einzelRead = vi.spyOn(ratings, "listByKo");

    await expect(service.board()).rejects.toBe(fehler);

    expect(mengenRead).toHaveBeenCalledTimes(1);
    expect(mengenRead).toHaveBeenCalledWith(["offen"]);
    expect(einzelRead).not.toHaveBeenCalled();
  });
});
