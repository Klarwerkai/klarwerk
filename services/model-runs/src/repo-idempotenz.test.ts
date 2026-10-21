import { describe, expect, it } from "vitest";
import { InMemoryModelRunRepo } from "./repo";
import type { ModelRunRecord, ModelRunVersuch } from "./types";

function versuch(
  ausgang: ModelRunVersuch["ausgang"],
  token: number,
  startedAt: string,
): ModelRunVersuch {
  return {
    provider: "local:test",
    model: "test",
    startedAt,
    dauerMs: 100,
    ausgang,
    aufrufe: 1,
    verbrauch: { eingabeToken: token, ausgabeToken: 2, gemeldeteAufrufe: 1 },
    spanId: "versuch-test",
  };
}

function record(over: Partial<ModelRunRecord> = {}): ModelRunRecord {
  return {
    id: "lauf-1",
    task: "assist",
    provider: "local:test",
    model: "test",
    demo: false,
    fallback: false,
    locale: "de",
    startedAt: "2026-10-21T10:00:00.000Z",
    finishedAt: "2026-10-21T10:00:00.100Z",
    status: "success",
    actor: "actor-erster",
    subject: { kind: "ko", id: "ko-erster" },
    verbrauch: { eingabeToken: 5, ausgabeToken: 2, gemeldeteAufrufe: 1 },
    versuche: [versuch("erfolg", 5, "2026-10-21T10:00:00.000Z")],
    ...over,
  };
}

describe("PL5: InMemory behält den ersten Lauf je exakter ID", () => {
  it("success bleibt vollständig trotz späterem error mit anderem Kontext", async () => {
    const repo = new InMemoryModelRunRepo();
    const erster = record();
    const zweiter = record({
      status: "error",
      error: "metadaten-fehler",
      actor: "actor-zweiter",
      subject: { kind: "ko", id: "ko-zweiter" },
      startedAt: "2026-10-21T12:00:00.000Z",
      finishedAt: "2026-10-21T12:00:00.100Z",
      verbrauch: { eingabeToken: 50, ausgabeToken: 2, gemeldeteAufrufe: 1 },
      versuche: [versuch("fehler", 50, "2026-10-21T12:00:00.000Z")],
    });
    await repo.append(erster);
    await repo.append(zweiter);

    expect(await repo.recent()).toStrictEqual([erster]);
    expect(
      await repo.zwischen("2026-10-21T10:00:00.000Z", "2026-10-21T11:00:00.000Z", 10),
    ).toStrictEqual([erster]);
    expect(
      await repo.zwischen("2026-10-21T12:00:00.000Z", "2026-10-21T13:00:00.000Z", 10),
    ).toStrictEqual([]);
    expect(await repo.vonAkteur("actor-erster")).toStrictEqual([erster]);
    expect(await repo.vonAkteur("actor-zweiter")).toStrictEqual([]);
  });

  it("error bleibt bei paralleler success-Kopie; andere ID bleibt separat", async () => {
    const repo = new InMemoryModelRunRepo();
    const erster = record({
      id: "parallel",
      status: "error",
      error: "metadaten-fehler",
      versuche: [versuch("fehler", 5, "2026-10-21T10:00:00.000Z")],
    });
    const kopie = record({
      id: "parallel",
      actor: "actor-retry",
      subject: { kind: "ko", id: "ko-retry" },
      startedAt: "2026-10-21T13:00:00.000Z",
      finishedAt: "2026-10-21T13:00:00.100Z",
      versuche: [versuch("erfolg", 5, "2026-10-21T13:00:00.000Z")],
    });
    const anderer = record({
      id: "PARALLEL",
      startedAt: "2026-10-21T11:00:00.000Z",
      finishedAt: "2026-10-21T11:00:00.100Z",
      versuche: [versuch("erfolg", 5, "2026-10-21T11:00:00.000Z")],
    });
    await repo.append(erster);
    await Promise.all([repo.append(kopie), repo.append(anderer)]);

    expect(await repo.recent()).toStrictEqual([anderer, erster]);
    expect(await repo.recent(1)).toStrictEqual([anderer]);
    expect(
      await repo.zwischen("2026-10-21T10:00:00.000Z", "2026-10-21T12:00:00.000Z", 10),
    ).toStrictEqual([anderer, erster]);
    expect(await repo.vonAkteur("actor-erster")).toStrictEqual([erster, anderer]);
    expect(await repo.vonAkteur("actor-retry")).toStrictEqual([]);
  });
});
