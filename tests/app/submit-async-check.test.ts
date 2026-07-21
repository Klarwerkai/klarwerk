// WP-SUBMIT-ASYNC (Pedis Architektur-Entscheid R3, 21.07.): Pruefen & Einreichen blockiert die
// Arbeit nicht mehr (Messung: 1:28 min synchrone KI-Pruefung im Submit-Pfad). Gepinnt wird:
// (a) der Submit wartet NIE auf die Pruefung (haengender/werfender Reasoner → trotzdem prompt 201,
//     KO traegt aiCheck pending),
// (b) der Hintergrund-Job laeuft danach und schreibt ehrlich done (Fake-Modell),
// (c) ohne aktives Modell EHRLICH failed/no-model (kein Fake-done),
// (d) ein echter Modellfehler → failed/model-error,
// (e) der bedingte Status-Write verliert NIE gegen einen nebenlaeufigen revise (CAS-Race),
// (f) Lazy-Re-Enqueue beim Board-Load nach einem simulierten Neustart (Worker-Reset),
// (g) Concurrency 1 ist als Konstante UND im Laufzeitverhalten gepinnt,
// (h) Quelltext-Pins: kein synchrones await detect* mehr im Submit-Pfad, Timing-Phasen des
//     Clients ohne Pruef-Phase, i18n-Schluessel in DE/EN/NL vorhanden.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_CHECK_CONCURRENCY,
  AI_CHECK_STALE_PENDING_MS,
  type AiCheckWorker,
  createAiCheckRunner,
  createAiCheckWorker,
  shouldReEnqueueAiCheck,
} from "../../services/app/src/ai-check-worker";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";

type Reasoner = AppServices["reasoner"];

// Fake-Reasoner mit AKTIVEM Modell: nur die drei vom Pruef-Pfad genutzten Flaechen (status +
// beide judge-Funktionen) — der uebrige Reasoner-Vertrag wird in diesen Tests nicht beruehrt.
function fakeModelReasoner(judge: () => Promise<null>): Reasoner {
  return {
    status: () => ({ active: true, provider: "fake-model", mode: "model" }),
    judgeConflict: judge,
    judgeDuplicate: judge,
  } as unknown as Reasoner;
}

async function appWithUser(mutate?: (services: AppServices) => void) {
  const services = buildServices();
  // Overrides (Fake-Reasoner/Spy-Worker) VOR buildApp — dasselbe Muster wie slideConverter.
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
  return res.json() as { id: string; aiCheck?: { status: string; requestedAt: string } };
}

describe("WP-SUBMIT-ASYNC (a): der Submit blockiert nicht mehr auf die KI-Pruefung", () => {
  it("haengender Reasoner (judge loest nie auf) → POST /api/kos antwortet trotzdem 201 + aiCheck pending", async () => {
    const { app, services, headers } = await appWithUser((s) => {
      // Modell aktiv, aber jedes Urteil haengt fuer immer — der ALTE synchrone Pfad wuerde hier
      // nie antworten (das war Pedis 1:28-min-Messung, nur unendlich).
      s.reasoner = fakeModelReasoner(() => new Promise<null>(() => {}));
    });
    // Erster Beitrag: Pool leer → sein Pruef-Job laeuft ohne Modell-Urteil durch.
    await createKo(app, headers, "Bestand");
    await services.aiCheckWorker?.idle();
    // Zweiter Beitrag: MUSS gegen den Bestand geprueft werden → der Job haengt im Hintergrund,
    // die Antwort kommt trotzdem sofort (inject-Rueckkehr = Beweis, sonst liefe der Test in den Timeout).
    const created = await createKo(app, headers, "Neuer Beitrag");
    expect(created.aiCheck?.status).toBe("pending");
    expect(Number.isFinite(Date.parse(created.aiCheck?.requestedAt ?? ""))).toBe(true);
    // Der Job haengt ehrlich weiter — kein erfundenes done.
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("pending");
  });

  it("Promote-Weg (Draft → KO) antwortet ebenfalls prompt 201 + aiCheck pending trotz haengendem Reasoner", async () => {
    const { app, services, headers } = await appWithUser((s) => {
      s.reasoner = fakeModelReasoner(() => new Promise<null>(() => {}));
    });
    await createKo(app, headers, "Bestand");
    await services.aiCheckWorker?.idle();
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: { title: "Entwurf", statement: "s", type: "best_practice", category: "K" },
    });
    const promoted = await app.inject({
      method: "POST",
      url: `/api/drafts/${(draft.json() as { id: string }).id}/promote`,
      headers,
      payload: {},
    });
    expect(promoted.statusCode).toBe(201);
    const ko = promoted.json() as { id: string; aiCheck?: { status: string } };
    expect(ko.aiCheck?.status).toBe("pending");
  });
});

describe("WP-SUBMIT-ASYNC (b): der Hintergrund-Job laeuft NACH der Antwort und schreibt done", () => {
  it("Fake-Modell (judge → null) → nach idle() steht aiCheck done mit finishedAt", async () => {
    const { app, services, headers } = await appWithUser((s) => {
      s.reasoner = fakeModelReasoner(async () => null);
    });
    await createKo(app, headers, "Bestand");
    const created = await createKo(app, headers, "Neuer Beitrag");
    await services.aiCheckWorker?.idle();
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("done");
    expect(Number.isFinite(Date.parse(stored?.aiCheck?.finishedAt ?? ""))).toBe(true);
    expect(stored?.aiCheck?.fallbackReason).toBeUndefined();
  });

  it("resolve ist ein Feld-MERGE: requestedAt des Job-Vermerks bleibt beim done-Write erhalten", async () => {
    const { app, services, headers } = await appWithUser((s) => {
      s.reasoner = fakeModelReasoner(async () => null);
    });
    const created = await createKo(app, headers, "Merge-Beweis");
    await services.aiCheckWorker?.idle();
    // Kontrollierter Job-Vermerk mit fixem requestedAt (Retry-/Re-Enqueue-Semantik) → neu einreihen.
    const requestedAt = "2026-07-21T06:00:00.000Z";
    expect(await services.ko.markAiCheckPending(created.id, requestedAt)).toBe(true);
    services.aiCheckWorker?.enqueue(created.id);
    await services.aiCheckWorker?.idle();
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("done");
    expect(stored?.aiCheck?.requestedAt).toBe(requestedAt);
  });
});

describe("WP-SUBMIT-ASYNC (c+d): der failed-Pfad ist ehrlich und traegt die Ursache", () => {
  it("kein aktives Modell (deterministischer Default-Reasoner) → failed + fallbackReason no-model", async () => {
    // KEIN Override: buildServices liefert im Test-Env den Reasoner ohne Modell (status().active=false).
    const { app, services, headers } = await appWithUser();
    const created = await createKo(app, headers, "Ohne Modell");
    await services.aiCheckWorker?.idle();
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("failed");
    expect(stored?.aiCheck?.fallbackReason).toBe("no-model");
    expect(Number.isFinite(Date.parse(stored?.aiCheck?.finishedAt ?? ""))).toBe(true);
  });

  it("Modellfehler im Pruef-Lauf (ModelCapacityError im judge) → failed + fallbackReason model-error", async () => {
    const { app, services, headers } = await appWithUser((s) => {
      // ModelCapacityError ist der EINE Judge-Fehler, den die Erkennung bewusst NICHT still
      // schluckt (SCRUM-498 B2) — er erreicht den Log-Haken des Runners und wird ehrlich als
      // model-error klassifiziert.
      s.reasoner = fakeModelReasoner(async () => {
        const err = new Error("Modell-Kontingent erschoepft");
        err.name = "ModelCapacityError";
        throw err;
      });
    });
    await createKo(app, headers, "Bestand");
    await services.aiCheckWorker?.idle();
    const created = await createKo(app, headers, "Zweiter Beitrag");
    await services.aiCheckWorker?.idle();
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("failed");
    expect(stored?.aiCheck?.fallbackReason).toBe("model-error");
  });

  it("Runner-Unit: inaktives Modell → Erkennung laeuft TROTZDEM (deterministischer Anteil), Status ehrlich no-model", async () => {
    // Der deterministische Duplikat-Anteil (sehr hohe Textdeckung) braucht kein Modell und lief
    // auch im alten synchronen Pfad ohne eines — der Runner darf ihn nicht ueberspringen.
    let detectionsTouched = 0;
    const runner = createAiCheckRunner({
      ko: {
        get: async () => {
          detectionsTouched += 1; // beide detect*-Funktionen beginnen mit ko.get(koId)
          return null;
        },
      } as unknown as AppServices["ko"],
      conflicts: {} as AppServices["conflicts"],
      overlaps: {} as AppServices["overlaps"],
      overlapSettings: {} as AppServices["overlapSettings"],
      reasoner: {
        status: () => ({ active: false, provider: "deterministic", mode: "deterministic" }),
        judgeConflict: async () => null,
        judgeDuplicate: async () => null,
      } as unknown as Reasoner,
    });
    expect(await runner("ko-1")).toEqual({ ok: false, fallbackReason: "no-model" });
    expect(detectionsTouched).toBe(2); // Konflikt- UND Duplikat-Erkennung liefen
  });

  it("Retry-Route: failed → POST /api/kos/:id/ai-check reiht neu ein (200 pending); done → 409; unbekannt → 404", async () => {
    const { app, services, headers } = await appWithUser();
    const created = await createKo(app, headers, "Retry-Kandidat");
    await services.aiCheckWorker?.idle();
    expect((await services.ko.get(created.id))?.aiCheck?.status).toBe("failed");
    const retry = await app.inject({
      method: "POST",
      url: `/api/kos/${created.id}/ai-check`,
      headers,
    });
    expect(retry.statusCode).toBe(200);
    expect((retry.json() as { status: string }).status).toBe("pending");
    await services.aiCheckWorker?.idle();
    // Ohne Modell endet auch der Retry ehrlich als failed/no-model — aber der Job LIEF erneut.
    expect((await services.ko.get(created.id))?.aiCheck?.fallbackReason).toBe("no-model");
    // done ist nicht wiederholbar (kein stiller Doppel-Lauf).
    await services.ko.markAiCheckPending(created.id);
    await services.ko.resolveAiCheck(created.id, { ok: true });
    const conflict = await app.inject({
      method: "POST",
      url: `/api/kos/${created.id}/ai-check`,
      headers,
    });
    expect(conflict.statusCode).toBe(409);
    const missing = await app.inject({ method: "POST", url: "/api/kos/nope/ai-check", headers });
    expect(missing.statusCode).toBe(404);
  });
});

describe("WP-SUBMIT-ASYNC (e): der bedingte Status-Write verliert nie gegen revise (CAS-Race)", () => {
  it("mark pending → nebenlaeufiger revise → resolve schreibt NUR das aiCheck-Feld (Titel bleibt revidiert)", async () => {
    const { app, services, userId, headers } = await appWithUser();
    const created = await createKo(app, headers, "Original-Titel");
    await services.aiCheckWorker?.idle();
    const requestedAt = "2026-07-21T06:00:00.000Z";
    expect(await services.ko.markAiCheckPending(created.id, requestedAt)).toBe(true);
    // Der Autor ueberarbeitet WAEHREND die Pruefung laeuft — genau das Race des Hintergrund-Jobs.
    await services.ko.revise(created.id, { title: "Revidierter Titel" }, userId);
    expect(await services.ko.resolveAiCheck(created.id, { ok: true })).toBe(true);
    const stored = await services.ko.get(created.id);
    expect(stored?.title).toBe("Revidierter Titel"); // revise hat NICHTS verloren
    expect(stored?.aiCheck?.status).toBe("done");
    expect(stored?.aiCheck?.requestedAt).toBe(requestedAt);
  });

  it("resolve ist BEDINGT: nach dem ersten Abschluss (nicht mehr pending) schreibt ein zweiter nichts mehr", async () => {
    const { app, services, headers } = await appWithUser();
    const created = await createKo(app, headers, "Einmal-Abschluss");
    await services.aiCheckWorker?.idle();
    await services.ko.markAiCheckPending(created.id);
    expect(await services.ko.resolveAiCheck(created.id, { ok: true })).toBe(true);
    // Zweiter (verspaeteter) Abschluss — z. B. ein Doppel-Lauf — darf den Status nicht umschreiben.
    expect(
      await services.ko.resolveAiCheck(created.id, { ok: false, fallbackReason: "model-error" }),
    ).toBe(false);
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("done");
    expect(stored?.aiCheck?.fallbackReason).toBeUndefined();
  });
});

describe("WP-SUBMIT-ASYNC (f): Lazy-Re-Enqueue beim Board-Load (Neustart-Ausgleich)", () => {
  function spyWorker(): { worker: AiCheckWorker; enqueued: string[] } {
    const enqueued: string[] = [];
    return {
      enqueued,
      worker: {
        enqueue: (koId: string) => {
          enqueued.push(koId);
        },
        has: () => false,
        queuedCount: () => 0,
        idle: async () => {},
      },
    };
  }

  it("pending aelter als die Stale-Grenze → Board-Load reiht neu ein und frischt requestedAt auf", async () => {
    const spy = spyWorker();
    // Spy-Worker VOR buildApp = simulierter Neustart: die alte In-Memory-Queue existiert nicht mehr,
    // nur der pending-Vermerk am KO hat ueberlebt.
    const { app, services, headers } = await appWithUser((s) => {
      s.aiCheckWorker = spy.worker;
    });
    const created = await createKo(app, headers, "Verwaister Job");
    spy.enqueued.length = 0; // den Submit-Enqueue aus der Betrachtung nehmen
    const staleIso = new Date(Date.now() - AI_CHECK_STALE_PENDING_MS - 60_000).toISOString();
    await services.ko.markAiCheckPending(created.id, staleIso);
    const board = await app.inject({ method: "GET", url: "/api/validation/board", headers });
    expect(board.statusCode).toBe(200);
    expect(spy.enqueued).toEqual([created.id]);
    const stored = await services.ko.get(created.id);
    expect(stored?.aiCheck?.status).toBe("pending");
    // requestedAt aufgefrischt → der NAECHSTE Board-Load reiht nicht erneut ein (kein Sturm).
    expect(Date.parse(stored?.aiCheck?.requestedAt ?? "")).toBeGreaterThan(Date.parse(staleIso));
    const again = await app.inject({ method: "GET", url: "/api/validation/board", headers });
    expect(again.statusCode).toBe(200);
    expect(spy.enqueued).toEqual([created.id]);
  });

  it("frisches pending bleibt unangetastet (kein Doppel-Enqueue je Load)", async () => {
    const spy = spyWorker();
    const { app, services, headers } = await appWithUser((s) => {
      s.aiCheckWorker = spy.worker;
    });
    const created = await createKo(app, headers, "Frischer Job");
    spy.enqueued.length = 0;
    await services.ko.markAiCheckPending(created.id); // requestedAt = jetzt
    const board = await app.inject({ method: "GET", url: "/api/validation/board", headers });
    expect(board.statusCode).toBe(200);
    expect(spy.enqueued).toEqual([]);
  });

  it("shouldReEnqueueAiCheck (pure): nur ALTES pending zaehlt; kaputtes requestedAt gilt defensiv als festhaengend", () => {
    const nowMs = Date.parse("2026-07-21T12:00:00.000Z");
    const old = new Date(nowMs - AI_CHECK_STALE_PENDING_MS - 1).toISOString();
    const fresh = new Date(nowMs - 1000).toISOString();
    expect(shouldReEnqueueAiCheck({ status: "pending", requestedAt: old }, nowMs)).toBe(true);
    expect(shouldReEnqueueAiCheck({ status: "pending", requestedAt: fresh }, nowMs)).toBe(false);
    expect(shouldReEnqueueAiCheck({ status: "done", requestedAt: old }, nowMs)).toBe(false);
    expect(shouldReEnqueueAiCheck({ status: "failed", requestedAt: old }, nowMs)).toBe(false);
    expect(shouldReEnqueueAiCheck(undefined, nowMs)).toBe(false);
    expect(shouldReEnqueueAiCheck({ status: "pending", requestedAt: "kaputt" }, nowMs)).toBe(true);
  });
});

describe("WP-SUBMIT-ASYNC (g): Concurrency 1 — gepinnt als Konstante und im Laufzeitverhalten", () => {
  it("AI_CHECK_CONCURRENCY === 1 (bewusste Entscheidung: kein Selbst-Stau des Modell-Kontingents)", () => {
    expect(AI_CHECK_CONCURRENCY).toBe(1);
  });

  it("drei eingereihte Jobs laufen strikt nacheinander (maxActive bleibt 1), Dedupe verhindert Doppel-Einreihung", async () => {
    let active = 0;
    let maxActive = 0;
    const started: string[] = [];
    const release: (() => void)[] = [];
    // Macrotask-Tick: laesst alle Mikrotasks (runOne → resolveAiCheck → pump) sicher abarbeiten.
    const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
    const worker = createAiCheckWorker({
      ko: { resolveAiCheck: async () => true } as unknown as AppServices["ko"],
      run: (koId) =>
        new Promise((resolveRun) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          started.push(koId);
          release.push(() => {
            active -= 1;
            resolveRun({ ok: true });
          });
        }),
      log: () => {},
    });
    worker.enqueue("a");
    worker.enqueue("b");
    worker.enqueue("b"); // Dedupe: steht bereits an
    worker.enqueue("c");
    expect(worker.queuedCount()).toBe(3);
    expect(worker.has("b")).toBe(true);
    await tick();
    expect(started).toEqual(["a"]); // nur EIN Job laeuft
    release[0]?.();
    await tick();
    expect(started).toEqual(["a", "b"]);
    release[1]?.();
    await tick();
    expect(started).toEqual(["a", "b", "c"]);
    release[2]?.();
    await worker.idle();
    expect(maxActive).toBe(1);
  });

  it("PII-freies Log: eine Zeile je Job mit KO-Id, Status und Dauer — ohne Inhalte", async () => {
    const lines: string[] = [];
    const worker = createAiCheckWorker({
      ko: { resolveAiCheck: async () => true } as unknown as AppServices["ko"],
      run: async () => ({ ok: false, fallbackReason: "no-model" as const }),
      log: (line) => lines.push(line),
    });
    worker.enqueue("ko-geheimnisfrei");
    await worker.idle();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("ko=ko-geheimnisfrei");
    expect(lines[0]).toContain("status=failed");
    expect(lines[0]).toContain("grund=no-model");
    expect(lines[0]).toMatch(/dauer=\d+ms/);
  });
});

describe("WP-SUBMIT-ASYNC (h): Quelltext-Pins — Submit-Pfad ohne synchrones detect, Client ohne Pruef-Phase, i18n x3", () => {
  const read = (rel: string): string => readFileSync(resolve(process.cwd(), rel), "utf8");

  it("ko-routes/capture-routes enthalten KEIN awaited detect* mehr; der Worker nutzt die Pfade weiter", () => {
    const koRoutes = read("services/app/src/routes/ko-routes.ts");
    const captureRoutes = read("services/app/src/routes/capture-routes.ts");
    for (const src of [koRoutes, captureRoutes]) {
      expect(src).not.toContain("await detectConflictsForKo");
      expect(src).not.toContain("await detectDuplicatesForKo");
      expect(src).toContain("markAiCheckPending");
    }
    const worker = read("services/app/src/ai-check-worker.ts");
    expect(worker).toContain("detectConflictsForKo(");
    expect(worker).toContain("detectDuplicatesForKo(");
  });

  it("Client-Timing kennt nur create/upload/link — keine Pruef-Phase im Einreichen", () => {
    const timing = read("apps/web/src/lib/submitTiming.ts");
    expect(timing).toContain('export type SubmitTimingKey = "create" | "upload" | "link"');
    expect(timing).not.toContain("check");
  });

  it("i18n: Hinweis- und Badge-Schluessel existieren in DE, EN und NL (je genau einmal)", () => {
    const i18n = read("apps/web/src/i18n.ts");
    for (const key of [
      "capture.aiCheckBackground",
      "val.filterAiPending",
      "val.aiCheck.pending",
      "val.aiCheck.pendingHint",
      "val.aiCheck.failed",
      "val.aiCheck.retry",
      "val.aiCheck.retryStarted",
      "val.aiCheck.reason.no-model",
      "val.aiCheck.reason.model-error",
    ]) {
      expect(i18n.split(`"${key}"`).length - 1).toBe(3);
    }
  });
});
