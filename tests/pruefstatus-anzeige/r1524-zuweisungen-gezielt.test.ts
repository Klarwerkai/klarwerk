// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-1524) · DIE PRÜFSTANDSWEGE LESEN NUR DIE ZUWEISUNGEN IHRER OBJEKTE.
// ================================================================================================
//
// Rest aus einem früheren Lauf: „AssignmentRepo.all() scannt weiterhin sämtliche Zuweisungen; das
// ist funktional korrekt und ehrlich als verbleibende Optimierung dokumentiert." Seither gibt es
// `AssignmentRepo.listByKos(ids)` — gezielt über die Schlüsselspalte `ko_id` —, und
// `pruefstandFuer`/`pruefstaendeFuer` nehmen ihn. Das Prüfbrett braucht weiter ALLE offenen
// Zuweisungen und bleibt bei `all()`.
//
// Ohne Datenbank: die SQL-Form an einer Pool-Attrappe (dieselbe Form wie `ratings.listByKos`), die
// In-Memory-Ablage und der Dienstweg. Der echte PostgreSQL-Lauf gehört auf den Prüfserver.
import { describe, expect, it } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import { InMemoryAssignmentRepo, PgAssignmentRepo } from "../../services/validation";

type Anfrage = { text: string; werte: unknown[] | undefined };

function poolAttrappe(zeilen: unknown[]): { pool: never; anfragen: Anfrage[] } {
  const anfragen: Anfrage[] = [];
  const pool = {
    query: async (text: string, werte?: unknown[]) => {
      anfragen.push({ text, werte });
      return { rows: zeilen.map((data) => ({ data })) };
    },
  };
  return { pool: pool as never, anfragen };
}

describe("R-1524 · AssignmentRepo.listByKos", () => {
  it("PG: EINE gezielte Abfrage über `ko_id` — kein Vollscan", async () => {
    const zuweisung = { koId: "k1", userId: "u1", status: "open" };
    const { pool, anfragen } = poolAttrappe([zuweisung]);
    const repo = new PgAssignmentRepo(pool);
    expect(await repo.listByKos(["k1", "k2"])).toEqual([zuweisung]);
    expect(anfragen).toEqual([
      { text: "SELECT data FROM assignments WHERE ko_id = ANY($1)", werte: [["k1", "k2"]] },
    ]);
  });

  it("PG: leere Eingabe fragt gar nicht", async () => {
    const { pool, anfragen } = poolAttrappe([]);
    expect(await new PgAssignmentRepo(pool).listByKos([])).toEqual([]);
    expect(anfragen).toHaveLength(0);
  });

  it("In-Memory: genau die Zuweisungen der genannten Objekte", async () => {
    const repo = new InMemoryAssignmentRepo();
    await repo.create({ koId: "k1", userId: "u1", status: "open" });
    await repo.create({ koId: "k2", userId: "u1", status: "open" });
    await repo.create({ koId: "k3", userId: "u2", status: "done" });
    const ids = (await repo.listByKos(["k1", "k3"])).map((a) => a.koId).sort();
    expect(ids).toEqual(["k1", "k3"]);
    expect(await repo.listByKos([])).toEqual([]);
  });

  it("Dienst: pruefstandFuer und pruefstaendeFuer lesen gezielt, nie `all()`", async () => {
    const services = buildServices();
    const ko = await services.ko.create({
      title: "Zugewiesen",
      statement: "Kerntext.",
      type: "best_practice",
      category: "K",
      author: "u-autor",
    });
    await services.validation.assign(ko.id, ["u-pruefer"]);
    // Die Ablage hinter dem Dienst: `all` darf nicht mehr gerufen werden.
    const ablage = (services.validation as unknown as { assignments: InMemoryAssignmentRepo })
      .assignments;
    let vollscans = 0;
    const echt = ablage.all.bind(ablage);
    ablage.all = () => {
      vollscans += 1;
      return echt();
    };
    expect((await services.validation.pruefstandFuer(ko.id, ko.version)).assignments).toEqual([
      "u-pruefer",
    ]);
    const menge = await services.validation.pruefstaendeFuer([{ id: ko.id, version: ko.version }]);
    expect(menge.get(ko.id)?.assignments).toEqual(["u-pruefer"]);
    expect(vollscans).toBe(0);
  });
});
