// D-AISTATE (Pedi 23.07.) — Server-Beweise:
//  PAKET 1.3: die Duplikat-/Konfliktprüfung ist KERNFUNKTION. Der DETERMINISTISCHE Anteil läuft und
//  erzeugt sein Ergebnis IMMER — auch ohne Modell. Sobald ein Modell da ist, wird die LLM-Ebene
//  IMMER ZUSÄTZLICH aufgerufen (jeder-gegen-jeden: alles unter der Textdeckungs-Schwelle geht an die
//  KI) — Spy-Assertion, nicht übersprungen.
//  PAKET 3.1 (Pedi Punkt 6): Eine Überarbeitung (revise) setzt die Prüfung zurück und reiht sie für
//  die NEUE Inhaltsversion neu ein (Versions-Bindung verhindert ein falsches stale-done).
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { Reasoner as RealReasoner } from "../../services/reasoner";

type Reasoner = AppServices["reasoner"];

// Fake-Reasoner mit aktivem Modell + Zähler auf den zwei Judge-Flächen, die die Erkennung nutzt.
// bens V2-Auflage (Testehrlichkeit): die Outcome-Fakes liefern ECHTE Nicht-Treffer-Urteile
// (kein_konflikt/verschieden) statt des unmöglichen `{verdict:null}` ohne failure — genau der
// Vertrag, den der echte Reasoner bei „Modell da, kein Fund" liefert.
function spyModelReasoner(): { reasoner: Reasoner; judgeCalls: () => number } {
  let calls = 0;
  const conflictOutcome = async () => {
    calls += 1;
    return {
      verdict: {
        relation: "kein_konflikt",
        older: null,
        confidence: 0.9,
        begruendung: "ok",
        zitat_a: "a",
        zitat_b: "b",
      },
    };
  };
  const duplicateOutcome = async () => {
    calls += 1;
    return {
      verdict: {
        beziehung: "verschieden",
        aspects: [],
        nurInA: "",
        nurInB: "",
        empfehlung: "getrennt_lassen",
        confidence: 0.9,
        begruendung: "ok",
      },
    };
  };
  const reasoner = {
    status: () => ({ active: true, provider: "fake-model", mode: "model" }),
    judgeConflict: async () => {
      calls += 1;
      return null;
    },
    judgeDuplicate: async () => {
      calls += 1;
      return null;
    },
    judgeConflictOutcome: conflictOutcome,
    judgeDuplicateOutcome: duplicateOutcome,
  } as unknown as Reasoner;
  return { reasoner, judgeCalls: () => calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  return { app, services, headers: { authorization: `Bearer ${login.json().token}` } };
}

async function createKo(
  app: Awaited<ReturnType<typeof appWithUser>>["app"],
  headers: Record<string, string>,
  title: string,
  statement: string,
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: { title, statement, type: "best_practice", category: "K" },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as { id: string; version?: number };
}

describe("PAKET 1.3: Dedupe/Konflikt — deterministisch IMMER, LLM zusätzlich sobald Modell da", () => {
  it("OHNE Modell: der deterministische Duplikat-Eintrag entsteht (Kernfunktion, kein Modell nötig)", async () => {
    // bens V2-Auflage (Testehrlichkeit, aistate-fix3): der ECHTE Reasoner ohne Modell — die
    // no-model-Ausgänge kommen aus dem echten Outcome-Vertrag (failure:"no-model"), nicht aus einem
    // `{verdict:null}`-Fake. Der Fetch-Spy beweist: Provider-/complete-Aufrufe EXAKT 0 (kein Netz).
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { app, services, headers } = await appWithUser((s) => {
      s.reasoner = new RealReasoner() as unknown as Reasoner;
    });
    // Zwei praktisch WORTGLEICHE Beiträge → sehr hohe Textdeckung (≥ Schwelle) → deterministischer
    // Eintrag OHNE jedes Modell.
    await createKo(
      app,
      headers,
      "Pumpe P2 Druckverlust",
      "Bei Pumpe P2 fällt der Druck an Ventil V4.",
    );
    const second = await createKo(
      app,
      headers,
      "Pumpe P2 Druckverlust",
      "Bei Pumpe P2 fällt der Druck an Ventil V4.",
    );
    await services.aiCheckWorker?.idle();
    // Deterministische Ebene hat ihr Ergebnis erzeugt: ein offener Überschneidungs-Eintrag existiert.
    const open = await services.overlaps.unresolved();
    expect(open.length).toBeGreaterThanOrEqual(1);
    expect(open.some((e) => e.detector?.method === "deterministic")).toBe(true);
    // Und der Job-Status ist ehrlich no-model (kein Modell) — NICHT „done".
    const stored = await services.ko.get(second.id);
    expect(stored?.aiCheck?.fallbackReason).toBe("no-model");
    // bens V2: EXAKT 0 Modell-/Netzaufrufe — der no-model-Ausgang stammt aus dem echten Vertrag.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("MIT Modell: die LLM-Ebene wird für nicht-wortgleiche Paare NACHWEISLICH aufgerufen (nicht übersprungen)", async () => {
    const spy = spyModelReasoner();
    const { app, services, headers } = await appWithUser((s) => {
      s.reasoner = spy.reasoner;
    });
    // Zwei INHALTLICH verschiedene Beiträge (Textdeckung unter der Auto-Schwelle) → „jeder gegen
    // jeden" schickt das Paar an die KI-Ebene (der Inhalt, nicht die Wortdeckung, entscheidet).
    await createKo(app, headers, "Ventil V4 klemmt", "Das Ventil V4 klemmt bei Kälte.");
    await createKo(app, headers, "Schmierplan Lager", "Lager alle 200 Stunden nachfetten.");
    await services.aiCheckWorker?.idle();
    // Beweis: bei vorhandenem Modell lief die LLM-Urteils-Ebene (Judge) mindestens einmal mit.
    expect(spy.judgeCalls()).toBeGreaterThanOrEqual(1);
  });
});

describe("PAKET 3.1: revise setzt die Prüfung zurück und reiht sie für die NEUE Version neu ein", () => {
  it("KO in Prüfung → editiert → aiCheck neu (an neue Version gebunden), nach Abschluss done", async () => {
    // Fake-Modell, dessen Judge sauber null liefert → Läufe schließen als done ab.
    const outcome = async (): Promise<{ verdict: null }> => ({ verdict: null });
    const modelReasoner = {
      status: () => ({ active: true, provider: "fake-model", mode: "model" }),
      judgeConflict: async () => null,
      judgeDuplicate: async () => null,
      judgeConflictOutcome: outcome,
      judgeDuplicateOutcome: outcome,
    } as unknown as Reasoner;
    const { app, services, headers } = await appWithUser((s) => {
      s.reasoner = modelReasoner;
    });
    const created = await createKo(app, headers, "Erstfassung", "Aussage in der Erstfassung.");
    await services.aiCheckWorker?.idle();
    const before = await services.ko.get(created.id);
    expect(before?.aiCheck?.status).toBe("done");
    const versionBefore = before?.version ?? 0;

    // Inhaltliche Überarbeitung — das darf NICHT gesperrt sein und MUSS die Prüfung zurücksetzen.
    const revised = await app.inject({
      method: "PUT",
      url: `/api/kos/${created.id}`,
      headers,
      payload: { action: "revise", changes: { statement: "Vollständig überarbeitete Aussage." } },
    });
    expect(revised.statusCode).toBe(200);
    await services.aiCheckWorker?.idle();

    const after = await services.ko.get(created.id);
    // Neue Inhaltsversion …
    expect(after?.version).toBe(versionBefore + 1);
    // … und der aiCheck ist an genau DIESE neue Version gebunden (der Lauf wurde neu ausgelöst,
    // nicht die alte Prüfung stehen geblieben) und sauber abgeschlossen.
    expect(after?.aiCheck?.status).toBe("done");
    expect(after?.aiCheck?.koVersion).toBe(after?.version);
  });

  it("Quelltext-Pin: die revise-Route reiht bei vorhandenem Prüf-Job neu ein (Punkt 6)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(
      resolve(process.cwd(), "services/app/src/routes/ko-routes.ts"),
      "utf8",
    );
    expect(src).toContain("if (aiCheckWorker && revised.aiCheck)");
    expect(src).toContain("await ko.markAiCheckPending(id)");
  });
});
