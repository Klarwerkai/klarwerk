// WP-SHIP8-CLOSE (bens F1 + F3): die letzten Ship-8-Restblocker am aiCheck.
//
// F1 (PRODUKTIONSNAH, bens Testauflage): ECHTER Reasoner (kein Fake-Reasoner) + echter
// ModelProvider mit Fake-CLIENT — genau der reale Fehlerfluss, in dem der Reasoner vor F1
// normale Provider-/HTTP-/Netz-/Parsefehler intern zu null verschluckte (der aiCheck-Wrapper sah
// nur werfende Fehler und meldete done). Gepinnt: (a) HTTP-Fehler → failed/model-error,
// (b) Modell-Timeout → failed/model-timeout, (c) unparsebarer Output → failed/model-error —
// NIE done; Gegenprobe (d): sauberer Provider → done.
//
// F3: die Queue-Overflow-Eviction schließt VERSIONSBEWUSST ab (resolveAiCheck mit der beim
// Einreihen erwarteten Vermerk-Version) — ein zwischenzeitlich revidiertes KO behält seinen
// NEUEN pending-Vermerk (No-op statt falschem failed an der neuen Version).
import { describe, expect, it } from "vitest";
import { MAX_AI_CHECK_QUEUE, createAiCheckWorker } from "../../services/app/src/ai-check-worker";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type ModelClient,
  ModelHttpError,
  ModelProvider,
  ModelTimeoutError,
  Reasoner,
} from "../../services/reasoner";

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

// Fake-CLIENT (nicht Fake-Reasoner): der echte ModelProvider ruft complete() — hier entstehen die
// realen Fehlerbilder (HTTP/Timeout) bzw. die unverwertbare Antwort, die der Provider zu null parst.
function fakeClient(complete: (system: string) => Promise<string>): ModelClient {
  return {
    name: "fake-model",
    complete: async (system: string) => complete(system),
  } as unknown as ModelClient;
}

async function appWithModelClient(client: ModelClient) {
  const services = buildServices();
  // ECHTER Reasoner + ECHTER ModelProvider — nur der Client (die HTTP-Fläche) ist gefaked.
  services.reasoner = new Reasoner(new ModelProvider(client));
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
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  return { app, services, headers };
}

async function createKo(
  app: Awaited<ReturnType<typeof appWithModelClient>>["app"],
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

// Erst ein Bestands-KO (Pool leer → dieser Lauf braucht keinen Judge), dann der eigentliche
// Prüf-Kandidat — sein Lauf urteilt gegen den Bestand über den ECHTEN Provider-Pfad.
async function runCheckAgainstBestand(client: ModelClient) {
  const { app, services, headers } = await appWithModelClient(client);
  await createKo(app, headers, "Bestand");
  await services.aiCheckWorker?.idle();
  const created = await createKo(app, headers, "Neuer Beitrag");
  await services.aiCheckWorker?.idle();
  return { services, created };
}

describe("WP-SHIP8-CLOSE F1: echte Providerfehler werden failed, NIE done (echter Reasoner, Fake-Client)", () => {
  it("(a) HTTP-Fehler des Modells (500) → failed/model-error", async () => {
    const { services, created } = await runCheckAgainstBestand(
      fakeClient(async () => {
        throw new ModelHttpError("Modell-API antwortete mit 500", 500);
      }),
    );
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("failed");
    expect(stored?.aiCheck?.fallbackReason).toBe("model-error");
  });

  it("(b) Modell-Timeout → failed/model-timeout", async () => {
    const { services, created } = await runCheckAgainstBestand(
      fakeClient(async () => {
        throw new ModelTimeoutError("Zeitlimit von 10 ms ueberschritten.", 10);
      }),
    );
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("failed");
    expect(stored?.aiCheck?.fallbackReason).toBe("model-timeout");
  });

  it("(c) unparsebarer Modell-Output (Provider parst zu null) → failed/model-error, NIE done", async () => {
    const { services, created } = await runCheckAgainstBestand(
      fakeClient(async () => "Ich bin Prosa ohne jedes JSON."),
    );
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("failed");
    expect(stored?.aiCheck?.fallbackReason).toBe("model-error");
  });

  it("(d) GEGENPROBE: sauberer Provider (gültige Urteile) → done", async () => {
    const { services, created } = await runCheckAgainstBestand(
      fakeClient(async (system) =>
        // Der System-Prompt unterscheidet die beiden Judges (relation- vs. beziehung-Vertrag).
        system.includes('"relation"')
          ? '{"relation":"kein_konflikt","older":null,"confidence":0.9,"begruendung":"ok","zitat_a":"a","zitat_b":"b"}'
          : '{"beziehung":"verschieden","gemeinsame_aussagen":[],"nur_in_a":"","nur_in_b":"","empfehlung":"getrennt_lassen","confidence":0.9,"begruendung":"ok"}',
      ),
    );
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("done");
    expect(stored?.aiCheck?.fallbackReason).toBeUndefined();
  });
});

// ---- F3: versionsbewusste Overflow-Eviction --------------------------------------------------

interface FakeKoState {
  version: number;
  aiCheck: { status: string; requestedAt: string; koVersion: number };
}

function evictionHarness() {
  const state = new Map<string, FakeKoState>();
  const resolves: { id: string; expected: number | undefined; written: boolean }[] = [];
  const fakeKo = {
    get: async (id: string) => state.get(id),
    markAiCheckPending: async () => true,
    // Spiegel der echten bedingten Mechanik (repo.resolveAiCheck): nur pending, und bei gesetzter
    // Erwartung nur, wenn Vermerk-Version UND Inhaltsversion noch exakt stimmen.
    resolveAiCheck: async (
      id: string,
      patch: { ok?: boolean; fallbackReason?: string; status?: string },
      expected?: number,
    ) => {
      const ko = state.get(id);
      const written =
        !!ko &&
        ko.aiCheck.status === "pending" &&
        (expected === undefined || (ko.aiCheck.koVersion === expected && ko.version === expected));
      if (written && ko) {
        ko.aiCheck = {
          ...ko.aiCheck,
          status: "failed",
          ...(patch.fallbackReason ? { fallbackReason: patch.fallbackReason } : {}),
        } as FakeKoState["aiCheck"];
      }
      resolves.push({ id, expected, written });
      return written;
    },
  } as unknown as AppServices["ko"];
  const worker = createAiCheckWorker({
    ko: fakeKo,
    // Der erste Job blockiert den EINEN Slot — alles Weitere staut in der Queue.
    run: (koId) => (koId === "job-running" ? new Promise(() => {}) : Promise.resolve({ ok: true })),
    log: () => {},
  });
  return { state, resolves, worker };
}

describe("WP-SHIP8-CLOSE F3: Queue-Eviction ist versionsbewusst (bedingter Abschluss)", () => {
  it("zwischenzeitlich revidiertes KO → Eviction ist No-op, der NEUE pending-Vermerk bleibt unangetastet", async () => {
    const { state, resolves, worker } = evictionHarness();
    state.set("job-alt", {
      version: 1,
      aiCheck: { status: "pending", requestedAt: "2026-07-22T06:00:00.000Z", koVersion: 1 },
    });
    worker.enqueue("job-running");
    await tick(); // der Blocker belegt den Slot
    worker.enqueue("job-alt");
    await tick(); // die Versions-Erfassung des Einreihens (async get) ist damit abgeschlossen
    // ZWISCHENZEITLICH revidiert: neuer pending-Vermerk für die NEUE Inhaltsversion 2.
    state.set("job-alt", {
      version: 2,
      aiCheck: { status: "pending", requestedAt: "2026-07-22T06:01:00.000Z", koVersion: 2 },
    });
    for (let i = 0; i < MAX_AI_CHECK_QUEUE - 1; i += 1) {
      worker.enqueue(`fuel-${i}`);
    }
    worker.enqueue("job-zuviel"); // Überlauf → der ÄLTESTE wartende (job-alt) wird verdrängt
    await tick();
    // Der bedingte Abschluss trug die ENQUEUE-Erwartung (Version 1) → No-op am neuen Vermerk.
    expect(resolves).toContainEqual({ id: "job-alt", expected: 1, written: false });
    expect(state.get("job-alt")?.aiCheck.status).toBe("pending");
    expect(state.get("job-alt")?.aiCheck.koVersion).toBe(2);
    expect(worker.has("job-alt")).toBe(false);
  });

  it("unverändertes KO → Eviction schreibt ehrlich failed/queue-overflow (Bedingung greift)", async () => {
    const { state, resolves, worker } = evictionHarness();
    state.set("job-treu", {
      version: 1,
      aiCheck: { status: "pending", requestedAt: "2026-07-22T06:00:00.000Z", koVersion: 1 },
    });
    worker.enqueue("job-running");
    await tick();
    worker.enqueue("job-treu");
    await tick();
    for (let i = 0; i < MAX_AI_CHECK_QUEUE - 1; i += 1) {
      worker.enqueue(`fuel-${i}`);
    }
    worker.enqueue("job-zuviel");
    await tick();
    expect(resolves).toContainEqual({ id: "job-treu", expected: 1, written: true });
    expect(state.get("job-treu")?.aiCheck.status).toBe("failed");
    expect((state.get("job-treu")?.aiCheck as { fallbackReason?: string }).fallbackReason).toBe(
      "queue-overflow",
    );
  });
});
