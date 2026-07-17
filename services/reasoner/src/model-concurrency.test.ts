import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConfidentialEgressError,
  ModelCapacityError,
  ModelSemaphore,
  cappedModelClient,
  modelCapConfigFromEnv,
  resetModelSemaphoreForTests,
} from "./model-concurrency";
import { type ModelClient, ModelProvider } from "./provider-model";
import { Reasoner } from "./service";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setTimeout(r, 20));

describe("SCRUM-498 B2: ModelSemaphore", () => {
  it("erlaubt N gleichzeitig; der (N+1)-te wartet bis Freigabe (nie mehr als N aktiv)", async () => {
    const sem = new ModelSemaphore({ max: 2, queueMax: 10, acquireTimeoutMs: 1000 });
    const r1 = await sem.acquire();
    const r2 = await sem.acquire();
    expect(sem.activeCount).toBe(2);
    let third = false;
    const p3 = sem.acquire().then((r) => {
      third = true;
      return r;
    });
    await Promise.resolve();
    expect(third).toBe(false); // wartet, solange beide Slots belegt sind
    expect(sem.queuedCount).toBe(1);
    r1(); // ein Slot frei → an den Wartenden weitergereicht
    const r3 = await p3;
    expect(third).toBe(true);
    expect(sem.activeCount).toBe(2); // weiterhin genau N aktiv
    r2();
    r3();
    expect(sem.activeCount).toBe(0);
  });

  it("Warteschlange voll → sofort ModelCapacityError (kein unbounded Warten)", async () => {
    const sem = new ModelSemaphore({ max: 1, queueMax: 1, acquireTimeoutMs: 1000 });
    const r1 = await sem.acquire(); // aktiv
    const p2 = sem.acquire(); // wartet (queue = 1/1)
    await expect(sem.acquire()).rejects.toBeInstanceOf(ModelCapacityError); // Queue voll
    r1();
    await p2; // der Wartende bekommt den Slot
  });

  it("Acquire-Timeout → ModelCapacityError; der Wartende wird aus der Queue entfernt", async () => {
    const sem = new ModelSemaphore({ max: 1, queueMax: 5, acquireTimeoutMs: 30 });
    const r1 = await sem.acquire();
    await expect(sem.acquire()).rejects.toBeInstanceOf(ModelCapacityError);
    expect(sem.queuedCount).toBe(0);
    r1();
  });

  it("release ist idempotent (Doppel-Release verfälscht die Zählung nicht)", async () => {
    const sem = new ModelSemaphore({ max: 2, queueMax: 5, acquireTimeoutMs: 1000 });
    const r1 = await sem.acquire();
    r1();
    r1();
    expect(sem.activeCount).toBe(0);
  });
});

describe("SCRUM-498 B2: modelCapConfigFromEnv (env-tunable)", () => {
  it("Defaults 6/20/10000; env überschreibt; ungültig → Default", () => {
    expect(modelCapConfigFromEnv({})).toEqual({ max: 6, queueMax: 20, acquireTimeoutMs: 10_000 });
    expect(
      modelCapConfigFromEnv({
        KLARWERK_MODEL_MAX_INFLIGHT: "3",
        KLARWERK_MODEL_QUEUE_MAX: "5",
        KLARWERK_MODEL_ACQUIRE_TIMEOUT_MS: "200",
      }),
    ).toEqual({ max: 3, queueMax: 5, acquireTimeoutMs: 200 });
    expect(modelCapConfigFromEnv({ KLARWERK_MODEL_MAX_INFLIGHT: "0" }).max).toBe(6);
    expect(modelCapConfigFromEnv({ KLARWERK_MODEL_MAX_INFLIGHT: "abc" }).max).toBe(6);
  });
});

describe("SCRUM-498 B2: cappedModelClient (globaler Cap, env-tunable)", () => {
  beforeEach(() => {
    process.env.KLARWERK_MODEL_MAX_INFLIGHT = "2";
    resetModelSemaphoreForTests();
  });
  afterEach(() => {
    delete process.env.KLARWERK_MODEL_MAX_INFLIGHT;
    resetModelSemaphoreForTests();
  });

  it("kappt die Gleichzeitigkeit von complete() auf N (hier 2)", async () => {
    const state = { now: 0, max: 0 };
    const gate = deferred<void>();
    const inner: ModelClient = {
      name: "inner",
      async complete() {
        state.now += 1;
        state.max = Math.max(state.max, state.now);
        await gate.promise;
        state.now -= 1;
        return "x";
      },
    };
    const capped = cappedModelClient(inner, { rejectsConfidential: false });
    const calls = Array.from({ length: 5 }, () => capped.complete("s", "u", false));
    await tick();
    expect(state.max).toBe(2); // nie mehr als N gleichzeitig im inneren Client
    gate.resolve();
    await Promise.all(calls);
    expect(state.now).toBe(0);
  });

  it("gibt den Slot im Fehlerfall frei (kein Leak): danach laufen wieder N gleichzeitig", async () => {
    const boom: ModelClient = {
      name: "boom",
      async complete() {
        throw new Error("kaputt");
      },
    };
    await expect(
      cappedModelClient(boom, { rejectsConfidential: false }).complete("s", "u", false),
    ).rejects.toThrow("kaputt");
    // Beweis: beide Slots wieder frei → N=2 gleichzeitig möglich.
    const state = { now: 0, max: 0 };
    const gate = deferred<void>();
    const inner: ModelClient = {
      name: "inner",
      async complete() {
        state.now += 1;
        state.max = Math.max(state.max, state.now);
        await gate.promise;
        state.now -= 1;
        return "x";
      },
    };
    const capped = cappedModelClient(inner, { rejectsConfidential: false });
    const calls = [capped.complete("s", "u", false), capped.complete("s", "u", false)];
    await tick();
    expect(state.max).toBe(2);
    gate.resolve();
    await Promise.all(calls);
  });
});

describe("SCRUM-498 B2: Reasoner reicht ModelCapacityError durch (kein Fallback/kein null)", () => {
  const throwing: ModelClient = {
    name: "cap",
    async complete() {
      throw new ModelCapacityError("Modell ausgelastet.");
    },
  };
  // answer() befragt das Modell NUR mit belastbarem Kontext (FR-RSN-03) — daher eine Quelle mit
  // Token-Überschneidung zur Frage, sonst kürzt der Provider vor dem Modellaufruf ab.
  const KNOWLEDGE = [
    {
      id: "k1",
      title: "Pumpe entlüften",
      statement: "Pumpe nach dem Anfahren entlüften.",
      status: "validiert" as const,
      trust: 80,
    },
  ];

  it("judgeDuplicate → ModelCapacityError (nicht still null)", async () => {
    const reasoner = new Reasoner(new ModelProvider(throwing));
    await expect(reasoner.judgeDuplicate("a", "b")).rejects.toBeInstanceOf(ModelCapacityError);
  });

  it("answer → ModelCapacityError (nicht deterministischer Fallback)", async () => {
    const reasoner = new Reasoner(new ModelProvider(throwing));
    await expect(reasoner.answer("Wie entlüfte ich die Pumpe?", KNOWLEDGE)).rejects.toBeInstanceOf(
      ModelCapacityError,
    );
  });

  it("beide Pfade (answer + judgeDuplicate) laufen durch client.complete (denselben Cap)", async () => {
    const seen: string[] = [];
    const client: ModelClient = {
      name: "spy",
      async complete() {
        seen.push("call");
        return "{}";
      },
    };
    const reasoner = new Reasoner(new ModelProvider(client));
    await reasoner.judgeDuplicate("a", "b").catch(() => undefined);
    await reasoner.answer("Wie entlüfte ich die Pumpe?", KNOWLEDGE).catch(() => undefined);
    expect(seen.length).toBeGreaterThanOrEqual(2);
  });
});

// SCRUM-502 Schicht 2: das Chokepoint-Sicherheitsnetz. Der CLOUD-Wrapper (rejectsConfidential)
// verweigert vertraulichen Text per Konstruktion — der Aufruf erreicht den echten Client NIE.
describe("SCRUM-502 Schicht 2: cappedModelClient-Egress-Wächter", () => {
  it("Cloud-Wrapper (rejectsConfidential) wirft bei confidential=true, OHNE inner.complete zu rufen", async () => {
    let innerCalled = false;
    const inner: ModelClient = {
      name: "cloud",
      async complete() {
        innerCalled = true;
        return "darf nie laufen";
      },
    };
    const cloud = cappedModelClient(inner, { rejectsConfidential: true });
    await expect(cloud.complete("s", "u", true)).rejects.toBeInstanceOf(ConfidentialEgressError);
    expect(innerCalled).toBe(false);
  });

  it("Cloud-Wrapper lässt nicht-vertrauliche Aufrufe normal durch", async () => {
    const inner: ModelClient = {
      name: "cloud",
      async complete() {
        return "ok";
      },
    };
    const cloud = cappedModelClient(inner, { rejectsConfidential: true });
    expect(await cloud.complete("s", "u", false)).toBe("ok");
  });

  it("lokaler Wrapper (ohne rejectsConfidential) bedient vertrauliche Inhalte weiter", async () => {
    let seen: boolean | undefined;
    const inner: ModelClient = {
      name: "local",
      async complete(_s, _u, confidential) {
        seen = confidential;
        return "lokal-ok";
      },
    };
    const local = cappedModelClient(inner, { rejectsConfidential: false });
    expect(await local.complete("s", "u", true)).toBe("lokal-ok");
    expect(seen).toBe(true); // confidential wird durchgereicht, aber NICHT abgelehnt
  });
});
