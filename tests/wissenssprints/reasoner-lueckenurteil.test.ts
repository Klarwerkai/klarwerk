// ================================================================================================
// R-1657 (ROADMAP 9.3) · Nacharbeit 2 — „LÜCKENERKENNUNG ÜBER REASONER", AM ECHTEN REASONER GEMESSEN.
// ================================================================================================
//
// Ben (nacharbeit-2): die feste Regel allein setzt „über Reasoner" nicht um. Diese Datei belegt den
// Reasoner-Weg `judgeKnowledgeGapsOutcome`:
//   G1  ein Modell urteilt über die Kennzahlen je Bereich; hinaus gehen NUR Name und Zähler; das
//       Urteil wird gelesen; genau ein Lauf `gaps` steht im Protokoll (ohne Inhalt)
//   G2  das Modell kann nichts erfinden: unbekannter Bereich, nicht gedeckter Grund, Sprint ohne
//       Grund und doppelter Eintrag fallen weg; die Tage werden auf 1–5 geklemmt
//   G3  unverwertbare Antwort ⇒ kein Urteil, Ursache model-error, Lauf error
//   G4  vertraulich + nur Cloud ⇒ das Modell sieht NICHTS, Ursache confidential
//   G5  ohne Modell ⇒ Ursache no-model, kein Lauf
import { describe, expect, it } from "vitest";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import { cappedModelClient } from "../../services/reasoner/src/model-concurrency";
import { type ModelClient, parseLueckenResponse } from "../../services/reasoner/src/provider-model";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import type { LueckenBereich } from "../../services/reasoner/src/types";

const SCHWEISSEN: LueckenBereich = {
  bereich: "Schweißtechnik",
  objekte: 30,
  validiert: 20,
  mittleresVertrauen: 72,
  imKonflikt: 4,
  revalidierung: 12,
  geringesVertrauen: 0,
};
const MONTAGE: LueckenBereich = {
  bereich: "Montage",
  objekte: 5,
  validiert: 5,
  mittleresVertrauen: 90,
  imKonflikt: 0,
  revalidierung: 0,
  geringesVertrauen: 0,
};

function modell(antwort: string, gesehen: string[]): ModelClient {
  return cappedModelClient(
    {
      name: "anthropic:test-modell",
      model: "test-modell",
      complete: async (_system: string, user: string) => {
        gesehen.push(user);
        return antwort;
      },
    },
    { rejectsConfidential: true },
  );
}

async function aufbau(client: ModelClient | undefined) {
  const repo = new InMemoryModelRunRepo();
  const reasoner = new Reasoner(
    client ? new ModelProvider(client) : undefined,
    new DeterministicProvider(),
    repo,
  );
  await erteileKiFreigabe(reasoner);
  return { reasoner, repo };
}

describe("R-1657 · Lückenerkennung über den Reasoner", () => {
  it("G1 · das Modell urteilt über Kennzahlen; hinaus gehen nur Name und Zähler; ein Lauf `gaps`", async () => {
    const gesehen: string[] = [];
    const urteile = [
      {
        bereich: "Schweißtechnik",
        sprint: true,
        tage: 2,
        schwerpunkte: ["conflicts", "revalidation"],
      },
      { bereich: "Montage", sprint: false, tage: 1, schwerpunkte: [] },
    ];
    const { reasoner, repo } = await aufbau(modell(JSON.stringify({ bereiche: urteile }), gesehen));

    const ausgang = await reasoner.judgeKnowledgeGapsOutcome([SCHWEISSEN, MONTAGE], "de", false);

    expect(ausgang.urteile).toEqual(urteile);
    expect(ausgang.provider).toBeTruthy();
    // Genau die Kennzahlen gingen hinaus — keine weiteren Felder.
    expect(gesehen).toHaveLength(1);
    expect(JSON.parse(gesehen[0] ?? "")).toEqual({ bereiche: [SCHWEISSEN, MONTAGE] });
    const laeufe = await repo.recent(10);
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0]?.task).toBe("gaps");
    expect(laeufe[0]?.status).toBe("success");
    expect(laeufe[0]?.erzeugt).toEqual({ art: "urteil", anzahl: 2 });
    expect(JSON.stringify(laeufe[0])).not.toContain("Schweißtechnik");
  });

  it("G2 · das Modell kann nichts erfinden: Bereich, Grund, Sprint ohne Grund, Doppel, Tage", () => {
    const roh = `Hier das Urteil: ${JSON.stringify({
      bereiche: [
        { bereich: "Erfunden", sprint: true, tage: 2, schwerpunkte: ["lowTrust"] },
        // „lowTrust" ist durch die Zahlen nicht gedeckt (geringesVertrauen 0) und fällt weg.
        {
          bereich: "Schweißtechnik",
          sprint: true,
          tage: 9,
          schwerpunkte: ["conflicts", "lowTrust"],
        },
        { bereich: "Schweißtechnik", sprint: false, tage: 1, schwerpunkte: [] },
        // Ein Sprint, dessen einziger Grund nicht gedeckt ist, ist kein Sprint.
        { bereich: "Montage", sprint: true, tage: 1, schwerpunkte: ["conflicts"] },
      ],
    })}`;

    expect(parseLueckenResponse(roh, [SCHWEISSEN, MONTAGE])).toEqual([
      { bereich: "Schweißtechnik", sprint: true, tage: 5, schwerpunkte: ["conflicts"] },
    ]);
    expect(parseLueckenResponse("kein JSON", [SCHWEISSEN])).toBeNull();
    expect(parseLueckenResponse('{"anders":[]}', [SCHWEISSEN])).toBeNull();
  });

  it("G3 · unverwertbare Antwort ⇒ kein Urteil, Ursache model-error, Lauf error", async () => {
    const { reasoner, repo } = await aufbau(modell("kein Urteil", []));

    const ausgang = await reasoner.judgeKnowledgeGapsOutcome([SCHWEISSEN], "de", false);

    expect(ausgang.urteile).toBeNull();
    expect(ausgang.failure).toBe("model-error");
    const laeufe = await repo.recent(10);
    expect(laeufe.map((l) => [l.task, l.status])).toEqual([["gaps", "error"]]);
  });

  it("G4 · vertraulich + nur Cloud ⇒ das Modell sieht nichts, Ursache confidential", async () => {
    const gesehen: string[] = [];
    const { reasoner } = await aufbau(modell('{"bereiche":[]}', gesehen));

    const ausgang = await reasoner.judgeKnowledgeGapsOutcome([SCHWEISSEN], "de", true);

    expect(gesehen).toEqual([]);
    expect(ausgang).toEqual({ urteile: null, failure: "confidential" });
  });

  it("G5 · ohne Modell ⇒ Ursache no-model und kein Lauf", async () => {
    const { reasoner, repo } = await aufbau(undefined);

    const ausgang = await reasoner.judgeKnowledgeGapsOutcome([SCHWEISSEN], "de", false);

    expect(ausgang).toEqual({ urteile: null, failure: "no-model" });
    expect(await repo.recent(10)).toEqual([]);
  });
});
