// WP-SHIP8-FINAL (bens sammel23, Bedingung 2): aiCheck-Jobs HART an die Inhaltsversion binden
// und begrenzen. Gepinnt wird:
//  (a) revise WAEHREND eines laufenden Jobs → der alte Lauf ist ein No-op (bedingter Write greift
//      nicht), der Worker reiht einmalig einen FRISCHEN Job fuer die neue Version ein — das
//      Endergebnis traegt die neue Version (stale-done unmoeglich),
//  (b) bens Befund "Modellfehler als done": ein GENERISCHER Judge-Fehler (den die detect*-Kerne
//      intern schlucken) wird ueber die Judge-Beobachtung des Runners ehrlich failed/model-error,
//  (c) Queue-Kappe: ueber MAX_AI_CHECK_QUEUE wird der aelteste wartende Job ehrlich als
//      failed/queue-overflow markiert statt still zu wachsen,
//  (d) Job-Timeout: ein haengender Lauf endet nach der Frist als failed/timeout,
//  (e) Retry-Deckel: max MAX_AI_CHECK_AUTO_RETRIES automatische Re-Enqueues je KO-Version.
import { describe, expect, it } from "vitest";
import {
  AI_CHECK_JOB_TIMEOUT_MS,
  MAX_AI_CHECK_AUTO_RETRIES,
  MAX_AI_CHECK_QUEUE,
  createAiCheckWorker,
} from "../../services/app/src/ai-check-worker";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";

type Reasoner = AppServices["reasoner"];

async function appWithUser(mutate?: (services: AppServices) => void) {
  const services = buildServices();
  mutate?.(services);
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "p@x.de", password: "secret123" },
  });
  const userId = (login.json() as { user: { id: string } }).user.id;
  return { app, services, userId, headers: { authorization: `Bearer ${login.json().token}` } };
}

async function createKo(
  app: Awaited<ReturnType<typeof appWithUser>>["app"],
  headers: Record<string, string>,
  title: string,
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: { title, statement: `Aussage zu ${title}`, type: "best_practice", category: "K" },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as { id: string };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

describe("WP-SHIP8-FINAL (a): revise waehrend laufendem Job → alter Lauf No-op + frischer Job fuer die neue Version", () => {
  it("das Endergebnis traegt die NEUE Version — kein stale-done des alten Laufs", async () => {
    // Steuerbarer Judge: der erste Prüf-Lauf haengt am Gate, bis der Test revidiert hat.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let judgeCalls = 0;
    const judge = async (): Promise<null> => {
      judgeCalls += 1;
      await gate;
      return null;
    };
    const { app, services, userId, headers } = await appWithUser((s) => {
      s.reasoner = {
        status: () => ({ active: true, provider: "fake-model", mode: "model" }),
        judgeConflict: judge,
        judgeDuplicate: judge,
      } as unknown as Reasoner;
    });
    await createKo(app, headers, "Bestand"); // Pool leer → laeuft ohne Judge durch
    await services.aiCheckWorker?.idle();
    const created = await createKo(app, headers, "Neuer Beitrag");
    // Warten, bis der Job WIRKLICH laeuft (der Judge haengt am Gate) …
    while (judgeCalls === 0) {
      await tick();
    }
    // … dann WAEHREND des Laufs revidieren (Version 1 → 2).
    await services.ko.revise(created.id, { title: "Revidierter Beitrag" }, userId);
    release();
    await services.aiCheckWorker?.idle();
    const stored = await services.ko.get(created.id);
    expect(stored?.version).toBe(2);
    // Der alte Lauf (Version 1) hat NICHT geschrieben; der frische Lauf traegt die neue Version.
    expect(stored?.aiCheck?.status).toBe("done");
    expect(stored?.aiCheck?.koVersion).toBe(2);
    expect(stored?.title).toBe("Revidierter Beitrag");
  });
});

describe("WP-SHIP8-FINAL (b): bens Befund — Modellfehler wird NIE zu done", () => {
  it("GENERISCHER Judge-Fehler (vom Konflikt-Kern intern geschluckt) → ehrlich failed/model-error", async () => {
    const { app, services, headers } = await appWithUser((s) => {
      // Bewusst ein GEWOEHNLICHER Error (kein ModelCapacityError): der Konflikt-Kern schluckt ihn
      // in seinem judge-catch — genau der Fall, der vorher als done durchrutschte.
      s.reasoner = {
        status: () => ({ active: true, provider: "fake-model", mode: "model" }),
        judgeConflict: async () => {
          throw new Error("Modell kaputt");
        },
        judgeDuplicate: async () => {
          throw new Error("Modell kaputt");
        },
      } as unknown as Reasoner;
    });
    await createKo(app, headers, "Bestand");
    await services.aiCheckWorker?.idle();
    const created = await createKo(app, headers, "Neuer Beitrag");
    await services.aiCheckWorker?.idle();
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("failed");
    expect(stored?.aiCheck?.fallbackReason).toBe("model-error");
  });
});

describe("WP-SHIP8-FINAL (c+d+e): harte Grenzen — Queue-Kappe, Job-Timeout, Retry-Deckel", () => {
  interface ResolveCall {
    id: string;
    reason: string | undefined;
  }

  it("(c) Queue-Kappe: ueber MAX_AI_CHECK_QUEUE wird der AELTESTE wartende Job ehrlich failed/queue-overflow", async () => {
    expect(MAX_AI_CHECK_QUEUE).toBe(200);
    const resolved: ResolveCall[] = [];
    const fakeKo = {
      get: async () => undefined,
      markAiCheckPending: async () => true,
      resolveAiCheck: async (id: string, patch: { fallbackReason?: string }) => {
        resolved.push({ id, reason: patch.fallbackReason });
        return true;
      },
    } as unknown as AppServices["ko"];
    const worker = createAiCheckWorker({
      ko: fakeKo,
      // Der erste Job blockiert den EINEN Slot — alles Weitere staut in der Queue.
      run: (koId) =>
        koId === "job-running" ? new Promise(() => {}) : Promise.resolve({ ok: true }),
      log: () => {},
    });
    worker.enqueue("job-running");
    await tick(); // der Job belegt jetzt den Slot
    for (let i = 0; i < MAX_AI_CHECK_QUEUE; i += 1) {
      worker.enqueue(`job-${i}`);
    }
    expect(worker.queuedCount()).toBe(MAX_AI_CHECK_QUEUE + 1); // 200 wartend + 1 laufend
    worker.enqueue("job-zuviel");
    // Der AELTESTE wartende (job-0) wurde verdraengt und ehrlich markiert.
    expect(resolved).toContainEqual({ id: "job-0", reason: "queue-overflow" });
    expect(worker.has("job-0")).toBe(false);
    expect(worker.has("job-zuviel")).toBe(true);
    expect(worker.queuedCount()).toBe(MAX_AI_CHECK_QUEUE + 1); // Kappe haelt
  });

  it("(d) Job-Timeout: ein haengender Lauf endet nach der Frist ehrlich als failed/timeout", async () => {
    expect(AI_CHECK_JOB_TIMEOUT_MS).toBe(120_000);
    const resolved: ResolveCall[] = [];
    const fakeKo = {
      get: async () => undefined,
      markAiCheckPending: async () => true,
      resolveAiCheck: async (id: string, patch: { fallbackReason?: string }) => {
        resolved.push({ id, reason: patch.fallbackReason });
        return true;
      },
    } as unknown as AppServices["ko"];
    const worker = createAiCheckWorker({
      ko: fakeKo,
      run: () => new Promise(() => {}), // haengt fuer immer
      log: () => {},
      jobTimeoutMs: 20, // Frist injiziert (Konstante oben gepinnt)
    });
    worker.enqueue("ko-haengt");
    await worker.idle();
    expect(resolved).toEqual([{ id: "ko-haengt", reason: "timeout" }]);
  });

  it("(e) Retry-Deckel: max 2 automatische Re-Enqueues je KO-Version, danach Ruhe (manueller Retry bleibt)", async () => {
    expect(MAX_AI_CHECK_AUTO_RETRIES).toBe(2);
    let marks = 0;
    let runs = 0;
    const fakeKo = {
      // Dauerhafter Versions-Konflikt: der Vermerk traegt Version 1, das KO steht auf 2.
      get: async () => ({
        version: 2,
        aiCheck: { status: "pending", requestedAt: "2026-07-22T06:00:00.000Z", koVersion: 1 },
      }),
      markAiCheckPending: async () => {
        marks += 1;
        return true;
      },
      resolveAiCheck: async () => false, // bedingter Write greift nie
    } as unknown as AppServices["ko"];
    const worker = createAiCheckWorker({
      ko: fakeKo,
      run: async () => {
        runs += 1;
        return { ok: true };
      },
      log: () => {},
    });
    worker.enqueue("ko-loop");
    await worker.idle();
    // 1 Erstlauf + 2 automatische Re-Enqueues, dann stoppt der Deckel den Loop.
    expect(runs).toBe(1 + MAX_AI_CHECK_AUTO_RETRIES);
    expect(marks).toBe(MAX_AI_CHECK_AUTO_RETRIES);
  });
});
