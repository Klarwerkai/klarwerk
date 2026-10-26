// R-1373 / PL1a: runTask vergibt die Kennung vor dem ersten Versuch und behält sie in allen
// vorhandenen finalen Schreibwegen. Die Beobachtung liegt im Provider, die Prüfung danach:
// ein vom Reasoner abgefangener Providerfehler darf eine fehlgeschlagene Erwartung nicht verdecken.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import {
  KlaraAusweichwegGesperrtFehler,
  bindeAnbieter,
  imBindungsrahmen,
} from "../../services/reasoner/src/anbieterbindung";
import {
  ModelCapacityError,
  cappedModelClient,
} from "../../services/reasoner/src/model-concurrency";
import type { ModelClient } from "../../services/reasoner/src/provider-model";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

vi.mock("node:crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:crypto")>();
  return { ...original, randomUUID: vi.fn(original.randomUUID) };
});

const LAUF_ID = "11111111-1111-4111-8111-111111111111";
const SPAETERE_ID = "22222222-2222-4222-8222-222222222222";
const SATZ = "Der Druck wird vor dem Start geprüft.";
const VORSCHLAG = "Vor der Inbetriebnahme ist der Anlagendruck zu kontrollieren.";

afterEach(() => vi.restoreAllMocks());

async function aufbau(cloud: () => Promise<string>, lokal?: () => Promise<string>, roh = false) {
  const repo = new InMemoryModelRunRepo();
  const append = vi.spyOn(repo, "append");
  const starts: Array<{ kennungen: number; schreibvorgaenge: number }> = [];
  const vermerkeStart = () => {
    starts.push({
      kennungen: vi.mocked(randomUUID).mock.calls.length,
      schreibvorgaenge: append.mock.calls.length,
    });
  };
  const provider = (name: string, aufruf: () => Promise<string>) => {
    const client: ModelClient = {
      name,
      model: name,
      complete: aufruf,
    };
    const modell = new ModelProvider(
      roh
        ? client
        : cappedModelClient(client, { rejectsConfidential: name.startsWith("anthropic:") }),
    );
    const assist = modell.assistText.bind(modell);
    vi.spyOn(modell, "assistText").mockImplementation((...args) => {
      vermerkeStart();
      return assist(...args);
    });
    return modell;
  };
  const primary = provider("anthropic:pl1a", cloud);
  const reasoner = new Reasoner(
    primary,
    new DeterministicProvider(),
    repo,
    undefined,
    lokal ? provider("lokal:pl1a", lokal) : undefined,
  );
  await erteileKiFreigabe(reasoner);
  vi.mocked(randomUUID).mockReset().mockReturnValueOnce(LAUF_ID).mockReturnValue(SPAETERE_ID);
  return { reasoner, primary, repo, append, starts, vermerkeStart };
}

function startVorSchreiben(
  starts: Array<{ kennungen: number; schreibvorgaenge: number }>,
  n: number,
) {
  expect(starts).toEqual(Array.from({ length: n }, () => ({ kennungen: 1, schreibvorgaenge: 0 })));
  expect(randomUUID).toHaveBeenCalledTimes(1);
}

async function einzigerLauf(repo: InMemoryModelRunRepo) {
  const laeufe = await repo.recent(10);
  expect(laeufe).toHaveLength(1);
  expect(laeufe[0]?.id).toBe(LAUF_ID);
  return laeufe[0];
}

describe("R-1373 / PL1a: eine vorab gebildete Kennung je runTask-Lauf", () => {
  it("L1 · direkter Erfolg: ID steht vor dem Modellaufruf, genau ein finaler Write", async () => {
    const env = await aufbau(async () => VORSCHLAG);

    const ergebnis = await env.reasoner.assistText(SATZ, "de");

    expect(ergebnis.text).toBe(VORSCHLAG);
    startVorSchreiben(env.starts, 1);
    expect(env.append).toHaveBeenCalledTimes(1);
    expect((await einzigerLauf(env.repo))?.status).toBe("success");
  });

  it("L2 · Fehler, dann lokaler Erfolg: dieselbe ID für den Lauf mit zwei Versuchen", async () => {
    const env = await aufbau(
      async () => {
        throw new Error("Cloud nicht erreichbar");
      },
      async () => VORSCHLAG,
    );

    await env.reasoner.assistText(SATZ, "de");

    startVorSchreiben(env.starts, 2);
    expect(env.append).toHaveBeenCalledTimes(1);
    const lauf = await einzigerLauf(env.repo);
    expect(lauf?.status).toBe("success");
    expect(lauf?.fallback).toBe(true);
    expect(lauf?.versuche?.map((v) => v.ausgang)).toEqual(["fehler", "erfolg"]);
  });

  it("L3 · erschöpfte Kette: finaler Fehler behält die ID des ersten Versuchs", async () => {
    const env = await aufbau(async () => {
      throw new Error("Cloud nicht erreichbar");
    });

    await expect(env.reasoner.assistText(SATZ, "de")).rejects.toThrow();

    startVorSchreiben(env.starts, 1);
    expect(env.append).toHaveBeenCalledTimes(1);
    const lauf = await einzigerLauf(env.repo);
    expect(lauf?.status).toBe("error");
    expect(lauf?.versuche).toHaveLength(2);
  });

  for (const vorherigerVersuch of [false, true]) {
    it(`L4 · Kapazitätsabbruch, vorheriger Fehlversuch ${vorherigerVersuch}: ID und Fehler bleiben`, async () => {
      const fehler = new ModelCapacityError("Modell ausgelastet");
      const kapazitaet = async (): Promise<string> => {
        throw fehler;
      };
      const env = await aufbau(
        vorherigerVersuch
          ? async () => {
              throw new Error("Cloud nicht erreichbar");
            }
          : kapazitaet,
        vorherigerVersuch ? kapazitaet : undefined,
        true,
      );

      await expect(env.reasoner.assistText(SATZ, "de")).rejects.toBe(fehler);

      startVorSchreiben(env.starts, vorherigerVersuch ? 2 : 1);
      expect(env.append).toHaveBeenCalledTimes(1);
      expect((await einzigerLauf(env.repo))?.status).toBe("error");
    });
  }

  it("L5 · nicht freigegebener Ausweichweg: Sperrdatensatz trägt dieselbe ID", async () => {
    const env = await aufbau(async () => {
      throw new Error("Cloud nicht erreichbar");
    });

    await expect(
      imBindungsrahmen(() => {
        bindeAnbieter("anthropic");
        return env.reasoner.assistText(SATZ, "de");
      }),
    ).rejects.toBeInstanceOf(KlaraAusweichwegGesperrtFehler);

    startVorSchreiben(env.starts, 1);
    expect(env.append).toHaveBeenCalledTimes(1);
    const lauf = await einzigerLauf(env.repo);
    expect(lauf?.status).toBe("error");
    expect(lauf?.versuche).toHaveLength(1);
  });

  for (const ausgang of ["erfolg", "kapazitaet"] as const) {
    it(`L6 · Antwortreceipt, ${ausgang}: vorgegebene ID wird auch im Fehlerweg nicht ersetzt`, async () => {
      const env = await aufbau(async () => VORSCHLAG);
      const fehler = new ModelCapacityError("Modell ausgelastet");
      vi.spyOn(env.primary, "answer").mockImplementation(async () => {
        env.vermerkeStart();
        if (ausgang === "kapazitaet") throw fehler;
        return new DeterministicProvider().answer("Frage", [], "de");
      });

      const antwort = env.reasoner.answer("Frage", [], "de");
      if (ausgang === "kapazitaet") {
        await expect(antwort).rejects.toBe(fehler);
      } else {
        expect((await antwort).modelRunId).toBe(LAUF_ID);
      }

      startVorSchreiben(env.starts, 1);
      expect(env.append).toHaveBeenCalledTimes(1);
      expect((await einzigerLauf(env.repo))?.status).toBe(
        ausgang === "erfolg" ? "success" : "error",
      );
    });
  }

  it("L7 · fehlgeschlagener finaler Write: Ergebnis und eine Laufkennung bleiben, kein weiterer Modellversuch", async () => {
    const env = await aufbau(async () => VORSCHLAG);
    env.append.mockRejectedValueOnce(new Error("Speicher vorübergehend nicht erreichbar"));

    expect((await env.reasoner.assistText(SATZ, "de")).text).toBe(VORSCHLAG);

    startVorSchreiben(env.starts, 1);
    // Der eine Write scheiterte; das bezahlte gültige Ergebnis bleibt erhalten.
    expect(env.append.mock.calls.map(([lauf]) => lauf.id)).toEqual([LAUF_ID]);
    expect(env.append.mock.calls[0]?.[0].versuche).toHaveLength(1);
    expect(await env.repo.recent(10)).toEqual([]); // ehrlich: kein gespeicherter Lauf
  });
});
