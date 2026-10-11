// ================================================================================================
// R-0338 (Ben, Nacharbeit 3) — DER QUELLENSTAND EINER ANTWORT KOMMT VOM SERVER.
// ================================================================================================
//
// „Den tatsächlichen Quellenstand der Antwort serverseitig mitführen." Gemessen am echten
// Fragedienst (Muster: tests/suche-zuordnung/und-verknuepfung-fragedienst.test.ts): In-Memory-Speicher
// mit aktivierter Suchprojektion, echter `KoService`, echter `AskService`, echter `Reasoner` ohne
// Modellclient (deterministischer Weg).
//   Q1  `quellenStand` nennt für JEDE herangezogene Quelle genau die Fassung, die gelesen wurde.
//   Q2  Nach einer Überarbeitung nennt die nächste Antwort die neue Fassung — nicht die alte.
import { describe, expect, it } from "vitest";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import { Reasoner } from "../../services/reasoner";

async function stapel() {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService: ko as never,
    gaps: new InMemoryGapRepo(),
  });
  return { ko, ask };
}

const FRAGE = "Welche Temperatur gilt für das Ventil F3?";
const QUELLE = {
  type: "best_practice" as const,
  category: "Technik",
  author: "anna",
  title: "Ventil F3",
  statement: "Die Temperatur am Ventil F3 liegt bei 80 Grad.",
};

describe("R-0338 · Quellenstand am Fragedienst", () => {
  it("Q1 · für jede herangezogene Quelle genau die gelesene Fassung", async () => {
    const { ko, ask } = await stapel();
    const quelle = await ko.create(QUELLE);

    const out = await ask.ask(FRAGE, "nutzer-1", "de", { retrievalOnly: true });

    expect(out.result.answered).toBe(true);
    expect(out.result.sources).toEqual([quelle.id]);
    expect(out.quellenStand).toEqual({ [quelle.id]: quelle.version });
  });

  it("Q2 · nach einer Überarbeitung nennt die nächste Antwort die neue Fassung", async () => {
    const { ko, ask } = await stapel();
    const quelle = await ko.create(QUELLE);
    const vorher = await ask.ask(FRAGE, "nutzer-1", "de", { retrievalOnly: true });

    const neu = await ko.revise(
      quelle.id,
      { statement: "Die Temperatur am Ventil F3 liegt bei 85 Grad." },
      "anna",
    );
    const nachher = await ask.ask(FRAGE, "nutzer-1", "de", { retrievalOnly: true });

    expect(neu.version).toBeGreaterThan(quelle.version);
    expect(vorher.quellenStand).toEqual({ [quelle.id]: quelle.version });
    expect(nachher.quellenStand).toEqual({ [quelle.id]: neu.version });
  });
});
