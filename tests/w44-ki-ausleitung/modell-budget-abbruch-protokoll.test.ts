import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAiCheckWorker } from "../../services/app/src/ai-check-worker";
import { registriereKiAnfragebremse } from "../../services/app/src/ki-anfragebremse";
import { type ModelRunRecord, ProtokollModelRunRepo } from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import {
  ModelBudgetError,
  ModelCallBudget,
  cappedModelClient,
  meldeModellVerbrauch,
  mitModellKontext,
  resetModelBudgetForTests,
  resetModelSemaphoreForTests,
} from "../../services/reasoner/src/model-concurrency";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
beforeEach(() => {
  resetModelBudgetForTests();
  resetModelSemaphoreForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  resetModelBudgetForTests();
  resetModelSemaphoreForTests();
});
describe("W4.4 tatsächliche Modellübertragung", () => {
  it("isoliert echte HTTP-Konten auch außerhalb der alten Routenliste und ignoriert behauptete Akteure", async () => {
    const app = Fastify();
    let calls = 0;
    const client = cappedModelClient(
      {
        name: "lokal:attrappe",
        complete: async () => {
          calls++;
          return "ok";
        },
      },
      { rejectsConfidential: false },
    );
    registriereKiAnfragebremse(app, {
      grenze: null,
      authenticate: async (token) =>
        token === "anna" ? { id: "konto-A" } : token === "bert" ? { id: "konto-B" } : undefined,
    });
    app.post("/ausgelassener-modellweg", async () => ({
      result: await client.complete("system", "legitimer Text", false),
    }));
    const request = (token: string, actor: string) =>
      app.inject({
        method: "POST",
        url: "/ausgelassener-modellweg",
        headers: { authorization: `Bearer ${token}`, "x-user-id": actor },
        payload: { actor, kontoId: actor },
      });
    try {
      for (let i = 0; i < 30; i++)
        expect((await request("anna", `fake-${i}`)).statusCode).toBe(200);
      expect((await request("anna", "bert")).statusCode).toBe(500);
      expect(calls).toBe(30);
      expect((await request("bert", "anna")).statusCode).toBe(200);
      expect(calls).toBe(31);
    } finally {
      await app.close();
    }
  });
  it("hat endliche Bibliotheks- und Globalgrenzen; Fensterablauf gibt Speicher und Budget frei", () => {
    let now = 1000;
    const b = new ModelCallBudget(() => now);
    for (let i = 0; i < 120; i++) b.consume(undefined);
    expect(() => b.consume(undefined)).toThrow(ModelBudgetError);
    for (let i = 0; i < 480; i++) b.consume(`konto-${i}`);
    expect(() => b.consume("neu")).toThrow(ModelBudgetError);
    expect(b.size).toBe(480);
    now += 60000;
    b.consume("neu");
    expect(b.size).toBe(1);
    for (let i = 1; i < 30; i++) b.consume("neu");
    expect(() => b.consume("neu")).toThrow(ModelBudgetError);
    now += 60000;
    expect(() => b.consume("neu")).not.toThrow();
  });
  it("zählt auch Vision und behält ein unkooperatives Provider-Slot bis zum inneren Ende", async () => {
    let finish: (s: string) => void = () => {};
    let seen: AbortSignal | undefined;
    const c = cappedModelClient(
      {
        name: "lokal:fake",
        complete: async (_s, _u, _c, _m, signal) => {
          seen = signal;
          return new Promise<string>((r) => {
            finish = r;
          });
        },
        completeVision: async () => "bild",
      },
      { rejectsConfidential: false },
    );
    for (let i = 0; i < 29; i++)
      await mitModellKontext({ actor: "A" }, () =>
        c.completeVision?.("s", "u", "data:image/png;base64,AA==", false),
      );
    const ac = new AbortController();
    const pending = mitModellKontext({ actor: "A", signal: ac.signal }, () =>
      c.complete("s", "u", false),
    );
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await tick();
    expect(seen).toBe(ac.signal);
    ac.abort();
    let ended = false;
    void pending
      .catch(() => {})
      .finally(() => {
        ended = true;
      });
    await tick();
    expect(ended).toBe(false);
    finish("spätes Ergebnis");
    await rejected;
    await expect(
      mitModellKontext({ actor: "A" }, () => c.complete("s", "u", false)),
    ).rejects.toBeInstanceOf(ModelBudgetError);
  });
  it("liefert gültiges Modellresultat trotz append-Fehler ohne zweiten Provider und mit ehrlichen Laufmetadaten", async () => {
    let cloud = 0;
    let local = 0;
    const records: ModelRunRecord[] = [];
    const response = JSON.stringify({
      title: "Pumpe",
      statement: "Alle 200 Stunden schmieren.",
      conditions: [],
      measures: [],
      tags: [],
      confidence: 0.9,
    });
    const r = new Reasoner(
      new ModelProvider(
        cappedModelClient(
          {
            name: "anthropic:attrappe",
            model: "fake",
            complete: async () => {
              cloud++;
              meldeModellVerbrauch(23, 5);
              return response;
            },
          },
          { rejectsConfidential: true },
        ),
      ),
      new DeterministicProvider(),
      new ProtokollModelRunRepo(
        {
          append: async (row: ModelRunRecord) => {
            records.push(row);
            throw new Error("Speicher ausgefallen");
          },
          recent: async () => [],
        },
        {
          waehrung: "EUR",
          preisstand: "fiktiv-2026-10-26",
          modelle: { fake: { eingabeJeMillion: 2, ausgabeJeMillion: 4 } },
        },
      ),
      undefined,
      new ModelProvider(
        cappedModelClient(
          {
            name: "lokal:attrappe",
            complete: async () => {
              local++;
              return response;
            },
          },
          { rejectsConfidential: false },
        ),
      ),
    );
    await erteileKiFreigabe(r);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await r.structure("Alle 200 Stunden schmieren.", "de");
    expect(out.demo).toBe(false);
    expect(cloud).toBe(1);
    expect(local).toBe(0);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      status: "success",
      provider: "anthropic:attrappe",
      demo: false,
      fallback: false,
      model: "fake",
      verbrauch: { eingabeToken: 23, ausgabeToken: 5 },
      kosten: { waehrung: "EUR", preisstand: "fiktiv-2026-10-26" },
    });
    expect(records[0]?.kosten?.betrag).toBeCloseTo(0.000066, 10);
    expect(records[0]?.versuche).toHaveLength(1);
    expect(records[0]?.versuche?.[0]?.ausgang).toBe("erfolg");
    expect(records[0]?.id).toBeTruthy();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Laufprotokoll"));
  });

  it("ein Protokollfehler verändert weder ursprünglichen Modellfehler noch dessen Ersatz-/Versuchsmetadaten", async () => {
    const run = async (speicherFehlt: boolean) => {
      let calls = 0;
      const records: ModelRunRecord[] = [];
      const r = new Reasoner(
        new ModelProvider(
          cappedModelClient(
            {
              name: "anthropic:attrappe",
              model: "fake",
              complete: async () => {
                calls++;
                meldeModellVerbrauch(7, 2);
                throw new Error("Fiktive Modellstörung");
              },
            },
            { rejectsConfidential: true },
          ),
        ),
        new DeterministicProvider(),
        {
          append: async (row: ModelRunRecord) => {
            records.push(row);
            if (speicherFehlt) throw new Error("Fiktiver DB-Ausfall");
          },
          recent: async () => [],
        },
      );
      await erteileKiFreigabe(r);
      let error: unknown;
      try {
        await r.assistText("Legitimer unveränderter Text.", "de");
      } catch (e) {
        error = e;
      }
      expect(calls).toBe(1);
      expect(records).toHaveLength(1);
      const row = records[0];
      if (!row) throw new Error("Lauf fehlt");
      return {
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
        metadata: {
          task: row.task,
          provider: row.provider,
          status: row.status,
          demo: row.demo,
          fallback: row.fallback,
          error: row.error,
          verbrauch: row.verbrauch,
          versuche: row.versuche?.map((v) => ({
            provider: v.provider,
            ausgang: v.ausgang,
            verbrauch: v.verbrauch,
          })),
        },
      };
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const normal = await run(false);
    const defekt = await run(true);
    expect(defekt).toEqual(normal);
    expect(defekt.metadata.status).toBe("error");
    expect(defekt.metadata.error).not.toContain("DB-Ausfall");
  });

  it("sendet das Worker-Abbruchsignal und startet ohne Ende des inneren Jobs keinen Nachfolger", async () => {
    let finish: () => void = () => {};
    let received: AbortSignal | undefined;
    let calls = 0;
    const ko = {
      get: async () => undefined,
      aktuellePruefbasis: async () => ({ quelle: "q", kontext: "k", bestand: "b" }),
      resolveAiCheck: async () => true,
      markAiCheckPending: async () => undefined,
    };
    const w = createAiCheckWorker({
      ko: ko as never,
      jobTimeoutMs: 15,
      log: () => {},
      run: async (_id, _u, signal) => {
        calls++;
        received = signal;
        await new Promise<void>((r) => {
          finish = r;
        });
        return { ok: true };
      },
    });
    w.enqueue("a", 1);
    w.enqueue("b", 1);
    await tick(40);
    expect(received?.aborted).toBe(true);
    expect(calls).toBe(1);
    expect(w.queuedCount()).toBe(2);
    finish();
    await tick(10);
    expect(calls).toBe(2);
    finish();
    await w.idle();
  });
  it("kooperativer Modelltransport endet auf das echte Worker-Signal; der Nachfolger startet erst danach", async () => {
    let active = 0;
    let max = 0;
    const events: string[] = [];
    const signals: AbortSignal[] = [];
    const client = cappedModelClient(
      {
        name: "lokal:kooperativ",
        complete: async (_s, _u, _c, _m, signal) => {
          if (!signal) throw new Error("Abbruchsignal fehlt");
          const id = signals.length + 1;
          signals.push(signal);
          active++;
          max = Math.max(max, active);
          events.push(`start-${id}`);
          return new Promise<string>((_resolve, reject) =>
            signal.addEventListener(
              "abort",
              () => {
                active--;
                events.push(`ende-${id}`);
                reject(new DOMException("Abgebrochen", "AbortError"));
              },
              { once: true },
            ),
          );
        },
      },
      { rejectsConfidential: false },
    );
    const ko = {
      get: async () => undefined,
      aktuellePruefbasis: async () => ({ quelle: "q", kontext: "k", bestand: "b" }),
      resolveAiCheck: async () => true,
      markAiCheckPending: async () => undefined,
    };
    const worker = createAiCheckWorker({
      ko: ko as never,
      jobTimeoutMs: 15,
      log: () => {},
      run: async () => {
        await client.complete("s", "legitimer Text", false);
        return { ok: true };
      },
    });
    worker.enqueue("a", 1);
    worker.enqueue("b", 1);
    await worker.idle();
    expect(events).toEqual(["start-1", "ende-1", "start-2", "ende-2"]);
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(max).toBe(1);
    expect(active).toBe(0);
  });
});
